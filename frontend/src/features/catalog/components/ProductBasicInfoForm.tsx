import React from 'react';
import { Form, Input, Select, Row, Col, Button, Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import SimpleRichTextEditor from '@/components/common/SimpleRichTextEditor';
import Base64ImageWarning from './Base64ImageWarning';
import { sampleLaptopData } from '@/utils/sampleProductData';

const { TextArea } = Input;
const { Option } = Select;

interface ProductBasicInfoFormProps {
  fillExampleData: () => void;
  productId?: string;
}

const ProductBasicInfoForm: React.FC<ProductBasicInfoFormProps> = ({
  fillExampleData,
  productId: _productId,
}) => {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const description = Form.useWatch('description', form) || '';

  const handleFillSampleData = () => {
    form.setFieldsValue(sampleLaptopData);
    fillExampleData();
  };
  return (
    <Row gutter={[24, 16]}>
      <Col span={24}>
        <Form.Item
          name="name"
          label={t('admin.products.form.name')}
          rules={[{ required: true, message: t('admin.products.form.nameRequired') }]}
        >
          <Input placeholder={t('admin.products.form.namePlaceholder')} size="large" />
        </Form.Item>
      </Col>

      <Col span={24}>
        <Form.Item name="status" label={t('admin.products.form.status')}>
          <Select placeholder={t('admin.products.form.statusPlaceholder')}>
            <Option value="active">{t('admin.products.form.statusActive')}</Option>
            <Option value="inactive">{t('admin.products.form.statusInactive')}</Option>
            <Option value="draft">{t('admin.products.form.statusDraft')}</Option>
          </Select>
        </Form.Item>
      </Col>

      <Col span={24}>
        <Form.Item
          name="shortDescription"
          label={t('admin.products.form.shortDescription')}
          rules={[
            { required: true, message: t('admin.products.form.shortDescriptionRequired') },
            { min: 5, message: t('admin.products.form.shortDescriptionMin') },
          ]}
        >
          <TextArea
            rows={3}
            placeholder={t('admin.products.form.shortDescriptionPlaceholder')}
            showCount
            maxLength={200}
          />
        </Form.Item>
      </Col>

      <Col span={24}>
        <Form.Item
          name="description"
          label={t('admin.products.form.description')}
          rules={[
            { required: true, message: t('admin.products.form.descriptionRequired') },
            { min: 10, message: t('admin.products.form.descriptionMin') },
          ]}
        >
          <SimpleRichTextEditor
            placeholder={t('admin.products.form.descriptionPlaceholder')}
            height={300}
          />
        </Form.Item>
        {description && <Base64ImageWarning description={description} />}
      </Col>

      <Col span={24}>
        <Alert
          message={t('admin.products.form.tipTitle')}
          description={
            <div>
              <p>• {t('admin.products.form.tipLine1')}</p>
              <p>• {t('admin.products.form.tipLine2')}</p>
              {import.meta.env.DEV && (
                <p>
                  •{' '}
                  <Button type="link" size="small" onClick={handleFillSampleData}>
                    {t('admin.products.form.tipFillData')}
                  </Button>{' '}
                  {t('admin.products.form.tipFillDataSuffix')}
                </p>
              )}
            </div>
          }
          type="info"
          showIcon
        />
      </Col>
    </Row>
  );
};

export default ProductBasicInfoForm;
