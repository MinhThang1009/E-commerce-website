/**
 * @file ProductAttributesSection.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { ProductAttribute } from '@/types';
import { formatAttributeKey } from '../utils/product-naming';

interface ProductAttributesSectionProps {
  attributes: ProductAttribute[];
  onAddAttribute: () => void;
  onEditAttribute: (attribute: ProductAttribute) => void;
  onDeleteAttribute: (id: string) => void;
}

const ProductAttributesSection: React.FC<ProductAttributesSectionProps> = ({
  attributes,
  onAddAttribute,
  onEditAttribute,
  onDeleteAttribute,
}) => {
  const { t } = useTranslation();

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div>
          <h5 className="text-base font-semibold">
            {t('productSection.attr.sectionTitle')} <span className="text-red-500">*</span>
          </h5>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('productSection.attr.sectionDesc')}
          </p>
          <p className="text-sm text-amber-600 dark:text-amber-400 mt-2">
            <strong>{t('common.note')}:</strong> {t('productSection.attr.note')}
          </p>
        </div>
        <Button onClick={onAddAttribute}>
          <Plus className="size-4" />
          {t('productSection.attr.addButton')}
        </Button>
      </div>

      {attributes.length === 0 && (
        <Alert variant="info" className="mb-4">
          <AlertTitle>{t('productSection.attr.emptyInfo')}</AlertTitle>
          <AlertDescription>{t('productSection.attr.emptyInfoDesc')}</AlertDescription>
        </Alert>
      )}

      <div className="w-full overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">
                {t('productSection.attr.nameColumn')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300">
                {t('productSection.attr.valueColumn')}
              </th>
              <th className="px-4 py-3 text-left font-medium text-neutral-600 dark:text-neutral-300 w-[120px]">
                {t('productSection.attr.actionsColumn')}
              </th>
            </tr>
          </thead>
          <tbody>
            {attributes.length === 0 ? (
              <tr>
                <td
                  colSpan={3}
                  className="px-4 py-8 text-center text-neutral-400 dark:text-neutral-500"
                >
                  {t('productSection.attr.emptyTable')}
                </td>
              </tr>
            ) : (
              attributes.map((attr) => (
                <tr
                  key={attr.id}
                  className="border-b border-neutral-100 dark:border-neutral-800 last:border-b-0 hover:bg-neutral-50 dark:hover:bg-neutral-800/30"
                >
                  <td className="px-4 py-3">{formatAttributeKey(attr.name)}</td>
                  <td className="px-4 py-3">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    {Array.isArray((attr as any).values) && (attr as any).values.length > 0
                      ? // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (attr as any).values.join(', ')
                      : // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        (attr as any).value || ''}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        onClick={() => onEditAttribute(attr)}
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                        onClick={() => onDeleteAttribute(attr.id!)}
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

export default ProductAttributesSection;
