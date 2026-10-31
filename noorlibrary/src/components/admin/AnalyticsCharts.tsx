'use client';

import React, { useMemo } from 'react';

interface ActivityItem {
  type: 'purchase' | 'download' | 'tip';
  title: string;
  amount: number;
  dateStr: string;
}

interface AnalyticsChartsProps {
  recentActivity: ActivityItem[];
}

export default function AnalyticsCharts({ recentActivity = [] }: AnalyticsChartsProps) {
  
  // ─── 1. Process Weekly Revenue Trend (Line Chart) ──────────────────────────
  const weeklyData = useMemo(() => {
    const days: Array<{ label: string; compareStr: string; amount: number }> = [];
    const now = new Date();
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      const shortDate = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const compareStr = d.toLocaleDateString();
      days.push({
        label: shortDate,
        compareStr,
        amount: 0
      });
    }

    recentActivity.forEach((act) => {
      let matchedDay = days.find(day => day.compareStr === act.dateStr);
      if (!matchedDay) {
        try {
          const actDateStr = new Date(act.dateStr).toLocaleDateString();
          matchedDay = days.find(day => day.compareStr === actDateStr);
        } catch (e) {
          // ignore
        }
      }

      if (matchedDay) {
        matchedDay.amount += act.amount;
      }
    });

    return days;
  }, [recentActivity]);

  // SVG Coordinates for Line Chart
  const lineChartPathData = useMemo(() => {
    const width = 500;
    const height = 150;
    const padding = 25;
    
    const maxAmount = Math.max(...weeklyData.map(d => d.amount), 10);
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const points = weeklyData.map((d, index) => {
      const x = padding + (index * (chartWidth / (weeklyData.length - 1)));
      const y = height - padding - ((d.amount / maxAmount) * chartHeight);
      return { x, y, amount: d.amount, label: d.label };
    });

    const linePath = points.map(p => `${p.x},${p.y}`).join(' ');
    
    const areaPath = points.length > 0 
      ? `M ${points[0].x},${height - padding} ` + points.map(p => `L ${p.x},${m(p.y)}`).join(' ') + ` L ${points[points.length - 1].x},${height - padding} Z`
      : '';

    function m(val: number) {
      return isNaN(val) ? height - padding : val;
    }

    return { points, linePath, areaPath, maxAmount };
  }, [weeklyData]);

  // ─── 2. Process Sales Distribution (Bar Chart) ─────────────────────────────
  const distributionData = useMemo(() => {
    let purchases = 0;
    let downloads = 0;
    let tips = 0;

    recentActivity.forEach((act) => {
      if (act.type === 'purchase') purchases += act.amount;
      else if (act.type === 'download') downloads += act.amount;
      else if (act.type === 'tip') tips += act.amount;
    });

    return [
      { label: 'Book Read Purchases', value: purchases, color: 'var(--accent-red)' },
      { label: 'PDF Downloads', value: downloads, color: 'var(--accent-gold)' },
      { label: 'Tips & Donations', value: tips, color: '#3b82f6' }
    ];
  }, [recentActivity]);

  const barChartData = useMemo(() => {
    const width = 500;
    const height = 150;
    const padding = 25;
    
    const maxVal = Math.max(...distributionData.map(d => d.value), 10);
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const barWidth = 60;
    const spacing = (chartWidth - barWidth * distributionData.length) / (distributionData.length + 1);

    const bars = distributionData.map((d, index) => {
      const x = padding + spacing + index * (barWidth + spacing);
      const h = (d.value / maxVal) * chartHeight;
      const y = height - padding - h;
      return {
        ...d,
        x,
        y: isNaN(y) ? height - padding : y,
        w: barWidth,
        h: isNaN(h) ? 0 : h,
      };
    });

    return { bars, maxVal };
  }, [distributionData]);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', margin: '2rem 0' }}>
      
      {/* ─── Line Chart: Weekly Revenue ─── */}
      <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <h3 style={{ fontFamily: 'Outfit', fontSize: '1.15rem', margin: 0, color: 'var(--text-primary)' }}>7-Day Revenue Trend</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>Daily earnings in NGN (₦)</p>
        </div>
        
        <div style={{ position: 'relative', width: '100%', height: '180px' }}>
          <svg viewBox="0 0 500 150" width="100%" height="100%" style={{ overflow: 'visible' }}>
            <defs>
              <linearGradient id="lineGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent-red)" stopOpacity="0.4" />
                <stop offset="100%" stopColor="var(--accent-red)" stopOpacity="0.0" />
              </linearGradient>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Grid Lines */}
            <line x1="25" y1="25" x2="475" y2="25" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="4 4" />
            <line x1="25" y1="75" x2="475" y2="75" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="4 4" />
            <line x1="25" y1="125" x2="475" y2="125" stroke="var(--border-color)" strokeWidth="0.5" />

            {/* Filled Area */}
            {lineChartPathData.areaPath && (
              <path d={lineChartPathData.areaPath} fill="url(#lineGrad)" />
            )}

            {/* Line Path */}
            {lineChartPathData.linePath && (
              <polyline
                fill="none"
                stroke="var(--accent-red)"
                strokeWidth="2.5"
                points={lineChartPathData.linePath}
                filter="url(#glow)"
              />
            )}

            {/* Points and Tooltips */}
            {lineChartPathData.points.map((p, idx) => (
              <g key={idx}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="4"
                  fill="var(--bg-secondary)"
                  stroke="var(--accent-red)"
                  strokeWidth="2"
                  style={{ cursor: 'pointer' }}
                />
                <text
                  x={p.x}
                  y={p.y - 10}
                  textAnchor="middle"
                  fill="var(--text-primary)"
                  fontSize="8"
                  fontWeight="bold"
                  style={{ opacity: p.amount > 0 ? 0.9 : 0.2 }}
                >
                  ₦{p.amount.toLocaleString()}
                </text>
                {/* X Axis Labels */}
                <text
                  x={p.x}
                  y="142"
                  textAnchor="middle"
                  fill="var(--text-muted)"
                  fontSize="8"
                  fontWeight="500"
                >
                  {p.label}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

      {/* ─── Bar Chart: Sales Distribution ─── */}
      <div className="glass-card" style={{ padding: '1.5rem', borderRadius: '16px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        <div>
          <h3 style={{ fontFamily: 'Outfit', fontSize: '1.15rem', margin: 0, color: 'var(--text-primary)' }}>Sales Distribution</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0.25rem 0 0 0' }}>Breakdown of recent earnings (₦)</p>
        </div>

        <div style={{ position: 'relative', width: '100%', height: '180px' }}>
          <svg viewBox="0 0 500 150" width="100%" height="100%" style={{ overflow: 'visible' }}>
            {/* Grid Lines */}
            <line x1="25" y1="25" x2="475" y2="25" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="4 4" />
            <line x1="25" y1="75" x2="475" y2="75" stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="4 4" />
            <line x1="25" y1="125" x2="475" y2="125" stroke="var(--border-color)" strokeWidth="0.5" />

            {/* Bars */}
            {barChartData.bars.map((bar, idx) => (
              <g key={idx}>
                <defs>
                  <linearGradient id={`barGrad-${idx}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={bar.color} stopOpacity="0.8" />
                    <stop offset="100%" stopColor={bar.color} stopOpacity="0.3" />
                  </linearGradient>
                </defs>
                
                <rect
                  x={bar.x}
                  y={bar.y}
                  width={bar.w}
                  height={Math.max(bar.h, 2)}
                  rx="4"
                  ry="4"
                  fill={`url(#barGrad-${idx})`}
                  stroke={bar.color}
                  strokeWidth="1"
                />

                <text
                  x={bar.x + bar.w / 2}
                  y={bar.y - 8}
                  textAnchor="middle"
                  fill="var(--text-primary)"
                  fontSize="8"
                  fontWeight="bold"
                >
                  ₦{bar.value.toLocaleString()}
                </text>

                <text
                  x={bar.x + bar.w / 2}
                  y="142"
                  textAnchor="middle"
                  fill="var(--text-muted)"
                  fontSize="8.5"
                  fontWeight="600"
                >
                  {idx === 0 ? 'Read Access' : idx === 1 ? 'Downloads' : 'Tips'}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>

    </div>
  );
}
