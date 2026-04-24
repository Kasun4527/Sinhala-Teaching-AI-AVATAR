"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { getLesson } from "@/services/api";

export default function LessonPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const subject = searchParams.get("subject");
  const lesson = searchParams.get("lesson");
  const topic = searchParams.get("topic");
  const level = searchParams.get("level") || "beginner"; // ✅ FIX

  const [content, setContent] = useState("");

  useEffect(() => {
    if (!topic) return;

    getLesson(subject, lesson, topic, level).then((res) => {
  setContent(res.data.content);
});
  }, [topic, level]);

  const goToQuiz = () => {
    console.log("🚀 Navigating to quiz with params:", { subject, lesson, topic, level });
    router.push(`/quiz?topic=${topic}&level=${level}&type=post&subject=${subject}&lesson=${lesson}`);
  };

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">{topic}</h1>

      <div className="mt-6 whitespace-pre-line">
        {content}
      </div>

      <button
        onClick={goToQuiz}
        className="mt-6 bg-green-500 text-white px-4 py-2 rounded"
      >
        Finish Lesson →
      </button>
    </div>
  );
}