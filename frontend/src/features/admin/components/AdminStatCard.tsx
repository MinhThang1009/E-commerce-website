/**
 * @file AdminStatCard.tsx
 * @layer Component
 * @feature admin
 * @description KPI card chuẩn dùng chung (spec §4.2) — icon chip + label + value count-up
 *              + trend pill tùy chọn. Đồng bộ look với Dashboard (admin-kpi-card),
 *              để Users/Inventory/Dashboard không còn lệch nhau.
 */
import React from 'react';
import { ArrowUpRight, ArrowDownRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/utils/cn';
import FlipNumber from './FlipNumber';

interface AdminStatCardProps {
  /** Nhãn KPI (uppercase) — vd "TỔNG NGƯỜI DÙNG" */
  label: string;
  /** Giá trị số — hiển thị count-up qua FlipNumber */
  value: number;
  /** Icon Lucide cho chip góc */
  icon: LucideIcon;
  /**
   * Tên CSS var màu accent (vd '--color-info'). Mặc định '--accent'.
   * Accent điều khiển: thanh trên cùng, nền icon chip, halo radial — KHÔNG hard-code hex.
   */
  accentVar?: string;
  /** % tăng trưởng — hiện trend pill (▲/▼) nếu truyền */
  trend?: number;
  /** Nhãn nhỏ cạnh trend pill — vd "so với kỳ trước" */
  trendLabel?: string;
  /** Prefix/suffix cho số (vd '₫', '%') */
  prefix?: string;
  suffix?: string;
  /** Locale format cho FlipNumber */
  locale?: 'vi-VN' | 'en-US';
  isLoading?: boolean;
  className?: string;
}

const AdminStatCard: React.FC<AdminStatCardProps> = ({
  label,
  value,
  icon: Icon,
  accentVar = '--accent',
  trend,
  trendLabel,
  prefix,
  suffix,
  locale,
  isLoading = false,
  className,
}) => {
  if (isLoading) {
    return <div className={cn('shimmer rounded-[1.25rem] h-[116px]', className)} />;
  }

  const accent = `var(${accentVar})`;
  const hasTrend = trend !== undefined;
  const isPositive = (trend ?? 0) >= 0;
  const TrendArrow = isPositive ? ArrowUpRight : ArrowDownRight;

  return (
    <div
      className={cn('admin-kpi-card admin-card-glow p-5', className)}
      style={{ '--kpi-accent': accent } as React.CSSProperties}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ backgroundColor: `color-mix(in srgb, ${accent} 12%, transparent)` }}
          >
            <Icon className="w-4.5 h-4.5" style={{ color: accent }} strokeWidth={2.25} />
          </div>
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] truncate">
            {label}
          </span>
        </div>
        {hasTrend && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold tabular-nums shrink-0',
              isPositive
                ? 'bg-[var(--color-success)]/12 text-[var(--color-success)]'
                : 'bg-[var(--color-danger)]/12 text-[var(--color-danger)]',
            )}
          >
            <TrendArrow className="w-3 h-3" strokeWidth={2.5} />
            {Math.abs(trend ?? 0).toFixed(1)}%
          </span>
        )}
      </div>
      <FlipNumber
        value={value}
        prefix={prefix}
        suffix={suffix}
        locale={locale}
        className="text-3xl font-bold text-[var(--text-primary)] tracking-tight"
      />
      {trendLabel && <p className="text-[11px] text-[var(--text-tertiary)] mt-1.5">{trendLabel}</p>}
    </div>
  );
};

export default AdminStatCard;
