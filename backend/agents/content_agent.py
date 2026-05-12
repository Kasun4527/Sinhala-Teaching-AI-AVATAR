from langchain_core.prompts import PromptTemplate
from services.llm import get_llm

def generate_content(subject, lesson, topic, level):

    llm = get_llm()
    #retriever = get_retriever()

    #docs = retriever.invoke(topic)
    #context = "\n".join([doc.page_content for doc in docs])

    context = """සිදුහත් බෝසත් චරිතය සහ අභියෝග ජයගැනීම

සිදුහත් බෝසත් චරිතය යනු අභියෝග රැසක් සාර්ථකව ජයගත් උදාර ජීවිතයකි. එම අභියෝග ජයගැනීමට එතුමා භාවිතා කළ මඟ අපගේ ජීවිතවලට ද මහඟු ආදර්ශයකි.

පංච මහා විලෝකනය: උපතට පෙර සුදුසු පසුබිම නුවණින් විමසා බැලීම තුළින් වැදගත් තීරණ ගැනීමේදී විමසිලිමත් වීමේ අගය පෙන්වා දෙයි.

ශිෂ්‍ය ජීවිතය: රාජකීය සැප මැද වුවද කීකරුකම, ගුරු ගෞරවය සහ කැපවීම තුළින් ඉතා කෙටි කලකින් සියලු ශිල්ප ශාස්ත්‍ර හැදෑරීම ශිෂ්‍ය අපට ආදර්ශයකි.

යොවුන් වියේ තීරණ: නිපුණතා දැක්වීමෙන් ඥාතීන්ගේ සැක දුරු කිරීම සහ බුද්ධිමත් ලෙස යුග දිවියට පිවිසීම තුළින් තරුණ වියේ අභියෝග ජයගත් අයුරු පැහැදිලි වේ.

යථාර්ථය අවබෝධ කර ගැනීම: සතර පෙරනිමිති දැකීමෙන් ජීවිතයේ අනිත්‍ය බව වටහා ගත් කුමාරයා, මාලිගාවේ අධික සැප සම්පත් අතෘප්තිකර බව තේරුම් ගත්තේය.

මහා අභිනිෂ්ක්‍රමණය: පිය රජුගේ සක්විති රජකමේ බලාපොරොත්තුව සහ දරු සෙනෙහස වැනි බැඳීම් අභියෝග ලෙස මතු වුවද, ලෝ සතුන් සසර දුකින් මුදවා ගැනීමේ උදාර අරමුණ වෙනුවෙන් ඒ සියල්ල අතහැර සත්‍යය සොයා ගියේය.

අධිෂ්ඨානය, ඉවසීම සහ විමසුම් නුවණ භාවිත කරමින් බෝසතුන් ලැබූ ඒ උදාර ජයග්‍රහණ, සාර්ථක ජීවිතයක් ගොඩනඟා ගැනීමට අප සැමට පූර්වාදර්ශ සපයයි."""
    # 🎯 Adaptive instruction engine
    adaptive_instruction = ""

    if level == "Beginner":
        adaptive_instruction = """
        Explain in VERY SIMPLE language.
        Use real-life examples.
        Break into small steps.
        Assume student knows nothing.
        """

    elif level == "Intermediate":
        adaptive_instruction = """
        Explain clearly with moderate detail.
        Include examples and key points.
        Avoid too much complexity.
        """

    else:  # Advanced
        adaptive_instruction = """
        Give concise explanation.
        Focus on deep understanding.
        Include technical details and concepts.
        """

    prompt = PromptTemplate(
    input_variables=["subject", "lesson", "topic", "level", "context"],
    template="""
You are an expert {subject} teacher.

Lesson: {lesson}
Topic: {topic}
Student Level: {level}

Context:
{context}

INSTRUCTIONS:

If level = Beginner:
- Explain step by step
- Use simple language
- Add examples

If level = Intermediate:
- Give structured explanation
- Include some theory + examples

If level = Advanced:
- Focus on concepts, formulas, and deeper understanding

Make the lesson clear and engaging.

DO NOT generate quiz.

Return only lesson content.
"""
)

    chain = prompt | llm

    response = chain.invoke({
        "subject": subject,
        "lesson": lesson,
        "topic": topic,
        "level": level,
        "context": context,
        "instruction": adaptive_instruction
    })

    return response.content