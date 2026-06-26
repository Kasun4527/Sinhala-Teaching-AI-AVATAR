from services.retriever import get_relevant_context

subject = "බුද්ධ ධර්මය"
lesson  = "බුදු ගුණ අනන්ය"
topic   = "අසරණ සරණ ගුණය"

context = get_relevant_context(subject, lesson, topic, k=10, use_vector_ranking=True)

print("=" * 60)
print(f"Query: {subject} | {lesson} | {topic}")
print("=" * 60)

if not context:
    print("❌ No context retrieved — vector DB returned nothing.")
else:
    print(context)
    print("=" * 60)
    print(f"✅ Total context length: {len(context)} chars")