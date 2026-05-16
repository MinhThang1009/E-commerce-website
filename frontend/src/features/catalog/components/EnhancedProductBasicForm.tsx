import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Form,
  Input,
  Select,
  Row,
  Col,
  Button,
  Switch,
  Space,
  Typography,
  Divider,
} from 'antd';
import {
  BulbOutlined,
  SyncOutlined,
  SettingOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import EnhancedRichTextEditor from '@/components/common/EnhancedRichTextEditor';
import Base64ImageWarning from './Base64ImageWarning';
import DynamicProductName from './DynamicProductName';
import { sampleLaptopData } from '@/utils/sampleProductData';

const { TextArea } = Input;
const { Option } = Select;
const { Text } = Typography;

interface EnhancedProductBasicFormProps {
  fillExampleData: () => void;
  productId?: string;
  selectedAttributes?: Record<string, string>;
  onNameGenerated?: (name: string, details: any) => void;
}

const EnhancedProductBasicForm: React.FC<EnhancedProductBasicFormProps> = ({
  fillExampleData,
  productId,
  selectedAttributes = {},
  onNameGenerated,
}) => {
  const { t } = useTranslation();
  const form = Form.useFormInstance();
  const [dynamicNamingEnabled, setDynamicNamingEnabled] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Theo dõi giá trị form để tự động tạo tên
  const productName = Form.useWatch('name', form);
  const baseName = Form.useWatch('baseName', form);
  const isVariantProduct = Form.useWatch('isVariantProduct', form);
  const description = Form.useWatch('description', form) || '';

  const handleFillSampleData = () => {
    const sampleData = {
      ...sampleLaptopData,
      baseName: 'ThinkPad X1 Carbon',
      isVariantProduct: true,
    };
    form.setFieldsValue(sampleData);
    fillExampleData();
  };

  // Tự động đặt baseName khi tên sản phẩm thay đổi (nếu chưa đặt thủ công)
  useEffect(() => {
    if (productName && !baseName && isVariantProduct) {
      form.setFieldValue('baseName', productName);
    }
  }, [productName, baseName, isVariantProduct, form]);

  const effectiveBaseName = baseName || productName;

  return (
    <div>
      <Row gutter={[24, 16]}>
        {/* Dynamic Naming Controls */}
        <Col span={24}>
          <div
            style={{
              padding: '16px',
              background: '#fafafa',
              borderRadius: 8,
              marginBottom: 16,
              border: '1px dashed #d9d9d9',
            }}
          >
            <Space
              size="middle"
              style={{ width: '100%', justifyContent: 'space-between' }}
            >
              <Space>
                <BulbOutlined style={{ color: '#1890ff' }} />
                <Text strong>{t('productForm.autoName')}</Text>
                <Switch
                  checked={dynamicNamingEnabled}
                  onChange={setDynamicNamingEnabled}
                  size="small"
                />
              </Space>
              <Button
                type="link"
                size="small"
                icon={<SettingOutlined />}
                onClick={() => setShowAdvanced(!showAdvanced)}
              >
                {showAdvanced ? t('productForm.hide') : t('productForm.advanced')}
              </Button>
            </Space>

            {dynamicNamingEnabled && (
              <Text
                type="secondary"
                style={{ fontSize: 12, display: 'block', marginTop: 8 }}
              >
                {t('productForm.autoNameDesc')}
              </Text>
            )}
          </div>
        </Col>

        {/* Product Name Field */}
        <Col span={24}>
          <Form.Item
            name="name"
            label={t('productForm.nameLabel')}
            rules={[{ required: true, message: t('productForm.nameRequired') }]}
            extra={
              dynamicNamingEnabled
                ? t('productForm.nameAutoUpdate')
                : undefined
            }
          >
            <Input
              placeholder={t('productForm.namePlaceholder')}
              size="large"
              disabled={
                dynamicNamingEnabled &&
                Object.values(selectedAttributes).some((v) => v)
              }
            />
          </Form.Item>
        </Col>

        {/* Base Name Field (Advanced) */}
        {showAdvanced && (
          <Col span={24}>
            <Form.Item
              name="baseName"
              label={
                <Space>
                  <span>{t('productForm.baseNameLabel')}</span>
                  <InfoCircleOutlined title={t('productForm.baseNameTooltip')} />
                </Space>
              }
              extra={t('productForm.baseNameExtra')}
            >
              <Input placeholder={t('productForm.baseNamePlaceholder')} size="large" />
            </Form.Item>
          </Col>
        )}

        {/* Variant Product Toggle (Advanced) */}
        {showAdvanced && (
          <Col span={24}>
            <Form.Item
              name="isVariantProduct"
              label={t('productForm.isVariant')}
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
        )}

        {/* Dynamic Product Name Component */}
        {dynamicNamingEnabled && (
          <Col span={24}>
            <DynamicProductName
              baseName={effectiveBaseName}
              selectedAttributes={selectedAttributes}
              productId={productId}
              onNameGenerated={onNameGenerated}
              disabled={!dynamicNamingEnabled}
            />
          </Col>
        )}

        {/* Status Field */}
        <Col span={24}>
          <Form.Item name="status" label={t('productForm.statusLabel')} initialValue="active">
            <Select placeholder={t('productForm.statusPlaceholder')} size="large">
              <Option value="active">{t('productForm.statusActive')}</Option>
              <Option value="inactive">{t('productForm.statusInactive')}</Option>
              <Option value="draft">{t('productForm.statusDraft')}</Option>
            </Select>
          </Form.Item>
        </Col>

        {/* Short Description */}
        <Col span={24}>
          <Form.Item
            name="shortDescription"
            label={t('productForm.shortDescLabel')}
            rules={[{ required: true, message: t('productForm.shortDescRequired') }]}
          >
            <TextArea
              rows={3}
              placeholder={t('productForm.shortDescPlaceholder')}
              maxLength={200}
              showCount
              size="large"
            />
          </Form.Item>
        </Col>

        {/* Featured Toggle */}
        <Col span={24}>
          <Form.Item
            name="featured"
            label={t('productForm.featuredLabel')}
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>

        {/* Sample Data Button — dev only */}
        {import.meta.env.DEV && (
          <Col span={24}>
            <Button
              type="dashed"
              onClick={handleFillSampleData}
              icon={<SyncOutlined />}
              block
            >
              {t('productForm.fillSampleData')}
            </Button>
          </Col>
        )}

        <Col span={24}>
          <Divider />
        </Col>

        {/* Description Field */}
        <Col span={24}>
          <Form.Item
            name="description"
            label={t('productForm.descLabel')}
            rules={[
              { required: true, message: t('productForm.descRequired') },
            ]}
          >
            <EnhancedRichTextEditor
              placeholder={t('productForm.descPlaceholder')}
            />
          </Form.Item>
          <Base64ImageWarning description={description} />
        </Col>
      </Row>
    </div>
  );
};

export default EnhancedProductBasicForm;

