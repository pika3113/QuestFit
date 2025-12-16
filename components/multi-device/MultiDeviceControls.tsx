import React from 'react';
import { Pressable } from 'react-native';
import { Text, View } from '@/components/Themed';
import { liveStyles as styles } from '@/src/styles';

interface MultiDeviceControlsProps {
  workoutActive: boolean;
  workoutPaused: boolean;
  pauseReason: string | null;
  hasConnectedDevices: boolean;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
  startLabel?: string;
}

export const MultiDeviceControls: React.FC<MultiDeviceControlsProps> = ({
  workoutActive,
  workoutPaused,
  pauseReason,
  hasConnectedDevices,
  onStart,
  onPause,
  onResume,
  onEnd,
  startLabel,
}) => {
  if (!hasConnectedDevices) return null;

  return (
    <View style={styles.section}>
      {!workoutActive ? (
        <Pressable
          style={[styles.workoutButton, styles.startButton]}
          onPress={onStart}
        >
          <Text style={styles.workoutButtonText}>{startLabel ?? '▶️ Start Group Workout'}</Text>
        </Pressable>
      ) : (
        <>
          <View style={styles.buttonRow}>
            {workoutPaused ? (
              <Pressable
                style={[styles.workoutButton, styles.resumeButton]}
                onPress={onResume}
              >
                <Text style={styles.workoutButtonText}>▶️ Resume</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.workoutButton, styles.pauseButton]}
                onPress={onPause}
              >
                <Text style={styles.workoutButtonText}>⏸️ Pause</Text>
              </Pressable>
            )}
            <Pressable
              style={[styles.workoutButton, styles.endButton]}
              onPress={onEnd}
            >
              <Text style={styles.workoutButtonText}>⏹️ End</Text>
            </Pressable>
          </View>
          {pauseReason && (
            <Text style={styles.pauseReasonText}>{pauseReason}</Text>
          )}
        </>
      )}
    </View>
  );
};
