import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';

type SkeletonBlockProps = {
  width?: number | string;
  height: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
};

export function SkeletonBlock({ width = '100%', height, radius = 8, style }: SkeletonBlockProps) {
  return (
    <View
      style={[
        styles.block,
        { width, height, borderRadius: radius },
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: '#E0E0E0',
  },
});
