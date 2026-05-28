/**
 * @file InventoryPage.tsx
 * @layer Page
 * @feature admin
 * @description Page component của feature admin
 */
import React, { useState } from 'react';
import { Search, Pencil, Save, X, ChevronDown, ChevronRight, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import StatusPill from '../components/StatusPill';
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

const InventoryPage: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification } = useUiStore();
  const [searchText, setSearchText] = useState('');
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<EditingState | null>(null);
  const [editingValue, setEditingValue] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

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

  const totalPages = Math.ceil((data?.data?.pagination?.totalItems || 0) / 20);

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
    return <span>{stock}</span>;
  };

  const renderActionButtons = (isEditing: boolean, onEdit: () => void) => {
    if (isEditing) {
      return (
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button size="sm" onClick={handleSave} disabled={saving}>
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
      <div className="relative rounded-3xl bg-[var(--bg-base)] dark:bg-white/[0.03] border border-[var(--border-default)] p-6 mb-5 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-50 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 100% 0%, rgba(82, 196, 26, 0.10) 0%, transparent 40%), radial-gradient(circle at 0% 100%, rgba(250, 173, 20, 0.08) 0%, transparent 35%)`,
          }}
        />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3">
          <div>
            <span className="section-number">08 / KHO HÀNG</span>
            <div className="flex items-center gap-2.5 mt-2">
              <h1 className="display-heading">{t('inventory.title')}</h1>
              <Sparkles className="w-5 h-5 text-[var(--accent)]/60" aria-hidden="true" />
            </div>
          </div>
          <div className="relative w-full sm:w-[280px]">
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
                  <td colSpan={6} className="text-center py-12 text-neutral-500">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-neutral-500">
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
                            ? 'bg-[var(--admin-error)]/5'
                            : product.stockQuantity <= LOW_STOCK_THRESHOLD
                              ? 'bg-[var(--admin-warning)]/5'
                              : ''
                        }`}
                      >
                        <td className="px-3 py-3 text-center">
                          {hasVariants && (
                            <button
                              onClick={() => toggleExpand(product.key)}
                              className="text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                            >
                              {isExpanded ? (
                                <ChevronDown className="size-4" />
                              ) : (
                                <ChevronRight className="size-4" />
                              )}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-3 dark:text-neutral-200 truncate max-w-[300px]">
                          {product.name}
                        </td>
                        <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                          {hasVariants ? `${product.variants.length} biến thể` : '—'}
                        </td>
                        <td className="px-4 py-3 dark:text-neutral-200">
                          {hasVariants ? (
                            <span>{product.stockQuantity}</span>
                          ) : (
                            renderStockCell(product.stockQuantity, isEditingProduct)
                          )}
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
                                  ? 'bg-[var(--admin-error)]/5'
                                  : variant.stockQuantity <= LOW_STOCK_THRESHOLD
                                    ? 'bg-[var(--admin-warning)]/5'
                                    : ''
                              }`}
                            >
                              <td className="px-3 py-2" />
                              <td className="px-4 py-2 pl-12 dark:text-neutral-300">
                                {variant.name}
                              </td>
                              <td className="px-4 py-2 text-neutral-600 dark:text-neutral-400">
                                {variant.sku || '—'}
                              </td>
                              <td className="px-4 py-2 dark:text-neutral-200">
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
