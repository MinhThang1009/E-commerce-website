import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { clearCart } from '@/features/cart/cartSlice';
import Button from '@/components/common/Button';
import {
  ShoppingBagIcon,
} from '@heroicons/react/24/outline';
import Badge, { BadgeVariant } from '@/components/common/Badge';
import PremiumButton from '@/components/common/PremiumButton';
import {
  useGetUserOrdersQuery,
  useCancelOrderMutation,
  useRepayOrderMutation,
  useConfirmReceivedMutation,
} from '@/services/orderApi';
import { cartApi, useClearCartMutation } from '@/services/cartApi';
import { formatPrice } from '@/utils/format';
import { RootState } from '@/store';
import { toast } from '@/utils/toast';
import ReviewModal from '@/components/reviews/ReviewModal';
import OrderDetails from '@/components/orders/OrderDetails';

// Order status badge variants
const statusVariants: Record<string, { variant: BadgeVariant; label: string }> =
{
  pending: { variant: 'warning', label: 'Pending' },
  processing: { variant: 'info', label: 'Processing' },
  shipped: { variant: 'primary', label: 'Shipped' },
  delivered: { variant: 'success', label: 'Delivered' },
  cancelled: { variant: 'error', label: 'Cancelled' },
};

// Payment status colors
const paymentStatusColors: Record<string, string> = {
  pending:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
  refunded: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',
};

const OrdersPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { user } = useSelector((state: RootState) => state.auth);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [cancellingOrder, setCancellingOrder] = useState<string | null>(null);
  const [repayingOrder, setRepayingOrder] = useState<string | null>(null);
  const [confirmingOrder, setConfirmingOrder] = useState<string | null>(null);

  // Review Modal state
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewProduct, setReviewProduct] = useState<{ id: string; name: string } | null>(null);

  const handleOpenReview = (productId: string, productName: string) => {
    setReviewProduct({ id: productId, name: productName });
    setReviewModalOpen(true);
  };

  // Fetch orders
  const {
    data: ordersResponse,
    isLoading,
    isError,
    error,
    refetch,
  } = useGetUserOrdersQuery({ page: currentPage, limit: 10 }, { skip: !user });

  // Cancel order mutation
  const [cancelOrder] = useCancelOrderMutation();

  // Repay order mutation
  const [repayOrder] = useRepayOrderMutation();

  // Confirm received mutation
  const [confirmReceived] = useConfirmReceivedMutation();

  // Clear server cart mutation as fallback
  const [clearServerCart] = useClearCartMutation();

  // Handle payment success from redirect URLs (VNPay, MoMo)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('payment') === 'success') {
      console.log('Payment success detected in URL, clearing local cart...');
      dispatch(clearCart());
      dispatch(cartApi.util.invalidateTags(['Cart', 'CartCount']));

      // Also call clearServerCart mutation just to be sure
      clearServerCart();

      // Show success notification once
      toast.success(t('checkout.success.message'));

      // Remove the query param to avoid re-triggering on refresh
      navigate('/orders', { replace: true });
    } else if (params.get('payment') === 'failed') {
      toast.error(t('payment.errors.failed'));
      navigate('/orders', { replace: true });
    }
  }, [location.search, dispatch, navigate, t]);

  // Toggle order details
  const toggleOrderDetails = (orderId: string) => {
    setSelectedOrder(selectedOrder === orderId ? null : orderId);
  };

  // Handle cancel order
  const handleCancelOrder = async (orderId: string) => {
    if (!confirm(t('orders.cancelConfirm'))) return;

    setCancellingOrder(orderId);
    try {
      await cancelOrder(orderId).unwrap();
      refetch();
    } catch (error) {
      console.error('Failed to cancel order:', error);
      toast.error(t('common.error'));
    } finally {
      setCancellingOrder(null);
    }
  };

  // Handle repay order
  const handleRepayOrder = async (orderId: string) => {
    if (!confirm(t('orders.repayConfirm'))) return;

    setRepayingOrder(orderId);
    try {
      const response = await repayOrder(orderId).unwrap();

      // Check if the order uses bank transfer method and redirect to PaymentQR page
      if (response.data?.order?.paymentMethod === 'bank_transfer' || response.data?.order?.paymentMethod === 'bank_transfer_qr') {
        // Navigate to PaymentQR page with order information
        navigate(`/payment-qr?orderId=${response.data.order.id}&amount=${response.data.order.total}&numberOrder=${response.data.order.number}`);
      } else if (response.data?.paymentUrl) {
        // For other payment methods, use the payment URL provided by the API
        window.location.href = response.data.paymentUrl;
      } else {
        // If no payment URL is returned and not bank transfer, stay on orders page and show success message
        toast.success(t('payment.initializingPayment'));
        // Refresh orders list
        refetch();
      }
    } catch (error) {
      console.error('Failed to repay order:', error);
      toast.error(t('payment.errors.initializationFailed'));
    } finally {
      setRepayingOrder(null);
    }
  };

  // Handle confirm received
  const handleConfirmReceived = async (orderId: string) => {
    if (!confirm(t('orders.confirmReceivedPrompt'))) return;

    setConfirmingOrder(orderId);
    try {
      const response = await confirmReceived(orderId).unwrap();
      const points = response.pointsEarned || 0;

      if (points > 0) {
        toast.success(t('orders.receivedWithPoints', { points }));
      } else {
        toast.success(t('orders.receivedSuccess'));
      }
      refetch();
    } catch (error) {
      console.error('Failed to confirm delivery:', error);
      toast.error(t('common.error'));
    } finally {
      setConfirmingOrder(null);
    }
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    setSelectedOrder(null);
  };

  // Format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('vi-VN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (!user) {
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
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            {t('orders.loginMessage')}
          </p>
          <PremiumButton
            variant="primary"
            size="large"
            iconType="arrow-right"
            onClick={() => (window.location.href = '/login')}
            className="w-full"
          >
            {t('auth.login')}
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
          <p className="text-neutral-500 dark:text-neutral-400 mb-6">
            {t('orders.error.message')}
          </p>
          <Button variant="primary" onClick={() => refetch()}>
            {t('orders.tryAgain')}
          </Button>
        </div>
      </div>
    );
  }

  const orders = ordersResponse?.data.orders || [];
  const totalPages = ordersResponse?.data.pages || 1;

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-3xl font-bold text-neutral-800 dark:text-neutral-100">
          {t('orders.title')}
        </h1>
        <div className="text-sm text-neutral-500 dark:text-neutral-400">
          {ordersResponse?.data.total || 0} {t('orders.ordersTotal')}
        </div>
      </div>

      {orders.length === 0 ? (
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-12 text-center">
          <div className="text-neutral-400 mb-6">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-20 w-20 mx-auto"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
              />
            </svg>
          </div>
          <h2 className="text-2xl font-semibold text-neutral-700 dark:text-neutral-300 mb-3">
            {t('orders.empty.title')}
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 mb-8 max-w-md mx-auto">
            {t('orders.empty.message')}
          </p>
          <Button variant="primary" as={Link} to="/shop" size="lg">
            {t('orders.empty.startShopping')}
          </Button>
        </div>
      ) : (
        <>
          <div className="space-y-6">
            {orders.map((order) => {
              const statusColors: Record<string, string> = {
                pending: 'border-l-yellow-400',
                processing: 'border-l-blue-400',
                shipped: 'border-l-purple-400',
                delivered: 'border-l-green-400',
                cancelled: 'border-l-red-400',
              };

              return (
                <div
                  key={order.id}
                  className={`bg-white dark:bg-neutral-800 rounded-xl shadow-sm border border-neutral-100 dark:border-neutral-700/50 overflow-hidden hover:shadow-md transition-all duration-300 border-l-4 ${statusColors[order.status] || 'border-l-neutral-400'}`}
                >
                  {/* Order Header */}
                  <div className="p-6 border-b border-neutral-100 dark:border-neutral-700/60 bg-gradient-to-r from-neutral-50/80 to-transparent dark:from-neutral-900/40">
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
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v14a2 2 0 00-2 2z" /></svg>
                            {t('orders.placedOn', {
                              date: formatDate(order.createdAt),
                            })}
                            {order.paymentMethod && (
                              <span className="ml-2 pl-2 border-l border-neutral-300 dark:border-neutral-700">
                                {t(`orders.paymentMethods.${order.paymentMethod.toLowerCase()}`, { defaultValue: order.paymentMethod })}
                              </span>
                            )}
                          </p>
                        </div>

                        <div className="sm:ml-auto flex items-center gap-4">
                          <div className="text-right">
                            <p className="text-xs text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
                              {t('orders.total')}
                            </p>
                            <p className="text-2xl font-black text-primary-600 dark:text-primary-400">
                              {formatCurrency(order.total)}
                            </p>
                          </div>
                          {order.paymentStatus && (
                            <span
                              className={`px-3 py-1 text-xs font-semibold rounded-full shadow-sm ${paymentStatusColors[order.paymentStatus]
                                }`}
                            >
                              {t(`orders.paymentStatus.${order.paymentStatus}`)}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex gap-2 lg:border-l lg:pl-4 border-neutral-200 dark:border-neutral-700">
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

                        {order.status === 'pending' && (
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

                        {(order.status === 'shipped' || (order.status === 'delivered' && !order.pointsEarned)) && (
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

                  {/* Order Items Preview */}
                  <div className="p-6">
                    {order.items && order.items.length > 0 ? (
                      <div className="flex items-center gap-4">
                        <div className="flex gap-2 flex-wrap">
                          {order.items.slice(0, 4).map((item) => (
                            <div
                              key={item.id}
                              className="w-12 h-12 rounded-lg border border-neutral-100 dark:border-neutral-700 overflow-hidden bg-neutral-50 dark:bg-neutral-800 flex-shrink-0 shadow-sm hover:scale-105 transition-transform"
                            >
                              {item.Product?.images?.[0] ? (
                                <img
                                  src={item.Product.images[0]}
                                  alt={item.Product.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div className="w-full h-full flex items-center justify-center text-xs font-medium text-neutral-400">
                                  {item.Product?.name?.charAt(0) || '?'}
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
                            {order.items.length}{' '}
                            {order.items.length === 1 ? 'item' : 'items'}
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
                          No items found
                        </p>
                      </div>
                    )}

                    {/* Shipping Info */}
                    {(order.trackingNumber || order.estimatedDelivery) && (
                      <div className="mt-4 pt-4 border-t border-neutral-200 dark:border-neutral-700">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm">
                          {order.trackingNumber && (
                            <div>
                              <span className="text-neutral-500 dark:text-neutral-400">
                                Tracking:{' '}
                              </span>
                              <span className="font-medium text-neutral-800 dark:text-neutral-200">
                                {order.trackingNumber}
                              </span>
                            </div>
                          )}
                          {order.estimatedDelivery && (
                            <div>
                              <span className="text-neutral-500 dark:text-neutral-400">
                                Est. Delivery:{' '}
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

                  {/* Expandable Order Details */}
                  {selectedOrder === order.id && (
                    <OrderDetails
                      orderId={order.id}
                      onOpenReview={handleOpenReview}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center">
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                >
                  Previous
                </Button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(
                    (page) =>
                      page === 1 ||
                      page === totalPages ||
                      Math.abs(page - currentPage) <= 2
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
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
      {/* Review Modal */}
      {reviewProduct && (
        <ReviewModal
          isOpen={reviewModalOpen}
          onClose={() => {
            setReviewModalOpen(false);
            setReviewProduct(null);
          }}
          productId={reviewProduct.id}
          productName={reviewProduct.name}
          onSuccess={() => refetch()} // might need to lock review button if implemented backend lock
        />
      )}
    </div>
  );
};

export default OrdersPage;
