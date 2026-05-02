import React, { useState, useCallback } from 'react';
import {
  Table,
  Card,
  Input,
  Select,
  Button,
  Tag,
  Modal,
  Form,
  Space,
  Divider,
  Row,
  Col,
  Descriptions,
  List,
  Image,
  Typography,
  Alert,
  Spin,
  Pagination,
  message,
} from 'antd';
import {
  SearchOutlined,
  EyeOutlined,
  EditOutlined,
  ReloadOutlined,
  ShoppingCartOutlined,
  UserOutlined,
  CalendarOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';

import dayjs from 'dayjs';
import {
  useGetAdminOrdersQuery,
  useUpdateOrderStatusMutation,
  AdminOrder,
} from '@/services/adminOrderApi';
import styles from './OrdersPage.module.css';
import { useTranslation } from 'react-i18next';

const { Option } = Select;
const { TextArea } = Input;
const { Title, Text } = Typography;

// Cấu hình trạng thái với màu sắc và icon
const STATUS_CONFIG = {
  pending: { color: 'orange', icon: '⏳' },
  processing: { color: 'blue', icon: '🔄' },
  shipped: { color: 'purple', icon: '🚚' },
  delivered: { color: 'green', icon: '✅' },
  cancelled: { color: 'red', icon: '❌' },
};

const PAYMENT_STATUS_CONFIG = {
  pending: { color: 'orange', icon: '⏳' },
  paid: { color: 'green', icon: '✅' },
  failed: { color: 'red', icon: '❌' },
  refunded: { color: 'gray', icon: '🔄' },
};

const OrdersPage: React.FC = () => {
  console.log('OrdersPage: Component đang render');
  const { t } = useTranslation();
  const [form] = Form.useForm();

  // Quản lý state
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<AdminOrder | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [isUpdateModalOpen, setIsUpdateModalOpen] = useState(false);

  // Các query API
  const {
    data: ordersData,
    isLoading,
    error,
    refetch,
  } = useGetAdminOrdersQuery({
    page,
    limit: pageSize,
    search: searchTerm,
    status: statusFilter,
    sortBy: 'createdAt',
    sortOrder: 'DESC',
  });

  const [updateOrderStatus, { isLoading: isUpdating }] =
    useUpdateOrderStatusMutation();

  // Định dạng tiền tệ
  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  }, []);

  // Định dạng ngày tháng
  const formatDate = useCallback((dateString: string) => {
    return dayjs(dateString).format('DD/MM/YYYY HH:mm');
  }, []);

  // Tùy chọn trạng thái cho bộ lọc và form
  const statusOptions = [
    { value: '', label: 'Tất cả trạng thái' },
    { value: 'pending', label: 'Chờ xử lý' },
    { value: 'processing', label: 'Đang xử lý' },
    { value: 'shipped', label: 'Đã giao cho vận chuyển' },
    { value: 'delivered', label: 'Đã giao hàng' },
    { value: 'cancelled', label: 'Đã hủy' },
  ];

  const updateStatusOptions = statusOptions.filter(
    (option) => option.value !== ''
  );

  // Xử lý xem chi tiết đơn hàng
  const handleViewDetails = useCallback((order: AdminOrder) => {
    setSelectedOrder(order);
    setIsDetailsModalOpen(true);
  }, []);

  // Xử lý cập nhật trạng thái đơn hàng
  const handleUpdateStatus = useCallback(
    (order: AdminOrder) => {
      setSelectedOrder(order);
      form.setFieldsValue({
        status: order.status,
        paymentStatus: order.paymentStatus,
        note: '',
      });
      setIsUpdateModalOpen(true);
    },
    [form]
  );

  // Gửi cập nhật trạng thái
  const handleStatusUpdate = useCallback(
    async (values: any) => {
      if (!selectedOrder) return;

      try {
        await updateOrderStatus({
          id: selectedOrder.id,
          data: {
            status: values.status,
            paymentStatus: values.paymentStatus,
            note: values.note || undefined,
          },
        }).unwrap();

        message.success(t('admin.orders.messages.updateSuccess'));
        setIsUpdateModalOpen(false);
        form.resetFields();
        setSelectedOrder(null);
        refetch();
      } catch (error: any) {
        console.error('Cập nhật trạng thái đơn hàng thất bại:', error);
        message.error(t('admin.orders.messages.updateError'));
      }
    },
    [selectedOrder, updateOrderStatus, t, form, refetch]
  );

  // Xử lý tìm kiếm
  const handleSearch = useCallback((value: string) => {
    setSearchTerm(value);
    setPage(1);
  }, []);

  // Xử lý thay đổi bộ lọc trạng thái
  const handleStatusFilterChange = useCallback((value: string) => {
    setStatusFilter(value);
    setPage(1);
  }, []);

  // Xử lý thay đổi phân trang
  const handlePageChange = useCallback(
    (newPage: number, newPageSize?: number) => {
      setPage(newPage);
      if (newPageSize && newPageSize !== pageSize) {
        // Xử lý thay đổi số mục mỗi trang nếu cần
      }
    },
    [pageSize]
  );

  // Cấu hình các cột bảng
  const columns: ColumnsType<AdminOrder> = [
    {
      title: 'Mã đơn hàng',
      dataIndex: 'number',
      key: 'number',
      width: 120,
      render: (number: string, record: AdminOrder) => (
        <div>
          <Text strong>#{number}</Text>
          <br />
          <Text type="secondary" style={{ fontSize: '12px' }}>
            {`${record.items?.length || 0} sản phẩm`}
          </Text>
        </div>
      ),
    },
    {
      title: 'Khách hàng',
      key: 'customer',
      width: 200,
      render: (_, record: AdminOrder) => (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserOutlined style={{ color: '#666' }} />
            <Text strong>
              {record.User?.firstName} {record.User?.lastName}
            </Text>
          </div>
          <Text style={{ fontSize: '12px', color: '#666' }}>
            {record.User?.email}
          </Text>
        </div>
      ),
    },
    {
      title: 'Ngày đặt',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 140,
      render: (date: string) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CalendarOutlined style={{ color: '#666' }} />
          <Text>{formatDate(date)}</Text>
        </div>
      ),
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'total',
      key: 'total',
      width: 120,
      render: (total: number) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <DollarOutlined style={{ color: '#666' }} />
          <Text strong style={{ color: '#1890ff' }}>
            {formatCurrency(total)}
          </Text>
        </div>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status: string) => {
        const config = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
        return (
          <Tag color={config?.color} className={styles.statusTag}>
            {config?.icon}{' '}
            {t(`admin.orders.status.${status}`)}
          </Tag>
        );
      },
    },
    {
      title: 'Thanh toán',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      width: 120,
      render: (paymentStatus: string, record: AdminOrder) => {
        const isCOD = record.paymentMethod === 'cod';
        const config =
          PAYMENT_STATUS_CONFIG[
            paymentStatus as keyof typeof PAYMENT_STATUS_CONFIG
          ];
        
        let statusText = paymentStatus;
        if (paymentStatus === 'pending') {
          statusText = isCOD ? t('admin.orders.paymentStatus.cod') : t('admin.orders.paymentStatus.pending');
        } else if (paymentStatus === 'paid') {
          statusText = t('admin.orders.paymentStatus.paid');
        } else if (paymentStatus === 'failed') {
          statusText = t('admin.orders.paymentStatus.failed');
        } else if (paymentStatus === 'refunded') {
          statusText = t('admin.orders.paymentStatus.refunded');
        }

        return (
          <Tag color={config?.color} style={{ borderRadius: '16px' }}>
            {config?.icon} {statusText}
          </Tag>
        );
      },
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 120,
      fixed: 'right',
      render: (_, record: AdminOrder) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetails(record)}
            title={t('admin.orders.actions.view')}
            size="small"
          />
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleUpdateStatus(record)}
            title={t('admin.orders.actions.update')}
            size="small"
          />
        </Space>
      ),
    },
  ];

  // Lấy đơn hàng và phân trang từ response API
  const orders = ordersData?.data?.orders || [];
  const pagination = ordersData?.data?.pagination;

  console.log('OrdersPage: Trạng thái render', {
    isLoading,
    error,
    orders,
    pagination,
  });

  // Component loading
  if (isLoading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: '16px' }}>
          <Text>{t('common.loading')}</Text>
        </div>
      </div>
    );
  }

  // Component lỗi
  if (error) {
    console.error('OrdersPage: Lỗi API', error);
    return (
      <div style={{ padding: '24px' }}>
        <Alert
          message={t('admin.orders.messages.loadError')}
          description={t('admin.orders.messages.loadError')}
          type="error"
          showIcon
          action={
            <Button size="small" danger onClick={() => refetch()}>
              {t('admin.orders.messages.retry')}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <div
      className={`${styles.ordersPage} dark:bg-neutral-900 dark:!bg-neutral-900`}
    >
      {/* Tiêu đề trang */}
      <div className={styles.pageHeader}>
        <Title level={2} className={`${styles.pageTitle} dark:text-white`}>
          <ShoppingCartOutlined />
          {t('admin.orders.title')}
        </Title>
        <Text type="secondary" className="dark:text-neutral-400">
          {t('admin.orders.subtitle')}
        </Text>
      </div>

      {/* Bộ lọc */}
      <Card className={`${styles.filterCard} dark:bg-neutral-800`}>
        <Row gutter={[16, 16]} align="middle">
          <Col xs={24} sm={12} md={8} lg={6}>
            <Input
              placeholder={t('admin.orders.searchPlaceholder')}
              allowClear
              onChange={(e) => handleSearch(e.target.value)}
              style={{ width: '100%' }}
              className="dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-200"
              suffix={
                <SearchOutlined
                  style={{ color: 'rgba(0,0,0,.45)' }}
                  className="dark:text-neutral-400"
                />
              }
            />
          </Col>
          <Col xs={24} sm={12} md={8} lg={6}>
            <Select
              placeholder={t('admin.orders.filterByStatus')}
              style={{ width: '100%' }}
              value={statusFilter}
              onChange={handleStatusFilterChange}
              allowClear
              className="dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-200"
            >
              {statusOptions.map((option) => (
                <Option key={option.value} value={option.value}>
                  {option.value === '' ? t('admin.orders.allStatus') : t(`admin.orders.status.${option.value}`)}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={24} md={8} lg={12} style={{ textAlign: 'right' }}>
            <Button
              icon={<ReloadOutlined />}
              onClick={() => refetch()}
              loading={isLoading}
              className="dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-700"
            >
              {t('admin.orders.messages.retry')}
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Bảng đơn hàng */}
      <Card className={`${styles.tableCard} dark:bg-neutral-800`}>
        <div className="overflow-x-auto">
          <Table<AdminOrder>
            columns={columns}
            dataSource={orders}
            rowKey="id"
            loading={isLoading}
            pagination={false}
            scroll={{ x: 800 }}
            className="dark:bg-neutral-800 dark-table-fixed-columns"
            locale={{
              emptyText: t('admin.orders.noOrdersFound'),
            }}
          />
        </div>

        {/* Phân trang tùy chỉnh */}
        {pagination && pagination.totalPages > 1 && (
          <div
            className={`${styles.paginationContainer} dark:border-neutral-700`}
          >
            <Pagination
              current={page}
              total={pagination.totalItems}
              pageSize={pageSize}
              showSizeChanger={false}
              showQuickJumper
              showTotal={(total, range) =>
                `${t('admin.orders.pagination.showing')} ${range[0]}-${range[1]} ${t('admin.orders.pagination.of')} ${total} ${t('admin.orders.pagination.results')}`
              }
              onChange={handlePageChange}
              className="dark:text-neutral-300"
            />
          </div>
        )}
      </Card>

      {/* Modal chi tiết đơn hàng */}
      <Modal
        title={
          <div className={styles.modalHeader}>
            <EyeOutlined />
            {t('admin.orders.details.title')}
          </div>
        }
        className={styles.orderDetailsModal}
        open={isDetailsModalOpen}
        onCancel={() => setIsDetailsModalOpen(false)}
        footer={null}
        width={800}
      >
        {selectedOrder && (
          <div>
            {/* Thông tin cơ bản đơn hàng */}
            <Descriptions column={2} bordered style={{ marginBottom: '24px' }}>
              <Descriptions.Item label={t('admin.orders.details.orderNumber')}>
                <Text strong>#{selectedOrder.number}</Text>
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.orders.details.orderDate')}>
                {formatDate(selectedOrder.createdAt)}
              </Descriptions.Item>
              <Descriptions.Item label={t('admin.orders.details.orderStatus')}>
                <Tag
                  color={
                    STATUS_CONFIG[
                      selectedOrder.status as keyof typeof STATUS_CONFIG
                    ]?.color
                  }
                >
                  {
                    STATUS_CONFIG[
                      selectedOrder.status as keyof typeof STATUS_CONFIG
                    ]?.icon
                  }{' '}
                  {t(`admin.orders.status.${selectedOrder.status}`)}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item
                label={t('admin.orders.details.paymentStatus')}
              >
                <Tag
                  color={
                    PAYMENT_STATUS_CONFIG[
                      selectedOrder.paymentStatus as keyof typeof PAYMENT_STATUS_CONFIG
                    ]?.color
                  }
                >
                  {
                    PAYMENT_STATUS_CONFIG[
                      selectedOrder.paymentStatus as keyof typeof PAYMENT_STATUS_CONFIG
                    ]?.icon
                  }{' '}
                  {selectedOrder.paymentStatus === 'pending'
                    ? selectedOrder.paymentMethod === 'cod' 
                      ? t('admin.orders.details.paymentInfo.cod') 
                      : t('admin.orders.paymentStatus.pending')
                    : selectedOrder.paymentStatus === 'paid'
                      ? t('admin.orders.paymentStatus.paid')
                      : selectedOrder.paymentStatus === 'failed'
                        ? t('admin.orders.paymentStatus.failed')
                        : selectedOrder.paymentStatus === 'refunded'
                          ? t('admin.orders.paymentStatus.refunded')
                          : selectedOrder.paymentStatus}
                </Tag>
              </Descriptions.Item>
            </Descriptions>

            {/* Thông tin khách hàng */}
            {/* Thông tin khách hàng & giao hàng */}
            <Row gutter={[16, 16]} style={{ marginBottom: '16px' }}>
              <Col xs={24} md={12}>
                <Card
                  title={
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <UserOutlined />
                      {t('admin.orders.details.customer.title')}
                    </div>
                  }
                  size="small"
                  style={{ height: '100%' }}
                >
                  <Descriptions column={1}>
                    <Descriptions.Item label={t('admin.orders.details.customer.name')}>
                      {selectedOrder.User?.firstName} {selectedOrder.User?.lastName}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('admin.orders.details.customer.email')}>
                      {selectedOrder.User?.email}
                    </Descriptions.Item>
                    {selectedOrder.User?.phone && (
                      <Descriptions.Item label={t('admin.orders.details.customer.phone')}>
                        {selectedOrder.User.phone}
                      </Descriptions.Item>
                    )}
                  </Descriptions>
                </Card>
              </Col>
              
              <Col xs={24} md={12}>
                <Card title={t('admin.orders.details.shipping.title')} size="small" style={{ height: '100%' }}>
                  <Descriptions column={1}>
                    <Descriptions.Item label={t('admin.orders.details.shipping.fullName')}>
                      {selectedOrder.shippingFirstName} {selectedOrder.shippingLastName}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('admin.orders.details.shipping.phone')}>
                      {selectedOrder.shippingPhone || 'N/A'}
                    </Descriptions.Item>
                    <Descriptions.Item label={t('admin.orders.details.shipping.address')}>
                      {selectedOrder.shippingAddress1}
                      {selectedOrder.shippingAddress2 ? `, ${selectedOrder.shippingAddress2}` : ''}
                      {`, ${selectedOrder.shippingCity}, ${selectedOrder.shippingState}`}
                    </Descriptions.Item>
                  </Descriptions>
                </Card>
              </Col>
            </Row>

            {/* Thông tin thanh toán */}
            <Card title={t('admin.orders.details.paymentInfo.title')} size="small" style={{ marginBottom: '16px' }}>
              <Descriptions column={2}>
                <Descriptions.Item label={t('admin.orders.details.paymentInfo.method')}>
                  {selectedOrder.paymentMethod === 'cod' ? t('admin.orders.details.paymentInfo.cod') : selectedOrder.paymentMethod.toUpperCase()}
                </Descriptions.Item>
                <Descriptions.Item label={t('admin.orders.details.paymentInfo.transaction')}>
                  {selectedOrder.paymentTransactionId || 'N/A'}
                </Descriptions.Item>
              </Descriptions>
            </Card>

            {/* Sản phẩm trong đơn hàng */}
            <Card
              title={t('admin.orders.details.items.title')}
              size="small"
              style={{ marginBottom: '16px' }}
            >
              <List
                dataSource={selectedOrder.items}
                renderItem={(item) => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={
                        item.Product?.images?.[0] && (
                          <Image
                            src={item.Product.images[0]}
                            alt={item.Product.name}
                            width={60}
                            height={60}
                            style={{ borderRadius: '8px' }}
                          />
                        )
                      }
                      title={
                        <Text strong>
                          {item.Product?.name || t('admin.orders.noItemsFound')}
                        </Text>
                      }
                      description={
                        <div>
                          <Text type="secondary">
                            {t('admin.orders.details.items.quantity')}:{' '}
                            {item.quantity} × {formatCurrency(item.price)}
                          </Text>
                        </div>
                      }
                    />
                    <div style={{ textAlign: 'right' }}>
                      <Text strong style={{ fontSize: '16px' }}>
                        {formatCurrency(item.quantity * item.price)}
                      </Text>
                    </div>
                  </List.Item>
                )}
              />
            </Card>

            {/* Tóm tắt đơn hàng */}
            <Card title={t('admin.orders.details.summary.title')} size="small">
              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between' }}
                >
                  <Text>{t('admin.orders.details.summary.subtotal')}:</Text>
                  <Text>{formatCurrency(selectedOrder.subtotal)}</Text>
                </div>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between' }}
                >
                  <Text>{t('admin.orders.details.summary.tax')}:</Text>
                  <Text>{formatCurrency(selectedOrder.tax)}</Text>
                </div>
                <div
                  style={{ display: 'flex', justifyContent: 'space-between' }}
                >
                  <Text>{t('admin.orders.details.summary.shipping')}:</Text>
                  <Text>{formatCurrency(selectedOrder.shippingCost)}</Text>
                </div>
                {selectedOrder.discount > 0 && (
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      color: '#52c41a',
                    }}
                  >
                    <Text>{t('admin.orders.details.summary.discount')}:</Text>
                    <Text>-{formatCurrency(selectedOrder.discount)}</Text>
                  </div>
                )}
                <Divider style={{ margin: '8px 0' }} />
                <div
                  style={{ display: 'flex', justifyContent: 'space-between' }}
                >
                  <Text strong style={{ fontSize: '16px' }}>
                    {t('admin.orders.details.summary.total')}:
                  </Text>
                  <Text strong style={{ fontSize: '16px', color: '#1890ff' }}>
                    {formatCurrency(selectedOrder.total)}
                  </Text>
                </div>
              </div>
            </Card>
          </div>
        )}
      </Modal>

      {/* Modal cập nhật trạng thái */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <EditOutlined />
            {t('admin.orders.updateStatus.title')}
          </div>
        }
        open={isUpdateModalOpen}
        onCancel={() => {
          setIsUpdateModalOpen(false);
          form.resetFields();
          setSelectedOrder(null);
        }}
        onOk={() => form.submit()}
        confirmLoading={isUpdating}
        okText={t('admin.orders.updateStatus.update')}
        cancelText={t('admin.orders.updateStatus.cancel')}
      >
        {selectedOrder && (
          <Form form={form} layout="vertical" onFinish={handleStatusUpdate}>
            <Alert
              message={`${t('admin.orders.details.orderNumber')}: #${selectedOrder.number}`}
              description={`${t('admin.orders.updateStatus.currentStatus')}: ${t(`admin.orders.status.${selectedOrder.status}`)}`}
              type="info"
              style={{ marginBottom: '16px' }}
            />

            <Form.Item
              name="status"
              label={t('admin.orders.updateStatus.newStatus')}
            >
              <Select placeholder={t('admin.orders.updateStatus.selectNewStatus')}>
                {updateStatusOptions.map((option) => (
                  <Option key={option.value} value={option.value}>
                    {t(`admin.orders.status.${option.value}`)}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            <Form.Item
              name="paymentStatus"
              label={t('admin.orders.details.paymentStatus')}
            >
              <Select placeholder={t('admin.orders.details.paymentStatus')}>
                <Option value="pending">{t('admin.orders.paymentStatus.pending')}</Option>
                <Option value="paid">{t('admin.orders.paymentStatus.paid')}</Option>
                <Option value="failed">{t('admin.orders.paymentStatus.failed')}</Option>
                <Option value="refunded">{t('admin.orders.paymentStatus.refunded')}</Option>
              </Select>
            </Form.Item>

            <Form.Item name="note" label={t('admin.orders.updateStatus.note')}>
              <TextArea
                rows={3}
                placeholder={t('admin.orders.updateStatus.notePlaceholder')}
              />
            </Form.Item>
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default OrdersPage;
