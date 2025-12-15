import React from 'react';
import { Platform, View } from 'react-native';
import { Text } from '@/components/Themed';
import Svg, { Path, Circle, Line } from 'react-native-svg';
import { formatDateDdMmYyyy } from '@/src/utils/dateFormat';
import { formatCompactNumber } from '@/src/utils/numberFormat';

interface DailyStepsLineChartProps {
  chartData: { name: string; steps: number }[];
  date?: Date;
}

export const DailyStepsLineChart = ({ chartData, date }: DailyStepsLineChartProps) => {
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
    if (Platform.OS !== 'web' && Math.abs(value) >= 1000) return formatCompactNumber(value);
    return Math.round(value).toLocaleString();
  };

  const chartHeight = 200;
  const padding = { top: 20, right: 10, bottom: 60, left: 35 };
  const [containerWidth, setContainerWidth] = React.useState(0);
  const plotWidth = containerWidth > 0 ? containerWidth - padding.left - padding.right : 300;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const getX = (index: number) => {
    if (chartData.length <= 1) return plotWidth / 2;
    return (plotWidth / (chartData.length - 1)) * index;
  };
  const getY = (value: number) => plotHeight - (value / axisMax) * plotHeight;

  // Construct path
  let pathD = '';
  chartData.forEach((item, index) => {
    const x = getX(index);
    const y = getY(item.steps);
    if (index === 0) pathD += `M ${x} ${y}`;
    else pathD += ` L ${x} ${y}`;
  });

  return (
    <View 
      style={{ padding: 16, backgroundColor: 'white', marginBottom: 20, borderRadius: 8 }}
      onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
    >
      <Text style={{ fontSize: 18, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, color: '#000' }}>
        {title}
      </Text>
      
      <View style={{ height: chartHeight, flexDirection: 'row' }}>
        {/* Y-axis */}
        <View style={{ width: padding.left, height: chartHeight, justifyContent: 'space-between', paddingRight: 8, paddingVertical: padding.top }}>
          {yAxisValues.reverse().map((val, i) => (
            <Text key={i} style={{ fontSize: 10, color: '#888', textAlign: 'right', position: 'absolute', top: padding.top + (plotHeight / yAxisSteps) * i - 6, right: 8, width: 40 }}>
              {formatValue(val)}
            </Text>
          ))}
        </View>

        {/* Chart Area */}
        <View style={{ flex: 1, height: chartHeight }}>
          <Svg height={chartHeight} width={plotWidth} style={{ overflow: 'visible' }}>
            {/* Grid Lines */}
            {yAxisValues.map((_, i) => (
              <Line
                key={`grid-${i}`}
                x1="0"
                y1={padding.top + (plotHeight / yAxisSteps) * i}
                x2={plotWidth}
                y2={padding.top + (plotHeight / yAxisSteps) * i}
                stroke="#f0f0f0"
                strokeWidth="1"
              />
            ))}

            {/* Line */}
            <Path
              d={pathD}
              stroke="#4ECDC4"
              strokeWidth="3"
              fill="none"
            />

            {/* Dots */}
            {chartData.map((item, index) => {
              const x = getX(index);
              const y = getY(item.steps);
              return (
                <Circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="4"
                  fill="#4ECDC4"
                  stroke="white"
                  strokeWidth="2"
                />
              );
            })}
          </Svg>

          {/* X-axis Labels */}
          <View style={{ 
            position: 'absolute',
            bottom: 0,
            left: 0,
            width: plotWidth,
            height: 60,
          }}>
            {chartData.map((item, index) => (
              <View 
                key={index}
                style={{
                  position: 'absolute',
                  left: getX(index),
                  bottom: 25,
                  width: 0,
                  alignItems: 'center',
                  overflow: 'visible'
                }}
              >
                <Text 
                  style={{ 
                    fontSize: 9, 
                    color: '#666', 
                    width: 80, 
                    textAlign: 'right', 
                    transform: [{ rotate: '-45deg' }, { translateX: -20 }]
                  }}
                  numberOfLines={1}
                >
                  {item.name}
                </Text>
              </View>
            ))}
          </View>
        </View>
      </View>
    </View>
  );
};
