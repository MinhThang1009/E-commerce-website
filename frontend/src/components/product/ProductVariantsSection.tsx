import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Row, Col, Typography, Table, Space, Tag, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { ProductVariant } from '@/types';
import { getLocale } from '@/utils/format';

const { Title, Text } = Typography;

interface ProductVariantsSectionProps {
  variants: ProductVariant[];
  onAddVariant: () => void;
  onEditVariant: (variant: ProductVariant) => void;
  onDeleteVariant: (id: string) => void;
}

const ProductVariantsSection: React.FC<ProductVariantsSectionProps> = ({
  variants,
  onAddVariant,
  onEditVariant,
  onDeleteVariant,
}) => {
  const { t } = useTranslation();

  const variantColumns = [
    {
      title: t('productSection.variants.nameColumn'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('productSection.variants.attrColumn'),
      dataIndex: 'attributes',
      key: 'attributes',
      render: (attributes: Record<string, string>) => {
        if (!attributes || Object.keys(attributes).length === 0) {
          return <Text type="secondary">{t('productSection.variants.noAttrValue')}</Text>;
        }
        return (
          <div>
            {Object.entries(attributes).map(([key, value]) => (
              <Tag key={key} color="blue">
                {key}: {value}
              </Tag>
            ))}
          </div>
        );
      },
    },
    {
      title: t('productSection.variants.priceColumn'),
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => `${price.toLocaleString(getLocale())}${t('common.currencySymbol')}`,
    },
    {
      title: t('productSection.variants.stockColumn'),
      dataIndex: 'stock',
      key: 'stock',
    },
    {
      title: t('productSection.variants.skuColumn'),
      dataIndex: 'sku',
      key: 'sku',
    },
    {
      title: t('productSection.variants.actionsColumn'),
      key: 'actions',
      width: 120,
      render: (_: any, record: ProductVariant) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEditVariant(record)}
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDeleteVariant(record.id!)}
          />
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={24}>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <Title level={5}>
                {t('productSection.variants.sectionTitle')} <Text type="danger">*</Text>
              </Title>
              <Text type="secondary">
                {t('productSection.variants.sectionDesc')}
              </Text>
              <div style={{ marginTop: 8 }}>
                <Text type="warning">
                  <strong>{t('common.note')}:</strong> {t('productSection.variants.note')}
                </Text>
              </div>
            </div>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={onAddVariant}
            >
              {t('productSection.variants.addButton')}
            </Button>
          </div>
        </Col>
      </Row>

      {variants.length === 0 && (
        <Alert
          message={t('productSection.variants.emptyError')}
          description={t('productSection.variants.emptyErrorDesc')}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Table
        dataSource={variants}
        columns={variantColumns}
        rowKey="id"
        pagination={false}
        locale={{ emptyText: t('productSection.variants.emptyTable') }}
      />
    </div>
  );
};

export default ProductVariantsSection;
