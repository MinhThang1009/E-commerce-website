import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Select, Switch, message, Upload, Popconfirm } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, UploadOutlined } from '@ant-design/icons';
import apiClient from '@/services/apiClient';
import ImageUpload from '@/components/common/ImageUpload';

interface Banner {
  id: string;
  title: string;
  imageUrl: string;
  linkUrl: string;
  position: 'home_hero' | 'home_middle' | 'sidebar';
  isActive: boolean;
  priority: number;
}

const BannersPage: React.FC = () => {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [form] = Form.useForm();

  const fetchBanners = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/banners');
      setBanners(response.data.data);
    } catch (error) {
      message.error('Failed to fetch banners');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

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
      await apiClient.delete(`/banners/${id}`);
      message.success('Banner deleted successfully');
      fetchBanners();
    } catch (error) {
      message.error('Failed to delete banner');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      if (editingBanner) {
        await apiClient.patch(`/banners/${editingBanner.id}`, values);
        message.success('Banner updated successfully');
      } else {
        await apiClient.post('/banners', values);
        message.success('Banner created successfully');
      }
      setIsModalVisible(false);
      fetchBanners();
    } catch (error) {
      message.error('Failed to save banner');
    }
  };

  const columns = [
    {
      title: 'Title',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: 'Image',
      dataIndex: 'imageUrl',
      key: 'imageUrl',
      render: (url: string) => {
        const fullUrl = url?.startsWith('http') ? url : `${import.meta.env.VITE_API_URL || 'http://localhost:8888'}${url?.startsWith('/') ? '' : '/'}${url}`;
        return <img src={fullUrl} alt="Banner" style={{ width: 100, borderRadius: 4 }} />;
      },
    },
    {
      title: 'Position',
      dataIndex: 'position',
      key: 'position',
      render: (pos: string) => {
        const colors: Record<string, string> = {
          home_hero: 'blue',
          home_middle: 'green',
          sidebar: 'orange',
        };
        return <span style={{ color: colors[pos] || 'black' }}>{pos}</span>;
      },
    },
    {
      title: 'Active',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (active: boolean) => (active ? '✅' : '❌'),
    },
    {
      title: 'Priority',
      dataIndex: 'priority',
      key: 'priority',
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: Banner) => (
        <Space size="middle">
          <Button icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            Edit
          </Button>
          <Popconfirm
            title="Are you sure to delete this banner?"
            onConfirm={() => handleDelete(record.id)}
            okText="Yes"
            cancelText="No"
          >
            <Button icon={<DeleteOutlined />} danger>
              Delete
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>Banner Management</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Create Banner
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={banners}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title={editingBanner ? 'Edit Banner' : 'Create Banner'}
        visible={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="title" label="Title" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="imageUrl" label="Hình ảnh Banner" rules={[{ required: true, message: 'Vui lòng tải ảnh lên' }]}>
            <ImageUpload 
              type="banners" 
              multiple={false} 
              value={form.getFieldValue('imageUrl')}
              onChange={(val) => form.setFieldsValue({ imageUrl: val })}
            />
          </Form.Item>
          <Form.Item name="linkUrl" label="Link URL">
            <Input placeholder="Enter destination URL" />
          </Form.Item>
          <Form.Item name="position" label="Position" rules={[{ required: true }]}>
            <Select>
              <Select.Option value="home_hero">Home Hero</Select.Option>
              <Select.Option value="home_middle">Home Middle</Select.Option>
              <Select.Option value="sidebar">Sidebar</Select.Option>
            </Select>
          </Form.Item>
          <Form.Item name="isActive" label="Is Active" valuePropName="checked" initialValue={true}>
            <Switch />
          </Form.Item>
          <Form.Item name="priority" label="Priority" initialValue={0}>
            <Input type="number" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default BannersPage;
