import React, { useState } from 'react';
import { View, Pressable } from 'react-native';
import { Text } from '@/components/Themed';

interface SleepScoreLineChartProps {
  sleepData: Map<string, Array<{date: string, score: number | null}>>;
  dates: string[];
  allUsers: {id: string, displayName: string}[];
}

export const SleepScoreLineChart = ({ 
  sleepData, 
  dates, 
  allUsers 
}: SleepScoreLineChartProps) => {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [tooltip, setTooltip] = useState<{
    type: 'user' | 'average';
    userId?: string;
    date: string;
    score: number;
    x: number;
    y: number;
  } | null>(null);
  
  const colors = ['#FF6B35', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#E74C3C', '#3498DB'];
  const averageLineColor = '#CC0000';
  
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
    if (dates.length <= 1) return padding.left;
    return padding.left + (plotWidth / (dates.length - 1)) * index;
  };
  const getY = (score: number) => padding.top + plotHeight - ((score - minScore) / (maxScore - minScore)) * plotHeight;
  
  const normalizeScore = (score: number | null | undefined): number => {
    if (score === null || score === undefined || isNaN(score) || score < 0) {
      return 0;
    }
    return score;
  };
  
  const calculateDailyAverages = (): Array<{date: string, average: number}> => {
    return dates.map((date, dateIndex) => {
      const validScores: number[] = [];
      
      sleepData.forEach((scores) => {
        const scoreForDate = scores[dateIndex];
        if (scoreForDate) {
          const normalizedScore = normalizeScore(scoreForDate.score);
          if (normalizedScore > 0) {
            validScores.push(normalizedScore);
          }
        }
      });
      
      if (validScores.length > 0) {
        const sum = validScores.reduce((acc, score) => acc + score, 0);
        const average = Math.round(sum / validScores.length);
        return { date, average };
      }
      
      return { date, average: 0 };
    });
  };
  
  const dailyAverages = calculateDailyAverages();
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}`;
  };

  const handleUserSelect = (userId: string | null) => {
    if (userId === null) {
      setSelectedUserId(null);
    } else {
      setSelectedUserId(selectedUserId === userId ? null : userId);
    }
  };

  const handlePointClick = (
    type: 'user' | 'average',
    date: string,
    score: number,
    x: number,
    y: number,
    userId?: string
  ) => {
    // Toggle tooltip - if clicking same point, hide it
    if (tooltip && tooltip.date === date && tooltip.userId === userId && tooltip.type === type) {
      setTooltip(null);
      // Also deselect the user line
      if (type === 'user') {
        setSelectedUserId(null);
      }
    } else {
      setTooltip({ type, date, score, x, y, userId });
      // Highlight the user's line when clicking their datapoint
      if (type === 'user' && userId) {
        setSelectedUserId(userId);
      }
    }
  };

  const handleOutsideClick = () => {
    setTooltip(null);
    setSelectedUserId(null);
  };

  return (
    <View 
      style={{ padding: 16, backgroundColor: 'white', marginBottom: 20, borderRadius: 8 }}
      onLayout={(event) => {
        const { width } = event.nativeEvent.layout;
        setContainerWidth(width - 32);
      }}
    >
      <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, color: '#000' }}>
        Sleep Score - Last 7 Days
      </Text>
      
      {containerWidth > 0 && (
        <View style={{ width: '100%' }}>
          <Pressable 
            style={{ position: 'relative', height: chartHeight }}
            onPress={handleOutsideClick}
          >
            {/* Y-axis */}
            <View style={{ position: 'absolute', left: 0, top: padding.top, height: plotHeight, width: padding.left }}>
              {yAxisValues.map((value, index) => (
                <View key={index} style={{ position: 'absolute', top: (plotHeight / yAxisSteps) * index, right: 8, flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, color: '#666', textAlign: 'right' }}>
                    {Math.round(value)}
                  </Text>
                </View>
              ))}
            </View>
            
            {/* Grid lines */}
            {yAxisValues.map((_, index) => (
              <View 
                key={index}
                style={{ 
                  position: 'absolute', 
                  left: padding.left, 
                  top: padding.top + (plotHeight / yAxisSteps) * index,
                  width: plotWidth,
                  height: 1,
                  backgroundColor: '#E0E0E0'
                }} 
              />
            ))}
            
            {/* Border */}
            <View style={{ position: 'absolute', left: padding.left, top: padding.top, width: plotWidth, height: plotHeight, borderWidth: 1, borderColor: '#E0E0E0' }} />
            
            {/* Individual user lines and points */}
            {Array.from(sleepData.entries()).map(([userId, scores], userIndex) => {
              const color = colors[userIndex % colors.length];
              const isSelected = selectedUserId === userId;
              const hasSelection = selectedUserId !== null;
              
              const lineOpacity = hasSelection ? (isSelected ? 1 : 0.2) : 0.8;
              const pointOpacity = hasSelection ? (isSelected ? 1 : 0.2) : 1;
              
              return (
                <View key={userId}>
                  {/* Line segments */}
                  {scores.map((point, index) => {
                    if (index === 0) return null;
                    
                    const prevScore = normalizeScore(scores[index - 1].score);
                    const currentScore = normalizeScore(point.score);
                    
                    const x1 = getX(index - 1);
                    const y1 = getY(prevScore);
                    const x2 = getX(index);
                    const y2 = getY(currentScore);
                    
                    const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                    const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
                    
                    return (
                      <Pressable
                        key={`line-${index}`}
                        style={{
                          position: 'absolute',
                          left: x1,
                          top: y1,
                          width: length,
                          height: isSelected ? 3 : 2,
                          backgroundColor: color,
                          transform: [{ rotate: `${angle}deg` }],
                          transformOrigin: 'left center',
                          opacity: lineOpacity
                        }}
                        onPress={(e) => {
                          e.stopPropagation();
                          handleUserSelect(userId);
                          setTooltip(null);
                        }}
                      />
                    );
                  })}
                  
                  {/* Data points - smaller size */}
                  {scores.map((point, index) => {
                    const normalizedScore = normalizeScore(point.score);
                    const x = getX(index);
                    const y = getY(normalizedScore);
                    
                    // Smaller point size: 8px (was 12px), selected: 10px
                    const pointSize = isSelected ? 7 : 5;
                    const pointOffset = pointSize / 2;
                    
                    return (
                      <Pressable
                        key={`point-${index}`}
                        style={{
                          position: 'absolute',
                          left: x - pointOffset,
                          top: y - pointOffset,
                          width: pointSize,
                          height: pointSize,
                          borderRadius: pointSize / 2,
                          backgroundColor: color,
                          borderWidth: 1.5,
                          borderColor: '#fff',
                          zIndex: isSelected ? 20 : 10,
                          opacity: pointOpacity
                        }}
                        onPress={(e) => {
                          e.stopPropagation();
                          handlePointClick('user', point.date, normalizedScore, x, y, userId);
                        }}
                      />
                    );
                  })}
                </View>
              );
            })}
            
            {/* Average Line */}
            <View>
              {/* Average line segments */}
              {dailyAverages.map((point, index) => {
                if (index === 0) return null;
                
                const prevAvg = dailyAverages[index - 1].average;
                const currentAvg = point.average;
                
                const x1 = getX(index - 1);
                const y1 = getY(prevAvg);
                const x2 = getX(index);
                const y2 = getY(currentAvg);
                
                const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
                const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
                
                return (
                  <View
                    key={`avg-line-${index}`}
                    style={{
                      position: 'absolute',
                      left: x1,
                      top: y1,
                      width: length,
                      height: 2,
                      backgroundColor: averageLineColor,
                      transform: [{ rotate: `${angle}deg` }],
                      transformOrigin: 'left center',
                      zIndex: 5
                    }}
                  />
                );
              })}
              
              {/* Average data points - smaller size */}
              {dailyAverages.map((point, index) => {
                const x = getX(index);
                const y = getY(point.average);
                
                // Smaller average point: 10px (was 14px)
                const pointSize = 7;
                const pointOffset = pointSize / 2;
                
                return (
                  <Pressable
                    key={`avg-point-${index}`}
                    style={{
                      position: 'absolute',
                      left: x - pointOffset,
                      top: y - pointOffset,
                      width: pointSize,
                      height: pointSize,
                      borderRadius: pointSize / 2,
                      backgroundColor: averageLineColor,
                      borderWidth: 1.5,
                      borderColor: '#fff',
                      zIndex: 15
                    }}
                    onPress={(e) => {
                      e.stopPropagation();
                      handlePointClick('average', point.date, point.average, x, y);
                    }}
                  />
                );
              })}
            </View>
            
            {/* Tooltip */}
            {tooltip && (
              <View
                style={{
                  position: 'absolute',
                  left: Math.min(Math.max(tooltip.x - 75, 10), containerWidth - 160),
                  top: tooltip.y - 45,
                  backgroundColor: tooltip.type === 'average' ? averageLineColor : '#333',
                  paddingVertical: 6,
                  paddingHorizontal: 10,
                  borderRadius: 6,
                  zIndex: 100,
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.25,
                  shadowRadius: 3,
                  elevation: 5,
                  minWidth: 150,
                  alignItems: 'center'
                }}
              >
                {tooltip.type === 'average' ? (
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                    Average Sleep Score ({formatDate(tooltip.date)}): {tooltip.score}
                  </Text>
                ) : (
                  <Text style={{ color: '#fff', fontSize: 12, fontWeight: 'bold' }}>
                    {allUsers.find(u => u.id === tooltip.userId)?.displayName || tooltip.userId} ({formatDate(tooltip.date)}): {tooltip.score}
                  </Text>
                )}
                {/* Tooltip arrow */}
                <View
                  style={{
                    position: 'absolute',
                    bottom: -6,
                    left: '50%',
                    marginLeft: -6,
                    width: 0,
                    height: 0,
                    borderLeftWidth: 6,
                    borderRightWidth: 6,
                    borderTopWidth: 6,
                    borderLeftColor: 'transparent',
                    borderRightColor: 'transparent',
                    borderTopColor: tooltip.type === 'average' ? averageLineColor : '#333',
                  }}
                />
              </View>
            )}
            
            {/* X-axis labels */}
            <View style={{ position: 'absolute', top: padding.top + plotHeight + 8, left: padding.left, width: plotWidth, flexDirection: 'row', justifyContent: 'space-between' }}>
              {dates.map((date, index) => (
                <Text 
                  key={index}
                  style={{ 
                    fontSize: 10, 
                    color: '#666',
                    textAlign: 'center',
                    position: 'absolute',
                    left: dates.length > 1 ? (plotWidth / (dates.length - 1)) * index - 15 : 0,
                    width: 30
                  }}
                >
                  {formatDate(date)}
                </Text>
              ))}
            </View>
          </Pressable>
          
          {/* Legend */}
          <View style={{ marginTop: 16, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 12 }}>
            {/* Average legend item */}
            <View 
              style={{ 
                flexDirection: 'row', 
                alignItems: 'center', 
                paddingVertical: 4,
                paddingHorizontal: 8,
                backgroundColor: '#FFF0F0',
                borderRadius: 4,
                borderWidth: 1,
                borderColor: averageLineColor
              }}
            >
              <View style={{ 
                width: 10, 
                height: 10, 
                borderRadius: 5, 
                backgroundColor: averageLineColor, 
                marginRight: 6 
              }} />
              <Text style={{ 
                fontSize: 11, 
                color: averageLineColor, 
                fontWeight: 'bold' 
              }}>
                Average
              </Text>
            </View>
            
            {/* Individual user legend items */}
            {Array.from(sleepData.keys()).map((userId, index) => {
              const user = allUsers.find(u => u.id === userId);
              const color = colors[index % colors.length];
              const isSelected = selectedUserId === userId;
              const hasSelection = selectedUserId !== null;
              
              return (
                <Pressable 
                  key={userId}
                  onPress={() => {
                    handleUserSelect(userId);
                    setTooltip(null);
                  }}
                  style={{ 
                    flexDirection: 'row', 
                    alignItems: 'center', 
                    opacity: hasSelection ? (isSelected ? 1 : 0.3) : 1,
                    paddingVertical: 4,
                    paddingHorizontal: 8,
                    backgroundColor: isSelected ? '#F0F0F0' : 'transparent',
                    borderRadius: 4
                  }}
                >
                  <View style={{ 
                    width: 10, 
                    height: 10, 
                    borderRadius: 5, 
                    backgroundColor: color, 
                    marginRight: 4 
                  }} />
                  <Text style={{ 
                    fontSize: 11, 
                    color: '#000', 
                    fontWeight: isSelected ? 'bold' : 'normal' 
                  }}>
                    {user?.displayName || userId}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    </View>
  );
};
