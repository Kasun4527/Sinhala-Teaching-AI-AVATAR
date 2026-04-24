import axios from "axios";

const API = "http://127.0.0.1:8000";

// =====================
// 🧠 PRE QUIZ (before lesson)
// =====================
export const getPreQuiz = (subject, lesson, topic) =>
  axios.get(`${API}/pre-quiz/`, {
    params: { subject, lesson, topic },
  });

// =====================
// 📤 SUBMIT PRE QUIZ
// =====================
export const submitPreQuiz = (data) =>
  axios.post(`${API}/submit-pre-quiz/`, data);

// =====================
// 📚 GET LESSON
// =====================
export const getLesson = (subject, lesson, topic, level) => {
  console.log("🚀 SENDING:", { subject, lesson, topic, level });

  return axios.get(`${API}/get-lesson/`, {
    params: { subject, lesson, topic, level },
  });
};

// =====================
// 🧠 POST QUIZ (after lesson)
// =====================
export const getPostQuiz = (subject, lesson, topic, level) =>
  axios.get(`${API}/post-quiz/`, {
    params: { subject, lesson, topic, level },
  });

// =====================
// 📤 SUBMIT POST QUIZ
// =====================
export const submitPostQuiz = (data) =>
  axios.post(`${API}/submit-post-quiz/`, data);