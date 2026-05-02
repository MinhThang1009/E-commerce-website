import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Card, List, Typography, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, SendOutlined, DeleteOutlined } from '@ant-design/icons';
import apiClient from '@/services/apiClient';

const { Title, Text } = Typography;

interface Campaign {
  id: string;
  subject: string;
  content: string;
  status: 'draft' | 'sent';
  sentAt: string | null;
  createdAt: string;
}

const EmailCampaignsPage: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [isPreviewVisible, setIsPreviewVisible] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  const [form] = Form.useForm();

  const fetchCampaigns = async () => {
    setLoading(true);
    try {
      const response = await apiClient.get('/email-campaigns');
      setCampaigns(response.data.data);
    } catch (error) {
      message.error('Failed to fetch campaigns');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const handleCreate = () => {
    form.resetFields();
    setIsModalVisible(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await apiClient.delete(`/email-campaigns/${id}`);
      message.success('Campaign deleted successfully');
      fetchCampaigns();
    } catch (error) {
      message.error('Failed to delete campaign');
    }
  };

  const handleSend = async (id: string) => {
    try {
      message.loading({ content: 'Sending campaign...', key: 'send_campaign' });
      await apiClient.post(`/email-campaigns/${id}/send`);
      message.success({ content: 'Campaign sent successfully!', key: 'send_campaign' });
      fetchCampaigns();
    } catch (error) {
      message.error({ content: 'Failed to send campaign', key: 'send_campaign' });
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      await apiClient.post('/email-campaigns', values);
      message.success('Campaign created successfully');
      setIsModalVisible(false);
      fetchCampaigns();
    } catch (error) {
      message.error('Failed to create campaign');
    }
  };

  const handlePreview = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setIsPreviewVisible(true);
  };

  const columns = [
    {
      title: 'Subject',
      dataIndex: 'subject',
      key: 'subject',
    },
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'sent' ? 'green' : 'blue'}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: 'Sent At',
      dataIndex: 'sentAt',
      key: 'sentAt',
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: 'Created At',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: 'Action',
      key: 'action',
      render: (_: any, record: Campaign) => (
        <Space size="middle">
          <Button onClick={() => handlePreview(record)}>Preview</Button>
          {record.status === 'draft' && (
            <Popconfirm
              title="Send this campaign to all subscribers?"
              onConfirm={() => handleSend(record.id)}
              okText="Yes"
              cancelText="No"
            >
              <Button type="primary" icon={<SendOutlined />}>
                Send
              </Button>
            </Popconfirm>
          )}
          <Popconfirm
            title="Are you sure to delete this campaign?"
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
        <h2>Email Campaigns</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          Create Campaign
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={campaigns}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title="Create Email Campaign"
        visible={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
        width={800}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="subject" label="Subject" rules={[{ required: true }]}>
            <Input placeholder="Enter email subject" />
          </Form.Item>
          <Form.Item name="content" label="HTML Content" rules={[{ required: true }]}>
            <Input.TextArea rows={10} placeholder="Enter email content (HTML allowed)" />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="Campaign Preview"
        visible={isPreviewVisible}
        onCancel={() => setIsPreviewVisible(false)}
        footer={null}
        width={800}
      >
        {selectedCampaign && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>Subject: </Text>
              <Text>{selectedCampaign.subject}</Text>
            </div>
            <Card>
              <div dangerouslySetInnerHTML={{ __html: selectedCampaign.content }} />
            </Card>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default EmailCampaignsPage;
