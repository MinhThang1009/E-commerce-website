/**
 * @file InventoryPage.tsx
 * @layer Page
 * @feature admin
 * @description Page component của feature admin
 */
import React, { useState, useMemo } from 'react';
import {
  Search,
  Pencil,
  Save,
  X,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Boxes,
  AlertTriangle,
  PackageX,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/utils/cn';
import StatusPill from '../components/StatusPill';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminStatCard from '../components/AdminStatCard';
import { useGetAdminProductsQuery } from '../api/admin-product-api';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Pagination } from '@/components/common';
import { useUiStore } from '@/stores/ui-store';

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

// Ngưỡng hiển thị thanh tồn kho (cap trực quan) + màu theo mức
const STOCK_BAR_MAX = 100;
function stockColor(s: number): string {
  if (s === 0) return 'var(--color-danger)';
  if (s <= LOW_STOCK_THRESHOLD) return 'var(--color-warning)';
  return 'var(--color-success)';
}

const InventoryPage: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification } = useUiStore();
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const { data, isLoading, isFetching, refetch } = useGetAdminProductsQuery({
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

  const totalPages = Math.ceil((data?.data?.pagination?.totalItems || 0) / 20);

  // Aggregate cho StatStrip — tính từ sản phẩm đã tải (data thật)
  const stats = useMemo(() => {
    let totalStock = 0;
    let lowStock = 0;
    let outOfStock = 0;
    for (const p of products) {
      totalStock += p.stockQuantity;
      if (p.stockQuantity === 0) outOfStock += 1;
      else if (p.stockQuantity <= LOW_STOCK_THRESHOLD) lowStock += 1;
    }
    return { totalStock, lowStock, outOfStock };
  }, [products]);

  const getStockBadge = (stock: number) => {
    if (stock === 0) return <StatusPill variant="error" label={t('inventory.outOfStock')} />;
    if (stock <= LOW_STOCK_THRESHOLD)
      return <StatusPill variant="warning" label={t('inventory.lowStock')} />;
    return <StatusPill variant="success" label={t('inventory.inStock')} />;
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
      addNotification({ type: 'error', message: t('inventory.invalidQty') });
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
        addNotification({ type: 'error', message: t('inventory.updateError') });
      } else {
        addNotification({ type: 'success', message: t('inventory.updateSuccess') });
        setEditing(null);
        refetch();
      }
    } catch {
      addNotification({ type: 'error', message: t('inventory.updateError') });
    } finally {
      setSaving(false);
    }
  };

  const toggleExpand = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const renderStockCell = (stock: number, isEditing: boolean) => {
    if (isEditing) {
      return (
        <Input
          type="number"
          min={0}
          value={editingValue}
          onChange={(e) => setEditingValue(e.target.value)}
          className="w-20 h-8"
          autoFocus
        />
      );
    }
    const sc = stockColor(stock);
    const pct = stock === 0 ? 0 : Math.min(100, (stock / STOCK_BAR_MAX) * 100);
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs font-bold tabular-nums w-10 text-right" style={{ color: sc }}>
          {stock}
        </span>
        <div className="h-1.5 flex-1 max-w-[80px] rounded-full bg-[var(--border-default)] overflow-hidden">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: sc }} />
        </div>
      </div>
    );
  };

  const renderActionButtons = (isEditing: boolean, onEdit: () => void) => {
    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="sm"
                className="admin-btn-primary"
                onClick={handleSave}
                disabled={saving}
              >
                <Save className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('inventory.save')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" size="sm" onClick={handleCancel}>
                <X className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>{t('inventory.cancel')}</TooltipContent>
          </Tooltip>
        </div>
      );
    }
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="outline" size="sm" onClick={onEdit}>
            <Pencil className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>{t('inventory.editStock')}</TooltipContent>
      </Tooltip>
    );
  };

  return (
    <div>
      {/* Page header */}
      <AdminPageHeader
        sectionNumber="08 / KHO HÀNG"
        title={t('inventory.title')}
        gradientTitle
        sparkle
        subtitle={t('inventory.subtitle')}
        actions={
          <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw
              className={cn('w-4 h-4 mr-2', isFetching && 'animate-spin')}
              strokeWidth={2.25}
            />
            {t('common.refresh')}
          </Button>
        }
      />

      {/* StatStrip — tổng tồn / sắp hết / hết hàng */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <AdminStatCard
          label={t('inventory.stats.totalStock')}
          value={stats.totalStock}
          icon={Boxes}
          accentVar="--accent"
          isLoading={isLoading}
        />
        <AdminStatCard
          label={t('inventory.stats.lowStock')}
          value={stats.lowStock}
          icon={AlertTriangle}
          accentVar="--color-warning"
          isLoading={isLoading}
        />
        <AdminStatCard
          label={t('inventory.stats.outOfStock')}
          value={stats.outOfStock}
          icon={PackageX}
          accentVar="--color-danger"
          isLoading={isLoading}
        />
      </div>

      {/* Filter bar — search */}
      <div className="rounded-2xl bg-[var(--bg-base)] dark:bg-white/[0.03] border border-[var(--border-default)] p-4 mb-5 shadow-sm">
        <div className="relative w-full sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] pointer-events-none" />
          <Input
            placeholder={t('inventory.searchPlaceholder')}
            value={searchText}
            onChange={(e) => {
              setSearchText(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-[var(--bg-base)] dark:bg-white/[0.03] border border-[var(--border-default)] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-white/[0.02]">
              <tr>
                <th className="w-10 px-3 py-3" />
                {['colProduct', 'colSku', 'colStock', 'colStatus', 'colAction'].map((key) => (
                  <th
                    key={key}
                    className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]"
                  >
                    {t(`inventory.${key}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[var(--text-tertiary)]">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-[var(--text-tertiary)]">
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const hasVariants = product.variants.length > 0;
                  const isExpanded = expandedRows.has(product.key);
                  const isEditingProduct =
                    editing?.productId === product.id && editing?.variantId === undefined;

                  return (
                    <React.Fragment key={product.key}>
                      <tr
                        className={`border-t border-[var(--border-default)] hover:bg-white/[0.03] transition ${
                          product.stockQuantity === 0
                            ? 'bg-[var(--color-danger)]/5'
                            : product.stockQuantity <= LOW_STOCK_THRESHOLD
                              ? 'bg-[var(--color-warning)]/5'
                              : ''
                        }`}
                      >
                        <td className="px-3 py-3 text-center">
                          {hasVariants && (
                            <button
                              onClick={() => toggleExpand(product.key)}
                              className="text-[var(--text-tertiary)] hover:text-[var(--text-primary)]"
                            >
                              {isExpanded ? (
                                <ChevronDown className="size-4" />
                              ) : (
                                <ChevronRight className="size-4" />
                              )}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-primary)] truncate max-w-[300px]">
                          {product.name}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-secondary)]">
                          {hasVariants ? `${product.variants.length} biến thể` : '—'}
                        </td>
                        <td className="px-4 py-3 text-[var(--text-primary)]">
                          {hasVariants
                            ? renderStockCell(product.stockQuantity, false)
                            : renderStockCell(product.stockQuantity, isEditingProduct)}
                        </td>
                        <td className="px-4 py-3">{getStockBadge(product.stockQuantity)}</td>
                        <td className="px-4 py-3">
                          {!hasVariants &&
                            renderActionButtons(isEditingProduct, () =>
                              handleEdit(product.id, product.stockQuantity),
                            )}
                        </td>
                      </tr>
                      {/* Expanded variant rows */}
                      {hasVariants &&
                        isExpanded &&
                        product.variants.map((variant) => {
                          const isEditingVariant =
                            editing?.productId === product.id && editing?.variantId === variant.id;
                          return (
                            <tr
                              key={variant.key}
                              className={`border-t border-[var(--border-default)] bg-white/[0.01] ${
                                variant.stockQuantity === 0
                                  ? 'bg-[var(--color-danger)]/5'
                                  : variant.stockQuantity <= LOW_STOCK_THRESHOLD
                                    ? 'bg-[var(--color-warning)]/5'
                                    : ''
                              }`}
                            >
                              <td className="px-3 py-2" />
                              <td className="px-4 py-2 pl-12 text-[var(--text-secondary)]">
                                {variant.name}
                              </td>
                              <td className="px-4 py-2 text-[var(--text-secondary)]">
                                {variant.sku || '—'}
                              </td>
                              <td className="px-4 py-2 text-[var(--text-primary)]">
                                {renderStockCell(variant.stockQuantity, isEditingVariant)}
                              </td>
                              <td className="px-4 py-2">{getStockBadge(variant.stockQuantity)}</td>
                              <td className="px-4 py-2">
                                {renderActionButtons(isEditingVariant, () =>
                                  handleEdit(product.id, variant.stockQuantity, variant.id),
                                )}
                              </td>
                            </tr>
                          );
                        })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-[var(--border-default)]">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default InventoryPage;
