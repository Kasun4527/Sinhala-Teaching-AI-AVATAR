import os
import sys

if sys.stdout.encoding and sys.stdout.encoding.lower() not in ('utf-8', 'utf8'):
    try:
        sys.stdout.reconfigure(encoding='utf-8', errors='replace')
        sys.stderr.reconfigure(encoding='utf-8', errors='replace')
    except Exception:
        pass

from services.vector_store import ingest_documents

DOCS_PATH = "./documents_unicode"

if not os.path.exists(DOCS_PATH):
    os.makedirs(DOCS_PATH)
    print(f"📁 Folder created: {DOCS_PATH}")
    print("⚠️  Please add your documents and run again")
else:
    print(f"🚀 Ingesting documents from: {DOCS_PATH}")
    result = ingest_documents(DOCS_PATH)
    if result is None:
        print("❌ Ingestion FAILED — vector store not created")
    else:
        print("✅ Ingestion complete!")
        print(f"✅ Chroma DB exists: {os.path.exists('./chroma_db')}")