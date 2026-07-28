import json
import os
import re
import requests

FINETUNED_MODEL_URL = os.getenv("SINHALA_LLM_URL", "https://cupbearer-pointing-serotonin.ngrok-free.dev/ask")


def _clean(content: str) -> str:
    """Strip [IMAGE: ...] tags (can't be spoken) and cap length to what the LLM server accepts."""
    return re.sub(r'\[IMAGE:[^\]]+\]', '', content, flags=re.IGNORECASE).strip()[:2000]


def generate_paragraph_explanations(paragraphs: list) -> list:
    """Generate one explanation per pair of content paragraphs, sent as a
    single batched request to the fine-tuned model instead of one request
    per pair — the model server processes the whole batch in one
    generate() call, which is faster than N sequential round-trips."""
    pairs = ["\n\n".join(paragraphs[i:i + 2]) for i in range(0, len(paragraphs), 2)]
    cleaned = [_clean(p) for p in pairs]
    if not cleaned:
        return []

    payload = {
        "items": [
            {"instruction": "පහත ඡේදය පැහැදිලි කරන්න.", "input": content}
            for content in cleaned
        ],
        "max_new_tokens": 5000,
    }

    try:
        response = requests.post(
            FINETUNED_MODEL_URL,
            headers={"Content-Type": "application/json"},
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            timeout=180,
        )
        response.raise_for_status()
        data = response.json()
        answers = data.get("answers", [])
        print(f"[ExplainAgent] batch of {len(cleaned)} explanation(s) returned")
        return [
            answers[i].strip() if i < len(answers) and answers[i].strip() else cleaned[i]
            for i in range(len(cleaned))
        ]
    except Exception as e:
        print(f"[ExplainAgent] batch model call failed: {e} — returning original content for all pairs")
        return cleaned


def generate_explanation(content: str) -> str:
    """Call the fine-tuned model to explain a single piece of lesson content for avatar speech."""
    clean_content = _clean(content)

    payload = {
        "instruction": "පහත ඡේදය පැහැදිලි කරන්න.",
        "input": clean_content,
        "max_new_tokens": 5000,
    }

    try:
        response = requests.post(
            FINETUNED_MODEL_URL,
            headers={"Content-Type": "application/json"},
            data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
            timeout=120,
        )
        response.raise_for_status()
        data = response.json()
        explanation = data.get("answer", "") or data.get("response", "")
        print(f"[ExplainAgent] explanation length: {len(explanation)} chars")
        return explanation.strip() if explanation.strip() else clean_content
    except Exception as e:
        print(f"[ExplainAgent] model call failed: {e} — returning original content")
        return clean_content
