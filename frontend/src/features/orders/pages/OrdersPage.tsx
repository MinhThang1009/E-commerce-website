/**
 * @file OrdersPage.tsx
 * @layer Page
 * @feature orders
 * @description Page component của feature orders
 */
import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES, buildRoute } from '@/routes/paths';
import { useQueryClient } from '@tanstack/react-query';
import { useCartStore } from '@/stores/cart-store';
import { useAuthStore } from '@/stores/auth-store';
import Button from '@/components/common/Button';
import Badge, { BadgeVariant } from '@/components/common/Badge';
import PremiumButton from '@/components/common/PremiumButton';
import { EmptyState } from '@/components/common/ErrorState';
import { Package, Search, CheckCircle, Clock } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import {
  useGetUserOrdersQuery,
  useCancelOrderMutation,
  useRepayOrderMutation,
  useConfirmReceivedMutation,
} from '../api/order-api';
import { cartKeys, useClearCartMutation } from '@/features/cart';
import { getLocale } from '@/utils/format';
import { useNotifications } from '@/hooks/use-notifications';
import { ReviewModal } from '@/features/reviews';
import { OrderDetails } from '@/features/orders';

// Màu sắc trạng thái thanh toán
const paymentStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  refunded: 'bg-gray-100 text-gray-800 dark:bg-neutral-900/30 dark:text-gray-300',
};

const OrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const { showNotification } = useNotifications();

  const statusVariants: Record<string, { variant: BadgeVariant; label: string }> = {
    pending: { variant: 'warning', label: t('order.status.pending') },
    processing: { variant: 'info', label: t('order.status.processing') },
    shipped: { variant: 'primary', label: t('order.status.shipped') },
    delivered: { variant: 'success', label: t('order.status.delivered') },
    cancelled: { variant: 'error', label: t('order.status.cancelled') },
  };
  const navigate = useNavigate();
  const location = useLocation();
  const clearLocalCart = useCartStore((s) => s.clearLocalCart);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const queryClient = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);
  const [repayingOrder, setRepayingOrder] = useState<string | null>(null);
  const [confirmingOrder, setConfirmingOrder] = useState<string | null>(null);

  // Trạng thái modal đánh giá
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewProduct, setReviewProduct] = useState<{ id: string; name: string } | null>(null);

  const handleOpenReview = (productId: string, productName: string) => {
    setSelectedOrder(null);
    setReviewProduct({ id: productId, name: productName });
    setReviewModalOpen(true);
  };

  // Lấy danh sách đơn hàng
  const {
    data: ordersResponse,
    isLoading,
    isError,
    error: _error,
    refetch,
  } = useGetUserOrdersQuery(
    { page: currentPage, limit: 10 },
    { enabled: !!user || isAuthenticated },
  );

  // Mutation hủy đơn hàng
  const { mutateAsync: cancelOrder } = useCancelOrderMutation();

  // Mutation thanh toán lại đơn hàng
  const { mutateAsync: repayOrder } = useRepayOrderMutation();

  // Mutation xác nhận đã nhận hàng
  const { mutateAsync: confirmReceived } = useConfirmReceivedMutation();

  // Mutation xóa giỏ hàng trên server (dự phòng)
  const { mutate: clearServerCart } = useClearCartMutation();

  // Xử lý thanh toán thành công từ URL redirect (VNPay, MoMo)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('payment') === 'success') {
      clearLocalCart();
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
      queryClient.invalidateQueries({ queryKey: cartKeys.count });

      // Cũng gọi clearServerCart mutation để chắc chắn
      clearServerCart();

      // Hiển thị thông báo thành công một lần
      showNotification({ message: t('checkout.success.message'), type: 'success' });

      // Xóa query param để tránh kích hoạt lại khi tải lại trang
      navigate('/orders', { replace: true });
    } else if (params.get('payment') === 'failed') {
      showNotification({ message: t('payment.errors.failed'), type: 'error' });
      navigate('/orders', { replace: true });
    }
  }, [
    location.search,
    navigate,
    t,
    clearLocalCart,
    queryClient,
    clearServerCart,
    showNotification,
  ]);

  // Bật/tắt chi tiết đơn hàng
  const toggleOrderDetails = (orderId: string) => {
    setSelectedOrder(selectedOrder === orderId ? null : orderId);
  };

  // Xử lý hủy đơn hàng
  const handleCancelOrder = async (orderId: string) => {
    if (!confirm(t('orders.cancelConfirm'))) return;

    setCancellingOrder(orderId);
    try {
      await cancelOrder(orderId);
      refetch();
    } catch (error) {
      console.error('Không thể hủy đơn hàng:', error);
      showNotification({ message: t('common.error'), type: 'error' });
    } finally {
      setCancellingOrder(null);
    }
  };

  // Xử lý thanh toán lại đơn hàng online đang chờ thanh toán (payment fail/bỏ dở)
  const handleRepayOrder = async (orderId: string) => {
    if (!confirm(t('orders.repayConfirm'))) return;

    setRepayingOrder(orderId);
    try {
      const response = await repayOrder(orderId);

      // Kiểm tra nếu đơn hàng dùng phương thức chuyển khoản và chuyển hướng đến trang PaymentQR
      if (
        response.data?.order?.paymentMethod === 'bank_transfer' ||
        response.data?.order?.paymentMethod === 'bank_transfer_qr'
      ) {
        // Điều hướng đến trang PaymentQR với thông tin đơn hàng
        navigate(
          buildRoute.paymentQr(
            response.data.order.id,
            response.data.order.total,
            response.data.order.number,
          ),
        );
      } else if (response.data?.paymentUrl) {
        // Với các phương thức thanh toán khác, dùng URL thanh toán do API trả về
        window.location.href = response.data.paymentUrl;
      } else {
        // Nếu không có URL thanh toán và không phải chuyển khoản, ở lại trang đơn hàng và hiển thị thông báo thành công
        showNotification({ message: t('payment.initializingPayment'), type: 'success' });
        // Tải lại danh sách đơn hàng
        refetch();
      }
    } catch (error) {
      console.error('Không thể thanh toán lại đơn hàng:', error);
      showNotification({ message: t('payment.errors.initializationFailed'), type: 'error' });
    } finally {
      setRepayingOrder(null);
    }
  };

  // Xử lý xác nhận đã nhận hàng
  const handleConfirmReceived = async (orderId: string) => {
    if (!confirm(t('orders.confirmReceivedPrompt'))) return;

    setConfirmingOrder(orderId);
    try {
      await confirmReceived(orderId);
      showNotification({ message: t('orders.receivedSuccess'), type: 'success' });
      refetch();
    } catch (error) {
      console.error('Không thể xác nhận đã nhận hàng:', error);
      showNotification({ message: t('common.error'), type: 'error' });
    } finally {
      setConfirmingOrder(null);
    }
  };

  // Xử lý phân trang
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedOrder(null);
  };

  // Định dạng tiền tệ — luôn VND, locale động theo ngôn ngữ UI
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(getLocale(), {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  // Định dạng ngày giờ theo locale hiện tại
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString(getLocale(), {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!user && !isAuthenticated) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="max-w-md mx-auto bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-8">
          <div className="text-primary-500 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-4">
            {t('orders.loginRequired')}
          </h1>
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">{t('orders.loginMessage')}</p>
          <PremiumButton
            variant="primary"
            size="large"
            iconType="arrow-right"
            onClick={/* istanbul ignore next */ () => (window.location.href = '/login')}
            className="w-full"
          >
            {t('auth.register.signInLink')}
          </PremiumButton>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold text-neutral-800 dark:text-neutral-100 mb-8">
          {t('orders.title')}
        </h1>
        <div className="space-y-6">
          {[...Array(3)].map((_, index) => (
            <div
              key={index}
              className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6 animate-pulse"
            >
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-32 mb-2"></div>
                  <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-24"></div>
                </div>
                <div className="h-6 bg-neutral-200 dark:bg-neutral-700 rounded w-20"></div>
              </div>
              <div className="flex items-center">
                <div className="w-12 h-12 bg-neutral-200 dark:bg-neutral-700 rounded-md mr-4"></div>
                <div>
                  <div className="h-4 bg-neutral-200 dark:bg-neutral-700 rounded w-20 mb-1"></div>
                  <div className="h-5 bg-neutral-200 dark:bg-neutral-700 rounded w-16"></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="container mx-auto px-4 py-8 text-center">
        <div className="max-w-md mx-auto bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-8">
          <div className="text-error-500 mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
            {t('orders.error.title')}
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 mb-6">{t('orders.error.message')}</p>
          <Button variant="primary" onClick={() => refetch()}>
            {t('orders.tryAgain')}
          </Button>
        </div>
      </div>
    );
  }

  const allOrders = ordersResponse?.data || [];
  const filteredByStatus =
    statusFilter === 'all'
      ? allOrders
      : allOrders.filter((o: { status: string }) => o.status === statusFilter);
  const orders = searchQuery
    ? filteredByStatus.filter((o: { number: string }) =>
        o.number?.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : filteredByStatus;
  const totalPages =
    statusFilter === 'all'
      ? ordersResponse
        ? Math.ceil(ordersResponse.total / ordersResponse.limit)
        : 1
      : 1;

  return (
    <div className="min-h-screen bg-neutral-100/50 dark:bg-neutral-950">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
              <Package className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100">
                {t('orders.title')}
              </h1>
              <p className="text-sm text-neutral-500 dark:text-neutral-400">
                {ordersResponse?.total || 0} {t('orders.ordersTotal')}
              </p>
            </div>
          </div>
        </div>

        {/* Search + filter */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t('orders.searchPlaceholder')}
            className="input pl-10 !mb-0"
          />
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-1 no-scrollbar">
          {[
            {
              key: 'all',
              label: t('orders.filterAll'),
              color: 'bg-neutral-200 dark:bg-neutral-700 text-neutral-800 dark:text-neutral-200',
            },
            {
              key: 'pending',
              label: t('orders.status.pending'),
              color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400',
            },
            {
              key: 'processing',
              label: t('orders.status.processing'),
              color: 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400',
            },
            {
              key: 'shipped',
              label: t('orders.status.shipped'),
              color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400',
            },
            {
              key: 'delivered',
              label: t('orders.status.delivered'),
              color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400',
            },
            {
              key: 'cancelled',
              label: t('orders.status.cancelled'),
              color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
            },
          ].map((tab) => {
            const count =
              tab.key === 'all'
                ? allOrders.length
                : allOrders.filter((o: { status: string }) => o.status === tab.key).length;
            return (
              <button
                key={tab.key}
                onClick={() => {
                  setStatusFilter(tab.key);
                  setCurrentPage(1);
                }}
                className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                  statusFilter === tab.key
                    ? `${tab.color} shadow-sm`
                    : 'bg-transparent text-neutral-500 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span
                    className={`ml-1.5 text-xs ${statusFilter === tab.key ? 'opacity-80' : 'opacity-60'}`}
                  >
                    ({count})
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {orders.length === 0 ? (
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm">
            {statusFilter !== 'all' ? (
              <EmptyState
                variant="search"
                title={t('orders.filterEmpty')}
                description={t('orders.filterEmptyDesc')}
                actionLabel={t('orders.filterAll')}
                onAction={() => setStatusFilter('all')}
              />
            ) : (
              <EmptyState
                variant="orders"
                title={t('orders.empty.title')}
                description={t('orders.empty.message')}
                actionLabel={t('orders.empty.startShopping')}
                onAction={() => navigate(ROUTES.SHOP)}
              />
            )}
          </div>
        ) : (
          <>
            <div className="space-y-4">
              {orders.map((order) => {
                const statusBorderColors: Record<string, string> = {
                  pending: '#f59e0b',
                  processing: '#38bdf8',
                  shipped: '#6366f1',
                  delivered: '#10b981',
                  cancelled: '#ef4444',
                };

                return (
                  <div
                    key={order.id}
                    className={`group/card bg-white dark:bg-neutral-800/90 rounded-2xl shadow-sm border border-neutral-200 dark:border-neutral-700 overflow-hidden hover:shadow-lg hover:shadow-primary-500/5 hover:-translate-y-0.5 dark:hover:border-neutral-600 dark:hover:shadow-primary-400/5 transition-all duration-300 ${order.status === 'cancelled' ? 'opacity-60 hover:opacity-90' : ''}`}
                    style={{
                      borderLeft: `4px solid ${statusBorderColors[order.status] || '#a3a3a3'}`,
                    }}
                  >
                    {/* Tiêu đề đơn hàng */}
                    <div
                      className="p-6 border-b border-neutral-100 dark:border-neutral-700/60 bg-gradient-to-r from-neutral-50/80 to-transparent dark:from-neutral-800/60 cursor-pointer hover:from-neutral-100/80 dark:hover:from-neutral-700/60 transition-all"
                      onClick={() => toggleOrderDetails(order.id)}
                    >
                      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 flex-1">
                          <div>
                            <div className="flex items-center gap-3 mb-1">
                              <h2 className="text-lg font-bold text-neutral-800 dark:text-neutral-100">
                                {t('orders.orderNumber', { number: order.number })}
                              </h2>
                              <Badge variant={statusVariants[order.status].variant}>
                                {t(`orders.status.${order.status}`)}
                              </Badge>
                            </div>
                            <p className="text-sm text-neutral-500 dark:text-neutral-400 flex items-center gap-1">
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
                                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 00-2 2z"
                                />
                              </svg>
                              {t('orders.placedOn', {
                                date: formatDate(order.createdAt),
                              })}
                              {order.paymentMethod && (
                                <span className="ml-2 pl-2 border-l border-neutral-300 dark:border-neutral-700">
                                  {t(`orders.paymentMethods.${order.paymentMethod.toLowerCase()}`, {
                                    defaultValue: order.paymentMethod,
                                  })}
                                </span>
                              )}
                            </p>
                          </div>

                          <div className="sm:ml-auto flex items-center gap-4">
                            <div className="text-right">
                              <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                                {t('orders.total')}
                              </p>
                              <p className="text-2xl font-black text-neutral-900 dark:text-white">
                                {formatCurrency(order.total)}
                              </p>
                            </div>
                            {order.paymentStatus && (
                              <span
                                className={`inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full shadow-sm ${
                                  paymentStatusColors[order.paymentStatus]
                                }`}
                              >
                                {order.paymentStatus === 'paid' && (
                                  <CheckCircle className="w-3.5 h-3.5" />
                                )}
                                {(order.paymentStatus === 'pending' ||
                                  order.paymentStatus === 'failed') && (
                                  <Clock className="w-3.5 h-3.5" />
                                )}
                                {order.paymentStatus === 'pending' && order.paymentMethod === 'cod'
                                  ? t('orders.paymentStatus.cod')
                                  : t(`orders.paymentStatus.${order.paymentStatus}`)}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-2 lg:border-l lg:pl-4 border-neutral-200 dark:border-neutral-700">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => toggleOrderDetails(order.id)}
                            className="bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 dark:text-neutral-200 border-neutral-200 dark:border-neutral-600 shadow-sm"
                          >
                            {selectedOrder === order.id
                              ? t('orders.hideDetails')
                              : t('orders.viewDetails')}
                          </Button>

                          {(order.status === 'pending' || order.status === 'processing') && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancelOrder(order.id)}
                              disabled={cancellingOrder === order.id}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20 border border-transparent hover:border-red-200 dark:hover:border-red-800/40"
                            >
                              {cancellingOrder === order.id
                                ? t('orders.cancelling')
                                : t('orders.cancelOrder')}
                            </Button>
                          )}

                          {order.status === 'pending' &&
                            order.paymentStatus !== 'paid' &&
                            order.paymentMethod !== 'cod' && (
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => handleRepayOrder(order.id)}
                                disabled={repayingOrder === order.id}
                                className="bg-amber-500 hover:bg-amber-600 text-white border-none shadow-md font-semibold px-4 py-2 transition-all hover:scale-[1.02]"
                              >
                                {repayingOrder === order.id
                                  ? t('orders.repaying')
                                  : t('orders.repayOrder')}
                              </Button>
                            )}

                          {(order.status === 'shipped' || order.status === 'processing') && (
                            <Button
                              variant="primary"
                              size="sm"
                              onClick={() => handleConfirmReceived(order.id)}
                              disabled={confirmingOrder === order.id}
                              className="bg-green-600 hover:bg-green-700 text-white border-none shadow-md flex items-center justify-center gap-2 font-semibold px-4 py-2 transition-all hover:scale-[1.02]"
                            >
                              {confirmingOrder === order.id
                                ? t('orders.confirming')
                                : t('orders.confirmReceived')}
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Mini progress bar — màu theo status */}
                    {order.status !== 'cancelled' && (
                      <div className="px-6 pt-3">
                        <div className="h-1.5 bg-neutral-200 dark:bg-neutral-700 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.max(25, (['pending', 'processing', 'shipped', 'delivered'].indexOf(order.status) + 1) * 25)}%`,
                              background:
                                (
                                  {
                                    pending: 'linear-gradient(to right, #fbbf24, #f59e0b)',
                                    processing: 'linear-gradient(to right, #7dd3fc, #38bdf8)',
                                    shipped: 'linear-gradient(to right, #818cf8, #6366f1)',
                                    delivered: 'linear-gradient(to right, #34d399, #10b981)',
                                  } as Record<string, string>
                                )[order.status] || '#a3a3a3',
                            }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Xem trước sản phẩm trong đơn hàng */}
                    <div className="p-6 pt-4">
                      {order.items && order.items.length > 0 ? (
                        <div className="flex items-center gap-4">
                          <div className="flex gap-2 flex-wrap">
                            {order.items.slice(0, 4).map((item) => (
                              <div
                                key={item.id}
                                className="w-14 h-14 rounded-xl border border-neutral-100 dark:border-neutral-700 overflow-hidden bg-neutral-50 dark:bg-neutral-800 flex-shrink-0 shadow-sm hover:scale-105 transition-transform"
                              >
                                {item.Product?.thumbnail ||
                                item.Product?.images?.[0] ||
                                item.image ? (
                                  <img
                                    src={
                                      item.Product?.thumbnail ||
                                      item.Product?.images?.[0] ||
                                      item.image
                                    }
                                    alt={item.Product?.name || item.name}
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center text-xs font-medium text-neutral-400">
                                    {item.Product?.name?.charAt(0) || item.name?.charAt(0) || '?'}
                                  </div>
                                )}
                              </div>
                            ))}
                            {order.items.length > 4 && (
                              <div className="w-12 h-12 rounded-lg border border-neutral-100 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 flex items-center justify-center text-xs font-bold text-neutral-500 shadow-sm">
                                +{order.items.length - 4}
                              </div>
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-neutral-800 dark:text-neutral-200">
                              {t('orders.items', { count: order.items.length })}
                            </p>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400">
                              {order.items
                                .slice(0, 2)
                                .map((item) => item.Product?.name)
                                .join(', ')}
                              {order.items.length > 2 && '...'}
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-4">
                          <p className="text-neutral-500 dark:text-neutral-400">
                            {t('orders.noItemsFound')}
                          </p>
                        </div>
                      )}

                      {/* Thông tin vận chuyển */}
                      {(order.trackingNumber || order.estimatedDelivery) && (
                        <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm">
                            {order.trackingNumber && (
                              <div>
                                <span className="text-neutral-500 dark:text-neutral-400">
                                  {t('orders.tracking')}:{' '}
                                </span>
                                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                                  {order.trackingNumber}
                                </span>
                              </div>
                            )}
                            {order.estimatedDelivery && (
                              <div>
                                <span className="text-neutral-500 dark:text-neutral-400">
                                  {t('orders.estimatedDelivery')}:{' '}
                                </span>
                                <span className="font-medium text-neutral-800 dark:text-neutral-200">
                                  {formatDate(order.estimatedDelivery)}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Order Detail Dialog */}
            <Dialog
              open={!!selectedOrder}
              onOpenChange={/* istanbul ignore next */ (open) => !open && setSelectedOrder(null)}
            >
              <DialogContent className="max-w-[800px] max-h-[85vh] overflow-y-auto p-0 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 data-[state=open]:duration-200">
                {selectedOrder && (
                  <OrderDetails orderId={selectedOrder} onOpenReview={handleOpenReview} />
                )}
              </DialogContent>
            </Dialog>

            {/* Phân trang */}
            {totalPages > 1 && !searchQuery && (
              <div className="mt-8 flex justify-center">
                <div className="flex items-center gap-1 bg-white dark:bg-neutral-800 rounded-xl p-1 border border-neutral-200 dark:border-neutral-700 shadow-sm">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage === 1}
                  >
                    {t('common.previous')}
                  </Button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter(
                      (page) =>
                        page === 1 || page === totalPages || Math.abs(page - currentPage) <= 2,
                    )
                    .map((page, index, array) => (
                      <div key={page} className="flex items-center">
                        {index > 0 && array[index - 1] !== page - 1 && (
                          <span className="px-2 text-neutral-400">...</span>
                        )}
                        <Button
                          variant={page === currentPage ? 'primary' : 'ghost'}
                          size="sm"
                          onClick={() => handlePageChange(page)}
                        >
                          {page}
                        </Button>
                      </div>
                    ))}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage === totalPages}
                  >
                    {t('common.next')}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
        {/* Modal đánh giá */}
        {reviewProduct && (
          <ReviewModal
            isOpen={reviewModalOpen}
            onClose={() => {
              setReviewModalOpen(false);
              setReviewProduct(null);
            }}
            productId={reviewProduct.id}
            productName={reviewProduct.name}
            onSuccess={() => refetch()} // có thể cần khóa nút đánh giá nếu đã implement khóa ở backend
          />
        )}
      </div>
    </div>
  );
};

export default OrdersPage;
