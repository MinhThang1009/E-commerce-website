/**
 * @file ShippingReturnsPage.tsx
 * @layer Page
 * @feature global
 * @description Top-level page component
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/routes/paths';
import Button from '@/components/common/Button';

const ShippingReturnsPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center mb-16">
        <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-4">
          {t('shipping.heroTitle')}
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-3xl mx-auto">
          {t('shipping.heroSubtitle')}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-16">
        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm p-8 text-center">
          <div className="flex justify-center mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-primary-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
            {t('shipping.freeTitle')}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400">{t('shipping.freeDesc')}</p>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm p-8 text-center">
          <div className="flex justify-center mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-primary-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
            {t('shipping.fastTitle')}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400">{t('shipping.fastDesc')}</p>
        </div>

        <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-sm p-8 text-center">
          <div className="flex justify-center mb-4">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-12 w-12 text-primary-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 15v-1a4 4 0 00-4-4H8m0 0l3 3m-3-3l3-3m9 14V5a2 2 0 00-2-2H6a2 2 0 00-2 2v16l4-2 4 2 4-2 4 2z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-neutral-900 dark:text-white mb-2">
            {t('shipping.easyTitle')}
          </h2>
          <p className="text-neutral-600 dark:text-neutral-400">{t('shipping.easyDesc')}</p>
        </div>
      </div>

      <div className="mb-16">
        <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-8 pb-4 border-b border-neutral-200 dark:border-neutral-700">
          {t('shipping.infoTitle')}
        </h2>

        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">
              {t('shipping.methodsTitle')}
            </h3>
            <div className="bg-white dark:bg-neutral-800 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-neutral-200 dark:divide-neutral-700">
                <thead className="bg-neutral-50 dark:bg-neutral-700">
                  <tr>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-300 uppercase tracking-wider"
                    >
                      {t('shipping.colMethod')}
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-300 uppercase tracking-wider"
                    >
                      {t('shipping.colDelivery')}
                    </th>
                    <th
                      scope="col"
                      className="px-6 py-3 text-left text-xs font-medium text-neutral-500 dark:text-neutral-300 uppercase tracking-wider"
                    >
                      {t('shipping.colCost')}
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-neutral-800 divide-y divide-neutral-200 dark:divide-neutral-700">
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900 dark:text-white">
                      {t('shipping.standardMethod')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                      {t('shipping.standardTime')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                      {t('shipping.standardCost')}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900 dark:text-white">
                      {t('shipping.expressMethod')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                      {t('shipping.expressTime')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                      {t('shipping.expressCost')}
                    </td>
                  </tr>
                  <tr>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-900 dark:text-white">
                      {t('shipping.intlMethod')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                      {t('shipping.intlTime')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-neutral-600 dark:text-neutral-400">
                      {t('shipping.intlCost')}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">
              {t('shipping.processingTitle')}
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              {t('shipping.processingP1')}
            </p>
            <p className="text-neutral-600 dark:text-neutral-400">{t('shipping.processingP2')}</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">
              {t('shipping.intlInfoTitle')}
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              {t('shipping.intlInfoP1')}
            </p>
            <p className="text-neutral-600 dark:text-neutral-400">{t('shipping.intlInfoP2')}</p>
          </div>
        </div>
      </div>

      <div className="mb-16">
        <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-8 pb-4 border-b border-neutral-200 dark:border-neutral-700">
          {t('shipping.returnsTitle')}
        </h2>

        <div className="space-y-8">
          <div>
            <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">
              {t('shipping.returnPolicyTitle')}
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              {t('shipping.returnPolicyP1')}
            </p>
            <p className="text-neutral-600 dark:text-neutral-400">{t('shipping.returnPolicyP2')}</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">
              {t('shipping.refundTitle')}
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t('shipping.refundP1')}</p>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t('shipping.refundP2')}</p>
            <p className="text-neutral-600 dark:text-neutral-400">{t('shipping.refundP3')}</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">
              {t('shipping.exchangeTitle')}
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400">{t('shipping.exchangeP')}</p>
          </div>

          <div>
            <h3 className="text-xl font-semibold text-neutral-900 dark:text-white mb-4">
              {t('shipping.damagedTitle')}
            </h3>
            <p className="text-neutral-600 dark:text-neutral-400">{t('shipping.damagedP')}</p>
          </div>
        </div>
      </div>

      <div className="mb-16">
        <h2 className="text-3xl font-bold text-neutral-900 dark:text-white mb-8">
          {t('shipping.faqsTitle')}
        </h2>

        <div className="space-y-6">
          {(['faq1', 'faq2', 'faq3', 'faq4', 'faq5'] as const).map((key) => (
            <div
              key={key}
              className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6 border border-neutral-200 dark:border-neutral-700"
            >
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-white mb-3">
                {t(`shipping.${key}.question`)}
              </h3>
              <p className="text-neutral-600 dark:text-neutral-400">
                {t(`shipping.${key}.answer`)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-8 text-center">
        <h2 className="text-2xl font-bold text-primary-700 dark:text-primary-400 mb-4">
          {t('shipping.contact.title')}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto mb-6">
          {t('shipping.contact.desc')}
        </p>
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button variant="primary" size="md" as={Link} to={ROUTES.CONTACT}>
            {t('shipping.contact.btn')}
          </Button>
          <Button variant="outline" size="md" as={Link} to={ROUTES.FAQS}>
            {t('shipping.contact.faqsBtn')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ShippingReturnsPage;
