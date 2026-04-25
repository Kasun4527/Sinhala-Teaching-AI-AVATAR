"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { curriculum } from "@/data/curriculum";
import { useEffect } from "react";

export default function LessonsPage() {
  const params = useSearchParams();
  const router = useRouter();

  const subject = params.get("subject");

  const subjectData = curriculum.find((s) => s.subject === subject);

  useEffect(()=>{
    const token=localStorage.getItem("token");
    if(!token){
      router.push("/login");
      return;
    }
  }, []);

  if (!subjectData) return <div className="p-10">No lessons found</div>;

  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-6">{subject} - Lessons</h1>

      <div className="grid grid-cols-2 gap-4">
        {subjectData.lessons.map((lesson, i) => (
          <button
            key={i}
            onClick={() =>
 router.push(
  `/topics?subject=${subject}&lesson=${lesson.name}`
)
}
            className="p-4 border rounded bg-white hover:bg-green-100"
          >
            {lesson.name}
          </button>
        ))}
      </div>
    </div>
  );
}