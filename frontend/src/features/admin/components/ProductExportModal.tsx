/**
 * @file ProductExportModal.tsx
 * @layer Component
 * @feature admin
 * @description UI component cho feature admin
 */
import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/stores/ui-store';
import { exportToExcel, exportToCSV } from '@/utils/export-utils';

interface ProductExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dữ liệu sản phẩm có nhiều trường dynamic
  currentPageData: any[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  selectedRows: any[];
  filters: {
    search?: string;
    category?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onExportAll: (filters: Record<string, unknown>) => Promise<any[]>;
  isLoading: boolean;
}

const ProductExportModal: React.FC<ProductExportModalProps> = ({
  isOpen,
  onClose,
  currentPageData,
  selectedRows,
  filters,
  onExportAll,
  isLoading,
}) => {
  const { t } = useTranslation();
  const addNotification = useUiStore((s) => s.addNotification);
  const [scope, setScope] = useState<'current' | 'all' | 'selected' | 'filtered'>('current');
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleExport = async () => {
    setIsProcessing(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Dynamic product fields
      let dataToExport: any[] = [];

      if (scope === 'current') {
        dataToExport = currentPageData;
      } else if (scope === 'selected') {
        if (selectedRows.length === 0) {
          addNotification({ message: t('productExport.selectProducts'), type: 'warning' });
          setIsProcessing(false);
          return;
        }
        dataToExport = selectedRows;
      } else if (scope === 'all') {
        dataToExport = await onExportAll({});
      } else if (scope === 'filtered') {
        dataToExport = await onExportAll(filters);
      }

      if (dataToExport.length === 0) {
        addNotification({ message: t('productExport.noData'), type: 'warning' });
        setIsProcessing(false);
        return;
      }

      // Chuyển đổi dữ liệu để xuất (ánh xạ đầy đủ, sẵn sàng cho việc nhập lại)
      const transformedData = dataToExport.map((item) => ({
        ID: item.id,
        Name: item.name,
        Slug: item.slug,
        SKU: item.sku,
        Price: item.price,
        CompareAtPrice: item.compareAtPrice || item.comparePrice,
        StockQuantity: item.stockQuantity !== undefined ? item.stockQuantity : item.stock,
        InStock: item.inStock ? t('common.yes') : t('common.no'),
        Status: item.status,
        Featured: item.featured ? t('common.yes') : t('common.no'),
        Condition: item.condition || 'new',
        ShortDescription: item.shortDescription,
        Description: item.description,
        Thumbnail: item.thumbnail,
        Images: Array.isArray(item.images) ? item.images.join(', ') : item.images,
        CategoryNames: item.categories?.map((c: { name: string; id: string }) => c.name).join('|'),
        CategoryIDs: item.categories?.map((c: { name: string; id: string }) => c.id).join('|'),
        SEOTitle: item.seoTitle,
        SEODescription: item.seoDescription,
        SEOKeywords: Array.isArray(item.seoKeywords)
          ? item.seoKeywords.join(', ')
          : item.seoKeywords,
        Attributes: JSON.stringify(item.attributes || []),
        Specifications: JSON.stringify(item.productSpecifications || item.specifications || []),
        BaseName: item.baseName,
        IsVariantProduct: item.isVariantProduct ? t('common.yes') : t('common.no'),
        Variants: JSON.stringify(item.variants || []),
        CreatedAt: item.createdAt,
      }));

      const fileName = `products_export_${new Date().getTime()}`;

      if (format === 'xlsx') {
        await exportToExcel(transformedData, fileName, 'Products');
      } else {
        exportToCSV(transformedData, fileName);
      }

      addNotification({ message: t('productExport.success'), type: 'success' });
      onClose();
    } catch (error) {
      console.error('Xuất dữ liệu thất bại:', error);
      addNotification({ message: t('productExport.error'), type: 'error' });
    } finally {
      setIsProcessing(false);
    }
  };

  const scopeOptions = [
    { value: 'current' as const, label: t('productExport.currentPage') },
    { value: 'all' as const, label: t('productExport.allProducts') },
    {
      value: 'selected' as const,
      label: t('productExport.selectedProducts', { count: selectedRows.length }),
    },
    { value: 'filtered' as const, label: t('productExport.filteredProducts') },
  ];

  const formatOptions = [
    { value: 'xlsx' as const, label: t('productExport.formatExcel') },
    { value: 'csv' as const, label: t('productExport.formatCsv') },
  ];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('productExport.title')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div>
            <div className="mb-2 font-medium text-sm text-neutral-700 dark:text-neutral-300">
              {t('productExport.scopeLabel')}
            </div>
            <div className="flex flex-col gap-2">
              {scopeOptions.map((option) => (
                <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="export-scope"
                    value={option.value}
                    checked={scope === option.value}
                    onChange={() => setScope(option.value)}
                    className="accent-primary-500"
                  />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <div className="mb-2 font-medium text-sm text-neutral-700 dark:text-neutral-300">
              {t('productExport.formatLabel')}
            </div>
            <div className="flex flex-col gap-2">
              {formatOptions.map((option) => (
                <label key={option.value} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="export-format"
                    value={option.value}
                    checked={format === option.value}
                    onChange={() => setFormat(option.value)}
                    className="accent-primary-500"
                  />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                    {option.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {t('productExport.cancel')}
          </Button>
          <Button onClick={handleExport} disabled={isProcessing || isLoading}>
            {isProcessing || isLoading ? (
              <div className="flex items-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                <span>{t('productExport.confirm')}</span>
              </div>
            ) : (
              t('productExport.confirm')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ProductExportModal;
