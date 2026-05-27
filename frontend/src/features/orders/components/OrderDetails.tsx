/**
 * @file OrderDetails.tsx
 * @layer Component
 * @feature orders
 * @description UI component cho feature orders
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useGetOrderByIdQuery } from '@/features/orders';
import { formatPrice } from '@/utils/format';
import Badge, { BadgeVariant } from '@/components/common/Badge';
import { Copy, Check as CheckIcon } from 'lucide-react';
import { Clock, Package, Truck, CheckCircle, MapPin, CreditCard } from 'lucide-react';

interface OrderDetailsProps {
  orderId: string;
  onOpenReview?: (productId: string, productName: string) => void;
}

const OrderDetails: React.FC<OrderDetailsProps> = ({ orderId, onOpenReview }) => {
  const { t, i18n } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const statusVariants: Record<string, { variant: BadgeVariant; label: string }> = {
    pending: { variant: 'warning', label: t('orders.status.pending') },
    processing: { variant: 'info', label: t('orders.status.processing') },
    shipped: { variant: 'primary', label: t('orders.status.shipped') },
    delivered: { variant: 'success', label: t('orders.status.delivered') },
    cancelled: { variant: 'error', label: t('orders.status.cancelled') },
  };
  const { data: response, isLoading, isError } = useGetOrderByIdQuery(orderId);

  if (isLoading) {
    return (
      <div className="p-8 text-center animate-pulse text-neutral-500">{t('orders.loading')}</div>
    );
  }

  if (isError || !response?.data) {
    return <div className="p-8 text-center text-red-500 font-medium">{t('orders.errorMsg')}</div>;
  }

  const order = response.data;

  const STEP_ICONS = [Clock, Package, Truck, CheckCircle];
  const steps = ['pending', 'processing', 'shipped', 'delivered'];
  let currentStepIndex = steps.indexOf(order.status);
  if (order.status === 'cancelled') {
    currentStepIndex = -1; // ẩn thanh tiến trình bình thường
  }

  return (
    <div className="bg-white dark:bg-neutral-900 transition-all rounded-t-2xl overflow-hidden">
      {/* Gradient accent bar */}
      <div className="h-1 bg-gradient-to-r from-primary-500 via-indigo-500 to-purple-500" />

      {/* 1. Tiêu đề Đơn hàng */}
      <div className="p-6 pb-4 border-b border-neutral-100 dark:border-neutral-800 flex flex-col md:flex-row md:justify-between md:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
            <Package className="w-5 h-5 text-primary-600 dark:text-primary-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-bold tracking-tight text-neutral-800 dark:text-neutral-100">
                {t('orders.detailTitle', { number: order.number })}
              </h2>
              <button
                type="button"
                onClick={() => handleCopy(order.number)}
                className="p-1 rounded-md hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 transition-colors"
                title={t('common.copy')}
              >
                {copied ? (
                  <CheckIcon className="w-3.5 h-3.5 text-green-500" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {t('orders.placedAt', {
                date: new Date(order.createdAt).toLocaleString(
                  i18n.language === 'vi' ? 'vi-VN' : 'en-US',
                ),
              })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={statusVariants[order.status]?.variant || 'neutral'}>
            {statusVariants[order.status]?.label || order.status}
          </Badge>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Tiến độ giao hàng (Stepper dọc trên mobile, ngang trên desktop) */}
        {order.status !== 'cancelled' ? (
          <div className="py-6 px-2">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-6">
              {t('orders.progressTitle')}
            </h3>
            <div className="relative flex flex-col md:flex-row md:items-center justify-between gap-6 md:gap-0 w-full max-w-3xl mx-auto">
              {/* Thanh ngang cho desktop */}
              <div className="hidden md:block absolute left-[10%] top-4 w-[80%] h-1 bg-neutral-200 dark:bg-neutral-700 rounded-full z-0"></div>
              <div
                className="hidden md:block absolute left-[10%] top-4 h-1 bg-green-500 rounded-full z-0 transition-all duration-700"
                style={{
                  width: `${currentStepIndex >= 0 ? (currentStepIndex / (steps.length - 1)) * 80 : 0}%`,
                }}
              ></div>

              {/* Thanh dọc cho mobile */}
              <div className="block md:hidden absolute left-4 top-[10%] w-0.5 h-[80%] bg-neutral-200 dark:bg-neutral-700 rounded-full z-0"></div>
              <div
                className="block md:hidden absolute left-4 top-[10%] w-0.5 bg-green-500 rounded-full z-0 transition-all duration-700"
                style={{
                  height: `${currentStepIndex >= 0 ? (currentStepIndex / (steps.length - 1)) * 80 : 0}%`,
                }}
              ></div>

              {steps.map((step, idx) => {
                const isCompleted = idx <= currentStepIndex;
                const isActive = idx === currentStepIndex;
                const StepIcon = STEP_ICONS[idx];
                return (
                  <div
                    key={step}
                    className="relative flex md:flex-col items-center gap-4 md:gap-0 z-10 w-full md:w-32 group"
                  >
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-sm shadow-sm transition-all duration-500 ${
                        isCompleted
                          ? 'bg-green-500 text-white shadow-green-500/30'
                          : 'bg-neutral-100 dark:bg-neutral-800 border-2 border-neutral-300 dark:border-neutral-600 text-neutral-400'
                      } ${isActive ? 'scale-110 shadow-md ring-4 ring-green-50 dark:ring-green-900/40' : ''}`}
                    >
                      <StepIcon className="w-5 h-5" />
                    </div>
                    <div className="md:mt-3 md:text-center text-left">
                      <span
                        className={`text-sm md:text-xs font-semibold block transition-colors ${
                          isCompleted
                            ? 'text-green-600 dark:text-green-500'
                            : 'text-neutral-500 dark:text-neutral-400'
                        }`}
                      >
                        {statusVariants[step]?.label}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="py-6 text-center bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/30 rounded-xl mb-6 shadow-sm">
            <span className="text-3xl mb-2 block">🚫</span>
            <h3 className="text-red-600 dark:text-red-400 font-semibold text-lg">
              {t('orders.cancelledTitle')}
            </h3>
            <p className="text-sm text-red-500/80 dark:text-red-400/80 mt-1">
              {t('orders.cancelledDesc')}
            </p>
          </div>
        )}

        {/* 2. Block Thông tin Giao hàng & Thanh toán */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-neutral-50 dark:bg-neutral-800/40 p-5 rounded-2xl border border-neutral-100 dark:border-neutral-700/50 shadow-sm transition-transform hover:-translate-y-1 duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center">
                <MapPin className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="font-bold text-neutral-800 dark:text-neutral-100 text-lg">
                {t('orders.deliverySection')}
              </h3>
            </div>
            <div className="space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
              <p className="flex justify-between items-center pb-2 border-b border-neutral-200 dark:border-neutral-700/50">
                <span className="text-neutral-500">{t('orders.recipient')}:</span>
                <span className="font-semibold text-neutral-800 dark:text-neutral-100 text-right">
                  {order.shippingFirstName} {order.shippingLastName}
                </span>
              </p>
              <p className="flex justify-between items-center pb-2 border-b border-neutral-200 dark:border-neutral-700/50">
                <span className="text-neutral-500">{t('orders.phone')}:</span>
                <span className="font-semibold text-neutral-800 dark:text-neutral-100">
                  {order.shippingPhone || t('orders.notProvided')}
                </span>
              </p>
              <div className="flex flex-col pt-1">
                <span className="text-neutral-500 mb-1">{t('orders.deliveryAddress')}:</span>
                <span className="font-medium text-neutral-800 dark:text-neutral-200 bg-white dark:bg-neutral-800 p-3 rounded-lg border border-neutral-100 dark:border-neutral-700">
                  {order.shippingAddress1}, {order.shippingCity}, {order.shippingState}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-neutral-50 dark:bg-neutral-800/40 p-5 rounded-2xl border border-neutral-100 dark:border-neutral-700/50 shadow-sm transition-transform hover:-translate-y-1 duration-300">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/20 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="font-bold text-neutral-800 dark:text-neutral-100 text-lg">
                {t('orders.paymentSection')}
              </h3>
            </div>
            <div className="space-y-3 text-sm text-neutral-600 dark:text-neutral-300">
              <p className="flex justify-between items-center pb-2 border-b border-neutral-200 dark:border-neutral-700/50">
                <span className="text-neutral-500">{t('orders.paymentType')}:</span>
                <span className="font-bold text-primary-600 bg-primary-50 dark:bg-primary-900/20 px-3 py-1 rounded-md border border-primary-100 dark:border-primary-800/50">
                  {t(`orders.paymentMethods.${order.paymentMethod?.toLowerCase()}`, {
                    defaultValue: order.paymentMethod,
                  })}
                </span>
              </p>
              <p className="flex justify-between items-center pb-2 border-b border-neutral-200 dark:border-neutral-700/50">
                <span className="text-neutral-500">{t('orders.paymentStatusLabel')}:</span>
                <span className="inline-flex items-center gap-1.5 font-semibold text-neutral-800 dark:text-neutral-100">
                  {order.paymentStatus === 'paid' && (
                    <CheckCircle className="w-4 h-4 text-emerald-500" />
                  )}
                  {order.paymentStatus === 'failed' && <Clock className="w-4 h-4 text-red-500" />}
                  {order.paymentStatus === 'pending' && (
                    <Clock className="w-4 h-4 text-amber-500" />
                  )}
                  {order.paymentStatus === 'refunded' && (
                    <Package className="w-4 h-4 text-neutral-500" />
                  )}
                  {order.status === 'cancelled' && order.paymentStatus === 'pending'
                    ? '—'
                    : order.paymentStatus === 'paid'
                      ? t('orders.paidStatus')
                      : order.paymentStatus === 'failed'
                        ? t('orders.failedStatus')
                        : order.paymentStatus === 'refunded'
                          ? t('orders.paymentStatus.refunded')
                          : order.paymentMethod === 'cod'
                            ? t('orders.paymentStatus.cod')
                            : t('orders.pendingPaymentStatus')}
                </span>
              </p>
              {order.trackingNumber && (
                <div className="flex flex-col pt-1">
                  <span className="text-neutral-500 mb-1">{t('orders.trackingLabel')}:</span>
                  <span className="font-mono bg-white dark:bg-neutral-800 p-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-center tracking-widest text-lg font-bold">
                    {order.trackingNumber}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 3. Danh sách Sản phẩm */}
        <div>
          <h3 className="text-lg font-bold text-neutral-800 dark:text-neutral-100 mb-4 flex items-center gap-2">
            🛍️ {t('orders.yourProducts')}{' '}
            <span className="text-sm font-normal text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 rounded-full">
              {order.items?.length || 0}
            </span>
          </h3>
          <div className="bg-white dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-700/60 shadow-sm overflow-hidden">
            {/* Tiêu đề bảng cho desktop */}
            <div className="hidden md:grid grid-cols-12 gap-4 p-4 border-b border-neutral-200 dark:border-neutral-700/60 bg-neutral-50/50 dark:bg-neutral-900/50 text-xs font-semibold text-neutral-500 uppercase tracking-wider">
              <div className="col-span-6">{t('orders.productCol')}</div>
              <div className="col-span-2 text-center">{t('orders.unitPrice')}</div>
              <div className="col-span-2 text-center">{t('orders.qtyCol')}</div>
              <div className="col-span-2 text-right">{t('orders.totalCol')}</div>
            </div>

            <div className="divide-y divide-neutral-100 dark:divide-neutral-700/50">
              {order.items?.map((item) => (
                <div
                  key={item.id}
                  className="grid grid-cols-1 md:grid-cols-12 gap-4 p-4 items-center hover:bg-neutral-50/50 dark:hover:bg-neutral-800/50 transition-colors"
                >
                  <div className="col-span-1 md:col-span-6 flex gap-4 items-center">
                    <div className="w-20 h-20 rounded-xl overflow-hidden shadow-sm bg-neutral-100 dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 flex-shrink-0">
                      {item.Product?.thumbnail || item.Product?.images?.[0] || item.image ? (
                        <img
                          src={item.Product?.thumbnail || item.Product?.images?.[0] || item.image}
                          alt={item.name}
                          className="w-full h-full object-cover transition-transform hover:scale-110"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-400 font-bold text-xl">
                          ?
                        </div>
                      )}
                    </div>
                    <div>
                      <h4 className="font-semibold text-neutral-800 dark:text-neutral-100 text-base line-clamp-2 md:line-clamp-1">
                        {item.name}
                      </h4>
                      {item.attributes?.variant && (
                        <div className="mt-1.5 inline-block text-xs font-medium text-neutral-600 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 px-2 py-1 rounded">
                          {t('orders.variantLabel', { variant: item.attributes.variant })}
                        </div>
                      )}
                      {/* Thông tin giá cho mobile */}
                      <div className="md:hidden mt-2 text-sm">
                        <span className="font-medium text-neutral-600">
                          {formatPrice(item.unitPrice || item.price)}
                        </span>
                        <span className="text-neutral-400 mx-1">x</span>
                        <span className="font-bold">{item.quantity}</span>
                      </div>
                    </div>
                  </div>

                  <div className="hidden md:block col-span-2 text-center font-medium text-neutral-600 dark:text-neutral-400">
                    {formatPrice(item.unitPrice || item.price)}
                  </div>
                  <div className="hidden md:block col-span-2 text-center font-bold text-neutral-800 dark:text-neutral-200 bg-neutral-100 dark:bg-neutral-800 rounded-md py-1 w-max mx-auto px-4">
                    {item.quantity}
                  </div>
                  <div className="col-span-1 md:col-span-2 text-right flex flex-col items-end gap-2">
                    {/* Trên mobile, tổng giá được căn phải */}
                    <p className="font-bold text-neutral-900 dark:text-white text-lg">
                      {formatPrice(item.subtotal)}
                    </p>
                    {order.status === 'delivered' && item.Product && onOpenReview && (
                      <button
                        onClick={() =>
                          onOpenReview(
                            item.Product?.id || item.productId || '',
                            item.Product?.name || item.name || '',
                          )
                        }
                        className="text-xs px-3 py-1.5 border border-primary-500 text-primary-600 rounded-md hover:bg-primary-50 dark:hover:bg-primary-900/40 font-medium transition-colors"
                      >
                        {t('orders.writeReview')}
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 4. Block Tổng kết */}
        <div className="flex flex-col lg:flex-row justify-end pt-4 mb-4 gap-6">
          <div className="w-full lg:w-[45%] bg-neutral-50 dark:bg-neutral-800/40 border border-neutral-100 dark:border-neutral-700/50 p-6 md:p-8 rounded-[24px] shadow-sm relative overflow-hidden transition-transform hover:-translate-y-1 duration-300">
            <h3 className="font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-widest text-xs mb-6 relative z-10">
              {t('orders.paymentSummary')}
            </h3>

            <div className="space-y-4 relative z-10">
              <div className="flex justify-between items-center text-neutral-600 dark:text-neutral-300">
                <span>{t('orders.subtotalWithCount', { count: order.items?.length })}</span>
                <span className="font-medium">{formatPrice(order.subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-neutral-600 dark:text-neutral-300 pb-4 border-b border-neutral-200 dark:border-neutral-700 border-dashed">
                <span>{t('orders.shipping')}</span>
                <span className="font-medium">
                  {order.shippingCost === 0
                    ? t('orders.freeShipping')
                    : formatPrice(order.shippingCost)}
                </span>
              </div>

              {order.discount > 0 && (
                <div className="flex justify-between items-center text-emerald-600 dark:text-emerald-400 pt-2">
                  <span className="flex items-center gap-2">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                      />
                    </svg>
                    {t('orders.discountVoucher')}
                  </span>
                  <span className="font-bold">-{formatPrice(order.discount)}</span>
                </div>
              )}

              <div className="pt-4 flex justify-between items-end mt-4">
                <span className="text-neutral-500 dark:text-neutral-400 text-sm">
                  {t('orders.totalPayment')}
                </span>
                <span className="font-black text-2xl text-neutral-900 dark:text-white">
                  {formatPrice(order.total)}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default OrderDetails;
