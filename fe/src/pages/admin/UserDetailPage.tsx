import React from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  Card,
  Row,
  Col,
  Typography,
  Descriptions,
  Tag,
  Avatar,
  Table,
  Button,
  Space,
  Empty,
  Tabs,
  Timeline,
  Statistic,
  Divider,
} from 'antd';
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  CalendarOutlined,
  HistoryOutlined,
  EnvironmentOutlined,
  ShoppingOutlined,
  ArrowLeftOutlined,
  CrownOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useGetUserByIdQuery } from '@/services/adminUserApi';
import LoadingSpinner from '@/components/common/LoadingSpinner';

const { Title, Text } = Typography;

const UserDetailPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { data: userData, isLoading, error } = useGetUserByIdQuery(id || '');

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (error || !userData) {
    return (
      <div className="p-6">
        <Empty description="Không tìm thấy người dùng hoặc có lỗi xảy ra" />
        <div className="text-center mt-4">
          <Link to="/admin/users">
            <Button icon={<ArrowLeftOutlined />}>Quay lại danh sách</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { user } = userData.data;

  // Role details
  const getRoleTag = (role: string) => {
    switch (role) {
      case 'admin':
        return <Tag color="red" icon={<CrownOutlined />}>Quản trị viên</Tag>;
      case 'manager':
        return <Tag color="orange" icon={<TeamOutlined />}>Quản lý</Tag>;
      case 'customer':
        return <Tag color="blue" icon={<UserOutlined />}>Khách hàng</Tag>;
      default:
        return <Tag>{role}</Tag>;
    }
  };

  // Order columns
  const orderColumns = [
    {
      title: 'Mã đơn',
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      render: (text: string, record: any) => (
        <Link to={`/admin/orders/${record.id}`} className="font-medium">
          #{text || record.id.substring(0, 8)}
        </Link>
      ),
    },
    {
      title: 'Ngày đặt',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString('vi-VN'),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        if (status === 'delivered') color = 'success';
        if (status === 'pending') color = 'processing';
        if (status === 'cancelled') color = 'error';
        return <Tag color={color}>{status === 'delivered' ? 'Đã giao' : status === 'pending' ? 'Chờ xử lý' : status}</Tag>;
      },
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'total',
      key: 'total',
      render: (total: number) => (
        <Text strong>{total.toLocaleString('vi-VN')}đ</Text>
      ),
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        {/* Header */}
        <div className="flex items-center justify-between">
          <Space>
            <Link to="/admin/users">
              <Button icon={<ArrowLeftOutlined />} type="text" />
            </Link>
            <div>
              <Title level={3} style={{ margin: 0 }}>
                Chi tiết khách hàng
              </Title>
              <Text type="secondary">Xem chi tiết thông tin và lịch sử hoạt động</Text>
            </div>
          </Space>
          {/* <div className="space-x-2">
             <Link to={`/admin/users/edit/${user.id}`}>
               <Button type="primary">Chỉnh sửa</Button>
             </Link>
          </div> */}
        </div>

        <Row gutter={[24, 24]}>
          {/* Left Column: Profile Card */}
          <Col xs={24} lg={8}>
            <Card
              className="text-center shadow-sm"
              cover={
                <div className="h-24 bg-gradient-to-r from-primary-500 to-blue-600 rounded-t-lg" />
              }
            >
              <div className="-mt-12 mb-4">
                <Avatar
                  size={100}
                  src={user.avatar}
                  icon={<UserOutlined />}
                  className="border-4 border-white shadow-md bg-white"
                />
              </div>
              <Title level={4} style={{ marginBottom: 4 }}>
                {user.firstName} {user.lastName}
              </Title>
              <div className="mb-4">{getRoleTag(user.role)}</div>

              <Divider />

              <Row gutter={16}>
                <Col span={12}>
                  <Statistic
                    title="Đơn hàng"
                    value={user.orders?.length || 0}
                    prefix={<ShoppingOutlined />}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title="Điểm"
                    value={user.loyaltyPoints || 0}
                    valueStyle={{ color: '#faad14' }}
                  />
                </Col>
              </Row>

              <Divider />

              <Descriptions column={1} size="small" colon={false}>
                <Descriptions.Item label={<MailOutlined />}>
                  {user.email}
                </Descriptions.Item>
                <Descriptions.Item label={<PhoneOutlined />}>
                  {user.phone || 'Chưa cập nhật'}
                </Descriptions.Item>
                <Descriptions.Item label={<CalendarOutlined />}>
                  Tham gia: {new Date(user.createdAt).toLocaleDateString('vi-VN')}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title="Trạng thái tài khoản" className="mt-6 shadow-sm">
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Hoạt động">
                  {user.isActive ?
                    <Tag color="success" icon={<CheckCircleOutlined />}>Đang hoạt động</Tag> :
                    <Tag color="error" icon={<CloseCircleOutlined />}>Bị khóa</Tag>
                  }
                </Descriptions.Item>
                <Descriptions.Item label="Xác minh email">
                  {user.isEmailVerified ?
                    <Tag color="success">Đã xác minh</Tag> :
                    <Tag color="warning">Chưa xác minh</Tag>
                  }
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          {/* Right Column: Activities, Orders, Addresses */}
          <Col xs={24} lg={16}>
            <Tabs
              defaultActiveKey="orders"
              className="bg-white p-4 rounded-lg shadow-sm"
              items={[
                {
                  key: 'orders',
                  label: (
                    <span>
                      <ShoppingOutlined /> Lịch sử đơn hàng
                    </span>
                  ),
                  children: (
                    <Table
                      dataSource={user.orders}
                      columns={orderColumns}
                      rowKey="id"
                      pagination={false}
                      locale={{ emptyText: 'Chưa có đơn hàng nào' }}
                    />
                  ),
                },
                {
                  key: 'addresses',
                  label: (
                    <span>
                      <EnvironmentOutlined /> Sổ địa chỉ
                    </span>
                  ),
                  children: (
                    <Row gutter={[16, 16]}>
                      {user.addresses?.length > 0 ? (
                        user.addresses.map((addr: any) => (
                          <Col span={12} key={addr.id}>
                            <Card size="small" className="h-full border-neutral-200">
                              <div className="flex justify-between items-start">
                                <Text strong>{addr.firstName} {addr.lastName}</Text>
                                {addr.isDefault && <Tag color="blue">Mặc định</Tag>}
                              </div>
                              <div className="mt-2 text-sm text-neutral-600">
                                <p>{addr.phone}</p>
                                <p>{addr.addressLine1}</p>
                                {addr.addressLine2 && <p>{addr.addressLine2}</p>}
                                <p>{addr.city}, {addr.state} {addr.zipCode}</p>
                                <p>{addr.country}</p>
                              </div>
                            </Card>
                          </Col>
                        ))
                      ) : (
                        <Col span={24}>
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có địa chỉ nào" />
                        </Col>
                      )}
                    </Row>
                  ),
                },
                {
                  key: 'activity',
                  label: (
                    <span>
                      <HistoryOutlined /> Hoạt động gần đây
                    </span>
                  ),
                  children: (
                    <Timeline
                      className="mt-4"
                      items={[
                        ...(user.loyaltyHistories || []).map((h: any) => ({
                          color: h.type === 'earn' ? 'green' : 'gold',
                          date: new Date(h.createdAt),
                          children: `${new Date(h.createdAt).toLocaleString('vi-VN')}: ${h.type === 'earn' ? 'Tích' : 'Dùng'} ${h.points} điểm - ${h.description || 'N/A'}`,
                        })),
                        ...(user.searchHistories || []).map((s: any) => ({
                          color: 'blue',
                          date: new Date(s.createdAt),
                          children: `${new Date(s.createdAt).toLocaleString('vi-VN')}: Tìm kiếm từ khóa "${s.keyword || s.query || 'N/A'}"`,
                        })),
                      ]
                        .sort((a: any, b: any) => b.date.getTime() - a.date.getTime())
                        .map(({ date, ...rest }) => rest)
                      }
                    />
                  ),
                },
              ]}
            />
          </Col>
        </Row>
      </Space>
    </div>
  );
};

export default UserDetailPage;
