import axios from "axios";

const API = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export const getErrorMessage = (err, fallback = "Something went wrong") => {
  if (!err) return fallback;
  if (typeof err === "string") return err;

  const detail = err?.response?.data?.detail ?? err?.message ?? err?.response?.data ?? err;
  if (!detail) return fallback;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (item?.msg) return item.msg;
        if (item?.message) return item.message;
        return JSON.stringify(item);
      })
      .join("; ");
  }
  if (typeof detail === "object") {
    if (detail?.msg) return detail.msg;
    if (detail?.message) return detail.message;
    return JSON.stringify(detail);
  }
  return String(detail);
};

export const getPreQuiz = (subject, lesson, topic) =>
  axios.get(`${API}/pre-quiz/`, {
    params: { subject, lesson, topic },
  });

export const submitPreQuiz = (data) =>
  axios.post(`${API}/submit-pre-quiz/`, data);

export const skipPreQuiz = (data) =>
  axios.post(`${API}/skip-pre-quiz/`, data);

export const getLesson = (subject, lesson, topic, level) => {
  console.log("🚀 SENDING:", { subject, lesson, topic, level });

  return axios.get(`${API}/get-lesson/`, {
    params: { subject, lesson, topic, level },
  });
};

export const getPostQuiz = (subject, lesson, topic, level) =>
  axios.get(`${API}/post-quiz/`, {
    params: { subject, lesson, topic, level },
  });

export const submitPostQuiz = (data) =>
  axios.post(`${API}/submit-post-quiz/`, data);

export const signupUser = (data) =>
  axios.post(`${API}/auth/signup`, data);

export const loginUser = (data) =>
  axios.post(`${API}/auth/login`, data);

export const enrollSubject = (data) =>
  axios.post(`${API}/enroll/`, data);

export const getEnrollments = (studentId) =>
  axios.get(`${API}/enrollments`, {
    params: { student_id: studentId },
  });

// Bug #10: Per-answer online learning submission
export const submitSingleAnswer = (data) =>
  axios.post(`${API}/submit-answer/`, data);

// Past-lessons review + on-demand practice quiz (never touches BKT/mastery)
export const getPastLessons = (studentId, subject) =>
  axios.get(`${API}/past-lessons/`, {
    params: { student_id: studentId, subject },
  });

export const getPastLessonContent = (studentId, subject, lesson, topic) =>
  axios.get(`${API}/past-lessons/content/`, {
    params: { student_id: studentId, subject, lesson, topic },
  });

export const getPracticeQuiz = (studentId, subject, lesson, topic) =>
  axios.get(`${API}/practice-quiz/`, {
    params: { student_id: studentId, subject, lesson, topic },
  });

export const submitPracticeQuiz = (data) =>
  axios.post(`${API}/practice-quiz/submit/`, data);

export const getPracticeQuizResults = (studentId, subject, lesson, topic) =>
  axios.get(`${API}/practice-quiz/results/`, {
    params: { student_id: studentId, subject, lesson, topic },
  });
