/**
 * @file ProductSeoForm.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

interface ProductSeoFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
}

const ProductSeoForm: React.FC<ProductSeoFormProps> = ({ form }) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
      {/* SEO Title — VI */}
      <div>
        <Label className="mb-1.5 block">{`${t('admin.products.seo.titleLabel')} (VI)`}</Label>
        <Input
          placeholder={t('admin.products.seo.titlePlaceholder')}
          maxLength={60}
          {...form.register('seoTitleVi')}
        />
      </div>
      {/* SEO Title — EN */}
      <div>
        <Label className="mb-1.5 block">{`${t('admin.products.seo.titleLabel')} (EN)`}</Label>
        <Input placeholder="SEO title in English" maxLength={60} {...form.register('seoTitleEn')} />
      </div>

      {/* SEO Description — VI */}
      <div>
        <Label className="mb-1.5 block">{`${t('admin.products.seo.descLabel')} (VI)`}</Label>
        <textarea
          className="flex w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 shadow-sm transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          rows={3}
          placeholder={t('admin.products.seo.descPlaceholder')}
          maxLength={160}
          {...form.register('seoDescriptionVi')}
        />
      </div>
      {/* SEO Description — EN */}
      <div>
        <Label className="mb-1.5 block">{`${t('admin.products.seo.descLabel')} (EN)`}</Label>
        <textarea
          className="flex w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 shadow-sm transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          rows={3}
          placeholder="SEO description in English"
          maxLength={160}
          {...form.register('seoDescriptionEn')}
        />
      </div>

      <div className="col-span-2">
        <Label className="mb-1.5 block">{t('admin.products.seo.keywordsLabel')}</Label>
        <textarea
          className="flex w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 shadow-sm transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
          rows={2}
          placeholder={t('admin.products.seo.keywordsPlaceholder')}
          maxLength={200}
          {...form.register('seoKeywords')}
        />
      </div>

      <div className="col-span-2">
        <Alert variant="info">
          <Info className="size-4" />
          <AlertTitle>{t('admin.products.seo.alertTitle')}</AlertTitle>
          <AlertDescription>
            <div>
              <p>• {t('admin.products.seo.tip1')}</p>
              <p>• {t('admin.products.seo.tip2')}</p>
              <p>• {t('admin.products.seo.tip3')}</p>
              <p>• {t('admin.products.seo.tip4')}</p>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
};

export default ProductSeoForm;
