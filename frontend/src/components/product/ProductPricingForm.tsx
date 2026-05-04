import React from 'react';
import { Form, InputNumber, Switch, Row, Col, Alert, Space } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

interface ProductPricingFormProps {
  hasVariants?: boolean;
}

const ProductPricingForm: React.FC<ProductPricingFormProps> = ({
  hasVariants = false,
}) => {
  const { t } = useTranslation();

  return (
    <Row gutter={[24, 16]}>
      {hasVariants && (
        <Col span={24}>
          <Alert
            message={t('admin.products.pricing.variantAlert')}
            description={
              <div>
                <p>
                  <strong>{t('admin.products.pricing.variantImportantNote')}</strong>{' '}
                  {t('admin.products.pricing.variantStockDesc')}
                </p>
                <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                  <li>
                    <strong>{t('admin.products.pricing.variantStockLabel')}</strong>{' '}
                    {t('admin.products.pricing.variantStockAuto')}
                  </li>
                </ul>
                <p style={{ marginTop: 8, color: '#ff4d4f' }}>
                  {t('admin.products.pricing.variantGoBack')}
                </p>
              </div>
            }
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        </Col>
      )}

      <Col span={12}>
        <Form.Item
          label={t('admin.products.pricing.priceLabel')}
          required
          tooltip={hasVariants ? t('admin.products.pricing.priceTooltipVariant') : ''}
        >
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item
              name="price"
              noStyle
              rules={
                hasVariants
                  ? []
                  : [{ required: true, message: t('admin.products.pricing.priceRequired') }]
              }
            >
              <InputNumber<number>
                placeholder={t('admin.products.pricing.pricePlaceholder')}
                style={{ width: '100%' }}
                formatter={(value) =>
                  value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''
                }
                parser={(value) => Number(value?.replace(/\$\s?|(,*)/g, '') ?? '')}
                min={0}
                disabled={hasVariants}
              />
            </Form.Item>
            <div className="ant-input-group-addon">{t('common.currencySymbol')}</div>
          </Space.Compact>
        </Form.Item>
      </Col>

      <Col span={12}>
        <Form.Item
          label={t('admin.products.pricing.comparePriceLabel')}
          tooltip={t('admin.products.pricing.comparePriceTooltip')}
        >
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="compareAtPrice" noStyle>
              <InputNumber<number>
                placeholder="0"
                style={{ width: '100%' }}
                formatter={(value) =>
                  value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''
                }
                parser={(value) => Number(value?.replace(/\$\s?|(,*)/g, '') ?? '')}
                min={0}
              />
            </Form.Item>
            <div className="ant-input-group-addon">{t('common.currencySymbol')}</div>
          </Space.Compact>
        </Form.Item>
      </Col>

      <Col span={12}>
        <Form.Item
          name="stockQuantity"
          label={hasVariants ? t('admin.products.pricing.stockLabelVariant') : t('admin.products.pricing.stockLabel')}
          rules={[{ required: true, message: t('admin.products.pricing.stockRequired') }]}
          tooltip={
            hasVariants
              ? t('admin.products.pricing.stockTooltipVariant')
              : t('admin.products.pricing.stockTooltip')
          }
          extra={hasVariants ? t('admin.products.pricing.stockAutoUpdate') : ''}
        >
          <InputNumber
            placeholder="0"
            style={{ width: '100%' }}
            min={0}
            disabled={hasVariants}
          />
        </Form.Item>
      </Col>

      <Col span={12}>
        <Form.Item
          name="featured"
          label={t('admin.products.pricing.featuredLabel')}
          valuePropName="checked"
        >
          <Switch
            checkedChildren={t('admin.products.pricing.featuredYes')}
            unCheckedChildren={t('admin.products.pricing.featuredNo')}
          />
        </Form.Item>
      </Col>

      <Col span={24}>
        <Alert
          message={t('admin.products.pricing.infoAlert')}
          description={t('admin.products.pricing.infoAlertDesc')}
          type="info"
          icon={<InfoCircleOutlined />}
          showIcon
        />
      </Col>
    </Row>
  );
};

export default ProductPricingForm;
