/**
 * @file DashboardCharts.tsx
 * @layer Component
 * @feature admin
 * @description Charts dashboard với glass tooltip + hex constants (spec §6)
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import {
  Download,
  FileSpreadsheet,
  TrendingUp,
  BarChart3,
  PieChart as PieChartIcon,
  UserPlus,
  Trophy,
  Layers,
  CreditCard,
  type LucideIcon,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Label,
} from 'recharts';
import dayjs from 'dayjs';
import { useUiStore } from '@/stores/ui-store';
import { formatPrice } from '@/utils/format';
import { cn } from '@/utils/cn';
import {
  PIE_COLORS,
  ORDER_STATUS_COLORS,
  CHART_TEAL,
  CHART_TEAL_LIGHT,
  CHART_GREEN,
  CHART_VIOLET,
} from '@constants/chart-colors';
import {
  useGetDetailedStatsQuery,
  useGetOrderStatusAnalyticsQuery,
  useGetTopProductsAnalyticsQuery,
  useGetRevenueByCategoryAnalyticsQuery,
  useGetUserGrowthAnalyticsQuery,
  useGetPaymentMethodsAnalyticsQuery,
} from '../api/admin-dashboard-api';
import GlassTooltip from './GlassTooltip';
import { usePeriodComparison, type ComparePeriod } from '../hooks/usePeriodComparison';

// Axis tick color theo theme (constants — KHÔNG CSS var, vì Recharts SVG)
const AXIS_LIGHT = '#52525b';
const AXIS_DARK = '#a1a1aa';
const GRID_LIGHT = 'rgba(0,0,0,0.06)';
const GRID_DARK = 'rgba(255,255,255,0.06)';

/** Header chart: icon chip màu + tiêu đề — đồng bộ ngôn ngữ icon với KPI card */
const ChartCardTitle: React.FC<{ icon: LucideIcon; color: string; title: string }> = ({
  icon: Icon,
  color,
  title,
}) => (
  <div className="flex items-center gap-2 mb-4">
    <span
      className="inline-flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
      style={{ backgroundColor: `${color}22`, color }}
    >
      <Icon className="w-4 h-4" strokeWidth={2.25} />
    </span>
    <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text-secondary)]">
      {title}
    </h3>
  </div>
);

