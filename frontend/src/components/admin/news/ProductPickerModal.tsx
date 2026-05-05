import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Input, List, Image, Button, Spin } from 'antd';
import { useGetProductsQuery } from '@/features/catalog';
import { getLocale } from '@/utils/format';

const { Search } = Input;

interface ProductPickerModalProps {
  open: boolean;
  onCancel: () => void;
  onSelect: (product: any) => void;
}

const ProductPickerModal: React.FC<ProductPickerModalProps> = ({ open, onCancel, onSelect }) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: productsData, isLoading } = useGetProductsQuery({
    search: searchTerm || undefined,
    limit: 10,
  });

  const products = productsData?.data || [];

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  return (
    <Modal
      title={t('productPicker.title')}
      open={open}
      onCancel={onCancel}
      footer={null}
      width={700}
    >
      <div className="mb-4">
        <Search
          placeholder={t('productPicker.searchPlaceholder')}
          allowClear
          enterButton={t('productPicker.searchButton')}
          size="large"
          onSearch={handleSearch}
        />
      </div>

      <Spin spinning={isLoading}>
        <List
          itemLayout="horizontal"
          dataSource={products}
          renderItem={(item: any) => (
            <List.Item
              actions={[
                <Button type="primary" onClick={() => onSelect(item)}>
                  {t('productPicker.selectButton')}
                </Button>
              ]}
            >
              <List.Item.Meta
                avatar={
                  <Image
                    width={60}
                    height={60}
                    src={item.images?.[0] || '/placeholder-image.jpg'}
                    style={{ objectFit: 'cover', borderRadius: 4 }}
                  />
                }
                title={item.name}
                description={
                  <div>
                    <span className="text-primary-600 font-bold">
                      {new Intl.NumberFormat(getLocale(), { style: 'currency', currency: 'VND' }).format(item.price)}
                    </span>
                    {item.stockQuantity > 0 ? (
                       <span className="ml-2 text-xs text-green-500">{t('product.inStock')}</span>
                    ) : (
                       <span className="ml-2 text-xs text-red-500">{t('product.outOfStock')}</span>
                    )}
                  </div>
                }
              />
            </List.Item>
          )}
        />
      </Spin>
    </Modal>
  );
};

export default ProductPickerModal;

