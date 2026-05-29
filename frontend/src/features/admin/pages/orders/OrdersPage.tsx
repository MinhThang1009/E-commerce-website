/**
 * @file OrdersPage.tsx
 * @layer Page
 * @feature orders
 * @description Page component của feature orders
 */
import React, { useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Search,
  Eye,
  Pencil,
  RefreshCw,
  ShoppingCart,
  User,
  Calendar,
  Banknote,
  Info,
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
  AlertTriangle,
  Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import dayjs from 'dayjs';
import { motion } from 'framer-motion';
import {
  useGetAdminOrdersQuery,
  useUpdateOrderStatusMutation,
  useGetDashboardStatsQuery,
  AdminOrder,
} from '@/features/admin';
import { useTranslation } from 'react-i18next';
import { formatPrice } from '@/utils/format';
import { cn } from '@/utils/cn';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import AdminPageHeader from '../../components/AdminPageHeader';
import AdminStatCard from '../../components/AdminStatCard';
import AdminMobileCard from '../../components/AdminMobileCard';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Pagination } from '@/components/common';
import { useUiStore } from '@/stores/ui-store';

// Cấu hình trạng thái — admin tokens (KHÔNG Tailwind color literals)
const STATUS_CONFIG: Record<string, { color: string; Icon: LucideIcon }> = {
  pending: {
    color:
      'bg-[var(--color-warning)]/12 text-[var(--color-warning)] border border-[var(--color-warning)]/25',
    Icon: Clock,
  },
  processing: {
    color:
      'bg-[var(--color-info)]/12 text-[var(--color-info)] border border-[var(--color-info)]/25',
    Icon: RefreshCw,
  },
  shipped: {
    color:
      'bg-[var(--color-violet)]/12 text-[var(--color-violet)] border border-[var(--color-violet)]/25',
    Icon: Truck,
  },
  delivered: {
    color:
      'bg-[var(--color-success)]/12 text-[var(--color-success)] border border-[var(--color-success)]/25',
    Icon: CheckCircle,
  },
  cancelled: {
    color:
      'bg-[var(--color-danger)]/12 text-[var(--color-danger)] border border-[var(--color-danger)]/25',
    Icon: XCircle,
  },
};

const PAYMENT_STATUS_CONFIG: Record<string, { color: string; Icon: LucideIcon }> = {
  pending: {
    color:
      'bg-[var(--color-warning)]/12 text-[var(--color-warning)] border border-[var(--color-warning)]/25',
    Icon: Clock,
  },
  paid: {
    color:
      'bg-[var(--color-success)]/12 text-[var(--color-success)] border border-[var(--color-success)]/25',
    Icon: CheckCircle,
  },
  failed: {
    color:
      'bg-[var(--color-danger)]/12 text-[var(--color-danger)] border border-[var(--color-danger)]/25',
    Icon: XCircle,
  },
  refunded: {
    color:
      'bg-[var(--text-tertiary)]/12 text-[var(--text-secondary)] border border-[var(--border-default)]',
    Icon: RotateCcw,
  },
};

interface UpdateFormData {
  status: string;
  paymentStatus: string;
  note: string;
}

const OrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification } = useUiStore();

  // Quản lý state — khởi tạo statusFilter từ query param (?status=pending từ Dashboard)
  const [searchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') || '');
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);
  const [updateForm, setUpdateForm] = useState<UpdateFormData>({
    status: '',
    paymentStatus: '',
    note: '',
  });
  const [validationError, setValidationError] = useState<string>('');

  // Các query API
  const {
    data: ordersData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useGetAdminOrdersQuery({
    page,
    limit: pageSize,
    search: searchTerm,
    status: statusFilter,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
  });

  const { mutateAsync: updateOrderStatus, isPending: isUpdating } = useUpdateOrderStatusMutation();

  // Aggregate cho StatStrip — dùng chung query với Dashboard (data thật, không bịa)
  const { data: dashboardData, isLoading: isStatsLoading } = useGetDashboardStatsQuery();
  const ordersByStatus = dashboardData?.data?.overview?.ordersByStatus ?? {};
  const totalRevenue = dashboardData?.data?.overview?.totalRevenue ?? 0;

  const formatCurrency = useCallback((amount: number) => formatPrice(amount), []);

  // Định dạng ngày tháng
  const formatDate = useCallback((dateString: string) => {
    return dayjs(dateString).format('DD/MM/YYYY HH:mm');
  }, []);

  // Tùy chọn trạng thái cho bộ lọc và form
  const statusOptions = [
    { value: '', label: t('admin.orders.allStatus') },
    { value: 'pending', label: t('admin.orders.status.pending') },
    { value: 'processing', label: t('admin.orders.status.processing') },
    { value: 'shipped', label: t('admin.orders.status.shipped') },
    { value: 'delivered', label: t('admin.orders.status.delivered') },
    { value: 'cancelled', label: t('admin.orders.status.cancelled') },
  ];

  const updateStatusOptions = statusOptions.filter((option) => option.value !== '');

  // Xử lý xem chi tiết đơn hàng
  const handleViewDetails = useCallback((order: AdminOrder) => {
    setSelectedOrder(order);
    setIsDetailsModalOpen(true);
  }, []);

  // Xử lý cập nhật trạng thái đơn hàng
  const handleUpdateStatus = useCallback((order: AdminOrder) => {
    setSelectedOrder(order);
    setUpdateForm({
      status: order.status,
      paymentStatus: order.paymentStatus,
      note: '',
    });
    setValidationError('');
    setIsUpdateModalOpen(true);
  }, []);

  // Validate form cập nhật
  const validateUpdateForm = useCallback((): boolean => {
    const isCod = selectedOrder?.paymentMethod === 'cod';
    const { status, paymentStatus } = updateForm;

    if (status === 'cancelled' && paymentStatus === 'paid') {
      setValidationError(t('admin.orders.updateStatus.errorCancelledPaid'));
      return false;
    }
    if (
      status === 'delivered' &&
      !isCod &&
      (paymentStatus === 'pending' || paymentStatus === 'failed')
    ) {
      setValidationError(t('admin.orders.updateStatus.errorDeliveredUnpaid'));
      return false;
    }
    if (paymentStatus === 'refunded' && status !== 'cancelled') {
      setValidationError(t('admin.orders.updateStatus.errorRefundedActive'));
      return false;
    }
    setValidationError('');
    return true;
  }, [selectedOrder, updateForm, t]);

  // Gửi cập nhật trạng thái
  const handleStatusUpdate = useCallback(async () => {
    if (!selectedOrder) return;
    if (!validateUpdateForm()) return;

    try {
      await updateOrderStatus({
        id: selectedOrder.id,
        data: {
          status: updateForm.status,
          paymentStatus: updateForm.paymentStatus,
          note: updateForm.note || undefined,
        },
      });

      addNotification({ type: 'success', message: t('admin.orders.messages.updateSuccess') });
      setIsUpdateModalOpen(false);
      setUpdateForm({ status: '', paymentStatus: '', note: '' });
      setSelectedOrder(null);
      refetch();
    } catch (err) {
      console.error('Cập nhật trạng thái đơn hàng thất bại:', err);
      addNotification({ type: 'error', message: t('admin.orders.messages.updateError') });
    }
  }, [
    selectedOrder,
    updateForm,
    updateOrderStatus,
    t,
    refetch,
    addNotification,
    validateUpdateForm,
  ]);

  // Xử lý tìm kiếm
  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, []);

  // Xử lý thay đổi bộ lọc trạng thái
  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  // Auto-correct payment status khi cancel
  const handleStatusChange = (newStatus: string) => {
    setUpdateForm((prev) => {
      const next = { ...prev, status: newStatus };
      if (newStatus === 'cancelled' && prev.paymentStatus === 'paid') {
        next.paymentStatus = 'refunded';
      }
      return next;
    });
    setValidationError('');
  };

  // Lấy đơn hàng và phân trang từ response API
  const orders = ordersData?.data?.orders || [];
  const pagination = ordersData?.data?.pagination;
  const totalPages = pagination ? Math.ceil(pagination.totalItems / pageSize) : 1;

  // Lấy note/warning cho form
  const getPaymentNote = (): string | undefined => {
    if (!selectedOrder) return undefined;
    const { status, paymentStatus } = updateForm;
    const isCod = selectedOrder.paymentMethod === 'cod';
    if (status === 'delivered' && isCod) return t('admin.orders.updateStatus.codDeliveredNote');
    if (status === 'cancelled' && paymentStatus === 'refunded')
      return t('admin.orders.updateStatus.cancelledRefundNote');
    if (
      status === 'delivered' &&
      !isCod &&
      (paymentStatus === 'pending' || paymentStatus === 'failed')
    )
      return t('admin.orders.updateStatus.deliveredUnpaidNote');
    if (paymentStatus === 'refunded' && status !== 'cancelled')
      return t('admin.orders.updateStatus.refundedActiveNote');
    return undefined;
  };

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <span className="section-number">02 / ĐƠN HÀNG</span>
          <div className="h-9 w-64 mt-2 shimmer rounded-lg" />
        </div>
        <div className="space-y-3">
          {[...Array(6)].map((_, idx) => (
            <div key={idx} className="shimmer h-14 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="mb-6">
          <span className="section-number">02 / ĐƠN HÀNG</span>
          <h1 className="display-heading mt-2">{t('admin.orders.title')}</h1>
        </div>
        <div className="glass-card-lg p-10 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--color-danger)]/10 flex items-center justify-center">
            <ShoppingCart className="w-8 h-8 text-[var(--color-danger)]" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-[var(--text-tertiary)] mb-4">
            {t('admin.orders.messages.loadError')}
          </p>
          <Button variant="outline" onClick={() => refetch()}>
            {t('admin.orders.messages.retry')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Page header */}
      <AdminPageHeader
        sectionNumber="02 / ĐƠN HÀNG"
        title={t('admin.orders.title')}
        gradientTitle
        sparkle
        subtitle={t('admin.orders.subtitle')}
        actions={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw
              className={cn('w-4 h-4 mr-2', isFetching && 'animate-spin')}
              strokeWidth={2.25}
            />
            {t('common.refresh')}
          </Button>
        }
      />

      {/* StatStrip — aggregate trạng thái + doanh thu (data thật từ dashboard) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
        <AdminStatCard
          label={t('admin.orders.status.pending')}
          value={ordersByStatus.pending ?? 0}
          icon={Clock}
          accentVar="--color-warning"
          isLoading={isStatsLoading}
        />
        <AdminStatCard
          label={t('admin.orders.status.processing')}
          value={ordersByStatus.processing ?? 0}
          icon={RefreshCw}
          accentVar="--color-info"
          isLoading={isStatsLoading}
        />
        <AdminStatCard
          label={t('admin.orders.status.delivered')}
          value={ordersByStatus.delivered ?? 0}
          icon={CheckCircle}
          accentVar="--color-success"
          isLoading={isStatsLoading}
        />
        <AdminStatCard
          label={t('admin.orders.status.cancelled')}
          value={ordersByStatus.cancelled ?? 0}
          icon={XCircle}
          accentVar="--color-danger"
          isLoading={isStatsLoading}
        />
        <AdminStatCard
          label={t('admin.dashboard.stats.totalRevenue')}
          value={totalRevenue}
          icon={Banknote}
          accentVar="--accent"
          suffix={t('common.currencySymbol')}
          isLoading={isStatsLoading}
        />
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl bg-[var(--bg-base)] dark:bg-white/[0.03] border border-[var(--border-default)] p-4 mb-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 items-end">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] pointer-events-none" />
            <Input
              placeholder={t('admin.orders.searchPlaceholder')}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter || 'all'}
            onValueChange={(value) => handleStatusFilterChange(value === 'all' ? '' : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('admin.orders.filterByStatus')} />
            </SelectTrigger>
            <SelectContent>
              {statusOptions.map((option) => (
                <SelectItem key={option.value || 'all'} value={option.value || 'all'}>
                  {option.value === ''
                    ? t('admin.orders.allStatus')
                    : t(`admin.orders.status.${option.value}`)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Orders table */}
      <div className="rounded-2xl bg-[var(--bg-base)] dark:bg-white/[0.03] border border-[var(--border-default)] overflow-hidden shadow-sm">
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-white/[0.02]">
              <tr>
                {[
                  { key: 'orderNumber', w: 'w-[120px]' },
                  { key: 'customer', w: 'w-[200px]' },
                  { key: 'createdAt', w: 'w-[140px]' },
                  { key: 'total', w: 'w-[120px]' },
                ].map(({ key, w }) => (
                  <th
                    key={key}
                    className={`text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] ${w}`}
                  >
                    {t(`admin.orders.table.${key}`)}
                  </th>
                ))}
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] w-[120px]">
                  {t('common.status')}
                </th>
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] w-[120px]">
                  {t('admin.orders.table.payment')}
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] w-[120px]">
                  {t('admin.common.actions')}
                </th>
              </tr>
            </thead>
            <motion.tbody
              initial="initial"
              animate="animate"
              variants={{ animate: { transition: { staggerChildren: 0.025 } } }}
            >
              {orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[var(--text-tertiary)]">
                    {t('admin.orders.noOrdersFound')}
                  </td>
                </tr>
              ) : (
                orders.map((record: AdminOrder, _idx: number) => {
                  const statusConfig = STATUS_CONFIG[record.status as keyof typeof STATUS_CONFIG];
                  const paymentConfig =
                    PAYMENT_STATUS_CONFIG[
                      record.paymentStatus as keyof typeof PAYMENT_STATUS_CONFIG
                    ];
                  const isCOD = record.paymentMethod === 'cod';

                  let paymentStatusText: string = record.paymentStatus;
                  if (record.paymentStatus === 'pending') {
                    paymentStatusText = isCOD
                      ? t('admin.orders.paymentStatus.cod')
                      : t('admin.orders.paymentStatus.pending');
                  } else if (record.paymentStatus === 'paid') {
                    paymentStatusText = t('admin.orders.paymentStatus.paid');
                  } else if (record.paymentStatus === 'failed') {
                    paymentStatusText = t('admin.orders.paymentStatus.failed');
                  } else if (record.paymentStatus === 'refunded') {
                    paymentStatusText = t('admin.orders.paymentStatus.refunded');
                  }

                  const warning =
                    record.status === 'delivered' &&
                    !isCOD &&
                    (record.paymentStatus === 'pending' || record.paymentStatus === 'failed')
                      ? t('admin.orders.updateStatus.deliveredUnpaidNote')
                      : record.paymentStatus === 'refunded' && record.status !== 'cancelled'
                        ? t('admin.orders.updateStatus.refundedActiveNote')
                        : record.status === 'cancelled' && record.paymentStatus === 'paid'
                          ? t('admin.orders.updateStatus.cancelledRefundNote')
                          : null;

                  const paymentTag = (
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${paymentConfig?.color || ''}`}
                    >
                      {warning ? (
                        <AlertTriangle className="w-3.5 h-3.5" />
                      ) : (
                        paymentConfig?.Icon && <paymentConfig.Icon className="w-3.5 h-3.5" />
                      )}
                      {paymentStatusText}
                    </span>
                  );

                  return (
                    <motion.tr
                      key={record.id}
                      variants={{
                        initial: { opacity: 0, y: 8 },
                        animate: { opacity: 1, y: 0, transition: { duration: 0.25 } },
                      }}
                      className="border-t border-[var(--border-default)] hover:bg-white/[0.03] transition group"
                    >
                      <td className="px-4 py-3">
                        <div>
                          <span className="font-semibold text-[var(--text-primary)]">
                            {record.number}
                          </span>
                          <br />
                          <span className="text-xs text-[var(--text-tertiary)]">
                            {t('admin.orders.table.itemCount', {
                              count: record.items?.length || 0,
                            })}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <div className="flex items-center gap-2">
                            <User className="size-4 text-[var(--text-tertiary)]" />
                            <span className="font-semibold text-[var(--text-primary)]">
                              {record.User?.firstName} {record.User?.lastName}
                            </span>
                          </div>
                          <span className="text-xs text-[var(--text-tertiary)]">
                            {record.User?.email}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Calendar className="size-4 text-[var(--text-tertiary)]" />
                          <span className="text-[var(--text-secondary)]">
                            {formatDate(record.createdAt)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Banknote className="size-4 text-[var(--text-tertiary)]" />
                          <span className="font-semibold" style={{ color: 'var(--color-info)' }}>
                            {formatCurrency(record.total)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig?.color || ''}`}
                        >
                          {statusConfig?.Icon && (
                            <statusConfig.Icon className="w-3.5 h-3.5 inline" />
                          )}{' '}
                          {t(`admin.orders.status.${record.status}`)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {warning ? (
                          <Tooltip>
                            <TooltipTrigger asChild>{paymentTag}</TooltipTrigger>
                            <TooltipContent>{warning}</TooltipContent>
                          </Tooltip>
                        ) : (
                          paymentTag
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleViewDetails(record)}
                            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--color-info)]/10 hover:text-[var(--color-info)] transition"
                            title={t('admin.orders.actions.view')}
                          >
                            <Eye className="w-4 h-4" strokeWidth={2.25} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleUpdateStatus(record)}
                            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] transition"
                            title={t('admin.orders.actions.update')}
                          >
                            <Pencil className="w-4 h-4" strokeWidth={2.25} />
                          </button>
                        </div>
                      </td>
                    </motion.tr>
                  );
                })
              )}
            </motion.tbody>
          </table>
        </div>

        {/* Mobile: card-list thay cho table */}
        {orders.length > 0 && (
          <div className="space-y-3 p-3 md:hidden">
            {orders.map((record: AdminOrder) => {
              const statusConfig = STATUS_CONFIG[record.status as keyof typeof STATUS_CONFIG];
              const paymentConfig =
                PAYMENT_STATUS_CONFIG[record.paymentStatus as keyof typeof PAYMENT_STATUS_CONFIG];
              const isCOD = record.paymentMethod === 'cod';

              let paymentStatusText: string = record.paymentStatus;
              if (record.paymentStatus === 'pending') {
                paymentStatusText = isCOD
                  ? t('admin.orders.paymentStatus.cod')
                  : t('admin.orders.paymentStatus.pending');
              } else if (record.paymentStatus === 'paid') {
                paymentStatusText = t('admin.orders.paymentStatus.paid');
              } else if (record.paymentStatus === 'failed') {
                paymentStatusText = t('admin.orders.paymentStatus.failed');
              } else if (record.paymentStatus === 'refunded') {
                paymentStatusText = t('admin.orders.paymentStatus.refunded');
              }

              const warning =
                record.status === 'delivered' &&
                !isCOD &&
                (record.paymentStatus === 'pending' || record.paymentStatus === 'failed')
                  ? t('admin.orders.updateStatus.deliveredUnpaidNote')
                  : record.paymentStatus === 'refunded' && record.status !== 'cancelled'
                    ? t('admin.orders.updateStatus.refundedActiveNote')
                    : record.status === 'cancelled' && record.paymentStatus === 'paid'
                      ? t('admin.orders.updateStatus.cancelledRefundNote')
                      : null;

              const paymentTag = (
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${paymentConfig?.color || ''}`}
                >
                  {warning ? (
                    <AlertTriangle className="w-3.5 h-3.5" />
                  ) : (
                    paymentConfig?.Icon && <paymentConfig.Icon className="w-3.5 h-3.5" />
                  )}
                  {paymentStatusText}
                </span>
              );

              return (
                <AdminMobileCard
                  key={record.id}
                  title={record.number}
                  subtitle={t('admin.orders.table.itemCount', {
                    count: record.items?.length || 0,
                  })}
                  status={
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig?.color || ''}`}
                    >
                      {statusConfig?.Icon && <statusConfig.Icon className="w-3.5 h-3.5 inline" />}{' '}
                      {t(`admin.orders.status.${record.status}`)}
                    </span>
                  }
                  fields={[
                    {
                      label: t('admin.orders.table.customer'),
                      value: (
                        <span className="font-medium text-[var(--text-primary)]">
                          {record.User?.firstName} {record.User?.lastName}
                        </span>
                      ),
                    },
                    {
                      label: t('admin.orders.table.createdAt'),
                      value: formatDate(record.createdAt),
                    },
                    {
                      label: t('admin.orders.table.total'),
                      value: (
                        <span className="font-semibold" style={{ color: 'var(--color-info)' }}>
                          {formatCurrency(record.total)}
                        </span>
                      ),
                    },
                    {
                      label: t('admin.orders.table.payment'),
                      value: warning ? (
                        <Tooltip>
                          <TooltipTrigger asChild>{paymentTag}</TooltipTrigger>
                          <TooltipContent>{warning}</TooltipContent>
                        </Tooltip>
                      ) : (
                        paymentTag
                      ),
                    },
                  ]}
                  actions={
                    <>
                      <button
                        type="button"
                        onClick={() => handleViewDetails(record)}
                        className="rounded-lg p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--color-info)]/10 hover:text-[var(--color-info)]"
                        title={t('admin.orders.actions.view')}
                      >
                        <Eye className="h-4 w-4" strokeWidth={2.25} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleUpdateStatus(record)}
                        className="rounded-lg p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--accent)]/10 hover:text-[var(--accent)]"
                        title={t('admin.orders.actions.update')}
                      >
                        <Pencil className="h-4 w-4" strokeWidth={2.25} />
                      </button>
                    </>
                  }
                />
              );
            })}
          </div>
        )}

        {pagination && pagination.totalPages > 1 && (
          <div className="px-5 py-4 border-t border-[var(--border-default)]">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(newPage) => setPage(newPage)}
            />
          </div>
        )}
      </div>

      {/* Modal chi tiết đơn hàng */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="glass-dialog max-w-[800px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="size-5" />
              {t('admin.orders.details.title')}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              {/* Thông tin cơ bản đơn hàng */}
              <div className="overflow-x-auto rounded-lg border border-[var(--border-default)]">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-[var(--border-default)]">
                      <td className="px-4 py-2 font-medium bg-white/[0.02] w-[200px]">
                        {t('admin.orders.details.orderNumber')}
                      </td>
                      <td className="px-4 py-2 font-semibold text-[var(--text-primary)]">
                        {selectedOrder.number}
                      </td>
                      <td className="px-4 py-2 font-medium bg-white/[0.02] w-[200px]">
                        {t('admin.orders.details.orderDate')}
                      </td>
                      <td className="px-4 py-2 text-[var(--text-secondary)]">
                        {formatDate(selectedOrder.createdAt)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-medium bg-white/[0.02]">
                        {t('admin.orders.details.orderStatus')}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[selectedOrder.status as keyof typeof STATUS_CONFIG]?.color || ''}`}
                        >
                          {(() => {
                            const Ic =
                              STATUS_CONFIG[selectedOrder.status as keyof typeof STATUS_CONFIG]
                                ?.Icon;
                            return Ic ? <Ic className="w-3.5 h-3.5 inline" /> : null;
                          })()}{' '}
                          {t(`admin.orders.status.${selectedOrder.status}`)}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-medium bg-white/[0.02]">
                        {t('admin.orders.details.paymentStatus')}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_STATUS_CONFIG[selectedOrder.paymentStatus as keyof typeof PAYMENT_STATUS_CONFIG]?.color || ''}`}
                        >
                          {(() => {
                            const Ic =
                              PAYMENT_STATUS_CONFIG[
                                selectedOrder.paymentStatus as keyof typeof PAYMENT_STATUS_CONFIG
                              ]?.Icon;
                            return Ic ? <Ic className="w-3.5 h-3.5 inline" /> : null;
                          })()}{' '}
                          {selectedOrder.paymentStatus === 'pending'
                            ? selectedOrder.paymentMethod === 'cod'
                              ? t('admin.orders.details.paymentInfo.cod')
                              : t('admin.orders.paymentStatus.pending')
                            : selectedOrder.paymentStatus === 'paid'
                              ? t('admin.orders.paymentStatus.paid')
                              : selectedOrder.paymentStatus === 'failed'
                                ? t('admin.orders.paymentStatus.failed')
                                : selectedOrder.paymentStatus === 'refunded'
                                  ? t('admin.orders.paymentStatus.refunded')
                                  : selectedOrder.paymentStatus}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Thông tin khách hàng & giao hàng */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-2">
                      <User className="size-4" />
                      {t('admin.orders.details.customer.title')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-tertiary)]">
                        {t('admin.orders.details.customer.name')}
                      </span>
                      <span className="text-[var(--text-primary)]">
                        {selectedOrder.User?.firstName} {selectedOrder.User?.lastName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-tertiary)]">
                        {t('admin.orders.details.customer.email')}
                      </span>
                      <span className="text-[var(--text-primary)]">
                        {selectedOrder.User?.email}
                      </span>
                    </div>
                    {selectedOrder.User?.phone && (
                      <div className="flex justify-between">
                        <span className="text-[var(--text-tertiary)]">
                          {t('admin.orders.details.customer.phone')}
                        </span>
                        <span className="text-[var(--text-primary)]">
                          {selectedOrder.User.phone}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">
                      {t('admin.orders.details.shipping.title')}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm space-y-1">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-tertiary)]">
                        {t('admin.orders.details.shipping.fullName')}
                      </span>
                      <span className="text-[var(--text-primary)]">
                        {selectedOrder.shippingFirstName} {selectedOrder.shippingLastName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-tertiary)]">
                        {t('admin.orders.details.shipping.phone')}
                      </span>
                      <span className="text-[var(--text-primary)]">
                        {selectedOrder.shippingPhone || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-tertiary)]">
                        {t('admin.orders.details.shipping.address')}
                      </span>
                      <span className="text-[var(--text-primary)] text-right max-w-[200px]">
                        {selectedOrder.shippingAddress1}
                        {selectedOrder.shippingAddress2
                          ? `, ${selectedOrder.shippingAddress2}`
                          : ''}
                        {`, ${selectedOrder.shippingCity}, ${selectedOrder.shippingState}`}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Thông tin thanh toán */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {t('admin.orders.details.paymentInfo.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-tertiary)]">
                        {t('admin.orders.details.paymentInfo.method')}
                      </span>
                      <span className="text-[var(--text-primary)]">
                        {selectedOrder.paymentMethod === 'cod'
                          ? t('admin.orders.details.paymentInfo.cod')
                          : selectedOrder.paymentMethod?.toUpperCase() || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-tertiary)]">
                        {t('admin.orders.details.paymentInfo.transaction')}
                      </span>
                      <span className="text-[var(--text-primary)]">
                        {selectedOrder.paymentTransactionId || 'N/A'}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Sản phẩm trong đơn hàng */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">{t('admin.orders.details.items.title')}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {selectedOrder.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 bg-white/[0.02] rounded-lg"
                      >
                        {item.Product?.images?.[0] && (
                          <img
                            src={item.Product.images[0]}
                            alt={item.Product.name}
                            className="w-[60px] h-[60px] rounded-lg object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-[var(--text-primary)] truncate">
                            {item.Product?.name || t('admin.orders.noItemsFound')}
                          </p>
                          <p className="text-sm text-[var(--text-tertiary)]">
                            {t('admin.orders.details.items.quantity')}: {item.quantity} x{' '}
                            {formatCurrency(item.unitPrice)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-base text-[var(--text-primary)]">
                            {formatCurrency(item.quantity * item.unitPrice)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Tóm tắt đơn hàng */}
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm">
                    {t('admin.orders.details.summary.title')}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">
                        {t('admin.orders.details.summary.subtotal')}:
                      </span>
                      <span className="text-[var(--text-primary)]">
                        {formatCurrency(selectedOrder.subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">
                        {t('admin.orders.details.summary.tax')}:
                      </span>
                      <span className="text-[var(--text-primary)]">
                        {formatCurrency(selectedOrder.tax)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[var(--text-secondary)]">
                        {t('admin.orders.details.summary.shipping')}:
                      </span>
                      <span className="text-[var(--text-primary)]">
                        {formatCurrency(selectedOrder.shippingCost)}
                      </span>
                    </div>
                    {selectedOrder.discount > 0 && (
                      <div
                        className="flex justify-between"
                        style={{ color: 'var(--color-success)' }}
                      >
                        <span>{t('admin.orders.details.summary.discount')}:</span>
                        <span>-{formatCurrency(selectedOrder.discount)}</span>
                      </div>
                    )}
                    <hr className="border-[var(--border-default)] my-2" />
                    <div className="flex justify-between">
                      <span className="font-semibold text-base text-[var(--text-primary)]">
                        {t('admin.orders.details.summary.total')}:
                      </span>
                      <span
                        className="font-semibold text-base"
                        style={{ color: 'var(--color-info)' }}
                      >
                        {formatCurrency(selectedOrder.total)}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal cập nhật trạng thái */}
      <Dialog
        open={isUpdateModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsUpdateModalOpen(false);
            setUpdateForm({ status: '', paymentStatus: '', note: '' });
            setSelectedOrder(null);
            setValidationError('');
          }
        }}
      >
        <DialogContent className="glass-dialog max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="w-5 h-5" />
              {t('admin.orders.updateStatus.title')}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <Alert variant="info">
                <Info className="size-4" />
                <AlertDescription>
                  {t('admin.orders.details.orderNumber')}: {selectedOrder.number}
                  <br />
                  {t('admin.orders.updateStatus.currentStatus')}:{' '}
                  {t(`admin.orders.status.${selectedOrder.status}`)}
                </AlertDescription>
              </Alert>

              {validationError && (
                <Alert variant="destructive">
                  <AlertDescription>{validationError}</AlertDescription>
                </Alert>
              )}

              <div>
                <Label>{t('admin.orders.updateStatus.newStatus')}</Label>
                <Select value={updateForm.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t('admin.orders.updateStatus.selectNewStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    {updateStatusOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(`admin.orders.status.${option.value}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>{t('admin.orders.details.paymentStatus')}</Label>
                <Select
                  value={updateForm.paymentStatus}
                  onValueChange={(value) => {
                    setUpdateForm((prev) => ({ ...prev, paymentStatus: value }));
                    setValidationError('');
                  }}
                  disabled={
                    updateForm.status === 'delivered' && selectedOrder.paymentMethod === 'cod'
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder={t('admin.orders.details.paymentStatus')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">
                      {t('admin.orders.paymentStatus.pending')}
                    </SelectItem>
                    <SelectItem value="paid">{t('admin.orders.paymentStatus.paid')}</SelectItem>
                    <SelectItem value="failed">{t('admin.orders.paymentStatus.failed')}</SelectItem>
                    <SelectItem value="refunded">
                      {t('admin.orders.paymentStatus.refunded')}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {getPaymentNote() && (
                  <p className="text-xs text-[var(--color-warning)] mt-1">{getPaymentNote()}</p>
                )}
              </div>

              <div>
                <Label>{t('admin.orders.updateStatus.note')}</Label>
                <textarea
                  rows={3}
                  value={updateForm.note}
                  onChange={(e) => setUpdateForm((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder={t('admin.orders.updateStatus.notePlaceholder')}
                  className="mt-1 flex w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] dark:bg-white/[0.03] px-3 py-2 text-sm text-[var(--text-primary)] text-[var(--text-primary)] shadow-sm transition-colors placeholder:text-[var(--text-tertiary)] dark:placeholder:text-[var(--text-tertiary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:border-[var(--accent)]"
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsUpdateModalOpen(false);
                setSelectedOrder(null);
              }}
            >
              {t('admin.orders.updateStatus.cancel')}
            </Button>
            <Button
              onClick={handleStatusUpdate}
              className="admin-btn-primary"
              disabled={isUpdating}
            >
              {isUpdating ? t('common.loading') : t('admin.orders.updateStatus.update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdersPage;
