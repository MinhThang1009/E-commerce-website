import React, { useState, useEffect } from 'react';
import {
  useStripe,
  useElements,
  PaymentElement,
  AddressElement,
  Elements,
} from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { useTranslation } from 'react-i18next';
import Button from '@/components/common/Button';
import {
  useCreatePaymentIntentMutation,
  useConfirmPaymentMutation,
} from '@/services/stripeApi';

// Tải Stripe
const stripePromise = loadStripe(
  import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY || ''
);

interface StripePaymentFormProps {
  amount: number;
  originalAmount?: number; // Giữ số tiền gốc để hiển thị
  currency?: string;
  orderId?: string;
  onSuccess?: (paymentIntent: any) => void;
  onError?: (error: string) => void;
  onProcessing?: (processing: boolean) => void;
}

// Component form bên trong sử dụng Stripe hooks
const PaymentForm: React.FC<StripePaymentFormProps> = ({
  amount,
  originalAmount,
  currency = 'usd',
  orderId,
  onSuccess,
  onError,
  onProcessing,
}) => {
  const { t, i18n } = useTranslation();
  const stripe = useStripe();
  const elements = useElements();

  const [isLoading, setIsLoading] = useState(false);

  const [confirmPayment] = useConfirmPaymentMutation();

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!stripe || !elements) {
      return;
    }

    setIsLoading(true);
    onProcessing?.(true);

    try {
      // Xác nhận thanh toán với Stripe
      const { error, paymentIntent } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/orders`,
        },
        redirect: 'if_required',
      });

      if (error) {
        console.error('Lỗi xác nhận thanh toán:', error);
        onError?.(error.message || t('payment.errors.paymentFailed'));
      } else if (paymentIntent) {

        // Xác nhận thanh toán trên backend
        try {
          const confirmResponse = await confirmPayment({
            paymentIntentId: paymentIntent.id,
          }).unwrap();

          onSuccess?.(confirmResponse.data.paymentIntent);
        } catch (backendError) {
          console.error('Lỗi xác nhận backend:', backendError);
          onError?.(t('payment.errors.confirmationFailed'));
        }
      }
    } catch (error) {
      console.error('Lỗi thanh toán:', error);
      onError?.(t('payment.errors.paymentFailed'));
    } finally {
      setIsLoading(false);
      onProcessing?.(false);
    }
  };

  // Dùng originalAmount để hiển thị nếu có, ngược lại dùng amount
  const displayAmount = originalAmount !== undefined ? originalAmount : amount;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Phần tử thanh toán */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
          {t('payment.paymentDetails')}
        </h3>
        <div className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg">
          <PaymentElement
            options={{
              layout: 'tabs',
            }}
          />
        </div>
      </div>

      {/* Phần tử địa chỉ */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100">
          {t('payment.billingAddress')}
        </h3>
        <div className="p-4 border border-neutral-200 dark:border-neutral-700 rounded-lg">
          <AddressElement
            options={{
              mode: 'billing',
            }}
          />
        </div>
      </div>

      {/* Nút gửi */}
      <Button
        type="submit"
        variant="primary"
        size="lg"
        className="w-full"
        disabled={!stripe || !elements || isLoading}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
            {t('payment.processing')}
          </div>
        ) : (
          t('payment.payNow', {
            amount:
              currency === 'vnd'
                ? `${Math.round(displayAmount).toLocaleString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')} ${t('common.currencySymbol')}`
                : `$${(displayAmount * 0.00004).toFixed(2)}`, // Chuyển đổi VNĐ sang USD để hiển thị
          })
        )}
      </Button>

      {/* Thông báo bảo mật */}
      <div className="text-center text-sm text-neutral-500 dark:text-neutral-400">
        <div className="flex items-center justify-center mb-2">
          <svg
            className="w-4 h-4 mr-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
            />
          </svg>
          {t('payment.securePayment')}
        </div>
        <p>{t('payment.securityNotice')}</p>
      </div>
    </form>
  );
};

// Component chính tạo wrapper Elements với clientSecret
const StripePaymentForm: React.FC<StripePaymentFormProps> = (props) => {
  const { t, i18n } = useTranslation();
  const [clientSecret, setClientSecret] = useState<string>('');
  const [createPaymentIntent] = useCreatePaymentIntentMutation();

  // Tạo payment intent khi component được mount
  useEffect(() => {
    const initializePayment = async () => {
      try {
        // props.amount có đơn vị VNĐ (Việt Nam Đồng)
        // Stripe yêu cầu số tiền theo đơn vị nhỏ nhất (cents cho USD)
        // Chuyển đổi VNĐ sang USD theo tỷ giá xấp xỉ
        const VND_TO_USD_RATE = 0.00004; // Tỷ giá xấp xỉ: 1 VNĐ = 0.00004 USD (1 USD ≈ 25,000 VNĐ)

        let usdAmount = props.amount * VND_TO_USD_RATE;

        // Stripe yêu cầu số tiền theo cents cho USD
        const amountInCents = Math.round(usdAmount * 100);

        const response = await createPaymentIntent({
          amount: amountInCents,
          currency: 'usd', // Dùng USD cho Stripe
          orderId: props.orderId,
        }).unwrap();

        setClientSecret(response.data.clientSecret);
      } catch (error) {
        console.error('Tạo payment intent thất bại:', error);
        props.onError?.(t('payment.errors.initializationFailed'));
      }
    };

    if (props.amount > 0) {
      initializePayment();
    }
  }, [
    props.amount,
    props.orderId,
    createPaymentIntent,
    props.onError,
    t,
  ]);

  if (!clientSecret) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
        <span className="ml-2 text-neutral-600 dark:text-neutral-400">
          {t('payment.initializingPayment')}
        </span>
      </div>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: {
          theme: 'stripe',
        },
      }}
    >
      <PaymentForm {...props} originalAmount={props.amount} />
    </Elements>
  );
};

export default StripePaymentForm;

