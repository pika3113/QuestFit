"use dom";

import React, { useEffect, useState } from 'react';
import { formatCompactNumber } from '@/src/utils/numberFormat';

// Client-only load to avoid SSR "window is not defined".
// We intentionally avoid React.lazy here to prevent an additional JS chunk fetch
// when switching to the Cadets tab.
let ApexChart: any = null;
if (typeof window !== 'undefined') {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    ApexChart = require('react-apexcharts').default;
  } catch {
    ApexChart = null;
  }
}

interface SparklineProps {
  data: Array<number | null>;
  labels?: string[];
  color: string;
  height?: number;
  type?: 'line' | 'bar' | 'area' | 'scatter';
  compactNumbers?: boolean;
  noDataText?: string;
}

export default function Sparkline({ data, labels, color, height = 100, type = 'line', compactNumbers, noDataText = 'No data' }: SparklineProps) {
  const [isMounted, setIsMounted] = useState(false);

  const isReactNativeOrExpoUserAgent = (() => {
    // This file is a DOM component; avoid importing `react-native` here.
    if (typeof navigator === 'undefined' || typeof navigator.userAgent !== 'string') return false;
    return /Expo|ReactNative/i.test(navigator.userAgent);
  })();

  // Prefer explicit caller intent (native StudentCard passes this), fallback to UA detection.
  const shouldCompactNumbers = compactNumbers ?? isReactNativeOrExpoUserAgent;

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const dataLen = Array.isArray(data) ? data.length : 0;
  const isLineOrArea = type === 'line' || type === 'area';

  const formatCompact = (value: number) => {
    const sign = value < 0 ? '-' : '';
    const abs = Math.abs(value);

    // Avoid awkward "1000k" at the boundary.
    if (abs >= 999_500) {
      return `${sign}1.0M`;
    }

    if (abs >= 1_000_000) {
      const m = abs / 1_000_000;
      // Keep labels short; only show one decimal for single-digit millions.
      const text = m < 10 ? m.toFixed(1) : Math.round(m).toString();
      return `${sign}${text}M`;
    }

    // Thousands: keep some precision for small thousands, but stay compact.
    const k = abs / 1_000;
    const text = k < 10 ? k.toFixed(1) : Math.round(k).toString();
    return `${sign}${text}k`;
  };

  const finiteData = Array.isArray(data) ? data.filter((v): v is number => typeof v === 'number' && Number.isFinite(v)) : [];
  const maxVal = finiteData.length ? Math.max(...finiteData) : 0;
  // Keep a small amount of headroom so bars/lines don't touch the top.
  const headroomPct = 0;
  const yMax = maxVal > 0 ? Math.ceil(maxVal * (1 + headroomPct)) : undefined;

  const hasNumericPoint = finiteData.length > 0;
  const isAllZeros = hasNumericPoint && finiteData.every((v) => v === 0);
  const missingIdx: number[] = Array.isArray(data)
    ? data
        .map((v, i) => (v == null || (typeof v === 'number' && !Number.isFinite(v)) ? i : -1))
        .filter((i) => i >= 0)
    : [];

  const missingSeriesData: Array<number | null> = (() => {
    if (!labels || labels.length === 0 || dataLen === 0) return [];
    const arr: Array<number | null> = new Array(dataLen).fill(null);
    for (const i of missingIdx) {
      if (i >= 0 && i < arr.length) arr[i] = 0;
    }
    return arr;
  })();

  const series: any[] = [
    {
      name: 'Value',
      type,
      data,
    },
  ];

  if (missingSeriesData.length > 0 && missingIdx.length > 0) {
    series.push({
      name: 'Missing',
      type: 'scatter',
      data: missingSeriesData,
    });
  }

  const options: any = {
    chart: {
      type: type,
      sparkline: {
        enabled: !labels // Disable sparkline mode if labels are provided to show axes
      },
      zoom: {
        enabled: false,
      },
      selection: {
        enabled: false,
      },
      animations: {
        enabled: false
      },
      toolbar: {
        show: false
      },
      parentHeightOffset: 0,
    },
    stroke: {
      curve: 'smooth',
      width: type === 'bar' ? 0 : 3,
      colors: [color]
    },
    fill: {
      opacity: type === 'area' ? 0.3 : 1
    },
    plotOptions: {
      bar: {
        borderRadius: 4,
        columnWidth: '60%',
        dataLabels: {
          position: 'center',
        },
      }
    },
    dataLabels: {
      enabled: true,
      formatter: (val: number, opts: any) => {
        const seriesIndex = typeof opts?.seriesIndex === 'number' ? opts.seriesIndex : 0;

        // Secondary series: label missing points.
        if (seriesIndex === 1) {
          if (typeof val !== 'number' || !Number.isFinite(val)) return '';
          return noDataText;
        }

        if (typeof val !== 'number' || !Number.isFinite(val)) return '';

        // Mobile: keep labels compact so they don't crowd the plot.
        if (shouldCompactNumbers && Math.abs(val) >= 1_000) {
          return formatCompactNumber(val);
        }

        // Bars get crowded on longer ranges; abbreviate big values to fit inside bars.
        if (type === 'bar' && dataLen >= 20 && Math.abs(val) >= 1_000) {
          return formatCompact(val);
        }

        return Math.round(val).toLocaleString();
      },
      style: {
        colors: ['#2D3436'],
        fontSize: '12px',
        fontWeight: 700,
      },
      textAnchor: 'middle',
      offsetX: 0,
      // Bars: nudge slightly down to center. Lines/areas/scatter: pull slightly above the point.
      offsetY: type === 'bar' ? -8 : (isLineOrArea ? -8 : -10),
      background: {
        // Disable the floating "bubble" for non-bar charts (it can render without text
        // depending on theme/defaults). Bars remain readable without this background.
        enabled: false,
      },
      dropShadow: {
        enabled: type !== 'bar',
        top: 1,
        left: 0,
        blur: 1,
        color: '#FFFFFF',
        opacity: 0.9,
      },
    },
    markers: {
      size: [type === 'scatter' ? 5 : (type === 'line' || type === 'area' ? 3 : 0), 1],
      colors: [color, 'rgba(0,0,0,0)'],
      strokeColors: '#fff',
      strokeWidth: 2,
    },
    grid: {
      show: !!labels,
      padding: {
        left: labels ? 24 : 10,
        right: labels ? 24 : 10,
        // Give x-axis labels room so they don't collide with the plot (especially for line/area).
        bottom: labels ? (isLineOrArea ? 18 : 10) : 0,
        // Give data labels a little headroom at the top.
        top: isLineOrArea ? 8 : 0
      },
      xaxis: {
        lines: {
          show: false
        }
      },
      yaxis: {
        lines: {
          show: false
        }
      }
    },
    xaxis: {
      categories: labels || [],
      labels: {
        show: !!labels,
        offsetX: 0,
        offsetY: labels ? 8 : 0,
        style: {
          fontSize: '10px',
          colors: '#999'
        }
      },
      axisBorder: {
        show: false
      },
      axisTicks: {
        show: false
      },
      tooltip: {
        enabled: false
      }
    },
    yaxis: {
      show: false,
      min: 0,
      max: yMax,
    },
    tooltip: {
      fixed: {
        enabled: false
      },
      x: {
        show: !!labels
      },
      y: {
        formatter: (val: number) => {
          if (typeof val !== 'number' || !Number.isFinite(val)) return '';
          if (shouldCompactNumbers && Math.abs(val) >= 1_000) return formatCompactNumber(val);
          return Math.round(val).toLocaleString();
        },
        title: {
          formatter: () => ''
        }
      },
      marker: {
        show: false
      }
    },
    colors: [color]
  };

  return (
    <div style={{ width: '100%', height: `${height}px`, touchAction: 'pan-y', position: 'relative' }}>
      {hasNumericPoint ? (
        (isAllZeros ? (
          <div
            style={{
              width: '100%',
              height: `${height}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              fontWeight: 800,
              color: '#636E72',
              userSelect: 'none',
            }}
          >
            0
          </div>
        ) : (
          (isMounted && ApexChart ? (
            <ApexChart options={options} series={series} type={type} height={height} width="100%" />
          ) : (
            <div />
          ))
        ))
      ) : (
        <div
          style={{
            width: '100%',
            height: `${height}px`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            fontWeight: 700,
            color: '#636E72',
            userSelect: 'none',
          }}
        >
          {noDataText}
        </div>
      )}
    </div>
  );
}
