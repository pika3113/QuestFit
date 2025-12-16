import React from 'react';
import { View } from 'react-native';
import { Text } from '@/components/Themed';

interface SleepScoreBarChartProps {
  sleepData: Map<string, Array<{date: string, score: number | null}>>;
  dates: string[];
  allUsers: {id: string, displayName: string}[];
}

export const SleepScoreBarChart = ({ 
  sleepData, 
  dates, 
  allUsers 
}: SleepScoreBarChartProps) => {
  
  const chartHeight = 300;
  const padding = { top: 25, right: 20, bottom: 40, left: 40 };
  const plotHeight = chartHeight - padding.top - padding.bottom;
  
  const maxScore = 100;
  const minScore = 0;
  const yAxisSteps = 5;
  const yAxisValues = Array.from({ length: yAxisSteps + 1 }, (_, i) => 
    minScore + (maxScore - minScore) / yAxisSteps * (yAxisSteps - i)
  );

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

  const getBarColor = (score: number) => {
    if (score >= 90) return '#4CAF50'; // Green
    if (score >= 70) return '#FFC107'; // Amber
    return '#F44336'; // Red
  };

  return (
    <View style={{ padding: 16, backgroundColor: 'white', marginBottom: 20, borderRadius: 8 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 24, color: '#000' }}>
        Average Sleep Score (Last 7 Days)
      </Text>
      
      <View style={{ height: chartHeight, flexDirection: 'row' }}>
        {/* Y-axis Labels */}
        <View style={{ width: padding.left, height: plotHeight + padding.top, justifyContent: 'space-between', paddingRight: 8, paddingTop: padding.top }}>
          {yAxisValues.map((val, i) => (
            <Text key={i} style={{ fontSize: 10, color: '#888', textAlign: 'right', height: 12, lineHeight: 12 }}>
              {Math.round(val)}
            </Text>
          ))}
        </View>

        {/* Chart Area */}
        <View style={{ flex: 1, height: chartHeight }}>
          {/* Grid Lines */}
          {yAxisValues.map((_, i) => (
            <View 
              key={`grid-${i}`}
              style={{ 
                position: 'absolute', 
                left: 0, 
                right: 0, 
                top: padding.top + (plotHeight / yAxisSteps) * i,
                height: 1,
                backgroundColor: '#f0f0f0',
                zIndex: 0
              }} 
            />
          ))}

          {/* Bars */}
          <View style={{ 
            flexDirection: 'row', 
            height: plotHeight, 
            marginTop: padding.top, 
            alignItems: 'flex-end',
            justifyContent: 'space-around',
            zIndex: 1
          }}>
            {dailyAverages.map((item, index) => {
              const barHeight = (item.average / maxScore) * plotHeight;
              return (
                <View key={index} style={{ alignItems: 'center', flex: 1 }}>
                  {/* Bar */}
                  <View style={{
                    width: 20,
                    height: barHeight,
                    backgroundColor: getBarColor(item.average),
                    borderTopLeftRadius: 4,
                    borderTopRightRadius: 4,
                  }} />
                  
                  {/* Value Label */}
                  {item.average > 0 && (
                    <Text style={{ position: 'absolute', top: -20, fontSize: 10, color: '#666' }}>
                      {item.average}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* X-axis Labels */}
          <View style={{ 
            flexDirection: 'row', 
            justifyContent: 'space-around', 
            marginTop: 8,
            paddingHorizontal: 0
          }}>
            {dates.map((date, index) => (
              <Text key={index} style={{ fontSize: 10, color: '#666', width: 30, textAlign: 'center' }}>
                {formatDate(date)}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};
