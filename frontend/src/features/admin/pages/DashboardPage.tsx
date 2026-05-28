/**
 * @file DashboardPage.tsx
 * @layer Page
 * @feature admin
 * @description Dashboard với Bento variety + Hero KPI mesh + Wow #2/#6 (spec §4 + §21.2)
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, useReducedMotion } from 'framer-motion';
import {
  DollarSign,
  ShoppingBag,
  Users,
  Calculator,
  XCircle,
  AlertTriangle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';
import { ROUTES, buildRoute } from '@/routes/paths';
import { formatPrice, formatNumber, formatDate } from '@/utils/format';
import { proxyImg } from '@/utils/proxy-img';
import { cn } from '@/utils/cn';
import {
  useGetDashboardStatsQuery,
  useGetLowStockAnalyticsQuery,
} from '../api/admin-dashboard-api';
import { useGetAdminOrdersQuery } from '../api/admin-order-api';
import DashboardCharts from '../components/DashboardCharts';
import FlipNumber from '../components/FlipNumber';

const easeOutQuart = [0.22, 1, 0.36, 1] as const;

// Stagger cho Bento KPI grid (spec §11.2)
const gridStagger = {
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};
const gridItem = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOutQuart } },
};

// Map admin order status → token color cho status pill (spec §5.2)
const STATUS_TOKEN: Record<string, { bg: string; text: string; border: string }> = {
  pending: {
    bg: 'bg-[var(--admin-warning)]/12',
    text: 'text-[var(--admin-warning)]',
    border: 'border-[var(--admin-warning)]/25',
  },
  processing: {
    bg: 'bg-[var(--admin-info)]/12',
    text: 'text-[var(--admin-info)]',
    border: 'border-[var(--admin-info)]/25',
  },
  shipped: {
    bg: 'bg-[var(--admin-purple)]/12',
    text: 'text-[var(--admin-purple)]',
    border: 'border-[var(--admin-purple)]/25',
  },
  delivered: {
    bg: 'bg-[var(--admin-success)]/12',
    text: 'text-[var(--admin-success)]',
    border: 'border-[var(--admin-success)]/25',
  },
  cancelled: {
    bg: 'bg-[var(--admin-error)]/12',
    text: 'text-[var(--admin-error)]',
    border: 'border-[var(--admin-error)]/25',
  },
};

/** Status pill — spec §5 (px-2 py-0.5 text-[11px] rounded-full) */
function StatusPill({ status, label }: { status: string; label: string }) {
  const cfg = STATUS_TOKEN[status] ?? STATUS_TOKEN.processing;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border',
        cfg.bg,
        cfg.text,
        cfg.border,
      )}
    >
      <span
        className="w-1.5 h-1.5 rounded-full"
        style={{ background: 'currentColor' }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

/** Growth pill — green nếu tăng, coral nếu giảm */
function GrowthPill({ value }: { value: number }) {
  const { t } = useTranslation();
  const isPositive = value >= 0;
  const abs = Math.abs(value).toFixed(1);
  const cfg = isPositive
    ? {
        bg: 'bg-[var(--admin-success)]/12',
        text: 'text-[var(--admin-success)]',
        border: 'border-[var(--admin-success)]/25',
      }
    : {
        bg: 'bg-[var(--admin-error)]/12',
        text: 'text-[var(--admin-error)]',
        border: 'border-[var(--admin-error)]/25',
      };
  const Arrow = isPositive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium border tabular-nums',
        cfg.bg,
        cfg.text,
        cfg.border,
      )}
      title={t('admin.dashboard.stats.fromLastMonth')}
    >
      <Arrow className="w-3 h-3" strokeWidth={2.5} />
      {abs}%
    </span>
  );
}

/** KPI card wrapper với hover lift (Wow #6 — spec §21.3 — đơn giản hóa: chỉ lift, không 3D tilt) */
function KpiCard({
  children,
  className,
  to,
}: {
  children: React.ReactNode;
  className?: string;
  to?: string;
}) {
  const baseClass = cn(
    'relative overflow-hidden rounded-2xl p-5 bg-[var(--bg-base)] border border-[var(--border-default)]',
    'shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200',
    'dark:bg-white/[0.03] dark:border-white/8',
    className,
  );
  if (to) {
    return (
      <Link to={to} className={cn(baseClass, 'block')}>
        {children}
      </Link>
    );
  }
  return <div className={baseClass}>{children}</div>;
}

const DashboardPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const shouldReduce = useReducedMotion();

  const {
    data: dashboardData,
    isLoading: isDashboardLoading,
    isError: isDashboardError,
  } = useGetDashboardStatsQuery();

  const { data: ordersData, isLoading: isOrdersLoading } = useGetAdminOrdersQuery({
    page: 1,
    limit: 5,
  });

  const { data: lowStockData } = useGetLowStockAnalyticsQuery({ threshold: 10 });

  // ===== Loading state =====
  if (isDashboardLoading) {
    return (
      <div>
        <div className="mb-6">
          <span className="section-number">01 / TỔNG QUAN</span>
          <div className="h-9 w-64 mt-2 shimmer rounded-lg" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
          {[...Array(8)].map((_, idx) => (
            <div
              key={idx}
              className={cn('shimmer rounded-2xl h-32', idx === 0 && 'xl:col-span-2 xl:row-span-2')}
            />
          ))}
        </div>
      </div>
    );
  }

  // ===== Error state =====
  if (isDashboardError) {
    return (
      <div>
        <div className="mb-6">
          <span className="section-number">01 / TỔNG QUAN</span>
          <h1 className="display-heading mt-2">{t('admin.dashboard.title')}</h1>
        </div>
        <div className="glass-card-lg p-10 text-center">
          <AlertCircle className="w-16 h-16 mx-auto mb-4 text-[var(--admin-error)]" />
          <h2 className="text-xl font-semibold mb-1">
            {t('admin.dashboard.errors.loadingDashboard')}
          </h2>
          <p className="text-sm text-[var(--text-secondary)]">
            {t('admin.dashboard.errors.failedToLoad')}
          </p>
        </div>
      </div>
    );
  }

  const stats = dashboardData?.data;
  const recentOrders = ordersData?.data.orders || [];
  const lowStockProducts = lowStockData?.data || [];

  const totalRevenue = stats?.overview.totalRevenue ?? 0;
  const totalOrders = stats?.overview.totalOrders ?? 0;
  const totalUsers = stats?.overview.totalUsers ?? 0;
  const totalProducts = stats?.overview.totalProducts ?? 0;
  const aov = stats?.overview.aov ?? 0;
  const cancelled = stats?.overview.cancelledOrdersMonth ?? 0;
  const lowStockCount = stats?.overview.lowStockCount ?? 0;
  const pendingCount = stats?.overview.ordersByStatus?.pending ?? 0;
  const growthRevenue = stats?.growth.revenue ?? 0;
  const growthOrders = stats?.growth.orders ?? 0;
  const growthUsers = stats?.growth.users ?? 0;

  return (
    <div>
      {/* Page header — spec §16.1 */}
      <div className="flex items-end justify-between flex-wrap gap-3 mb-6">
        <div>
          <span className="section-number">01 / TỔNG QUAN</span>
          <h1 className="display-heading mt-2">{t('admin.dashboard.title')}</h1>
        </div>
        <div className="text-xs text-[var(--text-tertiary)]">
          {t('admin.dashboard.lastUpdated')}:{' '}
          <span className="text-[var(--text-secondary)] font-medium">
            {new Date().toLocaleString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}
          </span>
        </div>
      </div>

      {/* Bento Grid — spec §4 — Variety 4 types */}
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-6"
        variants={gridStagger}
        initial="initial"
        animate="animate"
      >
        {/* HERO Revenue — col-span-2 row-span-2 với mesh gradient + FlipNumber + sparkline */}
        <motion.div variants={gridItem} className="xl:col-span-2 xl:row-span-2">
          <KpiCard className="h-full min-h-[200px] xl:min-h-[280px]">
            {/* Mesh gradient background (spec §21.2) */}
            {!shouldReduce && (
              <motion.div
                className="absolute inset-0 -z-10 opacity-60"
                style={{
                  background: `
                    radial-gradient(circle at 20% 30%, rgba(42, 172, 167, 0.18) 0%, transparent 45%),
                    radial-gradient(circle at 85% 70%, rgba(255, 117, 94, 0.12) 0%, transparent 50%),
                    radial-gradient(circle at 50% 50%, rgba(82, 196, 26, 0.08) 0%, transparent 60%)
                  `,
                }}
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 60, ease: 'linear', repeat: Infinity }}
              />
            )}
            <div className="relative">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-10 h-10 rounded-xl bg-[var(--accent)]/12 flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-[var(--accent)]" strokeWidth={2.25} />
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                      {t('admin.dashboard.stats.totalRevenue')}
                    </div>
                    <div className="text-[11px] text-[var(--text-tertiary)]">
                      {t('admin.dashboard.stats.fromLastMonth')}
                    </div>
                  </div>
                </div>
                <Sparkles className="w-4 h-4 text-[var(--accent)]/40" aria-hidden="true" />
              </div>

              <div className="flex items-baseline gap-3 flex-wrap mb-4">
                <FlipNumber
                  value={totalRevenue}
                  suffix={t('common.currencySymbol')}
                  className="text-3xl xl:text-4xl font-bold text-[var(--text-primary)]"
                />
                <GrowthPill value={growthRevenue} />
              </div>

              {/* Pulse dot indicator — spec §21.2 */}
              <div className="flex items-center gap-2 mt-2">
                <span className="relative flex w-2 h-2">
                  {!shouldReduce && (
                    <span className="absolute inset-0 rounded-full bg-[var(--accent)] opacity-60 animate-ping" />
                  )}
                  <span className="relative w-2 h-2 rounded-full bg-[var(--accent)]" />
                </span>
                <span className="text-xs text-[var(--text-tertiary)]">
                  {t('admin.dashboard.stats.activeProducts')}: {formatNumber(totalProducts)}
                </span>
              </div>
            </div>
          </KpiCard>
        </motion.div>

        {/* KPI Orders — pattern 1: number + sparkline-style growth */}
        <motion.div variants={gridItem}>
          <KpiCard>
            <div className="flex items-start justify-between mb-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                {t('admin.dashboard.stats.totalOrders')}
              </div>
              <div className="w-8 h-8 rounded-lg bg-[var(--admin-info)]/12 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-[var(--admin-info)]" strokeWidth={2.25} />
              </div>
            </div>
            <FlipNumber
              value={totalOrders}
              className="text-2xl font-bold text-[var(--text-primary)]"
            />
            <div className="mt-2">
              <GrowthPill value={growthOrders} />
            </div>
          </KpiCard>
        </motion.div>

        {/* KPI Users — pattern 2: number + avatar-like dot */}
        <motion.div variants={gridItem}>
          <KpiCard>
            <div className="flex items-start justify-between mb-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                {t('admin.dashboard.stats.totalUsers')}
              </div>
              <div className="w-8 h-8 rounded-lg bg-[var(--admin-success)]/12 flex items-center justify-center">
                <Users className="w-4 h-4 text-[var(--admin-success)]" strokeWidth={2.25} />
              </div>
            </div>
            <FlipNumber
              value={totalUsers}
              className="text-2xl font-bold text-[var(--text-primary)]"
            />
            <div className="mt-2">
              <GrowthPill value={growthUsers} />
            </div>
          </KpiCard>
        </motion.div>

        {/* KPI AOV — pattern 3: currency + subtitle */}
        <motion.div variants={gridItem}>
          <KpiCard>
            <div className="flex items-start justify-between mb-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                {t('admin.dashboard.stats.aov')}
              </div>
              <div className="w-8 h-8 rounded-lg bg-[var(--admin-purple)]/12 flex items-center justify-center">
                <Calculator className="w-4 h-4 text-[var(--admin-purple)]" strokeWidth={2.25} />
              </div>
            </div>
            <div className="text-2xl font-bold text-[var(--text-primary)] tabular-nums">
              {formatPrice(aov)}
            </div>
            <div className="text-xs text-[var(--text-tertiary)] mt-2">
              {t('admin.dashboard.stats.averageOrderValue')}
            </div>
          </KpiCard>
        </motion.div>

        {/* KPI Cancelled — pattern 4: number + alert */}
        <motion.div variants={gridItem}>
          <KpiCard>
            <div className="flex items-start justify-between mb-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                {t('admin.dashboard.stats.cancelledThisMonth')}
              </div>
              <div className="w-8 h-8 rounded-lg bg-[var(--admin-error)]/12 flex items-center justify-center">
                <XCircle className="w-4 h-4 text-[var(--admin-error)]" strokeWidth={2.25} />
              </div>
            </div>
            <FlipNumber
              value={cancelled}
              className="text-2xl font-bold text-[var(--text-primary)]"
            />
            <div className="text-xs text-[var(--text-tertiary)] mt-2">
              {t('admin.dashboard.stats.ordersThisMonth')}
            </div>
          </KpiCard>
        </motion.div>

        {/* KPI LowStock — pattern variety: linked card */}
        <motion.div variants={gridItem}>
          <KpiCard to="#low-stock-widget">
            <div className="flex items-start justify-between mb-2">
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                {t('admin.dashboard.stats.lowStock')}
              </div>
              <div className="w-8 h-8 rounded-lg bg-[var(--admin-warning)]/12 flex items-center justify-center relative">
                <AlertTriangle className="w-4 h-4 text-[var(--admin-warning)]" strokeWidth={2.25} />
                {lowStockCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-3 h-3 bg-[var(--admin-error)] text-white text-[9px] rounded-full flex items-center justify-center font-bold">
                    !
                  </span>
                )}
              </div>
            </div>
            <FlipNumber
              value={lowStockCount}
              className="text-2xl font-bold text-[var(--text-primary)]"
            />
            <div className="text-xs text-[var(--text-tertiary)] mt-2">
              {t('admin.dashboard.stats.productsLowStock')}
            </div>
          </KpiCard>
        </motion.div>
      </motion.div>

      {/* Pending alert banner */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 mb-6 px-4 py-3 rounded-xl bg-[var(--admin-warning)]/10 border border-[var(--admin-warning)]/30">
          <AlertTriangle
            className="w-5 h-5 text-[var(--admin-warning)] flex-shrink-0"
            strokeWidth={2.25}
          />
          <span className="flex-1 text-sm text-[var(--text-primary)] font-medium">
            {t('admin.dashboard.alerts.pendingOrders', { count: pendingCount })}
          </span>
          <Link
            to={buildRoute.adminOrdersPending()}
            className="text-sm font-medium text-[var(--admin-warning)] hover:underline whitespace-nowrap"
          >
            {t('admin.dashboard.alerts.viewOrders')} →
          </Link>
        </div>
      )}

      {/* Charts — DashboardCharts component */}
      <DashboardCharts />

      {/* Recent orders + Top products */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        {/* Recent orders table */}
        <div className="rounded-2xl bg-[var(--bg-base)] dark:bg-white/[0.03] border border-[var(--border-default)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
            <h2 className="text-base font-semibold">
              {t('admin.dashboard.sections.recentOrders')}
            </h2>
            <Link
              to={ROUTES.ADMIN_ORDERS}
              className="text-xs font-medium text-[var(--accent)] hover:underline"
            >
              {t('admin.dashboard.sections.viewAll')} →
            </Link>
          </div>
          <div className="overflow-x-auto">
            {isOrdersLoading ? (
              <div className="p-5 space-y-3">
                {[...Array(5)].map((_, idx) => (
                  <div key={idx} className="shimmer h-12 rounded-lg" />
                ))}
              </div>
            ) : recentOrders.length > 0 ? (
              <table className="w-full text-sm">
                <thead className="bg-white/[0.02] dark:bg-white/[0.02]">
                  <tr>
                    <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-4 py-3">
                      {t('admin.dashboard.table.order')}
                    </th>
                    <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-4 py-3">
                      {t('admin.dashboard.table.customer')}
                    </th>
                    <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-4 py-3">
                      {t('admin.dashboard.table.date')}
                    </th>
                    <th className="text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-4 py-3">
                      {t('admin.dashboard.table.total')}
                    </th>
                    <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-4 py-3">
                      {t('admin.dashboard.table.status')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-t border-[var(--border-default)] hover:bg-white/[0.03] transition"
                    >
                      <td className="px-4 py-3 font-medium text-[var(--text-primary)] whitespace-nowrap">
                        #{order.number}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap">
                        {order.shippingFirstName} {order.shippingLastName}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap tabular-nums">
                        {formatDate(order.createdAt, { dateStyle: 'short' })}
                      </td>
                      <td className="px-4 py-3 text-[var(--text-primary)] whitespace-nowrap tabular-nums text-right font-medium">
                        {formatPrice(order.total)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusPill
                          status={order.status}
                          label={t(`admin.dashboard.orderStatus.${order.status}`)}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="p-8 text-center text-sm text-[var(--text-tertiary)]">
                {t('admin.dashboard.table.noRecentOrders')}
              </div>
            )}
          </div>
        </div>

        {/* Top products */}
        <div className="rounded-2xl bg-[var(--bg-base)] dark:bg-white/[0.03] border border-[var(--border-default)] overflow-hidden">
          <div className="px-5 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
            <h2 className="text-base font-semibold">{t('admin.dashboard.sections.topProducts')}</h2>
            <Link
              to={ROUTES.ADMIN_PRODUCTS}
              className="text-xs font-medium text-[var(--accent)] hover:underline"
            >
              {t('admin.dashboard.sections.viewAll')} →
            </Link>
          </div>
          <div className="p-5">
            {stats?.topProducts && stats.topProducts.length > 0 ? (
              <div className="space-y-3">
                {stats.topProducts.slice(0, 5).map((item, index) => (
                  <div key={item.product.id ?? index} className="flex items-center gap-3">
                    <span className="flex-shrink-0 w-6 h-6 rounded-md bg-[var(--accent)]/10 flex items-center justify-center text-xs font-semibold text-[var(--accent)] tabular-nums">
                      {index + 1}
                    </span>
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg overflow-hidden bg-[var(--bg-surface)]">
                      {item.product.images?.[0] ? (
                        <img
                          src={item.product.images[0]}
                          alt={item.product.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-xs text-[var(--text-tertiary)]">
                          {(item.product.name || '?').charAt(0)}
                        </div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                        {item.product.name}
                      </p>
                      <div className="flex items-center gap-3 mt-0.5 text-xs">
                        <span className="text-[var(--text-tertiary)] tabular-nums">
                          {formatNumber(item.totalSold)} {t('admin.dashboard.table.sold')}
                        </span>
                        <span className="text-[var(--admin-success)] tabular-nums font-medium">
                          {formatPrice(item.totalRevenue)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center text-sm text-[var(--text-tertiary)] py-6">
                {t('admin.dashboard.table.noProductData')}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Low Stock Widget */}
      {lowStockProducts.length > 0 && (
        <div
          id="low-stock-widget"
          className="mt-6 rounded-2xl bg-[var(--bg-base)] dark:bg-white/[0.03] border border-[var(--border-default)] overflow-hidden"
        >
          <div className="px-5 py-4 border-b border-[var(--border-default)] flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-[var(--admin-warning)]" strokeWidth={2.25} />
            <h2 className="text-base font-semibold">{t('admin.dashboard.lowStock.title')}</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.02]">
                <tr>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-4 py-3">
                    {t('admin.dashboard.lowStock.product')}
                  </th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-4 py-3">
                    {t('admin.dashboard.lowStock.sku')}
                  </th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-4 py-3">
                    {t('admin.dashboard.lowStock.stock')}
                  </th>
                  <th className="text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] px-4 py-3">
                    {t('admin.dashboard.lowStock.action')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {lowStockProducts.map((product) => {
                  const isOut = product.stockQuantity === 0;
                  return (
                    <tr
                      key={product.id}
                      className={cn(
                        'border-t border-[var(--border-default)] hover:bg-white/[0.03] transition',
                        isOut && 'bg-[var(--admin-error)]/5',
                        !isOut && 'bg-[var(--admin-warning)]/5',
                      )}
                    >
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          {product.thumbnail ? (
                            <img
                              src={proxyImg(product.thumbnail)}
                              alt={product.name}
                              className="w-8 h-8 rounded-md object-cover"
                            />
                          ) : (
                            <div className="w-8 h-8 rounded-md bg-[var(--bg-surface)] flex items-center justify-center text-xs text-[var(--text-tertiary)]">
                              {(product.name || '?').charAt(0)}
                            </div>
                          )}
                          <span className="font-medium text-[var(--text-primary)]">
                            {product.name}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-[var(--text-secondary)] whitespace-nowrap tabular-nums">
                        {product.sku || '—'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <StatusPill
                          status={isOut ? 'cancelled' : 'pending'}
                          label={String(product.stockQuantity)}
                        />
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <Link
                          to={buildRoute.adminProductEdit(product.id)}
                          className="text-xs font-medium text-[var(--accent)] hover:underline"
                        >
                          {t('admin.dashboard.lowStock.edit')}
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;
