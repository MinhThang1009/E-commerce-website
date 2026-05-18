/**
 * @file TrackOrderPage.tsx
 * @layer Page
 * @feature orders
 * @description Page component của feature orders
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Button from '@/components/common/Button';

interface TrackStep {
  key: string;
  label: string;
  completed: boolean;
}

interface TrackResult {
  orderNumber: string;
  currentStatus: string;
  steps: TrackStep[];
  isCancelled: boolean;
  createdAt: string;
}

const TrackOrderPage: React.FC = () => {
  const { t } = useTranslation();
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [trackingResult, setTrackingResult] = useState<TrackResult | null>(null);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setTrackingResult(null);

    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8888/api';
      const res = await fetch(
        `${apiBase}/orders/track?orderNumber=${encodeURIComponent(orderNumber)}&email=${encodeURIComponent(email)}`,
      );
      const data = await res.json();

      if (!res.ok || data.status !== 'success') {
        setError(t('trackOrder.notFound'));
      } else {
        setTrackingResult(data.data);
      }
    } catch {
      setError(t('trackOrder.notFound'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Chỉ số bước hiện tại để tô màu đường nối giữa các bước
  const currentStepIndex = trackingResult?.steps
    ? trackingResult.steps.filter((s) => s.completed).length - 1
    : -1;

  return (
    <div className="container mx-auto px-4 py-16">
      {/* Phần hero */}
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-4">
          {t('trackOrder.title')}
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-3xl mx-auto">
          {t('trackOrder.subtitle')}
        </p>
      </div>

      <div className="max-w-3xl mx-auto">
        {!trackingResult ? (
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm p-8">
            <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6">
              {t('trackOrder.formTitle')}
            </h2>

            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-lg">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label
                  htmlFor="orderNumber"
                  className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1"
                >
                  {t('trackOrder.orderNumberLabel')}
                </label>
                <input
                  type="text"
                  id="orderNumber"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  placeholder={t('trackOrder.orderNumberPlaceholder')}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="mb-6">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1"
                >
                  {t('trackOrder.emailLabel')}
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t('trackOrder.emailPlaceholder')}
                  required
                  className="w-full px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              <div className="flex items-center justify-end">
                <Button type="submit" variant="primary" disabled={isSubmitting}>
                  {isSubmitting ? t('trackOrder.tracking') : t('trackOrder.trackButton')}
                </Button>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm p-8">
            <div className="flex justify-between items-start mb-8">
              <div>
                <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-2">
                  {t('trackOrder.orderTitle', { number: trackingResult.orderNumber })}
                </h2>
              </div>
              <div className="text-right">
                <div
                  className={`text-lg font-semibold mb-1 ${
                    trackingResult.isCancelled
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-primary-600 dark:text-primary-400'
                  }`}
                >
                  {trackingResult.isCancelled
                    ? t('trackOrder.cancelled')
                    : trackingResult.currentStatus}
                </div>
              </div>
            </div>

            {trackingResult.isCancelled ? (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg text-red-700 dark:text-red-400 mb-6">
                {t('trackOrder.cancelledDesc')}
              </div>
            ) : (
              /* Stepper theo dõi đơn hàng */
              <div className="relative">
                {trackingResult.steps.map((step, index) => (
                  <div key={step.key} className="mb-8 relative">
                    {/* Đường dọc nối các bước */}
                    {index < trackingResult.steps.length - 1 && (
                      <div
                        className={`absolute left-4 top-8 w-0.5 h-full -ml-px ${
                          index < currentStepIndex
                            ? 'bg-primary-500'
                            : 'bg-neutral-300 dark:bg-neutral-600'
                        }`}
                      />
                    )}

                    <div className="flex items-start">
                      {/* Vòng tròn trạng thái */}
                      <div
                        className={`relative flex items-center justify-center w-8 h-8 rounded-full ${
                          step.completed ? 'bg-primary-500' : 'bg-neutral-300 dark:bg-neutral-600'
                        } flex-shrink-0 mr-4`}
                      >
                        {step.completed && (
                          <svg
                            className="w-4 h-4 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>

                      {/* Chi tiết bước */}
                      <div className="flex-1">
                        <h3
                          className={`font-semibold ${
                            step.completed
                              ? 'text-neutral-900 dark:text-white'
                              : 'text-neutral-500 dark:text-neutral-400'
                          }`}
                        >
                          {step.label}
                        </h3>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 pt-6 border-t border-neutral-200 dark:border-neutral-700">
              <div className="flex justify-between items-center">
                <button
                  onClick={() => {
                    setTrackingResult(null);
                    setOrderNumber('');
                    setEmail('');
                  }}
                  className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                >
                  {t('trackOrder.trackAnother')}
                </button>
                <Button variant="outline">{t('trackOrder.contactSupport')}</Button>
              </div>
            </div>
          </div>
        )}

        {/* Phần hỗ trợ */}
        <div className="mt-12 bg-neutral-50 dark:bg-neutral-800 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-4">
            {t('trackOrder.needHelp')}
          </h3>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t('trackOrder.helpDesc')}</p>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-primary-500 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                />
              </svg>
              <span className="text-neutral-700 dark:text-neutral-300">
                {t('trackOrder.supportEmail')}
              </span>
            </div>
            <div className="flex items-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-primary-500 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z"
                />
              </svg>
              <span className="text-neutral-700 dark:text-neutral-300">
                {t('trackOrder.supportPhone')}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrackOrderPage;
