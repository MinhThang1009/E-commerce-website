import React, { useState } from 'react';
import { Table, Input, Button, Tag, Space, Tooltip, message } from 'antd';
import { EditOutlined, SaveOutlined, CloseOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useGetAdminProductsQuery } from '../api/adminProductApi';

interface ProductRow {
  id: number;
  name: string;
  sku?: string;
  stockQuantity: number;
  status: string;
}

const LOW_STOCK_THRESHOLD = 5;

const InventoryPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [savingId, setSavingId] = useState<number | null>(null);

  const { data, isLoading, refetch } = useGetAdminProductsQuery({
    page,
    limit: 20,
    search: searchText || undefined,
  });

  const products: ProductRow[] = (data?.data?.products || []).map((p) => ({
    id: typeof p.id === 'string' ? parseInt(p.id, 10) : p.id as unknown as number,
    name: p.name,
    sku: p.sku,
    stockQuantity: (p as { stockQuantity?: number }).stockQuantity ?? 0,
    status: p.status,
  }));

  const handleEdit = (record: ProductRow) => {
    setEditingId(record.id);
    setEditingValue(String(record.stockQuantity));
  };

  const handleCancel = () => {
    setEditingId(null);
    setEditingValue('');
  };

  const handleSave = async (record: ProductRow) => {
    const qty = parseInt(editingValue, 10);
    if (isNaN(qty) || qty < 0) {
      message.error(t('inventory.invalidQty'));
      return;
    }
    setSavingId(record.id);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8888/api';
      const { getValidToken } = await import('@/utils/tokenManager');
      const token = await getValidToken();
      const res = await fetch(`${apiBase}/admin/products/${record.id}/stock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ stockQuantity: qty }),
      });
      const resData = await res.json();
      if (!res.ok || resData.status !== 'success') {
        message.error(t('inventory.updateError'));
      } else {
        message.success(t('inventory.updateSuccess'));
        setEditingId(null);
        refetch();
      }
    } catch {
      message.error(t('inventory.updateError'));
    } finally {
      setSavingId(null);
    }
  };

  const getStockBadge = (stock: number) => {
    if (stock === 0) return <Tag color="red">{t('inventory.outOfStock')}</Tag>;
    if (stock <= LOW_STOCK_THRESHOLD) return <Tag color="orange">{t('inventory.lowStock')}</Tag>;
    return <Tag color="green">{t('inventory.inStock')}</Tag>;
  };

  const columns = [
    {
      title: t('inventory.colProduct'),
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: t('inventory.colSku'),
      dataIndex: 'sku',
      key: 'sku',
      render: (sku?: string) => sku || '—',
    },
    {
      title: t('inventory.colStock'),
      dataIndex: 'stockQuantity',
      key: 'stockQuantity',
      render: (_: number, record: ProductRow) => {
        if (editingId === record.id) {
          return (
            <Input
              type="number"
              min={0}
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              style={{ width: 80 }}
              autoFocus
            />
          );
        }
        return <span>{record.stockQuantity}</span>;
      },
    },
    {
      title: t('inventory.colStatus'),
      key: 'stockStatus',
      render: (_: unknown, record: ProductRow) => getStockBadge(record.stockQuantity),
    },
    {
      title: t('inventory.colAction'),
      key: 'action',
      render: (_: unknown, record: ProductRow) => {
        if (editingId === record.id) {
          return (
            <Space>
              <Tooltip title={t('inventory.save')}>
                <Button
                  type="primary"
                  size="small"
                  icon={<SaveOutlined />}
                  loading={savingId === record.id}
                  onClick={() => handleSave(record)}
                />
              </Tooltip>
              <Tooltip title={t('inventory.cancel')}>
                <Button size="small" icon={<CloseOutlined />} onClick={handleCancel} />
              </Tooltip>
            </Space>
          );
        }
        return (
          <Tooltip title={t('inventory.editStock')}>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={() => handleEdit(record)}
            />
          </Tooltip>
        );
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>{t('inventory.title')}</h2>
        <Input
          placeholder={t('inventory.searchPlaceholder')}
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => { setSearchText(e.target.value); setPage(1); }}
          style={{ width: 260 }}
          allowClear
        />
      </div>

      <Table
        columns={columns}
        dataSource={products}
        rowKey="id"
        loading={isLoading}
        pagination={{
          current: page,
          pageSize: 20,
          total: data?.data?.pagination?.totalItems || 0,
          onChange: (p) => setPage(p),
          showSizeChanger: false,
        }}
        rowClassName={(record: ProductRow) =>
          record.stockQuantity === 0 ? 'ant-table-row-danger' : ''
        }
      />
    </div>
  );
};

export default InventoryPage;
