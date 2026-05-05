import React from 'react';
import { Form, Input, Row, Col, Alert } from 'antd';
import { useTranslation } from 'react-i18next';

const { TextArea } = Input;

const ProductSeoForm: React.FC = () => {
  const { t } = useTranslation();

  return (
    <Row gutter={[24, 16]}>
      <Col span={24}>
        <Form.Item name="seoTitle" label={t('admin.products.seo.titleLabel')}>
          <Input
            placeholder={t('admin.products.seo.titlePlaceholder')}
            maxLength={60}
            showCount
          />
        </Form.Item>
      </Col>

      <Col span={24}>
        <Form.Item name="seoDescription" label={t('admin.products.seo.descLabel')}>
          <TextArea
            rows={3}
            placeholder={t('admin.products.seo.descPlaceholder')}
            maxLength={160}
            showCount
          />
        </Form.Item>
      </Col>

      <Col span={24}>
        <Form.Item name="seoKeywords" label={t('admin.products.seo.keywordsLabel')}>
          <TextArea
            rows={2}
            placeholder={t('admin.products.seo.keywordsPlaceholder')}
            maxLength={200}
            showCount
          />
        </Form.Item>
      </Col>

      <Col span={24}>
        <Alert
          message={t('admin.products.seo.alertTitle')}
          description={
            <div>
              <p>• {t('admin.products.seo.tip1')}</p>
              <p>• {t('admin.products.seo.tip2')}</p>
              <p>• {t('admin.products.seo.tip3')}</p>
              <p>• {t('admin.products.seo.tip4')}</p>
            </div>
          }
          type="info"
          showIcon
        />
      </Col>
    </Row>
  );
};

export default ProductSeoForm;
