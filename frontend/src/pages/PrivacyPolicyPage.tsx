import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/routes/paths';

const PrivacyPolicyPage: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-4">
          {t('privacy.pageTitle')}
        </h1>
        <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-3xl mx-auto">
          {t('privacy.lastUpdated')}
        </p>
      </div>

      <div className="max-w-4xl mx-auto bg-white dark:bg-neutral-800 rounded-xl shadow-sm p-8 mb-12">
        <div className="prose prose-lg dark:prose-invert max-w-none">
          <p>{t('privacy.intro')}</p>

          <h2>{t('privacy.s1.title')}</h2>
          <p>{t('privacy.s1.intro')}</p>
          <ul>
            <li><strong>{t('privacy.s1.personalLabel')}</strong> {t('privacy.s1.personalBody')}</li>
            <li><strong>{t('privacy.s1.transLabel')}</strong> {t('privacy.s1.transBody')}</li>
            <li><strong>{t('privacy.s1.logLabel')}</strong> {t('privacy.s1.logBody')}</li>
            <li><strong>{t('privacy.s1.cookieLabel')}</strong> {t('privacy.s1.cookieBody')}</li>
          </ul>

          <h2>{t('privacy.s2.title')}</h2>
          <p>{t('privacy.s2.intro')}</p>
          <ul>
            <li>{t('privacy.s2.u1')}</li>
            <li>{t('privacy.s2.u2')}</li>
            <li>{t('privacy.s2.u3')}</li>
            <li>{t('privacy.s2.u4')}</li>
            <li>{t('privacy.s2.u5')}</li>
            <li>{t('privacy.s2.u6')}</li>
            <li>{t('privacy.s2.u7')}</li>
            <li>{t('privacy.s2.u8')}</li>
          </ul>

          <h2>{t('privacy.s3.title')}</h2>
          <p>{t('privacy.s3.intro')}</p>
          <ul>
            <li><strong>{t('privacy.s3.providerLabel')}</strong> {t('privacy.s3.providerBody')}</li>
            <li><strong>{t('privacy.s3.bizLabel')}</strong> {t('privacy.s3.bizBody')}</li>
            <li><strong>{t('privacy.s3.legalLabel')}</strong> {t('privacy.s3.legalBody')}</li>
            <li><strong>{t('privacy.s3.consentLabel')}</strong> {t('privacy.s3.consentBody')}</li>
          </ul>

          <h2>{t('privacy.s4.title')}</h2>
          <p>{t('privacy.s4.body')}</p>

          <h2>{t('privacy.s5.title')}</h2>
          <p>{t('privacy.s5.intro')}</p>
          <ul>
            <li>{t('privacy.s5.r1')}</li>
            <li>{t('privacy.s5.r2')}</li>
            <li>{t('privacy.s5.r3')}</li>
            <li>{t('privacy.s5.r4')}</li>
            <li>{t('privacy.s5.r5')}</li>
            <li>{t('privacy.s5.r6')}</li>
          </ul>
          <p>{t('privacy.s5.outro')}</p>

          <h2>{t('privacy.s6.title')}</h2>
          <p>{t('privacy.s6.body')}</p>

          <h2>{t('privacy.s7.title')}</h2>
          <p>{t('privacy.s7.body')}</p>

          <h2>{t('privacy.s8.title')}</h2>
          <p>{t('privacy.s8.body')}</p>

          <h2>{t('privacy.s9.title')}</h2>
          <p>
            {t('privacy.s9.body')}
            <br />
            {t('privacy.s9.email')}
            <br />
            {t('privacy.s9.phone')}
            <br />
            {t('privacy.s9.address')}
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto text-center">
        <p className="text-neutral-600 dark:text-neutral-400 mb-6">
          {t('privacy.contactDesc')}
        </p>
        <Link
          to={ROUTES.CONTACT}
          className="inline-block bg-primary-600 hover:bg-primary-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
        >
          {t('privacy.contactBtn')}
        </Link>
      </div>
    </div>
  );
};

export default PrivacyPolicyPage;
