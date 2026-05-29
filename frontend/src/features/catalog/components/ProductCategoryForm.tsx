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
          <div className="shimmer h-10 rounded-xl" />
        ) : (
          <div className="flex flex-wrap gap-2 p-3 border border-[var(--border-default)] rounded-xl bg-[var(--bg-base)] min-h-[42px]">
            {categories.map((category) => {
              const isSelected = selectedIds.includes(category.id);
              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => toggleCategory(category.id)}
                  className={`inline-flex items-center rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                    isSelected
                      ? 'bg-[var(--accent)]/12 border-[var(--accent)]/30 text-[var(--accent)]'
                      : 'bg-transparent border-[var(--border-default)] text-[var(--text-secondary)] hover:bg-white/5'
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
