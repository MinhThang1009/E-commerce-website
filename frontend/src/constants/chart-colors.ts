/**
 * Màu sắc dùng cho Recharts charts.
 * Recharts dùng SVG attributes (không phải CSS), nên cần static hex values.
 * Khi thay đổi màu → update cả đây và --chart-* trong _tokens.scss.
 */
export const CHART_BLUE = '#3b82f6';
export const CHART_GREEN = '#10b981';
export const CHART_YELLOW = '#f59e0b';
export const CHART_RED = '#ef4444';
export const CHART_VIOLET = '#8b5cf6';
export const CHART_PINK = '#ec4899';
export const CHART_CYAN = '#06b6d4';
export const CHART_LIME = '#84cc16';

export const PIE_COLORS = [
  CHART_BLUE,
  CHART_GREEN,
  CHART_YELLOW,
  CHART_RED,
  CHART_VIOLET,
  CHART_PINK,
  CHART_CYAN,
  CHART_LIME,
] as const;

export const ORDER_STATUS_COLORS: Record<string, string> = {
  pending: CHART_YELLOW,
  processing: CHART_BLUE,
  shipped: CHART_VIOLET,
  delivered: CHART_GREEN,
  cancelled: CHART_RED,
};
