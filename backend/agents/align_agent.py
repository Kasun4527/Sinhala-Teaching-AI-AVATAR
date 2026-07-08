"""
Whisper forced-alignment agent.
Runs faster-whisper on a WAV buffer/path to get word-level timestamps,
then groups words into sentence segments matching the original text.
"""

import re
import os
import tempfile
from typing import List, Dict, Optional

_model = None

def _get_model():
    global _model
    if _model is None:
        from faster_whisper import WhisperModel
        # "base" is fast (~150MB); language="si" for Sinhala
        _model = WhisperModel("base", device="cpu", compute_type="int8")
        print("[AlignAgent] faster-whisper model loaded (base/cpu/int8)")
    return _model


def get_word_timestamps(wav_bytes: bytes) -> List[Dict]:
    """
    Run faster-whisper on raw WAV bytes.
    Returns: [{"word": str, "start": float, "end": float}, ...]
    """
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    try:
        tmp.write(wav_bytes)
        tmp.flush()
        tmp.close()

        model = _get_model()
        segments, _ = model.transcribe(
            tmp.name,
            word_timestamps=True,
            language="si",          # Sinhala; whisper auto-detects if wrong
            beam_size=1,            # fastest setting
            vad_filter=True,        # skip silence
        )

        words = []
        for seg in segments:
            if seg.words:
                for w in seg.words:
                    words.append({
                        "word":  w.word.strip(),
                        "start": round(w.start, 3),
                        "end":   round(w.end,   3),
                    })
        return words
    finally:
        try:
            os.unlink(tmp.name)
        except OSError:
            pass


def words_to_sentence_segments(
    text: str,
    words: List[Dict],
    fallback_duration: float = 0.0,
) -> List[Dict]:
    """
    Map word timestamps onto sentence boundaries from the original text.

    Strategy:
      1. Split text into sentences on punctuation.
      2. For each sentence count its words.
      3. Consume that many words from the whisper output.
      4. Sentence start = first word start, end = last word end.

    Falls back to character-ratio estimation if whisper returns no words.
    """
    # Clean image placeholders before splitting
    clean = re.sub(r'\[IMAGE:[^\]]+\]', '', text, flags=re.IGNORECASE).strip()

    # Split on Sinhala + Latin sentence endings, keep non-empty
    sentences = [s.strip() for s in re.split(r'(?<=[.!?।෴\n])\s+', clean) if s.strip()]
    if not sentences:
        return []

    # --- fallback: character-ratio ---
    if not words:
        total_chars = sum(len(s) for s in sentences)
        dur = fallback_duration or 10.0
        t = 0.0
        result = []
        for s in sentences:
            d = (len(s) / total_chars) * dur
            result.append({"text": s, "start": round(t, 3), "end": round(t + d, 3)})
            t += d
        return result

    # --- whisper path ---
    result = []
    word_idx = 0

    for sentence in sentences:
        # rough word count from the sentence
        sentence_word_count = max(1, len(sentence.split()))

        if word_idx >= len(words):
            # no more whisper words — estimate remainder from last known end
            last_end = result[-1]["end"] if result else 0.0
            total_remaining_chars = sum(len(s) for s in sentences[len(result):])
            total_chars = sum(len(s) for s in sentences)
            d = (len(sentence) / max(total_chars, 1)) * fallback_duration
            result.append({
                "text":  sentence,
                "start": round(last_end, 3),
                "end":   round(last_end + d, 3),
            })
            continue

        seg_start = words[word_idx]["start"]
        end_idx   = min(word_idx + sentence_word_count, len(words)) - 1
        seg_end   = words[end_idx]["end"]
        word_idx  = end_idx + 1

        result.append({
            "text":  sentence,
            "start": round(seg_start, 3),
            "end":   round(seg_end,   3),
        })

    return result