const DashboardCharts: React.FC = () => {
  const { t } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const isDark = theme === 'dark';
  const [searchParams, setSearchParams] = useSearchParams();

  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'custom'>(
    searchParams.get('from') && searchParams.get('to') ? 'custom' : '30d',
  );
  const [customFrom, setCustomFrom] = useState(searchParams.get('from') || '');
  const [customTo, setCustomTo] = useState(searchParams.get('to') || '');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [topProductMetric, setTopProductMetric] = useState<'revenue' | 'soldCount'>('revenue');
  const [comparePeriod, setComparePeriod] = useState<ComparePeriod>(null);

  const { startDate, endDate } = useMemo(() => {
    if (period === 'custom' && customFrom && customTo) {
      return { startDate: customFrom, endDate: customTo };
    }
    const end = dayjs();
    let start = dayjs();
    if (period === '7d') start = end.subtract(7, 'day');
    else if (period === '30d') start = end.subtract(30, 'day');
    else if (period === '90d') start = end.subtract(90, 'day');
    return {
      startDate: start.format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
    };
  }, [period, customFrom, customTo]);

  const handleCustomDateApply = () => {
    if (customFrom && customTo) {
      setPeriod('custom');
      setSearchParams({ from: customFrom, to: customTo });
    }
  };

  const handlePeriodChange = (newPeriod: '7d' | '30d' | '90d') => {
    setPeriod(newPeriod);
    setCustomFrom('');
    setCustomTo('');
    searchParams.delete('from');
    searchParams.delete('to');
    setSearchParams(searchParams);
  };

  const { data: detailedData, isLoading: isDetailedLoading } = useGetDetailedStatsQuery({
    startDate,
    endDate,
    groupBy,
  });
  const { data: orderStatusData } = useGetOrderStatusAnalyticsQuery({ startDate });
  const { data: topProductsData } = useGetTopProductsAnalyticsQuery({
    metric: topProductMetric,
    limit: 5,
  });
  const { data: categoryData } = useGetRevenueByCategoryAnalyticsQuery({ startDate, endDate });
  const { data: userGrowthData } = useGetUserGrowthAnalyticsQuery({ startDate, endDate, groupBy });
  const { data: paymentMethodsData } = useGetPaymentMethodsAnalyticsQuery();

  // Comparison Mode — ghost line kỳ trước (spec §21.5)
  const comparison = usePeriodComparison({ startDate, endDate, groupBy }, comparePeriod);

  const formatPeriodLabel = (label: string) => {
    if (!label) return '';
    if (groupBy === 'day') return dayjs(label).format('DD/MM');
    return label;
  };

  const revenueLabel = t('admin.charts.revenueLabel');
  const ordersLabel = t('admin.charts.ordersLabel');

  const orderDataForChart = useMemo(
    () =>
      (detailedData?.data?.orders ?? []).map((o) => ({
        name: formatPeriodLabel(o.period),
        revenue: o.revenue,
        orderCount: o.orderCount,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- formatPeriodLabel depends on groupBy already in deps
    [detailedData?.data?.orders, groupBy],
  );

  const tickStyle = {
    fill: isDark ? AXIS_DARK : AXIS_LIGHT,
    fontSize: 11,
  };
  const gridStroke = isDark ? GRID_DARK : GRID_LIGHT;
  // Teal brand cho single-series — luminous hơn trong dark để đủ tương phản
  const accent = isDark ? CHART_TEAL_LIGHT : CHART_TEAL;

  // Format axis numeric tick: 1500 → "1.5K", 1500000 → "1.5M"
  const compactNumber = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
    return String(v);
  };

  // Export CSV
  const handleExport = async (type: 'orders' | 'products') => {
    try {
      const params = new URLSearchParams({ type });
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      const { getValidToken } = await import('@/utils/token-manager');
      const token = await getValidToken();
      const baseUrl = import.meta.env.VITE_API_URL || '/api';
      const resp = await fetch(`${baseUrl}/admin/reports/export?${params.toString()}`, {
        headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        credentials: 'include',
      });
      if (!resp.ok) throw new Error('Export failed');
      const blob = await resp.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_${dayjs().format('YYYY-MM-DD')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      // Lỗi export — không crash UI
    }
  };

  // ===== Loading skeleton =====
  if (isDetailedLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {[...Array(2)].map((_, idx) => (
          <div key={idx} className="shimmer rounded-2xl h-80" />
        ))}
      </div>
    );
  }

  const cardClass = 'admin-chart-card admin-card-glow rounded-2xl p-5';

  return (
    <div className="space-y-4 mt-6">
      {/* Filter bar — glass styling */}
      <div
        className={cn(
          cardClass,
          'flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 flex-wrap',
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset buttons */}
          {(['7d', '30d', '90d'] as const).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => handlePeriodChange(p)}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors',
                period === p
                  ? 'bg-[var(--accent)]/12 border-[var(--accent)]/30 text-[var(--accent)]'
                  : 'bg-transparent border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-white/5',
              )}
            >
              {t(`admin.charts.last${p === '7d' ? '7Days' : p === '30d' ? '30Days' : '90Days'}`)}
            </button>
          ))}

          {/* Custom date range */}
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="px-2 py-1.5 text-xs rounded-lg bg-[var(--bg-base)] border border-[var(--border-default)] text-[var(--text-primary)] tabular-nums"
            />
            <span className="text-[var(--text-tertiary)]">—</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              className="px-2 py-1.5 text-xs rounded-lg bg-[var(--bg-base)] border border-[var(--border-default)] text-[var(--text-primary)] tabular-nums"
            />
            <button
              type="button"
              onClick={handleCustomDateApply}
              disabled={!customFrom || !customTo}
              className="admin-btn-primary px-3 py-1.5 text-xs font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {t('admin.charts.apply')}
            </button>
          </div>

          {/* Group by */}
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as 'day' | 'week' | 'month')}
            className="px-3 py-1.5 text-xs rounded-lg bg-[var(--bg-base)] border border-[var(--border-default)] text-[var(--text-primary)]"
          >
            <option value="day">{t('admin.charts.byDay')}</option>
            <option value="week">{t('admin.charts.byWeek')}</option>
            <option value="month">{t('admin.charts.byMonth')}</option>
          </select>
        </div>

        {/* Comparison toggle + Export buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Comparison Mode toggle — spec §21.5 Signature Feature */}
          <select
            value={comparePeriod ?? ''}
            onChange={(e) => setComparePeriod((e.target.value || null) as ComparePeriod)}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded-lg border transition',
              comparePeriod
                ? 'bg-[var(--admin-purple)]/12 border-[var(--admin-purple)]/30 text-[var(--admin-purple)]'
                : 'border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-white/5',
            )}
          >
            <option value="">{t('admin.comparison.off', { defaultValue: 'So sánh' })}</option>
            <option value="previous-week">
              {t('admin.comparison.previousWeek', { defaultValue: 'vs Tuần trước' })}
            </option>
            <option value="previous-month">
              {t('admin.comparison.previousMonth', { defaultValue: 'vs Tháng trước' })}
            </option>
            <option value="previous-year">
              {t('admin.comparison.previousYear', { defaultValue: 'vs Năm trước' })}
            </option>
          </select>

          <button
            type="button"
            onClick={() => handleExport('orders')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-white/5 transition"
          >
            <Download className="w-3.5 h-3.5" strokeWidth={2.25} />
            {t('admin.charts.exportOrders')}
          </button>
          <button
            type="button"
            onClick={() => handleExport('products')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-white/5 transition"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" strokeWidth={2.25} />
            {t('admin.charts.exportProducts')}
          </button>
        </div>
      </div>

      {/* Row 1: Revenue Area — full width (lấp đẹp, không để trống cột) */}
      <div className="mb-4">
        <div className={cardClass}>
          <ChartCardTitle
            icon={TrendingUp}
            color={accent}
            title={t('admin.charts.revenue', {
              period: t(
                `admin.charts.period${
                  period === '7d'
                    ? '7d'
                    : period === '30d'
                      ? '30d'
                      : period === '90d'
                        ? '90d'
                        : 'Custom'
                }`,
              ),
            })}
          />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={orderDataForChart}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={accent} stopOpacity={0.5} />
                    <stop offset="100%" stopColor={accent} stopOpacity={0.05} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridStroke} strokeDasharray="0" vertical={false} />
                <XAxis dataKey="name" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={compactNumber}
                  tick={tickStyle}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ stroke: accent, strokeDasharray: '4 4', opacity: 0.4 }}
                  content={
                    <GlassTooltip
                      formatter={(v) => formatPrice(Number(v))}
                      labelMap={{ revenue: revenueLabel }}
                    />
                  }
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  name={revenueLabel}
                  stroke={accent}
                  fillOpacity={1}
                  fill="url(#colorRevenue)"
                  strokeWidth={3}
                  dot={{ r: 4, fill: accent, stroke: isDark ? '#111' : '#fff', strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: accent }}
                />
                {/* Ghost line kỳ trước — Comparison Mode §21.5 */}
                {comparison.isComparing && comparison.previousOrders.length > 0 && (
                  <Line
                    type="monotone"
                    data={comparison.previousOrders.map((o, i) => ({
                      name: orderDataForChart[i]?.name ?? formatPeriodLabel(o.period),
                      prevRevenue: o.revenue,
                    }))}
                    dataKey="prevRevenue"
                    name={t('admin.comparison.previousPeriod', { defaultValue: 'Kỳ trước' })}
                    stroke={isDark ? '#a1a1aa' : '#71717a'}
                    strokeWidth={1.5}
                    strokeDasharray="6 3"
                    dot={false}
                    opacity={0.5}
                  />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 2: Order Status Pie + User Growth Line */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={cardClass}>
          <ChartCardTitle
            icon={PieChartIcon}
            color={accent}
            title={t('admin.charts.orderStatusDist')}
          />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={orderStatusData?.data || []}
                  dataKey="count"
                  nameKey="label"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  stroke={isDark ? '#111111' : '#ffffff'}
                  strokeWidth={2}
                  paddingAngle={2}
                >
                  {(orderStatusData?.data || []).map((entry) => (
                    <Cell
                      key={entry.status}
                      fill={ORDER_STATUS_COLORS[entry.status] || '#9ca3af'}
                    />
                  ))}
                  <Label
                    position="center"
                    content={({ viewBox }) => {
                      const vb = viewBox as { cx?: number; cy?: number } | undefined;
                      if (vb?.cx == null || vb?.cy == null) return null;
                      const total = (orderStatusData?.data || []).reduce(
                        (sum, d) => sum + (d.count ?? 0),
                        0,
                      );
                      return (
                        <text x={vb.cx} y={vb.cy} textAnchor="middle">
                          <tspan
                            x={vb.cx}
                            dy="-0.1em"
                            fontSize="26"
                            fontWeight="700"
                            fill={isDark ? '#fafafa' : '#09090b'}
                          >
                            {total}
                          </tspan>
                          <tspan
                            x={vb.cx}
                            dy="1.6em"
                            fontSize="11"
                            fill={isDark ? AXIS_DARK : AXIS_LIGHT}
                          >
                            {t('admin.charts.totalOrdersShort', { defaultValue: 'đơn' })}
                          </tspan>
                        </text>
                      );
                    }}
                  />
                </Pie>
                <Tooltip content={<GlassTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={cardClass}>
          <ChartCardTitle
            icon={UserPlus}
            color={CHART_VIOLET}
            title={t('admin.charts.userGrowth')}
          />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={(userGrowthData?.data || []).map((d) => ({
                  ...d,
                  date: formatPeriodLabel(d.date),
                }))}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid stroke={gridStroke} strokeDasharray="0" vertical={false} />
                <XAxis dataKey="date" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={tickStyle} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ stroke: CHART_VIOLET, strokeDasharray: '4 4', opacity: 0.4 }}
                  content={<GlassTooltip labelMap={{ newUsers: t('admin.charts.newUsers') }} />}
                />
                <Line
                  type="monotone"
                  dataKey="newUsers"
                  name={t('admin.charts.newUsers')}
                  stroke={CHART_VIOLET}
                  strokeWidth={2.5}
                  dot={{ r: 3, fill: CHART_VIOLET }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 3: Top Products Bar + Category Revenue Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={cardClass}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span
                className="inline-flex items-center justify-center w-7 h-7 rounded-lg flex-shrink-0"
                style={{ backgroundColor: `${accent}22`, color: accent }}
              >
                <Trophy className="w-4 h-4" strokeWidth={2.25} />
              </span>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                {t('admin.charts.topProducts')}
              </h3>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => setTopProductMetric('revenue')}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-medium rounded-md transition',
                  topProductMetric === 'revenue'
                    ? 'bg-[var(--accent)]/12 text-[var(--accent)]'
                    : 'text-[var(--text-tertiary)] hover:bg-white/5',
                )}
              >
                {t('admin.charts.byRevenue')}
              </button>
              <button
                type="button"
                onClick={() => setTopProductMetric('soldCount')}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-medium rounded-md transition',
                  topProductMetric === 'soldCount'
                    ? 'bg-[var(--accent)]/12 text-[var(--accent)]'
                    : 'text-[var(--text-tertiary)] hover:bg-white/5',
                )}
              >
                {t('admin.charts.bySoldCount')}
              </button>
            </div>
          </div>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(topProductsData?.data || []).map((p) => ({
                  name: p.name.length > 20 ? p.name.substring(0, 20) + '...' : p.name,
                  revenue: p.revenue,
                  soldCount: p.soldCount,
                }))}
                layout="vertical"
                margin={{ top: 5, right: 20, left: 80, bottom: 5 }}
              >
                <CartesianGrid stroke={gridStroke} strokeDasharray="0" horizontal={false} />
                <XAxis
                  type="number"
                  tick={tickStyle}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={topProductMetric === 'revenue' ? compactNumber : undefined}
                />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={tickStyle}
                  width={80}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(42, 172, 167, 0.08)' }}
                  content={
                    <GlassTooltip
                      formatter={
                        topProductMetric === 'revenue' ? (v) => formatPrice(Number(v)) : undefined
                      }
                      labelMap={{
                        revenue: t('admin.charts.revenueLabel'),
                        soldCount: t('admin.charts.soldCount'),
                      }}
                    />
                  }
                />
                <Bar
                  dataKey={topProductMetric}
                  name={
                    topProductMetric === 'revenue'
                      ? t('admin.charts.revenueLabel')
                      : t('admin.charts.soldCount')
                  }
                  fill={topProductMetric === 'revenue' ? accent : CHART_GREEN}
                  radius={[0, 6, 6, 0]}
                  maxBarSize={30}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={cardClass}>
          <ChartCardTitle
            icon={Layers}
            color={CHART_VIOLET}
            title={t('admin.charts.revenueByCategory')}
          />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={(categoryData?.data || []).map((c, i) => ({
                  name:
                    c.categoryName.length > 15
                      ? c.categoryName.substring(0, 15) + '...'
                      : c.categoryName,
                  revenue: c.revenue,
                  fill: PIE_COLORS[i % PIE_COLORS.length],
                }))}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid stroke={gridStroke} strokeDasharray="0" vertical={false} />
                <XAxis dataKey="name" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis
                  tickFormatter={compactNumber}
                  tick={tickStyle}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(139, 92, 246, 0.08)' }}
                  content={
                    <GlassTooltip
                      formatter={(v) => formatPrice(Number(v))}
                      labelMap={{ revenue: t('admin.charts.revenueLabel') }}
                    />
                  }
                />
                <Bar
                  dataKey="revenue"
                  name={t('admin.charts.revenueLabel')}
                  radius={[6, 6, 0, 0]}
                  maxBarSize={72}
                >
                  {(categoryData?.data || []).map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Row 4: Order Count (Bar) + Payment Methods (Pie) — 2 cột đều */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className={cardClass}>
          <ChartCardTitle
            icon={BarChart3}
            color={CHART_GREEN}
            title={t('admin.charts.orderCount')}
          />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={orderDataForChart}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorOrders" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={CHART_GREEN} stopOpacity={1} />
                    <stop offset="100%" stopColor={CHART_GREEN} stopOpacity={0.6} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridStroke} strokeDasharray="0" vertical={false} />
                <XAxis dataKey="name" tick={tickStyle} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={tickStyle} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }}
                  content={<GlassTooltip labelMap={{ orderCount: ordersLabel }} />}
                />
                <Bar
                  dataKey="orderCount"
                  name={ordersLabel}
                  fill="url(#colorOrders)"
                  radius={[8, 8, 0, 0]}
                  maxBarSize={64}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className={cardClass}>
          <ChartCardTitle
            icon={CreditCard}
            color={accent}
            title={t('admin.charts.paymentMethods')}
          />
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={(paymentMethodsData?.data || []).map((p) => ({
                    name: p.method,
                    value: p.count,
                    revenue: p.revenue,
                  }))}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={55}
                  outerRadius={95}
                  stroke={isDark ? '#111111' : '#ffffff'}
                  strokeWidth={2}
                  paddingAngle={2}
                >
                  {(paymentMethodsData?.data || []).map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<GlassTooltip />} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardCharts;
