import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetDetailedStatsQuery } from '@/services/adminDashboardApi';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import dayjs from 'dayjs';

const DashboardCharts: React.FC = () => {
  const { t, i18n } = useTranslation();
  
  // States for filters
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [groupBy, setGroupBy] = useState<'hour' | 'day' | 'week' | 'month'>('day');

  // Calculate dates based on period
  const getDates = () => {
    const end = dayjs();
    let start = dayjs();
    
    if (period === '7d') start = end.subtract(7, 'day');
    else if (period === '30d') start = end.subtract(30, 'day');
    else if (period === '90d') start = end.subtract(90, 'day');

    return {
      startDate: start.format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
    };
  };

  const { startDate, endDate } = getDates();

  const { data, isLoading, isError } = useGetDetailedStatsQuery({
    startDate,
    endDate,
    groupBy,
  });

  const formatCurrency = (amount: number) => {
    const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
    const currency = i18n.language === 'vi' ? 'VND' : 'USD';
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currency,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const formatPeriodLabel = (label: string) => {
    if (!label) return '';
    if (groupBy === 'day') {
      return dayjs(label).format('DD/MM');
    }
    return label;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {[...Array(2)].map((_, index) => (
          <div key={index} className="bg-white dark:bg-neutral-800 rounded-lg p-6 shadow-sm border border-neutral-200 dark:border-neutral-700 animate-pulse h-80 flex items-center justify-center">
            <div className="text-neutral-400">Đang tải dữ liệu...</div>
          </div>
        ))}
      </div>
    );
  }

  if (isError || !data?.data) {
    return null; // Fail silently or display simple empty state
  }

  const { orders = [], users = [] } = data.data;

  // Combine or format data if necessary for shared axis:
  const orderDataForChart = orders.map((o) => ({
    name: formatPeriodLabel(o.period),
    Revenue: o.revenue,
    Orders: o.orderCount,
  }));

  return (
    <div className="space-y-6 mb-8">
      {/* Filters Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white dark:bg-neutral-800 p-4 rounded-lg border border-neutral-200 dark:border-neutral-700">
        <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
          Biểu đồ Thống kê
        </h2>
        
        <div className="flex items-center gap-2">
          {/* Period Selector */}
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as any)}
            className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-sm rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-neutral-800 dark:text-neutral-100"
          >
            <option value="7d">7 ngày qua</option>
            <option value="30d">30 ngày qua</option>
            <option value="90d">90 ngày qua</option>
          </select>

          {/* GroupBy Selector */}
          <select
            value={groupBy}
            onChange={(e) => setGroupBy(e.target.value as any)}
            className="px-3 py-1.5 border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-sm rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 text-neutral-800 dark:text-neutral-100"
          >
            <option value="day">Theo ngày</option>
            <option value="week">Theo tuần</option>
            <option value="month">Theo tháng</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 shadow-sm border border-neutral-200 dark:border-neutral-700">
          <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-4">
            Doanh thu {period === '7d' ? '7 ngày' : period === '30d' ? '30 ngày' : '90 ngày'} (Trạng thái: Delivered)
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={orderDataForChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-700" />
                <XAxis dataKey="name" className="text-xs text-neutral-500 fill-neutral-500" />
                <YAxis 
                  tickFormatter={(v) => v >= 1000000 ? `${v/1000000}M` : v >= 1000 ? `${v/1000}K` : v}
                  className="text-xs text-neutral-500 fill-neutral-500" 
                />
                <Tooltip 
                  formatter={(value: any) => formatCurrency(value)}
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    borderColor: '#e5e7eb',
                    borderRadius: '0.375rem',
                    color: '#1f2937'
                  }} 
                />
                <Area type="monotone" dataKey="Revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRevenue)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Orders Count Chart */}
        <div className="bg-white dark:bg-neutral-800 rounded-lg p-6 shadow-sm border border-neutral-200 dark:border-neutral-700">
          <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400 mb-4">
            Số lượng Đơn hàng
          </h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={orderDataForChart} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-neutral-200 dark:stroke-neutral-700"  />
                <XAxis dataKey="name" className="text-xs text-neutral-500 fill-neutral-500" />
                <YAxis allowDecimals={false} className="text-xs text-neutral-500 fill-neutral-500" />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'rgba(255, 255, 255, 0.95)', 
                    borderColor: '#e5e7eb',
                    borderRadius: '0.375rem',
                    color: '#1f2937'
                  }} 
                />
                <Bar dataKey="Orders" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardCharts;
