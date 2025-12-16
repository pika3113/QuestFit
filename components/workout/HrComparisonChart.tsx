import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import Svg, { Line, Path } from 'react-native-svg';

export type HrPoint = { tSec: number; hr: number };

type Props = {
  points: HrPoint[];
  baselineHr?: number | null;
  // Optional: bump this value to force a re-render (useful when parent is memoized).
  tick?: number;
  height?: number;
  stroke?: string;
  baselineStroke?: string;
};

const clamp = (n: number, min: number, max: number) => Math.max(min, Math.min(max, n));

export function HrComparisonChart({
  points,
  baselineHr,
  tick,
  height = 140,
  stroke = '#4ECDC4',
  baselineStroke = '#CC0000',
}: Props) {
  const [width, setWidth] = useState(0);

  const safePoints = useMemo(() => {
    const cleaned = points
      .filter((p) => Number.isFinite(p.tSec) && Number.isFinite(p.hr) && p.hr > 0)
      .map((p) => ({ tSec: Math.max(0, Math.round(p.tSec)), hr: Math.round(p.hr) }))
      .sort((a, b) => a.tSec - b.tSec);

    // De-dupe by timestamp (keep last)
    const byT = new Map<number, number>();
    for (const p of cleaned) byT.set(p.tSec, p.hr);
    return Array.from(byT.entries())
      .map(([tSec, hr]) => ({ tSec, hr }))
      .sort((a, b) => a.tSec - b.tSec);
  }, [points]);

  const { pathD, yBaseline, yMin, yMax, tMin, tMax } = useMemo(() => {
    if (safePoints.length === 0 || width <= 0) {
      return { pathD: '', yBaseline: null as number | null, yMin: 0, yMax: 1, tMin: 0, tMax: 1 };
    }

    const hrs = safePoints.map((p) => p.hr);
    const minHr = Math.min(...hrs);
    const maxHr = Math.max(...hrs);

    // Pad a bit so the line isn't glued to edges.
    const pad = Math.max(6, Math.round((maxHr - minHr) * 0.15));
    const yMinLocal = Math.max(40, minHr - pad);
    const yMaxLocal = Math.min(240, maxHr + pad);

    const tMinLocal = safePoints[0].tSec;
    const tMaxLocal = safePoints[safePoints.length - 1].tSec;
    const tSpan = Math.max(1, tMaxLocal - tMinLocal);

    const getX = (tSec: number) => {
      return (clamp(tSec, tMinLocal, tMaxLocal) - tMinLocal) / tSpan * width;
    };
    const getY = (hr: number) => {
      return height - (clamp(hr, yMinLocal, yMaxLocal) - yMinLocal) / Math.max(1, (yMaxLocal - yMinLocal)) * height;
    };

    let d = '';
    safePoints.forEach((p, idx) => {
      const x = getX(p.tSec);
      const y = getY(p.hr);
      d += idx === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    });

    const yBase = baselineHr != null && Number.isFinite(baselineHr) ? getY(baselineHr) : null;

    return { pathD: d, yBaseline: yBase, yMin: yMinLocal, yMax: yMaxLocal, tMin: tMinLocal, tMax: tMaxLocal };
  }, [safePoints, width, height, baselineHr]);

  const showEmpty = width > 0 && safePoints.length < 2;

  return (
    <View
      style={{ height, width: '100%' }}
      onLayout={(e) => setWidth(Math.max(0, Math.floor(e.nativeEvent.layout.width)))}
    >
      <Svg height={height} width={width || 1}>
        {/* Grid (3 horizontal lines) */}
        {[0.25, 0.5, 0.75].map((p) => (
          <Line
            key={p}
            x1={0}
            y1={height * p}
            x2={width || 1}
            y2={height * p}
            stroke="#ffffff22"
            strokeWidth={1}
          />
        ))}

        {/* Baseline */}
        {yBaseline != null && (
          <Line
            x1={0}
            y1={yBaseline}
            x2={width || 1}
            y2={yBaseline}
            stroke={baselineStroke}
            strokeWidth={2}
            strokeDasharray="6 6"
          />
        )}

        {/* Series */}
        {pathD ? (
          <Path d={pathD} stroke={stroke} strokeWidth={3} fill="none" />
        ) : null}

        {/* If only one point, draw a short line for visibility */}
        {showEmpty && safePoints.length === 1 && (
          <Line
            x1={0}
            y1={height / 2}
            x2={width || 1}
            y2={height / 2}
            stroke="#ffffff22"
            strokeWidth={1}
          />
        )}
      </Svg>
    </View>
  );
}
