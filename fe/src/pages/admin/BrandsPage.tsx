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
} from 'antd';
import ImageUpload from '@/components/common/ImageUpload';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  GlobalOutlined,
  ReloadOutlined,
  TrademarkOutlined,
} from '@ant-design/icons';
import {
  useGetBrandsQuery,
  useCreateBrandMutation,
  useUpdateBrandMutation,
  useDeleteBrandMutation,
} from '@/services/brandApi';

const { Title } = Typography;
const { TextArea } = Input;

interface BrandFormData {
  name: string;
  description?: string;
  logo?: string;
  website?: string;
  isActive: boolean;
}

const BrandsPage: React.FC = () => {
  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingBrand, setEditingBrand] = useState<any | null>(null);
  const [fileList, setFileList] = useState<any[]>([]);

  // API hooks
  const {
    data: brandsData,
    isLoading,
    refetch,
  } = useGetBrandsQuery();

  const [createBrand, { isLoading: isCreating }] = useCreateBrandMutation();
  const [updateBrand, { isLoading: isUpdating }] = useUpdateBrandMutation();
  const [deleteBrand, { isLoading: isDeleting }] = useDeleteBrandMutation();

  const brands = brandsData?.data || [];

  // Handle create/edit brand
  const handleSubmit = async (values: BrandFormData) => {
    try {
      if (editingBrand) {
        await updateBrand({
          id: editingBrand.id,
          body: values,
        }).unwrap();
        message.success('Cập nhật thương hiệu thành công!');
      } else {
        await createBrand(values).unwrap();
        message.success('Tạo thương hiệu thành công!');
      }

      setIsModalVisible(false);
      setEditingBrand(null);
      form.resetFields();
      setFileList([]);
      refetch();
    } catch (error: any) {
      message.error(error?.data?.message || 'Có lỗi xảy ra!');
    }
  };

  // Handle delete brand
  const handleDelete = async (id: string) => {
    try {
      await deleteBrand(id).unwrap();
      message.success('Xóa thương hiệu thành công!');
      refetch();
    } catch (error: any) {
      message.error(error?.data?.message || 'Không thể xóa thương hiệu!');
    }
  };

  // Open create modal
  const handleCreate = () => {
    setEditingBrand(null);
    setIsModalVisible(true);
    form.resetFields();
    setFileList([]);
    form.setFieldsValue({
      isActive: true,
    });
  };

  // Open edit modal
  const handleEdit = (brand: any) => {
    setEditingBrand(brand);
    setIsModalVisible(true);
    form.setFieldsValue({
      name: brand.name,
      description: brand.description,
      logo: brand.logo,
      website: brand.website,
      isActive: brand.isActive,
    });
    
    if (brand.logo) {
      setFileList([
        {
          uid: '-1',
          name: 'logo',
          status: 'done',
          url: brand.logo,
        },
      ]);
    } else {
      setFileList([]);
    }
  };

  // Table columns
  const columns = [
    {
      title: 'Logo',
      dataIndex: 'logo',
      key: 'logo',
      width: 80,
      render: (logo: string, record: any) => {
        const fullLogoUrl = logo?.startsWith('http') ? logo : `${import.meta.env.VITE_API_URL || 'http://localhost:8888'}${logo?.startsWith('/') ? '' : '/'}${logo}`;
        return logo ? (
          <Image
            src={fullLogoUrl}
            alt={record.name}
            width={50}
            height={50}
            style={{ objectFit: 'contain', borderRadius: 4, background: '#f5f5f5', padding: 4 }}
          />
        ) : (
          <div className="w-12 h-12 bg-gray-100 rounded flex items-center justify-center">
            <TrademarkOutlined className="text-gray-400" />
          </div>
        );
      },
    },
    {
      title: 'Tên thương hiệu',
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
      title: 'Website',
      dataIndex: 'website',
      key: 'website',
      render: (website: string) =>
        website ? (
          <a href={website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
            <GlobalOutlined /> {new URL(website).hostname}
          </a>
        ) : (
          <span className="text-gray-400">—</span>
        ),
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
            title="Xóa thương hiệu"
            description="Bạn có chắc chắn muốn xóa thương hiệu này?"
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
              Quản lý thương hiệu
            </Title>
            <p className="text-neutral-600 dark:text-neutral-400">
              Quản lý các thương hiệu sản phẩm
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
              Thêm thương hiệu
            </Button>
          </Space>
        </div>

        <div className="overflow-x-auto">
          <Table
            columns={columns}
            dataSource={brands}
            rowKey="id"
            loading={isLoading}
            scroll={{ x: 800 }}
            pagination={{
              pageSize: 10,
              showSizeChanger: true,
              showTotal: (total) => `Tổng cộng ${total} thương hiệu`,
            }}
          />
        </div>

        <Modal
          title={editingBrand ? 'Chỉnh sửa thương hiệu' : 'Thêm thương hiệu mới'}
          open={isModalVisible}
          onCancel={() => {
            setIsModalVisible(false);
            setEditingBrand(null);
            form.resetFields();
          }}
          footer={null}
          width={600}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSubmit}
          >
            <Form.Item
              name="name"
              label="Tên thương hiệu"
              rules={[
                { required: true, message: 'Vui lòng nhập tên thương hiệu!' },
              ]}
            >
              <Input placeholder="Nhập tên thương hiệu" />
            </Form.Item>

            <Form.Item
              name="description"
              label="Mô tả"
            >
              <TextArea
                rows={3}
                placeholder="Nhập mô tả thương hiệu"
              />
            </Form.Item>

            <Form.Item
              name="logo"
              label="Logo thương hiệu"
            >
              <ImageUpload
                type="brands"
                multiple={false}
                value={form.getFieldValue('logo')}
                onChange={(val) => form.setFieldsValue({ logo: val })}
              />
            </Form.Item>

            <Form.Item
              name="website"
              label="Website"
              rules={[
                { type: 'url', message: 'Vui lòng nhập URL hợp lệ!' },
              ]}
            >
              <Input placeholder="https://example.com" />
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
                {editingBrand ? 'Cập nhật' : 'Tạo mới'}
              </Button>
            </div>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

export default BrandsPage;
