/**
 * @file ProductFAQForm.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React from 'react';
import { Form, Input, Button, Space, Card, Typography } from 'antd';
import { MinusCircleOutlined, PlusOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

const { Text } = Typography;

const ProductFAQForm: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="p-4">
      <Card
        title={t('admin.products.faq.title')}
        extra={
          <Text type="secondary" className="text-xs">
            {t('admin.products.faq.subtitle')}
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
                      label={t('admin.products.faq.questionLabel')}
                      rules={[{ required: true, message: t('admin.products.faq.questionRequired') }]}
                    >
                      <Input placeholder={t('admin.products.faq.questionPlaceholder')} />
                    </Form.Item>
                    <Form.Item
                      {...restField}
                      name={[name, 'answer']}
                      label={t('admin.products.faq.answerLabel')}
                      rules={[
                        { required: true, message: t('admin.products.faq.answerRequired') },
                      ]}
                    >
                      <Input.TextArea
                        rows={3}
                        placeholder={t('admin.products.faq.answerPlaceholder')}
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
                  {t('admin.products.faq.addButton')}
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
