import json
import os
import re
import requests

FINETUNED_MODEL_URL = os.getenv("SINHALA_LLM_URL", "https://cupbearer-pointing-serotonin.ngrok-free.dev/ask")


def generate_paragraph_explanations(paragraphs: list) -> list:
    """Generate one explanation per pair of content paragraphs."""
    results = []
    capped = paragraphs[:8]
    for i in range(0, len(capped), 2):
        pair = capped[i:i + 2]
        combined = "\n\n".join(pair)
        results.append(generate_explanation(combined))
    return results


def generate_explanation(content: str) -> str:
    """Call the fine-tuned model to explain lesson content for avatar speech."""
    # Strip [IMAGE: ...] tags — can't be spoken
    clean_content = re.sub(r'\[IMAGE:[^\]]+\]', '', content, flags=re.IGNORECASE).strip()
    clean_content = clean_content[:2000]

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
