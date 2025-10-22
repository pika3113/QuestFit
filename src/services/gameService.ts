import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  addDoc,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from './firebase';
import { UserGameProfile, WorkoutSession, Creature, Quest } from '../types/polar';

class GameService {
  // User Profile Management
  async getUserProfile(userId: string): Promise<UserGameProfile | null> {
    const docRef = doc(db, 'users', userId);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return docSnap.data() as UserGameProfile;
    }
    return null;
  }

  async createUserProfile(userId: string, initialData: Partial<UserGameProfile>): Promise<void> {
    const defaultProfile: UserGameProfile = {
      userId,
      level: 1,
      experience: 0,
      totalWorkouts: 0,
      totalCalories: 0,
      totalDistance: 0,
      capturedCreatures: [],
      achievements: [],
      ...initialData
    };

    await setDoc(doc(db, 'users', userId), defaultProfile);
  }

  async updateUserProfile(userId: string, updates: Partial<UserGameProfile>): Promise<void> {
    const docRef = doc(db, 'users', userId);
    await updateDoc(docRef, updates);
  }

  // Workout Sessions
  async saveWorkoutSession(session: WorkoutSession): Promise<string> {
    const docRef = await addDoc(collection(db, 'workoutSessions'), session);
    return docRef.id;
  }

  async getUserWorkouts(userId: string, limitCount: number = 10): Promise<WorkoutSession[]> {
    const q = query(
      collection(db, 'workoutSessions'),
      where('userId', '==', userId),
      orderBy('startTime', 'desc'),
      limit(limitCount)
    );
    
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as WorkoutSession));
  }

  // Creatures Management
  async getAvailableCreatures(): Promise<Creature[]> {
    const querySnapshot = await getDocs(collection(db, 'creatures'));
    return querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Creature));
  }

  async addCapturedCreature(userId: string, creature: Creature): Promise<void> {
    const userProfile = await this.getUserProfile(userId);
    if (userProfile) {
      const updatedCreatures = [...userProfile.capturedCreatures, creature];
      await this.updateUserProfile(userId, { capturedCreatures: updatedCreatures });
    }
  }

  // Quest Management
  async getCurrentQuest(userId: string): Promise<Quest | null> {
    const userProfile = await this.getUserProfile(userId);
    return userProfile?.currentQuest || null;
  }

  async updateQuestProgress(userId: string, questId: string, progress: number): Promise<void> {
    const userProfile = await this.getUserProfile(userId);
    if (userProfile?.currentQuest?.id === questId) {
      const updatedQuest = { ...userProfile.currentQuest, progress };
      await this.updateUserProfile(userId, { currentQuest: updatedQuest });
    }
  }

  // Experience and Level Management
  async addExperience(userId: string, experience: number): Promise<number> {
    const userProfile = await this.getUserProfile(userId);
    if (userProfile) {
      const newExperience = userProfile.experience + experience;
      const newLevel = Math.floor(newExperience / 100) + 1; // Simple level calculation
      
      await this.updateUserProfile(userId, { 
        experience: newExperience, 
        level: Math.max(userProfile.level, newLevel) 
      });
      
      return newLevel;
    }
    return 1;
  }
}

export default new GameService();
