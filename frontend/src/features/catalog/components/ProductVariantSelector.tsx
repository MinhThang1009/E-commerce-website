import React from 'react';
import { useTranslation } from 'react-i18next';
import { Card, Button, Space, Typography, Tag, Divider } from 'antd';
import { CheckOutlined } from '@ant-design/icons';
import { ProductWithVariants } from '../types/product.types';
import { getLocale } from '@/utils/format';

const { Text } = Typography;

interface ProductVariantSelectorProps {
  product: ProductWithVariants;
  selectedVariantId?: string;
  onVariantChange: (variantId: string) => void;
  className?: string;
}

const ProductVariantSelector: React.FC<ProductVariantSelectorProps> = ({
  product,
  selectedVariantId,
  onVariantChange,
  className,
}) => {
  const { t } = useTranslation();

  if (
    !product.isVariantProduct ||
    !product.availableVariants ||
    product.availableVariants.length <= 1
  ) {
    return null;
  }

  const formatPrice = (price: number) => {
    // Luôn dùng VND — dùng locale động để format dấu phân tách (vi: dấu chấm, en: dấu phẩy)
    return `${price.toLocaleString(getLocale())}${t('common.currencySymbol')}`;
  };

  const currentVariant = product.currentVariant;
  const availableVariants = product.availableVariants;

  return (
    <Card
      className={className}
      title={
        <Space>
          <span>🔧</span>
          <span>{t('product.chooseVersion')}</span>
        </Space>
      }
      size="small"
    >
      <Space direction="vertical" style={{ width: '100%' }} size="middle">
        {currentVariant && (
          <div
            style={{
              padding: '12px',
              backgroundColor: '#f0f9ff',
              borderRadius: '8px',
              border: '1px solid #0ea5e9',
            }}
          >
            <Space direction="vertical" size="small">
              <Text strong style={{ color: '#0ea5e9' }}>
                <CheckOutlined style={{ marginRight: 4 }} />
                {t('product.selectedVariant', { name: currentVariant.name })}
              </Text>
              <Space>
                <Text strong style={{ fontSize: '16px', color: '#dc2626' }}>
                  {formatPrice(currentVariant.price)}
                </Text>
                {currentVariant.compareAtPrice &&
                  currentVariant.compareAtPrice > currentVariant.price && (
                    <Text delete style={{ color: '#6b7280' }}>
                      {formatPrice(currentVariant.compareAtPrice)}
                    </Text>
                  )}
              </Space>
              <Text type="secondary" style={{ fontSize: '12px' }}>
                {t('product.skuAndStock', {
                  sku: currentVariant.sku,
                  stock: currentVariant.stockQuantity,
                })}
              </Text>
            </Space>
          </div>
        )}

        <Divider style={{ margin: '8px 0' }} />

        <div>
          <Text strong style={{ marginBottom: 8, display: 'block' }}>
            {t('product.availableVersions')}
          </Text>
          <Space direction="vertical" style={{ width: '100%' }} size="small">
            {availableVariants.map((variant) => {
              const isSelected =
                selectedVariantId === variant.id ||
                (!selectedVariantId && variant.isDefault);
              const isOutOfStock = variant.stockQuantity <= 0;

              return (
                <Button
                  key={variant.id}
                  onClick={() => onVariantChange(variant.id)}
                  disabled={isOutOfStock}
                  style={{
                    width: '100%',
                    height: 'auto',
                    padding: '12px 16px',
                    textAlign: 'left',
                    border: isSelected
                      ? '2px solid #0ea5e9'
                      : '1px solid #d1d5db',
                    backgroundColor: isSelected ? '#f0f9ff' : 'white',
                    opacity: isOutOfStock ? 0.5 : 1,
                  }}
                >
                  <div style={{ width: '100%' }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        marginBottom: 4,
                      }}
                    >
                      <Text
                        strong
                        style={{
                          color: isSelected ? '#0ea5e9' : '#374151',
                          fontSize: '14px',
                        }}
                      >
                        {isSelected && (
                          <CheckOutlined style={{ marginRight: 4 }} />
                        )}
                        {variant.name}
                      </Text>
                      <Space>
                        {variant.isDefault && (
                          <Tag color="blue">{t('product.defaultVariant')}</Tag>
                        )}
                        {isOutOfStock && (
                          <Tag color="red">{t('product.outOfStock')}</Tag>
                        )}
                      </Space>
                    </div>

                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <Space>
                        <Text
                          strong
                          style={{ color: '#dc2626', fontSize: '14px' }}
                        >
                          {formatPrice(variant.price)}
                        </Text>
                        {variant.compareAtPrice &&
                          variant.compareAtPrice > variant.price && (
                            <Text
                              delete
                              style={{ color: '#6b7280', fontSize: '12px' }}
                            >
                              {formatPrice(variant.compareAtPrice)}
                            </Text>
                          )}
                      </Space>
                      <Text type="secondary" style={{ fontSize: '12px' }}>
                        {t('product.remainingStock', {
                          count: variant.stockQuantity,
                        })}
                      </Text>
                    </div>
                  </div>
                </Button>
              );
            })}
          </Space>
        </div>

        {availableVariants.length > 1 && (
          <>
            <Divider style={{ margin: '8px 0' }} />
            <div style={{ fontSize: '12px', color: '#6b7280' }}>
              <Text type="secondary">
                {t('product.priceRange', {
                  min: formatPrice(Math.min(...availableVariants.map((v) => v.price))),
                  max: formatPrice(Math.max(...availableVariants.map((v) => v.price))),
                })}
              </Text>
            </div>
          </>
        )}
      </Space>
    </Card>
  );
};

export default ProductVariantSelector;
