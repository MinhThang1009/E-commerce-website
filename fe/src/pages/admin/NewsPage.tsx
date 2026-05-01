import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  useGetNewsQuery,
  useDeleteNewsMutation,
} from '@/services/newsApi';
import {
  Table,
  Button,
  Input,
  Select,
  Card,
  Space,
  Tag,
  Pagination,
  Row,
  Col,
  Typography,
  Image,
  Popconfirm,
  message,
  Spin,
  Alert,
} from 'antd';
import {
  PlusOutlined,
  SearchOutlined,
  EditOutlined,
  DeleteOutlined,
} from '@ant-design/icons';

const { Title } = Typography;

const NewsPage: React.FC = () => {
  const navigate = useNavigate();

  // State for filters
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [currentPage, setCurrentPage] = useState(1);

  // API queries
  const {
    data: newsResponse,
    error,
    isLoading,
    refetch,
  } = useGetNewsQuery({
    page: currentPage,
    limit: 10,
    search: searchTerm || undefined,
    isPublished: statusFilter !== 'all' ? (statusFilter === 'published') : undefined,
  });

  const [deleteNews, { isLoading: isDeleting }] = useDeleteNewsMutation();

  const newsList = newsResponse?.news || [];
  const totalItems = newsResponse?.count || 0;
  const totalPages = newsResponse?.totalPages || 0;

  // Handle delete
  const handleDelete = async (id: string) => {
    try {
      await deleteNews(id).unwrap();
      message.success('Xóa bài viết thành công');
      refetch();
    } catch (error) {
      message.error('Xóa bài viết thất bại');
      console.error('Failed to delete news:', error);
    }
  };

  // Debounce search
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, statusFilter]);

  const columns = [
    {
      title: 'Hình ảnh',
      dataIndex: 'thumbnail',
      key: 'thumbnail',
      width: 80,
      render: (thumbnail: string) => (
        <Image
          width={50}
          height={50}
          src={thumbnail || '/placeholder-image.jpg'}
          alt="Thumbnail"
          style={{ objectFit: 'cover', borderRadius: 4 }}
          fallback="/placeholder-image.jpg"
        />
      ),
    },
    {
      title: 'Tiêu đề',
      dataIndex: 'title',
      key: 'title',
      render: (text: string) => (
        <div style={{ fontWeight: 500 }}>{text}</div>
      ),
    },
    {
      title: 'Slug',
      dataIndex: 'slug',
      key: 'slug',
    },
    {
      title: 'Chuyên mục',
      dataIndex: 'category',
      key: 'category',
      render: (category: string) => (
        <Tag color="blue">{category || 'Tin tức'}</Tag>
      ),
    },
    {
      title: 'Lượt xem',
      dataIndex: 'viewCount',
      key: 'viewCount',
      width: 100,
      render: (count: number) => count || 0,
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isPublished',
      key: 'isPublished',
      render: (isPublished: boolean) => (
        <Tag color={isPublished ? 'green' : 'orange'}>
          {isPublished ? 'Đã xuất bản' : 'Bản nháp'}
        </Tag>
      ),
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 150,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => navigate(`/admin/news/edit/${record.id}`)}
            size="small"
          />
          <Popconfirm
            title="Xóa bài viết"
            description="Bạn có chắc chắn muốn xóa bài viết này?"
            onConfirm={() => handleDelete(record.id)}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
            />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  if (error) {
    return (
      <div style={{ padding: 24 }}>
        <Alert
          message="Lỗi tải dữ liệu"
          description="Không thể tải danh sách tin tức."
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
              Quản lý Tin tức
            </Title>
            <p className="mt-2 text-sm text-neutral-600">
              {totalItems} bài viết • {totalPages} trang
            </p>
          </Col>
          <Col xs={24} sm={12} className="flex justify-start sm:justify-end">
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/admin/news/create')}
              size="large"
            >
              Thêm bài viết
            </Button>
          </Col>
        </Row>
      </Card>

      <Card className="mb-4">
        <Row gutter={[16, 16]}>
          <Col xs={24} md={12}>
            <Input
              placeholder="Tìm kiếm tiêu đề..."
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
                { value: 'all', label: 'Tất cả trạng thái' },
                { value: 'published', label: 'Đã xuất bản' },
                { value: 'draft', label: 'Bản nháp' },
              ]}
            />
          </Col>
        </Row>
      </Card>

      <Card>
        <Spin spinning={isLoading}>
          <Table
            columns={columns}
            dataSource={newsList}
            rowKey="id"
            pagination={false}
            scroll={{ x: 800 }}
          />
        </Spin>
        {totalItems > 0 && (
          <div className="mt-4 text-center">
            <Pagination
              current={currentPage}
              total={totalItems}
              pageSize={10}
              onChange={setCurrentPage}
            />
          </div>
        )}
      </Card>
    </div>
  );
};

export default NewsPage;
