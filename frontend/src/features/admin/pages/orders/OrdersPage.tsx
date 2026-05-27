/**
 * @file OrdersPage.tsx
 * @layer Page
 * @feature orders
 * @description Page component của feature orders
 */
import React, { useState, useCallback } from 'react';
import {
  Search,
  Eye,
  Pencil,
  RefreshCw,
  ShoppingCart,
  User,
  Calendar,
  DollarSign,
  Info,
} from 'lucide-react';

import dayjs from 'dayjs';
import { useGetAdminOrdersQuery, useUpdateOrderStatusMutation, AdminOrder } from '@/features/admin';
import styles from './OrdersPage.module.css';
import { useTranslation } from 'react-i18next';
import { getLocale } from '@/utils/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

// Cấu hình trạng thái với màu sắc và icon
const STATUS_CONFIG = {
  pending: {
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    icon: '⏳',
  },
  processing: {
    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    icon: '🔄',
  },
  shipped: {
    color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
    icon: '🚚',
  },
  delivered: {
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    icon: '✅',
  },
  cancelled: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: '❌' },
};

const PAYMENT_STATUS_CONFIG = {
  pending: {
    color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
    icon: '⏳',
  },
  paid: {
    color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    icon: '✅',
  },
  failed: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: '❌' },
  refunded: {
    color: 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300',
    icon: '🔄',
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

  // Quản lý state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
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

  // Định dạng tiền tệ — luôn VND, locale động theo ngôn ngữ UI
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat(getLocale(), {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  }, []);

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

  // Component loading
  if (isLoading) {
    return (
      <div className="p-6 text-center">
        <div className="animate-spin w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full mx-auto" />
        <p className="mt-4 text-neutral-500 dark:text-neutral-400">{t('common.loading')}</p>
      </div>
    );
  }

  // Component lỗi
  if (error) {
    console.error('OrdersPage: Lỗi API', error);
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertDescription className="flex items-center justify-between">
            <span>{t('admin.orders.messages.loadError')}</span>
            <Button size="sm" variant="destructive" onClick={() => refetch()}>
              {t('admin.orders.messages.retry')}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className={`${styles.ordersPage} dark:bg-neutral-900 dark:!bg-neutral-900`}>
      {/* Tiêu đề trang */}
      <div className={styles.pageHeader}>
        <h2 className={`${styles.pageTitle} dark:text-white text-xl md:text-2xl font-semibold`}>
          <ShoppingCart className="size-6" />
          {t('admin.orders.title')}
        </h2>
        <p className="text-neutral-500 dark:text-neutral-400">{t('admin.orders.subtitle')}</p>
      </div>

      {/* Bộ lọc */}
      <Card className={`${styles.filterCard} dark:bg-neutral-800 mb-6`}>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
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
            <div className="sm:col-span-2 lg:col-span-2 flex justify-end">
              <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
                <RefreshCw className={`size-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                {t('admin.orders.messages.retry')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bảng đơn hàng */}
      <Card className={`${styles.tableCard} dark:bg-neutral-800`}>
        <CardContent className="pt-6">
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
                  <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300 w-[120px]">
                    {t('admin.orders.table.orderNumber')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300 w-[200px]">
                    {t('admin.orders.table.customer')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300 w-[140px]">
                    {t('admin.orders.table.createdAt')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300 w-[120px]">
                    {t('admin.orders.table.total')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300 w-[120px]">
                    {t('common.status')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300 w-[120px]">
                    {t('admin.orders.table.payment')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300 w-[120px] sticky right-0 bg-neutral-50 dark:bg-neutral-800">
                    {t('admin.common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-neutral-500">
                      {t('admin.orders.noOrdersFound')}
                    </td>
                  </tr>
                ) : (
                  orders.map((record: AdminOrder) => {
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
                        {warning ? '⚠️ ' : paymentConfig?.icon + ' '}
                        {paymentStatusText}
                      </span>
                    );

                    return (
                      <tr
                        key={record.id}
                        className="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                      >
                        <td className="px-4 py-3">
                          <div>
                            <span className="font-semibold dark:text-white">#{record.number}</span>
                            <br />
                            <span className="text-xs text-neutral-500">
                              {t('admin.orders.table.itemCount', {
                                count: record.items?.length || 0,
                              })}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <User className="size-4 text-neutral-400" />
                              <span className="font-semibold dark:text-white">
                                {record.User?.firstName} {record.User?.lastName}
                              </span>
                            </div>
                            <span className="text-xs text-neutral-500">{record.User?.email}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Calendar className="size-4 text-neutral-400" />
                            <span className="dark:text-neutral-300">
                              {formatDate(record.createdAt)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <DollarSign className="size-4 text-neutral-400" />
                            <span className="font-semibold" style={{ color: 'var(--admin-info)' }}>
                              {formatCurrency(record.total)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`${styles.statusTag} inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${statusConfig?.color || ''}`}
                          >
                            {statusConfig?.icon} {t(`admin.orders.status.${record.status}`)}
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
                        <td className="px-4 py-3 sticky right-0 bg-white dark:bg-neutral-900">
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleViewDetails(record)}
                              title={t('admin.orders.actions.view')}
                            >
                              <Eye className="size-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleUpdateStatus(record)}
                              title={t('admin.orders.actions.update')}
                            >
                              <Pencil className="size-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Phân trang */}
          {pagination && pagination.totalPages > 1 && (
            <div className={`${styles.paginationContainer} dark:border-neutral-700`}>
              <Pagination
                currentPage={page}
                totalPages={totalPages}
                onPageChange={(newPage) => setPage(newPage)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal chi tiết đơn hàng */}
      <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
        <DialogContent className="max-w-[800px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="size-5" />
              {t('admin.orders.details.title')}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              {/* Thông tin cơ bản đơn hàng */}
              <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
                <table className="w-full text-sm">
                  <tbody>
                    <tr className="border-b border-neutral-200 dark:border-neutral-700">
                      <td className="px-4 py-2 font-medium bg-neutral-50 dark:bg-neutral-800 w-[200px]">
                        {t('admin.orders.details.orderNumber')}
                      </td>
                      <td className="px-4 py-2 font-semibold dark:text-white">
                        #{selectedOrder.number}
                      </td>
                      <td className="px-4 py-2 font-medium bg-neutral-50 dark:bg-neutral-800 w-[200px]">
                        {t('admin.orders.details.orderDate')}
                      </td>
                      <td className="px-4 py-2 dark:text-neutral-300">
                        {formatDate(selectedOrder.createdAt)}
                      </td>
                    </tr>
                    <tr>
                      <td className="px-4 py-2 font-medium bg-neutral-50 dark:bg-neutral-800">
                        {t('admin.orders.details.orderStatus')}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[selectedOrder.status as keyof typeof STATUS_CONFIG]?.color || ''}`}
                        >
                          {STATUS_CONFIG[selectedOrder.status as keyof typeof STATUS_CONFIG]?.icon}{' '}
                          {t(`admin.orders.status.${selectedOrder.status}`)}
                        </span>
                      </td>
                      <td className="px-4 py-2 font-medium bg-neutral-50 dark:bg-neutral-800">
                        {t('admin.orders.details.paymentStatus')}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${PAYMENT_STATUS_CONFIG[selectedOrder.paymentStatus as keyof typeof PAYMENT_STATUS_CONFIG]?.color || ''}`}
                        >
                          {
                            PAYMENT_STATUS_CONFIG[
                              selectedOrder.paymentStatus as keyof typeof PAYMENT_STATUS_CONFIG
                            ]?.icon
                          }{' '}
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
                      <span className="text-neutral-500">
                        {t('admin.orders.details.customer.name')}
                      </span>
                      <span className="dark:text-neutral-200">
                        {selectedOrder.User?.firstName} {selectedOrder.User?.lastName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">
                        {t('admin.orders.details.customer.email')}
                      </span>
                      <span className="dark:text-neutral-200">{selectedOrder.User?.email}</span>
                    </div>
                    {selectedOrder.User?.phone && (
                      <div className="flex justify-between">
                        <span className="text-neutral-500">
                          {t('admin.orders.details.customer.phone')}
                        </span>
                        <span className="dark:text-neutral-200">{selectedOrder.User.phone}</span>
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
                      <span className="text-neutral-500">
                        {t('admin.orders.details.shipping.fullName')}
                      </span>
                      <span className="dark:text-neutral-200">
                        {selectedOrder.shippingFirstName} {selectedOrder.shippingLastName}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">
                        {t('admin.orders.details.shipping.phone')}
                      </span>
                      <span className="dark:text-neutral-200">
                        {selectedOrder.shippingPhone || 'N/A'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">
                        {t('admin.orders.details.shipping.address')}
                      </span>
                      <span className="dark:text-neutral-200 text-right max-w-[200px]">
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
                      <span className="text-neutral-500">
                        {t('admin.orders.details.paymentInfo.method')}
                      </span>
                      <span className="dark:text-neutral-200">
                        {selectedOrder.paymentMethod === 'cod'
                          ? t('admin.orders.details.paymentInfo.cod')
                          : selectedOrder.paymentMethod.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-500">
                        {t('admin.orders.details.paymentInfo.transaction')}
                      </span>
                      <span className="dark:text-neutral-200">
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
                        className="flex items-center gap-3 p-3 bg-neutral-50 dark:bg-neutral-800 rounded-lg"
                      >
                        {item.Product?.images?.[0] && (
                          <img
                            src={item.Product.images[0]}
                            alt={item.Product.name}
                            className="w-[60px] h-[60px] rounded-lg object-cover"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold dark:text-white truncate">
                            {item.Product?.name || t('admin.orders.noItemsFound')}
                          </p>
                          <p className="text-sm text-neutral-500">
                            {t('admin.orders.details.items.quantity')}: {item.quantity} x{' '}
                            {formatCurrency(item.unitPrice)}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-base dark:text-white">
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
                      <span className="text-neutral-600 dark:text-neutral-400">
                        {t('admin.orders.details.summary.subtotal')}:
                      </span>
                      <span className="dark:text-neutral-200">
                        {formatCurrency(selectedOrder.subtotal)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600 dark:text-neutral-400">
                        {t('admin.orders.details.summary.tax')}:
                      </span>
                      <span className="dark:text-neutral-200">
                        {formatCurrency(selectedOrder.tax)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-neutral-600 dark:text-neutral-400">
                        {t('admin.orders.details.summary.shipping')}:
                      </span>
                      <span className="dark:text-neutral-200">
                        {formatCurrency(selectedOrder.shippingCost)}
                      </span>
                    </div>
                    {selectedOrder.discount > 0 && (
                      <div
                        className="flex justify-between"
                        style={{ color: 'var(--admin-success)' }}
                      >
                        <span>{t('admin.orders.details.summary.discount')}:</span>
                        <span>-{formatCurrency(selectedOrder.discount)}</span>
                      </div>
                    )}
                    <hr className="border-neutral-200 dark:border-neutral-700 my-2" />
                    <div className="flex justify-between">
                      <span className="font-semibold text-base dark:text-white">
                        {t('admin.orders.details.summary.total')}:
                      </span>
                      <span
                        className="font-semibold text-base"
                        style={{ color: 'var(--admin-info)' }}
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
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Pencil className="size-5" />
              {t('admin.orders.updateStatus.title')}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              <Alert variant="info">
                <Info className="size-4" />
                <AlertDescription>
                  {t('admin.orders.details.orderNumber')}: #{selectedOrder.number}
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
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                    {getPaymentNote()}
                  </p>
                )}
              </div>

              <div>
                <Label>{t('admin.orders.updateStatus.note')}</Label>
                <textarea
                  rows={3}
                  value={updateForm.note}
                  onChange={(e) => setUpdateForm((prev) => ({ ...prev, note: e.target.value }))}
                  placeholder={t('admin.orders.updateStatus.notePlaceholder')}
                  className="mt-1 flex w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 shadow-sm transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:border-primary-500"
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
            <Button onClick={handleStatusUpdate} disabled={isUpdating}>
              {isUpdating ? t('common.loading') : t('admin.orders.updateStatus.update')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default OrdersPage;
