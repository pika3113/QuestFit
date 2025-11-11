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
  limit,
  arrayUnion
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
      xp: 0,
      totalWorkouts: 0,
      totalCalories: 0,
      totalDistance: 0,
      totalDuration: 0,
      totalAvgHeartRate: 0,
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
    // Clean session data to remove undefined values
    const cleanSession = this.removeUndefinedFields(session);
    const docRef = await addDoc(collection(db, 'workoutSessions'), cleanSession);
    return docRef.id;
  }

  // Helper to remove undefined fields (Firebase doesn't accept undefined)
  private removeUndefinedFields(obj: any): any {
    if (obj === null || obj === undefined) {
      return obj;
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.removeUndefinedFields(item));
    }
    
    if (typeof obj === 'object' && !(obj instanceof Date)) {
      const cleaned: any = {};
      for (const key in obj) {
        if (obj[key] !== undefined) {
          cleaned[key] = this.removeUndefinedFields(obj[key]);
        }
      }
      return cleaned;
    }
    
    return obj;
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
    const userRef = doc(db, 'users', userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      // Only save the creature ID, not the full object
      await updateDoc(userRef, {
        capturedCreatures: arrayUnion(creature.id)
      });
      
      console.log(`Saved creature ID ${creature.id} (${creature.name}) to Firebase for user ${userId}`);
    } else {
      console.error(`❌ User ${userId} does not exist in Firebase`);
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

  // XP and Level Management
  async addExperience(userId: string, experience: number): Promise<number> {
    const userProfile = await this.getUserProfile(userId);
    if (userProfile) {
      const newXP = userProfile.xp + experience;
      const newLevel = Math.floor(newXP / 100) + 1; // super simple level calculation 
      
      await this.updateUserProfile(userId, { 
        xp: newXP, 
        level: Math.max(userProfile.level, newLevel) 
      });
      
      return newLevel;
    }
    return 1;
  }
}

export default new GameService();
