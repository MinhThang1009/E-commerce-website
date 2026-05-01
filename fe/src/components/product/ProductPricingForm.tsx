import React from 'react';
import { Form, InputNumber, Switch, Row, Col, Alert, Space } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';

interface ProductPricingFormProps {
  hasVariants?: boolean;
}

const ProductPricingForm: React.FC<ProductPricingFormProps> = ({
  hasVariants = false,
}) => {
  return (
    <Row gutter={[24, 16]}>
      {hasVariants && (
        <Col span={24}>
          <Alert
            message="Sản phẩm có biến thể"
            description={
              <div>
                <p>
                  <strong>Lưu ý quan trọng:</strong> Sản phẩm này có biến thể.
                  Số lượng tồn kho sẽ được tính dựa trên các biến thể.
                </p>
                <ul style={{ marginBottom: 0, paddingLeft: 20 }}>
                  <li>
                    <strong>Số lượng tồn kho:</strong> Tổng số lượng của tất cả
                    biến thể (được tính tự động)
                  </li>
                </ul>
                <p style={{ marginTop: 8, color: '#ff4d4f' }}>
                  Bạn nên quay lại tab "Biến thể" để cập nhật giá và số lượng
                  cho từng biến thể.
                </p>
              </div>
            }
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        </Col>
      )}

      {/* Hiển thị trường giá bán */}
      <Col span={12}>
        <Form.Item
          label="Giá bán"
          required
          tooltip={
            hasVariants ? 'Đây là giá mặc định khi không chọn biến thể' : ''
          }
        >
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item
              name="price"
              noStyle
              rules={
                hasVariants
                  ? []
                  : [{ required: true, message: 'Vui lòng nhập giá bán!' }]
              }
            >
              <InputNumber
                placeholder="Nhập giá bán"
                style={{ width: '100%' }}
                formatter={(value) =>
                  value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''
                }
                parser={(value) => (value ? Number(value.replace(/\$\s?|(,*)/g, '')) : undefined) as any}
                min={0}
                disabled={hasVariants}
              />
            </Form.Item>
            <div className="ant-input-group-addon">đ</div>
          </Space.Compact>
        </Form.Item>
      </Col>

      <Col span={12}>
        <Form.Item
          label="Giá so sánh"
          tooltip="Giá gốc trước khi giảm giá (nếu có)"
        >
          <Space.Compact style={{ width: '100%' }}>
            <Form.Item name="compareAtPrice" noStyle>
              <InputNumber
                placeholder="0"
                style={{ width: '100%' }}
                formatter={(value) =>
                  value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''
                }
                parser={(value) => (value ? Number(value.replace(/\$\s?|(,*)/g, '')) : undefined) as any}
                min={0}
              />
            </Form.Item>
            <div className="ant-input-group-addon">đ</div>
          </Space.Compact>
        </Form.Item>
      </Col>

      <Col span={12}>
        <Form.Item
          name="stockQuantity"
          label={hasVariants ? 'Tổng số lượng tồn kho' : 'Số lượng tồn kho'}
          rules={[{ required: true, message: 'Vui lòng nhập số lượng!' }]}
          tooltip={
            hasVariants
              ? 'Đây là tổng số lượng của tất cả biến thể. Hệ thống sẽ tự động cập nhật dựa trên số lượng của các biến thể.'
              : 'Số lượng sản phẩm có sẵn để bán'
          }
          extra={
            hasVariants
              ? 'Số lượng này sẽ được tự động cập nhật dựa trên tổng số lượng của các biến thể'
              : ''
          }
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
          label="Sản phẩm nổi bật"
          valuePropName="checked"
        >
          <Switch
            checkedChildren="Có"
            unCheckedChildren="Không"
          />
        </Form.Item>
      </Col>

      <Col span={24}>
        <Alert
          message="Thông tin giá"
          description="Giá so sánh dùng để hiển thị giá gốc khi sản phẩm đang giảm giá. Để trống nếu không có giảm giá. Giá chính sẽ được tính từ giá biến thể thấp nhất."
          type="info"
          icon={<InfoCircleOutlined />}
          showIcon
        />
      </Col>
    </Row>
  );
};

export default ProductPricingForm;
