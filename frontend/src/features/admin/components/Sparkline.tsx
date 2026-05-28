/**
 * @file Sparkline.tsx
 * @layer Component
 * @feature admin
 * @description Mini line chart (SVG) cho KPI card — vẽ xu hướng từ chuỗi số THẬT.
 *              Token-driven màu accent. Data <2 điểm → hiện hint "cần thêm dữ liệu" (spec §6).
 */
import React, { useId } from 'react';
import { useTranslation } from 'react-i18next';

interface SparklineProps {
  /** Chuỗi giá trị theo thời gian (vd doanh thu mỗi ngày) */
  data: number[];
  /** Màu nét — mặc định var(--accent) */
  color?: string;
  height?: number;
  className?: string;
}

const VB_W = 100;
const VB_H = 32;

const Sparkline: React.FC<SparklineProps> = ({
  data,
  color = 'var(--accent)',
  height = 40,
  className,
}) => {
  const { t } = useTranslation();
  const gradId = useId();

  if (!data || data.length < 2) {
    return (
      <div
        className={className}
        style={{ height }}
        aria-label={t('admin.dashboard.sparkline.needMoreData', {
          defaultValue: 'Cần thêm dữ liệu',
        })}
      >
        <div className="flex h-full items-center">
          <div className="h-px w-full bg-[var(--border-default)]" />
        </div>
      </div>
    );
  }

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const n = data.length;
  const toX = (i: number) => (i / (n - 1)) * VB_W;
  const toY = (v: number) => VB_H - 1 - ((v - min) / range) * (VB_H - 2);

  const linePoints = data.map((v, i) => `${toX(i)},${toY(v)}`).join(' ');
  const areaPoints = `0,${VB_H} ${linePoints} ${VB_W},${VB_H}`;

  return (
    <svg
      viewBox={`0 0 ${VB_W} ${VB_H}`}
      preserveAspectRatio="none"
      width="100%"
      height={height}
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.28" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline
        points={linePoints}
        fill="none"
        stroke={color}
        strokeWidth={1.75}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
};

export default Sparkline;
