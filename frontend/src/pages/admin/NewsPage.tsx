import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useGetNewsQuery, useDeleteNewsMutation } from '@/services/newsApi';
import {
  Table, Button, Input, Select, Card, Space, Tag, Pagination, Row, Col, Typography, Image, Popconfirm, message, Spin, Alert,
} from 'antd';
import { PlusOutlined, SearchOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons';

const { Title } = Typography;

const NewsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  const { data: newsResponse, error, isLoading, refetch } = useGetNewsQuery({
    page: currentPage,
    limit: 10,
    search: searchTerm || undefined,
    isPublished: statusFilter !== 'all' ? (statusFilter === 'published') : undefined,
  });

  const [deleteNews] = useDeleteNewsMutation();

  const newsList = newsResponse?.news || [];
  const totalItems = newsResponse?.count || 0;
  const totalPages = newsResponse?.totalPages || 0;

  const handleDelete = async (id: string) => {
    try {
      await deleteNews(id).unwrap();
      message.success(t('admin.news.messages.deleteSuccess'));
      refetch();
    } catch (error) {
      message.error(t('admin.news.messages.deleteError'));
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => { setCurrentPage(1); }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, statusFilter]);

  const columns = [
    {
      title: t('admin.news.table.image') || t('admin.categories.table.image'),
      dataIndex: 'thumbnail',
      key: 'thumbnail',
      width: 80,
      render: (thumbnail: string) => (
        <Image width={50} height={50} src={thumbnail || '/placeholder-image.jpg'} alt={t('admin.news.form.thumbnail')}
          style={{ objectFit: 'cover', borderRadius: 4 }} fallback="/placeholder-image.jpg" />
      ),
    },
    {
      title: t('admin.news.table.title'),
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => <div style={{ fontWeight: 500 }}>{text}</div>,
    },
    {
      title: t('admin.news.table.slug'),
      dataIndex: 'slug',
      key: 'slug',
    },
    {
      title: t('admin.news.table.category'),
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => <Tag color="blue">{category || t('admin.news.status.published')}</Tag>,
    },
    {
      title: t('admin.news.table.views'),
      dataIndex: 'viewCount',
      key: 'viewCount',
      width: 100,
      render: (count: number) => count || 0,
    },
    {
      title: t('common.status'),
      dataIndex: 'isPublished',
      key: 'isPublished',
      render: (isPublished: boolean) => (
        <Tag color={isPublished ? 'green' : 'orange'}>
          {isPublished ? t('admin.news.status.published') : t('admin.news.status.draft')}
        </Tag>
      ),
    },
    {
      title: t('admin.news.table.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
    },
    {
      title: t('admin.common.actions'),
      key: 'actions',
      width: 150,
      render: (_: any, record: any) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} onClick={() => navigate(`/admin/news/edit/${record.id}`)} size="small" />
          <Popconfirm
            title={t('admin.news.deleteTitle')}
            description={t('admin.news.deleteConfirm')}
            onConfirm={() => handleDelete(record.id)}
            okText={t('common.delete')}
            cancelText={t('common.cancel')}
            okButtonProps={{ danger: true }}
          >
            <Button type="link" danger icon={<DeleteOutlined />} size="small" />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message={t('common.error')}
          description={t('admin.news.messages.loadError')}
          type="error"
          showIcon
        />
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 md:p-6">
      <Card className="mb-4 md:mb-6">
        <Row justify="space-between" align="middle" gutter={[16, 16]}>
          <Col xs={24} sm={12}>
            <Title level={2} className="text-xl md:text-2xl" style={{ margin: 0 }}>
              {t('admin.news.title')}
            </Title>
            <p className="mt-2 text-sm text-neutral-600">
              {t('admin.news.pageStats', { total: totalItems, pages: totalPages })}
            </p>
          </Col>
          <Col xs={24} sm={12} className="flex justify-start sm:justify-end">
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/admin/news/create')} size="large">
              {t('admin.news.addArticle')}
            </Button>
          </Col>
        </Row>
      </Card>

      <Card className="mb-4">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Input
              placeholder={t('admin.news.searchPlaceholder') || t('admin.common.search')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              allowClear
              suffix={<SearchOutlined />}
            />
          </Col>
          <Col xs={24} md={8}>
            <Select
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={setStatusFilter}
              options={[
                { value: 'all', label: t('common.all') },
                { value: 'published', label: t('admin.news.status.published') },
                { value: 'draft', label: t('admin.news.status.draft') },
              ]}
            />
          </Col>
        </Row>
      </Card>

      <Card>
        <Spin spinning={isLoading}>
          <Table columns={columns} dataSource={newsList} rowKey="id" pagination={false} scroll={{ x: 800 }} />
        </Spin>
        {totalItems > 0 && (
          <div className="mt-4 text-center">
            <Pagination current={currentPage} total={totalItems} pageSize={10} onChange={setCurrentPage} />
          </div>
        )}
      </Card>
    </div>
  );
};

export default NewsPage;
