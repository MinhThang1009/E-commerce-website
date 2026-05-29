/**
 * @file VariantModal.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { formatAttributeKey } from '../utils/product-naming';

const inputNumberClassName =
  'flex h-10 w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 shadow-sm transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50';

interface Variant {
  id?: string;
  name: string;
  price: number;
  compareAtPrice?: number | null;
  stock?: number;
  stockQuantity?: number;
  sku?: string;
  attributes?: Record<string, string>;
  value?: string;
  images?: string[];
}

interface VariantModalProps {
  open: boolean;
  onClose: () => void;
  variant?: Variant | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Caller passes different variant types
  onSave: (variant: any) => void;
  attributes: Array<{ id?: string; name: string; value?: string; values?: string[] }>;
}

const VariantModal: React.FC<VariantModalProps> = ({
  open,
  onClose,
  variant,
  onSave,
  attributes,
}) => {
  const { t } = useTranslation();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const form = useForm<any>({
    defaultValues: {
      name: '',
      price: 0,
      stock: 0,
      sku: '',
    },
  });

  useEffect(() => {
    if (variant) {
      form.reset({
        name: variant.name || '',
        price: variant.price || 0,
        stock: variant.stock || 0,
        sku: variant.sku || '',
        compareAtPrice: variant.compareAtPrice || null,
        images: Array.isArray(variant.images) ? variant.images.join('\n') : variant.images || '',
        ...variant.attributes,
      });
    } else {
      form.reset({
        name: '',
        price: 0,
        stock: 0,
        sku: '',
      });
    }
  }, [variant, form, open]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Form destructuring can dynamic keys
  const handleSubmit = form.handleSubmit((values: any) => {
    const { name, price, compareAtPrice, stock, sku, images, ...attributeValues } = values;

    const filteredAttributes: Record<string, string> = {};
    Object.keys(attributeValues).forEach((key) => {
      if (
        attributeValues[key] !== undefined &&
        attributeValues[key] !== null &&
        attributeValues[key] !== ''
      ) {
        filteredAttributes[key] = attributeValues[key];
      }
    });

    const parsedImages = images
      ? images
          .split('\n')
          .map((u: string) => u.trim())
          .filter(Boolean)
      : [];

    const variantData: Variant = {
      id: variant?.id,
      name: name.trim(),
      price: price || 0,
      compareAtPrice: compareAtPrice ? Number(compareAtPrice) : null,
      stock: stock || 0,
      sku: sku ? sku.trim() : '',
      attributes: filteredAttributes,
      images: parsedImages,
    };

    onSave(variantData);
    handleClose();
  });

  const handleClose = () => {
    form.reset();
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
      }}
    >
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {variant ? t('variantModal.editTitle') : t('variantModal.addTitle')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">{t('variantModal.nameLabel')}</Label>
                <Input
                  placeholder={t('variantModal.namePlaceholder')}
                  {...form.register('name', { required: t('variantModal.nameRequired') })}
                />
                {form.formState.errors.name?.message && (
                  <p className="text-sm text-[var(--color-danger)] mt-1">
                    {String(form.formState.errors.name.message)}
                  </p>
                )}
              </div>

              <div>
                <Label className="mb-1.5 block">
                  {t('variantModal.skuLabel')}
                  <span
                    className="ml-1 text-xs text-neutral-500"
                    title={t('variantModal.skuTooltip')}
                  >
                    (?)
                  </span>
                </Label>
                <Input placeholder={t('variantModal.skuPlaceholder')} {...form.register('sku')} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="mb-1.5 block">
                  {t('variantModal.priceLabel')}{' '}
                  <span className="text-[var(--color-danger)]">*</span>
                  <span
                    className="ml-1 text-xs text-neutral-500"
                    title={t('variantModal.priceTooltip')}
                  >
                    (?)
                  </span>
                </Label>
                <div className="flex">
                  <input
                    type="number"
                    className={`${inputNumberClassName} rounded-r-none`}
                    placeholder="1,000,000"
                    min={0}
                    step={1000}
                    {...form.register('price', { required: t('variantModal.priceRequired') })}
                  />
                  <span className="inline-flex items-center px-3 border border-l-0 border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 rounded-r-xl text-sm text-neutral-600 dark:text-neutral-400">
                    {t('common.currencySymbol')}
                  </span>
                </div>
                {form.formState.errors.price?.message && (
                  <p className="text-sm text-[var(--color-danger)] mt-1">
                    {String(form.formState.errors.price.message)}
                  </p>
                )}
              </div>

              <div>
                <Label className="mb-1.5 block">
                  {t('variantModal.comparePriceLabel')}
                  <span
                    className="ml-1 text-xs text-neutral-500"
                    title={t('variantModal.comparePriceTooltip')}
                  >
                    (?)
                  </span>
                </Label>
                <div className="flex">
                  <input
                    type="number"
                    className={`${inputNumberClassName} rounded-r-none`}
                    placeholder="12,990,000"
                    min={0}
                    step={1000}
                    {...form.register('compareAtPrice')}
                  />
                  <span className="inline-flex items-center px-3 border border-l-0 border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 rounded-r-xl text-sm text-neutral-600 dark:text-neutral-400">
                    {t('common.currencySymbol')}
                  </span>
                </div>
              </div>

              <div>
                <Label className="mb-1.5 block">
                  {t('variantModal.stockLabel')}{' '}
                  <span className="text-[var(--color-danger)]">*</span>
                </Label>
                <div className="flex">
                  <input
                    type="number"
                    className={`${inputNumberClassName} rounded-r-none`}
                    placeholder="50"
                    min={0}
                    {...form.register('stock', { required: t('variantModal.stockRequired') })}
                  />
                  <span className="inline-flex items-center px-3 border border-l-0 border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800 rounded-r-xl text-sm text-neutral-600 dark:text-neutral-400">
                    {t('common.unitProduct')}
                  </span>
                </div>
                {form.formState.errors.stock?.message && (
                  <p className="text-sm text-[var(--color-danger)] mt-1">
                    {String(form.formState.errors.stock.message)}
                  </p>
                )}
              </div>
            </div>

            {/* Thuoc tinh bien the */}
            {attributes.length > 0 && (
              <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4 mt-4">
                <h3 className="mb-4 font-semibold">{t('variantModal.attrSectionTitle')}</h3>
                <div className="grid grid-cols-2 gap-4">
                  {attributes.map((attr) => {
                    const values = attr.value
                      ? (attr.value as string)
                          .split(',')
                          .map((v: string) => v.trim())
                          .filter((v: string) => v)
                      : [];
                    return (
                      <div key={attr.id}>
                        <Label className="mb-1.5 block">{formatAttributeKey(attr.name)}</Label>
                        <Select
                          value={form.watch(attr.name) || ''}
                          onValueChange={(v) => form.setValue(attr.name, v)}
                        >
                          <SelectTrigger>
                            <SelectValue
                              placeholder={t('variantModal.selectAttr', {
                                name: formatAttributeKey(attr.name),
                              })}
                            />
                          </SelectTrigger>
                          <SelectContent>
                            {values.map((value: string) => (
                              <SelectItem key={value} value={value}>
                                {value}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Anh bien the */}
            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4 mt-4">
              <Label className="mb-1.5 block">{t('variantModal.imagesLabel')}</Label>
              <textarea
                className="flex w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 shadow-sm transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:border-[var(--accent)]"
                rows={3}
                placeholder={t('variantModal.imagesPlaceholder')}
                {...form.register('images')}
              />
              <p className="text-xs text-neutral-500 mt-1">{t('variantModal.imagesHint')}</p>
            </div>
          </div>

          {/* Nut submit */}
          <div className="text-right mt-6">
            <div className="inline-flex items-center gap-2">
              <Button variant="outline" type="button" onClick={handleClose}>
                <X className="size-4" />
                {t('common.cancel')}
              </Button>
              <Button type="submit" className="admin-btn-primary">
                <Save className="size-4" />
                {variant ? t('variantModal.updateBtn') : t('variantModal.addBtn')}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default VariantModal;
