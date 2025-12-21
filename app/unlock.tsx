import React, { useMemo, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Alert, Modal, Platform, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Text, View } from '@/components/Themed';
import { twoStyles as styles } from '@/src/styles';
import creatureService from '@/src/services/creatureService';
import { useAuth } from '@/src/hooks/useAuth';
import { useGameProfile } from '@/src/hooks/useGameProfile';
import { CreatureCard, CreatureCardGrid, CreatureCardGridSkeleton } from '@/components/game/CreatureCard';
import type { Creature } from '@/src/types/polar';

export default function UnlockScreen() {
  const { user } = useAuth();
  const { profile, loading, updateProfile } = useGameProfile(user?.uid || null);

  const allCreatures = creatureService.getAllCreatures();
  const allCreatureIds = allCreatures.map(c => c.id);
  const capturedIds = profile?.capturedCreatures ?? [];
  const isAuthed = !!user?.uid;

  const [selectedCreature, setSelectedCreature] = useState<Creature | null>(null);
  const [selectedCaptured, setSelectedCaptured] = useState(false);
  const [showCreatureModal, setShowCreatureModal] = useState(false);

  const cards = useMemo(() => {
    const capturedSet = new Set(capturedIds);
    return allCreatures.map(creature => ({
      creature,
      captured: capturedSet.has(creature.id),
    }));
  }, [allCreatures, capturedIds.join('|')]);

  const unlockOne = async (creatureId: string) => {
    if (!isAuthed || !profile) return;

    const next = Array.from(new Set([...(profile.capturedCreatures ?? []), creatureId]));
    await updateProfile({ capturedCreatures: next });
  };

  const unlockAll = async () => {
    if (!isAuthed) return;

    const message = `Unlock all ${allCreatureIds.length} creatures for this account?`;
    const ok =
      Platform.OS === 'web'
        ? // eslint-disable-next-line no-alert
          globalThis.confirm(message)
        : await new Promise<boolean>(resolve => {
            Alert.alert('Unlock all creatures', message, [
              { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
              { text: 'Unlock', style: 'default', onPress: () => resolve(true) },
            ]);
          });

    if (!ok) return;

    if (!profile) return;
    await updateProfile({ capturedCreatures: allCreatureIds });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'left', 'right', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Unlock (Beta)</Text>
        <Text style={styles.subtitle}>
          Testing page: unlock creatures without meeting requirements.
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
        <View style={{ padding: 16 }}>
          {!isAuthed ? (
            <Text style={{ color: '#6B7280' }}>
              You must be signed in to unlock creatures.
            </Text>
          ) : loading ? (
            <Text style={{ color: '#6B7280' }}>Loading your profile…</Text>
          ) : !profile ? (
            <Text style={{ color: '#6B7280' }}>
              Profile not found. Open the app normally once to initialize your profile.
            </Text>
          ) : (
            <>
              <Text style={{ color: '#6B7280', marginBottom: 12 }}>
                Captured: {capturedIds.length} / {allCreatureIds.length}
              </Text>

              <Pressable
                onPress={unlockAll}
                style={({ pressed }) => [
                  {
                    backgroundColor: '#2563EB',
                    paddingVertical: 12,
                    borderRadius: 12,
                    alignItems: 'center',
                    opacity: pressed ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: '800' }}>Unlock All Creatures</Text>
              </Pressable>

              <Text style={{ color: '#6B7280', marginTop: 12, fontSize: 12 }}>
                Tap any creature to open it, then unlock individually.
              </Text>

              <View style={{ height: 12 }} />

              {loading ? (
                <CreatureCardGridSkeleton count={12} />
              ) : (
                <CreatureCardGrid
                  cards={cards}
                  onPress={(id) => {
                    const card = cards.find(c => parseInt(c.creature.id) === id);
                    if (!card) return;
                    setSelectedCreature(card.creature);
                    setSelectedCaptured(card.captured);
                    setShowCreatureModal(true);
                  }}
                />
              )}
            </>
          )}
        </View>
      </ScrollView>

      <Modal
        visible={showCreatureModal}
        animationType="fade"
        transparent
        onRequestClose={() => setShowCreatureModal(false)}
      >
        <View style={uiStyles.modalOverlay}>
          <View style={uiStyles.modalCard}>
            {selectedCreature ? (
              <>
                <CreatureCard creature={selectedCreature} captured={selectedCaptured} layout="modal" />

                <View style={{ marginTop: 12, width: '100%' }}>
                  {selectedCaptured ? (
                    <View style={uiStyles.disabledButton}>
                      <Text style={uiStyles.disabledButtonText}>Already Unlocked</Text>
                    </View>
                  ) : (
                    <Pressable
                      onPress={async () => {
                        const message = `Unlock ${selectedCreature.name}?`;
                        const ok =
                          Platform.OS === 'web'
                            ? // eslint-disable-next-line no-alert
                              globalThis.confirm(message)
                            : await new Promise<boolean>(resolve => {
                                Alert.alert('Unlock creature', message, [
                                  { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
                                  { text: 'Unlock', style: 'default', onPress: () => resolve(true) },
                                ]);
                              });

                        if (!ok) return;
                        await unlockOne(selectedCreature.id);
                        setSelectedCaptured(true);
                      }}
                      style={({ pressed }) => [uiStyles.primaryButton, pressed && uiStyles.buttonPressed085]}
                      disabled={!isAuthed || !profile}
                    >
                      <Text style={uiStyles.primaryButtonText}>Unlock This Creature</Text>
                    </Pressable>
                  )}

                  <Pressable
                    onPress={() => setShowCreatureModal(false)}
                    style={({ pressed }) => [uiStyles.secondaryButton, pressed && uiStyles.buttonPressed085]}
                  >
                    <Text style={uiStyles.secondaryButtonText}>Close</Text>
                  </Pressable>
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const uiStyles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
  },
  primaryButton: {
    width: '100%',
    backgroundColor: '#2563EB',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontWeight: '800' },
  secondaryButton: {
    width: '100%',
    marginTop: 10,
    backgroundColor: '#6B7280',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  secondaryButtonText: { color: '#FFFFFF', fontWeight: '800' },
  disabledButton: {
    width: '100%',
    backgroundColor: '#E5E7EB',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  disabledButtonText: { color: '#6B7280', fontWeight: '800' },
  buttonPressed085: { opacity: 0.85 },
});
