import React from 'react';
import { Pressable } from 'react-native';
import { Text, View } from '@/components/Themed';
import { liveStyles as styles } from '@/src/styles';

export type WorkoutType =
  | 'RUNNING'
  | 'CYCLING'
  | 'SWIMMING'
  | 'FITNESS'
  | 'HIKING'
  | 'WALKING';

interface WorkoutTypeSelectorProps {
  selectedType: WorkoutType;
  onSelect: (type: WorkoutType) => void;
}

export const WorkoutTypeSelector: React.FC<WorkoutTypeSelectorProps> = ({
  selectedType,
  onSelect,
}) => {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Workout Type</Text>
      <View style={styles.workoutTypeGrid}>
        {(
          ['RUNNING', 'CYCLING', 'SWIMMING', 'FITNESS', 'HIKING', 'WALKING'] as const
        ).map((type) => (
          <Pressable
            key={type}
            style={[
              styles.workoutTypeButton,
              selectedType === type && styles.workoutTypeButtonActive,
            ]}
            onPress={() => onSelect(type)}
          >
            <Text
              style={[
                styles.workoutTypeText,
                selectedType === type && styles.workoutTypeTextActive,
              ]}
            >
              {type === 'RUNNING' && '🏃'}
              {type === 'CYCLING' && '🚴'}
              {type === 'SWIMMING' && '🏊'}
              {type === 'FITNESS' && '💪'}
              {type === 'HIKING' && '🥾'}
              {type === 'WALKING' && '🚶'}
            </Text>
            <Text
              style={[
                styles.workoutTypeLabel,
                selectedType === type && styles.workoutTypeLabelActive,
              ]}
            >
              {type.charAt(0) + type.slice(1).toLowerCase()}
            </Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
};
