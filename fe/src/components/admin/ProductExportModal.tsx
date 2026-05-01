import React, { useState } from 'react';
import { Modal, Radio, Space, Button, message } from 'antd';
import { exportToExcel, exportToCSV } from '@/utils/exportUtils';

interface ProductExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPageData: any[];
  selectedRows: any[];
  filters: {
    search?: string;
    category?: string;
    status?: string;
    sortBy?: string;
    sortOrder?: string;
  };
  onExportAll: (filters: any) => Promise<any[]>;
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
  const [scope, setScope] = useState<'current' | 'all' | 'selected' | 'filtered'>('current');
  const [format, setFormat] = useState<'xlsx' | 'csv'>('xlsx');
  const [isProcessing, setIsProcessing] = useState(false);

  const handleExport = async () => {
    setIsProcessing(true);
    try {
      let dataToExport: any[] = [];

      if (scope === 'current') {
        dataToExport = currentPageData;
      } else if (scope === 'selected') {
        if (selectedRows.length === 0) {
          message.warning('Vui lòng chọn sản phẩm cần xuất');
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
        message.warning('Không có dữ liệu để xuất');
        setIsProcessing(false);
        return;
      }

      // Transform data for export (comprehensive mapping for import readiness)
      const transformedData = dataToExport.map((item) => ({
        ID: item.id,
        Name: item.name,
        Slug: item.slug,
        SKU: item.sku,
        Price: item.price,
        CompareAtPrice: item.compareAtPrice || item.comparePrice,
        StockQuantity: item.stockQuantity !== undefined ? item.stockQuantity : item.stock,
        InStock: item.inStock ? 'Yes' : 'No',
        Status: item.status,
        Featured: item.featured ? 'Yes' : 'No',
        Condition: item.condition || 'new',
        ShortDescription: item.shortDescription,
        Description: item.description,
        Thumbnail: item.thumbnail,
        Images: Array.isArray(item.images) ? item.images.join(', ') : item.images,
        CategoryNames: item.categories?.map((c: any) => c.name).join('|'),
        CategoryIDs: item.categories?.map((c: any) => c.id).join('|'),
        SEOTitle: item.seoTitle,
        SEODescription: item.seoDescription,
        SEOKeywords: Array.isArray(item.seoKeywords) ? item.seoKeywords.join(', ') : item.seoKeywords,
        Attributes: JSON.stringify(item.attributes || []),
        Specifications: JSON.stringify(item.productSpecifications || item.specifications || []),
        BaseName: item.baseName,
        IsVariantProduct: item.isVariantProduct ? 'Yes' : 'No',
        Variants: JSON.stringify(item.variants || []),
        WarrantyPackages: item.warrantyPackages?.map((w: any) => w.name).join(', '),
        CreatedAt: item.createdAt,
      }));

      const fileName = `products_export_${new Date().getTime()}`;

      if (format === 'xlsx') {
        exportToExcel(transformedData, fileName, 'Products');
      } else {
        exportToCSV(transformedData, fileName);
      }

      message.success('Xuất dữ liệu thành công');
      onClose();
    } catch (error) {
      console.error('Export failed:', error);
      message.error('Có lỗi xảy ra khi xuất dữ liệu');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Modal
      title="Xuất sản phẩm"
      open={isOpen}
      onCancel={onClose}
      footer={[
        <Button key="cancel" onClick={onClose}>
          Hủy
        </Button>,
        <Button
          key="submit"
          type="primary"
          onClick={handleExport}
          loading={isProcessing || isLoading}
        >
          Đồng ý
        </Button>,
      ]}
    >
      <div style={{ marginBottom: 24 }}>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>Dữ liệu xuất</div>
        <Radio.Group onChange={(e) => setScope(e.target.value)} value={scope}>
          <Space direction="vertical">
            <Radio value="current">Trang hiện tại</Radio>
            <Radio value="all">Tất cả sản phẩm</Radio>
            <Radio value="selected">Sản phẩm được chọn ({selectedRows.length})</Radio>
            <Radio value="filtered">Theo bộ lọc hiện tại</Radio>
          </Space>
        </Radio.Group>
      </div>

      <div>
        <div style={{ marginBottom: 8, fontWeight: 500 }}>Dạng file sẽ xuất</div>
        <Radio.Group onChange={(e) => setFormat(e.target.value)} value={format}>
          <Space direction="vertical">
            <Radio value="xlsx">File Excel (.xlsx)</Radio>
            <Radio value="csv">File CSV (.csv)</Radio>
          </Space>
        </Radio.Group>
      </div>
    </Modal>
  );
};

export default ProductExportModal;
