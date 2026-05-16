import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ROUTES, buildRoute } from '@/routes/paths';
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
import { useTranslation } from 'react-i18next';
import { useGetUserByIdQuery } from '../api/adminUserApi';
import LoadingSpinner from '@/components/common/LoadingSpinner';

const { Title, Text } = Typography;

const UserDetailPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const { data: userData, isLoading, error } = useGetUserByIdQuery(id || '');

  if (isLoading) return <LoadingSpinner fullScreen />;
  if (error || !userData) {
    return (
      <div className="p-6">
        <Empty description={t('admin.userDetail.notFound')} />
        <div className="text-center mt-4">
          <Link to={ROUTES.ADMIN_USERS}>
            <Button icon={<ArrowLeftOutlined />}>{t('admin.userDetail.backToList')}</Button>
          </Link>
        </div>
      </div>
    );
  }

  const { user } = userData.data;

  const getRoleTag = (role: string) => {
    switch (role) {
      case 'admin':
        return <Tag color="red" icon={<CrownOutlined />}>{t('admin.users.roles.admin')}</Tag>;
      case 'manager':
        return <Tag color="orange" icon={<TeamOutlined />}>{t('admin.users.roles.manager')}</Tag>;
      case 'customer':
        return <Tag color="blue" icon={<UserOutlined />}>{t('admin.users.roles.customer')}</Tag>;
      default:
        return <Tag>{role}</Tag>;
    }
  };

  const orderColumns = [
    {
      title: t('admin.userDetail.orderColumns.code'),
      dataIndex: 'orderNumber',
      key: 'orderNumber',
      render: (text: string, record: any) => (
        <Link to={buildRoute.adminOrderDetail(record.id)} className="font-medium">
          #{text || record.id.substring(0, 8)}
        </Link>
      ),
    },
    {
      title: t('admin.userDetail.orderColumns.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleDateString(i18n.language === 'vi' ? 'vi-VN' : 'en-US'),
    },
    {
      title: t('common.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: string) => {
        let color = 'default';
        if (status === 'delivered') color = 'success';
        if (status === 'pending') color = 'processing';
        if (status === 'cancelled') color = 'error';
        const label = status === 'delivered'
          ? t('admin.userDetail.orderStatus.delivered')
          : status === 'pending'
            ? t('admin.userDetail.orderStatus.pending')
            : status;
        return <Tag color={color}>{label}</Tag>;
      },
    },
    {
      title: t('admin.userDetail.orderColumns.total'),
      dataIndex: 'total',
      key: 'total',
      render: (total: number) => <Text strong>{total.toLocaleString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}{t('common.currencySymbol')}</Text>,
    },
  ];

  return (
    <div className="p-4 md:p-6">
      <Space direction="vertical" size="large" style={{ width: '100%' }}>
        <div className="flex items-center justify-between">
          <Space>
            <Link to={ROUTES.ADMIN_USERS}>
              <Button icon={<ArrowLeftOutlined />} type="text" />
            </Link>
            <div>
              <Title level={3} style={{ margin: 0 }}>
                {t('admin.userDetail.title')}
              </Title>
              <Text type="secondary">{t('admin.userDetail.subtitle')}</Text>
            </div>
          </Space>
        </div>

        <Row gutter={[24, 24]}>
          <Col xs={24} lg={8}>
            <Card
              className="text-center shadow-sm"
              cover={<div className="h-24 bg-gradient-to-r from-primary-500 to-blue-600 rounded-t-lg" />}
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
                    title={t('admin.userDetail.stats.orders')}
                    value={user.orders?.length || 0}
                    prefix={<ShoppingOutlined />}
                  />
                </Col>
                <Col span={12}>
                  <Statistic
                    title={t('admin.userDetail.stats.points')}
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
                  {user.phone || t('admin.userDetail.notUpdated')}
                </Descriptions.Item>
                <Descriptions.Item label={<CalendarOutlined />}>
                  {t('admin.userDetail.joinedDate', { date: new Date(user.createdAt).toLocaleDateString(i18n.language === 'vi' ? 'vi-VN' : 'en-US') })}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            <Card title={t('admin.userDetail.accountStatus')} className="mt-6 shadow-sm">
              <Descriptions column={1} size="small">
                <Descriptions.Item label={t('admin.userDetail.activeLabel')}>
                  {user.isActive ? (
                    <Tag color="success" icon={<CheckCircleOutlined />}>{t('admin.userDetail.activeStatus')}</Tag>
                  ) : (
                    <Tag color="error" icon={<CloseCircleOutlined />}>{t('admin.userDetail.lockedStatus')}</Tag>
                  )}
                </Descriptions.Item>
                <Descriptions.Item label={t('admin.userDetail.emailVerifyLabel')}>
                  {user.isEmailVerified ? (
                    <Tag color="success">{t('admin.userDetail.verified')}</Tag>
                  ) : (
                    <Tag color="warning">{t('admin.userDetail.notVerified')}</Tag>
                  )}
                </Descriptions.Item>
              </Descriptions>
            </Card>
          </Col>

          <Col xs={24} lg={16}>
            <Tabs
              defaultActiveKey="orders"
              className="bg-white p-4 rounded-lg shadow-sm"
              items={[
                {
                  key: 'orders',
                  label: (
                    <span>
                      <ShoppingOutlined /> {t('admin.userDetail.tabs.orders')}
                    </span>
                  ),
                  children: (
                    <Table
                      dataSource={user.orders}
                      columns={orderColumns}
                      rowKey="id"
                      pagination={false}
                      locale={{ emptyText: t('admin.userDetail.noOrders') }}
                    />
                  ),
                },
                {
                  key: 'addresses',
                  label: (
                    <span>
                      <EnvironmentOutlined /> {t('admin.userDetail.tabs.addresses')}
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
                                {addr.isDefault && <Tag color="blue">{t('admin.userDetail.defaultAddress')}</Tag>}
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
                          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('admin.userDetail.noAddresses')} />
                        </Col>
                      )}
                    </Row>
                  ),
                },
                {
                  key: 'activity',
                  label: (
                    <span>
                      <HistoryOutlined /> {t('admin.userDetail.tabs.activity')}
                    </span>
                  ),
                  children: (
                    <Timeline
                      className="mt-4"
                      items={[
                        ...(user.loyaltyHistories || []).map((h: any) => ({
                          color: h.type === 'earn' ? 'green' : 'gold',
                          date: new Date(h.createdAt),
                          children: `${new Date(h.createdAt).toLocaleString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}: ${h.type === 'earn' ? t('admin.userDetail.activity.earn') : t('admin.userDetail.activity.use')} ${h.points} ${t('admin.userDetail.activity.points')} - ${h.description || 'N/A'}`,
                        })),
                        ...(user.searchHistories || []).map((s: any) => ({
                          color: 'blue',
                          date: new Date(s.createdAt),
                          children: `${new Date(s.createdAt).toLocaleString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}: ${t('admin.userDetail.activity.search')} "${s.keyword || s.query || 'N/A'}"`,
                        })),
                      ]
                        .sort((a: any, b: any) => b.date.getTime() - a.date.getTime())
                        .map(({ date: _date, ...rest }) => rest)
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
