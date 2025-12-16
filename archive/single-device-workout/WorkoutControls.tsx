import React from 'react';
import { Pressable } from 'react-native';
import { Text, View } from '@/components/Themed';
import { liveStyles as styles } from '@/src/styles';

interface WorkoutControlsProps {
  workoutActive: boolean;
  workoutPaused: boolean;
  pauseReason: string | null;
  onStart: () => void;
  onPause: () => void;
  onResume: () => void;
  onEnd: () => void;
}

export const WorkoutControls: React.FC<WorkoutControlsProps> = ({
  workoutActive,
  workoutPaused,
  pauseReason,
  onStart,
  onPause,
  onResume,
  onEnd,
}) => {
  if (!workoutActive) {
    return (
      <View style={styles.section}>
        <Pressable
          style={[styles.workoutButton, styles.startButton]}
          onPress={onStart}
        >
          <Text style={styles.workoutButtonText}>▶️ Start Workout</Text>
        </Pressable>
        <Text style={styles.autoStartHint}>
          💡 Tip: Workout will auto-start when you enable "HR sensor mode" on your watch
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
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
        <Pressable style={[styles.workoutButton, styles.endButton]} onPress={onEnd}>
          <Text style={styles.workoutButtonText}>⏹️ End</Text>
        </Pressable>
      </View>
      {pauseReason && <Text style={styles.pauseReasonText}>{pauseReason}</Text>}
    </View>
  );
};
