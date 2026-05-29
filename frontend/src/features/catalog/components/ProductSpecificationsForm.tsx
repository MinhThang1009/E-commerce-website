/**
 * @file ProductSpecificationsForm.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React, { useState, useEffect } from 'react';
import { UseFormReturn } from 'react-hook-form';
import { Plus, Trash2, Info } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';

interface Specification {
  id: string;
  name: string;
  value: string;
  valueEn?: string;
  category?: string;
}

interface ProductSpecificationsFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  initialSpecifications?: Specification[];
}

const CATEGORY_EN_TO_VI: Record<string, string> = {
  General: 'Thông số chung',
  Performance: 'Hiệu năng',
  Display: 'Màn hình',
  Design: 'Thiết kế',
  Connectivity: 'Kết nối',
  Battery: 'Pin & Nguồn',
  OS: 'Hệ điều hành',
  Security: 'Bảo mật',
  Audio: 'Âm thanh',
  Keyboard: 'Bàn phím',
  Camera: 'Camera',
  Other: 'Khác',
};

const VALID_CATEGORIES = new Set([
  'Hiệu năng',
  'Màn hình',
  'Thiết kế',
  'Kết nối',
  'Pin & Nguồn',
  'Hệ điều hành',
  'Bảo mật',
  'Âm thanh',
  'Bàn phím',
  'Camera',
  'Thông số chung',
  'Khác',
]);

const normalizeCategory = (cat?: string) =>
  cat && VALID_CATEGORIES.has(cat) ? cat : (CATEGORY_EN_TO_VI[cat || ''] ?? 'Thông số chung');

const ProductSpecificationsForm: React.FC<ProductSpecificationsFormProps> = ({
  form,
  initialSpecifications = [],
}) => {
  const { t } = useTranslation();
  const [specifications, setSpecifications] = useState<Specification[]>(initialSpecifications);

  const specificationCategories = [
    { value: 'Hiệu năng', label: t('admin.products.specs.categories.performance') },
    { value: 'Màn hình', label: t('admin.products.specs.categories.display') },
    { value: 'Thiết kế', label: t('admin.products.specs.categories.design') },
    { value: 'Kết nối', label: t('admin.products.specs.categories.connectivity') },
    { value: 'Pin & Nguồn', label: t('admin.products.specs.categories.battery') },
    { value: 'Hệ điều hành', label: t('admin.products.specs.categories.os') },
    { value: 'Bảo mật', label: t('admin.products.specs.categories.security') },
    { value: 'Âm thanh', label: t('admin.products.specs.categories.audio') },
    { value: 'Bàn phím', label: t('admin.products.specs.categories.keyboard') },
    { value: 'Camera', label: t('admin.products.specs.categories.camera') },
    { value: 'Thông số chung', label: t('admin.products.specs.categories.general') },
    { value: 'Khác', label: t('admin.products.specs.categories.other') },
  ];

  useEffect(() => {
    if (initialSpecifications && initialSpecifications.length > 0) {
      const specsWithIds = initialSpecifications.map((spec, index) => ({
        ...spec,
        id: spec.id || `spec-${Date.now()}-${index}`,
        category: normalizeCategory(spec.category),
      }));
      setSpecifications(specsWithIds);
    }
  }, [initialSpecifications]);

  useEffect(() => {
    form.setValue('specifications', specifications);
  }, [specifications, form]);

  const addSpecification = () => {
    const newSpec: Specification = {
      id: Date.now().toString(),
      name: '',
      value: '',
      valueEn: '',
      category: 'Thông số chung',
    };
    setSpecifications([...specifications, newSpec]);
  };

  const updateSpecification = (id: string, field: keyof Specification, value: string) => {
    setSpecifications((specs) =>
      specs.map((spec) => (spec.id === id ? { ...spec, [field]: value } : spec)),
    );
  };

  const removeSpecification = (id: string) => {
    setSpecifications((specs) => specs.filter((spec) => spec.id !== id));
  };

  return (
    <div className="p-6">
      <h3 className="text-lg font-semibold flex items-center gap-2 mb-1">
        <Info className="size-5" />
        {t('admin.products.specs.title')}
      </h3>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-6">
        {t('admin.products.specs.subtitle')}
      </p>

      <div className="mb-6">
        <Button type="button" size="lg" onClick={addSpecification} className="admin-btn-primary">
          <Plus className="size-4" />
          {t('admin.products.specs.addButton')}
        </Button>
      </div>

      {specifications.length > 0 && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{t('admin.products.specs.listTitle')}</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {specifications.map((spec, index) => (
              <div
                key={`${spec.id}-${index}`}
                className="rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 p-3"
              >
                <div className="grid grid-cols-[1fr_1fr_1fr_1.4fr_auto] gap-4 items-center">
                  <Input
                    placeholder={t('admin.products.specs.namePlaceholder')}
                    value={spec.name}
                    onChange={(e) => updateSpecification(spec.id, 'name', e.target.value)}
                  />
                  <textarea
                    className="flex w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 shadow-sm transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                    placeholder={t('admin.products.specs.valuePlaceholder')}
                    value={spec.value}
                    onChange={(e) => updateSpecification(spec.id, 'value', e.target.value)}
                    rows={1}
                  />
                  <textarea
                    className="flex w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 shadow-sm transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50 resize-y"
                    placeholder="Value (EN) — optional"
                    value={spec.valueEn || ''}
                    onChange={(e) =>
                      updateSpecification(spec.id, 'valueEn' as keyof Specification, e.target.value)
                    }
                    rows={1}
                  />
                  <Select
                    value={spec.category || 'Thông số chung'}
                    onValueChange={(value) => updateSpecification(spec.id, 'category', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('admin.products.specs.categoryPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      {specificationCategories.map((category) => (
                        <SelectItem key={category.value} value={category.value}>
                          {category.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={t('common.delete')}
                    className="text-[var(--color-danger)] hover:opacity-80"
                    onClick={() => removeSpecification(spec.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {specifications.length === 0 && (
        <div className="text-center py-10 px-5 border-2 border-dashed border-neutral-300 dark:border-neutral-600 rounded-lg bg-white dark:bg-neutral-800">
          <div className="text-5xl mb-4">📋</div>
          <h4 className="text-base font-semibold dark:text-neutral-400">
            {t('admin.products.specs.emptyTitle')}
          </h4>
          <p className="text-sm text-neutral-500 dark:text-neutral-400">
            {t('admin.products.specs.emptyDesc')}
          </p>
        </div>
      )}

      {specifications.length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-sm">{t('admin.products.specs.summaryTitle')}</CardTitle>
          </CardHeader>
          <CardContent>
            <span className="font-semibold">
              {t('admin.products.specs.summaryText', { count: specifications.length })}
            </span>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ProductSpecificationsForm;
