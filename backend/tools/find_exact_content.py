# tools/find_exact_content.py
import re
import os

DOCS_PATH = "./documents_unicode"

# Search for exact phrases from the PDF content
search_phrases = [
    "අසරණ සරණ",
    "සෝපාකට",
    "සුනීත",
    "භද්‍රවතිකා",
    "නිබද්ධ චාරිකා",
    "රජ්ජුමාලා"
]

for filename in os.listdir(DOCS_PATH):
    if not filename.endswith(".txt"):
        continue
    with open(os.path.join(DOCS_PATH, filename), "r", encoding="utf-8") as f:
        content = f.read()

    paragraphs = re.split(r'\n{2,}', content)
    print(f"Total paragraphs: {len(paragraphs)}\n")

    for phrase in search_phrases:
        found = False
        for i, para in enumerate(paragraphs):
            if phrase in para:
                print(f"✅ Found '{phrase}' in Paragraph {i}:")
                print(para[:300])
                print("---")
                found = True
                break
        if not found:
            print(f"❌ '{phrase}' NOT found in file")