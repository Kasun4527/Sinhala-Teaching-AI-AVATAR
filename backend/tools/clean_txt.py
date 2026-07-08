# tools/clean_txt.py
import re

INPUT  = r"D:\UOR\7th sem\FYP\AI AVATAR\adaptive-learning-ai\backend\documents_unicode\pdf_bud.txt"
OUTPUT = r"D:\UOR\7th sem\FYP\AI AVATAR\adaptive-learning-ai\backend\documents_unicode\pdf_bud_clean.txt"

with open(INPUT, "r", encoding="utf-8") as f:
    content = f.read()

print(f"Original size: {len(content)} chars")

paragraphs = re.split(r'\n{2,}', content)
print(f"Total paragraphs: {len(paragraphs)}")

clean_paragraphs = []
skipped = 0

for para in paragraphs:
    para = para.strip()

    if len(para) < 50:
        skipped += 1
        continue

    sinhala_chars = sum(1 for c in para if '\u0D80' <= c <= '\u0DFF')
    ratio = sinhala_chars / len(para)

    if ratio < 0.3:
        skipped += 1
        continue

    clean_paragraphs.append(para)

print(f"Kept   : {len(clean_paragraphs)} paragraphs")
print(f"Skipped: {skipped} paragraphs")

with open(OUTPUT, "w", encoding="utf-8") as f:
    f.write("\n\n".join(clean_paragraphs))

print(f"\n✅ Clean file saved: {OUTPUT}")

# Verify topic still exists
clean_content = "\n\n".join(clean_paragraphs)
if "ගිලනුන්ට" in clean_content:
    idx = clean_content.index("ගිලනුන්ට")
    print(f"\n✅ 'ගිලනුන්ට' still present:")
    print(clean_content[idx:idx+300])
else:
    print("\n❌ 'ගිලනුන්ට' lost — lower the threshold from 0.3 to 0.2")