import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/Themed';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';

interface SleepScoreAreaChartProps {
  sleepData: Map<string, Array<{date: string, score: number | null}>>;
  dates: string[];
  allUsers: {id: string, displayName: string}[];
}

export const SleepScoreAreaChart = ({ 
  sleepData, 
  dates, 
  allUsers 
}: SleepScoreAreaChartProps) => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  
  const colors = ['#FF6B35', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#E74C3C', '#3498DB'];
  
  const chartHeight = 300;
  const padding = { top: 25, right: 40, bottom: 40, left: 50 };
  const plotHeight = chartHeight - padding.top - padding.bottom;
  const plotWidth = containerWidth > 0 ? containerWidth - padding.left - padding.right : 400;
  
  const maxScore = 100;
  const minScore = 0;
  const yAxisSteps = 5;
  const yAxisValues = Array.from({ length: yAxisSteps + 1 }, (_, i) => 
    minScore + (maxScore - minScore) / yAxisSteps * (yAxisSteps - i)
  );
  
  const getX = (index: number) => {
    if (dates.length <= 1) return 0;
    return (plotWidth / (dates.length - 1)) * index;
  };
  const getY = (score: number) => plotHeight - ((score - minScore) / (maxScore - minScore)) * plotHeight;
  
  const normalizeScore = (score: number | null | undefined): number => {
    if (score === null || score === undefined || isNaN(score) || score < 0) return 0;
    return score;
  };
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const handleUserSelect = (userId: string | null) => {
    setSelectedUserId(selectedUserId === userId ? null : userId);
  };

  return (
    <View 
      style={{ padding: 16, backgroundColor: 'white', marginBottom: 20, borderRadius: 8 }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 8, color: '#000' }}>
        Sleep Score Trends (Area)
      </Text>
      
      {/* Legend */}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', marginBottom: 16, gap: 8 }}>
        {Array.from(sleepData.keys()).map((userId, index) => {
          const user = allUsers.find(u => u.id === userId);
          const color = colors[index % colors.length];
          const isSelected = selectedUserId === userId;
          const isDimmed = selectedUserId !== null && !isSelected;
          
          return (
            <Pressable 
              key={userId}
              onPress={() => handleUserSelect(userId)}
              style={{ flexDirection: 'row', alignItems: 'center', opacity: isDimmed ? 0.3 : 1 }}
            >
              <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color, marginRight: 4 }} />
              <Text style={{ fontSize: 12, color: '#666', fontWeight: isSelected ? 'bold' : 'normal' }}>
                {user?.displayName || 'Unknown'}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={{ height: chartHeight, flexDirection: 'row' }}>
        {/* Y-axis Labels */}
        <View style={{ width: padding.left, height: chartHeight, justifyContent: 'space-between', paddingRight: 8, paddingVertical: padding.top }}>
          {yAxisValues.map((val, i) => (
            <Text key={i} style={{ fontSize: 10, color: '#888', textAlign: 'right', position: 'absolute', top: padding.top + (plotHeight / yAxisSteps) * i - 6, right: 8, width: 40 }}>
              {Math.round(val)}
            </Text>
          ))}
        </View>

        {/* Chart Area */}
        <View style={{ flex: 1, height: chartHeight }}>
          <Svg height={chartHeight} width={plotWidth} style={{ overflow: 'visible' }}>
            <Defs>
              {Array.from(sleepData.keys()).map((userId, index) => (
                <LinearGradient key={`grad-${userId}`} id={`grad-${userId}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={colors[index % colors.length]} stopOpacity="0.4" />
                  <Stop offset="1" stopColor={colors[index % colors.length]} stopOpacity="0.05" />
                </LinearGradient>
              ))}
            </Defs>

            {/* Grid Lines */}
            {yAxisValues.map((_, i) => (
              <Path
                key={`grid-${i}`}
                d={`M 0 ${padding.top + (plotHeight / yAxisSteps) * i} L ${plotWidth} ${padding.top + (plotHeight / yAxisSteps) * i}`}
                stroke="#f0f0f0"
                strokeWidth="1"
              />
            ))}

            {/* Areas and Lines */}
            {Array.from(sleepData.entries()).map(([userId, scores], userIndex) => {
              const color = colors[userIndex % colors.length];
              const isSelected = selectedUserId === userId;
              const hasSelection = selectedUserId !== null;
              
              if (hasSelection && !isSelected) return null;

              // Construct path data
              let pathD = '';
              let areaD = '';
              let firstPoint = true;

              scores.forEach((point, index) => {
                const x = getX(index);
                const y = getY(normalizeScore(point.score)) + padding.top;
                
                if (firstPoint) {
                  pathD += `M ${x} ${y}`;
                  areaD += `M ${x} ${y}`;
                  firstPoint = false;
                } else {
                  pathD += ` L ${x} ${y}`;
                  areaD += ` L ${x} ${y}`;
                }
              });

              // Close area path
              if (scores.length > 0) {
                const lastX = getX(scores.length - 1);
                const bottomY = padding.top + plotHeight;
                const firstX = getX(0);
                areaD += ` L ${lastX} ${bottomY} L ${firstX} ${bottomY} Z`;
              }

              return (
                <React.Fragment key={userId}>
                  <Path
                    d={areaD}
                    fill={`url(#grad-${userId})`}
                    opacity={isSelected ? 0.8 : 0.5}
                  />
                  <Path
                    d={pathD}
                    stroke={color}
                    strokeWidth={isSelected ? 3 : 2}
                    fill="none"
                  />
                  {/* Dots */}
                  {scores.map((point, index) => {
                    const x = getX(index);
                    const y = getY(normalizeScore(point.score)) + padding.top;
                    return (
                      <Path
                        key={`dot-${index}`}
                        d={`M ${x} ${y} m -3, 0 a 3,3 0 1,0 6,0 a 3,3 0 1,0 -6,0`}
                        fill="white"
                        stroke={color}
                        strokeWidth={2}
                      />
                    );
                  })}
                </React.Fragment>
              );
            })}
          </Svg>

          {/* X-axis Labels */}
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-between', 
            position: 'absolute',
            bottom: 10,
            left: 0,
            width: plotWidth
          }}>
            {dates.map((date, index) => (
              <Text key={index} style={{ fontSize: 10, color: '#666', width: 30, textAlign: 'center', marginLeft: -15 }}>
                {formatDate(date)}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};
