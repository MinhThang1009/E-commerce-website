/**
 * @file NotFoundPage.tsx
 * @layer Page
 * @feature global
 * @description Top-level page component
 */
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PremiumButton } from '@/components/common';
import { ROUTES } from '@/routes/paths';

const NotFoundPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="container mx-auto px-4 py-16 flex flex-col items-center justify-center text-center">
      <div className="max-w-md">
        <h1 className="text-9xl font-bold text-primary-500 dark:text-primary-400 mb-4">404</h1>
        <h2 className="text-3xl font-bold text-neutral-800 dark:text-neutral-100 mb-4">
          {t('notFound.title')}
        </h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-8">{t('notFound.description')}</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <PremiumButton variant="primary" size="large" onClick={() => navigate(ROUTES.HOME)}>
            {t('notFound.goHome')}
          </PremiumButton>
          <PremiumButton variant="outline" size="large" onClick={() => navigate(ROUTES.SHOP)}>
            {t('notFound.browseProducts')}
          </PremiumButton>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
