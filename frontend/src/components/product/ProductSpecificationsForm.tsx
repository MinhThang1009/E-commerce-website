import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Button,
  Card,
  Row,
  Col,
  Space,
  Typography,
  Select,
} from 'antd';
import {
  PlusOutlined,
  DeleteOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { TextArea } = Input;
const { Title, Text } = Typography;

interface Specification {
  id: string;
  name: string;
  value: string;
  category?: string;
}

interface ProductSpecificationsFormProps {
  initialSpecifications?: Specification[];
}

const ProductSpecificationsForm: React.FC<ProductSpecificationsFormProps> = ({
  initialSpecifications = [],
}) => {
  const { t } = useTranslation();
  const [specifications, setSpecifications] = useState<Specification[]>(
    initialSpecifications
  );
  const form = Form.useFormInstance();

  const specificationCategories = [
    { value: 'Hiệu năng', label: t('admin.products.specs.categories.performance') },
    { value: 'Màn hình', label: t('admin.products.specs.categories.display') },
    { value: 'Thiết kế', label: t('admin.products.specs.categories.design') },
    { value: 'Kết nối', label: t('admin.products.specs.categories.connectivity') },
    { value: 'Pin & Nguồn', label: t('admin.products.specs.categories.battery') },
    { value: 'Hệ điều hành', label: t('admin.products.specs.categories.os') },
    { value: 'Bảo mật', label: t('admin.products.specs.categories.security') },
    { value: 'Âm thanh', label: t('admin.products.specs.categories.audio') },
    { value: 'Bàn phím', label: t('admin.products.specs.categories.keyboard') },
    { value: 'Camera', label: t('admin.products.specs.categories.camera') },
    { value: 'Thông số chung', label: t('admin.products.specs.categories.general') },
    { value: 'Khác', label: t('admin.products.specs.categories.other') },
  ];

  useEffect(() => {
    if (initialSpecifications && initialSpecifications.length > 0) {
      const specsWithIds = initialSpecifications.map((spec, index) => ({
        ...spec,
        id: spec.id || `spec-${Date.now()}-${index}`,
      }));
      setSpecifications(specsWithIds);
    }
  }, [initialSpecifications]);

  useEffect(() => {
    form.setFieldValue('specifications', specifications);
  }, [specifications, form]);

  useEffect(() => {
    const interval = setInterval(() => {
      const currentSpecs = form.getFieldValue('specifications');
      if (
        currentSpecs &&
        Array.isArray(currentSpecs) &&
        currentSpecs.length > 0
      ) {
        if (JSON.stringify(currentSpecs) !== JSON.stringify(specifications)) {
          setSpecifications(currentSpecs);
          clearInterval(interval);
        }
      }
    }, 500);

    const timeout = setTimeout(() => {
      clearInterval(interval);
    }, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const addSpecification = () => {
    const newSpec: Specification = {
      id: Date.now().toString(),
      name: '',
      value: '',
      category: 'Thông số chung',
    };
    setSpecifications([...specifications, newSpec]);
  };

  const updateSpecification = (
    id: string,
    field: keyof Specification,
    value: string
  ) => {
    setSpecifications((specs) =>
      specs.map((spec) =>
        spec.id === id ? { ...spec, [field]: value } : spec
      )
    );
  };

  const removeSpecification = (id: string) => {
    setSpecifications((specs) => specs.filter((spec) => spec.id !== id));
  };

  const addSampleSpecifications = () => {
    const ts = Date.now();
    const sampleSpecs: Specification[] = [
      { id: `sample-${ts}-1`, name: t('admin.products.specs.sampleSpecs.cpu'), value: 'Intel Core i5-1235U', category: 'Hiệu năng' },
      { id: `sample-${ts}-2`, name: t('admin.products.specs.sampleSpecs.ram'), value: '8GB DDR4 3200MHz', category: 'Hiệu năng' },
      { id: `sample-${ts}-3`, name: t('admin.products.specs.sampleSpecs.storage'), value: '512GB SSD NVMe', category: 'Hiệu năng' },
      { id: `sample-${ts}-4`, name: t('admin.products.specs.sampleSpecs.display'), value: '14 inch Full HD IPS', category: 'Màn hình' },
      { id: `sample-${ts}-5`, name: t('admin.products.specs.sampleSpecs.weight'), value: '1.4kg', category: 'Thiết kế' },
      { id: `sample-${ts}-6`, name: t('admin.products.specs.sampleSpecs.battery'), value: '39WHrs 3-cell', category: 'Pin & Nguồn' },
      { id: `sample-${ts}-7`, name: t('admin.products.specs.sampleSpecs.os'), value: 'Windows 11 Home', category: 'Hệ điều hành' },
    ];
    setSpecifications([...specifications, ...sampleSpecs]);
  };

  return (
    <div style={{ padding: '24px' }}>
      <Title level={3}>
        <InfoCircleOutlined style={{ marginRight: 8 }} />
        {t('admin.products.specs.title')}
      </Title>
      <Text type="secondary" style={{ display: 'block', marginBottom: 24 }}>
        {t('admin.products.specs.subtitle')}
      </Text>

      <div style={{ marginBottom: 24 }}>
        <Space>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={addSpecification}
            size="large"
          >
            {t('admin.products.specs.addButton')}
          </Button>
          <Button type="default" onClick={addSampleSpecifications} size="large">
            {t('admin.products.specs.addSample')}
          </Button>
        </Space>
      </div>

      {specifications.length > 0 && (
        <Card title={t('admin.products.specs.listTitle')} style={{ marginBottom: 24 }}>
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            {specifications.map((spec, index) => (
              <Card
                key={`${spec.id}-${index}`}
                size="small"
                style={{ backgroundColor: '#fafafa' }}
              >
                <Row gutter={16} align="middle">
                  <Col span={6}>
                    <Input
                      placeholder={t('admin.products.specs.namePlaceholder')}
                      value={spec.name}
                      onChange={(e) =>
                        updateSpecification(spec.id, 'name', e.target.value)
                      }
                    />
                  </Col>
                  <Col span={10}>
                    <TextArea
                      placeholder={t('admin.products.specs.valuePlaceholder')}
                      value={spec.value}
                      onChange={(e) =>
                        updateSpecification(spec.id, 'value', e.target.value)
                      }
                      rows={1}
                      autoSize={{ minRows: 1, maxRows: 3 }}
                    />
                  </Col>
                  <Col span={6}>
                    <Select
                      placeholder={t('admin.products.specs.categoryPlaceholder')}
                      value={spec.category}
                      onChange={(value) =>
                        updateSpecification(spec.id, 'category', value)
                      }
                      style={{ width: '100%' }}
                    >
                      {specificationCategories.map((category) => (
                        <Select.Option key={category.value} value={category.value}>
                          {category.label}
                        </Select.Option>
                      ))}
                    </Select>
                  </Col>
                  <Col span={2}>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeSpecification(spec.id)}
                    />
                  </Col>
                </Row>
              </Card>
            ))}
          </Space>
        </Card>
      )}

      {specifications.length === 0 && (
        <Card
          style={{
            textAlign: 'center',
            padding: '40px 20px',
            border: '2px dashed #d9d9d9',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: 16 }}>📋</div>
          <Title level={4} style={{ color: '#999' }}>
            {t('admin.products.specs.emptyTitle')}
          </Title>
          <Text type="secondary">
            {t('admin.products.specs.emptyDesc')}
          </Text>
        </Card>
      )}

      <Form.Item name="specifications" hidden>
        <Input />
      </Form.Item>

      {specifications.length > 0 && (
        <Card title={t('admin.products.specs.summaryTitle')} style={{ marginTop: 24 }} size="small">
          <Text strong>
            {t('admin.products.specs.summaryText', { count: specifications.length })}
          </Text>
        </Card>
      )}
    </div>
  );
};

export default ProductSpecificationsForm;
