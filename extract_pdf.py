import fitz
import sys

pdf_path = r'c:\Users\some1\Downloads\FYP_main_project\Sinhala-Teaching-AI-AVATAR\Research paper\AI-Based Sinhala Assistant_V13.pdf'
out_path = r'c:\Users\some1\Downloads\FYP_main_project\Sinhala-Teaching-AI-AVATAR\Research paper\V13_extracted.txt'

try:
    doc = fitz.open(pdf_path)
    text = ""
    for i, page in enumerate(doc):
        text += f"\n--- PAGE {i+1} ---\n"
        text += page.get_text()
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(text)
    print(f"Extracted {len(doc)} pages to {out_path}")
except Exception as e:
    print(f"Error: {e}")
