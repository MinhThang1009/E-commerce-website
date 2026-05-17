/**
 * @file PaymentQRPage.tsx
 * @layer Page
 * @feature payment
 * @description Page component của feature payment
 */
import { useGetOrderByIdQuery, useCancelOrderMutation } from '@/features/orders';
import { useCreateVNPayUrlMutation } from '../api/vnpayApi';
import { useUiStore } from '@/stores/uiStore';
import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/routes/paths';
import { getLocale } from '@/utils/format';

const PaymentQRPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addNotification = useUiStore((s) => s.addNotification);
  const [searchParams] = useSearchParams();

  const orderId = searchParams.get('orderId');
  const numberOrder = searchParams.get('numberOrder');
  const amountParam = searchParams.get('amount');

  const [amount, setAmount] = useState<number>(0);
  const [selectedCard, setSelectedCard] = useState(0);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(15 * 60);
  const [isExpired, setIsExpired] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [countdown, setCountdown] = useState(3);

  // Chỉ expose test card numbers trong development — production build sẽ tree-shake mảng này
  const TEST_CARDS = import.meta.env.DEV ? [
    {
      bank: t('paymentQR.card1bank'),
      logo: '🏦',
      color: 'from-blue-600 to-blue-800',
      cardNumber: '9704198526191432198',
      cardHolder: 'NGUYEN VAN A',
      expiry: '07/15',
      otp: '123456',
      note: t('paymentQR.card1note'),
      type: 'success',
    },
    {
      bank: t('paymentQR.card2bank'),
      logo: '🏦',
      color: 'from-slate-500 to-slate-700',
      cardNumber: '9704195798459170486',
      cardHolder: 'NGUYEN VAN B',
      expiry: '07/15',
      otp: '123456',
      note: t('paymentQR.card2note'),
      type: 'error',
    },
    {
      bank: t('paymentQR.card3bank'),
      logo: '🏛️',
      color: 'from-green-600 to-green-800',
      cardNumber: '4456530000001005',
      cardHolder: 'NGUYEN VAN C',
      expiry: '01/25',
      otp: '123456',
      note: t('paymentQR.card3note'),
      type: 'success',
    },
  ] : [];

  const { mutateAsync: createVnpayUrl } = useCreateVNPayUrlMutation();
  const { mutateAsync: cancelOrder, isPending: isCancelling } = useCancelOrderMutation();

  const { data: orderData } = useGetOrderByIdQuery(orderId || '', {
    refetchInterval: 5000,
    enabled: !!orderId,
  });

  useEffect(() => {
    if (amountParam) setAmount(parseFloat(amountParam));
  }, [amountParam]);

  useEffect(() => {
    if (orderData?.data?.paymentStatus === 'paid') {
      setShowSuccessMessage(true);
      let c = 3;
      setCountdown(c);
      const iv = setInterval(() => {
        c--;
        setCountdown(c);
        if (c <= 0) { clearInterval(iv); navigate(ROUTES.ORDERS); }
      }, 1000);
      return () => clearInterval(iv);
    }
    if (orderData?.data?.status === 'cancelled') {
      addNotification({ type: 'warning', message: t('paymentQR.orderCancelled'), duration: 3000 });
      navigate(ROUTES.ORDERS);
    }
  }, [orderData, navigate, addNotification, t]);

  useEffect(() => {
    if (isExpired || timeLeft <= 0) {
      setIsExpired(true);
      if (orderId && !isCancelling && orderData?.data?.status !== 'cancelled') {
        cancelOrder(orderId)
          .catch(() => {})
          .finally(() => setTimeout(() => navigate(ROUTES.CART), 1500));
      }
      return;
    }
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { setIsExpired(true); clearInterval(timer); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isExpired, timeLeft, orderId, cancelOrder, isCancelling, navigate, orderData?.data?.status]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  };

  const copy = async (text: string, field: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 2000);
    } catch { /* clipboard API không khả dụng — bỏ qua */ }
  };

  const handleVnpayPayment = async () => {
    if (!orderId || !amount) return;
    setIsRedirecting(true);
    try {
      const res = await createVnpayUrl({
        amount,
        orderId: numberOrder || orderId,
        bankCode: '',
      });
      if (res.data?.paymentUrl) {
        window.location.href = res.data.paymentUrl;
      }
    } catch (err) {
      addNotification({ type: 'error', message: t('paymentQR.cancelError'), duration: 4000 });
      setIsRedirecting(false);
    }
  };

  // card và cardFields chỉ dùng trong DEV panel — null-safe vì panel bị ẩn khi production
  const card = TEST_CARDS[selectedCard] ?? null;
  // Luôn VND — locale động theo ngôn ngữ UI
  const formatVND = (n: number) => new Intl.NumberFormat(getLocale(), { style: 'currency', currency: 'VND' }).format(n);

  const cardFields = card ? [
    { label: t('paymentQR.cardNumberField'), value: card.cardNumber, field: 'cardNumber' },
    { label: t('paymentQR.cardHolderLabel'), value: card.cardHolder, field: 'cardHolder' },
    { label: t('paymentQR.expiryField'), value: card.expiry, field: 'expiry' },
    { label: 'OTP', value: card.otp, field: 'otp' },
  ] : [];

  if (!orderId || !amountParam) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-100 dark:from-neutral-900 dark:to-neutral-800">
        <div className="text-center p-8 bg-white dark:bg-neutral-800 rounded-2xl shadow-lg max-w-md w-full mx-4">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="h-8 w-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100 mb-2">{t('paymentQR.invalidLink')}</h2>
          <button onClick={() => navigate(ROUTES.HOME)} className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors">
            {t('paymentQR.backHome')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-neutral-900 dark:to-neutral-800 py-8 px-4">
      {showSuccessMessage && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center">
            <div className="w-20 h-20 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-2">{t('paymentQR.successTitle')}</h3>
            <p className="text-neutral-500 dark:text-neutral-400 mb-4">{t('paymentQR.successDesc')}</p>
            <p className="text-sm text-neutral-400">{t('paymentQR.successRedirect', { count: countdown })}</p>
          </div>
        </div>
      )}

      <div className="container mx-auto max-w-4xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium mb-4">
            <span>🔒</span> {t('paymentQR.securePayment')}
          </div>
          <h1 className="text-3xl font-bold text-neutral-800 dark:text-neutral-100">{t('paymentQR.title')}</h1>
          <p className="text-neutral-500 dark:text-neutral-400 mt-2">{t('paymentQR.subtitle')}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-md p-6">
              <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 mb-4 flex items-center gap-2">
                <span>📋</span> {t('paymentQR.orderInfo')}
              </h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-neutral-500">{t('paymentQR.orderCode')}</span>
                  <span className="font-mono font-medium text-neutral-800 dark:text-neutral-200">{numberOrder || orderId}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">{t('paymentQR.status')}</span>
                  <span className="px-2 py-0.5 bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400 rounded-full text-xs font-medium">{t('paymentQR.pendingPayment')}</span>
                </div>
                <div className="border-t border-neutral-100 dark:border-neutral-700 pt-3 flex justify-between items-center">
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">{t('paymentQR.total')}</span>
                  <span className="text-xl font-bold text-blue-600 dark:text-blue-400">{formatVND(amount)}</span>
                </div>
              </div>
            </div>

            <div className={`rounded-2xl p-4 text-center ${isExpired ? 'bg-red-50 dark:bg-red-900/20' : 'bg-amber-50 dark:bg-amber-900/20'}`}>
              <div className="flex items-center justify-center gap-2">
                <span className="text-xl">⏱️</span>
                <span className={`font-semibold text-lg ${isExpired ? 'text-red-600' : 'text-amber-600 dark:text-amber-400'}`}>
                  {isExpired ? t('paymentQR.expired') : formatTime(timeLeft)}
                </span>
              </div>
              <p className="text-xs text-neutral-500 mt-1">{isExpired ? t('paymentQR.willCancel') : t('paymentQR.timeLeft')}</p>
            </div>

            <button
              onClick={handleVnpayPayment}
              disabled={isExpired || isRedirecting}
              className="w-full py-4 px-6 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 disabled:from-neutral-400 disabled:to-neutral-500 text-white font-bold text-lg rounded-2xl shadow-lg hover:shadow-xl transition-all duration-200 flex items-center justify-center gap-3 disabled:cursor-not-allowed"
            >
              {isRedirecting ? (
                <>
                  <svg className="animate-spin h-5 w-5 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  {t('paymentQR.redirecting')}
                </>
              ) : (
                <>
                  <span className="text-2xl">💳</span>
                  {t('paymentQR.payVnpay')}
                </>
              )}
            </button>

            {!isExpired && (
              <button
                onClick={async () => {
                  if (orderId) {
                    try {
                      await cancelOrder(orderId);
                      addNotification({ type: 'success', message: t('paymentQR.cancelSuccess'), duration: 3000 });
                    } catch { /* lỗi huỷ đơn — tiếp tục navigate */ }
                    navigate(ROUTES.ORDERS);
                  }
                }}
                disabled={isCancelling}
                className="w-full py-3 px-6 bg-white dark:bg-neutral-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-500 font-medium rounded-2xl border border-red-200 dark:border-red-800 transition-colors"
              >
                {isCancelling ? t('paymentQR.cancelling') : t('paymentQR.cancelOrder')}
              </button>
            )}
          </div>

          {/* Panel test cards — chỉ hiển thị trong development, ẩn khỏi production bundle */}
          {import.meta.env.DEV && (
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-md p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-100 flex items-center gap-2">
                  <span>🧪</span> {t('paymentQR.testCards')}
                </h2>
                <span className="text-xs px-2 py-1 bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 rounded-full font-medium">{t('paymentQR.devMode')}</span>
              </div>

              <div className="flex gap-2 mb-5 flex-wrap">
                {TEST_CARDS.map((c, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedCard(i)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      selectedCard === i
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                    }`}
                  >
                    {c.type === 'success' ? '✅' : '❌'} {c.bank}
                  </button>
                ))}
              </div>

              {card && (
              <div className={`bg-gradient-to-br ${card.color} rounded-2xl p-6 text-white mb-5 shadow-lg relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-16 translate-x-16" />
                <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-12 -translate-x-8" />
                <div className="relative">
                  <div className="flex items-start justify-between mb-8">
                    <div>
                      <p className="text-white/60 text-xs mb-1">{t('paymentQR.bankLabel')}</p>
                      <p className="font-bold text-lg">{card.logo} {card.bank.split('–')[0].trim()}</p>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded-full font-medium ${card.type === 'success' ? 'bg-green-400/30 text-green-200' : 'bg-red-400/30 text-red-200'}`}>
                        {card.note}
                      </span>
                    </div>
                  </div>
                  <p className="font-mono text-lg tracking-widest mb-6">
                    {card.cardNumber.replace(/(.{4})/g, '$1 ').trim()}
                  </p>
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-white/60 text-xs mb-1">{t('paymentQR.cardHolderLabel')}</p>
                      <p className="font-medium tracking-wide">{card.cardHolder}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white/60 text-xs mb-1">{t('paymentQR.expiryLabel')}</p>
                      <p className="font-medium">{card.expiry}</p>
                    </div>
                  </div>
                </div>
              </div>
              )}

              <div className="space-y-2 mb-5">
                {cardFields.map(({ label, value, field }) => (
                  <div key={field} className="flex items-center justify-between bg-neutral-50 dark:bg-neutral-700/50 rounded-xl px-4 py-3">
                    <span className="text-sm text-neutral-500 dark:text-neutral-400 w-28 flex-shrink-0">{label}</span>
                    <span className="font-mono font-medium text-neutral-800 dark:text-neutral-200 flex-1 text-center">{value}</span>
                    <button
                      onClick={() => copy(value, field)}
                      className="ml-2 p-1.5 hover:bg-neutral-200 dark:hover:bg-neutral-600 rounded-lg transition-colors flex-shrink-0"
                      title={t('paymentQR.copy')}
                    >
                      {copiedField === field ? (
                        <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        <svg className="h-4 w-4 text-neutral-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      )}
                    </button>
                  </div>
                ))}
              </div>

              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2 flex items-center gap-1">
                  <span>📖</span> {t('paymentQR.guide')}
                </h4>
                <ol className="text-xs text-blue-700 dark:text-blue-400 space-y-1 list-decimal list-inside">
                  <li dangerouslySetInnerHTML={{ __html: t('paymentQR.guide1') }} />
                  <li dangerouslySetInnerHTML={{ __html: t('paymentQR.guide2') }} />
                  <li>{t('paymentQR.guide3')}</li>
                  <li><strong>{t('paymentQR.guide4')}</strong></li>
                  <li>{t('paymentQR.guide5')}</li>
                </ol>
              </div>
            </div>

            <div className="flex items-center justify-center gap-6 text-xs text-neutral-400 dark:text-neutral-500">
              <span className="flex items-center gap-1"><span>🔐</span> {t('paymentQR.sslEncrypted')}</span>
              <span className="flex items-center gap-1"><span>🛡️</span> {t('paymentQR.pciDss')}</span>
              <span className="flex items-center gap-1"><span>✅</span> {t('paymentQR.vnpayCertified')}</span>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PaymentQRPage;
