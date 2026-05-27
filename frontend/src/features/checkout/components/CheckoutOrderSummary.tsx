/**
 * @file CheckoutOrderSummary.tsx
 * @layer Component
 * @feature checkout
 * @description Cột phải checkout: items, mã giảm giá, tổng cộng, nút thanh toán
 */
import { useTranslation } from 'react-i18next';
import { CheckCircle } from 'lucide-react';
import PremiumButton from '@/components/common/PremiumButton';
import Input from '@/components/common/Input';
import { CartItem } from '@/features/cart';
import { formatPrice } from '@/utils/format';
import type { AvailableDiscountCode } from '@/features/orders';

interface AppliedDiscount {
  code: string;
  amount: number;
}

interface CheckoutOrderSummaryProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  items: any[];
  isRepayingOrder: boolean;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  currentOrder: any;
  subtotal: number;
  shippingCost: number;
  finalDistance: number;
  tax: number;
  total: number;
  appliedDiscount: AppliedDiscount | null;
  discountCodeInput: string;
  onDiscountCodeChange: (value: string) => void;
  discountError: string;
  isValidatingCode: boolean;
  availableCodes: AvailableDiscountCode[];
  onApplyDiscount: () => void;
  onRemoveDiscount: () => void;
  onSelectDiscountCode: (code: string) => void;
  paymentMethod: string;
  isProcessing: boolean;
  onSubmit: () => void;
}

