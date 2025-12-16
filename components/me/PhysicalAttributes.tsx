import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Themed';
import { xpStyles as styles } from '@/src/styles';
import { formatDateDdMmYyyy } from '@/src/utils/dateFormat';

interface PhysicalAttributesProps {
  weight: number | null;
  height: number | null;
  age: number | null;
  gender: string | null;
  vo2Max: number | null;
  maxHr: number | null;
  restingHr: number | null;
  aerobicThreshold: number | null;
  anaerobicThreshold: number | null;
  lastPhysicalSync: string | null;
}

export const PhysicalAttributes: React.FC<PhysicalAttributesProps> = ({
  weight,
  height,
  age,
  gender,
  vo2Max,
  maxHr,
  restingHr,
  aerobicThreshold,
  anaerobicThreshold,
  lastPhysicalSync,
}) => {
  if (weight === null && age === null && gender === null && height === null && maxHr === null && vo2Max === null) {
    return null;
  }

  return (
    <View style={styles.section}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text style={styles.sectionTitle}>Physical Attributes</Text>
        {lastPhysicalSync && (
          <Text style={{ color: '#6B7280', fontSize: 12 }}>
            Synced: {formatDateDdMmYyyy(lastPhysicalSync)}
          </Text>
        )}
      </View>
      <View style={styles.attributesContainer}>
        {weight !== null && (
          <View style={styles.attributeBox}>
            <Text style={styles.attributeLabel}>Weight</Text>
            <Text style={styles.attributeValue}>{weight} kg</Text>
          </View>
        )}
        {height !== null && (
          <View style={styles.attributeBox}>
            <Text style={styles.attributeLabel}>Height</Text>
            <Text style={styles.attributeValue}>{height} cm</Text>
          </View>
        )}
        {age !== null && (
          <View style={styles.attributeBox}>
            <Text style={styles.attributeLabel}>Age</Text>
            <Text style={styles.attributeValue}>{age} years</Text>
          </View>
        )}
        {gender !== null && (
          <View style={styles.attributeBox}>
            <Text style={styles.attributeLabel}>Gender</Text>
            <Text style={styles.attributeValue}>{gender === 'MALE' ? 'Male' : gender === 'FEMALE' ? 'Female' : gender}</Text>
          </View>
        )}
        {vo2Max !== null && (
          <View style={styles.attributeBox}>
            <Text style={styles.attributeLabel}>VO2 Max</Text>
            <Text style={styles.attributeValue}>{vo2Max}</Text>
          </View>
        )}
        {maxHr !== null && (
          <View style={styles.attributeBox}>
            <Text style={styles.attributeLabel}>Max HR</Text>
            <Text style={styles.attributeValue}>{maxHr} bpm</Text>
          </View>
        )}
        {restingHr !== null && (
          <View style={styles.attributeBox}>
            <Text style={styles.attributeLabel}>Resting HR</Text>
            <Text style={styles.attributeValue}>{restingHr} bpm</Text>
          </View>
        )}
        {aerobicThreshold !== null && (
          <View style={styles.attributeBox}>
            <Text style={styles.attributeLabel}>Aerobic T.</Text>
            <Text style={styles.attributeValue}>{aerobicThreshold} bpm</Text>
          </View>
        )}
        {anaerobicThreshold !== null && (
          <View style={styles.attributeBox}>
            <Text style={styles.attributeLabel}>Anaerobic T.</Text>
            <Text style={styles.attributeValue}>{anaerobicThreshold} bpm</Text>
          </View>
        )}
      </View>
    </View>
  );
};
