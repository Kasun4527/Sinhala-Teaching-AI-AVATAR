# Sinhala Textbook Pipeline

Upload a PDF textbook, extract text and images in reading order, detect topic headings, and export per-topic `.txt` files plus numbered PNG images.

## What it does

- Inspects embedded font names and font sizes on sample pages.
- Extracts ordered text and image blocks from PDF pages with PyMuPDF.
- Applies a pluggable legacy-font-to-Unicode conversion table.
- Groups content into topic files using heading heuristics.
- Runs as a small FastAPI app with a browser upload page.

## Install

```bash
pip install -r requirements.txt
```

## Run

```bash
$env:BACKEND_URL = "http://127.0.0.1:8000"
$env:ADMIN_BASE_PATH = "/admin"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8001 --reload                          
```

Open the local URL shown by Uvicorn and upload a PDF.

The service can also be exposed at `/admin` behind a gateway without moving the
UI into Next.js. See `DEPLOYMENT.md` for the route and environment settings.

## Test
```bash
pytest
```
