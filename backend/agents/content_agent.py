import json
import requests
from services.retriever import get_relevant_context
from services.llm import get_llm
from langchain_core.messages import HumanMessage, SystemMessage


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

    try:
        llm = get_llm()
        messages = [
            SystemMessage(content="You are an expert Sinhala teacher."),
            HumanMessage(content=f"{instruction}\n\nContext:\n{context[:2500]}")
        ]
        response = llm.invoke(messages)
        intro = response.content.strip()
        print(f"[DEBUG] Fine-tuned model intro generated: {len(intro)} chars")
        return f"{intro}\n\n---\n\n{context}" if intro else context
    except Exception as e:
        print(f"[WARNING] Fine-tuned model intro failed: {e} — returning full context")
        return context
