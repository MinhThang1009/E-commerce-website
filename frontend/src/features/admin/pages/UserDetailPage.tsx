/**
 * @file UserDetailPage.tsx
 * @layer Page
 * @feature admin
 * @description Chi tiết người dùng — profile + tabs glass design (spec §16.3)
 */
import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ROUTES } from '@/routes/paths';
import {
  User,
  Mail,
  Phone,
  Calendar,
  History,
  MapPin,
  ShoppingCart,
  ArrowLeft,
  Crown,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { useGetUserByIdQuery } from '../api/admin-user-api';
import { formatPrice, formatDate } from '@/utils/format';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import StatusPill from '../components/StatusPill';
import FlipNumber from '../components/FlipNumber';

const easeOutQuart = [0.22, 1, 0.36, 1] as const;
const rowStagger = { animate: { transition: { staggerChildren: 0.025 } } };
const rowItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: easeOutQuart } },
};

const UserDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: userData, isLoading, error } = useGetUserByIdQuery(id || '');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- order fields dynamic from API
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (error || !userData) {
    return (
      <div className="py-16 text-center">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--admin-error)]/10 flex items-center justify-center">
          <User className="w-8 h-8 text-[var(--admin-error)]" strokeWidth={1.5} />
        </div>
        <p className="text-[var(--text-tertiary)] mb-4">{t('admin.userDetail.notFound')}</p>
        <Link to={ROUTES.ADMIN_USERS}>
          <Button variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" strokeWidth={2.25} />
            {t('admin.userDetail.backToList')}
          </Button>
        </Link>
      </div>
    );
  }

  const { user } = userData.data;

  return (
    <div>
      {/* Header breadcrumb */}
      <div className="flex items-center gap-3 mb-5">
        <Link to={ROUTES.ADMIN_USERS}>
          <Button variant="ghost" size="icon" className="rounded-xl hover:bg-white/5">
            <ArrowLeft className="w-4 h-4" strokeWidth={2.25} />
          </Button>
        </Link>
        <div>
          <span className="section-number">06 / CHI TIẾT NGƯỜI DÙNG</span>
          <h1 className="display-heading mt-1 text-xl">{t('admin.userDetail.title')}</h1>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left: Profile card */}
        <div className="lg:col-span-1 space-y-5">
          <div className="rounded-2xl bg-[var(--bg-base)] dark:bg-white/[0.03] border border-[var(--border-default)] overflow-hidden shadow-sm">
            {/* Gradient cover */}
            <div className="h-24 bg-gradient-to-r from-[var(--color-primary)] to-[var(--admin-info)] relative">
              <div
                className="absolute inset-0 opacity-30"
                style={{
                  background:
                    'radial-gradient(circle at 80% 50%, rgba(255,255,255,0.3) 0%, transparent 60%)',
                }}
              />
            </div>
            <div className="px-5 pb-5 text-center">
              {/* Avatar */}
              <div className="-mt-12 mb-4">
                {user.avatar ? (
                  <img
                    src={user.avatar}
                    alt={`${user.firstName} ${user.lastName}`}
                    className="w-24 h-24 rounded-full border-4 border-[var(--bg-base)] shadow-lg mx-auto object-cover"
                  />
                ) : (
                  <div className="w-24 h-24 rounded-full border-4 border-[var(--bg-base)] shadow-lg mx-auto flex items-center justify-center bg-gradient-to-br from-[var(--accent)] to-[var(--color-primary-dark)]">
                    <span className="text-white text-2xl font-bold">
                      {(user.firstName?.[0] || 'U').toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <h4 className="text-lg font-bold text-[var(--text-primary)] mb-1">
                {user.firstName} {user.lastName}
              </h4>
              <div className="mb-4">
                <StatusPill
                  variant={user.role === 'admin' ? 'error' : 'info'}
                  label={
                    <span className="inline-flex items-center gap-1">
                      {user.role === 'admin' ? (
                        <Crown className="w-3 h-3" />
                      ) : (
                        <User className="w-3 h-3" />
                      )}
                      {user.role === 'admin'
                        ? t('admin.users.roles.admin')
                        : t('admin.users.roles.customer')}
                    </span>
                  }
                  showDot={false}
                />
              </div>

              <div className="h-px bg-[var(--border-default)] my-4" />

              <div className="text-center mb-4">
                <div className="flex items-center justify-center gap-2 text-[var(--text-tertiary)] text-xs mb-1">
                  <ShoppingCart className="w-4 h-4" />
                  <span>{t('admin.userDetail.stats.orders')}</span>
                </div>
                <FlipNumber
                  value={user.orders?.length || 0}
                  className="text-2xl font-bold text-[var(--text-primary)]"
                />
              </div>

              <div className="h-px bg-[var(--border-default)] my-4" />

              <div className="space-y-3 text-left text-sm">
                <div className="flex items-center gap-2.5 text-[var(--text-secondary)]">
                  <Mail className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
                  <span className="break-all">{user.email}</span>
                </div>
                <div className="flex items-center gap-2.5 text-[var(--text-secondary)]">
                  <Phone className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
                  <span>{user.phone || t('admin.userDetail.notUpdated')}</span>
                </div>
                <div className="flex items-center gap-2.5 text-[var(--text-secondary)]">
                  <Calendar className="w-4 h-4 text-[var(--text-tertiary)] shrink-0" />
                  <span>
                    {t('admin.userDetail.joinedDate', {
                      date: formatDate(user.createdAt, { dateStyle: 'medium' }),
                    })}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Account status card */}
          <div className="rounded-2xl bg-[var(--bg-base)] dark:bg-white/[0.03] border border-[var(--border-default)] p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
              {t('admin.userDetail.accountStatus')}
            </h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-tertiary)]">
                  {t('admin.userDetail.activeLabel')}
                </span>
                <StatusPill
                  variant={user.isActive ? 'success' : 'error'}
                  label={
                    user.isActive
                      ? t('admin.userDetail.activeStatus')
                      : t('admin.userDetail.lockedStatus')
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-tertiary)]">
                  {t('admin.userDetail.emailVerifyLabel')}
                </span>
                <StatusPill
                  variant={user.isEmailVerified ? 'success' : 'warning'}
                  label={
                    user.isEmailVerified
                      ? t('admin.userDetail.verified')
                      : t('admin.userDetail.notVerified')
                  }
                  showDot={false}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right: Tabs */}
        <div className="lg:col-span-2">
          <div className="rounded-2xl bg-[var(--bg-base)] dark:bg-white/[0.03] border border-[var(--border-default)] p-5 shadow-sm">
            <Tabs defaultValue="orders">
              <TabsList className="bg-transparent p-0 gap-1 mb-4">
                <TabsTrigger
                  value="orders"
                  className="text-xs font-medium rounded-lg px-3 py-2 gap-1.5 transition data-[state=active]:bg-[var(--accent)]/12 data-[state=active]:text-[var(--accent)] data-[state=active]:shadow-sm"
                >
                  <ShoppingCart className="w-3.5 h-3.5" />
                  {t('admin.userDetail.tabs.orders')}
                </TabsTrigger>
                <TabsTrigger
                  value="addresses"
                  className="text-xs font-medium rounded-lg px-3 py-2 gap-1.5 transition data-[state=active]:bg-[var(--accent)]/12 data-[state=active]:text-[var(--accent)] data-[state=active]:shadow-sm"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  {t('admin.userDetail.tabs.addresses')}
                </TabsTrigger>
                <TabsTrigger
                  value="activity"
                  className="text-xs font-medium rounded-lg px-3 py-2 gap-1.5 transition data-[state=active]:bg-[var(--accent)]/12 data-[state=active]:text-[var(--accent)] data-[state=active]:shadow-sm"
                >
                  <History className="w-3.5 h-3.5" />
                  {t('admin.userDetail.tabs.activity')}
                </TabsTrigger>
              </TabsList>

              {/* Orders */}
              <TabsContent value="orders">
                <div className="overflow-x-auto rounded-xl border border-[var(--border-default)]">
                  <table className="w-full text-sm">
                    <thead className="bg-white/[0.02]">
                      <tr>
                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                          {t('admin.userDetail.orderColumns.code')}
                        </th>
                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                          {t('admin.userDetail.orderColumns.createdAt')}
                        </th>
                        <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                          {t('common.status')}
                        </th>
                        <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                          {t('admin.userDetail.orderColumns.total')}
                        </th>
                      </tr>
                    </thead>
                    <motion.tbody variants={rowStagger} initial="initial" animate="animate">
                      {user.orders && user.orders.length > 0 ? (
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        user.orders.map((order: any) => (
                          <motion.tr
                            key={order.id}
                            variants={rowItem}
                            className="border-t border-[var(--border-default)] hover:bg-white/[0.03] transition"
                          >
                            <td className="px-4 py-3">
                              <button
                                type="button"
                                onClick={() => setSelectedOrder(order)}
                                className="font-medium text-[var(--accent)] hover:underline"
                              >
                                #{order.number || order.id.substring(0, 8)}
                              </button>
                            </td>
                            <td className="px-4 py-3 text-[var(--text-secondary)] tabular-nums text-xs">
                              {formatDate(order.createdAt, { dateStyle: 'short' })}
                            </td>
                            <td className="px-4 py-3">
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
                                label={t(`admin.dashboard.orderStatus.${order.status}`, {
                                  defaultValue: order.status,
                                })}
                              />
                            </td>
                            <td className="px-4 py-3 text-right font-semibold text-[var(--text-primary)] tabular-nums">
                              {formatPrice(order.total)}
                            </td>
                          </motion.tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={4} className="text-center py-12 text-[var(--text-tertiary)]">
                            {t('admin.userDetail.noOrders')}
                          </td>
                        </tr>
                      )}
                    </motion.tbody>
                  </table>
                </div>
              </TabsContent>

              {/* Addresses */}
              <TabsContent value="addresses">
                {user.addresses?.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {user.addresses.map((addr: any) => (
                      <div
                        key={addr.id}
                        className="rounded-xl border border-[var(--border-default)] p-4 hover:shadow-md transition"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="font-semibold text-sm text-[var(--text-primary)]">
                            {addr.firstName} {addr.lastName}
                          </span>
                          {addr.isDefault && (
                            <StatusPill
                              variant="info"
                              label={t('admin.userDetail.defaultAddress')}
                              showDot={false}
                            />
                          )}
                        </div>
                        <div className="text-xs text-[var(--text-secondary)] space-y-0.5">
                          <p>{addr.phone}</p>
                          <p>{addr.addressLine1}</p>
                          {addr.addressLine2 && <p>{addr.addressLine2}</p>}
                          <p>
                            {addr.city}, {addr.state} {addr.zipCode}
                          </p>
                          <p>{addr.country}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center py-12 text-[var(--text-tertiary)]">
                    {t('admin.userDetail.noAddresses')}
                  </p>
                )}
              </TabsContent>

              {/* Activity */}
              <TabsContent value="activity">
                <div className="mt-2 space-y-3">
                  {(user.searchHistories || [])
                    .sort(
                      // eslint-disable-next-line @typescript-eslint/no-explicit-any
                      (a: any, b: any) =>
                        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
                    )
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    .map((s: any, index: number) => (
                      <div key={index} className="flex items-start gap-3">
                        <div className="mt-1.5 w-2 h-2 rounded-full bg-[var(--accent)] shrink-0" />
                        <p className="text-sm text-[var(--text-secondary)]">
                          <span className="text-[var(--text-tertiary)] tabular-nums">
                            {formatDate(s.createdAt, { dateStyle: 'short', timeStyle: 'short' })}
                          </span>
                          {': '}
                          {t('admin.userDetail.activity.search')} &quot;
                          {s.keyword || s.query || 'N/A'}&quot;
                        </p>
                      </div>
                    ))}
                  {(!user.searchHistories || user.searchHistories.length === 0) && (
                    <p className="text-center py-12 text-[var(--text-tertiary)]">
                      {t('common.noData')}
                    </p>
                  )}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Order Detail Dialog — glass */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="glass-dialog max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" strokeWidth={2.25} />
              {t('admin.userDetail.orderDialog.title')}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--border-default)] overflow-hidden text-sm">
                <table className="w-full">
                  <tbody>
                    {[
                      {
                        label: t('admin.userDetail.orderDialog.orderNumber'),
                        value: `#${selectedOrder.number || selectedOrder.id?.substring(0, 8)}`,
                        bold: true,
                      },
                      {
                        label: t('admin.userDetail.orderDialog.orderDate'),
                        value: formatDate(selectedOrder.createdAt, { dateStyle: 'medium' }),
                      },
                    ].map(({ label, value, bold }) => (
                      <tr key={label} className="border-b border-[var(--border-default)]">
                        <td className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] bg-white/[0.02] w-[140px]">
                          {label}
                        </td>
                        <td
                          className={`px-4 py-2.5 text-[var(--text-primary)] ${bold ? 'font-semibold' : ''}`}
                        >
                          {value}
                        </td>
                      </tr>
                    ))}
                    <tr className="border-b border-[var(--border-default)]">
                      <td className="px-4 py-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] bg-white/[0.02]">
                        {t('admin.userDetail.orderDialog.status')}
                      </td>
                      <td className="px-4 py-2.5">
                        <StatusPill
                          variant={
                            selectedOrder.status === 'delivered'
                              ? 'success'
                              : selectedOrder.status === 'cancelled'
                                ? 'error'
                                : selectedOrder.status === 'pending'
                                  ? 'warning'
                                  : 'info'
                          }
                          label={t(`admin.dashboard.orderStatus.${selectedOrder.status}`, {
                            defaultValue: selectedOrder.status,
                          })}
                        />
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Financial summary */}
              <div className="rounded-xl border border-[var(--border-default)] p-4 space-y-2 text-sm">
                {selectedOrder.subtotal != null && (
                  <div className="flex justify-between text-[var(--text-secondary)]">
                    <span>{t('admin.userDetail.orderDialog.subtotal')}</span>
                    <span className="tabular-nums">{formatPrice(selectedOrder.subtotal)}</span>
                  </div>
                )}
                {selectedOrder.shippingCost != null && Number(selectedOrder.shippingCost) > 0 && (
                  <div className="flex justify-between text-[var(--text-secondary)]">
                    <span>{t('admin.userDetail.orderDialog.shipping')}</span>
                    <span className="tabular-nums">{formatPrice(selectedOrder.shippingCost)}</span>
                  </div>
                )}
                {selectedOrder.discount != null && Number(selectedOrder.discount) > 0 && (
                  <div className="flex justify-between text-[var(--admin-success)]">
                    <span>{t('admin.userDetail.orderDialog.discount')}</span>
                    <span className="tabular-nums">-{formatPrice(selectedOrder.discount)}</span>
                  </div>
                )}
                <div className="h-px bg-[var(--border-default)] my-2" />
                <div className="flex justify-between font-bold text-[var(--text-primary)]">
                  <span>{t('admin.userDetail.orderDialog.total')}</span>
                  <span className="tabular-nums">{formatPrice(selectedOrder.total)}</span>
                </div>
              </div>

              <Link to={ROUTES.ADMIN_ORDERS} onClick={() => setSelectedOrder(null)}>
                <Button variant="outline" className="w-full gap-2">
                  <ExternalLink className="w-4 h-4" strokeWidth={2.25} />
                  {t('admin.userDetail.orderDialog.viewInOrders')}
                </Button>
              </Link>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UserDetailPage;
