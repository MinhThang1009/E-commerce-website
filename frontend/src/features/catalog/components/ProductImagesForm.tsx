/**
 * @file ProductImagesForm.tsx
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

interface ProductImagesFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
}

const ProductImagesForm: React.FC<ProductImagesFormProps> = ({ form }) => {
  const { t } = useTranslation();

  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <Label className="mb-1.5 block">{t('admin.products.images.label')}</Label>
        <textarea
          className="flex w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 shadow-sm transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
          rows={6}
          placeholder={t('admin.products.images.placeholder')}
          maxLength={3000}
          {...form.register('images')}
        />
      </div>

      <div>
        <Label className="mb-1.5 block">{t('admin.products.images.thumbnailLabel')}</Label>
        <Input
          placeholder={t('admin.products.images.thumbnailPlaceholder')}
          {...form.register('thumbnail')}
        />
      </div>

      <Alert variant="info">
        <Info className="size-4" />
        <AlertTitle>{t('admin.products.images.guideTitle')}</AlertTitle>
        <AlertDescription>
          <div>
            <p>
              <strong>📝 {t('admin.products.images.howToLabel')}:</strong>{' '}
              {t('admin.products.images.guideInput')}
            </p>
            <p>
              <strong>🖼️ {t('admin.products.images.requirementsLabel')}:</strong>{' '}
              {t('admin.products.images.guideRequirement')}
            </p>
            <p>
              <strong>📁 {t('admin.products.images.formatLabel')}:</strong>{' '}
              {t('admin.products.images.guideFormat')}
            </p>
            <p>
              <strong>🎯 {t('admin.products.images.thumbnailLabel')}:</strong>{' '}
              {t('admin.products.images.guideThumbnail')}
            </p>
            <p>
              <strong>🔗 Backend:</strong> {t('admin.products.images.guideBackend')}
            </p>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default ProductImagesForm;
