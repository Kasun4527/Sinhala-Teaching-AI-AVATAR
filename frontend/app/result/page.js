"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function ResultPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const subject = searchParams.get("subject");
  const lesson = searchParams.get("lesson");
  const score = Number(searchParams.get("score"));
  const level = searchParams.get("level");
  const topic = searchParams.get("topic");
  console.log("🚀 ResultPage params:", { subject, lesson, score, level, topic });

  const goToLesson = () => {
    router.push(`/lesson?topic=${topic}&level=${level}&subject=${subject}&lesson=${lesson}`);
  };

  const nextTopic = () => {
    router.push(`/topics?subject=${subject}&lesson=${lesson}`);
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    if(!token){
      router.push("/login");
      return;
    }
  },[]);

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold">Result</h1>

      <div className="mt-4">
        <p>Score: {score}/10</p>
        <p>Level: {level}</p>
      </div>

      {/* 🔥 ALWAYS show lesson first */}
      <button
        onClick={goToLesson}
        className="mt-6 bg-blue-500 text-white px-4 py-2 rounded"
      >
        Continue Learning →
      </button>

      {/* 🔥 Unlock next topic only if good score */}
      {score >= 6 && (
        <button
          onClick={nextTopic}
          className="mt-4 bg-green-600 text-white px-4 py-2 rounded"
        >
          Next Topic →
        </button>
      )}
    </div>
  );
}