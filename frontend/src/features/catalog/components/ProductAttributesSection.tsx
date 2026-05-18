/**
 * @file ProductAttributesSection.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Row, Col, Typography, Table, Space, Alert } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { ProductAttribute } from '@/types';

const { Title, Text } = Typography;

interface ProductAttributesSectionProps {
  attributes: ProductAttribute[];
  onAddAttribute: () => void;
  onEditAttribute: (attribute: ProductAttribute) => void;
  onDeleteAttribute: (id: string) => void;
}

const ProductAttributesSection: React.FC<ProductAttributesSectionProps> = ({
  attributes,
  onAddAttribute,
  onEditAttribute,
  onDeleteAttribute,
}) => {
  const { t } = useTranslation();

  const attributeColumns = [
    {
      title: t('productSection.attr.nameColumn'),
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: t('productSection.attr.valueColumn'),
      dataIndex: 'value',
      key: 'value',
    },
    {
      title: t('productSection.attr.actionsColumn'),
      key: 'actions',
      width: 120,
      render: (_: unknown, record: ProductAttribute) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => onEditAttribute(record)}
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => onDeleteAttribute(record.id!)}
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
                {t('productSection.attr.sectionTitle')} <Text type="danger">*</Text>
              </Title>
              <Text type="secondary">{t('productSection.attr.sectionDesc')}</Text>
              <div style={{ marginTop: 8 }}>
                <Text type="warning">
                  <strong>{t('common.note')}:</strong> {t('productSection.attr.note')}
                </Text>
              </div>
            </div>
            <Button type="primary" icon={<PlusOutlined />} onClick={onAddAttribute}>
              {t('productSection.attr.addButton')}
            </Button>
          </div>
        </Col>
      </Row>

      {attributes.length === 0 && (
        <Alert
          message={t('productSection.attr.emptyError')}
          description={t('productSection.attr.emptyErrorDesc')}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Table
        dataSource={attributes}
        columns={attributeColumns}
        rowKey="id"
        pagination={false}
        locale={{ emptyText: t('productSection.attr.emptyTable') }}
      />
    </div>
  );
};

export default ProductAttributesSection;
