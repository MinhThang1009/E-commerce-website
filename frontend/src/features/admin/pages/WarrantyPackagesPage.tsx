import React, { useState } from 'react';
import {
  Table,
  Button,
  Modal,
  Form,
  Input,
  InputNumber,
  Switch,
  message,
  Popconfirm,
  Space,
  Tag,
  Card,
  Row,
  Col,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SafetyOutlined,
  DollarOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  StopOutlined,
} from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { getLocale } from '@/utils/format';
import {
  useGetWarrantyPackagesQuery,
  useCreateWarrantyPackageMutation,
  useUpdateWarrantyPackageMutation,
  useDeleteWarrantyPackageMutation,
} from '../api/warrantyApi';
import { WarrantyPackage } from '@/features/catalog';
import { getErrorMsg } from '@/utils/errorMessage';

const { TextArea } = Input;

const WarrantyPackagesPage: React.FC = () => {
  const { t } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPackage, setEditingPackage] = useState<WarrantyPackage | null>(null);
  const [form] = Form.useForm();

  const { data: warrantyPackagesData, isLoading } = useGetWarrantyPackagesQuery({ isActive: undefined });
  const { mutateAsync: createWarrantyPackage, isPending: isCreating } = useCreateWarrantyPackageMutation();
  const { mutateAsync: updateWarrantyPackage, isPending: isUpdating } = useUpdateWarrantyPackageMutation();
  const { mutateAsync: deleteWarrantyPackage } = useDeleteWarrantyPackageMutation();

  const warrantyPackages = warrantyPackagesData?.data?.warrantyPackages || [];

  const handleCreate = () => {
    setEditingPackage(null);
    form.resetFields();
    form.setFieldsValue({ isActive: true, sortOrder: 0, price: 0, coverage: [] });
    setIsModalOpen(true);
  };

  const handleEdit = (record: WarrantyPackage) => {
    setEditingPackage(record);
    form.setFieldsValue({
      ...record,
      coverage: Array.isArray(record.coverage) ? record.coverage.join('\n') : (record.coverage || ''),
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteWarrantyPackage(id);
      message.success(t('admin.warrantyPackages.messages.deleteSuccess'));
    } catch (error) {
      message.error(getErrorMsg(error, t('admin.warrantyPackages.messages.deleteError')));
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Antd Form values
  const handleSubmit = async (values: any) => {
    try {
      const coverageArray = values.coverage
        ? values.coverage.split('\n').filter((item: string) => item.trim())
        : [];
      const data = { ...values, coverage: coverageArray };

      if (editingPackage) {
        await updateWarrantyPackage({ id: editingPackage.id, ...data });
        message.success(t('admin.warrantyPackages.messages.editSuccess'));
      } else {
        await createWarrantyPackage(data);
        message.success(t('admin.warrantyPackages.messages.createSuccess'));
      }

      setIsModalOpen(false);
      form.resetFields();
      setEditingPackage(null);
    } catch (error) {
      message.error(getErrorMsg(error, t('common.errorOccurred')));
    }
  };

  // Luôn VND — locale động theo ngôn ngữ UI
  const formatPrice = (price: number) =>
    new Intl.NumberFormat(getLocale(), { style: 'currency', currency: 'VND' }).format(price);

  const columns = [
    {
      title: t('admin.warrantyPackages.table.packageName'),
      dataIndex: 'name',
      key: 'name',
      render: (text: string, record: WarrantyPackage) => (
        <div>
          <div className="font-medium">{text}</div>
          <div className="text-sm text-gray-500">{record.description}</div>
        </div>
      ),
    },
    {
      title: t('admin.warrantyPackages.table.period'),
      dataIndex: 'durationMonths',
      key: 'durationMonths',
      render: (months: number) => (
        <div className="flex items-center gap-1">
          <CalendarOutlined className="text-blue-500" />
          <span>{t('admin.warrantyPackages.table.monthsLabel', { months })}</span>
        </div>
      ),
    },
    {
      title: t('admin.warrantyPackages.table.price'),
      dataIndex: 'price',
      key: 'price',
      render: (price: number) => (
        <div className="flex items-center gap-1">
          <DollarOutlined className="text-green-500" />
          <span className={price === 0 ? 'text-green-600 font-medium' : ''}>
            {price === 0 ? t('admin.warrantyPackages.table.free') : formatPrice(price)}
          </span>
        </div>
      ),
    },
    {
      title: t('admin.warrantyPackages.table.benefits'),
      dataIndex: 'coverage',
      key: 'coverage',
      render: (coverage: unknown) => {
        const coverageArray = Array.isArray(coverage) ? coverage : [];
        return (
          <div>
            {coverageArray.slice(0, 2).map((item: string, index: number) => (
              <div key={index} className="flex items-center gap-1 text-sm">
                <CheckCircleOutlined className="text-green-500" />
                <span>{item}</span>
              </div>
            ))}
            {coverageArray.length > 2 && (
              <div className="text-sm text-gray-500">
                {t('admin.warrantyPackages.table.moreBenefits', { count: coverageArray.length - 2 })}
              </div>
            )}
          </div>
        );
      },
    },
    {
      title: t('common.status'),
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'green' : 'red'} icon={isActive ? <CheckCircleOutlined /> : <StopOutlined />}>
          {isActive ? t('admin.warrantyPackages.status.active') : t('admin.warrantyPackages.status.paused')}
        </Tag>
      ),
    },
    {
      title: t('admin.warrantyPackages.table.order'),
      dataIndex: 'sortOrder',
      key: 'sortOrder',
      render: (sortOrder: number) => <span className="font-mono">{sortOrder}</span>,
    },
    {
      title: t('admin.common.actions'),
      key: 'actions',
      render: (_: unknown, record: WarrantyPackage) => (
        <Space>
          <Button type="link" icon={<EditOutlined />} size="small" onClick={() => handleEdit(record)} />
          <Popconfirm
            title={t('admin.warrantyPackages.deleteTitle')}
            description={t('admin.warrantyPackages.deleteConfirm')}
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
              <SafetyOutlined className="text-blue-500" />
              {t('admin.warrantyPackages.title')}
            </h1>
            <p className="text-neutral-600 mt-1">{t('admin.warrantyPackages.subtitle')}</p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate} size="large">
            {t('admin.warrantyPackages.createPackage')}
          </Button>
        </div>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={warrantyPackages}
          rowKey="id"
          loading={isLoading}
          scroll={{ x: 800 }}
          pagination={{
            total: warrantyPackagesData?.data?.pagination?.total || 0,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total, range) => t('admin.warrantyPackages.totalItems', { range0: range[0], range1: range[1], total }),
          }}
        />
      </Card>

      <Modal
        title={editingPackage ? t('admin.warrantyPackages.editPackage') : t('admin.warrantyPackages.createPackageModal')}
        open={isModalOpen}
        onCancel={() => { setIsModalOpen(false); form.resetFields(); setEditingPackage(null); }}
        footer={null}
        width={800}
      >
        <Form form={form} layout="vertical" onFinish={handleSubmit} autoComplete="off">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="name"
                label={t('admin.warrantyPackages.form.name')}
                rules={[{ required: true, message: t('admin.warrantyPackages.form.nameRequired') }]}
              >
                <Input placeholder={t('admin.warrantyPackages.form.namePlaceholder')} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="durationMonths"
                label={t('admin.warrantyPackages.form.duration')}
                rules={[{ required: true, message: t('admin.warrantyPackages.form.durationRequired') }]}
              >
                <InputNumber min={1} max={120} placeholder="12" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="description"
            label={t('admin.warrantyPackages.form.description')}
            rules={[{ required: true, message: t('admin.warrantyPackages.form.descriptionRequired') }]}
          >
            <TextArea rows={2} placeholder={t('admin.warrantyPackages.form.descriptionPlaceholder')} />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="price"
                label={t('admin.warrantyPackages.form.price')}
                rules={[{ required: true, message: t('admin.warrantyPackages.form.priceRequired') }]}
              >
                <InputNumber<number>
                  min={0}
                  placeholder="0"
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => Number(value?.replace(/\$\s?|(,*)/g, '') ?? '')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="sortOrder"
                label={t('admin.warrantyPackages.form.sortOrder')}
                rules={[{ required: true, message: t('admin.warrantyPackages.form.sortOrderRequired') }]}
              >
                <InputNumber min={0} placeholder="0" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="coverage"
            label={t('admin.warrantyPackages.form.coverage')}
            rules={[{ required: true, message: t('admin.warrantyPackages.form.coverageRequired') }]}
          >
            <TextArea rows={4} placeholder={t('admin.warrantyPackages.form.coveragePlaceholder')} />
          </Form.Item>

          <Form.Item name="isActive" label={t('common.status')} valuePropName="checked">
            <Switch
              checkedChildren={t('admin.warrantyPackages.status.active')}
              unCheckedChildren={t('admin.warrantyPackages.status.paused')}
            />
          </Form.Item>

          <Form.Item>
            <Space className="w-full justify-end">
              <Button onClick={() => { setIsModalOpen(false); form.resetFields(); setEditingPackage(null); }}>
                {t('common.cancel')}
              </Button>
              <Button type="primary" htmlType="submit" loading={isCreating || isUpdating}>
                {editingPackage ? t('common.update') : t('common.create')}
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WarrantyPackagesPage;
