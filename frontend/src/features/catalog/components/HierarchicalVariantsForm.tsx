/**
 * @file HierarchicalVariantsForm.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Typography,
  Button,
  Table,
  Space,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Tag,
  Alert,
  Checkbox,
  Row,
  Col,
  message,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { AttributeGroup } from '../api/attributeApi';
import { getLocale } from '@/utils/format';

const { Title, Text } = Typography;
const { Option } = Select;

interface ProductVariant {
  id: string;
  name: string;
  sku: string;
  price: number;
  stock: number;
  attributeValues: Record<string, string>; // groupId -> valueId
  isDefault: boolean;
  isAvailable: boolean;
}

interface HierarchicalVariantsFormProps {
  attributeGroups: AttributeGroup[];
  variants: ProductVariant[];
  onVariantsChange: (variants: ProductVariant[]) => void;
}

const HierarchicalVariantsForm: React.FC<HierarchicalVariantsFormProps> = ({
  attributeGroups,
  variants,
  onVariantsChange,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(
    null
  );
  const [selectedAttributes, setSelectedAttributes] = useState<
    Record<string, string>
  >({});

  // Tạo tất cả tổ hợp có thể
  const generateCombinations = () => {
    const combinations: Array<Record<string, string>> = [];

    const generateRecursive = (
      groupIndex: number,
      currentCombination: Record<string, string>
    ) => {
      if (groupIndex >= attributeGroups.length) {
        combinations.push({ ...currentCombination });
        return;
      }

      const group = attributeGroups[groupIndex];
      if (!group.values || group.values.length === 0) {
        generateRecursive(groupIndex + 1, currentCombination);
        return;
      }

      group.values.forEach((value) => {
        currentCombination[group.id] = value.id;
        generateRecursive(groupIndex + 1, currentCombination);
      });
    };

    generateRecursive(0, {});
    return combinations;
  };

  const handleGenerateVariants = () => {
    if (attributeGroups.length === 0) {
      message.warning(t('variants.noAttributes'));
      return;
    }

    const combinations = generateCombinations();
    const newVariants: ProductVariant[] = combinations.map(
      (combination, index) => {
        const attributeNames: string[] = [];
        let basePrice = 0;

        Object.entries(combination).forEach(([groupId, valueId]) => {
          const group = attributeGroups.find((g) => g.id === groupId);
          const value = group?.values?.find((v) => v.id === valueId);
          if (value) {
            attributeNames.push(value.name);
            basePrice += value.priceAdjustment ?? 0;
          }
        });

        return {
          id: `variant-${Date.now()}-${index}`,
          name: attributeNames.join(' - '),
          sku: `VAR-${Date.now()}-${index}`,
          price: basePrice,
          stock: 0,
          attributeValues: combination,
          isDefault: index === 0,
          isAvailable: true,
        };
      }
    );

    onVariantsChange(newVariants);
    message.success(t('variants.generated', { count: newVariants.length }));
  };

  const handleAddVariant = () => {
    setEditingVariant(null);
    setSelectedAttributes({});
    setIsModalVisible(true);
    form.resetFields();
  };

  const handleEditVariant = (variant: ProductVariant) => {
    setEditingVariant(variant);
    setSelectedAttributes(variant.attributeValues);
    setIsModalVisible(true);
    form.setFieldsValue({
      name: variant.name,
      sku: variant.sku,
      price: variant.price,
      stock: variant.stock,
      isDefault: variant.isDefault,
      isAvailable: variant.isAvailable,
      attributeValues: variant.attributeValues,
    });
  };

  const handleDeleteVariant = (variantId: string) => {
    const newVariants = variants.filter((v) => v.id !== variantId);
    onVariantsChange(newVariants);
    message.success(t('variants.deleted'));
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // Tạo tên từ thuộc tính đã chọn
      const attributeNames: string[] = [];
      Object.entries(selectedAttributes).forEach(([groupId, valueId]) => {
        const group = attributeGroups.find((g) => g.id === groupId);
        const value = group?.values?.find((v) => v.id === valueId);
        if (value) {
          attributeNames.push(value.name);
        }
      });

      const variant: ProductVariant = {
        id: editingVariant?.id || `variant-${Date.now()}`,
        name: values.name || attributeNames.join(' - '),
        sku: values.sku || `VAR-${Date.now()}`,
        price: values.price || 0,
        stock: values.stock || 0,
        attributeValues: selectedAttributes,
        isDefault: values.isDefault || false,
        isAvailable: values.isAvailable ?? true,
      };

      if (editingVariant) {
        // Cập nhật biến thể hiện có
        const newVariants = variants.map((v) =>
          v.id === editingVariant.id ? variant : v
        );
        onVariantsChange(newVariants);
        message.success(t('variants.updated'));
      } else {
        // Thêm biến thể mới
        onVariantsChange([...variants, variant]);
        message.success(t('variants.added'));
      }

      setIsModalVisible(false);
    } catch (error) {
      console.error('Xác thực thất bại:', error);
    }
  };

  const getAttributeDisplayName = (groupId: string, valueId: string) => {
    const group = attributeGroups.find((g) => g.id === groupId);
    const value = group?.values?.find((v) => v.id === valueId);
    return value ? `${group?.name}: ${value.name}` : 'N/A';
  };

  const columns = [
    {
      title: t('variants.colName'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: ProductVariant) => (
        <div>
          <div>{name}</div>
          {record.isDefault && <Tag color="gold">{t('variants.defaultTag')}</Tag>}
          {!record.isAvailable && <Tag color="red">{t('variants.unavailableTag')}</Tag>}
        </div>
      ),
    },
    {
      title: t('variants.colAttributes'),
      dataIndex: 'attributeValues',
      key: 'attributeValues',
      render: (attributeValues: Record<string, string>) => (
        <div>
          {Object.entries(attributeValues).map(([groupId, valueId]) => (
            <Tag key={`${groupId}-${valueId}`} color="blue">
              {getAttributeDisplayName(groupId, valueId)}
            </Tag>
          ))}
        </div>
      ),
    },
    {
      title: t('variants.colSku'),
      dataIndex: 'sku',
      key: 'sku',
    },
    {
      title: t('variants.colPrice'),
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => `${price.toLocaleString(getLocale())}${t('common.currencySymbol')}`,
    },
    {
      title: t('variants.colStock'),
      dataIndex: 'stock',
      key: 'stock',
    },
    {
      title: t('variants.colActions'),
      key: 'actions',
      width: 120,
      render: (_: unknown, record: ProductVariant) => (
        <Space>
          <Button
            type="text"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEditVariant(record)}
          />
          <Button
            type="text"
            size="small"
            danger
            icon={<DeleteOutlined />}
            onClick={() => handleDeleteVariant(record.id)}
          />
        </Space>
      ),
    },
  ];

  return (
    <Card>
      <Title level={4}>{t('variants.title')}</Title>

      <Alert
        message={t('variants.info')}
        description={t('variants.infoDesc')}
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 16 }}
      />

      <Space style={{ marginBottom: 16 }}>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleGenerateVariants}
        >
          {t('variants.generateAll')}
        </Button>
        <Button icon={<PlusOutlined />} onClick={handleAddVariant}>
          {t('variants.addManual')}
        </Button>
      </Space>

      {variants.length === 0 ? (
        <Alert
          message={t('variants.emptyTitle')}
          description={t('variants.emptyDesc')}
          type="warning"
          showIcon
        />
      ) : (
        <Table
          dataSource={variants}
          columns={columns}
          rowKey="id"
          pagination={false}
          scroll={{ x: 800 }}
        />
      )}

      {/* Modal thêm/chỉnh sửa biến thể */}
      <Modal
        title={editingVariant ? t('variants.editTitle') : t('variants.addTitle')}
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={() => setIsModalVisible(false)}
        okText={editingVariant ? t('variants.updateBtn') : t('variants.addBtn')}
        cancelText={t('variants.cancelBtn')}
        width={800}
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label={t('variants.colName')}
                rules={[
                  { required: true, message: t('variants.nameRequired') },
                ]}
              >
                <Input placeholder={t('variants.namePlaceholder')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="sku"
                label={t('variants.colSku')}
                rules={[{ required: true, message: t('variants.skuRequired') }]}
              >
                <Input placeholder={t('variants.skuPlaceholder')} />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="price"
                label={t('variants.colPrice')}
                rules={[{ required: true, message: t('variants.priceRequired') }]}
              >
                <InputNumber<number>
                  style={{ width: '100%' }}
                  placeholder={t('variants.pricePlaceholder')}
                  min={0}
                  formatter={(value) =>
                    value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''
                  }
                  parser={(value) => Number(value?.replace(/\$\s?|(,*)/g, '') ?? '')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="stock"
                label={t('variants.colStock')}
                rules={[
                  {
                    required: true,
                    message: t('variants.stockRequired'),
                  },
                ]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder={t('variants.stockPlaceholder')}
                  min={0}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="isDefault" valuePropName="checked">
                <Checkbox>{t('variants.isDefault')}</Checkbox>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="isAvailable"
                valuePropName="checked"
                initialValue={true}
              >
                <Checkbox>{t('variants.isAvailable')}</Checkbox>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item label={t('variants.attributesLabel')}>
            {attributeGroups.map((group) => (
              <div key={group.id} style={{ marginBottom: 16 }}>
                <Text strong>{group.name}:</Text>
                <Select
                  style={{ width: '100%', marginTop: 8 }}
                  placeholder={t('variants.selectAttrPlaceholder', { name: group.name })}
                  value={selectedAttributes[group.id]}
                  onChange={(value) => {
                    setSelectedAttributes((prev) => ({
                      ...prev,
                      [group.id]: value,
                    }));
                  }}
                >
                  {group.values?.map((value) => (
                    <Option key={value.id} value={value.id}>
                      {value.name}
                      {(value.priceAdjustment ?? 0) !== 0 && (
                        <span
                          style={{
                            color: (value.priceAdjustment ?? 0) > 0 ? 'green' : 'red',
                          }}
                        >
                          {' '}
                          ({(value.priceAdjustment ?? 0) > 0 ? '+' : ''}
                          {(value.priceAdjustment ?? 0).toLocaleString(getLocale())}{t('common.currencySymbol')})
                        </span>
                      )}
                    </Option>
                  ))}
                </Select>
              </div>
            ))}
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default HierarchicalVariantsForm;

