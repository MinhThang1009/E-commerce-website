import React from 'react';
import { Form, Input, Button, Space, Card, Typography } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';

const { Text } = Typography;

const ProductFAQForm: React.FC = () => {
  return (
    <div className="p-4">
      <Card
        title="Câu hỏi thường gặp"
        extra={
          <Text type="secondary" className="text-xs">
            Thêm các câu hỏi và câu trả lời thường gặp cho sản phẩm này
          </Text>
        }
      >
        <Form.List name="faqs">
          {(fields, { add, remove }) => (
            <>
              {fields.map(({ key, name, ...restField }) => (
                <div
                  key={key}
                  className="mb-6 p-4 border border-gray-100 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-900/50 relative"
                >
                  <Space
                    direction="vertical"
                    size="middle"
                    style={{ width: '100%' }}
                  >
                    <Form.Item
                      {...restField}
                      name={[name, 'question']}
                      label="Câu hỏi"
                      rules={[{ required: true, message: 'Vui lòng nhập câu hỏi' }]}
                    >
                      <Input placeholder="Ví dụ: Chính sách bảo hành như thế nào?" />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'answer']}
                      label="Câu trả lời"
                      rules={[
                        { required: true, message: 'Vui lòng nhập câu trả lời' },
                      ]}
                    >
                      <Input.TextArea
                        rows={3}
                        placeholder="Nhập câu trả lời chi tiết tại đây..."
                      />
                    </Form.Item>
                  </Space>
                  <Button
                    type="text"
                    danger
                    className="absolute top-2 right-2"
                    onClick={() => remove(name)}
                    icon={<MinusCircleOutlined />}
                  />
                </div>
              ))}
              <Form.Item>
                <Button
                  type="dashed"
                  onClick={() => add()}
                  block
                  icon={<PlusOutlined />}
                >
                  Thêm câu hỏi mới
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>
      </Card>
    </div>
  );
};

export default ProductFAQForm;
