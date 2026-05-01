import React, { useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  Select,
  DatePicker,
  message,
  Popconfirm,
  Space,
  Tag,
  Card,
  Row,
  Col,
  Tooltip,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PercentageOutlined,
  DollarOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  StopOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import {
  useGetDiscountCodesQuery,
  useCreateDiscountCodeMutation,
  useUpdateDiscountCodeMutation,
  useDeleteDiscountCodeMutation,
} from '@/services/discountCodeApi';
import { DiscountCode } from '@/types/discount.types';

const { TextArea } = Input;
const { RangePicker } = DatePicker;

const DiscountCodesPage: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);
  const [form] = Form.useForm();
  const [filters, setFilters] = useState({ page: 1, limit: 10, search: '' });

  // API hooks
  const { data: discountCodesData, isLoading } = useGetDiscountCodesQuery(filters);
  const [createDiscountCode, { isLoading: isCreating }] = useCreateDiscountCodeMutation();
  const [updateDiscountCode, { isLoading: isUpdating }] = useUpdateDiscountCodeMutation();
  const [deleteDiscountCode] = useDeleteDiscountCodeMutation();

  const discountCodes = discountCodesData?.data?.discountCodes || [];

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    // Generate code with format: PREFIX_XXXX (e.g. DISCOUNT_A1B2) or just ABCD1234
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    form.setFieldsValue({ code: result });
  };

  const handleCreate = () => {
    setEditingCode(null);
    form.resetFields();
    form.setFieldsValue({
      type: 'percent',
      isActive: true,
      value: 0,
      minOrderAmount: 0,
    });
    setIsModalOpen(true);
  };

  const handleEdit = (record: DiscountCode) => {
    setEditingCode(record);
    form.setFieldsValue({
      ...record,
      dateRange: record.startDate && record.endDate 
        ? [dayjs(record.startDate), dayjs(record.endDate)] 
        : undefined
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDiscountCode(id).unwrap();
      message.success('Xóa mã giảm giá thành công');
    } catch (error: any) {
      message.error(error?.data?.message || 'Có lỗi xảy ra khi xóa mã giảm giá');
    }
  };

  const handleSubmit = async (values: any) => {
    try {
      const { dateRange, ...restValues } = values;
      const data: any = {
        ...restValues,
      };

      if (dateRange && dateRange[0]) {
        data.startDate = dateRange[0].toISOString();
      }
      if (dateRange && dateRange[1]) {
        data.endDate = dateRange[1].toISOString();
      }

      // Loại bỏ các trường null hoặc chuỗi rỗng để tránh lỗi validation backend
      Object.keys(data).forEach(key => {
        if (data[key] === null || data[key] === '') {
          delete data[key];
        }
      });

      if (editingCode) {
        await updateDiscountCode({
          id: editingCode.id,
          ...data,
        }).unwrap();
        message.success('Cập nhật mã giảm giá thành công');
      } else {
        await createDiscountCode(data).unwrap();
        message.success('Tạo mã giảm giá thành công');
      }

      setIsModalOpen(false);
      form.resetFields();
      setEditingCode(null);
    } catch (error: any) {
      message.error(error?.data?.message || 'Có lỗi xảy ra');
    }
  };

  const formatPrice = (price: any) => {
    const num = parseFloat(price);
    if (isNaN(num)) return '0đ';
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(num);
  };

  const columns = [
    {
      title: 'Mã',
      dataIndex: 'code',
      key: 'code',
      render: (text: string) => <Tag color="blue" className="font-semibold text-sm">{text}</Tag>,
    },
    {
      title: 'Loại giảm',
      dataIndex: 'type',
      key: 'type',
      render: (type: string, record: DiscountCode) => {
        const value = record.value;
        return (
          <div className="flex items-center gap-1">
            {type === 'percent' ? <PercentageOutlined className="text-orange-500" /> : <DollarOutlined className="text-green-500" />}
            <span className="font-medium">
              {type === 'percent' ? `${value}%` : formatPrice(value)}
            </span>
          </div>
        );
      },
    },
    {
      title: 'Điều kiện tối thiểu',
      dataIndex: 'minOrderAmount',
      key: 'minOrderAmount',
      render: (amount: any) => formatPrice(amount),
    },
    {
      title: 'Thời hạn',
      key: 'validity',
      render: (_: any, record: DiscountCode) => (
        <div className="text-sm text-gray-600">
          <div>Từ: {record.startDate ? dayjs(record.startDate).format('DD/MM/YYYY') : 'Vô thời hạn'}</div>
          <div>Đến: {record.endDate ? dayjs(record.endDate).format('DD/MM/YYYY') : 'Vô thời hạn'}</div>
        </div>
      ),
    },
    {
      title: 'Sử dụng',
      key: 'usage',
      render: (_: any, record: DiscountCode) => (
        <Tooltip title={`Đã dùng: ${record.usedCount} / Giới hạn: ${record.usageLimit || 'Không giới hạn'}`}>
          <div className="text-sm">
            <span className="font-semibold text-blue-600">{record.usedCount}</span> / {record.usageLimit || '∞'}
          </div>
        </Tooltip>
      ),
    },
    {
      title: 'Trạng thái',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag
          color={isActive ? 'green' : 'red'}
          icon={isActive ? <CheckCircleOutlined /> : <StopOutlined />}
        >
          {isActive ? 'Hoạt động' : 'Tạm dừng'}
        </Tag>
      ),
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_: any, record: DiscountCode) => (
        <Space>
          <Tooltip title="Chỉnh sửa">
            <Button
              type="primary"
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
          <Tooltip title="Xóa">
            <Popconfirm
              title="Bạn có chắc chắn muốn xóa mã giảm giá này?"
              onConfirm={() => handleDelete(record.id)}
              okText="Xóa"
              cancelText="Hủy"
            >
              <Button
                type="primary"
                danger
                icon={<DeleteOutlined />}
                size="small"
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <Row gutter={[16, 16]}>
          <Col span={24}>
            <Card>
              <div className="flex items-center justify-between">
                <div>
                  <h1 className="text-2xl font-bold flex items-center gap-2">
                    <PercentageOutlined className="text-blue-500" />
                    Quản lý mã giảm giá
                  </h1>
                  <p className="text-gray-600 mt-1">
                    Tạo và quản lý các mã giảm giá cho cửa hàng
                  </p>
                </div>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={handleCreate}
                  size="large"
                >
                  Tạo mã giảm giá
                </Button>
              </div>
            </Card>
          </Col>
        </Row>
      </div>

      <Card>
        <div className="mb-4">
          <Input.Search
            placeholder="Tìm kiếm theo mã sản phẩm hoặc mô tả..."
            allowClear
            onSearch={(value) => setFilters({ ...filters, search: value, page: 1 })}
            style={{ width: 300 }}
          />
        </div>
        <Table
          columns={columns}
          dataSource={discountCodes}
          rowKey="id"
          loading={isLoading}
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total: discountCodesData?.data?.pagination?.total || 0,
            onChange: (page, limit) => setFilters({ ...filters, page, limit }),
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} mã`,
          }}
        />
      </Card>

      <Modal
        title={editingCode ? 'Chỉnh sửa mã giảm giá' : 'Tạo mã giảm giá mới'}
        open={isModalOpen}
        onCancel={() => {
          setIsModalOpen(false);
          form.resetFields();
          setEditingCode(null);
        }}
        footer={null}
        width={700}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          autoComplete="off"
        >
          <Row gutter={16}>
            <Col span={12}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                <Form.Item
                  name="code"
                  label="Mã giảm giá"
                  rules={[
                    { required: true, message: 'Vui lòng nhập mã giảm giá' },
                    {
                      pattern: /^[A-Z0-9_]+$/,
                      message: 'Mã chỉ bao gồm chữ in hoa, số và dấu gạch dưới',
                    },
                  ]}
                  getValueFromEvent={(e) => e.target.value.toUpperCase()}
                  style={{ flex: 1, marginBottom: 24 }}
                >
                  <Input 
                    placeholder="Ví dụ: SUMMER50K" 
                    style={{ textTransform: 'uppercase' }} 
                  />
                </Form.Item>
                <Button
                  onClick={generateRandomCode}
                  icon={<PlusOutlined />}
                  title="Tạo mã ngẫu nhiên"
                  style={{ marginBottom: 24 }}
                >
                  Tạo mã
                </Button>
              </div>
            </Col>
            <Col span={12}>
              <Form.Item
                name="type"
                label="Loại giảm giá"
                rules={[{ required: true }]}
              >
                <Select options={[
                  { value: 'percent', label: 'Tính theo %' },
                  { value: 'fixed', label: 'Khấu trừ cố định' },
                ]} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.type !== currentValues.type}
          >
            {({ getFieldValue }) => {
              const type = getFieldValue('type');
              return (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="value"
                      label={type === 'percent' ? 'Giá trị (%)' : 'Giá trị giảm (VND)'}
                      rules={[{ required: true, message: 'Nhập giá trị' }]}
                    >
                      <InputNumber
                        min={0}
                        max={type === 'percent' ? 100 : undefined}
                        style={{ width: '100%' }}
                        formatter={type === 'fixed' ? (value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : undefined}
                        parser={type === 'fixed' ? (value) => value!.replace(/\$\s?|(,*)/g, '') as any : undefined}
                      />
                    </Form.Item>
                  </Col>
                  {type === 'percent' && (
                    <Col span={12}>
                      <Form.Item
                        name="maxDiscountAmount"
                        label="Giảm tối đa (VND)"
                        tooltip="Bỏ trống nếu không giới hạn mức giảm tối đa"
                      >
                        <InputNumber
                          min={0}
                          style={{ width: '100%' }}
                          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as any}
                        />
                      </Form.Item>
                    </Col>
                  )}
                </Row>
              );
            }}
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="minOrderAmount"
                label="Đơn hàng tối thiểu (VND)"
              >
                <InputNumber
                  min={0}
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value!.replace(/\$\s?|(,*)/g, '') as any}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="usageLimit"
                label="Giới hạn sử dụng"
                tooltip="Bỏ trống nếu không giới hạn số lượt dùng"
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder="Không giới hạn" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="dateRange"
            label="Thời gian áp dụng"
            tooltip="Bỏ trống nếu mã có hiệu lực vĩnh viễn"
          >
            <RangePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="description" label="Mô tả">
            <TextArea rows={2} placeholder="Nhập ghi chú hoặc mô tả về mã giảm giá" />
          </Form.Item>

          <Form.Item name="isActive" label="Trạng thái" valuePropName="checked">
            <Switch checkedChildren="Hoạt động" unCheckedChildren="Tạm dừng" />
          </Form.Item>

          <Form.Item>
            <Space className="w-full justify-end">
              <Button onClick={() => setIsModalOpen(false)}>Hủy</Button>
              <Button type="primary" htmlType="submit" loading={isCreating || isUpdating}>
                {editingCode ? 'Cập nhật' : 'Tạo mới'}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DiscountCodesPage;
