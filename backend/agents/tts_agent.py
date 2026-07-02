import os
import sys
import wave
import base64
import io
from google import genai
from google.genai import types

if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass


def generate_teacher_speech(text: str) -> bytes:
    """Convert text to WAV audio bytes using Gemini TTS."""
    api_key = os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise ValueError("GOOGLE_API_KEY not set in environment")

    client = genai.Client(api_key=api_key)

    # Trim text to reasonable length for TTS
    speech_text = text[:3000] if len(text) > 3000 else text

    response = client.models.generate_content(
        model="gemini-2.5-flash-preview-tts",
        contents=speech_text,
        config=types.GenerateContentConfig(
            response_modalities=["AUDIO"],
            speech_config=types.SpeechConfig(
                voice_config=types.VoiceConfig(
                    prebuilt_voice_config=types.PrebuiltVoiceConfig(
                        voice_name="Aoede"  # Female teacher voice
                    )
                )
            ),
        ),
    )

    # Extract PCM audio bytes
    audio_data = response.candidates[0].content.parts[0].inline_data.data
    pcm_bytes = base64.b64decode(audio_data)

    # Wrap PCM in WAV container so browser can decode it
    wav_buffer = io.BytesIO()
    with wave.open(wav_buffer, "wb") as wf:
        wf.setnchannels(1)       # mono
        wf.setsampwidth(2)       # 16-bit
        wf.setframerate(24000)   # 24kHz (Gemini TTS default)
        wf.writeframes(pcm_bytes)

    return wav_buffer.getvalue()
