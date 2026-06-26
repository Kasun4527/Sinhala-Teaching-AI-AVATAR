# tools/check_encoding.py
import chardet

filepath = r"D:\UOR\7th sem\FYP\AI AVATAR\adaptive-learning-ai\backend\documents_unicode\pdf_bud.txt"

with open(filepath, "rb") as f:
    raw = f.read(10000)
    result = chardet.detect(raw)
    print(f"Detected encoding: {result}")