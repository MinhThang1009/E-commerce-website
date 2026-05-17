import React, { useState } from 'react';
import {
  Table,
  Button,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  message,
  Popconfirm,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import {
  useGetBannersQuery,
  useCreateBannerMutation,
  useUpdateBannerMutation,
  useDeleteBannerMutation,
  Banner,
} from '../../api/bannerApi';
import ImageUpload from '@/components/common/ImageUpload';
import { getUploadUrl } from '@/utils/uploadUrl';

const BannersPage: React.FC = () => {
  const { t } = useTranslation();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useGetBannersQuery();
  const { mutateAsync: createBanner } = useCreateBannerMutation();
  const { mutateAsync: updateBanner } = useUpdateBannerMutation();
  const { mutateAsync: deleteBanner } = useDeleteBannerMutation();

  const banners = data?.data ?? [];

  const handleCreate = () => {
    setEditingBanner(null);
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleEdit = (banner: Banner) => {
    setEditingBanner(banner);
    form.setFieldsValue(banner);
    setIsModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBanner(id);
      message.success(t('admin.banners.messages.deleteSuccess'));
    } catch {
      message.error(t('admin.banners.messages.deleteError'));
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingBanner) {
        await updateBanner({ id: editingBanner.id, ...values });
        message.success(t('admin.banners.messages.editSuccess'));
      } else {
        await createBanner(values);
        message.success(t('admin.banners.messages.createSuccess'));
      }
      setIsModalVisible(false);
    } catch {
      message.error(t('admin.banners.messages.saveError'));
    }
  };

  const columns = [
    {
      title: t('admin.banners.table.title'),
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: t('admin.banners.table.image'),
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      render: (url: string) => {
        const fullUrl = getUploadUrl(url);
        return (
          <img
            src={fullUrl}
            alt={t('admin.banners.table.image')}
            style={{ width: 100, borderRadius: 4 }}
          />
        );
      },
    },
    {
      title: t('admin.banners.table.position'),
      dataIndex: 'position',
      key: 'position',
      render: (pos: string) => {
        const colors: Record<string, string> = {
          home_hero: 'blue',
          home_middle: 'green',
          sidebar: 'orange',
        };
        const labels: Record<string, string> = {
          home_hero: t('admin.banners.positions.homeHero'),
          home_middle: t('admin.banners.positions.homeMiddle'),
          sidebar: t('admin.banners.positions.sidebar'),
        };
        return <span style={{ color: colors[pos] || 'black' }}>{labels[pos] || pos}</span>;
      },
    },
    {
      title: t('admin.banners.table.active'),
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active: boolean) => (active ? '✅' : '❌'),
    },
    {
      title: t('admin.banners.table.priority'),
      dataIndex: 'priority',
      key: 'priority',
    },
    {
      title: t('admin.common.actions'),
      key: 'action',
      render: (_: unknown, record: Banner) => (
        <Space size="middle">
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            {t('common.edit')}
          </Button>
          <Popconfirm
            title={t('admin.banners.deleteConfirm')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('common.delete')}
            cancelText={t('common.cancel')}
            okButtonProps={{ danger: true }}
          >
            <Button icon={<DeleteOutlined />} danger>
              {t('common.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>{t('admin.banners.title')}</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          {t('admin.banners.createBanner')}
        </Button>
      </div>

      <Table columns={columns} dataSource={banners} rowKey="id" loading={isLoading} />

      <Modal
        title={editingBanner ? t('admin.banners.editBanner') : t('admin.banners.createBannerModal')}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
        okText={editingBanner ? t('common.update') : t('common.create')}
        cancelText={t('common.cancel')}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            name="titleVi"
            label={`${t('admin.banners.form.title')} (VI)`}
            rules={[{ required: true, message: t('admin.banners.form.titleRequired') }]}
          >
            <Input />
          </Form.Item>
          <Form.Item name="titleEn" label={`${t('admin.banners.form.title')} (EN)`}>
            <Input placeholder="Banner title in English" />
          </Form.Item>
          <Form.Item
            name="imageUrl"
            label={t('admin.banners.form.imageUrl')}
            rules={[{ required: true, message: t('admin.banners.form.imageRequired') }]}
          >
            <ImageUpload
              type="banners"
              multiple={false}
              value={form.getFieldValue('imageUrl')}
              onChange={(val) => form.setFieldsValue({ imageUrl: val })}
            />
          </Form.Item>
          <Form.Item name="linkUrl" label={t('admin.banners.form.linkUrl')}>
            <Input placeholder={t('admin.banners.form.linkPlaceholder')} />
          </Form.Item>
          <Form.Item
            name="position"
            label={t('admin.banners.form.position')}
            rules={[{ required: true, message: t('admin.banners.form.positionRequired') }]}
          >
            <Select>
              <Select.Option value="home_hero">
                {t('admin.banners.positions.homeHero')}
              </Select.Option>
              <Select.Option value="home_middle">
                {t('admin.banners.positions.homeMiddle')}
              </Select.Option>
              <Select.Option value="sidebar">{t('admin.banners.positions.sidebar')}</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item
            name="isActive"
            label={t('admin.banners.form.isActive')}
            valuePropName="checked"
            initialValue={true}
          >
            <Switch />
          </Form.Item>
          <Form.Item name="priority" label={t('admin.banners.form.priority')} initialValue={0}>
            <Input type="number" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BannersPage;
