import React from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import { Text } from '@/components/Themed';
import { formatDateDdMmYyyy } from '@/src/utils/dateFormat';
import { formatCompactNumber } from '@/src/utils/numberFormat';

interface DailyStepsBarChartProps {
  chartData: { name: string; steps: number }[];
  date?: Date;
}

export const DailyStepsBarChart = ({ chartData, date }: DailyStepsBarChartProps) => {
  const { width: windowWidth } = useWindowDimensions();
  const compactNumbers = Platform.OS !== 'web' || windowWidth <= 420;

  const maxSteps = Math.max(...chartData.map(d => d.steps), 1);
  const axisMax = maxSteps + 400;
  const yAxisSteps = 5;
  const yAxisValues = Array.from({ length: yAxisSteps + 1 }, (_, i) => 
    Math.round((axisMax / yAxisSteps) * i)
  );
  
  const isToday = (d: Date) => {
    const today = new Date();
    return d.getDate() === today.getDate() &&
      d.getMonth() === today.getMonth() &&
      d.getFullYear() === today.getFullYear();
  };

  const title = (date && !isToday(date))
    ? `Steps by User - ${formatDateDdMmYyyy(date)}`
    : "Today's Steps by User";

  const formatValue = (value: number) => {
    if (compactNumbers && Math.abs(value) >= 1000) return formatCompactNumber(value);
    return Math.round(value).toLocaleString();
  };

  return (
    <View style={{ padding: 16, backgroundColor: 'white', marginBottom: 20, borderRadius: 8 }}>
      <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, color: '#000' }}>
        {title}
      </Text>
      <View style={{ flexDirection: 'row' }}>
        {/* Y-axis */}
        <View style={{ width: 50, justifyContent: 'space-between', height: 200, paddingRight: 8 }}>
          {yAxisValues.reverse().map((value, index) => (
            <Text key={index} style={{ fontSize: 10, color: '#666', textAlign: 'right' }}>
              {formatValue(value)}
            </Text>
          ))}
        </View>
        
        {/* Chart area */}
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', alignItems: 'flex-end', height: 200, borderLeftWidth: 1, borderBottomWidth: 1, borderColor: '#E0E0E0', paddingLeft: 8 }}>
            {chartData.map((item, index) => {
              const barHeight = (item.steps / axisMax) * 200;
              return (
                <View key={index} style={{ alignItems: 'center', flex: 1, marginHorizontal: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: 'bold', marginBottom: 4, color: '#000' }}>
                    {formatValue(item.steps)}
                  </Text>
                  <View 
                    style={{ 
                      width: '100%',
                      maxWidth: 40,
                      height: Math.max(barHeight, 5),
                      backgroundColor: '#4ECDC4',
                      borderRadius: 4,
                    }} 
                  />
                </View>
              );
            })}
          </View>
          
          {/* X-axis labels */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 8, paddingLeft: 8 }}>
            {chartData.map((item, index) => (
              <Text 
                key={index}
                style={{ 
                  fontSize: 10, 
                  color: '#666',
                  textAlign: 'center',
                  flex: 1,
                  marginHorizontal: 4
                }}
                numberOfLines={2}
              >
                {item.name}
              </Text>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};
