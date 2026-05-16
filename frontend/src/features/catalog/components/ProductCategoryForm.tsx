import React from 'react';
import { Form, Select, Row, Col, Alert } from 'antd';
import { useTranslation } from 'react-i18next';
import { Category } from '../types/category.types';

const { Option } = Select;

interface ProductCategoryFormProps {
  categories: Category[];
  isLoading: boolean;
}

const ProductCategoryForm: React.FC<ProductCategoryFormProps> = ({
  categories,
  isLoading,
}) => {
  const { t } = useTranslation();

  return (
    <Row gutter={[24, 16]}>
      <Col span={24}>
        <Form.Item
          name="categoryIds"
          label={t('admin.products.category.label')}
          rules={[
            {
              required: true,
              message: t('admin.products.category.required'),
            },
          ]}
        >
          <Select
            mode="multiple"
            placeholder={t('admin.products.category.placeholder')}
            loading={isLoading}
            showSearch
            optionFilterProp="children"
          >
            {categories.map((category) => (
              <Option key={category.id} value={category.id}>
                {category.name}
              </Option>
            ))}
          </Select>
        </Form.Item>
      </Col>


      <Col span={24}>
        <Alert
          message={t('admin.products.category.alertMessage')}
          description={t('admin.products.category.alertDesc')}
          type="info"
          showIcon
        />
      </Col>
    </Row>
  );
};

export default ProductCategoryForm;
