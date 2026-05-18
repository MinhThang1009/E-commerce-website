/**
 * @file DashboardCharts.tsx
 * @layer Component
 * @feature admin
 * @description UI component cho feature admin
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useUiStore } from '@/stores/ui-store';
import {
  useGetDetailedStatsQuery,
  useGetOrderStatusAnalyticsQuery,
  useGetTopProductsAnalyticsQuery,
  useGetRevenueByCategoryAnalyticsQuery,
  useGetUserGrowthAnalyticsQuery,
  useGetPaymentMethodsAnalyticsQuery,
  useGetChatbotStatsQuery,
} from '../api/admin-dashboard-api';
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
} from 'recharts';
import dayjs from 'dayjs';

// Bảng màu cho Pie Charts
const PIE_COLORS = [
  '#3b82f6',
  '#10b981',
  '#f59e0b',
  '#ef4444',
  '#8b5cf6',
  '#ec4899',
  '#06b6d4',
  '#84cc16',
];
const STATUS_COLORS: Record<string, string> = {
  pending: '#f59e0b',
  processing: '#3b82f6',
  shipped: '#8b5cf6',
  delivered: '#10b981',
  cancelled: '#ef4444',
};

type TabType = 'overview' | 'chatbot';

const DashboardCharts: React.FC = () => {
  const { t, i18n } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const isDark = theme === 'dark';
  const [searchParams, setSearchParams] = useSearchParams();

  // Tab hiện tại: Overview hoặc AI Chatbot
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // State bộ lọc — đọc từ URL query params nếu có
  const [period, setPeriod] = useState<'7d' | '30d' | '90d' | 'custom'>(
    searchParams.get('from') && searchParams.get('to') ? 'custom' : '30d',
  );
  const [customFrom, setCustomFrom] = useState(searchParams.get('from') || '');
  const [customTo, setCustomTo] = useState(searchParams.get('to') || '');
  const [groupBy, setGroupBy] = useState<'day' | 'week' | 'month'>('day');
  const [topProductMetric, setTopProductMetric] = useState<'revenue' | 'soldCount'>('revenue');

  // Tính toán ngày dựa trên khoảng thời gian
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

  // Cập nhật URL khi chọn custom range
  const handleCustomDateApply = () => {
    if (customFrom && customTo) {
      setPeriod('custom');
      setSearchParams({ from: customFrom, to: customTo });
    }
  };

  // Reset về preset period
  const handlePeriodChange = (newPeriod: '7d' | '30d' | '90d') => {
    setPeriod(newPeriod);
    setCustomFrom('');
    setCustomTo('');
    searchParams.delete('from');
    searchParams.delete('to');
    setSearchParams(searchParams);
  };

  // Queries
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
  const { data: chatbotData } = useGetChatbotStatsQuery(
    activeTab === 'chatbot' ? { startDate, endDate } : undefined,
    { enabled: activeTab === 'chatbot' },
  );

  const formatCurrency = (amount: number) => {
    const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(amount);
  };

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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- formatPeriodLabel phụ thuộc vào groupBy đã có trong deps
    [detailedData?.data?.orders, groupBy],
  );

  // Tooltip style chung
  const tooltipStyle = {
    backgroundColor: isDark ? '#1e293b' : 'rgba(255,255,255,0.95)',
    borderColor: isDark ? '#334155' : '#e5e7eb',
    borderRadius: '0.375rem',
    color: isDark ? '#f1f5f9' : '#1f2937',
  };
  const tickStyle = { fill: isDark ? '#9ca3af' : '#6b7280', fontSize: 12 };

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

  // Render tab chatbot
  const renderChatbotTab = () => {
    const stats = chatbotData?.data;
    if (!stats)
      return (
        <div className="text-center py-12 text-neutral-500 dark:text-neutral-400">
          {t('common.loading')}
        </div>
      );

    const intentData = Object.entries(stats.intentBreakdown).map(([key, val], i) => ({
      name: key,
      value: val,
      fill: PIE_COLORS[i % PIE_COLORS.length],
    }));

    return (
      <div className="space-y-6">
        {/* KPI Cards chatbot */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              {t('admin.chatbot.totalSessions')}
            </div>
            <div className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mt-1">
              {stats.totalSessions}
            </div>
          </div>
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              {t('admin.chatbot.avgMessages')}
            </div>
            <div className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mt-1">
              {stats.avgMessagesPerSession}
            </div>
          </div>
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              {t('admin.chatbot.fallbackRate')}
            </div>
            <div className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mt-1">
              {(stats.fallbackRate * 100).toFixed(1)}%
            </div>
          </div>
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-4 border border-neutral-200 dark:border-neutral-700">
            <div className="text-sm text-neutral-500 dark:text-neutral-400">
              {t('admin.chatbot.avgResponseTime')}
            </div>
            <div className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mt-1">
              {stats.avgResponseTimeMs}ms
            </div>
          </div>
        </div>

        {/* Intent Breakdown pie chart */}
        {intentData.length > 0 && (
          <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 shadow-sm border border-neutral-200 dark:border-neutral-700">
            <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-4">
              {t('admin.chatbot.intentBreakdown')}
            </h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={intentData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label
                  >
                    {intentData.map((entry, idx) => (
                      <Cell key={idx} fill={entry.fill} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    );
  };

  if (isDetailedLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {[...Array(2)].map((_, index) => (
          <div
            key={index}
            className="bg-white dark:bg-neutral-800 rounded-lg p-6 shadow-sm border border-neutral-200 dark:border-neutral-700 animate-pulse h-80 flex items-center justify-center"
          >
            <div className="text-neutral-400">{t('common.loading')}</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 mb-8">
      {/* Header: tabs + bộ lọc thời gian + export */}
      <div className="flex flex-col gap-4 bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
        {/* Tabs */}
        <div className="flex items-center gap-4 border-b border-neutral-200 dark:border-neutral-700 pb-3">
          <button
            onClick={() => setActiveTab('overview')}
            className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700'
            }`}
          >
            {t('admin.charts.title')}
          </button>
          <button
            onClick={() => setActiveTab('chatbot')}
            className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
              activeTab === 'chatbot'
                ? 'border-primary-500 text-primary-600 dark:text-primary-400'
                : 'border-transparent text-neutral-500 dark:text-neutral-400 hover:text-neutral-700'
            }`}
          >
            {t('admin.chatbot.tab')}
          </button>
        </div>

        {/* Bộ lọc thời gian + export */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Preset buttons */}
            {(['7d', '30d', '90d'] as const).map((p) => (
              <button
                key={p}
                onClick={() => handlePeriodChange(p)}
                className={`px-3 py-1.5 text-sm rounded-md border transition-colors ${
                  period === p
                    ? 'bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300'
                    : 'bg-white dark:bg-neutral-700 border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-600'
                }`}
              >
                {t(`admin.charts.last${p === '7d' ? '7Days' : p === '30d' ? '30Days' : '90Days'}`)}
              </button>
            ))}

            {/* Custom date range */}
            <div className="flex items-center gap-1">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 rounded-md text-neutral-800 dark:text-neutral-100"
              />
              <span className="text-neutral-400">—</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 rounded-md text-neutral-800 dark:text-neutral-100"
              />
              <button
                onClick={handleCustomDateApply}
                disabled={!customFrom || !customTo}
                className="px-3 py-1.5 text-sm bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t('admin.charts.apply')}
              </button>
            </div>

            {/* Group by */}
            <select
              value={groupBy}
              onChange={(e) => setGroupBy(e.target.value as 'day' | 'week' | 'month')}
              className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-sm rounded-md text-neutral-800 dark:text-neutral-100"
            >
              <option value="day">{t('admin.charts.byDay')}</option>
              <option value="week">{t('admin.charts.byWeek')}</option>
              <option value="month">{t('admin.charts.byMonth')}</option>
            </select>
          </div>

          {/* Export buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={() => handleExport('orders')}
              className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {t('admin.charts.exportOrders')}
            </button>
            <button
              onClick={() => handleExport('products')}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-1"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              {t('admin.charts.exportProducts')}
            </button>
          </div>
        </div>
      </div>

      {/* Nội dung tab */}
      {activeTab === 'chatbot' ? (
        renderChatbotTab()
      ) : (
        <>
          {/* Hàng 1: Revenue Area + Order Count Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 shadow-sm border border-neutral-200 dark:border-neutral-700">
              <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-4">
                {t('admin.charts.revenue', {
                  period: t(
                    `admin.charts.period${period === '7d' ? '7d' : period === '30d' ? '30d' : period === '90d' ? '90d' : 'Custom'}`,
                  ),
                })}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={orderDataForChart}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-neutral-200 dark:stroke-neutral-700"
                    />
                    <XAxis dataKey="name" tick={tickStyle} />
                    <YAxis
                      tickFormatter={(v) =>
                        v >= 1000000 ? `${v / 1000000}M` : v >= 1000 ? `${v / 1000}K` : v
                      }
                      tick={tickStyle}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={tooltipStyle}
                    />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      name={revenueLabel}
                      stroke="#3b82f6"
                      fillOpacity={1}
                      fill="url(#colorRevenue)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 shadow-sm border border-neutral-200 dark:border-neutral-700">
              <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-4">
                {t('admin.charts.orderCount')}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={orderDataForChart}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-neutral-200 dark:stroke-neutral-700"
                    />
                    <XAxis dataKey="name" tick={tickStyle} />
                    <YAxis allowDecimals={false} tick={tickStyle} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Bar
                      dataKey="orderCount"
                      name={ordersLabel}
                      fill="#10b981"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Hàng 2: Order Status Pie + User Growth Line */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pie chart: Phân bổ trạng thái đơn hàng */}
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 shadow-sm border border-neutral-200 dark:border-neutral-700">
              <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-4">
                {t('admin.charts.orderStatusDist')}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={orderStatusData?.data || []}
                      dataKey="count"
                      nameKey="label"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ label, count }) => `${label}: ${count}`}
                    >
                      {(orderStatusData?.data || []).map((entry) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status] || '#9ca3af'} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Line chart: Tăng trưởng user */}
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 shadow-sm border border-neutral-200 dark:border-neutral-700">
              <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-4">
                {t('admin.charts.userGrowth')}
              </h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={(userGrowthData?.data || []).map((d) => ({
                      ...d,
                      date: formatPeriodLabel(d.date),
                    }))}
                    margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
                  >
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-neutral-200 dark:stroke-neutral-700"
                    />
                    <XAxis dataKey="date" tick={tickStyle} />
                    <YAxis allowDecimals={false} tick={tickStyle} />
                    <Tooltip contentStyle={tooltipStyle} />
                    <Line
                      type="monotone"
                      dataKey="newUsers"
                      name={t('admin.charts.newUsers')}
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Hàng 3: Top Products Bar + Category Revenue Bar */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Bar chart: Top sản phẩm */}
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 shadow-sm border border-neutral-200 dark:border-neutral-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  {t('admin.charts.topProducts')}
                </h3>
                <div className="flex gap-1">
                  <button
                    onClick={() => setTopProductMetric('revenue')}
                    className={`px-2 py-1 text-xs rounded ${topProductMetric === 'revenue' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}
                  >
                    {t('admin.charts.byRevenue')}
                  </button>
                  <button
                    onClick={() => setTopProductMetric('soldCount')}
                    className={`px-2 py-1 text-xs rounded ${topProductMetric === 'soldCount' ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300' : 'text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700'}`}
                  >
                    {t('admin.charts.bySoldCount')}
                  </button>
                </div>
              </div>
              <div className="h-64">
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
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-neutral-200 dark:stroke-neutral-700"
                    />
                    <XAxis
                      type="number"
                      tick={tickStyle}
                      tickFormatter={
                        topProductMetric === 'revenue'
                          ? (v) =>
                              v >= 1000000 ? `${v / 1000000}M` : v >= 1000 ? `${v / 1000}K` : `${v}`
                          : undefined
                      }
                    />
                    <YAxis dataKey="name" type="category" tick={tickStyle} width={80} />
                    <Tooltip
                      formatter={(value: number) =>
                        topProductMetric === 'revenue' ? formatCurrency(value) : value
                      }
                      contentStyle={tooltipStyle}
                    />
                    <Bar
                      dataKey={topProductMetric}
                      name={
                        topProductMetric === 'revenue'
                          ? t('admin.charts.revenueLabel')
                          : t('admin.charts.soldCount')
                      }
                      fill={topProductMetric === 'revenue' ? '#3b82f6' : '#10b981'}
                      radius={[0, 4, 4, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Bar chart: Doanh thu theo danh mục */}
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 shadow-sm border border-neutral-200 dark:border-neutral-700">
              <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-4">
                {t('admin.charts.revenueByCategory')}
              </h3>
              <div className="h-64">
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
                    <CartesianGrid
                      strokeDasharray="3 3"
                      className="stroke-neutral-200 dark:stroke-neutral-700"
                    />
                    <XAxis dataKey="name" tick={tickStyle} />
                    <YAxis
                      tickFormatter={(v) =>
                        v >= 1000000 ? `${v / 1000000}M` : v >= 1000 ? `${v / 1000}K` : `${v}`
                      }
                      tick={tickStyle}
                    />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      contentStyle={tooltipStyle}
                    />
                    <Bar
                      dataKey="revenue"
                      name={t('admin.charts.revenueLabel')}
                      radius={[4, 4, 0, 0]}
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

          {/* Hàng 4: Payment Methods Pie */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 shadow-sm border border-neutral-200 dark:border-neutral-700">
              <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-4">
                {t('admin.charts.paymentMethods')}
              </h3>
              <div className="h-64">
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
                      outerRadius={80}
                      label={({ name, value }) => `${name}: ${value}`}
                    >
                      {(paymentMethodsData?.data || []).map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={tooltipStyle} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default DashboardCharts;
