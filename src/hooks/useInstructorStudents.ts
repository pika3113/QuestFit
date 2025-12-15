import { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';

export function useInstructorStudents(instructorId: string | undefined) {
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!instructorId) {
      setLoading(false);
      return;
    }

    loadSelectedUsers();
  }, [instructorId]);

  const loadSelectedUsers = async () => {
    if (!instructorId) return;

    try {
      const instructorDoc = await getDoc(doc(db, 'instructors', instructorId));
      const data = instructorDoc.data();
      const selectedUsersRaw = data?.selectedUsers;
      setSelectedUserIds(Array.isArray(selectedUsersRaw) ? selectedUsersRaw : []);
    } catch (error) {
      console.error('Error loading selected users:', error);
    } finally {
      setLoading(false);
    }
  };

  const saveSelectedUsers = async (userIds: string[]) => {
    if (!instructorId) return;

    try {
      await setDoc(doc(db, 'instructors', instructorId), {
        selectedUsers: userIds,
        updatedAt: new Date().toISOString(),
      }, { merge: true });
      setSelectedUserIds(userIds);
    } catch (error) {
      console.error('Error saving selected users:', error);
      throw error;
    }
  };

  const toggleUser = async (userId: string) => {
    const newSelection = selectedUserIds.includes(userId)
      ? selectedUserIds.filter(id => id !== userId)
      : [...selectedUserIds, userId];
    
    await saveSelectedUsers(newSelection);
  };

  return {
    selectedUserIds,
    loading,
    toggleUser,
    saveSelectedUsers,
  };
}
