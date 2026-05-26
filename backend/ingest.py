"""
Documents ingest කරන්නෙ:
python ingest.py
"""
import os
from services.vector_store import ingest_documents

# =====================================================
# Documents folder structure:
# backend/documents/
#   buddhism_grade10/
#     lesson1_siduhath.pdf
#     lesson2_sangha.txt
#   science_grade10/
#     ...
# =====================================================

DOCS_PATH = "./documents"

if not os.path.exists(DOCS_PATH):
    os.makedirs(DOCS_PATH)
    print(f"📁 Folder created: {DOCS_PATH}")
    print("⚠️  Please add your documents and run again")
else:
    print(f"🚀 Ingesting documents from: {DOCS_PATH}")
    ingest_documents(DOCS_PATH)
    print("✅ Ingestion complete!")