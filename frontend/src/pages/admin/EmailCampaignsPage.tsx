import React, { useState, useEffect } from 'react';
import { Table, Button, Space, Modal, Form, Input, Card, Typography, message, Popconfirm, Tag } from 'antd';
import { PlusOutlined, SendOutlined, DeleteOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import apiClient from '@/services/apiClient';

const { Text } = Typography;

interface Campaign {
  id: string;
  subject: string;
  content: string;
  status: 'draft' | 'sent';
  sentAt: string | null;
  createdAt: string;
}

const EmailCampaignsPage: React.FC = () => {
  const { t } = useTranslation();
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
      message.error(t('emailCampaigns.fetchError'));
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
      message.success(t('emailCampaigns.deleteSuccess'));
      fetchCampaigns();
    } catch (error) {
      message.error(t('emailCampaigns.deleteError'));
    }
  };

  const handleSend = async (id: string) => {
    try {
      message.loading({ content: t('emailCampaigns.sending'), key: 'send_campaign' });
      await apiClient.post(`/email-campaigns/${id}/send`);
      message.success({ content: t('emailCampaigns.sendSuccess'), key: 'send_campaign' });
      fetchCampaigns();
    } catch (error) {
      message.error({ content: t('emailCampaigns.sendError'), key: 'send_campaign' });
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      await apiClient.post('/email-campaigns', values);
      message.success(t('emailCampaigns.createSuccess'));
      setIsModalVisible(false);
      fetchCampaigns();
    } catch (error) {
      message.error(t('emailCampaigns.createError'));
    }
  };

  const handlePreview = (campaign: Campaign) => {
    setSelectedCampaign(campaign);
    setIsPreviewVisible(true);
  };

  const columns = [
    {
      title: t('emailCampaigns.colSubject'),
      dataIndex: 'subject',
      key: 'subject',
    },
    {
      title: t('emailCampaigns.colStatus'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => (
        <Tag color={status === 'sent' ? 'green' : 'blue'}>
          {status.toUpperCase()}
        </Tag>
      ),
    },
    {
      title: t('emailCampaigns.colSentAt'),
      dataIndex: 'sentAt',
      key: 'sentAt',
      render: (date: string) => date ? new Date(date).toLocaleString() : '-',
    },
    {
      title: t('emailCampaigns.colCreatedAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString(),
    },
    {
      title: t('emailCampaigns.colAction'),
      key: 'action',
      render: (_: any, record: Campaign) => (
        <Space size="middle">
          <Button onClick={() => handlePreview(record)}>{t('emailCampaigns.preview')}</Button>
          {record.status === 'draft' && (
            <Popconfirm
              title={t('emailCampaigns.sendConfirm')}
              onConfirm={() => handleSend(record.id)}
              okText={t('emailCampaigns.yes')}
              cancelText={t('emailCampaigns.no')}
            >
              <Button type="primary" icon={<SendOutlined />}>
                {t('emailCampaigns.send')}
              </Button>
            </Popconfirm>
          )}
          <Popconfirm
            title={t('emailCampaigns.deleteConfirm')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('emailCampaigns.yes')}
            cancelText={t('emailCampaigns.no')}
          >
            <Button icon={<DeleteOutlined />} danger>
              {t('emailCampaigns.delete')}
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>{t('emailCampaigns.title')}</h2>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
          {t('emailCampaigns.create')}
        </Button>
      </div>

      <Table
        columns={columns}
        dataSource={campaigns}
        rowKey="id"
        loading={loading}
      />

      <Modal
        title={t('emailCampaigns.modalTitle')}
        open={isModalVisible}
        onOk={handleModalOk}
        onCancel={() => setIsModalVisible(false)}
        width={800}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="subject" label={t('emailCampaigns.subjectLabel')} rules={[{ required: true }]}>
            <Input placeholder={t('emailCampaigns.subjectPlaceholder')} />
          </Form.Item>
          <Form.Item name="content" label={t('emailCampaigns.contentLabel')} rules={[{ required: true }]}>
            <Input.TextArea rows={10} placeholder={t('emailCampaigns.contentPlaceholder')} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={t('emailCampaigns.previewTitle')}
        open={isPreviewVisible}
        onCancel={() => setIsPreviewVisible(false)}
        footer={null}
        width={800}
      >
        {selectedCampaign && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <Text strong>{t('emailCampaigns.subjectPrefix')}</Text>
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
