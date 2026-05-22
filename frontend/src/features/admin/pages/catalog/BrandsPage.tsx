/**
 * @file BrandsPage.tsx
 * @layer Page
 * @feature catalog
 * @description Page component của feature catalog
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Switch,
  Space,
  Popconfirm,
  Tag,
  Image,
  Card,
  Typography,
} from 'antd';
import { useAntdToast } from '@/hooks/use-antd-toast';
import { useTranslation } from 'react-i18next';
import ImageUpload from '@/components/common/ImageUpload';
import { getUploadUrl } from '@/utils/upload-url';
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
} from '@features/catalog/api/brand-api';
import { getErrorMsg } from '@/utils/error-utils';

const { Title } = Typography;
const { TextArea } = Input;

interface BrandFormData {
  name: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  isActive: boolean;
}

const BrandsPage: React.FC = () => {
  const { t } = useTranslation();
  const { success: toastSuccess, error: toastError, contextHolder } = useAntdToast();
  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingBrand, setEditingBrand] = useState<any>(null);
  const [_fileList, setFileList] = useState<unknown[]>([]);

  const { data: brandsData, isLoading, refetch } = useGetBrandsQuery();
  const { mutateAsync: createBrand, isPending: isCreating } = useCreateBrandMutation();
  const { mutateAsync: updateBrand, isPending: isUpdating } = useUpdateBrandMutation();
  const { mutateAsync: deleteBrand, isPending: _isDeleting } = useDeleteBrandMutation();

  const brands = brandsData?.data || [];

  const handleSubmit = async (values: BrandFormData) => {
    try {
      if (editingBrand) {
        await updateBrand({ id: editingBrand.id, body: values });
        toastSuccess(t('admin.brands.messages.editSuccess'));
      } else {
        await createBrand(values);
        toastSuccess(t('admin.brands.messages.addSuccess'));
      }
      setIsModalVisible(false);
      setEditingBrand(null);
      form.resetFields();
      setFileList([]);
      refetch();
    } catch (error) {
      toastError(getErrorMsg(error, t('common.errorOccurred')));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBrand(id);
      toastSuccess(t('admin.brands.messages.deleteSuccess'));
      refetch();
    } catch (error) {
      toastError(getErrorMsg(error, t('admin.brands.messages.deleteError')));
    }
  };

  const handleCreate = () => {
    setEditingBrand(null);
    setIsModalVisible(true);
    form.resetFields();
    setFileList([]);
    form.setFieldsValue({ isActive: true });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Brand API response fields
  const handleEdit = (brand: any) => {
    setEditingBrand(brand);
    setIsModalVisible(true);
    form.setFieldsValue({
      name: brand.name,
      description: brand.description,
      logoUrl: brand.logoUrl,
      website: brand.website,
      isActive: brand.isActive,
    });
    if (brand.logoUrl) {
      setFileList([{ uid: '-1', name: 'logo', status: 'done', url: brand.logoUrl }]);
    } else {
      setFileList([]);
    }
  };

  const columns = [
    {
      title: t('admin.brands.table.logo'),
      dataIndex: 'logoUrl',
      key: 'logoUrl',
      width: 80,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render: (logo: string, record: any) => {
        const fullLogoUrl = getUploadUrl(logo);
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
      title: t('admin.brands.table.name'),
      dataIndex: 'name',
      key: 'name',
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render: (name: string, record: any) => (
        <div>
          <div className="font-medium">{name}</div>
          <div className="text-sm text-gray-500">{record.slug}</div>
        </div>
      ),
    },
    {
      title: t('admin.brands.table.website') || 'Website',
      dataIndex: 'website',
      key: 'website',
      render: (website: string) =>
        website ? (
          <a
            href={website}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1"
          >
            <GlobalOutlined /> {new URL(website).hostname}
          </a>
        ) : (
          <span className="text-gray-400">—</span>
        ),
    },
    {
      title: t('admin.brands.table.status'),
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'error'}>
          {isActive ? t('common.active') : t('admin.common.hidden')}
        </Tag>
      ),
    },
    {
      title: t('admin.brands.table.actions'),
      key: 'actions',
      width: 120,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      render: (_: unknown, record: any) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
            size="small"
          />
          <Popconfirm
            title={t('admin.brands.deleteTitle')}
            description={t('admin.brands.deleteConfirm')}
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
      {contextHolder}
      <Card className="dark:bg-neutral-800">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <div>
            <Title level={2} className="!mb-1 text-xl md:text-2xl dark:text-white">
              {t('admin.brands.title')}
            </Title>
            <p className="text-neutral-600 dark:text-neutral-400">{t('admin.brands.subtitle')}</p>
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
              {t('admin.brands.addBrand')}
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
              showTotal: (total) => t('admin.brands.totalItems', { total }),
            }}
          />
        </div>

        <Modal
          title={editingBrand ? t('admin.brands.editBrand') : t('admin.brands.addBrandModal')}
          open={isModalVisible}
          onCancel={() => {
            setIsModalVisible(false);
            setEditingBrand(null);
            form.resetFields();
          }}
          footer={null}
          width={600}
          forceRender
        >
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Form.Item
              name="name"
              label={t('admin.brands.form.name')}
              rules={[{ required: true, message: t('admin.brands.form.nameRequired') }]}
            >
              <Input placeholder={t('admin.brands.form.namePlaceholder')} />
            </Form.Item>

            <Form.Item name="description" label={t('admin.brands.form.description')}>
              <TextArea rows={3} placeholder={t('admin.brands.form.descriptionPlaceholder')} />
            </Form.Item>

            <Form.Item name="logoUrl" label={t('admin.brands.form.logo')}>
              <ImageUpload
                type="brands"
                multiple={false}
                value={form.getFieldValue('logoUrl')}
                onChange={(val) => form.setFieldsValue({ logoUrl: val })}
              />
            </Form.Item>

            <Form.Item
              name="website"
              label={t('admin.brands.form.website')}
              rules={[{ type: 'url', message: t('admin.brands.form.websiteInvalid') }]}
            >
              <Input placeholder={t('admin.brands.form.websitePlaceholder')} />
            </Form.Item>

            <Form.Item name="isActive" label={t('common.status')} valuePropName="checked">
              <Switch
                checkedChildren={t('common.active')}
                unCheckedChildren={t('admin.common.hidden')}
              />
            </Form.Item>

            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={() => setIsModalVisible(false)}>{t('common.cancel')}</Button>
              <Button type="primary" htmlType="submit" loading={isCreating || isUpdating}>
                {editingBrand ? t('common.update') : t('common.create')}
              </Button>
            </div>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

export default BrandsPage;
