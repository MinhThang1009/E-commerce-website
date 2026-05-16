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
  CheckCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { getLocale } from '@/utils/format';
import {
  useGetDiscountCodesQuery,
  useCreateDiscountCodeMutation,
  useUpdateDiscountCodeMutation,
  useDeleteDiscountCodeMutation,
} from '../api/discountCodeApi';
import { DiscountCode } from '@/types/discount.types';
import { getErrorMsg } from '@/utils/errorMessage';

const { TextArea } = Input;
const { RangePicker } = DatePicker;

const DiscountCodesPage: React.FC = () => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);
  const [form] = Form.useForm();
  const [filters, setFilters] = useState({ page: 1, limit: 10, search: '' });

  const { data: discountCodesData, isLoading } = useGetDiscountCodesQuery(filters);
  const { mutateAsync: createDiscountCode, isPending: isCreating } = useCreateDiscountCodeMutation();
  const { mutateAsync: updateDiscountCode, isPending: isUpdating } = useUpdateDiscountCodeMutation();
  const { mutateAsync: deleteDiscountCode } = useDeleteDiscountCodeMutation();

  const discountCodes = discountCodesData?.data?.discountCodes || [];

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    form.setFieldsValue({ code: result });
  };

  const handleCreate = () => {
    setEditingCode(null);
    form.resetFields();
    form.setFieldsValue({ type: 'percent', isActive: true, value: 0, minOrderAmount: 0 });
    setIsModalOpen(true);
  };

  const handleEdit = (record: DiscountCode) => {
    setEditingCode(record);
    form.setFieldsValue({
      ...record,
      dateRange: record.startDate && record.endDate
        ? [dayjs(record.startDate), dayjs(record.endDate)]
        : undefined,
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDiscountCode(id);
      message.success(t('admin.discountCodes.messages.deleteSuccess'));
    } catch (error) {
      message.error(getErrorMsg(error, t('admin.discountCodes.messages.deleteError')));
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Antd Form values
  const handleSubmit = async (values: any) => {
    try {
      const { dateRange, ...restValues } = values;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = { ...restValues };

      if (dateRange && dateRange[0]) data.startDate = dateRange[0].toISOString();
      if (dateRange && dateRange[1]) data.endDate = dateRange[1].toISOString();

      Object.keys(data).forEach((key) => {
        if (data[key] === null || data[key] === '') delete data[key];
      });

      if (editingCode) {
        await updateDiscountCode({ id: editingCode.id, ...data });
        message.success(t('admin.discountCodes.messages.editSuccess'));
      } else {
        await createDiscountCode(data);
        message.success(t('admin.discountCodes.messages.createSuccess'));
      }

      setIsModalOpen(false);
      form.resetFields();
      setEditingCode(null);
    } catch (error) {
      message.error(getErrorMsg(error, t('common.errorOccurred')));
    }
  };

  // Luôn VND — locale động theo ngôn ngữ UI
  const formatPrice = (price: number | string) => {
    const num = parseFloat(String(price));
    if (isNaN(num)) return `0${t('common.currencySymbol')}`;
    return new Intl.NumberFormat(getLocale(), { style: 'currency', currency: 'VND' }).format(num);
  };

  const columns = [
    {
      title: t('admin.discountCodes.table.code'),
      dataIndex: 'code',
      key: 'code',
      render: (text: string) => <Tag color="blue" className="font-semibold text-sm">{text}</Tag>,
    },
    {
      title: t('admin.discountCodes.table.type'),
      dataIndex: 'type',
      key: 'type',
      render: (type: string, record: DiscountCode) => (
        <div className="flex items-center gap-1">
          {type === 'percent' ? <PercentageOutlined className="text-orange-500" /> : <DollarOutlined className="text-green-500" />}
          <span className="font-medium">
            {type === 'percent' ? `${record.value}%` : formatPrice(record.value)}
          </span>
        </div>
      ),
    },
    {
      title: t('admin.discountCodes.table.minOrder'),
      dataIndex: 'minOrderAmount',
      key: 'minOrderAmount',
      render: (amount: number | string) => formatPrice(amount),
    },
    {
      title: t('admin.discountCodes.table.period'),
      key: 'validity',
      render: (_: unknown, record: DiscountCode) => (
        <div className="text-sm text-gray-600">
          <div>{t('admin.discountCodes.table.from')} {record.startDate ? dayjs(record.startDate).format('DD/MM/YYYY') : t('admin.discountCodes.table.unlimited')}</div>
          <div>{t('admin.discountCodes.table.to')} {record.endDate ? dayjs(record.endDate).format('DD/MM/YYYY') : t('admin.discountCodes.table.unlimited')}</div>
        </div>
      ),
    },
    {
      title: t('admin.discountCodes.table.usage'),
      key: 'usage',
      render: (_: unknown, record: DiscountCode) => (
        <Tooltip title={t('admin.discountCodes.table.usageInfo', { used: record.usedCount, limit: record.usageLimit || t('admin.discountCodes.table.noLimit') })}>
          <div className="text-sm">
            <span className="font-semibold text-blue-600">{record.usedCount}</span> / {record.usageLimit || '∞'}
          </div>
        </Tooltip>
      ),
    },
    {
      title: t('common.status'),
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'} icon={isActive ? <CheckCircleOutlined /> : <StopOutlined />}>
          {isActive ? t('admin.discountCodes.status.active') : t('admin.discountCodes.status.paused')}
        </Tag>
      ),
    },
    {
      title: t('admin.common.actions'),
      key: 'actions',
      render: (_: unknown, record: DiscountCode) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          <Popconfirm
            title={t('admin.discountCodes.deleteTitle')}
            description={t('admin.discountCodes.deleteConfirm')}
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

  return (
    <div className="p-2 sm:p-4 md:p-6">
      <Card className="mb-4 md:mb-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 m-0">
              <PercentageOutlined className="text-blue-500" />
              {t('admin.discountCodes.title')}
            </h1>
            <p className="text-neutral-600 mt-1">{t('admin.discountCodes.subtitle')}</p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} size="large">
            {t('admin.discountCodes.createCode')}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="mb-4">
          <Input.Search
            placeholder={t('admin.discountCodes.searchPlaceholder')}
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
          scroll={{ x: 800 }}
          pagination={{
            current: filters.page,
            pageSize: filters.limit,
            total: discountCodesData?.data?.pagination?.total || 0,
            onChange: (page, limit) => setFilters({ ...filters, page, limit }),
            showSizeChanger: true,
            showTotal: (total, range) => t('admin.discountCodes.totalItems', { range0: range[0], range1: range[1], total }),
          }}
        />
      </Card>

      <Modal
        title={editingCode ? t('admin.discountCodes.editCode') : t('admin.discountCodes.createCodeModal')}
        open={isModalOpen}
        onCancel={() => { setIsModalOpen(false); form.resetFields(); setEditingCode(null); }}
        footer={null}
        width={700}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off">
          <Row gutter={16}>
            <Col span={12}>
              <div style={{ display: 'flex', alignItems: 'flex-end', gap: '8px' }}>
                <Form.Item
                  name="code"
                  label={t('admin.discountCodes.form.code')}
                  rules={[
                    { required: true, message: t('admin.discountCodes.form.codeRequired') },
                    { pattern: /^[A-Z0-9_]+$/, message: t('admin.discountCodes.form.codePattern') },
                  ]}
                  getValueFromEvent={(e) => e.target.value.toUpperCase()}
                  style={{ flex: 1, marginBottom: 24 }}
                >
                  <Input placeholder={t('admin.discountCodes.form.codePlaceholder')} style={{ textTransform: 'uppercase' }} />
                </Form.Item>
                <Button
                  onClick={generateRandomCode}
                  icon={<PlusOutlined />}
                  title={t('admin.discountCodes.form.generateCodeTitle')}
                  style={{ marginBottom: 24 }}
                >
                  {t('admin.discountCodes.form.generateCode')}
                </Button>
              </div>
            </Col>
            <Col span={12}>
              <Form.Item name="type" label={t('admin.discountCodes.form.type')} rules={[{ required: true }]}>
                <Select options={[
                  { value: 'percent', label: t('admin.discountCodes.form.typePercent') },
                  { value: 'fixed', label: t('admin.discountCodes.form.typeFixed') },
                ]} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item noStyle shouldUpdate={(prev, cur) => prev.type !== cur.type}>
            {({ getFieldValue }) => {
              const type = getFieldValue('type');
              return (
                <Row gutter={16}>
                  <Col span={12}>
                    <Form.Item
                      name="value"
                      label={type === 'percent' ? t('admin.discountCodes.form.valuePercent') : t('admin.discountCodes.form.valueFixed')}
                      rules={[{ required: true, message: t('admin.discountCodes.form.valueRequired') }]}
                    >
                      <InputNumber<number>
                        min={0}
                        max={type === 'percent' ? 100 : undefined}
                        style={{ width: '100%' }}
                        formatter={type === 'fixed' ? (value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : undefined}
                        parser={type === 'fixed' ? (value) => Number(value?.replace(/\$\s?|(,*)/g, '') ?? '') : undefined}
                      />
                    </Form.Item>
                  </Col>
                  {type === 'percent' && (
                    <Col span={12}>
                      <Form.Item
                        name="maxDiscountAmount"
                        label={t('admin.discountCodes.form.maxDiscount')}
                        tooltip={t('admin.discountCodes.form.maxDiscountTooltip')}
                      >
                        <InputNumber<number>
                          min={0}
                          style={{ width: '100%' }}
                          formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                          parser={(value) => Number(value?.replace(/\$\s?|(,*)/g, '') ?? '')}
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
              <Form.Item name="minOrderAmount" label={t('admin.discountCodes.form.minOrder')}>
                <InputNumber<number>
                  min={0}
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => Number(value?.replace(/\$\s?|(,*)/g, '') ?? '')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="usageLimit"
                label={t('admin.discountCodes.form.usageLimit')}
                tooltip={t('admin.discountCodes.form.usageLimitTooltip')}
              >
                <InputNumber min={0} style={{ width: '100%' }} placeholder={t('admin.discountCodes.form.usageLimitPlaceholder')} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="dateRange"
            label={t('admin.discountCodes.form.dateRange')}
            tooltip={t('admin.discountCodes.form.dateRangeTooltip')}
          >
            <RangePicker showTime format="DD/MM/YYYY HH:mm" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item name="description" label={t('admin.discountCodes.form.description')}>
            <TextArea rows={2} placeholder={t('admin.discountCodes.form.descriptionPlaceholder')} />
          </Form.Item>

          <Form.Item name="isActive" label={t('common.status')} valuePropName="checked">
            <Switch
              checkedChildren={t('admin.discountCodes.status.active')}
              unCheckedChildren={t('admin.discountCodes.status.paused')}
            />
          </Form.Item>

          <Form.Item>
            <Space className="w-full justify-end">
              <Button onClick={() => setIsModalOpen(false)}>{t('common.cancel')}</Button>
              <Button type="primary" htmlType="submit" loading={isCreating || isUpdating}>
                {editingCode ? t('common.update') : t('common.create')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default DiscountCodesPage;
