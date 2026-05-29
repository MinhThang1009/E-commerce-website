/**
 * @file StatusPill.tsx
 * @layer Component
 * @feature admin
 * @description Status pill dùng chung cho admin tables — spec §5
 */
import React from 'react';
import { cn } from '@/utils/cn';

export type StatusVariant =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'purple'
  | 'neutral';

const VARIANT_TOKEN: Record<StatusVariant, { bg: string; text: string; border: string }> = {
  pending: {
    bg: 'bg-[var(--color-warning)]/12',
    text: 'text-[var(--color-warning)]',
    border: 'border-[var(--color-warning)]/25',
  },
  processing: {
    bg: 'bg-[var(--color-info)]/12',
    text: 'text-[var(--color-info)]',
    border: 'border-[var(--color-info)]/25',
  },
  shipped: {
    bg: 'bg-[var(--color-violet)]/12',
    text: 'text-[var(--color-violet)]',
    border: 'border-[var(--color-violet)]/25',
  },
  delivered: {
    bg: 'bg-[var(--color-success)]/12',
    text: 'text-[var(--color-success)]',
    border: 'border-[var(--color-success)]/25',
  },
  cancelled: {
    bg: 'bg-[var(--color-danger)]/12',
    text: 'text-[var(--color-danger)]',
    border: 'border-[var(--color-danger)]/25',
  },
  success: {
    bg: 'bg-[var(--color-success)]/12',
    text: 'text-[var(--color-success)]',
    border: 'border-[var(--color-success)]/25',
  },
  warning: {
    bg: 'bg-[var(--color-warning)]/12',
    text: 'text-[var(--color-warning)]',
    border: 'border-[var(--color-warning)]/25',
  },
  error: {
    bg: 'bg-[var(--color-danger)]/12',
    text: 'text-[var(--color-danger)]',
    border: 'border-[var(--color-danger)]/25',
  },
  info: {
    bg: 'bg-[var(--color-info)]/12',
    text: 'text-[var(--color-info)]',
    border: 'border-[var(--color-info)]/25',
  },
  purple: {
    bg: 'bg-[var(--color-violet)]/12',
    text: 'text-[var(--color-violet)]',
    border: 'border-[var(--color-violet)]/25',
  },
  neutral: {
    bg: 'bg-[var(--text-tertiary)]/12',
    text: 'text-[var(--text-secondary)]',
    border: 'border-[var(--border-default)]',
  },
};

interface StatusPillProps {
  variant: StatusVariant;
  label: React.ReactNode;
  /** Hiển thị dot indicator bên trái (mặc định true) */
  showDot?: boolean;
  className?: string;
}

const StatusPill: React.FC<StatusPillProps> = ({ variant, label, showDot = true, className }) => {
  const cfg = VARIANT_TOKEN[variant];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border whitespace-nowrap',
        cfg.bg,
        cfg.text,
        cfg.border,
        className,
      )}
    >
      {showDot && (
        <span
          className="w-1.5 h-1.5 rounded-full"
          style={{ background: 'currentColor' }}
          aria-hidden="true"
        />
      )}
      {label}
    </span>
  );
};

export default StatusPill;
