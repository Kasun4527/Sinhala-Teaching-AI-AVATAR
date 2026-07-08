# tools/verify_txt.py
filepath = r"D:\UOR\7th sem\FYP\AI AVATAR\adaptive-learning-ai\backend\documents_unicode\pdf_bud.txt"

with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

print(f"Total chars: {len(content)}")
print(f"\nFirst 500 chars:")
print(content[:500])

# Check how much is real Unicode Sinhala
sinhala_chars = sum(1 for c in content if '\u0D80' <= c <= '\u0DFF')
ratio = sinhala_chars / len(content)
print(f"\nSinhala unicode ratio: {ratio:.2f}")

# Search for the specific topic
if "ගිලනුන්ට" in content:
    idx = content.index("ගිලනුන්ට")
    print(f"\n✅ Found 'ගිලනුන්ට' at position {idx}")
    print(content[idx:idx+300])
else:
    print("\n❌ 'ගිලනුන්ට' NOT found in file")