import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { getLocale } from '@/utils/format';
import { Space, Tag, Button, Typography, Alert, Skeleton, Tooltip } from 'antd';
import {
  BulbOutlined,
  InfoCircleOutlined,
  CheckOutlined,
} from '@ant-design/icons';
import { attributeService } from '@/services/attributeApi';

const { Text } = Typography;

interface AttributeValue {
  value: string;
  stock: number;
  available: boolean;
  priceAdjustment?: number;
  isAffectingName?: boolean;
  nameTemplate?: string;
}

interface Attribute {
  id: string;
  name: string;
  values: AttributeValue[];
}

interface Product {
  id: string;
  name: string;
  baseName?: string;
  attributes: Attribute[];
  isVariantProduct?: boolean;
}

interface EnhancedVariantSelectorProps {
  product: Product;
  selectedAttributes: Record<string, string>;
  onAttributeChange: (attributeName: string, value: string | undefined) => void;
  onNameUpdate?: (newName: string, details: any) => void;
  disabled?: boolean;
}

const EnhancedVariantSelector: React.FC<EnhancedVariantSelectorProps> = ({
  product,
  selectedAttributes,
  onAttributeChange,
  onNameUpdate,
  disabled = false,
}) => {
  const { t } = useTranslation();
  const [nameAffectingAttributes, setNameAffectingAttributes] = useState<
    Set<string>
  >(new Set());
  const [loadingNameAttributes, setLoadingNameAttributes] = useState(false);
  const [previewName, setPreviewName] = useState<string>('');
  const [nameDetails, setNameDetails] = useState<any>(null);

  // Tải thuộc tính ảnh hưởng tên khi mount
  useEffect(() => {
    loadNameAffectingAttributes();
  }, []);

  // Tạo tên xem trước khi thuộc tính thay đổi
  useEffect(() => {
    if (Object.values(selectedAttributes).some((v) => v)) {
      generatePreviewName();
    } else {
      setPreviewName('');
      setNameDetails(null);
    }
  }, [selectedAttributes]);

  const loadNameAffectingAttributes = async () => {
    setLoadingNameAttributes(true);
    try {
      const response = await attributeService.getNameAffectingAttributes(
        product.id
      );
      if (response.success) {
        // Xây dựng tập hợp tên thuộc tính ảnh hưởng đến tên
        const affecting = new Set<string>();
        response.data.forEach((attr) => {
          if (attr.attributeGroup) {
            affecting.add(attr.attributeGroup.name);
          }
        });
        setNameAffectingAttributes(affecting);
      }
    } catch (error) {
      console.error('Lỗi tải thuộc tính ảnh hưởng tên:', error);
    } finally {
      setLoadingNameAttributes(false);
    }
  };

  const generatePreviewName = async () => {
    if (!product.isVariantProduct) return;

    try {
      const baseName = product.baseName || product.name;
      const response = await attributeService.generateNameRealTime({
        baseName,
        attributeValues: selectedAttributes,
        productId: product.id,
      });

      if (response.success && response.data) {
        setPreviewName(response.data.generatedName);
        setNameDetails(response.data);

        // Thông báo cho component cha
        if (onNameUpdate) {
          onNameUpdate(response.data.generatedName, response.data);
        }
      }
    } catch (error) {
      console.error('Lỗi tạo tên xem trước:', error);
    }
  };

  const handleAttributeSelect = useCallback(
    (attributeName: string, value: string) => {
      // Nếu cùng giá trị được chọn, bỏ chọn
      if (selectedAttributes[attributeName] === value) {
        onAttributeChange(attributeName, undefined);
      } else {
        onAttributeChange(attributeName, value);
      }
    },
    [selectedAttributes, onAttributeChange]
  );

  const getAttributeValueWithStock = (attribute: Attribute) => {
    return attribute.values.map((val) => ({
      ...val,
      isAffectingName: nameAffectingAttributes.has(attribute.name),
    }));
  };

  if (loadingNameAttributes) {
    return <Skeleton active paragraph={{ rows: 3 }} />;
  }

  return (
    <div className="space-y-6">
      {/* Name Preview Alert */}
      {previewName && previewName !== product.name && (
        <Alert
          message={t('product.nameUpdated')}
          description={
            <Space direction="vertical" size="small">
              <Text strong style={{ color: '#1890ff' }}>
                {previewName}
              </Text>
              {nameDetails?.affectingAttributes && (
                <Space wrap size="small">
                  {nameDetails.affectingAttributes.map((attr: any) => (
                    <Tag key={attr.id} color="blue">
                      {attr.groupName}: {attr.nameTemplate}
                    </Tag>
                  ))}
                </Space>
              )}
            </Space>
          }
          type="info"
          icon={<BulbOutlined />}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      {/* Attribute Selection */}
      <div className="space-y-4">
        {product.attributes.map((attribute) => {
          const attributeValuesWithStock =
            getAttributeValueWithStock(attribute);
          const isNameAffecting = nameAffectingAttributes.has(attribute.name);

          return (
            <div key={attribute.id}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-2">
                  <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {attribute.name}
                  </h3>

                  {isNameAffecting && (
                    <Tooltip title={t('product.affectsNameAttr')}>
                      <Tag color="blue" icon={<BulbOutlined />}>
                        {t('product.dynamicName')}
                      </Tag>
                    </Tooltip>
                  )}
                </div>

                {selectedAttributes[attribute.name] && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {t('product.clickToDeselect')}
                  </Text>
                )}
              </div>

              <div className="flex flex-wrap gap-2">
                {attributeValuesWithStock.map(
                  ({
                    value,
                    stock,
                    available,
                    priceAdjustment,
                    isAffectingName,
                  }) => {
                    const isSelected =
                      selectedAttributes[attribute.name] === value;
                    const isPriceAdjusted =
                      priceAdjustment && priceAdjustment !== 0;

                    return (
                      <Button
                        key={value}
                        size="small"
                        disabled={!available || disabled}
                        type={isSelected ? 'primary' : 'default'}
                        onClick={() =>
                          handleAttributeSelect(attribute.name, value)
                        }
                        style={{
                          position: 'relative',
                          borderColor: isSelected
                            ? '#1890ff'
                            : isAffectingName
                              ? '#52c41a'
                              : undefined,
                          borderWidth: isAffectingName ? 2 : 1,
                        }}
                        icon={isSelected ? <CheckOutlined /> : undefined}
                      >
                        <Space size="small">
                          <span>{value}</span>

                          {isPriceAdjusted && (
                            <Text
                              type={priceAdjustment! > 0 ? 'danger' : 'success'}
                              style={{ fontSize: 10 }}
                            >
                              {priceAdjustment! > 0 ? '+' : ''}
                              {priceAdjustment!.toLocaleString(getLocale())}{t('common.currencySymbol')}
                            </Text>
                          )}

                          {!available && (
                            <Text type="secondary" style={{ fontSize: 10 }}>
                              ({t('product.outOfStock')})
                            </Text>
                          )}
                        </Space>

                        {isAffectingName && !isSelected && (
                          <div
                            style={{
                              position: 'absolute',
                              top: -8,
                              right: -8,
                              width: 12,
                              height: 12,
                              backgroundColor: '#52c41a',
                              borderRadius: '50%',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <BulbOutlined
                              style={{ fontSize: 8, color: 'white' }}
                            />
                          </div>
                        )}
                      </Button>
                    );
                  }
                )}
              </div>

              {/* Thông tin tồn kho */}
              <div className="mt-2">
                {selectedAttributes[attribute.name] && (
                  <Text type="secondary" style={{ fontSize: 11 }}>
                    {t('product.selectedLabel')}{' '}
                    <Text strong>{selectedAttributes[attribute.name]}</Text>
                    {(() => {
                      const selectedVal = attributeValuesWithStock.find(
                        (v) => v.value === selectedAttributes[attribute.name]
                      );
                      return selectedVal
                        ? ` • ${t('product.stockAvailable', { count: selectedVal.stock })}`
                        : '';
                    })()}
                  </Text>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Tóm tắt */}
      {Object.keys(selectedAttributes).length > 0 && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <Text strong style={{ fontSize: 12 }}>
            {t('product.selectedConfig')}
          </Text>
          <div className="mt-2 flex flex-wrap gap-1">
            {Object.entries(selectedAttributes).map(([attrName, value]) => {
              const isNameAffecting = nameAffectingAttributes.has(attrName);
              return (
                <Tag
                  key={`${attrName}-${value}`}
                  color={isNameAffecting ? 'blue' : 'default'}
                  closable
                  onClose={() => onAttributeChange(attrName, undefined)}
                >
                  <Space size={2}>
                    <span>{attrName}:</span>
                    <strong>{value}</strong>
                    {isNameAffecting && (
                      <BulbOutlined style={{ fontSize: 10 }} />
                    )}
                  </Space>
                </Tag>
              );
            })}
          </div>
        </div>
      )}

      {/* Văn bản trợ giúp */}
      {nameAffectingAttributes.size > 0 && (
        <Alert
          message={
            <Space>
              <InfoCircleOutlined />
              <Text style={{ fontSize: 12 }}>
                {t('product.productNameAffected')}
              </Text>
            </Space>
          }
          type="info"
          showIcon={false}
          banner
          style={{ fontSize: 11 }}
        />
      )}
    </div>
  );
};

export default EnhancedVariantSelector;