const CheckoutOrderSummary: React.FC<CheckoutOrderSummaryProps> = ({
  items,
  isRepayingOrder,
  currentOrder,
  subtotal,
  shippingCost,
  finalDistance,
  tax,
  total,
  appliedDiscount,
  discountCodeInput,
  onDiscountCodeChange,
  discountError,
  isValidatingCode,
  availableCodes,
  onApplyDiscount,
  onRemoveDiscount,
  onSelectDiscountCode,
  paymentMethod,
  isProcessing,
  onSubmit,
}) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6 sticky top-4">
        <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100 mb-6">
          {t('checkout.orderSummary.title')}
        </h2>

        {isRepayingOrder ? (
          <div className="space-y-4 mb-6">
            <div className="p-4 bg-blue-50 dark:bg-primary-700/20 rounded-lg">
              <div className="text-blue-800 dark:text-blue-200">
                <div className="font-semibold mb-2">{t('checkout.repayOrder.title')}</div>
                <div className="text-sm mb-1">
                  {t('checkout.repayOrder.id')}: {currentOrder.id}
                </div>
                <div className="text-lg font-semibold">
                  {t('checkout.repayOrder.amount')}: {formatPrice(currentOrder.total)}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4 mb-6">
            {items.map((item) => (
              <CartItem
                key={`${item.id}-${item.variantId || 'default'}`}
                item={item}
                isCheckout={true}
              />
            ))}
          </div>
        )}

        {!isRepayingOrder && (
          <div className="mb-6 border-t border-neutral-200 dark:border-neutral-700 pt-4">
            {availableCodes.length > 0 && !appliedDiscount && (
              <div className="mb-3">
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">
                  {t('checkout.discountCode.available')}
                </p>
                <div className="flex flex-wrap gap-2">
                  {availableCodes.map((dc: AvailableDiscountCode) => {
                    const eligible = dc.minOrderAmount === null || subtotal >= dc.minOrderAmount;
                    const label =
                      dc.type === 'percent'
                        ? `${dc.value}%${dc.maxDiscountAmount ? ` (tối đa ${formatPrice(dc.maxDiscountAmount)})` : ''}`
                        : formatPrice(dc.value);
                    return (
                      <button
                        key={dc.id}
                        disabled={!eligible}
                        onClick={() => onSelectDiscountCode(dc.code)}
                        title={
                          !eligible && dc.minOrderAmount
                            ? t('checkout.discountCode.minOrder', {
                                amount: formatPrice(dc.minOrderAmount),
                              })
                            : dc.code
                        }
                        className={`px-2.5 py-1 rounded border text-xs font-mono font-semibold transition-colors ${
                          eligible
                            ? 'border-emerald-400 text-emerald-700 dark:text-emerald-300 dark:border-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 cursor-pointer'
                            : 'border-neutral-300 dark:border-neutral-600 text-neutral-400 cursor-not-allowed opacity-60'
                        }`}
                      >
                        {dc.code}
                        <span className="ml-1 font-normal text-neutral-500 dark:text-neutral-400">
                          -{label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="flex space-x-2 items-end">
              <div className="flex-grow">
                <Input
                  placeholder={t('checkout.discountCode.placeholder')}
                  value={discountCodeInput}
                  onChange={(e) => onDiscountCodeChange(e.target.value.toUpperCase())}
                  disabled={!!appliedDiscount}
                />
              </div>
              <button
                onClick={appliedDiscount ? onRemoveDiscount : onApplyDiscount}
                disabled={isValidatingCode}
                className={`h-[42px] px-4 text-sm font-semibold disabled:opacity-50 ${appliedDiscount ? 'btn-danger' : 'btn-glass-primary'}`}
              >
                {isValidatingCode
                  ? '...'
                  : appliedDiscount
                    ? t('checkout.discountCode.cancel')
                    : t('common.apply')}
              </button>
            </div>
            {discountError && <p className="text-red-500 text-xs mt-1">{discountError}</p>}
            {appliedDiscount && (
              <p className="text-green-600 text-sm mt-1 flex items-center">
                <CheckCircle className="w-4 h-4 mr-1" />
                {t('checkout.discountCode.discountInfo', {
                  code: appliedDiscount.code,
                  amount: formatPrice(appliedDiscount.amount),
                })}
              </p>
            )}
          </div>
        )}

        <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4 space-y-2">
          {!isRepayingOrder ? (
            <>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <span>{t('checkout.orderSummary.subtotal')}</span>
                <span>{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                <div className="flex flex-col">
                  <span>{t('checkout.orderSummary.shipping')}</span>
                  {finalDistance > 0 && (
                    <span className="text-base font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1.5 rounded-md mt-1.5 shadow-sm border border-emerald-100 dark:border-emerald-800 inline-flex items-center">
                      {t('checkout.orderSummary.distanceInfo', {
                        distance: finalDistance.toFixed(1),
                        fee: formatPrice(shippingCost),
                      })}
                    </span>
                  )}
                </div>
                <span>
                  {shippingCost === 0
                    ? t('checkout.orderSummary.freeShipping')
                    : formatPrice(shippingCost)}
                </span>
              </div>
              {appliedDiscount && (
                <div className="flex justify-between text-green-600 font-medium">
                  <span>
                    {t('checkout.orderSummary.discountCodeLabel', {
                      code: appliedDiscount.code,
                    })}
                  </span>
                  <span>-{formatPrice(appliedDiscount.amount)}</span>
                </div>
              )}
              {tax > 0 && (
                <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                  <span>{t('checkout.orderSummary.tax')}</span>
                  <span>{formatPrice(tax)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-semibold text-neutral-800 dark:text-neutral-100 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                <span>{t('checkout.orderSummary.total')}</span>
                <span>{formatPrice(total)}</span>
              </div>
            </>
          ) : (
            <div className="flex justify-between text-lg font-semibold text-neutral-800 dark:text-neutral-100">
              <span>{t('checkout.orderSummary.total')}</span>
              <span>{formatPrice(currentOrder.total)}</span>
            </div>
          )}
        </div>

        {['bank_transfer', 'vnpay', 'momo', 'installment', 'cod'].includes(paymentMethod) &&
          (!currentOrder || ['vnpay', 'momo'].includes(paymentMethod)) && (
            <PremiumButton
              variant="primary"
              size="large"
              iconType="arrow-right"
              isProcessing={isProcessing}
              processingText={t('common.processing')}
              onClick={onSubmit}
              className="w-full mt-6 h-14 text-lg font-semibold"
            >
              {t('checkout.buttons.continueToPayment')}
            </PremiumButton>
          )}

        {paymentMethod === 'bank_transfer' && currentOrder && (
          <div className="mt-6">
            <div className="text-center py-4">
              <p className="text-lg text-neutral-700 dark:text-neutral-300">
                {t('checkout.redirectingToPayment')}
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
          <div className="flex items-center text-green-800 dark:text-green-200">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            <div>
              <div className="font-semibold">{t('checkout.securityNotice.title')}</div>
              <div className="text-sm">{t('checkout.securityNotice.message')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutOrderSummary;
