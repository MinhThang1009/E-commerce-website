/**
 * @file ProductBasicInfoForm.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Info, CheckCircle2, PauseCircle, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import TiptapEditor from '@/components/common/TiptapEditor';
import Base64ImageWarning from './Base64ImageWarning';

interface ProductBasicInfoFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  fillExampleData: () => void;
  productId?: string;
}

const ProductBasicInfoForm: React.FC<ProductBasicInfoFormProps> = ({
  form,
  fillExampleData,
  productId: _productId,
}) => {
  const { t } = useTranslation();
  const description = form.watch('description') || '';

  const handleFillSampleData = async () => {
    if (!import.meta.env.DEV) return;
    const { SAMPLE_LAPTOP_DATA } = await import('../utils/sample-product-data');
    Object.entries(SAMPLE_LAPTOP_DATA).forEach(([key, value]) => {
      form.setValue(key, value);
    });
    fillExampleData();
  };
  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <Label className="mb-1.5 block">{t('admin.products.form.name')}</Label>
        <Input
          placeholder={t('admin.products.form.namePlaceholder')}
          className="h-11"
          {...form.register('name')}
        />
        {form.formState.errors.name?.message && (
          <p className="text-sm text-red-500 mt-1">{String(form.formState.errors.name.message)}</p>
        )}
      </div>

      <div>
        <Label className="mb-1.5 block">{t('admin.products.form.status')}</Label>
        <Select
          value={form.watch('status') || ''}
          onValueChange={(v) => form.setValue('status', v)}
        >
          <SelectTrigger>
            <SelectValue placeholder={t('admin.products.form.statusPlaceholder')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-[var(--admin-success)]" strokeWidth={2.25} />
                {t('admin.products.form.statusActive')}
              </span>
            </SelectItem>
            <SelectItem value="inactive">
              <span className="flex items-center gap-2">
                <PauseCircle className="h-4 w-4 text-[var(--admin-warning)]" strokeWidth={2.25} />
                {t('admin.products.form.statusInactive')}
              </span>
            </SelectItem>
            <SelectItem value="draft">
              <span className="flex items-center gap-2">
                <PenLine className="h-4 w-4 text-[var(--text-tertiary)]" strokeWidth={2.25} />
                {t('admin.products.form.statusDraft')}
              </span>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-1.5 block">{t('admin.products.form.shortDescription')}</Label>
        <textarea
          className="flex w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 shadow-sm transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
          rows={3}
          placeholder={t('admin.products.form.shortDescriptionPlaceholder')}
          maxLength={200}
          {...form.register('shortDescription')}
        />
        {form.formState.errors.shortDescription?.message && (
          <p className="text-sm text-red-500 mt-1">
            {String(form.formState.errors.shortDescription.message)}
          </p>
        )}
      </div>

      <div>
        <Label className="mb-1.5 block">{t('admin.products.form.description')}</Label>
        <TiptapEditor
          mode="full"
          placeholder={t('admin.products.form.descriptionPlaceholder')}
          height={300}
          value={description}
          onChange={(html) => form.setValue('description', html)}
        />
        {form.formState.errors.description?.message && (
          <p className="text-sm text-red-500 mt-1">
            {String(form.formState.errors.description.message)}
          </p>
        )}
        {description && <Base64ImageWarning description={description} />}
      </div>

      <Alert variant="info">
        <Info className="size-4" />
        <AlertTitle>{t('admin.products.form.tipTitle')}</AlertTitle>
        <AlertDescription>
          <div>
            <p>• {t('admin.products.form.tipLine1')}</p>
            <p>• {t('admin.products.form.tipLine2')}</p>
            {import.meta.env.DEV && (
              <p>
                •{' '}
                <Button variant="link" size="sm" onClick={handleFillSampleData}>
                  {t('admin.products.form.tipFillData')}
                </Button>{' '}
                {t('admin.products.form.tipFillDataSuffix')}
              </p>
            )}
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
};

export default ProductBasicInfoForm;
