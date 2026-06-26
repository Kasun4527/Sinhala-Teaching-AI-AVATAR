from pdf2image import convert_from_path
import pytesseract
import os

# ✅ Windows path fix
pytesseract.pytesseract.tesseract_cmd = r"C:\Program Files\Tesseract-OCR\tesseract.exe"

INPUT_FOLDER  = r"D:\UOR\7th sem\FYP\AI AVATAR\adaptive-learning-ai\backend\documents"
OUTPUT_FOLDER = r"D:\UOR\7th sem\FYP\AI AVATAR\adaptive-learning-ai\backend\documents_unicode"

os.makedirs(OUTPUT_FOLDER, exist_ok=True)

for root, dirs, files in os.walk(INPUT_FOLDER):
    for filename in files:
        if not filename.endswith(".pdf"):
            continue

        pdf_path = os.path.join(root, filename)
        print(f"\n📄 Converting: {pdf_path}")

        try:
            pages = convert_from_path(pdf_path, dpi=300)
            full_text = ""

            for i, page in enumerate(pages):
                text = pytesseract.image_to_string(page, lang="sin")
                print(f"   Page {i+1}: {len(text)} chars")
                full_text += text + "\n\n"

            relative_path = os.path.relpath(root, INPUT_FOLDER)
            out_dir = os.path.join(OUTPUT_FOLDER, relative_path)
            os.makedirs(out_dir, exist_ok=True)

            out_path = os.path.join(out_dir, filename.replace(".pdf", ".txt"))
            with open(out_path, "w", encoding="utf-8") as f:
                f.write(full_text)

            print(f"   ✅ Saved: {out_path}")

        except Exception as e:
            print(f"   ❌ Failed: {e}")

print("\n✅ All PDFs converted!")