/**
 * @file AttributeModal.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Modal, Form, Input, Button, Space, Alert, Divider } from 'antd';
import { SaveOutlined, CloseOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { formatAttributeKey } from '../utils/product-naming';

const { TextArea } = Input;

interface Attribute {
  id?: string;
  name: string;
  value?: string;
  values?: string[];
}

interface AttributeModalProps {
  open: boolean;
  onClose: () => void;
  attribute?: Attribute | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Caller passes different attribute types
  onSave: (attribute: any) => void;
}

const AttributeModal: React.FC<AttributeModalProps> = ({ open, onClose, attribute, onSave }) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();

  useEffect(() => {
    if (attribute) {
      form.setFieldsValue({
        name: formatAttributeKey(attribute.name || ''),
        value: Array.isArray(attribute.values)
          ? attribute.values.join(', ')
          : attribute.value || '',
      });
    } else {
      form.resetFields();
    }
  }, [attribute, form, open]);

  const handleSubmit = (values: { name: string; value: string }) => {
    const attributeData: Attribute = {
      id: attribute?.id,
      name: values.name.trim(),
      value: values.value.trim(),
    };

    const savedAttributes = JSON.parse(localStorage.getItem('debug_attributes') || '[]');
    savedAttributes.push(attributeData);
    localStorage.setItem('debug_attributes', JSON.stringify(savedAttributes));

    onSave(attributeData);
    handleClose();
  };

  const handleClose = () => {
    form.resetFields();
    onClose();
  };

  return (
    <Modal
      title={attribute ? t('attrModal.editTitle') : t('attrModal.addTitle')}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={700}
      destroyOnHidden
    >
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          name: '',
          value: '',
        }}
      >
        <Form.Item
          label={t('attrModal.nameLabel')}
          name="name"
          rules={[{ required: true, message: t('attrModal.nameRequired') }]}
          tooltip={t('attrModal.nameTooltip')}
        >
          <Input placeholder={t('attrModal.namePlaceholder')} />
        </Form.Item>

        <Form.Item
          label={t('attrModal.valueLabel')}
          name="value"
          rules={[{ required: true, message: t('attrModal.valueRequired') }]}
          tooltip={t('attrModal.valueTooltip')}
        >
          <TextArea rows={3} placeholder={t('attrModal.valuePlaceholder')} />
        </Form.Item>

        <Divider />

        {/* Hướng dẫn */}
        <Alert
          message={t('attrModal.tipTitle')}
          description={
            <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
              <li>
                <strong>{t('attrModal.tipNameLabel')}</strong> {t('attrModal.tipNameDesc')}
              </li>
              <li>
                <strong>{t('attrModal.tipValueLabel')}</strong> {t('attrModal.tipValueDesc')}
              </li>
              <li>
                <strong>{t('attrModal.tipCommaLabel')}</strong> {t('attrModal.tipCommaDesc')}
              </li>
              <li>{t('attrModal.tipUsage')}</li>
            </ul>
          }
          type="info"
          showIcon
          icon={<InfoCircleOutlined />}
          style={{ marginBottom: 16 }}
        />

        {/* Ví dụ minh họa */}
        <Alert
          message={t('attrModal.exampleTitle')}
          description={
            <div style={{ marginBottom: 0 }}>
              <div>
                <strong>{t('attrModal.exNameLabel')}</strong> &ldquo;{t('attrModal.ex1name')}&rdquo;
                → <strong>{t('attrModal.exValueLabel')}</strong> &ldquo;{t('attrModal.ex1value')}
                &rdquo;
              </div>
              <div>
                <strong>{t('attrModal.exNameLabel')}</strong> &ldquo;{t('attrModal.ex2name')}&rdquo;
                → <strong>{t('attrModal.exValueLabel')}</strong> &ldquo;{t('attrModal.ex2value')}
                &rdquo;
              </div>
              <div>
                <strong>{t('attrModal.exNameLabel')}</strong> &ldquo;{t('attrModal.ex3name')}&rdquo;
                → <strong>{t('attrModal.exValueLabel')}</strong> &ldquo;{t('attrModal.ex3value')}
                &rdquo;
              </div>
            </div>
          }
          type="success"
          showIcon
          style={{ marginBottom: 16 }}
        />

        {/* Nút submit */}
        <div style={{ textAlign: 'right' }}>
          <Space>
            <Button onClick={handleClose} icon={<CloseOutlined />}>
              {t('common.cancel')}
            </Button>
            <Button type="primary" htmlType="submit" icon={<SaveOutlined />}>
              {attribute ? t('attrModal.updateBtn') : t('attrModal.addBtn')}
            </Button>
          </Space>
        </div>
      </Form>
    </Modal>
  );
};

export default AttributeModal;
