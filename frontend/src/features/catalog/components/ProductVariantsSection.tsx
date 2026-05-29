/**
 * @file ProductVariantsSection.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ProductVariant } from '@/types';
import { getLocale } from '@/utils/format';
import { formatAttributeKey } from '../utils/product-naming';

interface ProductVariantsSectionProps {
  variants: ProductVariant[];
  onAddVariant: () => void;
  onEditVariant: (variant: ProductVariant) => void;
  onDeleteVariant: (id: string) => void;
}

const ProductVariantsSection: React.FC<ProductVariantsSectionProps> = ({
  variants,
  onAddVariant,
  onEditVariant,
  onDeleteVariant,
}) => {
  const { t } = useTranslation();

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h5 className="text-base font-semibold">
            {t('productSection.variants.sectionTitle')}{' '}
            <span className="text-[var(--admin-error)]">*</span>
          </h5>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('productSection.variants.sectionDesc')}
          </p>
          <p className="text-sm text-[var(--admin-warning)] mt-2">
            <strong>{t('common.note')}:</strong> {t('productSection.variants.note')}
          </p>
        </div>
        <Button onClick={onAddVariant} className="admin-btn-primary">
          <Plus className="size-4" />
          {t('productSection.variants.addButton')}
        </Button>
      </div>

      {variants.length === 0 && (
        <Alert variant="info" className="mb-4">
          <AlertTitle>{t('productSection.variants.emptyInfo')}</AlertTitle>
          <AlertDescription>{t('productSection.variants.emptyInfoDesc')}</AlertDescription>
        </Alert>
      )}

      <div className="w-full overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">
                {t('productSection.variants.nameColumn')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">
                {t('productSection.variants.attrColumn')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">
                {t('productSection.variants.priceColumn')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">
                {t('productSection.variants.stockColumn')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">
                {t('productSection.variants.skuColumn')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300 w-[120px]">
                {t('productSection.variants.actionsColumn')}
              </th>
            </tr>
          </thead>
          <tbody>
            {variants.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-8 text-center text-neutral-400 dark:text-neutral-500"
                >
                  {t('productSection.variants.emptyTable')}
                </td>
              </tr>
            ) : (
              variants.map((variant) => (
                <tr
                  key={variant.id}
                  className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
                >
                  <td className="px-4 py-3">
                    {variant.name ? (
                      variant.name
                    ) : variant.attributes && Object.keys(variant.attributes).length > 0 ? (
                      Object.values(variant.attributes).join(' / ')
                    ) : (
                      <span className="text-neutral-400 text-sm">&mdash;</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {!variant.attributes || Object.keys(variant.attributes).length === 0 ? (
                      <span className="text-neutral-400 dark:text-neutral-500">
                        {t('productSection.variants.noAttrValue')}
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {Object.entries(variant.attributes).map(([key, value]) => (
                          <span
                            key={key}
                            className="inline-block rounded-full bg-[var(--admin-info)]/15 text-[var(--admin-info)] px-2 py-0.5 text-xs"
                          >
                            {formatAttributeKey(key)}: {value}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {`${variant.price.toLocaleString(getLocale())}${t('common.currencySymbol')}`}
                  </td>
                  {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                  <td className="px-4 py-3">{(variant as any).stock}</td>
                  <td className="px-4 py-3">{variant.sku}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => onEditVariant(variant)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-[var(--admin-error)] hover:opacity-80 hover:bg-[var(--admin-error)]/10"
                        onClick={() => onDeleteVariant(variant.id!)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ProductVariantsSection;
