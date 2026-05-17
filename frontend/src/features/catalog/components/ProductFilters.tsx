/**
 * @file ProductFilters.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { getLocale } from '@/utils/format';
import { useCatalogStore } from '@/stores/catalogStore';
import { Category } from '../api/categoryApi';
import Button from '@/components/common/Button';

interface ProductFiltersProps {
  categories: Category[];
  attributes?: Record<string, string[]>;
  isMobile?: boolean;
  onClose?: () => void;
}

const ProductFilters: React.FC<ProductFiltersProps> = ({
  categories,
  attributes = {},
  isMobile = false,
  onClose,
}) => {
  const { t } = useTranslation();
  const filters = useCatalogStore((s) => s.filters);
  const storePriceRange = useCatalogStore((s) => s.setPriceRange);
  const storeSetCategories = useCatalogStore((s) => s.setCategories);
  const storeSetAttributes = useCatalogStore((s) => s.setAttributes);
  const storeClearFilters = useCatalogStore((s) => s.clearFilters);

  const [priceRange, setPriceRangeLocal] = useState<[number, number]>(
    filters.priceRange
  );
  const [selectedCategories, setSelectedCategoriesLocal] = useState<string[]>(
    filters.categories
  );
  const [selectedAttributes, setSelectedAttributesLocal] = useState<
    Record<string, string[]>
  >(filters.attributes);

  const handlePriceChange = (index: 0 | 1, value: number) => {
    const newRange = [...priceRange] as [number, number];
    newRange[index] = value;
    setPriceRangeLocal(newRange);
  };

  const handleCategoryChange = (categoryId: string, checked: boolean) => {
    if (checked) {
      setSelectedCategoriesLocal([...selectedCategories, categoryId]);
    } else {
      setSelectedCategoriesLocal(
        selectedCategories.filter((id) => id !== categoryId)
      );
    }
  };

  const handleAttributeChange = (name: string, value: string, checked: boolean) => {
    const currentValues = selectedAttributes[name] || [];
    if (checked) {
      setSelectedAttributesLocal({ ...selectedAttributes, [name]: [...currentValues, value] });
    } else {
      setSelectedAttributesLocal({ ...selectedAttributes, [name]: currentValues.filter((v) => v !== value) });
    }
  };

  const applyFilters = () => {
    storePriceRange(priceRange);
    storeSetCategories(selectedCategories);
    storeSetAttributes(selectedAttributes);
    if (isMobile && onClose) onClose();
  };

  const resetFilters = () => {
    setPriceRangeLocal([0, 10000000]);
    setSelectedCategoriesLocal([]);
    setSelectedAttributesLocal({});
    storeClearFilters();
    if (isMobile && onClose) onClose();
  };

  // Luôn VND — locale động theo ngôn ngữ UI
  const formatPrice = (price: number) => {
    return new Intl.NumberFormat(getLocale(), {
      style: 'currency',
      currency: 'VND',
      maximumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className={`${isMobile ? 'p-4' : ''}`}>
      <div className="space-y-6">
        <div>
          <h3 className="text-lg font-medium mb-3">{t('filters.price')}</h3>
          <div className="space-y-4">
            <div className="flex justify-between text-sm">
              <span>{formatPrice(priceRange[0])}</span>
              <span>{formatPrice(priceRange[1])}</span>
            </div>
            <div className="flex items-center space-x-4">
              <input
                type="range"
                min="0"
                max="10000000"
                step="100000"
                value={priceRange[0]}
                onChange={(e) => handlePriceChange(0, Number(e.target.value))}
                className="w-full"
              />
              <input
                type="range"
                min="0"
                max="10000000"
                step="100000"
                value={priceRange[1]}
                onChange={(e) => handlePriceChange(1, Number(e.target.value))}
                className="w-full"
              />
            </div>
          </div>
        </div>

        <div>
          <h3 className="text-lg font-medium mb-3">{t('filters.categories')}</h3>
          <div className="space-y-2">
            {categories.map((category) => (
              <div key={category.id} className="flex items-center">
                <input
                  type="checkbox"
                  id={`category-${category.id}`}
                  checked={selectedCategories.includes(category.id)}
                  onChange={(e) => handleCategoryChange(category.id, e.target.checked)}
                  className="mr-2"
                />
                <label htmlFor={`category-${category.id}`} className="text-sm">
                  {category.name} ({category.productCount})
                </label>
              </div>
            ))}
          </div>
        </div>

        {Object.entries(attributes).map(([name, values]) => (
          <div key={name}>
            <h3 className="text-lg font-medium mb-3">{name}</h3>
            <div className="space-y-2">
              {values.map((value) => (
                <div key={`${name}-${value}`} className="flex items-center">
                  <input
                    type="checkbox"
                    id={`attr-${name}-${value}`}
                    checked={(selectedAttributes[name] || []).includes(value)}
                    onChange={(e) => handleAttributeChange(name, value, e.target.checked)}
                    className="mr-2"
                  />
                  <label htmlFor={`attr-${name}-${value}`} className="text-sm">
                    {value}
                  </label>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="flex flex-col space-y-2">
          <Button variant="primary" fullWidth onClick={applyFilters}>
            {t('filters.apply')}
          </Button>
          <Button variant="outline" fullWidth onClick={resetFilters}>
            {t('filters.reset')}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ProductFilters;
