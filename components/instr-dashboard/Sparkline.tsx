"use dom";

import React, { useEffect, useState } from 'react';

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
  data: number[];
  labels?: string[];
  color: string;
  height?: number;
  type?: 'line' | 'bar' | 'area' | 'scatter';
}

export default function Sparkline({ data, labels, color, height = 100, type = 'line' }: SparklineProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const series = [{
    name: "Value",
    data: data
  }];

  const dataLen = Array.isArray(data) ? data.length : 0;

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

  const finiteData = Array.isArray(data) ? data.filter((v) => typeof v === 'number' && Number.isFinite(v)) : [];
  const maxVal = finiteData.length ? Math.max(...finiteData) : 0;
  // Keep a small amount of headroom so bars/lines don't touch the top.
  const headroomPct = 0;
  const yMax = maxVal > 0 ? Math.ceil(maxVal * (1 + headroomPct)) : undefined;

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
      formatter: (val: number) => {
        if (typeof val !== 'number' || !Number.isFinite(val) || val === 0) return '';

        // Bars get crowded on longer ranges; abbreviate big values to fit inside bars.
        if (type === 'bar' && dataLen >= 20 && Math.abs(val) >= 1_000) {
          return formatCompact(val);
        }

        return Math.round(val).toLocaleString();
      },
      style: {
        colors: [type === 'bar' ? '#FFFFFF' : '#2D3436'],
        fontSize: '12px',
        fontWeight: 700,
      },
      textAnchor: 'middle',
      offsetX: 0,
      // Bars: nudge slightly down to center. Lines/areas/scatter: pull slightly above the point.
      offsetY: type === 'bar' ? 2 : -6,
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
      size: type === 'scatter' ? 5 : (type === 'line' || type === 'area' ? 3 : 0),
      colors: [color],
      strokeColors: '#fff',
      strokeWidth: 2,
    },
    grid: {
      show: !!labels,
      padding: {
        left: labels ? 24 : 10,
        right: labels ? 24 : 10,
        bottom: 0,
        top: 0
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
    <div style={{ width: '100%', height: `${height}px`, touchAction: 'pan-y' }}>
      {isMounted && ApexChart ? (
        <ApexChart options={options} series={series} type={type} height={height} width="100%" />
      ) : (
        <div />
      )}
    </div>
  );
}
