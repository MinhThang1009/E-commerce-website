/**
 * @file GlassTooltip.tsx
 * @layer Component
 * @feature admin
 * @description Custom Recharts tooltip với glass styling (spec §6.4)
 */
import React from 'react';

interface PayloadItem {
  name?: string;
  value?: number | string;
  color?: string;
  dataKey?: string | number;
}

interface GlassTooltipProps {
  /** Có đang hiển thị không — Recharts truyền */
  active?: boolean;
  /** Data point đang hover */
  payload?: PayloadItem[];
  /** Label trục X (period name) */
  label?: string;
  /** Format value — vd: formatPrice cho currency, formatNumber cho count */
  formatter?: (value: number | string) => string;
  /** Tên hiển thị cho mỗi series — fallback dataKey */
  labelMap?: Record<string, string>;
}

const GlassTooltip: React.FC<GlassTooltipProps> = ({
  active,
  payload,
  label,
  formatter,
  labelMap,
}) => {
  if (!active || !payload || payload.length === 0) return null;

  const renderValue = (value: number | string | undefined) => {
    if (value === undefined || value === null) return '—';
    if (formatter) return formatter(value);
    return String(value);
  };

  return (
    <div className="glass-card-sm px-3 py-2 shadow-lg border border-[var(--border-default)] min-w-[140px]">
      {label && (
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1.5">
          {label}
        </div>
      )}
      <div className="space-y-1">
        {payload.map((entry, index) => {
          const displayName =
            (entry.dataKey && labelMap?.[String(entry.dataKey)]) || entry.name || '';
          return (
            <div key={index} className="flex items-center justify-between gap-3 text-xs">
              {entry.color && (
                <span className="flex items-center gap-1.5 text-[var(--text-secondary)]">
                  <span className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
                  {displayName}
                </span>
              )}
              <span className="font-semibold text-[var(--text-primary)] tabular-nums">
                {renderValue(entry.value)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default GlassTooltip;
