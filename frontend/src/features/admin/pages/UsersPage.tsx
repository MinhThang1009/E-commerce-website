import React, { useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Space,
  message,
  Popconfirm,
  Tag,
  Avatar,
  Card,
  Typography,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  UserOutlined,
  EditOutlined,
  DeleteOutlined,
  ReloadOutlined,
  SearchOutlined,
  MailOutlined,
  PhoneOutlined,
  CrownOutlined,
  TeamOutlined,
  EyeOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buildRoute } from '@/routes/paths';
import {
  useGetAllUsersQuery,
  useUpdateUserMutation,
  useDeleteUserMutation,
  type User,
  type UserFilters,
} from '../api/adminUserApi';
import { getErrorMsg } from '@/utils/errorMessage';

const { Title } = Typography;
const { Option } = Select;

interface UserFormData {
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'customer' | 'admin' | 'manager';
  isEmailVerified: boolean;
  isActive: boolean;
}

const UsersPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [filters, setFilters] = useState<UserFilters>({
    page: 1,
    limit: 10,
    search: '',
    role: '',
    sortBy: 'createdAt',
    sortOrder: 'DESC',
  });

  const { data: usersData, isLoading, refetch } = useGetAllUsersQuery(filters);
  const { mutateAsync: updateUser, isPending: isUpdating } = useUpdateUserMutation();
  const { mutateAsync: deleteUser } = useDeleteUserMutation();

  const users = usersData?.data?.users || [];
  const pagination = usersData?.data?.pagination;

  const handleSubmit = async (values: UserFormData) => {
    if (!editingUser) return;
    try {
      await updateUser({ id: editingUser.id, ...values });
      message.success(t('admin.users.messages.editSuccess'));
      setIsModalVisible(false);
      setEditingUser(null);
      form.resetFields();
    } catch (error) {
      message.error(getErrorMsg(error, t('admin.users.messages.editError')));
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteUser(id);
      message.success(t('admin.users.messages.deleteSuccess'));
    } catch (error) {
      message.error(getErrorMsg(error, t('admin.users.messages.deleteError')));
    }
  };

  const handleEdit = (user: User) => {
    setEditingUser(user);
    setIsModalVisible(true);
    form.setFieldsValue({
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive,
    });
  };

  const handleSearch = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value, page: 1 }));
  };

  const handleFilterChange = (key: keyof UserFilters, value: string | number | boolean | undefined) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const handleTableChange = (page: number, pageSize: number) => {
    setFilters((prev) => ({ ...prev, page, limit: pageSize }));
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin': return 'red';
      case 'manager': return 'orange';
      case 'customer': return 'blue';
      default: return 'default';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <CrownOutlined />;
      case 'manager': return <TeamOutlined />;
      default: return <UserOutlined />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin': return t('admin.users.roles.admin');
      case 'manager': return t('admin.users.roles.manager');
      case 'customer': return t('admin.users.roles.customer');
      default: return role;
    }
  };

  const columns = [
    {
      title: t('admin.users.table.user'),
      key: 'user',
      render: (_: unknown, record: User) => (
        <div className="flex items-center gap-3">
          <Avatar src={record.avatar} icon={<UserOutlined />} size={48} />
          <div>
            <div className="font-medium">{record.firstName} {record.lastName}</div>
            <div className="text-sm text-gray-500 flex items-center gap-1">
              <MailOutlined className="text-xs" />
              {record.email}
            </div>
            {record.phone && (
              <div className="text-sm text-gray-500 flex items-center gap-1">
                <PhoneOutlined className="text-xs" />
                {record.phone}
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      title: t('admin.users.table.role'),
      dataIndex: 'role',
      key: 'role',
      width: 120,
      render: (role: string) => (
        <Tag color={getRoleColor(role)} icon={getRoleIcon(role)}>
          {getRoleLabel(role)}
        </Tag>
      ),
    },
    {
      title: t('common.status'),
      key: 'status',
      width: 150,
      render: (_: unknown, record: User) => (
        <div className="space-y-1">
          <div>
            <Tag color={record.isActive ? 'success' : 'error'}>
              {record.isActive ? t('admin.users.status.active') : t('admin.users.status.locked')}
            </Tag>
          </div>
          <div>
            <Tag color={record.isEmailVerified ? 'processing' : 'warning'}>
              {record.isEmailVerified ? t('admin.users.table.verified') : t('admin.users.table.notVerified')}
            </Tag>
          </div>
        </div>
      ),
    },
    {
      title: t('admin.users.table.createdAt'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 120,
      render: (date: string) => new Date(date).toLocaleDateString(i18n.language === 'vi' ? 'vi-VN' : 'en-US'),
    },
    {
      title: t('admin.common.actions'),
      key: 'actions',
      width: 120,
      render: (_: unknown, record: User) => (
        <Space>
          <Button type="link" icon={<EyeOutlined />} onClick={() => navigate(buildRoute.adminUserDetail(record.id))} size="small" />
          <Button type="link" icon={<EditOutlined />} onClick={() => handleEdit(record)} size="small" />
          <Popconfirm
            title={t('admin.users.deleteTitle')}
            description={t('admin.users.deleteConfirm')}
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

  const totalUsers = pagination?.totalItems || 0;
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const customerCount = users.filter((u) => u.role === 'customer').length;
  const verifiedCount = users.filter((u) => u.isEmailVerified).length;

  return (
    <div className="p-2 sm:p-4 md:p-6">
      <Card className="dark:bg-neutral-800">
        <div className="mb-6">
          <Title level={2} className="!mb-1 text-xl md:text-2xl dark:text-white">
            {t('admin.users.title')}
          </Title>
          <p className="text-neutral-600 dark:text-neutral-400">
            {t('admin.users.subtitle')}
          </p>
        </div>

        <Row gutter={[16, 16]} className="mb-6">
          <Col xs={24} sm={12} md={6}>
            <Card className="dark:bg-neutral-700">
              <Statistic
                title={<span className="dark:text-neutral-300">{t('admin.users.stats.total')}</span>}
                value={totalUsers}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="dark:bg-neutral-700">
              <Statistic
                title={<span className="dark:text-neutral-300">{t('admin.users.stats.admins')}</span>}
                value={adminCount}
                prefix={<CrownOutlined />}
                valueStyle={{ color: '#f5222d' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="dark:bg-neutral-700">
              <Statistic
                title={<span className="dark:text-neutral-300">{t('admin.users.stats.customers')}</span>}
                value={customerCount}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col xs={24} sm={12} md={6}>
            <Card className="dark:bg-neutral-700">
              <Statistic
                title={<span className="dark:text-neutral-300">{t('admin.users.stats.verified')}</span>}
                value={verifiedCount}
                prefix={<MailOutlined />}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        <div className="mb-4 p-4 bg-gray-50 dark:bg-neutral-700 rounded-lg">
          <Row gutter={[16, 16]} align="middle">
            <Col xs={24} md={12} lg={8}>
              <Input
                placeholder={t('admin.users.searchPlaceholder')}
                value={filters.search}
                onChange={(e) => handleSearch(e.target.value)}
                suffix={<SearchOutlined style={{ color: 'rgba(0,0,0,.45)' }} />}
                allowClear
              />
            </Col>
            <Col xs={12} sm={8} md={6} lg={4}>
              <Select
                placeholder={t('admin.users.filter.role')}
                value={filters.role}
                onChange={(value) => handleFilterChange('role', value)}
                style={{ width: '100%' }}
                allowClear
              >
                <Option value="">{t('common.all')}</Option>
                <Option value="admin">{t('admin.users.roles.admin')}</Option>
                <Option value="manager">{t('admin.users.roles.manager')}</Option>
                <Option value="customer">{t('admin.users.roles.customer')}</Option>
              </Select>
            </Col>
            <Col xs={12} sm={8} md={6} lg={4}>
              <Select
                placeholder={t('admin.users.filter.sortBy')}
                value={filters.sortBy}
                onChange={(value) => handleFilterChange('sortBy', value)}
                style={{ width: '100%' }}
              >
                <Option value="createdAt">{t('admin.users.filter.sortByDate')}</Option>
                <Option value="firstName">{t('admin.users.filter.sortByName')}</Option>
                <Option value="email">{t('admin.users.filter.sortByEmail')}</Option>
              </Select>
            </Col>
            <Col xs={12} sm={8} md={6} lg={4}>
              <Select
                placeholder={t('admin.users.filter.sortOrder')}
                value={filters.sortOrder}
                onChange={(value) => handleFilterChange('sortOrder', value)}
                style={{ width: '100%' }}
              >
                <Option value="DESC">{t('admin.users.filter.desc')}</Option>
                <Option value="ASC">{t('admin.users.filter.asc')}</Option>
              </Select>
            </Col>
            <Col xs={12} sm={8} md={6} lg={4}>
              <Button
                icon={<ReloadOutlined />}
                onClick={() => refetch()}
                loading={isLoading}
                style={{ width: '100%' }}
                className="dark:text-neutral-300"
              >
                {t('common.refresh')}
              </Button>
            </Col>
          </Row>
        </div>

        <div className="overflow-x-auto">
          <Table
            columns={columns}
            dataSource={users}
            className="dark-table-fixed-columns"
            rowKey="id"
            loading={isLoading}
            pagination={{
              current: pagination?.currentPage,
              total: pagination?.totalItems,
              pageSize: pagination?.itemsPerPage,
              showSizeChanger: true,
              showQuickJumper: true,
              showTotal: (total, range) => t('admin.users.totalItems', { range0: range[0], range1: range[1], total }),
              onChange: handleTableChange,
            }}
            scroll={{ x: 800 }}
          />
        </div>

        <Modal
          title={t('admin.users.editUser')}
          open={isModalVisible}
          onCancel={() => { setIsModalVisible(false); setEditingUser(null); form.resetFields(); }}
          footer={null}
          width={600}
        >
          <Form form={form} layout="vertical" onFinish={handleSubmit}>
            <Row gutter={16}>
              <Col span={12}>
                <Form.Item
                  name="firstName"
                  label={t('admin.users.form.firstName')}
                  rules={[{ required: true, message: t('admin.users.form.firstNameRequired') }]}
                >
                  <Input placeholder={t('admin.users.form.firstNamePlaceholder')} />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item
                  name="lastName"
                  label={t('admin.users.form.lastName')}
                  rules={[{ required: true, message: t('admin.users.form.lastNameRequired') }]}
                >
                  <Input placeholder={t('admin.users.form.lastNamePlaceholder')} />
                </Form.Item>
              </Col>
            </Row>

            <Form.Item name="phone" label={t('admin.users.form.phone')}>
              <Input placeholder={t('admin.users.form.phonePlaceholder')} />
            </Form.Item>

            <Form.Item
              name="role"
              label={t('admin.users.form.role')}
              rules={[{ required: true, message: t('admin.users.form.roleRequired') }]}
            >
              <Select placeholder={t('admin.users.form.rolePlaceholder')}>
                <Option value="customer">{t('admin.users.roles.customer')}</Option>
                <Option value="manager">{t('admin.users.roles.manager')}</Option>
                <Option value="admin">{t('admin.users.roles.admin')}</Option>
              </Select>
            </Form.Item>

            <Row gutter={16}>
              <Col span={12}>
                <Form.Item name="isEmailVerified" label={t('admin.users.form.emailStatus')} valuePropName="checked">
                  <Switch
                    checkedChildren={t('admin.users.form.emailVerified')}
                    unCheckedChildren={t('admin.users.form.emailNotVerified')}
                  />
                </Form.Item>
              </Col>
              <Col span={12}>
                <Form.Item name="isActive" label={t('admin.users.form.accountStatus')} valuePropName="checked">
                  <Switch
                    checkedChildren={t('admin.users.status.active')}
                    unCheckedChildren={t('admin.users.status.locked')}
                  />
                </Form.Item>
              </Col>
            </Row>

            <div className="flex justify-end gap-2 mt-6">
              <Button onClick={() => { setIsModalVisible(false); setEditingUser(null); form.resetFields(); }}>
                {t('common.cancel')}
              </Button>
              <Button type="primary" htmlType="submit" loading={isUpdating}>
                {t('common.update')}
              </Button>
            </div>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

export default UsersPage;
