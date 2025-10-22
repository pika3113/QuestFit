import { initializeApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBEYZR-CLwKKzYDVu94hMtYH-9e6WkUYzQ",
  authDomain: "questfit-67.firebaseapp.com",
  projectId: "questfit-67",
  storageBucket: "questfit-67.firebasestorage.app",
  messagingSenderId: "717608239209",
  appId: "1:717608239209:web:c02bc1e52fbad9b79022f8"
};

// Initialize Firebase (prevents multiple initializations)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

// Initialize services
const db: Firestore = getFirestore(app);

// Get Firebase Auth instance (automatically uses AsyncStorage on React Native)
const auth = getAuth(app);

const storage: FirebaseStorage = getStorage(app);

export { auth, db, storage };
export default app;
