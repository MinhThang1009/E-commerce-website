import React, { useState } from 'react';
import { Modal, Input, List, Image, Button, message, Spin } from 'antd';
import { SearchOutlined } from '@ant-design/icons';
import { useGetNewsQuery } from '@/services/newsApi';
// Wait, I should use the products API
import { useGetProductsQuery } from '@/services/productApi';

const { Search } = Input;

interface ProductPickerModalProps {
  open: boolean;
  onCancel: () => void;
  onSelect: (product: any) => void;
}

const ProductPickerModal: React.FC<ProductPickerModalProps> = ({ open, onCancel, onSelect }) => {
  const [searchTerm, setSearchTerm] = useState('');
  
  const { data: productsData, isLoading } = useGetProductsQuery({
    search: searchTerm || undefined,
    limit: 10,
  });

  const products = productsData?.data?.products || [];

  const handleSearch = (value: string) => {
    setSearchTerm(value);
  };

  return (
    <Modal
      title="Chọn sản phẩm để chèn"
      open={open}
      onCancel={onCancel}
      footer={null}
      width={700}
    >
      <div className="mb-4">
        <Search
          placeholder="Tìm kiếm sản phẩm..."
          allowClear
          enterButton="Tìm kiếm"
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
                  Chọn
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
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.price)}
                    </span>
                    {item.stockQuantity > 0 ? (
                       <span className="ml-2 text-xs text-green-500">Còn hàng</span>
                    ) : (
                       <span className="ml-2 text-xs text-red-500">Hết hàng</span>
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
