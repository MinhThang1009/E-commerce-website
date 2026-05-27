/**
 * @file ProductPricingForm.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useTranslation } from 'react-i18next';

const inputClassName =
  'flex h-10 w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 shadow-sm transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50';

interface ProductPricingFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  hasVariants?: boolean;
  variants?: Array<{ price?: number }>;
}

const ProductPricingForm: React.FC<ProductPricingFormProps> = ({
  form,
  hasVariants = false,
  variants = [],
}) => {
  const { t } = useTranslation();
  const variantsNeedPrices = hasVariants && variants.some((v) => !v.price || v.price <= 0);

  // Formatter: thêm dấu phẩy phân cách hàng nghìn khi hiển thị
  const formatNumber = (value: string) => {
    const num = value.replace(/[^0-9]/g, '');
    return num ? Number(num).toLocaleString('en-US') : '';
  };

  const parseNumber = (value: string) => {
    const parsed = Number(value.replace(/[^0-9]/g, ''));
    return isNaN(parsed) ? 0 : parsed;
  };

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-4">
      {hasVariants && (
        <div className="col-span-2">
          <Alert variant="warning" className="mb-4">
            <AlertTitle>{t('admin.products.pricing.variantAlert')}</AlertTitle>
            <AlertDescription>
              <div>
                <p>
                  <strong>{t('admin.products.pricing.variantImportantNote')}</strong>{' '}
                  {t('admin.products.pricing.variantStockDesc')}
                </p>
                <ul className="mb-0 pl-5">
                  <li>
                    <strong>{t('admin.products.pricing.variantStockLabel')}</strong>{' '}
                    {t('admin.products.pricing.variantStockAuto')}
                  </li>
                </ul>
                {variantsNeedPrices && (
                  <p className="mt-2 text-[var(--admin-error)]">
                    {t('admin.products.pricing.variantGoBack')}
                  </p>
                )}
              </div>
            </AlertDescription>
          </Alert>
        </div>
      )}

      <div>
        <Label className="mb-1.5 block">
          {t('admin.products.pricing.priceLabel')} <span className="text-red-500">*</span>
          {hasVariants && (
            <span
              className="ml-1 text-xs text-neutral-500"
              title={t('admin.products.pricing.priceTooltipVariant')}
            >
              ({t('admin.products.pricing.priceTooltipVariant')})
            </span>
          )}
        </Label>
        <div className="flex w-full">
          <input
            type="text"
            className={`${inputClassName} rounded-r-none`}
            placeholder={t('admin.products.pricing.pricePlaceholder')}
            disabled={hasVariants}
            value={formatNumber(String(form.watch('price') ?? ''))}
            onChange={(e) => form.setValue('price', parseNumber(e.target.value))}
          />
          <span className="inline-flex items-center px-3 border border-l-0 border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 rounded-r-xl text-sm text-neutral-600 dark:text-neutral-400">
            {t('common.currencySymbol')}
          </span>
        </div>
        {form.formState.errors.price?.message && (
          <p className="text-sm text-red-500 mt-1">{String(form.formState.errors.price.message)}</p>
        )}
      </div>

      <div>
        <Label className="mb-1.5 block">
          {t('admin.products.pricing.comparePriceLabel')}
          {hasVariants ? (
            <span
              className="ml-1 text-xs text-neutral-500"
              title={t('admin.products.pricing.comparePriceTooltipVariant')}
            >
              ({t('admin.products.pricing.comparePriceTooltipVariant')})
            </span>
          ) : (
            <span
              className="ml-1 text-xs text-neutral-500"
              title={t('admin.products.pricing.comparePriceTooltip')}
            >
              ({t('admin.products.pricing.comparePriceTooltip')})
            </span>
          )}
        </Label>
        <div className="flex w-full">
          <input
            type="text"
            className={`${inputClassName} rounded-r-none`}
            placeholder="0"
            disabled={hasVariants}
            value={formatNumber(String(form.watch('compareAtPrice') ?? ''))}
            onChange={(e) => form.setValue('compareAtPrice', parseNumber(e.target.value))}
          />
          <span className="inline-flex items-center px-3 border border-l-0 border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 rounded-r-xl text-sm text-neutral-600 dark:text-neutral-400">
            {t('common.currencySymbol')}
          </span>
        </div>
      </div>

      <div>
        <Label className="mb-1.5 block">
          {hasVariants
            ? t('admin.products.pricing.stockLabelVariant')
            : t('admin.products.pricing.stockLabel')}
          {hasVariants && (
            <span
              className="ml-1 text-xs text-neutral-500"
              title={t('admin.products.pricing.stockTooltipVariant')}
            >
              ({t('admin.products.pricing.stockTooltipVariant')})
            </span>
          )}
        </Label>
        <input
          type="number"
          className={inputClassName}
          placeholder="0"
          min={0}
          disabled={hasVariants}
          value={form.watch('stockQuantity') ?? ''}
          onChange={(e) => form.setValue('stockQuantity', Number(e.target.value))}
        />
        {hasVariants && (
          <p className="text-xs text-neutral-500 mt-1">
            {t('admin.products.pricing.stockAutoUpdate')}
          </p>
        )}
        {form.formState.errors.stockQuantity?.message && (
          <p className="text-sm text-red-500 mt-1">
            {String(form.formState.errors.stockQuantity.message)}
          </p>
        )}
      </div>

      <div>
        <div className="flex items-center gap-2">
          <Label>{t('admin.products.pricing.featuredLabel')}</Label>
          <Switch
            checked={!!form.watch('featured')}
            onCheckedChange={(checked) => form.setValue('featured', checked)}
          />
        </div>
      </div>

      <div className="col-span-2">
        <Alert variant="info">
          <Info className="size-4" />
          <AlertTitle>{t('admin.products.pricing.infoAlert')}</AlertTitle>
          <AlertDescription>{t('admin.products.pricing.infoAlertDesc')}</AlertDescription>
        </Alert>
      </div>
    </div>
  );
};

export default ProductPricingForm;
