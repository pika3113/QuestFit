import React, { useMemo } from 'react';
import { View, Text, StyleSheet, Dimensions } from 'react-native';
import Svg, { Polygon, Line, Circle, Text as SvgText, G } from 'react-native-svg';

export interface RadarDataPoint {
  cardioLoad: number;
  calories: number;
  sleepScore: number;
  steps: number;
  distance: number;
  exerciseCount: number;
}

interface ComparisonRadarChartProps {
  individualData: RadarDataPoint;
  averageData: RadarDataPoint;
  studentName: string;
  selectedCount: number;
}

// Normalization constants
const NORMALIZATION = {
  cardioLoad: { min: 0, max: 2 },      // Cardio load ratio typically 0-2
  calories: { min: 0, max: 3000 },      // Daily calories
  sleepScore: { min: 0, max: 100 },     // Sleep score is 0-100
  steps: { min: 0, max: 15000 },        // Daily steps
  distance: { min: 0, max: 15000 },     // Distance in meters
  exerciseCount: { min: 0, max: 5 },    // Exercises per day
};

const LABELS = [
  { key: 'cardioLoad', label: 'Cardio\nLoad' },
  { key: 'calories', label: 'Calories' },
  { key: 'sleepScore', label: 'Sleep\nScore' },
  { key: 'steps', label: 'Steps' },
  { key: 'distance', label: 'Distance' },
  { key: 'exerciseCount', label: 'Exercises' },
];

const normalizeValue = (value: number, key: keyof RadarDataPoint): number => {
  const { min, max } = NORMALIZATION[key];
  const normalized = (value - min) / (max - min);
  return Math.max(0, Math.min(1, normalized));
};

const polarToCartesian = (
  centerX: number,
  centerY: number,
  radius: number,
  angleInDegrees: number
): { x: number; y: number } => {
  const angleInRadians = ((angleInDegrees - 90) * Math.PI) / 180.0;
  return {
    x: centerX + radius * Math.cos(angleInRadians),
    y: centerY + radius * Math.sin(angleInRadians),
  };
};

