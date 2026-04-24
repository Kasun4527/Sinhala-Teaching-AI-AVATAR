"use client";

import { useRouter } from "next/navigation";
import { curriculum } from "@/data/curriculum";

export default function Home() {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center mt-20">
      <h1 className="text-3xl font-bold mb-6">
        Select Subject
      </h1>

      <div className="grid grid-cols-2 gap-6">
        {curriculum.map((item, i) => (
          <button
            key={i}
            onClick={() => router.push(`/sub-lesson?subject=${item.subject}`)}
            className="p-6 bg-white border rounded shadow hover:bg-blue-100"
          >
            {item.subject}
          </button>
        ))}
      </div>
    </div>
  );
}