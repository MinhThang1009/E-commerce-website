/**
 * @file TermsPage.tsx
 * @layer Page
 * @feature global
 * @description Top-level page component
 */
import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/routes/paths';

const TermsPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-4">
          {t('terms.pageTitle')}
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-3xl mx-auto">
          {t('terms.lastUpdated')}
        </p>
      </div>

      <div className="max-w-4xl mx-auto bg-white dark:bg-neutral-800 rounded-xl shadow-sm p-8 mb-12">
        <div className="prose prose-lg dark:prose-invert max-w-none">
          <p>{t('terms.intro')}</p>

          <h2>{t('terms.s1.title')}</h2>
          <p>{t('terms.s1.body')}</p>

          <h2>{t('terms.s2.title')}</h2>
          <p>{t('terms.s2.body')}</p>
          <p>{t('terms.s2.mustNot')}</p>
          <ul>
            <li>{t('terms.s2.r1')}</li>
            <li>{t('terms.s2.r2')}</li>
            <li>{t('terms.s2.r3')}</li>
            <li>{t('terms.s2.r4')}</li>
          </ul>

          <h2>{t('terms.s3.title')}</h2>
          <p>{t('terms.s3.body')}</p>

          <h2>{t('terms.s4.title')}</h2>
          <p>{t('terms.s4.body1')}</p>
          <p>{t('terms.s4.body2')}</p>

          <h2>{t('terms.s5.title')}</h2>
          <p>{t('terms.s5.body')}</p>

          <h2>{t('terms.s6.title')}</h2>
          <p>{t('terms.s6.body1')}</p>
          <p>{t('terms.s6.body2')}</p>

          <h2>{t('terms.s7.title')}</h2>
          <p>{t('terms.s7.body')}</p>

          <h2>{t('terms.s8.title')}</h2>
          <p>{t('terms.s8.body')}</p>

          <h2>{t('terms.s9.title')}</h2>
          <p>{t('terms.s9.body')}</p>

          <h2>{t('terms.s10.title')}</h2>
          <p>{t('terms.s10.body')}</p>

          <h2>{t('terms.s11.title')}</h2>
          <p>{t('terms.s11.body')}</p>

          <h2>{t('terms.s12.title')}</h2>
          <p>{t('terms.s12.body')}</p>

          <h2>{t('terms.s13.title')}</h2>
          <p>{t('terms.s13.body')}</p>

          <h2>{t('terms.s14.title')}</h2>
          <p>{t('terms.s14.body')}</p>

          <h2>{t('terms.s15.title')}</h2>
          <p>{t('terms.s15.body')}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto text-center">
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">{t('terms.contactDesc')}</p>
        <Link
          to={ROUTES.CONTACT}
          className="inline-block bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
        >
          {t('terms.contactBtn')}
        </Link>
      </div>
    </div>
  );
};

export default TermsPage;
