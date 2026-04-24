"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { curriculum } from "@/data/curriculum";

export default function TopicsPage() {
  const params = useSearchParams();
  const router = useRouter();

  const subject = params.get("subject");
  const lesson = params.get("lesson");

  const subjectData = curriculum.find((s) => s.subject === subject);
  const lessonData = subjectData?.lessons.find((l) => l.name === lesson);

  if (!lessonData || lessonData.topics.length === 0) {
    return <div className="p-10">No topics available</div>;
  }

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-6">
        {subject} - {lesson}
      </h1>

      <div className="space-y-3">
        {lessonData.topics.map((topic, i) => (
          <button
            key={i}
            onClick={() =>
              router.push(
  `/quiz?subject=${subject}&lesson=${lesson}&topic=${encodeURIComponent(topic)}&type=pre`
)
            }
            className="block w-full text-left p-3 border rounded bg-white hover:bg-blue-100"
          >
            {topic}
          </button>
        ))}
      </div>
    </div>
  );
}