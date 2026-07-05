import json
import requests
from services.retriever import get_relevant_context

import os
FINETUNED_MODEL_URL = os.getenv("SINHALA_LLM_URL", "https://cupbearer-pointing-serotonin.ngrok-free.dev/ask")


def generate_content(subject, lesson, topic, level):

    context = get_relevant_context(subject, lesson, topic, k=4, max_length=None)

    if not context:
        context = f"{topic} යන මාතෘකාව {subject} විෂය {lesson} පාඩමෙහි ඇතුළත් වේ."

    print(f"[DEBUG] Level={level}, context={len(context)} chars")

    if level == "Advanced":
        print("[DEBUG] Advanced — returning full context directly")
        return context

    if level == "Beginner":
        instruction = (
            f"මෙම '{topic}' පාඩම ඉතා සරල ව තේරුම් ගත හැකි වන සේ "
            f"කෙටි හැදින්වීමක් (ඡේදය 2-3ක් පමණ) සිංහලෙන් ලියන්න. "
            f"දෛනික ජීවිත නිදසුන් යොදා ගන්න."
        )
    else:
        instruction = (
            f"මෙම '{topic}' පාඩමේ ප්‍රධාන කරුණු සංක්ෂිප්ත ව "
            f"(ඡේදය 2-3ක් පමණ) සිංහලෙන් හඳුන්වා දෙන්න."
        )

    payload = {
        "instruction": instruction,
        "input": context[:2500],
        "max_new_tokens": 500,
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
        intro = (data.get("answer") or data.get("response") or "").strip()
        print(f"[DEBUG] Fine-tuned model intro generated: {len(intro)} chars")
        return f"{intro}\n\n---\n\n{context}" if intro else context
    except Exception as e:
        print(f"[WARNING] Fine-tuned model intro failed: {e} — returning full context")
        return context
