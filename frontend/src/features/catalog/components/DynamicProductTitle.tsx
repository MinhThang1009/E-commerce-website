/**
 * @file DynamicProductTitle.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Typography, Space, Tag, Skeleton, Alert } from 'antd';
import { BulbOutlined, LoadingOutlined } from '@ant-design/icons';
import { useDebounce } from '@/hooks/useDebounce';
import { attributeService } from '../api/attributeApi';

const { Title } = Typography;

interface Product {
  id: string;
  name: string;
  baseName?: string;
  isVariantProduct?: boolean;
}

interface DynamicProductTitleProps {
  product: Product;
  selectedAttributes: Record<string, string>;
  showAttributeTags?: boolean;
  level?: 1 | 2 | 3 | 4 | 5;
  style?: React.CSSProperties;
}

const DynamicProductTitle: React.FC<DynamicProductTitleProps> = ({
  product,
  selectedAttributes,
  showAttributeTags = true,
  level = 1,
  style,
}) => {
  const { t } = useTranslation();
  const [dynamicName, setDynamicName] = useState<string>(product.name);
  const [loading, setLoading] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AI-generated attribute details có nhiều trường dynamic
  const [attributeDetails, setAttributeDetails] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Debounce thuộc tính đã chọn để tránh gọi API quá nhiều
  const debouncedAttributes = useDebounce(selectedAttributes, 500);

  const shouldGenerateDynamicName = React.useMemo(() => {
    return (
      product.isVariantProduct &&
      Object.values(debouncedAttributes).some((value) => value) &&
      (product.baseName || product.name)
    );
  }, [product, debouncedAttributes]);

  const generateDynamicName = async () => {
    if (!shouldGenerateDynamicName) {
      setDynamicName(product.name);
      setAttributeDetails([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const baseName = product.baseName || product.name;
      const response = await attributeService.generateNameRealTime({
        baseName,
        attributeValues: debouncedAttributes,
        productId: product.id,
      });

      if (response.status === 'success' && response.data) {
        setDynamicName(response.data.generatedName);
        setAttributeDetails(response.data.affectingAttributes || []);
      }
    } catch (err) {
      console.error('Lỗi tạo tên động:', err);
      setError(t('product.dynamicNameError'));
      setDynamicName(product.name); // Dự phòng về tên gốc
    } finally {
      setLoading(false);
    }
  };

  // Tạo tên động khi thuộc tính thay đổi
  useEffect(() => {
    generateDynamicName();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- generateDynamicName dùng shouldGenerateDynamicName và debouncedAttributes bên trong
  }, [shouldGenerateDynamicName, debouncedAttributes]);

  // Hiển thị trạng thái tải
  if (loading) {
    return (
      <div style={style}>
        <Space>
          <Skeleton.Input
            style={{ width: 400, height: level === 1 ? 32 : 24 }}
            active
          />
          <LoadingOutlined style={{ color: '#1890ff' }} />
        </Space>
      </div>
    );
  }

  // Hiển thị trạng thái lỗi
  if (error) {
    return (
      <div style={style}>
        <Title level={level} style={{ margin: 0, color: '#ff4d4f' }}>
          {product.name}
        </Title>
        <Alert
          message={error}
          type="error"
          showIcon
          style={{ marginTop: 8 }}
        />
      </div>
    );
  }

  const hasAttributeChanges = dynamicName !== product.name;

  return (
    <div style={style}>
      <Space direction="vertical" size="small" style={{ width: '100%' }}>
        {/* Main Title */}
        <div style={{ position: 'relative' }}>
          <Title
            level={level}
            style={{
              margin: 0,
              color: hasAttributeChanges ? '#1890ff' : undefined,
              transition: 'color 0.3s ease',
            }}
          >
            {dynamicName}
          </Title>

          {hasAttributeChanges && (
            <Tag
              color="blue"
              icon={<BulbOutlined />}
              style={{
                position: 'absolute',
                top: -8,
                right: -8,
                fontSize: 10,
              }}
            >
              AUTO
            </Tag>
          )}
        </div>

        {/* Attribute Tags */}
        {showAttributeTags && attributeDetails.length > 0 && (
          <Space wrap size="small">
            {attributeDetails.map((attr) => (
              <Tag
                key={attr.id}
                color="blue"
                style={{ fontSize: 11, margin: 2 }}
              >
                <Space size={4}>
                  <span>{attr.groupName}:</span>
                  <strong>{attr.nameTemplate || attr.name}</strong>
                </Space>
              </Tag>
            ))}
          </Space>
        )}

        {/* Original Name (if different) */}
        {hasAttributeChanges && (
          <Typography.Text
            type="secondary"
            style={{
              fontSize: 12,
              fontStyle: 'italic',
              display: 'block',
            }}
          >
            {t('product.originalNamePrefix', { name: product.name })}
          </Typography.Text>
        )}
      </Space>
    </div>
  );
};

export default DynamicProductTitle;
