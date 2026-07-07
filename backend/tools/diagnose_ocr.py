# tools/diagnose_retrieval.py
import re
import os

DOCS_PATH = "./documents_unicode"
topic   = "අසරණ සරණ ගුණය"
lesson  = "බුදු ගුණ අනන්ය"

topic_words  = [w for w in topic.split() if len(w) > 2]
lesson_words = [w for w in lesson.split() if len(w) > 2]
all_keywords = topic_words + lesson_words

print(f"Keywords: {all_keywords}")
print("=" * 60)

for filename in os.listdir(DOCS_PATH):
    if not filename.endswith(".txt"):
        continue
    with open(os.path.join(DOCS_PATH, filename), "r", encoding="utf-8") as f:
        content = f.read()

    paragraphs = re.split(r'\n{2,}', content)
    print(f"Total paragraphs in file: {len(paragraphs)}")

    for i, para in enumerate(paragraphs):
        para = para.strip()
        if len(para) < 80:
            continue
        sinhala_chars = sum(1 for c in para if '\u0D80' <= c <= '\u0DFF')
        ratio = sinhala_chars / len(para)
        if ratio < 0.3:
            continue

        score = sum(1 for kw in all_keywords if kw in para)
        if score > 0:
            print(f"\nParagraph {i} (score={score}):")
            print(para[:200])
            print("---")