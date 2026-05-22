import axios from "axios";

const API = "http://127.0.0.1:8000";

export const getPreQuiz = (subject, lesson, topic) => {
  // Grade 11 Buddhism uses special endpoints
  if (subject === "Buddhism") {
    // If no topic (lesson-level quiz), use lesson endpoint
    if (!topic) {
      // Improved lesson number extraction: find any digits in the lesson string
      const lessonMatch = lesson.match(/\d+/);
      const lessonNum = lessonMatch ? parseInt(lessonMatch[0]) : 1;
      
      return axios.get(`${API}/grade-11/lesson/pre-quiz/`, {
        params: { lesson: lessonNum },
      });
    }
    // Otherwise use KC-specific endpoint
    return axios.get(`${API}/grade-11/pre-quiz/`, {
      params: { kc_id: topic },
    });
  }
  return axios.get(`${API}/pre-quiz/`, {
    params: { subject, lesson, topic },
  });
};

export const submitPreQuiz = (data) => {
  // We keep it unified, but the backend now handles Buddhism specially
  return axios.post(`${API}/submit-pre-quiz/`, data);
};

export const getLesson = (subject, lesson, topic, level) => {
  console.log("🚀 SENDING:", { subject, lesson, topic, level });
  return axios.get(`${API}/get-lesson/`, {
    params: { subject, lesson, topic, level },
  });
};

export const getPostQuiz = (subject, lesson, topic, level) => {
  // Grade 11 Buddhism uses special endpoints
  if (subject === "Buddhism") {
    const studentId = localStorage.getItem("student_id");
    // If no topic (lesson-level quiz), use lesson endpoint
    if (!topic) {
      const lessonMatch = lesson.match(/\d+/);
      const lessonNum = lessonMatch ? parseInt(lessonMatch[0]) : 1;
      return axios.get(`${API}/grade-11/lesson/post-quiz/`, {
        params: { lesson: lessonNum, student_id: studentId },
      });
    }
    // Otherwise use KC-specific endpoint
    return axios.get(`${API}/grade-11/post-quiz/`, {
      params: { kc_id: topic, student_id: studentId },
    });
  }
  return axios.get(`${API}/post-quiz/`, {
    params: { subject, lesson, topic, level },
  });
};

export const submitPostQuiz = (data) => {
  // We keep it unified, but the backend now handles Buddhism specially
  return axios.post(`${API}/submit-post-quiz/`, data);
};

export const signupUser = (data) => axios.post(`${API}/auth/signup`, data);

export const loginUser = (data) => axios.post(`${API}/auth/login`, data);