export const ComparisonRadarChart: React.FC<ComparisonRadarChartProps> = ({
  individualData,
  averageData,
  studentName,
  selectedCount,
}) => {
  const size = Math.min(Dimensions.get('window').width - 40, 350);
  const center = size / 2;
  const radius = size * 0.35;
  const levels = 5; 

  const individualPoints = useMemo(() => {
    return LABELS.map((item, index) => {
      const angle = (360 / LABELS.length) * index;
      const value = normalizeValue(individualData[item.key as keyof RadarDataPoint], item.key as keyof RadarDataPoint);
      const point = polarToCartesian(center, center, radius * value, angle);
      return `${point.x},${point.y}`;
    }).join(' ');
  }, [individualData, center, radius]);

  const averagePoints = useMemo(() => {
    return LABELS.map((item, index) => {
      const angle = (360 / LABELS.length) * index;
      const value = normalizeValue(averageData[item.key as keyof RadarDataPoint], item.key as keyof RadarDataPoint);
      const point = polarToCartesian(center, center, radius * value, angle);
      return `${point.x},${point.y}`;
    }).join(' ');
  }, [averageData, center, radius]);

  const gridLines = useMemo(() => {
    const lines = [];
    
    for (let i = 1; i <= levels; i++) {
      const levelRadius = (radius / levels) * i;
      const points = LABELS.map((_, index) => {
        const angle = (360 / LABELS.length) * index;
        const point = polarToCartesian(center, center, levelRadius, angle);
        return `${point.x},${point.y}`;
      }).join(' ');
      lines.push(
        <Polygon
          key={`level-${i}`}
          points={points}
          fill="none"
          stroke="#E0E0E0"
          strokeWidth={1}
        />
      );
    }

    LABELS.forEach((_, index) => {
      const angle = (360 / LABELS.length) * index;
      const point = polarToCartesian(center, center, radius, angle);
      lines.push(
        <Line
          key={`radial-${index}`}
          x1={center}
          y1={center}
          x2={point.x}
          y2={point.y}
          stroke="#E0E0E0"
          strokeWidth={1}
        />
      );
    });

    return lines;
  }, [center, radius, levels]);

  const labelElements = useMemo(() => {
    return LABELS.map((item, index) => {
      const angle = (360 / LABELS.length) * index;
      const labelRadius = radius + 30;
      const point = polarToCartesian(center, center, labelRadius, angle);
      
      let textAnchor: 'start' | 'middle' | 'end' = 'middle';
      if (point.x < center - 10) textAnchor = 'end';
      else if (point.x > center + 10) textAnchor = 'start';

      const lines = item.label.split('\n');
      
      return (
        <G key={`label-${index}`}>
          {lines.map((line, lineIndex) => (
            <SvgText
              key={`label-${index}-${lineIndex}`}
              x={point.x}
              y={point.y + (lineIndex * 12) - ((lines.length - 1) * 6)}
              textAnchor={textAnchor}
              fill="#636E72"
              fontSize={11}
              fontWeight="500"
              fontFamily="System"
            >
              {line}
            </SvgText>
          ))}
        </G>
      );
    });
  }, [center, radius]);

  const individualMarkers = useMemo(() => {
    return LABELS.map((item, index) => {
      const angle = (360 / LABELS.length) * index;
      const value = normalizeValue(individualData[item.key as keyof RadarDataPoint], item.key as keyof RadarDataPoint);
      const point = polarToCartesian(center, center, radius * value, angle);
      return (
        <Circle
          key={`individual-marker-${index}`}
          cx={point.x}
          cy={point.y}
          r={4}
          fill="#2E86AB"
          stroke="#FFFFFF"
          strokeWidth={2}
        />
      );
    });
  }, [individualData, center, radius]);

  const averageMarkers = useMemo(() => {
    return LABELS.map((item, index) => {
      const angle = (360 / LABELS.length) * index;
      const value = normalizeValue(averageData[item.key as keyof RadarDataPoint], item.key as keyof RadarDataPoint);
      const point = polarToCartesian(center, center, radius * value, angle);
      return (
        <Circle
          key={`average-marker-${index}`}
          cx={point.x}
          cy={point.y}
          r={4}
          fill="#FF6B35"
          stroke="#FFFFFF"
          strokeWidth={2}
        />
      );
    });
  }, [averageData, center, radius]);

  const formatValue = (value: number, key: string): string => {
    if (key === 'cardioLoad') return value.toFixed(2);
    if (key === 'sleepScore') return Math.round(value).toString();
    if (key === 'exerciseCount') return value.toFixed(1);
    return Math.round(value).toLocaleString();
  };

  return (
    <View style={styles.container}>

      <View style={styles.chartWrapper}>
        <Svg width={size} height={size}>
          {/* Grid */}
          {gridLines}
          
          {/* Average polygon (behind) */}
          <Polygon
            points={averagePoints}
            fill="rgba(255, 107, 53, 0.2)"
            stroke="#FF6B35"
            strokeWidth={2}
          />
          
          {/* Individual polygon (front) */}
          <Polygon
            points={individualPoints}
            fill="rgba(46, 134, 171, 0.3)"
            stroke="#2E86AB"
            strokeWidth={2}
          />

          {/* Labels */}
          {labelElements}

          {/* Data point markers */}
          {averageMarkers}
          {individualMarkers}
        </Svg>
      </View>

      {/* Legend */}
      <View style={styles.legend}>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#2E86AB' }]} />
          <Text style={styles.legendText}>{studentName}</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: '#FF6B35' }]} />
          <Text style={styles.legendText}>Group Average</Text>
        </View>
      </View>

      {/* Stats comparison table */}
      <View style={styles.statsTable}>
        <View style={styles.statsHeader}>
          <Text style={[styles.statsHeaderText, { flex: 2 }]}>Metric</Text>
          <Text style={[styles.statsHeaderText, { flex: 1, textAlign: 'right', color: '#2E86AB' }]}>Individual</Text>
          <Text style={[styles.statsHeaderText, { flex: 1, textAlign: 'right', color: '#FF6B35' }]}>Average</Text>
        </View>
        {LABELS.map((item) => {
          const indValue = individualData[item.key as keyof RadarDataPoint];
          const avgValue = averageData[item.key as keyof RadarDataPoint];
          const diff = indValue - avgValue;
          const isHigher = diff > 0;
          
          return (
            <View key={item.key} style={styles.statsRow}>
              <Text style={[styles.statsLabel, { flex: 2 }]}>{item.label.replace('\n', ' ')}</Text>
              <Text style={[styles.statsValue, { flex: 1, textAlign: 'right' }]}>
                {formatValue(indValue, item.key)}
              </Text>
              <Text style={[styles.statsValue, { flex: 1, textAlign: 'right', color: '#636E72' }]}>
                {formatValue(avgValue, item.key)}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#2D3436',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: '#636E72',
    textAlign: 'center',
    marginBottom: 16,
  },
  chartWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 24,
    marginTop: 16,
    marginBottom: 16,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 4,
  },
  legendText: {
    fontSize: 13,
    color: '#2D3436',
    fontWeight: '500',
  },
  statsTable: {
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    paddingTop: 12,
  },
  statsHeader: {
    flexDirection: 'row',
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    marginBottom: 8,
  },
  statsHeaderText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#636E72',
    textTransform: 'uppercase',
  },
  statsRow: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: '#F8F9FA',
  },
  statsLabel: {
    fontSize: 13,
    color: '#2D3436',
  },
  statsValue: {
    fontSize: 13,
    fontWeight: '600',
    color: '#2D3436',
  },
});

export default ComparisonRadarChart;