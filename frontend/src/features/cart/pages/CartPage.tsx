/**
 * @file CartPage.tsx
 * @layer Page
 * @feature cart
 * @description Page component của feature cart
 */
import { PremiumButton } from '@/components/common';
import Button from '@/components/common/Button';
import CartItem from '../components/CartItem';
import CheckCircleIcon from '@/components/icons/CheckCircleIcon';
import PlusCircleIcon from '@/components/icons/PlusCircleIcon';
import { useClearCartMutation, useGetCartQuery, useValidateCartQuery } from '../api/cart-api';
import { useCartStore } from '@/stores/cart-store';
import { useAuthStore } from '@/stores/auth-store';
import { useApplyDiscountCodeMutation } from '@/features/orders';
import { formatPrice } from '@/utils/format';
import { toast } from '@/utils/toast';
import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { ROUTES } from '@/routes/paths';
import { cartKeys } from '../api/cart-api';
import { getErrorMsg } from '@/utils/error-utils';

const CartPage: React.FC = () => {
  const { t } = useTranslation();
  const { items, subtotal, totalItems, isLoading } = useCartStore();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setServerCart = useCartStore((s) => s.setServerCart);
  const initializeCart = useCartStore((s) => s.initializeCart);
  const clearLocalCart = useCartStore((s) => s.clearLocalCart);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Trạng thái voucher
  const [voucherCode, setVoucherCode] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState<{
    code: string;
    discountAmount: number;
    discountCodeId: string;
  } | null>(null);
  const [voucherError, setVoucherError] = useState('');

  const { mutateAsync: applyDiscount, isPending: applyingVoucher } = useApplyDiscountCodeMutation();

  // API hooks - chỉ gọi khi đã xác thực
  const {
    data: serverCart,
    error: cartError,
    isLoading: cartLoading,
  } = useGetCartQuery({ enabled: isAuthenticated });

  // Kiểm tra giỏ hàng (kiểm tra tồn kho/thay đổi giá) - chỉ khi đã xác thực
  const { data: cartValidation } = useValidateCartQuery({
    enabled: isAuthenticated,
  });

  const { mutateAsync: clearServerCart, isPending: clearingCart } = useClearCartMutation();

  // Xử lý khi MoMo redirect về thành công
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const status = params.get('status');
    const resultCode = params.get('resultCode');

    if (status === 'momo-return' && resultCode === '0') {
      clearLocalCart();
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
      queryClient.invalidateQueries({ queryKey: cartKeys.count });

      // Cũng thử xóa giỏ hàng trên server trực tiếp để chắc chắn 100%
      if (isAuthenticated) {
        clearServerCart();
      }

      toast.success(t('checkout.success.message'));
      navigate(ROUTES.ORDERS, { replace: true });
    } else if (status === 'momo-return' && resultCode !== '0') {
      toast.error(t('payment.errors.failed'));
      navigate(ROUTES.CART, { replace: true });
    }
  }, [navigate, t, clearLocalCart, clearServerCart, isAuthenticated, queryClient]);

  // Khởi tạo giỏ hàng khi component mount
  useEffect(() => {
    if (isAuthenticated && serverCart) {
      setServerCart(serverCart);
    } else if (!isAuthenticated || (!cartLoading && !serverCart)) {
      initializeCart();
    }
  }, [isAuthenticated, serverCart, cartLoading, setServerCart, initializeCart]);

  // Xử lý lỗi giỏ hàng
  useEffect(() => {
    if (cartError) {
      console.error('Lỗi giỏ hàng:', cartError);
      toast.error(t('cart.notifications.loadError'));
      initializeCart();
    }
  }, [cartError, t, initializeCart]);

  // Tự động hủy voucher nếu tổng phụ giảm xuống dưới minOrderAmount
  useEffect(() => {
    if (appliedVoucher && subtotal < 1) {
      // Đặt lại nếu giỏ hàng trống
      setAppliedVoucher(null);
      setVoucherCode('');
    }
  }, [subtotal, appliedVoucher]);

  // Áp dụng voucher
  const handleApplyVoucher = async () => {
    if (!voucherCode.trim()) return;
    setVoucherError('');

    try {
      const result = await applyDiscount({
        code: voucherCode.trim().toUpperCase(),
        orderAmount: subtotal,
      });

      setAppliedVoucher({
        code: result.data.code,
        discountAmount: result.data.discountAmount,
        discountCodeId: result.data.discountCodeId,
      });
      toast.success(t('cart.voucher.appliedSuccess'));
    } catch (err) {
      const msg = getErrorMsg(err, t('cart.voucher.invalid'));
      setVoucherError(msg);
      setAppliedVoucher(null);
    }
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherCode('');
    setVoucherError('');
    toast.success(t('cart.voucher.removedSuccess'));
  };

  // Tính lại nếu tổng đơn hàng thay đổi và voucher đang được áp dụng
  const handleVoucherRevalidate = async () => {
    if (!appliedVoucher) return;
    try {
      const result = await applyDiscount({
        code: appliedVoucher.code,
        orderAmount: subtotal,
      });
      setAppliedVoucher({
        code: result.data.code,
        discountAmount: result.data.discountAmount,
        discountCodeId: result.data.discountCodeId,
      });
    } catch (err) {
      // Voucher không còn hợp lệ với giá trị giỏ hàng hiện tại
      const msg = getErrorMsg(err, '');
      toast.warning(t('cart.voucher.cancelled', { message: msg }));
      setAppliedVoucher(null);
      setVoucherCode('');
      setVoucherError(msg);
    }
  };

  // Kiểm tra lại voucher khi tổng phụ thay đổi
  useEffect(() => {
    if (appliedVoucher) {
      handleVoucherRevalidate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subtotal]);

  // Tổng tiền
  const discount = appliedVoucher?.discountAmount || 0;
  const total = Math.max(0, subtotal - discount);

  // Xử lý thanh toán - truyền dữ liệu voucher vào state
  const handleCheckout = () => {
    navigate(ROUTES.CHECKOUT, {
      state: appliedVoucher
        ? {
            voucherCode: appliedVoucher.code,
            discountAmount: appliedVoucher.discountAmount,
            discountCodeId: appliedVoucher.discountCodeId,
          }
        : undefined,
    });
  };

  // Xử lý xóa toàn bộ giỏ hàng
  const handleClearCart = async () => {
    if (!window.confirm(t('cart.clearCartConfirm'))) return;
    try {
      if (isAuthenticated) {
        await clearServerCart();
        toast.success(t('cart.notifications.cleared'));
      } else {
        clearLocalCart();
        toast.success(t('cart.notifications.cleared'));
      }
      setAppliedVoucher(null);
      setVoucherCode('');
    } catch (error) {
      clearLocalCart();
      toast.error(t('cart.notifications.serverError'));
    }
  };

  // Nhóm các vấn đề trong giỏ hàng
  const issueItems = cartValidation?.items.filter((i) => i.hasIssue) || [];

  if ((isAuthenticated && cartLoading) || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-neutral-800 dark:text-neutral-100 mb-8">
        {t('cart.title')}
      </h1>

      {/* Trạng thái đồng bộ */}
      {isAuthenticated && serverCart && serverCart.id && (
        <div className="mb-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-center text-green-700 dark:text-green-300">
            <CheckCircleIcon />
            <span className="text-sm">{t('cart.syncedWithAccount')}</span>
          </div>
        </div>
      )}

      {!isAuthenticated && items.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-center text-blue-700 dark:text-blue-300">
            <PlusCircleIcon />
            <span className="text-sm">{t('cart.savedLocally')}</span>
          </div>
        </div>
      )}

      {/* Stock / Price issues banner */}
      {issueItems.length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-xl shadow-sm">
          <div className="flex items-start gap-3">
            <span className="text-2xl">⚠️</span>
            <div className="flex-1">
              <p className="font-semibold text-amber-800 dark:text-amber-300 mb-2">
                {t('cart.validation.stockIssues')}
              </p>
              <ul className="space-y-1.5">
                {issueItems.map((issue) => (
                  <li
                    key={issue.id}
                    className="text-sm text-amber-700 dark:text-amber-400 flex flex-col gap-0.5"
                  >
                    <span className="font-medium">› {issue.name}</span>
                    {issue.outOfStock && (
                      <span className="text-red-600 dark:text-red-400 ml-3">
                        {t('cart.validation.outOfStockAction')}
                      </span>
                    )}
                    {issue.quantityExceedsStock && !issue.outOfStock && (
                      <span className="text-orange-600 dark:text-orange-400 ml-3">
                        {t('cart.validation.onlyLeft', {
                          max: issue.maxStock,
                          qty: issue.quantity,
                        })}
                      </span>
                    )}
                    {issue.priceChanged && (
                      <span className="text-amber-600 dark:text-amber-300 ml-3">
                        {t('cart.validation.priceChanged', {
                          old: formatPrice(issue.savedPrice),
                          new: formatPrice(issue.currentPrice),
                        })}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-8 text-center">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-16 w-16 mx-auto text-neutral-400 mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
            />
          </svg>
          <h2 className="text-xl font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
            {t('cart.emptyCart.title')}
          </h2>
          <p className="text-neutral-500 dark:text-neutral-400 mb-6">
            {t('cart.emptyCart.message')}
          </p>
          <Button variant="primary" as={Link} to={ROUTES.SHOP}>
            {t('cart.emptyCart.startShopping')}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Các sản phẩm trong giỏ hàng */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100">
                  {t('cart.cartItems')} ({totalItems})
                </h2>
                <PremiumButton
                  variant="danger"
                  size="small"
                  isProcessing={clearingCart}
                  processingText={t('common.loading')}
                  onClick={handleClearCart}
                >
                  {t('cart.clearCart')}
                </PremiumButton>
              </div>

              <div className="divide-y divide-neutral-200 dark:divide-neutral-700">
                {items.map((item) => {
                  const issueInfo = cartValidation?.items.find((i) => i.id === item.id);
                  return (
                    <div key={item.id} className="relative">
                      {issueInfo?.outOfStock && (
                        <div className="absolute inset-0 bg-white/60 dark:bg-neutral-900/60 flex items-center justify-center z-10 rounded-lg backdrop-blur-[1px]">
                          <span className="bg-red-100 text-red-700 border border-red-300 dark:bg-red-900/50 dark:text-red-300 dark:border-red-700 text-sm font-bold px-4 py-2 rounded-full shadow">
                            {t('cart.validation.outOfStock')}
                          </span>
                        </div>
                      )}
                      <CartItem item={item} maxStock={issueInfo?.maxStock} />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Tóm tắt đơn hàng */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6 sticky top-24 space-y-6">
              <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100">
                {t('cart.orderSummary')}
              </h2>

              {/* -- Ô nhập voucher -- */}
              <div>
                <label className="block text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                  🏷️ {t('cart.voucher.title')}
                </label>
                {appliedVoucher ? (
                  <div className="flex items-center justify-between gap-2 bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-lg px-3 py-2">
                    <div>
                      <span className="font-bold text-green-700 dark:text-green-400 tracking-wider">
                        {appliedVoucher.code}
                      </span>
                      <span className="ml-2 text-sm text-green-600 dark:text-green-400">
                        -{formatPrice(appliedVoucher.discountAmount)}
                      </span>
                    </div>
                    <button
                      onClick={handleRemoveVoucher}
                      className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                    >
                      {t('cart.voucher.remove')}
                    </button>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={voucherCode}
                      onChange={(e) => {
                        setVoucherCode(e.target.value.toUpperCase());
                        setVoucherError('');
                      }}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplyVoucher()}
                      placeholder={t('cart.voucher.placeholder')}
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-primary-500 transition-shadow"
                    />
                    <button
                      onClick={handleApplyVoucher}
                      disabled={applyingVoucher || !voucherCode.trim()}
                      className="px-3 py-2 text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {applyingVoucher ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        t('cart.voucher.apply')
                      )}
                    </button>
                  </div>
                )}
                {voucherError && (
                  <p className="mt-1.5 text-xs text-red-500 font-medium">{voucherError}</p>
                )}
              </div>

              {/* Tổng tiền */}
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-neutral-600 dark:text-neutral-400">
                    {t('cart.subtotal')}
                  </span>
                  <span className="text-neutral-800 dark:text-neutral-200 font-medium">
                    {formatPrice(subtotal)}
                  </span>
                </div>

                {appliedVoucher && (
                  <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
                    <span className="flex items-center gap-1">
                      <svg
                        className="w-3.5 h-3.5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
                        />
                      </svg>
                      {t('cart.voucher.discountLabel', { code: appliedVoucher.code })}
                    </span>
                    <span className="font-semibold">
                      -{formatPrice(appliedVoucher.discountAmount)}
                    </span>
                  </div>
                )}

                <div className="border-t border-neutral-200 dark:border-neutral-700 pt-3 flex justify-between">
                  <span className="text-neutral-800 dark:text-neutral-200 font-semibold text-base">
                    {t('cart.total')}
                  </span>
                  <span className="text-neutral-900 dark:text-white font-bold text-xl">
                    {formatPrice(total)}
                  </span>
                </div>
              </div>

              <PremiumButton
                variant="primary"
                size="large"
                iconType="arrow-right"
                onClick={handleCheckout}
                disabled={issueItems.some((i) => i.outOfStock)}
                className="w-full h-12"
              >
                {issueItems.some((i) => i.outOfStock)
                  ? t('cart.validation.cartHasOutOfStock')
                  : t('cart.proceedToCheckout')}
              </PremiumButton>

              <PremiumButton
                variant="outline"
                size="large"
                onClick={() => navigate(ROUTES.SHOP)}
                className="w-full h-12"
              >
                {t('cart.continueShopping')}
              </PremiumButton>

              <div className="text-sm text-neutral-500 dark:text-neutral-400 space-y-1.5">
                {[
                  t('cart.benefits.freeShipping'),
                  t('cart.benefits.secureCheckout'),
                  t('cart.benefits.returnPolicy'),
                ].map((benefit) => (
                  <p key={benefit} className="flex items-center">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 mr-2 text-primary-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                    {benefit}
                  </p>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CartPage;
