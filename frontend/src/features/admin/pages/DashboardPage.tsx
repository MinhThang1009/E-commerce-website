/**
 * @file DashboardPage.tsx
 * @layer Page
 * @feature admin
 * @description Dashboard redesign — compact Bento layout theo NexaStore/Dashly reference
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  DollarSign,
  ShoppingBag,
  Users,
  AlertTriangle,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  Package,
  Eye,
  Clock,
  Truck,
  CheckCircle2,
  XCircle,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { ROUTES, buildRoute } from '@/routes/paths';
import { formatPrice, formatNumber } from '@/utils/format';
import { proxyImg } from '@/utils/proxy-img';
import { cn } from '@/utils/cn';
import {
  useGetDashboardStatsQuery,
  useGetLowStockAnalyticsQuery,
} from '../api/admin-dashboard-api';
import { useGetAdminOrdersQuery } from '../api/admin-order-api';
import DashboardCharts from '../components/DashboardCharts';
import FlipNumber from '../components/FlipNumber';
import StatusPill from '../components/StatusPill';

const easeOutQuart = [0.22, 1, 0.36, 1] as const;
const stagger = {
  animate: { transition: { staggerChildren: 0.06, delayChildren: 0.1 } },
};
const fadeUp = {
  initial: { opacity: 0, y: 16 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.35, ease: easeOutQuart } },
};

function GrowthPill({ value }: { value: number }) {
  const isPositive = value >= 0;
  const abs = Math.abs(value).toFixed(1);
  const Arrow = isPositive ? ArrowUpRight : ArrowDownRight;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-semibold tabular-nums',
        isPositive
          ? 'bg-[var(--admin-success)]/12 text-[var(--admin-success)]'
          : 'bg-[var(--admin-error)]/12 text-[var(--admin-error)]',
      )}
    >
      <Arrow className="w-3 h-3" strokeWidth={2.5} />
      {abs}%
    </span>
  );
}

const ORDER_STATUS_ICON: Record<string, { Icon: LucideIcon; color: string }> = {
  delivered: { Icon: CheckCircle2, color: 'var(--admin-success)' },
  cancelled: { Icon: XCircle, color: 'var(--admin-error)' },
  pending: { Icon: Clock, color: 'var(--admin-warning)' },
  processing: { Icon: RefreshCw, color: 'var(--admin-info)' },
  shipped: { Icon: Truck, color: 'var(--admin-purple)' },
};

function OrderStatusBadge({ status }: { status: string }) {
  const { Icon, color } = ORDER_STATUS_ICON[status] ?? {
    Icon: ShoppingBag,
    color: 'var(--text-tertiary)',
  };
  return (
    <div
      className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`, color }}
    >
      <Icon className="w-4 h-4" strokeWidth={2.25} />
    </div>
  );
}

const DashboardPage: React.FC = () => {
  const { t, i18n } = useTranslation();

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

  if (isDashboardLoading) {
    return (
      <div>
        <div className="mb-6">
          <span className="section-number">01 / TỔNG QUAN</span>
          <div className="h-9 w-64 mt-2 shimmer rounded-lg" />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="shimmer rounded-2xl h-52" />
          <div className="shimmer rounded-2xl h-52" />
          <div className="shimmer rounded-2xl h-52" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="shimmer rounded-xl h-20" />
          ))}
        </div>
      </div>
    );
  }

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
    <div className="relative isolate">
      {/* Aurora orbs — nền trang trí sau hero, chỉ hiện ở dark mode */}
      <div
        className="hidden dark:block pointer-events-none absolute inset-x-0 -top-16 h-[560px] overflow-hidden"
        aria-hidden="true"
      >
        <div className="orb orb-primary absolute top-0 -left-24 w-[34rem] h-[34rem] opacity-95" />
        <div className="orb orb-secondary absolute top-8 -right-20 w-[28rem] h-[28rem] opacity-75" />
        <div className="orb orb-accent absolute top-40 left-1/3 w-[24rem] h-[24rem] opacity-60" />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <div className="flex items-end justify-between flex-wrap gap-3 mb-5">
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

        {/* ===== ROW 1: 3 MAIN CARDS (NexaStore layout) ===== */}
        <motion.div
          className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4"
          variants={stagger}
          initial="initial"
          animate="animate"
        >
          {/* Card 1: Sales Summary — big revenue + growth + vs last month */}
          <motion.div variants={fadeUp}>
            <div
              className="admin-kpi-card admin-card-glow p-5 h-full"
              style={{ '--kpi-accent': 'var(--accent)' } as React.CSSProperties}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-[var(--accent)]/12 flex items-center justify-center">
                    <DollarSign className="w-4.5 h-4.5 text-[var(--accent)]" strokeWidth={2.25} />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    {t('admin.dashboard.stats.totalRevenue')}
                  </span>
                </div>
                <Link
                  to={ROUTES.ADMIN_ORDERS}
                  className="text-xs text-[var(--accent)] hover:underline font-medium"
                >
                  {t('admin.dashboard.sections.viewAll')} →
                </Link>
              </div>
              <div className="flex items-baseline gap-2.5 mb-1">
                <FlipNumber
                  value={totalRevenue}
                  suffix={t('common.currencySymbol')}
                  className="text-4xl font-bold text-[var(--text-primary)] tracking-tight"
                />
              </div>
              <div className="flex items-center gap-2 mb-4">
                <GrowthPill value={growthRevenue} />
                <span className="text-[11px] text-[var(--text-tertiary)]">
                  {t('admin.dashboard.stats.fromLastMonth')}
                </span>
              </div>
              {/* Mini stats row */}
              <div className="grid grid-cols-2 gap-3 pt-3 border-t border-[var(--border-default)]">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-0.5">
                    {t('admin.dashboard.stats.aov')}
                  </div>
                  <div className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
                    {formatPrice(aov)}
                  </div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-0.5">
                    {t('admin.dashboard.stats.totalProducts')}
                  </div>
                  <div className="text-sm font-bold text-[var(--text-primary)] tabular-nums">
                    {formatNumber(totalProducts)}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Recent Orders — timeline mini (NexaStore style) */}
          <motion.div variants={fadeUp}>
            <div
              className="admin-kpi-card admin-card-glow p-5 h-full"
              style={{ '--kpi-accent': 'var(--admin-info)' } as React.CSSProperties}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-[var(--admin-info)]/12 flex items-center justify-center">
                    <ShoppingBag
                      className="w-4.5 h-4.5 text-[var(--admin-info)]"
                      strokeWidth={2.25}
                    />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    {t('admin.dashboard.sections.recentOrders')}
                  </span>
                </div>
                <Link
                  to={ROUTES.ADMIN_ORDERS}
                  className="text-xs text-[var(--accent)] hover:underline font-medium"
                >
                  {t('admin.dashboard.sections.viewAll')} →
                </Link>
              </div>
              <div className="space-y-2.5">
                {isOrdersLoading ? (
                  [...Array(4)].map((_, i) => <div key={i} className="shimmer h-10 rounded-lg" />)
                ) : recentOrders.length > 0 ? (
                  recentOrders.slice(0, 4).map((order) => (
                    <div
                      key={order.id}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition"
                    >
                      <OrderStatusBadge status={order.status} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium text-[var(--text-primary)] truncate">
                          {order.number}
                        </div>
                        <div className="text-[10px] text-[var(--text-tertiary)]">
                          {order.shippingFirstName} {order.shippingLastName}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div className="text-xs font-semibold text-[var(--text-primary)] tabular-nums">
                          {formatPrice(order.total)}
                        </div>
                        <StatusPill
                          variant={
                            order.status === 'delivered'
                              ? 'success'
                              : order.status === 'cancelled'
                                ? 'error'
                                : order.status === 'pending'
                                  ? 'warning'
                                  : 'info'
                          }
                          label={t(`admin.dashboard.orderStatus.${order.status}`)}
                          className="text-[9px] px-1.5 py-0"
                        />
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-6 text-sm text-[var(--text-tertiary)]">
                    {t('admin.dashboard.table.noRecentOrders')}
                  </div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Card 3: Customer Overview — 4 sub-KPIs (NexaStore style) */}
          <motion.div variants={fadeUp}>
            <div
              className="admin-kpi-card admin-card-glow p-5 h-full"
              style={{ '--kpi-accent': 'var(--admin-success)' } as React.CSSProperties}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-9 h-9 rounded-xl bg-[var(--admin-success)]/12 flex items-center justify-center">
                    <Users className="w-4.5 h-4.5 text-[var(--admin-success)]" strokeWidth={2.25} />
                  </div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    {t('admin.dashboard.stats.totalUsers')}
                  </span>
                </div>
                <GrowthPill value={growthUsers} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    label: t('admin.dashboard.stats.totalOrders'),
                    value: totalOrders,
                    growth: growthOrders,
                    color: '--admin-info',
                  },
                  {
                    label: t('admin.dashboard.stats.totalUsers'),
                    value: totalUsers,
                    growth: growthUsers,
                    color: '--admin-success',
                  },
                  {
                    label: t('admin.dashboard.stats.cancelledThisMonth'),
                    value: cancelled,
                    color: '--admin-error',
                  },
                  {
                    label: t('admin.dashboard.stats.lowStock'),
                    value: lowStockCount,
                    color: '--admin-warning',
                  },
                ].map(({ label, value, growth, color }) => (
                  <div
                    key={label}
                    className="rounded-xl bg-white/[0.03] border border-[var(--border-default)] p-3"
                  >
                    <div className="text-[10px] uppercase tracking-wider text-[var(--text-tertiary)] mb-1 truncate">
                      {label}
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span
                        className="text-lg font-bold tabular-nums"
                        style={{ color: `var(${color})` }}
                      >
                        <FlipNumber value={value} />
                      </span>
                      {growth !== undefined && <GrowthPill value={growth} />}
                    </div>
                  </div>
                ))}
              </div>
              <Link
                to={ROUTES.ADMIN_USERS}
                className="mt-3 block w-full text-center py-2 rounded-xl bg-[var(--accent)] text-white text-xs font-medium hover:bg-[var(--color-primary-dark)] transition"
              >
                {t('admin.users.title')}
              </Link>
            </div>
          </motion.div>
        </motion.div>

        {/* Pending alert */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-3 mb-4 px-4 py-2.5 rounded-xl bg-[var(--admin-warning)]/10 border border-[var(--admin-warning)]/30">
            <AlertTriangle
              className="w-4 h-4 text-[var(--admin-warning)] flex-shrink-0"
              strokeWidth={2.25}
            />
            <span className="flex-1 text-xs text-[var(--text-primary)] font-medium">
              {t('admin.dashboard.alerts.pendingOrders', { count: pendingCount })}
            </span>
            <Link
              to={buildRoute.adminOrdersPending()}
              className="text-xs font-medium text-[var(--admin-warning)] hover:underline whitespace-nowrap"
            >
              {t('admin.dashboard.alerts.viewOrders')} →
            </Link>
          </div>
        )}

        {/* ===== CHARTS ===== */}
        <DashboardCharts />

        {/* ===== ROW BOTTOM: Top Products + Low Stock side by side ===== */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
          {/* Top products */}
          <div className="admin-kpi-card admin-card-glow overflow-hidden">
            <div className="px-5 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[var(--accent)]" strokeWidth={2.25} />
                <h2 className="text-sm font-semibold">
                  {t('admin.dashboard.sections.topProducts')}
                </h2>
              </div>
              <Link
                to={ROUTES.ADMIN_PRODUCTS}
                className="text-xs font-medium text-[var(--accent)] hover:underline"
              >
                {t('admin.dashboard.sections.viewAll')} →
              </Link>
            </div>
            <div className="p-4">
              {stats?.topProducts && stats.topProducts.length > 0 ? (
                <div className="space-y-2.5">
                  {stats.topProducts.slice(0, 5).map((item, index) => (
                    <div
                      key={item.product.id ?? index}
                      className="flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition"
                    >
                      <span className="flex-shrink-0 w-6 h-6 rounded-lg bg-[var(--accent)]/10 flex items-center justify-center text-[10px] font-bold text-[var(--accent)] tabular-nums">
                        {index + 1}
                      </span>
                      <div className="flex-shrink-0 w-9 h-9 rounded-lg overflow-hidden bg-[var(--bg-surface)]">
                        {item.product.images?.[0] ? (
                          <img
                            src={item.product.images[0]}
                            alt={item.product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[10px] text-[var(--text-tertiary)]">
                            <Package className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                          {item.product.name}
                        </p>
                        <div className="flex items-center gap-2 text-[10px]">
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
                <div className="flex flex-col items-center justify-center text-center py-10 gap-3">
                  <div className="w-14 h-14 rounded-2xl bg-[var(--accent)]/10 flex items-center justify-center">
                    <Package className="w-7 h-7 text-[var(--accent)]" strokeWidth={1.75} />
                  </div>
                  <p className="text-sm text-[var(--text-secondary)] font-medium">
                    {t('admin.dashboard.table.noProductData')}
                  </p>
                  <Link
                    to={ROUTES.ADMIN_PRODUCTS}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--accent)]/12 text-[var(--accent)] text-xs font-medium hover:bg-[var(--accent)]/20 transition"
                  >
                    {t('admin.dashboard.sections.viewAll')} →
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Low Stock */}
          {lowStockProducts.length > 0 && (
            <div id="low-stock-widget" className="admin-kpi-card admin-card-glow overflow-hidden">
              <div className="px-5 py-4 border-b border-[var(--border-default)] flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-[var(--admin-warning)]" strokeWidth={2.25} />
                <h2 className="text-sm font-semibold">{t('admin.dashboard.lowStock.title')}</h2>
              </div>
              <div className="p-4 space-y-2">
                {lowStockProducts.slice(0, 5).map((product) => {
                  const isOut = product.stockQuantity === 0;
                  return (
                    <div
                      key={product.id}
                      className={cn(
                        'flex items-center gap-3 p-2 rounded-xl transition',
                        isOut ? 'bg-[var(--admin-error)]/5' : 'bg-[var(--admin-warning)]/5',
                      )}
                    >
                      {product.thumbnail ? (
                        <img
                          src={proxyImg(product.thumbnail)}
                          alt={product.name}
                          className="w-8 h-8 rounded-md object-cover"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-md bg-[var(--bg-surface)] flex items-center justify-center">
                          <Package className="w-3.5 h-3.5 text-[var(--text-tertiary)]" />
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-[var(--text-primary)] truncate">
                          {product.name}
                        </p>
                        <p className="text-[10px] text-[var(--text-tertiary)] tabular-nums">
                          {product.sku || '—'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusPill
                          variant={isOut ? 'error' : 'warning'}
                          label={String(product.stockQuantity)}
                          showDot={false}
                        />
                        <Link
                          to={buildRoute.adminProductEdit(product.id)}
                          className="text-[var(--accent)] hover:underline"
                        >
                          <Eye className="w-3.5 h-3.5" strokeWidth={2.25} />
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
