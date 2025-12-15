"use dom";

import React, { useEffect, useState } from 'react';

// Lazy load the chart to prevent SSR issues with 'window'
const Chart = React.lazy(() => import('react-apexcharts'));

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

  const finiteData = Array.isArray(data) ? data.filter((v) => typeof v === 'number' && Number.isFinite(v)) : [];
  const maxVal = finiteData.length ? Math.max(...finiteData) : 0;
  // Keep a small amount of headroom so bars/lines don't touch the top.
  const headroomPct = 0;
  const yMax = maxVal > 0 ? Math.ceil(maxVal * (1 + headroomPct)) : undefined;

  const options: ApexCharts.ApexOptions = {
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
      enabled: type === 'bar',
      formatter: (val: number) => {
        if (typeof val !== 'number' || !Number.isFinite(val) || val === 0) return '';
        return Math.round(val).toLocaleString();
      },
      style: {
        colors: ['#FFFFFF'],
        fontSize: '12px',
        fontWeight: 700,
      },
      textAnchor: 'middle',
      offsetX: 0,
      // Nudge slightly down to better center vertically in horizontal bars.
      offsetY: 2,
      dropShadow: {
        enabled: false,
      },
    },
    markers: {
      size: type === 'scatter' ? 5 : 0,
      colors: [color],
      strokeColors: '#fff',
      strokeWidth: 2,
    },
    grid: {
      show: !!labels,
      padding: {
        left: 10,
        right: 10,
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
      {isMounted && (
        <React.Suspense fallback={<div />}>
          <Chart
            options={options}
            series={series}
            type={type}
            height={height}
            width="100%"
          />
        </React.Suspense>
      )}
    </div>
  );
}
