import { useState, useEffect } from 'react';
import { UserGameProfile } from '../types/polar';
import gameService from '../services/gameService';

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
          // Create a new profile if none exists
          await gameService.createUserProfile(userId, {});
          const newProfile = await gameService.getUserProfile(userId);
          setProfile(newProfile);
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
      const newLevel = await gameService.addExperience(userId, experience);
      
      // Refresh the profile to get updated data
      const updatedProfile = await gameService.getUserProfile(userId);
      setProfile(updatedProfile);
      
      return newLevel;
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
