import axios from 'axios';
import { WorkoutData, HeartRateData, UserProfile } from '../types/polar';

const POLAR_BASE_URL = 'https://www.polaraccesslink.com/v3';

class PolarApiService {
  private accessToken: string | null = null;

  setAccessToken(token: string) {
    this.accessToken = token;
  }

  private getHeaders() {
    return {
      'Authorization': `Bearer ${this.accessToken}`,
      'Content-Type': 'application/json',
    };
  }

  async getUserProfile(): Promise<UserProfile> {
    const response = await axios.get(`${POLAR_BASE_URL}/users`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async getWorkouts(): Promise<WorkoutData[]> {
    const response = await axios.get(`${POLAR_BASE_URL}/exercises`, {
      headers: this.getHeaders(),
    });
    return response.data.exercises || [];
  }

  async getHeartRateData(exerciseId: string): Promise<HeartRateData> {
    const response = await axios.get(`${POLAR_BASE_URL}/exercises/${exerciseId}/heart-rate`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }

  async getWorkoutDetails(exerciseId: string): Promise<WorkoutData> {
    const response = await axios.get(`${POLAR_BASE_URL}/exercises/${exerciseId}`, {
      headers: this.getHeaders(),
    });
    return response.data;
  }
}

export default new PolarApiService();
