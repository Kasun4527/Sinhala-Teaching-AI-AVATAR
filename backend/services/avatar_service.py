import os
import subprocess
import logging
from pathlib import Path

# Set up logger
logger = logging.getLogger("avatar_service")
logging.basicConfig(level=logging.INFO)

# Define directories
BASE_DIR = Path(__file__).resolve().parent.parent.parent  # FYP_main_project
AVTR1_DIR = BASE_DIR / "avtr-1-main"
FRONTEND_PUBLIC_DIR = BASE_DIR / "Sinhala-Teaching-AI-AVATAR" / "frontend" / "public"
TEMP_DIR = BASE_DIR / "Sinhala-Teaching-AI-AVATAR" / "backend" / "temp"

# Ensure directories exist
TEMP_DIR.mkdir(parents=True, exist_ok=True)
(FRONTEND_PUBLIC_DIR / "lessons").mkdir(parents=True, exist_ok=True)


def text_to_speech_sinhala(text: str, output_audio_path: str) -> bool:
    """
    Converts Sinhala lesson text into a WAV audio file.
    
    To run this, you can use Google Cloud Text-to-Speech or Microsoft Azure TTS,
    which have high-quality Sinhala (si-LK) voices. 
    
    You will need to install:
    pip install google-cloud-texttospeech
    """
    logger.info("Synthesizing speech for text...")
    
    # --- Option A: Using Google Cloud Text-to-Speech (Recommended) ---
    try:
        from google.cloud import texttospeech

        client = texttospeech.TextToSpeechClient()
        synthesis_input = texttospeech.SynthesisInput(text=text)

        # Select the Sinhala voice (si-LK)
        voice = texttospeech.VoiceSelectionParams(
            language_code="si-LK", 
            name="si-LK-Standard-A"  # Or use Wavenet if available
        )

        audio_config = texttospeech.AudioConfig(
            audio_encoding=texttospeech.AudioEncoding.LINEAR16,  # 16-bit PCM WAV
            sample_rate_hertz=16000  # AVTR-1 requires 16000Hz mono audio
        )

        response = client.synthesize_speech(
            input=synthesis_input, voice=voice, audio_config=audio_config
        )

        with open(output_audio_path, "wb") as out:
            out.write(response.audio_content)
        
        logger.info(f"Speech audio saved to {output_audio_path}")
        return True

    except ImportError:
        logger.warning("google-cloud-texttospeech is not installed. Using a fallback empty WAV file for testing.")
        # Create a mock 3-second silence wave file if the library is not installed
        try:
            import wave
            import struct
            with wave.open(str(output_audio_path), "wb") as w:
                w.setnchannels(1)
                w.setsampwidth(2)
                w.setframerate(16000)
                # 3 seconds of silence
                for _ in range(16000 * 3):
                    w.writeframesraw(struct.pack('<h', 0))
            return True
        except Exception as e:
            logger.error(f"Failed to create fallback WAV file: {e}")
            return False
    except Exception as e:
        logger.error(f"Failed to synthesize speech: {e}")
        return False


def generate_avatar_video(audio_path: str, video_filename: str, avatar_id: str = "maria") -> str:
    """
    Calls the AVTR-1 offline generation pipeline via Pixi command subprocess.
    Since AVTR-1 has heavy GPU/TensorRT requirements, running it as a separate 
    process in its own pixi environment is the cleanest integration.
    """
    output_video_path = FRONTEND_PUBLIC_DIR / "lessons" / video_filename
    
    logger.info(f"Generating avatar video for audio: {audio_path}")
    logger.info(f"Output video path: {output_video_path}")

    # Build the pixi run command
    cmd = [
        "pixi", "run", "generate_offline",
        "--speech", str(audio_path),
        "--avatar", avatar_id,
        "--bg", "plain_white",
        "--out", str(output_video_path)
    ]

    try:
        # Run process in the avtr-1-main workspace directory
        result = subprocess.run(
            cmd,
            cwd=str(AVTR1_DIR),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            check=True
        )
        logger.info("AVTR-1 generation completed successfully.")
        return f"/lessons/{video_filename}"
    except subprocess.CalledProcessError as e:
        logger.error(f"AVTR-1 generation failed: {e.stderr}")
        raise RuntimeError(f"AVTR-1 failed: {e.stderr}")


def create_lesson_avatar(lesson_topic_id: str, lesson_text: str, avatar_id: str = "maria") -> str | None:
    """
    High-level function:
    1. Converts lesson text to audio.
    2. Uses audio to generate the lip-synced avatar video.
    3. Saves the video in the frontend public folder.
    4. Returns the path URL (relative to Next.js public directory).
    """
    audio_path = TEMP_DIR / f"{lesson_topic_id}.wav"
    video_filename = f"{lesson_topic_id}.mp4"
    
    # 1. Generate Sinhala Speech
    if not text_to_speech_sinhala(lesson_text, audio_path):
        logger.error("Failed to generate speech audio.")
        return None
        
    # 2. Generate Avatar Video
    try:
        video_url = generate_avatar_video(audio_path, video_filename, avatar_id)
        
        # Clean up temporary WAV file
        if audio_path.exists():
            os.remove(audio_path)
            
        return video_url
    except Exception as e:
        logger.error(f"Failed to generate avatar video: {e}")
        return None
