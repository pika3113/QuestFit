
import { useState, useEffect } from 'react';
import { UserGameProfile } from '../types/polar';
import gameService from '../services/gameService';
import { IS_DEV_MODE } from '@/constants/DevConfig';

export const useGameProfile = (userId: string | null) => {
  const [profile, setProfile] = useState<UserGameProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setLoading(false);
      return;
    }

    const fetchProfile = async () => {
      try {
        setLoading(true);
        const userProfile = await gameService.getUserProfile(userId);
        
        if (!userProfile) {
          // Avoid creating Firestore user docs implicitly just because a userId exists locally.
          // In production, user docs should be created via explicit onboarding flows (e.g. consent).
          if (IS_DEV_MODE) {
            await gameService.createUserProfile(userId, {});
            const newProfile = await gameService.getUserProfile(userId);
            setProfile(newProfile);
          } else {
            setProfile(null);
            setError('User profile not found');
          }
        } else {
          setProfile(userProfile);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();
  }, [userId]);

  const updateProfile = async (updates: Partial<UserGameProfile>) => {
    if (!userId || !profile) return;

    try {
      await gameService.updateUserProfile(userId, updates);
      setProfile(prev => prev ? { ...prev, ...updates } : null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile');
    }
  };

  const addExperience = async (experience: number) => {
    if (!userId) return;

    try {
      await gameService.addExperience(userId, experience);
      
      // reload the profile so we have the latest data
      const updatedProfile = await gameService.getUserProfile(userId);
      setProfile(updatedProfile);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add experience');
    }
  };

  return {
    profile,
    loading,
    error,
    updateProfile,
    addExperience,
    refreshProfile: () => {
      if (userId) {
        gameService.getUserProfile(userId).then(setProfile);
      }
    }
  };
};
