/**
 * @file InventoryPage.tsx
 * @layer Page
 * @feature admin
 * @description Page component của feature admin
 */
import React, { useState } from 'react';
import { Search, Pencil, Save, X, ChevronDown, ChevronRight } from 'lucide-react';
import { useTranslation } from 'react-i18next';
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
    if (stock === 0)
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
          {t('inventory.outOfStock')}
        </span>
      );
    if (stock <= LOW_STOCK_THRESHOLD)
      return (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400">
          {t('inventory.lowStock')}
        </span>
      );
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
        {t('inventory.inStock')}
      </span>
    );
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
    <div className="p-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold dark:text-white">{t('inventory.title')}</h2>
        <div className="relative w-[260px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
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

      <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
              <th className="w-10 px-3 py-3" />
              <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300">
                {t('inventory.colProduct')}
              </th>
              <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300">
                {t('inventory.colSku')}
              </th>
              <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300">
                {t('inventory.colStock')}
              </th>
              <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300">
                {t('inventory.colStatus')}
              </th>
              <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300">
                {t('inventory.colAction')}
              </th>
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
                      className={`border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50 ${
                        product.stockQuantity === 0 ? 'bg-red-50/50 dark:bg-red-900/10' : ''
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
                            className={`border-b border-neutral-100 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30 ${
                              variant.stockQuantity === 0 ? 'bg-red-50/30 dark:bg-red-900/10' : ''
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
        <Pagination currentPage={page} totalPages={totalPages} onPageChange={(p) => setPage(p)} />
      )}
    </div>
  );
};

export default InventoryPage;
