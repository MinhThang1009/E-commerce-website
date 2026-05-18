/**
 * @file ProductExportModal.tsx
 * @layer Component
 * @feature admin
 * @description UI component cho feature admin
 */
import React, { useState } from 'react';
import { Modal, Radio, Space, Button, App } from 'antd';
import { useTranslation } from 'react-i18next';
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
  const { message } = App.useApp();
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
          message.warning(t('productExport.selectProducts'));
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
        message.warning(t('productExport.noData'));
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
        WarrantyPackages: (item.warrantyPackages as Array<{ name: string }> | undefined)
          ?.map((w) => w.name)
          .join(', '),
        CreatedAt: item.createdAt,
      }));

      const fileName = `products_export_${new Date().getTime()}`;

      if (format === 'xlsx') {
        await exportToExcel(transformedData, fileName, 'Products');
      } else {
        exportToCSV(transformedData, fileName);
      }

      message.success(t('productExport.success'));
      onClose();
    } catch (error) {
      console.error('Xuất dữ liệu thất bại:', error);
      message.error(t('productExport.error'));
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      title={t('productExport.title')}
      open={isOpen}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          {t('productExport.cancel')}
        </Button>,
        <Button
          key="submit"
          type="primary"
          onClick={handleExport}
          loading={isProcessing || isLoading}
        >
          {t('productExport.confirm')}
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('productExport.scopeLabel')}</div>
        <Radio.Group onChange={(e) => setScope(e.target.value)} value={scope}>
          <Space direction="vertical">
            <Radio value="current">{t('productExport.currentPage')}</Radio>
            <Radio value="all">{t('productExport.allProducts')}</Radio>
            <Radio value="selected">
              {t('productExport.selectedProducts', { count: selectedRows.length })}
            </Radio>
            <Radio value="filtered">{t('productExport.filteredProducts')}</Radio>
          </Space>
        </Radio.Group>
      </div>

      <div>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>{t('productExport.formatLabel')}</div>
        <Radio.Group onChange={(e) => setFormat(e.target.value)} value={format}>
          <Space direction="vertical">
            <Radio value="xlsx">{t('productExport.formatExcel')}</Radio>
            <Radio value="csv">{t('productExport.formatCsv')}</Radio>
          </Space>
        </Radio.Group>
      </div>
    </Modal>
  );
};

export default ProductExportModal;
