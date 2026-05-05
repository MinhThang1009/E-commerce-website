import React, { useState } from 'react';
import {
  Table, Button, Modal, Form, Input, Switch, Space, message, Popconfirm, Tag, Image, Card, Typography, Select,
} from 'antd';
import { useTranslation } from 'react-i18next';
import ImageUpload from '@/components/common/ImageUpload';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined, AppstoreOutlined } from '@ant-design/icons';
import {
  useGetCollectionsQuery, useCreateCollectionMutation, useUpdateCollectionMutation, useDeleteCollectionMutation,
} from '../../api/collectionApi';
import { useGetProductsQuery } from '../../api/productApi';

const { Title } = Typography;
const { TextArea } = Input;

interface CollectionFormData {
  name: string;
  description?: string;
  thumbnail?: string;
  isActive: boolean;
  productIds?: string[];
}

const CollectionsPage: React.FC = () => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCollection, setEditingCollection] = useState<any | null>(null);

  const { data: collectionsData, isLoading, refetch } = useGetCollectionsQuery();
  const { data: productsData } = useGetProductsQuery({ limit: 100 });
  const [createCollection, { isLoading: isCreating }] = useCreateCollectionMutation();
  const [updateCollection, { isLoading: isUpdating }] = useUpdateCollectionMutation();
  const [deleteCollection] = useDeleteCollectionMutation();

  const collections = collectionsData?.data || [];
  const products = productsData?.data || [];
  const productOptions = products.map((p: any) => ({ label: p.name, value: p.id }));

  const handleSubmit = async (values: CollectionFormData) => {
    try {
      if (editingCollection) {
        await updateCollection({ id: editingCollection.id, body: values }).unwrap();
        message.success(t('admin.collections.messages.editSuccess'));
      } else {
        await createCollection(values).unwrap();
        message.success(t('admin.collections.messages.addSuccess'));
      }
      setIsModalVisible(false);
      setEditingCollection(null);
      form.resetFields();
      refetch();
    } catch (error: any) {
      message.error(error?.data?.message || t('common.errorOccurred'));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCollection(id).unwrap();
      message.success(t('admin.collections.messages.deleteSuccess'));
      refetch();
    } catch (error: any) {
      message.error(error?.data?.message || t('admin.collections.messages.deleteError'));
    }
  };

  const handleCreate = () => {
    setEditingCollection(null);
    setIsModalVisible(true);
    form.resetFields();
    form.setFieldsValue({ isActive: true, productIds: [] });
  };

  const handleEdit = (collection: any) => {
    setEditingCollection(collection);
    setIsModalVisible(true);
    form.setFieldsValue({
      name: collection.name,
      description: collection.description,
      thumbnail: collection.thumbnail,
      isActive: collection.isActive,
      productIds: collection.Products?.map((p: any) => p.id) || [],
    });
  };

  const getFullImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8888';
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  const columns = [
    {
      title: t('admin.collections.table.thumbnail'),
      dataIndex: 'thumbnail',
      key: 'thumbnail',
      width: 100,
      render: (thumbnail: string, record: any) =>
        thumbnail ? (
          <Image src={getFullImageUrl(thumbnail)} alt={record.name} width={60} height={40} style={{ objectFit: 'cover', borderRadius: 4 }} />
        ) : (
          <div className="w-16 h-10 bg-gray-100 rounded flex items-center justify-center">
            <AppstoreOutlined className="text-gray-400" />
          </div>
        ),
    },
    {
      title: t('admin.collections.title'),
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: any) => (
        <div>
          <div className="font-medium">{name}</div>
          <div className="text-sm text-gray-500">{record.slug}</div>
        </div>
      ),
    },
    {
      title: t('admin.collections.table.productCount'),
      key: 'productCount',
      render: (_: any, record: any) => t('admin.collections.table.productCountLabel', { count: record.Products?.length || 0 }),
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
      title: t('admin.common.actions'),
      key: 'actions',
      width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} size="small" />
          <Popconfirm
            title={t('admin.collections.deleteTitle')}
            description={t('admin.collections.deleteConfirm')}
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
              {t('admin.collections.title')}
            </Title>
            <p className="text-neutral-600 dark:text-neutral-400">
              {t('admin.collections.subtitle')}
            </p>
          </div>
          <Space className="flex-wrap">
            <Button icon={<ReloadOutlined />} onClick={() => refetch()} loading={isLoading} className="dark:text-neutral-300">
              {t('common.refresh')}
            </Button>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
              {t('admin.collections.addCollection')}
            </Button>
          </Space>
        </div>

        <div className="overflow-x-auto">
          <Table
            columns={columns}
            dataSource={collections}
            rowKey="id"
            loading={isLoading}
            scroll={{ x: 800 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => t('admin.collections.totalItems', { total }),
            }}
          />
        </div>

        <Modal
          title={editingCollection ? t('admin.collections.editCollection') : t('admin.collections.addCollectionModal')}
          open={isModalVisible}
          onCancel={() => { setIsModalVisible(false); setEditingCollection(null); form.resetFields(); }}
          footer={null}
          width={700}
        >
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              name="name"
              label={t('admin.collections.form.name')}
              rules={[{ required: true, message: t('admin.collections.form.nameRequired') }]}
            >
              <Input placeholder={t('admin.collections.form.namePlaceholder') || ''} />
            </Form.Item>

            <Form.Item name="description" label={t('admin.brands.form.description')}>
              <TextArea rows={3} placeholder={t('admin.brands.form.descriptionPlaceholder')} />
            </Form.Item>

            <Form.Item name="thumbnail" label={t('admin.collections.form.thumbnail') || t('admin.collections.table.thumbnail')}>
              <ImageUpload
                type="collections"
                multiple={false}
                value={form.getFieldValue('thumbnail')}
                onChange={(val) => form.setFieldsValue({ thumbnail: val })}
              />
            </Form.Item>

            <Form.Item name="productIds" label={t('admin.collections.form.addProducts') || t('admin.collections.table.productCount')}>
              <Select
                mode="multiple"
                allowClear
                style={{ width: '100%' }}
                placeholder={t('admin.collections.form.selectProducts') || ''}
                options={productOptions}
                filterOption={(input, option) =>
                  (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>

            <Form.Item name="isActive" label={t('common.status')} valuePropName="checked">
              <Switch checkedChildren={t('common.active')} unCheckedChildren={t('admin.common.hidden')} />
            </Form.Item>

            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={() => setIsModalVisible(false)}>{t('common.cancel')}</Button>
              <Button type="primary" htmlType="submit" loading={isCreating || isUpdating}>
                {editingCollection ? t('common.update') : t('common.create')}
              </Button>
            </div>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

export default CollectionsPage;
