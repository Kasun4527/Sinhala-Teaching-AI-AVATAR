import axios from "axios";

const API = "http://127.0.0.1:8000";

export const getPreQuiz = (subject, lesson, topic) =>
  axios.get(`${API}/pre-quiz/`, {
    params: { subject, lesson, topic },
  });

export const submitPreQuiz = (data) =>
  axios.post(`${API}/submit-pre-quiz/`, data);

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