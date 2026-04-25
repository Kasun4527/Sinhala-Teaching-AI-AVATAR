"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";

const API = "http://localhost:8000";

export default function AdminDashboard() {
  const router = useRouter();

  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState(null);
  const [lessonProgress, setLessonProgress] = useState(null);
  const [topicDetails, setTopicDetails] = useState([]);
  const [expandedTopic, setExpandedTopic] = useState(null);
  const [loading, setLoading] = useState(false);

  // =========================
  // AUTH CHECK
  // =========================
  useEffect(() => {
    const role = localStorage.getItem("role");
    if (role !== "admin") {
      router.push("/login");
    }
  }, []);

  // =========================
  // LOAD ALL STUDENTS
  // =========================
  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API}/admin/students`);
        setStudents(res.data.students);
      } catch (err) {
        console.error("Failed to load students", err);
      } finally {
        setLoading(false);
      }
    };
    fetchStudents();
  }, []);

  // =========================
  // SELECT STUDENT → LOAD SUBJECTS
  // =========================
  const handleSelectStudent = async (student) => {
    setSelectedStudent(student);
    setSelectedSubject(null);
    setLessonProgress(null);
    setTopicDetails([]);

    try {
      const res = await axios.get(`${API}/admin/student-subjects`, {
        params: { student_id: student.student_id }
      });
      setSubjects(res.data.subjects);
    } catch (err) {
      console.error("Failed to load subjects", err);
    }
  };


  const handleLogout = () => {
  localStorage.clear();
  router.push("/login");
};

  // =========================
  // SELECT SUBJECT → LOAD PROGRESS + TOPICS
  // =========================
  const handleSelectSubject = async (subject) => {
    setSelectedSubject(subject);
    setTopicDetails([]);
    setLessonProgress(null);

    try {
      const [progressRes, topicsRes] = await Promise.all([
        axios.get(`${API}/admin/lesson-progress`, {
          params: { student_id: selectedStudent.student_id, subject }
        }),
        axios.get(`${API}/admin/topic-details`, {
          params: { student_id: selectedStudent.student_id, subject }
        })
      ]);

      setLessonProgress(progressRes.data);
      setTopicDetails(topicsRes.data.topics);
    } catch (err) {
      console.error("Failed to load subject details", err);
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="flex items-center justify-between mb-8">
  <h1 className="text-3xl font-bold text-gray-800">
    🎓 Admin Dashboard
  </h1>
  <button
    onClick={handleLogout}
    className="bg-red-500 text-white px-4 py-2 rounded-lg hover:bg-red-600 transition"
  >
    Logout
  </button>
</div>

      <div className="grid grid-cols-12 gap-6">

        {/* ---- STUDENTS LIST ---- */}
        <div className="col-span-3 bg-white rounded-xl shadow p-4">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">
            All Students
          </h2>

          {loading && <p className="text-gray-400">Loading...</p>}

          {students.map((s) => (
            <div
              key={s.student_id}
              onClick={() => handleSelectStudent(s)}
              className={`p-3 rounded-lg cursor-pointer mb-2 transition
                ${selectedStudent?.student_id === s.student_id
                  ? "bg-blue-100 border border-blue-400"
                  : "hover:bg-gray-100 border border-transparent"
                }`}
            >
              <p className="font-medium text-gray-800">{s.name}</p>
              <p className="text-xs text-gray-400">{s.email}</p>
            </div>
          ))}
        </div>

        {/* ---- MAIN CONTENT ---- */}
        <div className="col-span-9 space-y-6">

          {/* SUBJECTS */}
          {selectedStudent && (
            <div className="bg-white rounded-xl shadow p-4">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">
                Subjects — {selectedStudent.name}
              </h2>

              {subjects.length === 0 && (
                <p className="text-gray-400">No subjects found</p>
              )}

              <div className="flex flex-wrap gap-3">
                {subjects.map((sub) => (
                  <button
                    key={sub}
                    onClick={() => handleSelectSubject(sub)}
                    className={`px-4 py-2 rounded-full border font-medium transition
                      ${selectedSubject === sub
                        ? "bg-blue-500 text-white border-blue-500"
                        : "bg-white text-gray-700 border-gray-300 hover:border-blue-400"
                      }`}
                  >
                    {sub}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* LESSON PROGRESS */}
          {lessonProgress && (
            <div className="bg-white rounded-xl shadow p-4">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">
                Lesson Progress — {selectedSubject}
              </h2>

              <div className="flex items-center gap-6">
                <div className="text-center">
                  <p className="text-3xl font-bold text-blue-500">
                    {lessonProgress.percentage}%
                  </p>
                  <p className="text-sm text-gray-400">Completed</p>
                </div>

                <div className="text-center">
                  <p className="text-3xl font-bold text-green-500">
                    {lessonProgress.completed_lessons}
                  </p>
                  <p className="text-sm text-gray-400">Lessons Done</p>
                </div>

                <div className="text-center">
                  <p className="text-3xl font-bold text-gray-400">
                    {lessonProgress.total_lessons}
                  </p>
                  <p className="text-sm text-gray-400">Total Lessons</p>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="mt-4 w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-500 h-3 rounded-full transition-all"
                  style={{ width: `${lessonProgress.percentage}%` }}
                />
              </div>
            </div>
          )}

          {/* TOPIC DETAILS */}
          {topicDetails.length > 0 && (
            <div className="bg-white rounded-xl shadow p-4">
              <h2 className="text-lg font-semibold text-gray-700 mb-4">
                Topic Details
              </h2>

              {topicDetails.map((t, i) => (
                <div
                  key={i}
                  className="border rounded-lg mb-3 overflow-hidden"
                >
                  {/* Topic Header */}
                  <div
                    className="flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50"
                    onClick={() =>
                      setExpandedTopic(expandedTopic === i ? null : i)
                    }
                  >
                    <div>
                      <p className="font-medium text-gray-800">{t.topic}</p>
                      <p className="text-xs text-gray-400">{t.lesson}</p>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* Level Badge */}
                      <span className={`text-xs px-2 py-1 rounded-full font-medium
                        ${t.level === "Advanced" ? "bg-purple-100 text-purple-700" :
                          t.level === "Intermediate" ? "bg-yellow-100 text-yellow-700" :
                          "bg-green-100 text-green-700"}`}>
                        {t.level}
                      </span>

                      {/* Unlock Badge */}
                      <span className={`text-xs px-2 py-1 rounded-full font-medium
                        ${t.topic_unlocked
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-600"}`}>
                        {t.topic_unlocked ? "✅ Unlocked" : "🔒 Locked"}
                      </span>

                      <span className="text-gray-400">
                        {expandedTopic === i ? "▲" : "▼"}
                      </span>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {expandedTopic === i && (
                    <div className="p-4 border-t bg-gray-50 space-y-3">

                      {/* Quiz Marks */}
                      <div className="flex gap-6">
                        <div>
                          <p className="text-xs text-gray-400">Initial Quiz</p>
                          <p className="text-xl font-bold text-orange-500">
                            {t.initial_quiz_marks ?? "—"}/10
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-400">Final Quiz</p>
                          <p className="text-xl font-bold text-blue-500">
                            {t.final_quiz_marks ?? "—"}/10
                          </p>
                        </div>
                      </div>

                      {/* Delivered Content */}
                      {t.delivered_content && (
                        <div>
                          <p className="text-xs text-gray-400 mb-1">
                            Delivered Lesson Content
                          </p>
                          <div className="bg-white border rounded p-3 text-sm text-gray-700 max-h-48 overflow-y-auto whitespace-pre-wrap">
                            {t.delivered_content}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}