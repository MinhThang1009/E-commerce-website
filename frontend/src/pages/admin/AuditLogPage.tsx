import React, { useState } from 'react';
import { Table, Input, Select, DatePicker, Modal, Button, Space, Tag } from 'antd';
import { SearchOutlined, EyeOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import dayjs, { Dayjs } from 'dayjs';
import { api } from '@/services/api';

const { RangePicker } = DatePicker;

interface AuditLog {
  id: number;
  adminId: number;
  action: string;
  entityType: string;
  entityId?: number;
  oldValue?: any;
  newValue?: any;
  ipAddress?: string;
  createdAt: string;
  admin?: { id: number; firstName: string; lastName: string; email: string };
}

interface AuditLogsResponse {
  status: string;
  data: {
    logs: AuditLog[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// RTK Query endpoint cho audit logs — inject vào api slice chính
const auditLogApi = api.injectEndpoints({
  endpoints: (builder) => ({
    getAuditLogs: builder.query<AuditLogsResponse, {
      page?: number;
      limit?: number;
      adminId?: number;
      action?: string;
      startDate?: string;
      endDate?: string;
    }>({
      query: (params = {}) => ({
        url: '/admin/audit-logs',
        params,
      }),
    }),
  }),
});

const { useGetAuditLogsQuery } = auditLogApi;

const AuditLogPage: React.FC = () => {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [adminIdFilter, setAdminIdFilter] = useState<string>('');
  const [actionFilter, setActionFilter] = useState<string>('');
  const [dateRange, setDateRange] = useState<[Dayjs | null, Dayjs | null] | null>(null);
  const [detailRecord, setDetailRecord] = useState<AuditLog | null>(null);

  const queryParams = {
    page,
    limit: 20,
    ...(adminIdFilter ? { adminId: parseInt(adminIdFilter, 10) } : {}),
    ...(actionFilter ? { action: actionFilter } : {}),
    ...(dateRange?.[0] ? { startDate: dateRange[0].toISOString() } : {}),
    ...(dateRange?.[1] ? { endDate: dateRange[1].toISOString() } : {}),
  };

  const { data, isLoading } = useGetAuditLogsQuery(queryParams);

  const logs: AuditLog[] = data?.data?.logs || [];
  const total = data?.data?.total || 0;

  const columns = [
    {
      title: t('auditLog.colTime'),
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => new Date(date).toLocaleString('vi-VN'),
      width: 170,
    },
    {
      title: t('auditLog.colAdmin'),
      key: 'admin',
      render: (_: unknown, record: AuditLog) =>
        record.admin
          ? `${record.admin.firstName} ${record.admin.lastName}`
          : `ID: ${record.adminId}`,
    },
    {
      title: t('auditLog.colAction'),
      dataIndex: 'action',
      key: 'action',
      render: (action: string) => <Tag color="blue">{action}</Tag>,
    },
    {
      title: t('auditLog.colEntity'),
      dataIndex: 'entityType',
      key: 'entityType',
    },
    {
      title: t('auditLog.colId'),
      dataIndex: 'entityId',
      key: 'entityId',
      render: (id?: number) => id ?? '—',
      width: 80,
    },
    {
      title: t('auditLog.colDetail'),
      key: 'detail',
      render: (_: unknown, record: AuditLog) =>
        (record.oldValue || record.newValue) ? (
          <Button
            size="small"
            icon={<EyeOutlined />}
            onClick={() => setDetailRecord(record)}
          >
            {t('auditLog.view')}
          </Button>
        ) : '—',
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{t('auditLog.title')}</h2>
      </div>

      {/* Bộ lọc */}
      <Space wrap style={{ marginBottom: 16 }}>
        <Input
          placeholder={t('auditLog.filterAdminId')}
          prefix={<SearchOutlined />}
          value={adminIdFilter}
          onChange={(e) => { setAdminIdFilter(e.target.value); setPage(1); }}
          style={{ width: 160 }}
          allowClear
          type="number"
        />
        <Input
          placeholder={t('auditLog.filterAction')}
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          style={{ width: 200 }}
          allowClear
        />
        <RangePicker
          value={dateRange}
          onChange={(dates) => { setDateRange(dates); setPage(1); }}
          placeholder={[t('auditLog.startDate'), t('auditLog.endDate')]}
        />
      </Space>

      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page,
          pageSize: 20,
          total,
          onChange: (p) => setPage(p),
          showSizeChanger: false,
          showTotal: (t_) => `${t_} ${t('auditLog.total')}`,
        }}
        size="small"
      />

      {/* Modal chi tiết thay đổi */}
      <Modal
        title={t('auditLog.detailTitle')}
        open={!!detailRecord}
        onCancel={() => setDetailRecord(null)}
        footer={<Button onClick={() => setDetailRecord(null)}>{t('auditLog.close')}</Button>}
        width={700}
      >
        {detailRecord && (
          <div>
            <div style={{ marginBottom: 16 }}>
              <strong>{t('auditLog.oldValue')}:</strong>
              <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, marginTop: 4, overflow: 'auto' }}>
                {detailRecord.oldValue ? JSON.stringify(detailRecord.oldValue, null, 2) : t('auditLog.noData')}
              </pre>
            </div>
            <div>
              <strong>{t('auditLog.newValue')}:</strong>
              <pre style={{ background: '#f5f5f5', padding: 8, borderRadius: 4, marginTop: 4, overflow: 'auto' }}>
                {detailRecord.newValue ? JSON.stringify(detailRecord.newValue, null, 2) : t('auditLog.noData')}
              </pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AuditLogPage;
