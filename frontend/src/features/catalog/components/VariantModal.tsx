import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Form, Input, InputNumber, Select, Button, Space } from 'antd';
import { SaveOutlined, CloseOutlined } from '@ant-design/icons';

interface Variant {
  id?: string;
  name: string;
  price: number;
  stock?: number;
  stockQuantity?: number;
  sku?: string;
  attributes?: Record<string, string>;
  value?: string;
}

interface VariantModalProps {
  open: boolean;
  onClose: () => void;
  variant?: Variant | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Caller passes different variant types
  onSave: (variant: any) => void;
  attributes: Array<{ id?: string; name: string; value?: string; values?: string[] }>;
}

const VariantModal: React.FC<VariantModalProps> = ({
  open,
  onClose,
  variant,
  onSave,
  attributes,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  useEffect(() => {
    if (variant) {
      form.setFieldsValue({
        name: variant.name || '',
        price: variant.price || 0,
        stock: variant.stock || 0,
        sku: variant.sku || '',
        ...variant.attributes,
      });
    } else {
      form.resetFields();
    }
  }, [variant, form, open]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Antd Form destructuring cần dynamic keys
  const handleSubmit = (values: any) => {
    const { name, price, stock, sku, ...attributeValues } = values;

    const filteredAttributes: Record<string, string> = {};
    Object.keys(attributeValues).forEach((key) => {
      if (
        attributeValues[key] !== undefined &&
        attributeValues[key] !== null &&
        attributeValues[key] !== ''
      ) {
        filteredAttributes[key] = attributeValues[key];
      }
    });

    const variantData: Variant = {
      id: variant?.id,
      name: name.trim(),
      price: price || 0,
      stock: stock || 0,
      sku: sku ? sku.trim() : '',
      attributes: filteredAttributes,
    };

    onSave(variantData);
    handleClose();
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={variant ? t('variantModal.editTitle') : t('variantModal.addTitle')}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={800}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          name: '',
          price: 0,
          stock: 0,
          sku: '',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
          }}
        >
          <Form.Item
            label={t('variantModal.nameLabel')}
            name="name"
            rules={[{ required: true, message: t('variantModal.nameRequired') }]}
          >
            <Input placeholder={t('variantModal.namePlaceholder')} />
          </Form.Item>

          <Form.Item
            label={t('variantModal.skuLabel')}
            name="sku"
            tooltip={t('variantModal.skuTooltip')}
          >
            <Input placeholder={t('variantModal.skuPlaceholder')} />
          </Form.Item>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
          }}
        >
          <Form.Item
            label={t('variantModal.priceLabel')}
            required
            tooltip={t('variantModal.priceTooltip')}
          >
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item
                name="price"
                noStyle
                rules={[
                  { required: true, message: t('variantModal.priceRequired') },
                  { type: 'number', min: 0, message: t('variantModal.priceMustBePositive') },
                ]}
              >
                <InputNumber<number>
                  placeholder="1,000,000"
                  min={0}
                  step={1000}
                  style={{ width: '100%' }}
                  formatter={(value) =>
                    value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''
                  }
                  parser={(value) => Number(value?.replace(/\$\s?|(,*)/g, '') ?? '')}
                />
              </Form.Item>
              <div className="ant-input-group-addon">{t('common.currencySymbol')}</div>
            </Space.Compact>
          </Form.Item>

          <Form.Item
            label={t('variantModal.stockLabel')}
            required
          >
            <Space.Compact style={{ width: '100%' }}>
              <Form.Item
                name="stock"
                noStyle
                rules={[
                  { required: true, message: t('variantModal.stockRequired') },
                  { type: 'number', min: 0, message: t('variantModal.stockMustBeNonNeg') },
                ]}
              >
                <InputNumber<number>
                  placeholder="50"
                  min={0}
                  style={{ width: '100%' }}
                  formatter={(value) =>
                    value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''
                  }
                  parser={(value) => Number(value?.replace(/\$\s?|(,*)/g, '') ?? '')}
                />
              </Form.Item>
              <div className="ant-input-group-addon">{t('common.unitProduct')}</div>
            </Space.Compact>
          </Form.Item>
        </div>

        {/* Thuộc tính biến thể */}
        {attributes.length > 0 && (
          <div
            style={{
              borderTop: '1px solid #f0f0f0',
              paddingTop: '16px',
              marginTop: '16px',
            }}
          >
            <h3 style={{ marginBottom: '16px' }}>{t('variantModal.attrSectionTitle')}</h3>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '16px',
              }}
            >
              {attributes.map((attr) => {
                const values = attr.value
                  ? (attr.value as string)
                      .split(',')
                      .map((v: string) => v.trim())
                      .filter((v: string) => v)
                  : [];
                return (
                  <Form.Item key={attr.id} label={attr.name} name={attr.name}>
                    <Select placeholder={t('variantModal.selectAttr', { name: attr.name })} allowClear>
                      {values.map((value: string) => (
                        <Select.Option key={value} value={value}>
                          {value}
                        </Select.Option>
                      ))}
                    </Select>
                  </Form.Item>
                );
              })}
            </div>
          </div>
        )}

        {/* Nút submit */}
        <div style={{ textAlign: 'right', marginTop: '24px' }}>
          <Space>
            <Button onClick={handleClose} icon={<CloseOutlined />}>
              {t('common.cancel')}
            </Button>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
              {variant ? t('variantModal.updateBtn') : t('variantModal.addBtn')}
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
};

export default VariantModal;
