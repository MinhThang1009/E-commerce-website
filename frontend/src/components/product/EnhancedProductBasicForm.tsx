import React, { useState, useEffect } from 'react';
import {
  Form,
  Input,
  Select,
  Row,
  Col,
  Button,
  Alert,
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
import { ProductFormData } from '@/types';
import EnhancedRichTextEditor from '@/components/common/EnhancedRichTextEditor';
import SimpleRichTextEditor from '@/components/common/SimpleRichTextEditor';
import EditorErrorBoundary from '@/components/common/EditorErrorBoundary';
import Base64ImageWarning from './Base64ImageWarning';
import DynamicProductName from './DynamicProductName';
import { sampleLaptopData } from '@/utils/sampleDataHelper';

const { TextArea } = Input;
const { Option } = Select;
const { Text, Title } = Typography;

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
  const form = Form.useFormInstance();
  const [dynamicNamingEnabled, setDynamicNamingEnabled] = useState(true);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Theo dõi giá trị form để tự động tạo tên
  const productName = Form.useWatch('name', form);
  const baseName = Form.useWatch('baseName', form);
  const isVariantProduct = Form.useWatch('isVariantProduct', form);
  const description = Form.useWatch('description', form) || '';

  const handleDescriptionChange = (value: string) => {
    form.setFieldValue('description', value);
  };

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
                <Text strong>Tạo tên sản phẩm tự động</Text>
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
                {showAdvanced ? 'Ẩn' : 'Nâng cao'}
              </Button>
            </Space>

            {dynamicNamingEnabled && (
              <Text
                type="secondary"
                style={{ fontSize: 12, display: 'block', marginTop: 8 }}
              >
                Tên sản phẩm sẽ được tạo tự động dựa trên tên cơ bản và thuộc
                tính đã chọn
              </Text>
            )}
          </div>
        </Col>

        {/* Product Name Field */}
        <Col span={24}>
          <Form.Item
            name="name"
            label="Tên sản phẩm"
            rules={[{ required: true, message: 'Vui lòng nhập tên sản phẩm!' }]}
            extra={
              dynamicNamingEnabled
                ? 'Tên này sẽ được cập nhật tự động khi bạn chọn thuộc tính'
                : undefined
            }
          >
            <Input
              placeholder="Nhập tên sản phẩm"
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
                  <span>Tên cơ bản</span>
                  <InfoCircleOutlined title="Tên cơ bản sẽ được dùng để tạo tên cho các variant" />
                </Space>
              }
              extra="Ví dụ: 'ThinkPad X1 Carbon' sẽ tạo ra 'ThinkPad X1 Carbon i7 16GB'"
            >
              <Input placeholder="Nhập tên cơ bản cho sản phẩm" size="large" />
            </Form.Item>
          </Col>
        )}

        {/* Variant Product Toggle (Advanced) */}
        {showAdvanced && (
          <Col span={24}>
            <Form.Item
              name="isVariantProduct"
              label="Sản phẩm có variants"
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
          <Form.Item name="status" label="Trạng thái" initialValue="active">
            <Select placeholder="Chọn trạng thái" size="large">
              <Option value="active">✅ Hoạt động</Option>
              <Option value="inactive">⏸️ Không hoạt động</Option>
              <Option value="draft">📝 Bản nháp</Option>
            </Select>
          </Form.Item>
        </Col>

        {/* Short Description */}
        <Col span={24}>
          <Form.Item
            name="shortDescription"
            label="Mô tả ngắn"
            rules={[{ required: true, message: 'Vui lòng nhập mô tả ngắn!' }]}
          >
            <TextArea
              rows={3}
              placeholder="Nhập mô tả ngắn về sản phẩm (hiển thị trong danh sách sản phẩm)"
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
            label="Sản phẩm nổi bật"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
        </Col>

        {/* Sample Data Button */}
        <Col span={24}>
          <Button
            type="dashed"
            onClick={handleFillSampleData}
            icon={<SyncOutlined />}
            block
          >
            Điền dữ liệu mẫu (ThinkPad X1 Carbon)
          </Button>
        </Col>

        <Col span={24}>
          <Divider />
        </Col>

        {/* Description Field */}
        <Col span={24}>
          <Form.Item
            name="description"
            label="Mô tả chi tiết"
            rules={[
              { required: true, message: 'Vui lòng nhập mô tả chi tiết!' },
            ]}
          >
            <EnhancedRichTextEditor
              placeholder="Nhập mô tả chi tiết về sản phẩm..."
            />
          </Form.Item>
          <Base64ImageWarning description={description} />
        </Col>
      </Row>
    </div>
  );
};

export default EnhancedProductBasicForm;
