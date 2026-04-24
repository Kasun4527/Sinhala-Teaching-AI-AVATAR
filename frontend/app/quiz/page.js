"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  getPreQuiz,
  getPostQuiz,
  submitPreQuiz,
  submitPostQuiz,
} from "@/services/api";

export default function QuizPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const subject = searchParams.get("subject");
  const lesson = searchParams.get("lesson");
  const topic = searchParams.get("topic");
  const level = searchParams.get("level") || "beginner";
  const type = searchParams.get("type") || "pre";
  console.log("🚀 QuizPage params:", { subject, lesson, topic, level, type });

  const [quiz, setQuiz] = useState({ questions: [] });
  const [answers, setAnswers] = useState([]);
  const [loading, setLoading] = useState(true);

  // =========================
  // LOAD QUIZ
  // =========================
  useEffect(() => {
    if (!subject || !lesson || !topic) {
      // console.log("❌ Missing params:", { subject, lesson, topic });
      setLoading(false);
      return;
    }

    const fetchQuiz = async () => {
      try {
        setLoading(true);

        let res;

        // ✅ SAFE API CALL
        if (type === "post") {
          res = await getPostQuiz(subject, lesson, topic, level);
        } else {
          res = await getPreQuiz(subject, lesson, topic);
        }

        console.log("📩 QUIZ API RESPONSE:", res?.data);

        // ✅ SAFE EXTRACTION
        const data = res?.data || {};

        setQuiz(data.quiz || data || { questions: [] });
        setAnswers([]);
      } catch (err) {
        console.error("❌ Quiz load error:", err);
        setQuiz({ questions: [] });
      } finally {
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [subject, lesson, topic, level, type]);

  // =========================
  // SUBMIT QUIZ
  // =========================
  const handleSubmit = async () => {
    try {
      const correctAnswers = quiz.questions.map((q) => q.answer);

      const payload = {
        subject,
        lesson,
        topic,
        student_answers: answers,
        correct_answers: correctAnswers,
      };

      let res;

      if (type === "post") {
        res = await submitPostQuiz(payload);
      } else {
        res = await submitPreQuiz(payload);
      }

      console.log("📩 SUBMIT RESPONSE:", res?.data);

      router.push(
        `/result?score=${res?.data?.score || 0}&level=${res?.data?.level || "beginner"}&topic=${topic}&type=${type}&subject=${subject}&lesson=${lesson}`
      );
    } catch (err) {
      console.error("❌ Submit error:", err);
    }
  };

  // =========================
  // LOADING
  // =========================
  if (loading) {
    return <div className="p-10">Loading quiz...</div>;
  }

  // =========================
  // EMPTY STATE
  // =========================
  if (!quiz?.questions?.length) {
    return <div className="p-10">No quiz available</div>;
  }

  // =========================
  // UI
  // =========================
  return (
    <div className="p-10">
      <h1 className="text-2xl font-bold mb-4">
        {type === "post" ? "Post Lesson Quiz" : "Pre Lesson Quiz"}
      </h1>

      {quiz.questions.map((q, i) => (
        <div key={i} className="mt-4 p-4 border rounded">
          <p className="font-semibold">{q.question}</p>

          {q.options.map((opt, idx) => {
            const label = String.fromCharCode(65 + idx);

            return (
              <label key={idx} className="block mt-1 cursor-pointer">
                <input
                  type="radio"
                  name={`q-${i}`}
                  value={label}
                  onChange={() => {
                    const newAns = [...answers];
                    newAns[i] = label;
                    setAnswers(newAns);
                  }}
                />

                <span className="ml-2">
                  {label}. {opt}
                </span>
              </label>
            );
          })}
        </div>
      ))}

      <button
        onClick={handleSubmit}
        className="mt-6 bg-blue-500 text-white px-4 py-2 rounded"
      >
        Submit Quiz
      </button>
    </div>
  );
}