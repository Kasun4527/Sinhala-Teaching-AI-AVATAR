import json
import os
import re
import requests

FINETUNED_MODEL_URL = os.getenv("SINHALA_LLM_URL", "https://cupbearer-pointing-serotonin.ngrok-free.dev/ask")


def _clean(content: str) -> str:
    """Strip [IMAGE: ...] tags (can't be spoken) and cap length to what the LLM server accepts."""
    return re.sub(r'\[IMAGE:[^\]]+\]', '', content, flags=re.IGNORECASE).strip()[:2000]


def _post_with_retry(payload: dict, timeout: int, retries: int = 1):
    """POST to the fine-tuned model, retrying once on failure. The external
    model server (an ngrok tunnel) is occasionally flaky/slow rather than
    consistently down, so one retry avoids treating a transient hiccup as a
    hard failure — which previously caused the avatar to silently speak raw,
    unexplained content instead of retrying."""
    last_exc = None
    for attempt in range(retries + 1):
        try:
            response = requests.post(
                FINETUNED_MODEL_URL,
                headers={"Content-Type": "application/json"},
                data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
                timeout=timeout,
            )
            response.raise_for_status()
            return response.json()
        except Exception as e:
            last_exc = e
            print(f"[ExplainAgent] attempt {attempt + 1}/{retries + 1} failed: {e}")
    raise last_exc


def generate_paragraph_explanations(paragraphs: list) -> tuple[list, bool]:
    """Generate one explanation per pair of content paragraphs, sent as a
    single batched request to the fine-tuned model instead of one request
    per pair — the model server processes the whole batch in one
    generate() call, which is faster than N sequential round-trips.

    Returns (explanations, explained) — explained=False means the model
    call failed even after a retry and the original, unexplained content is
    being returned instead, so callers can tell the difference rather than
    silently treating raw content as if it were explained."""
    pairs = ["\n\n".join(paragraphs[i:i + 2]) for i in range(0, len(paragraphs), 2)]
    cleaned = [_clean(p) for p in pairs]
    if not cleaned:
        return [], True

    payload = {
        "items": [
            {"instruction": "පහත ඡේදය පැහැදිලි කරන්න.", "input": content}
            for content in cleaned
        ],
        "max_new_tokens": 5000,
    }

    try:
        data = _post_with_retry(payload, timeout=180)
        answers = data.get("answers", [])
        print(f"[ExplainAgent] batch of {len(cleaned)} explanation(s) returned")
        return [
            answers[i].strip() if i < len(answers) and answers[i].strip() else cleaned[i]
            for i in range(len(cleaned))
        ], True
    except Exception as e:
        print(f"[ExplainAgent] batch model call failed after retry: {e} — returning original content for all pairs")
        return cleaned, False


def generate_explanation(content: str) -> tuple[str, bool]:
    """Call the fine-tuned model to explain a single piece of lesson content
    for avatar speech. Returns (explanation, explained) — see
    generate_paragraph_explanations() for what explained=False means."""
    clean_content = _clean(content)

    payload = {
        "instruction": "පහත ඡේදය පැහැදිලි කරන්න.",
        "input": clean_content,
        "max_new_tokens": 5000,
    }

    try:
        data = _post_with_retry(payload, timeout=120)
        explanation = data.get("answer", "") or data.get("response", "")
        print(f"[ExplainAgent] explanation length: {len(explanation)} chars")
        if explanation.strip():
            return explanation.strip(), True
        return clean_content, False
    except Exception as e:
        print(f"[ExplainAgent] model call failed after retry: {e} — returning original content")
        return clean_content, False
