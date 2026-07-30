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
pip install -e .[test]
```

## Run

```bash
uvicorn app.main:app --reload
```

Open the local URL shown by Uvicorn and upload a PDF.

## Test
```bash
pytest
```
