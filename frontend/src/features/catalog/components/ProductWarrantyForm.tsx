import React, { useEffect } from 'react';
import {
  Form,
  Card,
  Typography,
  Checkbox,
  Row,
  Col,
  Alert,
  Space,
  Spin,
} from 'antd';
import {
  SafetyOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useGetWarrantyPackagesQuery } from '@/features/admin';
import { WarrantyPackage } from '../types/product.types';
import { getLocale } from '@/utils/format';

const { Title, Text } = Typography;

interface ProductWarrantyFormProps {
  form?: any;
}

const ProductWarrantyForm: React.FC<ProductWarrantyFormProps> = ({
  form: parentForm,
}) => {
  const { t } = useTranslation();

  const {
    data: warrantyData,
    isLoading,
    error,
  } = useGetWarrantyPackagesQuery({
    isActive: true,
  });

  const warrantyPackages = warrantyData?.data?.warrantyPackages || [];

  useEffect(() => {
    if (warrantyPackages.length > 0 && parentForm) {
      const currentValue = parentForm.getFieldValue('warrantyPackageIds') || [];
      const freePackageIds = warrantyPackages
        .filter((pkg) => pkg.price === 0)
        .map((pkg) => pkg.id);

      const needsUpdate = freePackageIds.some(
        (id) => !currentValue.includes(id)
      );
      if (needsUpdate) {
        const newValue = Array.from(
          new Set([...currentValue, ...freePackageIds])
        );
        parentForm.setFieldValue('warrantyPackageIds', newValue);
      }
    }
  }, [warrantyPackages, parentForm]);

  const formatPrice = (price: number) => {
    // Luôn dùng VND — dùng locale động để format dấu phân tách
    return `${price.toLocaleString(getLocale())}${t('common.currencySymbol')}`;
  };

  const formatDuration = (months: number) => {
    if (months === 0) return t('admin.products.warranty.followProduct');
    if (months < 12) return t('admin.products.warranty.months', { count: months });
    if (months === 12) return t('admin.products.warranty.year');
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return rem > 0
      ? t('admin.products.warranty.yearsMonths', { years, months: rem })
      : t('admin.products.warranty.yearsOnly', { years });
  };

  if (isLoading) {
    return (
      <Card>
        <div style={{ textAlign: 'center', padding: '40px 0' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>{t('admin.products.warranty.loading')}</div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <Alert
          message={t('admin.products.warranty.loadError')}
          description={t('admin.products.warranty.loadErrorDesc')}
          type="error"
          showIcon
        />
      </Card>
    );
  }

  return (
    <Card>
      <Title level={4}>
        <SafetyOutlined /> {t('admin.products.warranty.title')}
      </Title>

      <Alert
        message={t('admin.products.warranty.infoAlert')}
        description={t('admin.products.warranty.infoAlertDesc')}
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />

      {warrantyPackages.length === 0 ? (
        <Alert
          message={t('admin.products.warranty.emptyAlert')}
          description={t('admin.products.warranty.emptyAlertDesc')}
          type="warning"
          showIcon
        />
      ) : (
        <Form.Item name="warrantyPackageIds" label={t('admin.products.warranty.selectLabel')}>
          <Checkbox.Group style={{ width: '100%' }}>
            <Row gutter={[16, 16]}>
              {warrantyPackages.map((pkg: WarrantyPackage) => (
                <Col span={12} key={pkg.id}>
                  <Card
                    size="small"
                    hoverable
                    style={{
                      border:
                        pkg.price === 0
                          ? '2px solid #1890ff'
                          : '1px solid #d9d9d9',
                      backgroundColor: pkg.price === 0 ? '#f0f9ff' : 'white',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 8,
                      }}
                    >
                      <Checkbox value={pkg.id} style={{ marginTop: 4 }} />
                      <div style={{ flex: 1 }}>
                        <div
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                          }}
                        >
                          <Text strong>{pkg.name}</Text>
                          <Text type="success" strong>
                            {pkg.price === 0
                              ? t('admin.products.warranty.free')
                              : formatPrice(pkg.price)}
                          </Text>
                        </div>

                        <div style={{ marginBottom: 8 }}>
                          <Text type="secondary" style={{ fontSize: 12 }}>
                            {t('admin.products.warranty.durationLabel')} {formatDuration(pkg.durationMonths)}
                          </Text>
                        </div>

                        {pkg.description && (
                          <Text
                            type="secondary"
                            style={{ display: 'block', marginBottom: 8 }}
                          >
                            {pkg.description}
                          </Text>
                        )}

                        {Array.isArray(pkg.coverage) && pkg.coverage.length > 0 && (
                          <Space direction="vertical" size={4}>
                            {pkg.coverage.map((coverage, index) => (
                              <div
                                key={index}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: 4,
                                }}
                              >
                                <CheckCircleOutlined
                                  style={{ color: '#52c41a', fontSize: 12 }}
                                />
                                <Text style={{ fontSize: 12 }}>{coverage}</Text>
                              </div>
                            ))}
                          </Space>
                        )}
                      </div>
                    </div>
                  </Card>
                </Col>
              ))}
            </Row>
          </Checkbox.Group>
        </Form.Item>
      )}

      <Alert
        message={t('admin.products.warranty.noteAlert')}
        description={t('admin.products.warranty.noteAlertDesc')}
        type="warning"
        showIcon
        style={{ marginTop: 16 }}
      />
    </Card>
  );
};

export default ProductWarrantyForm;
