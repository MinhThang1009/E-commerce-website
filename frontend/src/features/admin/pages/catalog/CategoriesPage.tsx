/**
 * @file CategoriesPage.tsx
 * @layer Page
 * @feature catalog
 * @description Page component của feature catalog
 */
import React, { useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  InputNumber,
  Space,
  message,
  Popconfirm,
  Tag,
  Image,
  Card,
  Typography,
} from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { useTranslation } from 'react-i18next';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import {
  useGetAllCategoriesQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
} from '@features/catalog/api/category-api';
import type { Category } from '@features/catalog/types/category.types';
import ImageUpload from '@/components/common/ImageUpload';
import { getErrorMsg } from '@/utils/error-utils';

const { Title } = Typography;
const { TextArea } = Input;

interface CategoryFormData {
  name: string;
  description?: string;
  image?: string;
  parentId?: string | null;
  isActive: boolean;
  sortOrder: number;
}

const CategoriesPage: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  const { data: categoriesData, isLoading, refetch } = useGetAllCategoriesQuery();
  const { mutateAsync: createCategory, isPending: isCreating } = useCreateCategoryMutation();
  const { mutateAsync: updateCategory, isPending: isUpdating } = useUpdateCategoryMutation();
  const { mutateAsync: deleteCategory } = useDeleteCategoryMutation();

  const categories = React.useMemo(() => {
    if (!categoriesData?.data) return [];
    if (Array.isArray(categoriesData.data)) return categoriesData.data;
    return [categoriesData.data];
  }, [categoriesData]);

  const getParentOptions = (excludeId?: string) =>
    categories
      .filter((cat) => cat.id !== excludeId && !cat.parentId)
      .map((cat) => ({ value: cat.id, label: cat.name }));

  const handleSubmit = async (values: CategoryFormData) => {
    try {
      if (editingCategory) {
        await updateCategory({ id: editingCategory.id, ...values });
        message.success(t('admin.categories.messages.editSuccess'));
      } else {
        await createCategory(values);
        message.success(t('admin.categories.messages.addSuccess'));
      }
      setIsModalVisible(false);
      setEditingCategory(null);
      form.resetFields();
      refetch();
    } catch (error) {
      message.error(getErrorMsg(error, t('common.errorOccurred')));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory(id);
      message.success(t('admin.categories.messages.deleteSuccess'));
      refetch();
    } catch (error) {
      message.error(getErrorMsg(error, t('admin.categories.messages.deleteError')));
    }
  };

  const handleCreate = () => {
    setEditingCategory(null);
    setIsModalVisible(true);
    form.resetFields();
    form.setFieldsValue({ isActive: true, sortOrder: 0 });
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setIsModalVisible(true);
    form.setFieldsValue({
      name: category.name,
      description: category.description,
      image: category.image,
      parentId: category.parentId,
      isActive: category.isActive,
      sortOrder: category.sortOrder || 0,
    });
  };

  const columns: ColumnsType<Category> = [
    {
      title: t('admin.categories.table.image'),
      dataIndex: 'image',
      key: 'image',
      width: 80,
      render: (image: string, record: Category) =>
        image ? (
          <Image
            src={image}
            alt={record.name}
            width={50}
            height={50}
            style={{ objectFit: 'cover', borderRadius: 4 }}
          />
        ) : (
          <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
            <FolderOutlined className="text-gray-400" />
          </div>
        ),
    },
    {
      title: t('admin.categories.table.name'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: Category) => (
        <div>
          <div className="font-medium">{name}</div>
          <div className="text-sm text-gray-500">{record.slug}</div>
        </div>
      ),
    },
    {
      title: t('admin.brands.form.description'),
      dataIndex: 'description',
      key: 'description',
      render: (description?: string) =>
        description ? (
          <div className="max-w-xs truncate" title={description}>
            {description}
          </div>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      title: t('admin.categories.table.parent'),
      dataIndex: 'parentId',
      key: 'parentId',
      render: (parentId?: string | null) => {
        if (!parentId) return <Tag color="green">{t('admin.categories.table.root')}</Tag>;
        const parent = categories.find((cat) => cat.id === parentId);
        return parent ? (
          <Tag color="blue">{parent.name}</Tag>
        ) : (
          <span className="text-gray-400">—</span>
        );
      },
    },
    {
      title: t('common.status'),
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'error'}>
          {isActive ? t('common.active') : t('admin.common.hidden')}
        </Tag>
      ),
    },
    {
      title: t('admin.categories.table.order'),
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      width: 80,
      render: (sortOrder?: number) => sortOrder || 0,
    },
    {
      title: t('admin.common.actions'),
      key: 'actions',
      width: 120,
      render: (_, record: Category) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          />
          <Popconfirm
            title={t('admin.categories.deleteTitle')}
            description={t('admin.categories.deleteConfirm')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('common.delete')}
            cancelText={t('common.cancel')}
            okButtonProps={{ danger: true }}
          >
            <Button type="link" icon={<DeleteOutlined />} danger size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-2 sm:p-4 md:p-6">
      <Card className="dark:bg-neutral-800">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <Title level={2} className="!mb-1 text-xl md:text-2xl dark:text-white">
              {t('admin.categories.title')}
            </Title>
            <p className="text-neutral-600 dark:text-neutral-400">
              {t('admin.categories.subtitle')}
            </p>
          </div>
          <Space className="flex-wrap">
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetch()}
              loading={isLoading}
              className="dark:text-neutral-300"
            >
              {t('common.refresh')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              {t('admin.categories.addCategory')}
            </Button>
          </Space>
        </div>

        <div className="overflow-x-auto">
          <Table
            columns={columns}
            dataSource={categories}
            rowKey="id"
            loading={isLoading}
            scroll={{ x: 800 }}
            className="dark-table-fixed-columns"
            pagination={{
              total: categories.length,
              pageSize: 10,
              showSizeChanger: true,
              showQuickJumper: true,
              responsive: true,
              showTotal: (total, range) =>
                t('admin.categories.totalItems', { range0: range[0], range1: range[1], total }),
            }}
          />
        </div>

        <Modal
          title={
            editingCategory
              ? t('admin.categories.editCategory')
              : t('admin.categories.addCategoryModal')
          }
          open={isModalVisible}
          onCancel={() => {
            setIsModalVisible(false);
            setEditingCategory(null);
            form.resetFields();
          }}
          footer={null}
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
            initialValues={{ isActive: true, sortOrder: 0 }}
          >
            <Form.Item
              name="name"
              label={t('admin.categories.table.name')}
              rules={[
                { required: true, message: t('admin.categories.form.nameRequired') },
                { min: 2, message: t('admin.categories.form.nameMinLength') || 'Min 2 characters' },
              ]}
            >
              <Input placeholder={t('admin.categories.form.namePlaceholder') || ''} />
            </Form.Item>

            <Form.Item name="description" label={t('admin.brands.form.description')}>
              <TextArea rows={3} placeholder={t('admin.brands.form.descriptionPlaceholder')} />
            </Form.Item>

            <Form.Item name="image" label={t('admin.categories.table.image')}>
              <ImageUpload
                type="categories"
                multiple={false}
                value={form.getFieldValue('image')}
                onChange={(val) => form.setFieldsValue({ image: val })}
              />
            </Form.Item>

            <Form.Item name="parentId" label={t('admin.categories.form.parentCategory')}>
              <Select
                placeholder={t('admin.categories.form.selectParent')}
                allowClear
                options={getParentOptions(editingCategory?.id)}
              />
            </Form.Item>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Form.Item name="sortOrder" label={t('admin.categories.form.displayOrder')}>
                <InputNumber min={0} placeholder="0" className="w-full" />
              </Form.Item>

              <Form.Item name="isActive" label={t('common.status')} valuePropName="checked">
                <Switch
                  checkedChildren={t('common.active')}
                  unCheckedChildren={t('admin.common.hidden')}
                />
              </Form.Item>
            </div>

            <div className="flex flex-wrap justify-end gap-2 mt-6">
              <Button
                onClick={() => {
                  setIsModalVisible(false);
                  setEditingCategory(null);
                  form.resetFields();
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button type="primary" htmlType="submit" loading={isCreating || isUpdating}>
                {editingCategory ? t('common.update') : t('common.create')}
              </Button>
            </div>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

export default CategoriesPage;
