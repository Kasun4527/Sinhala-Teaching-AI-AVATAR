export const runtime = "nodejs";

import { GoogleGenAI } from "@google/genai";
import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

// Rotate through multiple API keys — add GOOGLE_API_KEY_2, _3 etc in .env.local
const API_KEYS = [
  process.env.GOOGLE_API_KEY,
  process.env.GOOGLE_API_KEY_2,
  process.env.GOOGLE_API_KEY_3,
  process.env.GOOGLE_API_KEY_4,
].filter(Boolean);

let _keyIdx = 0;
function getAI() {
  if (API_KEYS.length === 0) return null;
  const key = API_KEYS[_keyIdx % API_KEYS.length];
  return new GoogleGenAI({ apiKey: key });
}
function rotateKey() { _keyIdx = (_keyIdx + 1) % API_KEYS.length; }

const RHUBARB_EXE =
  "D:\\UOR\\7th sem\\FYP\\AI AVATAR\\avatar-3d-standalone\\server\\rhubarb\\Rhubarb-Lip-Sync-1.14.0-Windows\\rhubarb.exe";

const SAMPLE_RATE = 24000, CHANNELS = 1, BITS = 16;

function pcmToWav(pcmBuffer) {
  const byteRate   = (SAMPLE_RATE * CHANNELS * BITS) / 8;
  const blockAlign = (CHANNELS * BITS) / 8;
  const dataSize   = pcmBuffer.length;
  const buf = Buffer.alloc(44 + dataSize);
  buf.write("RIFF", 0);
  buf.writeUInt32LE(36 + dataSize, 4);
  buf.write("WAVE", 8);
  buf.write("fmt ", 12);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(CHANNELS, 22);
  buf.writeUInt32LE(SAMPLE_RATE, 24);
  buf.writeUInt32LE(byteRate, 28);
  buf.writeUInt16LE(blockAlign, 32);
  buf.writeUInt16LE(BITS, 34);
  buf.write("data", 36);
  buf.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(buf, 44);
  return buf;
}

function mergeShortSegments(timeline, minDuration = 0.07) {
  const merged = [];
  for (const seg of timeline) {
    if (seg.end - seg.start < minDuration && merged.length > 0) {
      merged[merged.length - 1].end = seg.end;
    } else {
      merged.push({ ...seg });
    }
  }
  return merged;
}

async function getTimeline(wavBuffer) {
  const id       = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const wavPath  = join(tmpdir(), `rhubarb-in-${id}.wav`);
  const jsonPath = join(tmpdir(), `rhubarb-out-${id}.json`);
  await writeFile(wavPath, wavBuffer);
  try {
    await new Promise((resolve, reject) => {
      const proc = spawn(RHUBARB_EXE, ["-r", "phonetic", "-f", "json", "-o", jsonPath, wavPath]);
      let stderr = "";
      proc.stderr.on("data", d => { stderr += d.toString(); });
      proc.on("error", reject);
      proc.on("close", code => code === 0 ? resolve() : reject(new Error(`rhubarb exited ${code}: ${stderr}`)));
    });
    const raw = JSON.parse(await readFile(jsonPath, "utf-8"));
    return mergeShortSegments(raw.mouthCues.map(c => ({ start: c.start, end: c.end, viseme: c.value })));
  } finally {
    unlink(wavPath).catch(() => {});
    unlink(jsonPath).catch(() => {});
  }
}

/**
 * Split text into speakable paragraphs.
 * Works for both English and Sinhala — splits on blank lines or sentence
 * boundaries, keeping chunks large enough to sound natural.
 */
function splitParagraphs(text) {
  // First try blank-line splitting (most reliable)
  const byBlankLine = text.split(/\n\s*\n/).map(s => s.replace(/\n/g, " ").trim()).filter(s => s.length > 10);
  if (byBlankLine.length > 1) return byBlankLine;

  // Fall back: split on single newlines
  const byLine = text.split(/\n/).map(s => s.trim()).filter(s => s.length > 10);
  if (byLine.length > 1) return byLine;

  // Last resort: split long text on sentence boundaries every ~300 chars
  const chunks = [];
  let cur = "";
  for (const sentence of text.split(/(?<=[.!?।෴])\s+/)) {
    cur += (cur ? " " : "") + sentence;
    if (cur.length >= 300) { chunks.push(cur.trim()); cur = ""; }
  }
  if (cur.trim()) chunks.push(cur.trim());
  return chunks.length ? chunks : [text.trim()];
}

/** Call Gemini TTS for one piece of text — returns raw PCM Buffer. Rotates keys on 429. */
async function ttsChunk(text, attempt = 0) {
  const ai = getAI();
  if (!ai) throw new Error("No API keys configured");
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: text,
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } } },
      },
    });
    const candidate = response.candidates?.[0];
    if (!candidate?.content) {
      throw new Error(`No audio returned (reason: ${candidate?.finishReason || "unknown"})`);
    }
    return Buffer.from(candidate.content.parts[0].inlineData.data, "base64");
  } catch (err) {
    if (err.status === 429 && attempt < API_KEYS.length - 1) {
      console.warn(`[TTS] key quota exceeded, rotating to next key (attempt ${attempt + 1})`);
      rotateKey();
      return ttsChunk(text, attempt + 1);
    }
    throw err;
  }
}

export async function POST(request) {
  if (API_KEYS.length === 0) return Response.json({ detail: "GOOGLE_API_KEY not set" }, { status: 500 });

  const { text } = await request.json();
  if (!text) return Response.json({ detail: "text is required" }, { status: 400 });

  try {
    const cleanText = text.replace(/\[IMAGE:[^\]]+\]/gi, "").trim().slice(0, 4000);

    // Split the speech text into natural paragraphs.
    // Works for Sinhala and English — no client-side paragraph list needed.
    const paragraphs = splitParagraphs(cleanText);

    console.log(`[TTS] generating ${paragraphs.length} paragraph chunk(s) with ${API_KEYS.length} key(s)`);

    // Generate TTS for each paragraph sequentially to respect per-key quota
    const BATCH = 5;
    const pcmChunks = [];
    for (let i = 0; i < paragraphs.length; i += BATCH) {
      const batch = paragraphs.slice(i, i + BATCH);
      const results = await Promise.all(batch.map(p => ttsChunk(p)));
      pcmChunks.push(...results);
    }

    // Build per-paragraph WAV buffers (returned individually to the client)
    const audioChunks = pcmChunks.map(pcm => pcmToWav(pcm).toString("base64"));

    // Concatenate all PCM for the full WAV (used by Rhubarb for lip-sync)
    const fullWav = pcmToWav(Buffer.concat(pcmChunks));
    const timeline = await getTimeline(fullWav);

    console.log(`[TTS] done — ${audioChunks.length} chunks, timeline: ${timeline.length} cues`);

    return Response.json({
      // Full audio for lip-sync (Avatar3D canvas uses this for mouth animation)
      audio: fullWav.toString("base64"),
      timeline,
      // Individual paragraph audio chunks — played sequentially for highlighting
      audioChunks,
    });
  } catch (err) {
    console.error("generate-tts:", err);
    return Response.json({ detail: String(err?.message || err) }, { status: 500 });
  }
}
