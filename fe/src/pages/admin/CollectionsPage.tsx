import React, { useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Switch,
  Space,
  message,
  Popconfirm,
  Tag,
  Image,
  Card,
  Typography,
  Select,
} from 'antd';
import ImageUpload from '@/components/common/ImageUpload';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  AppstoreOutlined,
} from '@ant-design/icons';
import {
  useGetCollectionsQuery,
  useCreateCollectionMutation,
  useUpdateCollectionMutation,
  useDeleteCollectionMutation,
} from '@/services/collectionApi';
import { useGetProductsQuery } from '@/services/productApi';

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
  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCollection, setEditingCollection] = useState<any | null>(null);
  const [fileList, setFileList] = useState<any[]>([]);

  // API hooks
  const {
    data: collectionsData,
    isLoading,
    refetch,
  } = useGetCollectionsQuery();

  const { data: productsData } = useGetProductsQuery({ limit: 100 });

  const [createCollection, { isLoading: isCreating }] = useCreateCollectionMutation();
  const [updateCollection, { isLoading: isUpdating }] = useUpdateCollectionMutation();
  const [deleteCollection, { isLoading: isDeleting }] = useDeleteCollectionMutation();

  const collections = collectionsData?.data || [];
  const products = productsData?.data?.products || [];

  const productOptions = products.map((p: any) => ({
    label: p.name,
    value: p.id,
  }));

  // Handle create/edit collection
  const handleSubmit = async (values: CollectionFormData) => {
    try {
      if (editingCollection) {
        await updateCollection({
          id: editingCollection.id,
          body: values,
        }).unwrap();
        message.success('Cập nhật bộ sưu tập thành công!');
      } else {
        await createCollection(values).unwrap();
        message.success('Tạo bộ sưu tập thành công!');
      }

      setIsModalVisible(false);
      setEditingCollection(null);
      form.resetFields();
      setFileList([]);
      refetch();
    } catch (error: any) {
      message.error(error?.data?.message || 'Có lỗi xảy ra!');
    }
  };

  // Handle delete collection
  const handleDelete = async (id: string) => {
    try {
      await deleteCollection(id).unwrap();
      message.success('Xóa bộ sưu tập thành công!');
      refetch();
    } catch (error: any) {
      message.error(error?.data?.message || 'Không thể xóa bộ sưu tập!');
    }
  };

  // Open create modal
  const handleCreate = () => {
    setEditingCollection(null);
    setIsModalVisible(true);
    form.resetFields();
    setFileList([]);
    form.setFieldsValue({
      isActive: true,
      productIds: [],
    });
  };

  // Open edit modal
  const handleEdit = (collection: any) => {
    setEditingCollection(collection);
    setIsModalVisible(true);
    form.setFieldsValue({
      name: collection.name,
      description: collection.description,
      thumbnail: collection.thumbnail,
      isActive: collection.isActive,
      // Need to fetch individual collection with product IDs or have them in the list
      // For now, let's assume they might be in the record or we'd need another API call
      productIds: collection.Products?.map((p: any) => p.id) || [],
    });
  };

  // Helper to get full image URL
  const getFullImageUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('http')) return url;
    const baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8888';
    return `${baseUrl}${url.startsWith('/') ? '' : '/'}${url}`;
  };

  // Table columns
  const columns = [
    {
      title: 'Ảnh đại diện',
      dataIndex: 'thumbnail',
      key: 'thumbnail',
      width: 100,
      render: (thumbnail: string, record: any) =>
        thumbnail ? (
          <Image
            src={getFullImageUrl(thumbnail)}
            alt={record.name}
            width={60}
            height={40}
            style={{ objectFit: 'cover', borderRadius: 4 }}
          />
        ) : (
          <div className="w-16 h-10 bg-gray-100 rounded flex items-center justify-center">
            <AppstoreOutlined className="text-gray-400" />
          </div>
        ),
    },
    {
      title: 'Tên bộ sưu tập',
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
      title: 'Sản phẩm',
      key: 'productCount',
      render: (_: any, record: any) => `${record.Products?.length || 0} sản phẩm`,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'error'}>
          {isActive ? 'Hoạt động' : 'Ẩn'}
        </Tag>
      ),
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 120,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          />
          <Popconfirm
            title="Xóa bộ sưu tập"
            description="Bạn có chắc chắn muốn xóa bộ sưu tập này?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
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
            <Title
              level={2}
              className="!mb-1 text-xl md:text-2xl dark:text-white"
            >
              Quản lý bộ sưu tập
            </Title>
            <p className="text-neutral-600 dark:text-neutral-400">
              Quản lý danh mục các bộ sưu tập sản phẩm (Summer Sale, Winter,...)
            </p>
          </div>
          <Space className="flex-wrap">
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetch()}
              loading={isLoading}
              className="dark:text-neutral-300"
            >
              Làm mới
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={handleCreate}
            >
              Thêm bộ sưu tập
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
              showTotal: (total) => `Tổng cộng ${total} bộ sưu tập`,
            }}
          />
        </div>

        <Modal
          title={editingCollection ? 'Chỉnh sửa bộ sưu tập' : 'Thêm bộ sưu tập mới'}
          open={isModalVisible}
          onCancel={() => {
            setIsModalVisible(false);
            setEditingCollection(null);
            form.resetFields();
          }}
          footer={null}
          width={700}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            <Form.Item
              name="name"
              label="Tên bộ sưu tập"
              rules={[
                { required: true, message: 'Vui lòng nhập tên bộ sưu tập!' },
              ]}
            >
              <Input placeholder="Nhập tên bộ sưu tập (VD: Summer Collection 2026)" />
            </Form.Item>

            <Form.Item
              name="description"
              label="Mô tả"
            >
              <TextArea
                rows={3}
                placeholder="Nhập mô tả bộ sưu tập"
              />
            </Form.Item>

            <Form.Item
              name="thumbnail"
              label="Ảnh bìa bộ sưu tập"
            >
              <ImageUpload
                type="collections"
                multiple={false}
                value={form.getFieldValue('thumbnail')}
                onChange={(val) => form.setFieldsValue({ thumbnail: val })}
              />
            </Form.Item>

            <Form.Item
              name="productIds"
              label="Thêm sản phẩm vào bộ sưu tập"
            >
              <Select
                mode="multiple"
                allowClear
                style={{ width: '100%' }}
                placeholder="Chọn các sản phẩm cho bộ sưu tập này"
                options={productOptions}
                filterOption={(input, option) =>
                  (option?.label as string ?? '').toLowerCase().includes(input.toLowerCase())
                }
              />
            </Form.Item>

            <Form.Item
              name="isActive"
              label="Trạng thái"
              valuePropName="checked"
            >
              <Switch checkedChildren="Hoạt động" unCheckedChildren="Ẩn" />
            </Form.Item>

            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={() => setIsModalVisible(false)}>
                Hủy
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                loading={isCreating || isUpdating}
              >
                {editingCollection ? 'Cập nhật' : 'Tạo mới'}
              </Button>
            </div>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

export default CollectionsPage;
