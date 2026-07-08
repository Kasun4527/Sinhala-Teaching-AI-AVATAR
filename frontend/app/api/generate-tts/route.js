export const runtime = "nodejs";

import { GoogleGenAI } from "@google/genai";
import { spawn } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

const RHUBARB_EXE =
  "D:\\UOR\\7th sem\\FYP\\AI AVATAR\\avatar-3d-standalone\\server\\rhubarb\\Rhubarb-Lip-Sync-1.14.0-Windows\\rhubarb.exe";

function pcmToWav(pcmBuffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const buffer = Buffer.alloc(44 + dataSize);
  buffer.write("RIFF", 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write("WAVE", 8);
  buffer.write("fmt ", 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20);
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(byteRate, 28);
  buffer.writeUInt16LE(blockAlign, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write("data", 36);
  buffer.writeUInt32LE(dataSize, 40);
  pcmBuffer.copy(buffer, 44);
  return buffer;
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
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const wavPath = join(tmpdir(), `rhubarb-in-${id}.wav`);
  const jsonPath = join(tmpdir(), `rhubarb-out-${id}.json`);
  await writeFile(wavPath, wavBuffer);
  try {
    await new Promise((resolve, reject) => {
      const proc = spawn(RHUBARB_EXE, ["-r", "phonetic", "-f", "json", "-o", jsonPath, wavPath]);
      let stderr = "";
      proc.stderr.on("data", (d) => { stderr += d.toString(); });
      proc.on("error", reject);
      proc.on("close", (code) => {
        if (code === 0) resolve();
        else reject(new Error(`rhubarb.exe exited ${code}: ${stderr}`));
      });
    });
    const raw = JSON.parse(await readFile(jsonPath, "utf-8"));
    const timeline = raw.mouthCues.map((c) => ({ start: c.start, end: c.end, viseme: c.value }));
    return mergeShortSegments(timeline);
  } finally {
    unlink(wavPath).catch(() => {});
    unlink(jsonPath).catch(() => {});
  }
}

export async function POST(request) {
  const apiKey = process.env.GOOGLE_API_KEY;
  if (!apiKey) return Response.json({ detail: "GOOGLE_API_KEY not set" }, { status: 500 });

  const { text } = await request.json();
  if (!text) return Response.json({ detail: "text is required" }, { status: 400 });

  try {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: text.slice(0, 3000),
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Aoede" } },
        },
      },
    });

    const candidate = response.candidates?.[0];
    if (!candidate?.content) {
      const reason = candidate?.finishReason || response.promptFeedback?.blockReason || "unknown";
      throw new Error(`No audio content returned (reason: ${reason})`);
    }

    const base64Audio = candidate.content.parts[0].inlineData.data;
    const pcmBuffer = Buffer.from(base64Audio, "base64");
    const wavBuffer = pcmToWav(pcmBuffer, 24000, 1, 16);
    const timeline = await getTimeline(wavBuffer);

    return Response.json({ audio: wavBuffer.toString("base64"), timeline });
  } catch (err) {
    console.error("generate-tts:", err);
    return Response.json({ detail: String(err?.message || err) }, { status: 500 });
  }
}
