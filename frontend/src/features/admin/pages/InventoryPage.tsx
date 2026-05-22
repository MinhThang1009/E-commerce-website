/**
 * @file InventoryPage.tsx
 * @layer Page
 * @feature admin
 * @description Page component của feature admin
 */
import React, { useState } from 'react';
import { Table, Input, Button, Tag, Space, Tooltip, App } from 'antd';
import { EditOutlined, SaveOutlined, CloseOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { useGetAdminProductsQuery } from '../api/admin-product-api';

interface VariantRow {
  key: string;
  id: number;
  productId: number;
  name: string;
  sku?: string;
  stockQuantity: number;
}

interface ProductRow {
  key: string;
  id: number;
  name: string;
  stockQuantity: number;
  status: string;
  variants: VariantRow[];
}

interface EditingState {
  productId: number;
  variantId?: number;
}

const LOW_STOCK_THRESHOLD = 5;

const InventoryPage: React.FC = () => {
  const { t } = useTranslation();
  const { message } = App.useApp();
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [saving, setSaving] = useState(false);

  const { data, isLoading, refetch } = useGetAdminProductsQuery({
    page,
    limit: 20,
    search: searchText || undefined,
  });

  const products: ProductRow[] = (data?.data?.products || []).map((p) => {
    const productId = typeof p.id === 'string' ? parseInt(p.id, 10) : (p.id as unknown as number);

    const variants: VariantRow[] = (p.variants || []).map((v) => ({
      key: `variant-${v.id}`,
      id: typeof v.id === 'string' ? parseInt(v.id, 10) : (v.id as unknown as number),
      productId,
      name: v.name,
      sku: v.sku,
      stockQuantity: v.stockQuantity ?? 0,
    }));

    const totalStock =
      variants.length > 0
        ? variants.reduce((sum, v) => sum + v.stockQuantity, 0)
        : ((p as unknown as { stockQuantity?: number }).stockQuantity ?? 0);

    return {
      key: `product-${p.id}`,
      id: productId,
      name: p.name,
      stockQuantity: totalStock,
      status: p.status,
      variants,
    };
  });

  const getStockBadge = (stock: number) => {
    if (stock === 0) return <Tag color="red">{t('inventory.outOfStock')}</Tag>;
    if (stock <= LOW_STOCK_THRESHOLD) return <Tag color="orange">{t('inventory.lowStock')}</Tag>;
    return <Tag color="green">{t('inventory.inStock')}</Tag>;
  };

  const handleEdit = (productId: number, stock: number, variantId?: number) => {
    setEditing({ productId, variantId });
    setEditingValue(String(stock));
  };

  const handleCancel = () => {
    setEditing(null);
    setEditingValue('');
  };

  const handleSave = async () => {
    if (!editing) return;
    const qty = parseInt(editingValue, 10);
    if (isNaN(qty) || qty < 0) {
      message.error(t('inventory.invalidQty'));
      return;
    }
    setSaving(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8888/api';
      const { getValidToken } = await import('@/utils/token-manager');
      const token = await getValidToken();
      const body: Record<string, unknown> = { stockQuantity: qty };
      if (editing.variantId !== undefined) body.variantId = editing.variantId;

      const res = await fetch(`${apiBase}/admin/products/${editing.productId}/stock`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const resData = await res.json();
      if (!res.ok || resData.status !== 'success') {
        message.error(t('inventory.updateError'));
      } else {
        message.success(t('inventory.updateSuccess'));
        setEditing(null);
        refetch();
      }
    } catch {
      message.error(t('inventory.updateError'));
    } finally {
      setSaving(false);
    }
  };

  const renderStockCell = (stock: number, isEditing: boolean) => {
    if (isEditing) {
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
    return <span>{stock}</span>;
  };

  const renderActionButtons = (isEditing: boolean, onEdit: () => void) => {
    if (isEditing) {
      return (
        <Space>
          <Tooltip title={t('inventory.save')}>
            <Button
              type="primary"
              size="small"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSave}
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
        <Button size="small" icon={<EditOutlined />} onClick={onEdit} />
      </Tooltip>
    );
  };

  const expandedRowRender = (product: ProductRow) => {
    const variantColumns = [
      {
        title: t('inventory.colVariant'),
        dataIndex: 'name',
        key: 'name',
      },
      {
        title: t('inventory.colSku'),
        dataIndex: 'sku',
        key: 'sku',
        render: (sku?: string) => sku || '—',
      },
      {
        title: t('inventory.colStock'),
        key: 'stock',
        render: (_: unknown, record: VariantRow) => {
          const isEditing = editing?.productId === product.id && editing?.variantId === record.id;
          return renderStockCell(record.stockQuantity, isEditing);
        },
      },
      {
        title: t('inventory.colStatus'),
        key: 'status',
        render: (_: unknown, record: VariantRow) => getStockBadge(record.stockQuantity),
      },
      {
        title: t('inventory.colAction'),
        key: 'action',
        render: (_: unknown, record: VariantRow) => {
          const isEditing = editing?.productId === product.id && editing?.variantId === record.id;
          return renderActionButtons(isEditing, () =>
            handleEdit(product.id, record.stockQuantity, record.id),
          );
        },
      },
    ];

    return (
      <Table
        columns={variantColumns}
        dataSource={product.variants}
        rowKey="key"
        pagination={false}
        size="small"
        style={{ marginLeft: 48 }}
        rowClassName={(record: VariantRow) =>
          record.stockQuantity === 0 ? 'ant-table-row-danger' : ''
        }
      />
    );
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
      key: 'sku',
      render: (_: unknown, record: ProductRow) =>
        record.variants.length > 0 ? `${record.variants.length} biến thể` : '—',
    },
    {
      title: t('inventory.colStock'),
      key: 'stock',
      render: (_: unknown, record: ProductRow) => {
        if (record.variants.length > 0) return <span>{record.stockQuantity}</span>;
        const isEditing = editing?.productId === record.id && editing?.variantId === undefined;
        return renderStockCell(record.stockQuantity, isEditing);
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
        if (record.variants.length > 0) return null;
        const isEditing = editing?.productId === record.id && editing?.variantId === undefined;
        return renderActionButtons(isEditing, () => handleEdit(record.id, record.stockQuantity));
      },
    },
  ];

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <h2 style={{ margin: 0 }}>{t('inventory.title')}</h2>
        <Input
          placeholder={t('inventory.searchPlaceholder')}
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => {
            setSearchText(e.target.value);
            setPage(1);
          }}
          style={{ width: 260 }}
          allowClear
        />
      </div>

      <Table
        columns={columns}
        dataSource={products}
        rowKey="key"
        loading={isLoading}
        expandable={{
          expandedRowRender,
          rowExpandable: (record: ProductRow) => record.variants.length > 0,
        }}
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
