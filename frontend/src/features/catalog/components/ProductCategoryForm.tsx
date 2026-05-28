/**
 * @file ProductCategoryForm.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Category } from '../types/category.types';

interface ProductCategoryFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  categories: Category[];
  isLoading: boolean;
}

const ProductCategoryForm: React.FC<ProductCategoryFormProps> = ({
  form,
  categories,
  isLoading,
}) => {
  const { t } = useTranslation();
  const selectedIds: string[] = form.watch('categoryIds') || [];

  const toggleCategory = (categoryId: string) => {
    const current = form.watch('categoryIds') || [];
    if (current.includes(categoryId)) {
      form.setValue(
        'categoryIds',
        current.filter((id: string) => id !== categoryId),
      );
    } else {
      form.setValue('categoryIds', [...current, categoryId]);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4">
      <div>
        <Label className="mb-1.5 block">{t('admin.products.category.label')}</Label>
        {isLoading ? (
          <div className="animate-pulse h-10 bg-neutral-200 dark:bg-neutral-700 rounded-xl" />
        ) : (
          <div className="flex flex-wrap gap-2 p-3 border border-neutral-300 dark:border-neutral-600 rounded-xl bg-white dark:bg-neutral-800 min-h-[42px]">
            {categories.map((category) => {
              const isSelected = selectedIds.includes(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className={`inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-[var(--accent)] text-white'
                      : 'bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600'
                  }`}
                >
                  {category.name}
                </button>
              );
            })}
          </div>
        )}
        {form.formState.errors.categoryIds?.message && (
          <p className="text-sm text-[var(--admin-error)] mt-1">
            {String(form.formState.errors.categoryIds.message)}
          </p>
        )}
      </div>

      <Alert variant="info">
        <Info className="size-4" />
        <AlertTitle>{t('admin.products.category.alertMessage')}</AlertTitle>
        <AlertDescription>{t('admin.products.category.alertDesc')}</AlertDescription>
      </Alert>
    </div>
  );
};

export default ProductCategoryForm;
