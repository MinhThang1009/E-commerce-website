/**
 * @file ProductImagesForm.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React from 'react';
import { Form, Input, Row, Col, Alert } from 'antd';
import { useTranslation } from 'react-i18next';

const { TextArea } = Input;

const ProductImagesForm: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Row gutter={[24, 16]}>
      <Col span={24}>
        <Form.Item name="images" label={t('admin.products.images.label')}>
          <TextArea
            rows={6}
            placeholder={t('admin.products.images.placeholder')}
            showCount
            maxLength={3000}
          />
        </Form.Item>
      </Col>

      <Col span={24}>
        <Form.Item name="thumbnail" label={t('admin.products.images.thumbnailLabel')}>
          <Input placeholder={t('admin.products.images.thumbnailPlaceholder')} />
        </Form.Item>
      </Col>

      <Col span={24}>
        <Alert
          message={t('admin.products.images.guideTitle')}
          description={
            <div>
              <p>
                <strong>📝 {t('admin.products.images.howToLabel')}:</strong>{' '}
                {t('admin.products.images.guideInput')}
              </p>
              <p>
                <strong>🖼️ {t('admin.products.images.requirementsLabel')}:</strong>{' '}
                {t('admin.products.images.guideRequirement')}
              </p>
              <p>
                <strong>📁 {t('admin.products.images.formatLabel')}:</strong>{' '}
                {t('admin.products.images.guideFormat')}
              </p>
              <p>
                <strong>🎯 {t('admin.products.images.thumbnailLabel')}:</strong>{' '}
                {t('admin.products.images.guideThumbnail')}
              </p>
              <p>
                <strong>🔗 Backend:</strong> {t('admin.products.images.guideBackend')}
              </p>
            </div>
          }
          type="info"
          showIcon
        />
      </Col>
    </Row>
  );
};

export default ProductImagesForm;
