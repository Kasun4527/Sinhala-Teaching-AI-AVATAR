import axios from 'axios';

const API_URL = 'http://localhost:8000'; // Make sure this matches your backend URL

export const bktService = {
  fetchMastery: async (studentId: string) => {
    try {
      const response = await axios.get(`${API_URL}/hybrid/mastery/${studentId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching BKT mastery:', error);
      throw error;
    }
  },

  submitInteraction: async (studentId: string, kcId: string, isCorrect: boolean, difficulty: number = 5.0) => {
    try {
      const response = await axios.post(`${API_URL}/model/update`, {
        student_id: studentId,
        skill_id: kcId,
        subject: "Buddhism",
        is_correct: isCorrect,
        difficulty: difficulty
      });
      return response.data;
    } catch (error) {
      console.error('Error updating BKT interaction:', error);
      throw error;
    }
  }
};
