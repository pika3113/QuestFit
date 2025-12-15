import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Pressable, ActivityIndicator } from 'react-native';
import { Text } from '@/components/Themed';
import { router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@/src/hooks/useAuth';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/src/services/firebase';
import {
  computeAchievementsProgress,
  syncUserAchievements,
  getUserAchievements,
} from '@/src/services/achievements/achievementsService';
import { ACHIEVEMENTS } from '@/src/services/achievements/definitions';
import type { UserAchievementsDoc } from '@/src/types/achievements';
import { formatDateDdMmYyyy } from '@/src/utils/dateFormat';

type UserProfileLike = {
  xp?: number;
  totalWorkouts?: number;
  totalCalories?: number;
  totalDistance?: number;
  totalDuration?: number;
  streakDays?: number;
  workoutHistory?: any[];
};

export default function AchievementsScreen() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfileLike>({});
  const [existing, setExisting] = useState<UserAchievementsDoc | null>(null);

  useEffect(() => {
    const run = async () => {
      if (!user?.uid) return;
      setLoading(true);
      try {
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        const data = userDoc.exists() ? (userDoc.data() as UserProfileLike) : {};
        setProfile(data);

        // Load existing progress (keeps unlockedAt stable)
        const achievementsDoc = await getUserAchievements(user.uid);
        setExisting(achievementsDoc);

        // Auto-sync computed progress to Firestore
        const updated = await syncUserAchievements({ userId: user.uid, profile: data });
        setExisting(updated);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [user?.uid]);

  const computed = useMemo(() => {
    // Prefer the already-synced doc for display (it includes derived metrics).
    // Fallback to local computation until the first sync completes.
    if (existing) return { definitions: ACHIEVEMENTS, progress: existing.achievements };
    return computeAchievementsProgress(profile, null);
  }, [profile, existing]);

  const unlockedCount = Object.values(computed.progress).filter(p => p.unlocked).length;

  return (
    <>
    <Stack.Screen options={{ headerShown: false }} />
    <ScrollView style={{ flex: 1, backgroundColor: '#F8F9FA' }} contentContainerStyle={{ padding: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
        <Pressable
          onPress={() => router.back()}
          style={{ padding: 8, minWidth: 40, marginRight: 8, alignItems: 'flex-start' }}
        >
          <Text style={{ fontSize: 18 }}>←</Text>
        </Pressable>
        <Text style={{ flex: 1, textAlign: 'center', fontSize: 22, fontWeight: '700', color: '#111' }}>
          Achievements
        </Text>
        <View style={{ minWidth: 40 }} />
      </View>

      <View style={{
        backgroundColor: '#111',
        padding: 16,
        borderRadius: 14,
        marginBottom: 14,
      }}>
        <Text style={{ color: '#FFF', fontSize: 16, fontWeight: '700' }}>
          {unlockedCount} / {ACHIEVEMENTS.length} unlocked
        </Text>
        <Text style={{ color: 'rgba(255,255,255,0.8)', marginTop: 6 }}>
          Earn badges as you train
        </Text>
      </View>

      {loading ? (
        <View style={{ padding: 24, alignItems: 'center' }}>
          <ActivityIndicator />
        </View>
      ) : (
        <View style={{ gap: 10 }}>
          {ACHIEVEMENTS.map(def => {
            const p = computed.progress[def.id];
            const progressPct = Math.min(1, (p?.progress ?? 0) / def.threshold);

            return (
              <View
                key={def.id}
                style={{
                  backgroundColor: '#FFF',
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: '#EAECEF',
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <View
                    style={{
                      width: 42,
                      height: 42,
                      borderRadius: 12,
                      backgroundColor: def.color,
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginRight: 12,
                      opacity: p?.unlocked ? 1 : 0.5,
                    }}
                  >
                    <Ionicons name={def.icon as any} size={22} color="#FFF" />
                  </View>

                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 16, fontWeight: '700', color: '#111' }}>{def.title}</Text>
                    <Text style={{ color: '#666', marginTop: 2 }}>{def.description}</Text>
                    <Text style={{ color: '#999', marginTop: 6, fontSize: 12 }}>
                      {p?.unlocked ? `Unlocked${p.unlockedAt ? ` • ${formatDateDdMmYyyy(p.unlockedAt)}` : ''}` : `Progress: ${Math.min(p?.progress ?? 0, def.threshold)} / ${def.threshold}`}
                    </Text>

                    <View style={{
                      height: 8,
                      backgroundColor: '#F0F1F2',
                      borderRadius: 999,
                      marginTop: 10,
                      overflow: 'hidden'
                    }}>
                      <View style={{
                        height: 8,
                        width: `${Math.round(progressPct * 100)}%`,
                        backgroundColor: def.color,
                      }} />
                    </View>
                  </View>

                  <View style={{ marginLeft: 10 }}>
                    <Text style={{ color: '#111', fontWeight: '700' }}>+{def.points}</Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
      )}

      <View style={{ height: 24 }} />
    </ScrollView>
    </>
  );
}
