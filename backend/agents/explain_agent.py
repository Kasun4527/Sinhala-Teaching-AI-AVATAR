import json
import re
from services.llm import get_llm
from langchain_core.messages import HumanMessage, SystemMessage


def generate_explanation(content: str) -> str:
    """Call the fine-tuned model to explain lesson content for avatar speech."""
    # Strip [IMAGE: ...] tags — can't be spoken
    clean_content = re.sub(r'\[IMAGE:[^\]]+\]', '', content, flags=re.IGNORECASE).strip()
    clean_content = clean_content[:2000]

    try:
        llm = get_llm()
        messages = [
            SystemMessage(content="You are an expert Sinhala teacher. Explain the following content clearly in Sinhala."),
            HumanMessage(content=f"පහත ඡේදය පැහැදිලි කරන්න:\n\n{clean_content}")
        ]
        response = llm.invoke(messages)
        explanation = response.content.strip()
        print(f"[ExplainAgent] explanation length: {len(explanation)} chars")
        return explanation if explanation else clean_content
    except Exception as e:
        print(f"[ExplainAgent] model call failed: {e} — returning original content")
        return clean_content
