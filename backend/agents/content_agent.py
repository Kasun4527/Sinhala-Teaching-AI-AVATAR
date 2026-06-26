from langchain_core.prompts import PromptTemplate
from services.llm import get_llm
from services.retriever import get_relevant_context


def generate_content(subject, lesson, topic, level):

    # ✅ සෑම level එකටම full content retrieve (no cut)
    context = get_relevant_context(subject, lesson, topic, k=4, max_length=None)

    if not context:
        context = f"{topic} යන මාතෘකාව {subject} විෂය {lesson} පාඩමෙහි ඇතුළත් වේ."

    print(f"[DEBUG] Level={level}, context={len(context)} chars")

    # ✅ Advanced → full PDF content directly, no LLM
    if level == "Advanced":
        print("[DEBUG] Advanced — returning full context directly")
        return context

    # ✅ Beginner / Intermediate → LLM intro (2-3 paragraphs) + full PDF content
    llm = get_llm()

    if level == "Beginner":
        instruction = (
            f"මෙම '{topic}' පාඩම ඉතා සරල ව තේරුම් ගත හැකි වන සේ "
            f"කෙටි හැදින්වීමක් (ඡේදය 2-3ක් පමණ) සිංහලෙන් ලියන්න. "
            f"දෛනික ජීවිත නිදසුන් යොදා ගන්න."
        )
    else:  # Intermediate
        instruction = (
            f"මෙම '{topic}' පාඩමේ ප්‍රධාන කරුණු සංක්ෂිප්ත ව "
            f"(ඡේදය 2-3ක් පමණ) සිංහලෙන් හඳුන්වා දෙන්න."
        )

    prompt = PromptTemplate(
        input_variables=["instruction", "topic", "context"],
        template="""විෂය කරුණු:
{context}

ඉහත {topic} ගැන: {instruction}

Quiz, ප්‍රශ්න හෝ lists නොතබන්න. සිංහල භාෂාවෙන් පමණක්:"""
    )

    chain = prompt | llm
    try:
        response = chain.invoke({
            "instruction": instruction,
            "topic": topic,
            "context": context[:2500],  # intro generation ට සෑහේ
        })
        intro = response.content.strip()
        print(f"[DEBUG] LLM intro generated: {len(intro)} chars")
        # ✅ LLM intro + full PDF content (missing nothing)
        return f"{intro}\n\n---\n\n{context}"
    except Exception as e:
        print(f"[WARNING] LLM intro failed: {e} — returning full context")
        return context
