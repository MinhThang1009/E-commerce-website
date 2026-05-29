/**
 * @file ProductsPage.tsx
 * @layer Page
 * @feature admin
 * @description Quản lý sản phẩm — list + filter + table với glass design (spec §7, §16.2)
 */
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  Eye,
  Copy,
  Download,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Package as PackageIcon,
  CheckCircle2,
  AlertTriangle,
  PackageX,
  X,
} from 'lucide-react';
import {
  useGetAdminProductsQuery,
  useDeleteProductMutation,
  useCloneProductMutation,
  useUpdateProductStatusMutation,
  useLazyGetAdminProductsQuery,
} from '@/features/admin';
import { useGetAllCategoriesQuery } from '@features/catalog/api/category-api';
import { ProductExportModal } from '@/features/admin';
import { buildRoute } from '@/routes/paths';
import { calculatePriceRange } from '@/utils/price-utils';
import { formatPrice } from '@/utils/format';
import { useUiStore } from '@/stores/ui-store';
import { cn } from '@/utils/cn';
import {
  Button,
  Input,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui';
import StatusPill, { type StatusVariant } from '../../components/StatusPill';
import AdminPageHeader from '../../components/AdminPageHeader';
import AdminStatCard from '../../components/AdminStatCard';
import AdminMobileCard from '../../components/AdminMobileCard';

interface AdminProductRow {
  id: string;
  name: string;
  description?: string;
  price: number;
  stockQuantity?: number;
  stock?: number;
  status: string;
  images?: string[];
  categories?: Array<{ id: string; name: string }>;
  variants?: Array<{ price: number | string; stockQuantity?: number }>;
  [key: string]: unknown;
}

const easeOutQuart = [0.22, 1, 0.36, 1] as const;
const rowStagger = {
  animate: { transition: { staggerChildren: 0.025 } },
};
const rowItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: easeOutQuart } },
};

// Map product status → StatusPill variant
const STATUS_VARIANT: Record<string, StatusVariant> = {
  active: 'success',
  inactive: 'warning',
  draft: 'neutral',
};

// Màu category chip — deterministic theo tên (mỗi danh mục 1 màu ổn định)
const CAT_PALETTE = [
  '#2aaca7',
  '#8b5cf6',
  '#f59e0b',
  '#3b82f6',
  '#ec4899',
  '#06b6d4',
  '#10b981',
  '#ef4444',
];
function categoryColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return CAT_PALETTE[h % CAT_PALETTE.length];
}

// Ngưỡng hiển thị thanh tồn kho (cap trực quan) + màu theo mức
const STOCK_BAR_MAX = 150;
function stockColor(s: number): string {
  if (s === 0) return 'var(--color-danger)';
  if (s < 20) return 'var(--color-warning)';
  return 'var(--color-success)';
}

const ProductsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addNotification = useUiStore((s) => s.addNotification);

  const statusOptions = [
    { value: 'all', label: t('admin.products.filters.allStatus') },
    { value: 'active', label: t('admin.products.status.active') },
    { value: 'inactive', label: t('admin.products.status.inactive') },
    { value: 'draft', label: t('admin.products.status.draft') },
  ];

  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [selectedRows, setSelectedRows] = useState<AdminProductRow[]>([]);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<AdminProductRow | null>(null);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useGetAllCategoriesQuery();

  const {
    data: productsResponse,
    error,
    isLoading,
    refetch,
  } = useGetAdminProductsQuery({
    page: currentPage,
    limit: 10,
    search: searchTerm || undefined,
    category: categoryFilter !== 'all' ? categoryFilter : undefined,
    status: statusFilter !== 'all' ? statusFilter : undefined,
    sortBy,
    sortOrder,
  });

  const { mutateAsync: deleteProduct } = useDeleteProductMutation();
  const { mutateAsync: cloneProduct, isPending: isCloning } = useCloneProductMutation();
  const { mutateAsync: updateProductStatus } = useUpdateProductStatusMutation();
  const { trigger: triggerGetProducts } = useLazyGetAdminProductsQuery();
  const [isFetchingForExport] = useState(false);

  const products = useMemo(
    () => productsResponse?.data?.products || [],
    [productsResponse?.data?.products],
  );
  const pagination = productsResponse?.data?.pagination;

  // Query full list (limit cao) để tính StatStrip chính xác — data thật, không bịa
  const { data: allProductsResponse, isLoading: isStatsLoading } = useGetAdminProductsQuery({
    page: 1,
    limit: 1000,
  });
  const productStats = useMemo(() => {
    const list = (allProductsResponse?.data?.products || []) as unknown as AdminProductRow[];
    const stockOf = (p: AdminProductRow): number => {
      if (p.variants && p.variants.length > 0) {
        return p.variants.reduce((s, v) => s + (v.stockQuantity ?? 0), 0);
      }
      return p.stockQuantity ?? p.stock ?? 0;
    };
    let active = 0;
    let lowStock = 0;
    let outOfStock = 0;
    for (const p of list) {
      if (p.status === 'active') active += 1;
      const s = stockOf(p);
      if (s === 0) outOfStock += 1;
      else if (s < 20) lowStock += 1;
    }
    return { total: list.length, active, lowStock, outOfStock };
  }, [allProductsResponse]);

  const rawCategories = categoriesResponse?.data;
  const apiCategories = useMemo(() => {
    return Array.isArray(rawCategories) ? rawCategories : rawCategories ? [rawCategories] : [];
  }, [rawCategories]);

  const categoryOptions = [
    { value: 'all', label: t('admin.products.filters.allCategories') },
    ...(Array.isArray(apiCategories)
      ? apiCategories.map((cat: { id: string; name: string }) => ({
          value: cat.id,
          label: cat.name,
        }))
      : []),
  ];

  const handleDeleteProduct = async (productId: string) => {
    try {
      await deleteProduct(productId);
      addNotification({ message: t('admin.products.messages.deleteSuccess'), type: 'success' });
      refetch();
    } catch (e) {
      addNotification({ message: t('admin.products.messages.deleteError'), type: 'error' });
      console.error('Xóa sản phẩm thất bại:', e);
    }
    setDeleteConfirmId(null);
  };

  const handleStatusChange = async (productId: string, newStatus: string) => {
    try {
      await updateProductStatus({ id: productId, status: newStatus });
      addNotification({ message: t('admin.products.messages.statusSuccess'), type: 'success' });
    } catch (e) {
      addNotification({ message: t('admin.products.messages.statusError'), type: 'error' });
      console.error('Thay đổi trạng thái thất bại:', e);
    }
  };

  const handleCloneProduct = async (productId: string) => {
    try {
      await cloneProduct(productId);
      addNotification({ message: t('admin.products.messages.cloneSuccess'), type: 'success' });
      refetch();
    } catch (e) {
      addNotification({ message: t('admin.products.messages.cloneError'), type: 'error' });
      console.error('Nhân bản sản phẩm thất bại:', e);
    }
  };

  const handleExportAll = async (exportFilters: Record<string, unknown>) => {
    try {
      const result = await triggerGetProducts({
        ...exportFilters,
        limit: 99999,
      });
      return result?.data?.products || [];
    } catch (e) {
      console.error('Lấy sản phẩm để xuất thất bại:', e);
      throw e;
    }
  };

  const openQuickView = (product: AdminProductRow) => {
    setSelectedProduct(product);
    setIsQuickViewOpen(true);
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchTerm, categoryFilter, statusFilter]);

  const calculateDisplayPrice = (product: AdminProductRow) => {
    if (product.variants && product.variants.length > 0) {
      const prices = product.variants.map((variant) => parseFloat(String(variant.price)));
      const minPrice = Math.min(...prices);
      return formatPrice(minPrice);
    }
    return formatPrice(product.price);
  };

  const handleSort = (field: string) => {
    if (sortBy === field) {
      if (sortOrder === 'ASC') {
        setSortOrder('DESC');
      } else {
        setSortBy('createdAt');
        setSortOrder('DESC');
      }
    } else {
      setSortBy(field);
      setSortOrder('ASC');
    }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortBy !== field) return <ChevronUp className="w-3 h-3 opacity-30" />;
    return sortOrder === 'ASC' ? (
      <ChevronUp className="w-3 h-3" />
    ) : (
      <ChevronDown className="w-3 h-3" />
    );
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allKeys = (products as unknown as AdminProductRow[]).map((p) => p.id);
      setSelectedRowKeys(allKeys);
      setSelectedRows(products as unknown as AdminProductRow[]);
    } else {
      setSelectedRowKeys([]);
      setSelectedRows([]);
    }
  };

  const handleSelectRow = (product: AdminProductRow, checked: boolean) => {
    if (checked) {
      setSelectedRowKeys((prev) => [...prev, product.id]);
      setSelectedRows((prev) => [...prev, product]);
    } else {
      setSelectedRowKeys((prev) => prev.filter((k) => k !== product.id));
      setSelectedRows((prev) => prev.filter((r) => r.id !== product.id));
    }
  };

  // ===== Error state =====
  if (error) {
    return (
      <div>
        <div className="mb-6">
          <span className="section-number">05 / SẢN PHẨM</span>
          <h1 className="display-heading mt-2">{t('admin.products.title')}</h1>
        </div>
        <div className="glass-card-lg p-10 text-center">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--color-danger)]/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-[var(--color-danger)]" strokeWidth={1.5} />
          </div>
          <h2 className="text-lg font-semibold mb-2">{t('admin.products.messages.loadError')}</h2>
          <Button variant="outline" onClick={() => refetch()}>
            {t('admin.products.actions.retry')}
          </Button>
        </div>
      </div>
    );
  }

  const productList = products as unknown as AdminProductRow[];
  const isEmpty = !isLoading && productList.length === 0;
  const totalPages = pagination?.totalPages || 1;

  return (
    <div>
      <AdminPageHeader
        sectionNumber="05 / SẢN PHẨM"
        title={t('admin.products.title')}
        gradientTitle
        sparkle
        subtitle={
          pagination?.totalItems
            ? t('admin.products.stats', {
                totalItems: pagination.totalItems,
                totalPages: pagination.totalPages,
              })
            : t('admin.products.subtitle')
        }
        actions={
          <>
            <Button variant="outline" onClick={() => setIsExportModalOpen(true)}>
              <Download className="w-4 h-4 mr-2" strokeWidth={2.25} />
              {t('admin.products.actions.export')}
            </Button>
            <Button
              className="admin-btn-primary"
              onClick={() => navigate('/admin/products/create')}
            >
              <Plus className="w-4 h-4 mr-2" strokeWidth={2.25} />
              {t('admin.products.actions.add')}
            </Button>
          </>
        }
      />

      {/* StatStrip — tổng / đang bán / sắp hết / hết hàng (data thật) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        <AdminStatCard
          label={t('admin.products.statCards.total')}
          value={productStats.total}
          icon={PackageIcon}
          accentVar="--accent"
          isLoading={isStatsLoading}
        />
        <AdminStatCard
          label={t('admin.products.statCards.active')}
          value={productStats.active}
          icon={CheckCircle2}
          accentVar="--color-success"
          isLoading={isStatsLoading}
        />
        <AdminStatCard
          label={t('admin.products.statCards.lowStock')}
          value={productStats.lowStock}
          icon={AlertTriangle}
          accentVar="--color-warning"
          isLoading={isStatsLoading}
        />
        <AdminStatCard
          label={t('admin.products.statCards.outOfStock')}
          value={productStats.outOfStock}
          icon={PackageX}
          accentVar="--color-danger"
          isLoading={isStatsLoading}
        />
      </div>

      {/* Filter bar — glass card */}
      <div className="rounded-2xl bg-[var(--bg-base)] dark:bg-white/[0.03] border border-[var(--border-default)] p-4 mb-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          <div className="md:col-span-6 relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] pointer-events-none"
              aria-hidden="true"
            />
            <Input
              placeholder={t('admin.products.filters.searchPlaceholder')}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <div className="md:col-span-3">
            <Select
              value={categoryFilter}
              onValueChange={setCategoryFilter}
              disabled={isCategoriesLoading}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('admin.products.filters.categoryPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {categoryOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-3">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('admin.products.filters.statusPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Bulk-action bar — hiện khi có sản phẩm được chọn */}
      {selectedRowKeys.length > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-2.5 mb-3 rounded-2xl bg-[var(--accent)]/10 border border-[var(--accent)]/25">
          <span className="text-sm font-medium text-[var(--text-primary)]">
            {t('admin.products.bulk.selected', {
              count: selectedRowKeys.length,
              defaultValue: 'Đã chọn {{count}} sản phẩm',
            })}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setIsExportModalOpen(true)}>
              <Download className="w-3.5 h-3.5 mr-1.5" strokeWidth={2.25} />
              {t('admin.products.bulk.export', { defaultValue: 'Xuất đã chọn' })}
            </Button>
            <button
              type="button"
              onClick={() => {
                setSelectedRowKeys([]);
                setSelectedRows([]);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-[var(--text-secondary)] hover:bg-white/5 transition"
            >
              <X className="w-3.5 h-3.5" strokeWidth={2.25} />
              {t('admin.products.bulk.clear', { defaultValue: 'Bỏ chọn' })}
            </button>
          </div>
        </div>
      )}

      {/* Table card */}
      <div className="admin-card-glow rounded-2xl bg-[var(--bg-base)] dark:bg-white/[0.03] border border-[var(--border-default)] overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="shimmer h-14 rounded-lg" />
            ))}
          </div>
        ) : isEmpty ? (
          // Empty state với icon đẹp
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="relative w-20 h-20 mb-5">
              <div className="absolute inset-0 rounded-3xl bg-[var(--accent)]/10 blur-2xl" />
              <div className="relative w-full h-full rounded-3xl bg-gradient-to-br from-[var(--accent)]/15 to-[var(--color-secondary)]/10 flex items-center justify-center border border-[var(--accent)]/20">
                <PackageIcon className="w-10 h-10 text-[var(--accent)]" strokeWidth={1.5} />
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-1.5 text-[var(--text-primary)]">
              {t('admin.products.empty.title', { defaultValue: 'Chưa có sản phẩm nào' })}
            </h3>
            <p className="text-sm text-[var(--text-tertiary)] text-center max-w-sm mb-6">
              {t('admin.products.empty.description', {
                defaultValue: 'Tạo sản phẩm đầu tiên để bắt đầu bán hàng trên TechStore.',
              })}
            </p>
            <Button
              className="admin-btn-primary"
              onClick={() => navigate('/admin/products/create')}
            >
              <Plus className="w-4 h-4 mr-2" strokeWidth={2.25} />
              {t('admin.products.actions.add')}
            </Button>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-[var(--bg-surface)] dark:bg-white/[0.02]">
                  <tr>
                    <th className="px-4 py-3 text-left w-10">
                      <input
                        type="checkbox"
                        className="admin-checkbox"
                        checked={
                          productList.length > 0 && selectedRowKeys.length === productList.length
                        }
                        onChange={(e) => handleSelectAll(e.target.checked)}
                        aria-label={t('admin.products.table.image')}
                      />
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] w-20">
                      {t('admin.products.table.image')}
                    </th>
                    <th className="px-4 py-3 text-left">
                      <button
                        type="button"
                        onClick={() => handleSort('name')}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] hover:text-[var(--accent)] transition"
                      >
                        {t('admin.products.table.name')}
                        <SortIcon field="name" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                      {t('admin.products.table.category')}
                    </th>
                    <th className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleSort('price')}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] hover:text-[var(--accent)] transition"
                      >
                        {t('admin.products.table.price')}
                        <SortIcon field="price" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleSort('stockQuantity')}
                        className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] hover:text-[var(--accent)] transition"
                      >
                        {t('admin.products.table.stock')}
                        <SortIcon field="stockQuantity" />
                      </button>
                    </th>
                    <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] w-[140px]">
                      {t('admin.products.table.status')}
                    </th>
                    <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] w-[140px]">
                      {t('admin.products.table.actions')}
                    </th>
                  </tr>
                </thead>
                <motion.tbody variants={rowStagger} initial="initial" animate="animate">
                  {productList.map((product) => {
                    const stock =
                      product.stockQuantity !== undefined ? product.stockQuantity : product.stock;
                    const stockVal = stock ?? 0;
                    const sc = stockColor(stockVal);
                    const stockPct =
                      stockVal === 0 ? 0 : Math.min(100, (stockVal / STOCK_BAR_MAX) * 100);
                    return (
                      <motion.tr
                        key={product.id}
                        variants={rowItem}
                        className="border-t border-[var(--border-default)] hover:bg-[var(--accent)]/[0.05] transition group"
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            className="admin-checkbox"
                            checked={selectedRowKeys.includes(product.id)}
                            onChange={(e) => handleSelectRow(product, e.target.checked)}
                            aria-label={`Chọn ${product.name}`}
                          />
                        </td>
                        <td className="px-4 py-3">
                          <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--bg-surface)] ring-1 ring-[var(--border-default)] group-hover:ring-[var(--accent)]/30 transition">
                            <img
                              src={product.images?.[0] || '/placeholder-image.jpg'}
                              alt={product.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = '/placeholder-image.jpg';
                              }}
                            />
                          </div>
                        </td>
                        <td className="px-4 py-3 max-w-[280px]">
                          <div className="font-medium text-[var(--text-primary)] truncate">
                            {product.name}
                          </div>
                          {(product.sku as string | undefined) && (
                            <div className="text-[11px] text-[var(--text-tertiary)] tabular-nums mt-0.5 truncate">
                              {product.sku as string}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {product.categories && product.categories.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {product.categories.slice(0, 2).map((cat, index) => {
                                const c = categoryColor(cat.name);
                                return (
                                  <span
                                    key={index}
                                    className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium"
                                    style={{ backgroundColor: `${c}1f`, color: c }}
                                  >
                                    <span
                                      className="w-1.5 h-1.5 rounded-full"
                                      style={{ backgroundColor: c }}
                                    />
                                    {cat.name}
                                  </span>
                                );
                              })}
                              {product.categories.length > 2 && (
                                <span className="text-[11px] text-[var(--text-tertiary)]">
                                  +{product.categories.length - 2}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[var(--text-tertiary)]">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right whitespace-nowrap tabular-nums font-semibold text-[var(--text-primary)]">
                          {calculateDisplayPrice(product)}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="text-xs font-bold tabular-nums w-8 text-right"
                              style={{ color: sc }}
                            >
                              {stockVal}
                            </span>
                            <div className="h-1.5 flex-1 max-w-[64px] rounded-full bg-[var(--border-default)] overflow-hidden">
                              <div
                                className="h-full rounded-full"
                                style={{ width: `${stockPct}%`, backgroundColor: sc }}
                              />
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <Select
                            value={product.status}
                            onValueChange={(value) => handleStatusChange(product.id, value)}
                          >
                            <SelectTrigger className="h-8 w-auto text-xs border-0 border-transparent bg-transparent dark:bg-transparent shadow-none px-1 gap-1 hover:bg-transparent dark:hover:bg-transparent focus:ring-0 focus-visible:ring-2 focus-visible:ring-[var(--accent)] data-[state=open]:bg-transparent dark:data-[state=open]:bg-transparent">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions
                                .filter((opt) => opt.value !== 'all')
                                .map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value}>
                                    <StatusPill
                                      variant={STATUS_VARIANT[opt.value] || 'neutral'}
                                      label={opt.label}
                                    />
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                            <button
                              type="button"
                              onClick={() => openQuickView(product)}
                              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--color-info)]/10 hover:text-[var(--color-info)] transition"
                              title={t('admin.products.actions.view')}
                            >
                              <Eye className="w-4 h-4" strokeWidth={2.25} />
                            </button>
                            <button
                              type="button"
                              onClick={() => navigate(buildRoute.adminProductEdit(product.id))}
                              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] transition"
                              title={t('admin.products.actions.edit')}
                            >
                              <Pencil className="w-4 h-4" strokeWidth={2.25} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleCloneProduct(product.id)}
                              disabled={isCloning}
                              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--color-violet)]/10 hover:text-[var(--color-violet)] transition disabled:opacity-40 disabled:cursor-not-allowed"
                              title={t('admin.products.actions.clone')}
                            >
                              <Copy className="w-4 h-4" strokeWidth={2.25} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmId(product.id)}
                              className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] transition"
                              title={t('admin.products.actions.delete')}
                            >
                              <Trash2 className="w-4 h-4" strokeWidth={2.25} />
                            </button>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </motion.tbody>
              </table>
            </div>

            {/* Mobile: card-list thay cho table */}
            <div className="space-y-3 p-3 md:hidden">
              {productList.map((product) => {
                const stock =
                  product.stockQuantity !== undefined ? product.stockQuantity : product.stock;
                const stockVal = stock ?? 0;
                const sc = stockColor(stockVal);
                const stockPct =
                  stockVal === 0 ? 0 : Math.min(100, (stockVal / STOCK_BAR_MAX) * 100);
                return (
                  <AdminMobileCard
                    key={product.id}
                    media={
                      <div className="h-12 w-12 overflow-hidden rounded-lg bg-[var(--bg-surface)] ring-1 ring-[var(--border-default)]">
                        <img
                          src={product.images?.[0] || '/placeholder-image.jpg'}
                          alt={product.name}
                          className="h-full w-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder-image.jpg';
                          }}
                        />
                      </div>
                    }
                    title={
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          className="admin-checkbox shrink-0"
                          checked={selectedRowKeys.includes(product.id)}
                          onChange={(e) => handleSelectRow(product, e.target.checked)}
                          aria-label={`Chọn ${product.name}`}
                        />
                        <span className="truncate">{product.name}</span>
                      </span>
                    }
                    subtitle={(product.sku as string | undefined) || undefined}
                    status={
                      <Select
                        value={product.status}
                        onValueChange={(value) => handleStatusChange(product.id, value)}
                      >
                        <SelectTrigger className="h-8 w-auto gap-1 border-0 border-transparent bg-transparent px-1 text-xs shadow-none hover:bg-transparent focus:ring-0 focus-visible:ring-2 focus-visible:ring-[var(--accent)] data-[state=open]:bg-transparent dark:bg-transparent dark:hover:bg-transparent dark:data-[state=open]:bg-transparent">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions
                            .filter((opt) => opt.value !== 'all')
                            .map((opt) => (
                              <SelectItem key={opt.value} value={opt.value}>
                                <StatusPill
                                  variant={STATUS_VARIANT[opt.value] || 'neutral'}
                                  label={opt.label}
                                />
                              </SelectItem>
                            ))}
                        </SelectContent>
                      </Select>
                    }
                    fields={[
                      {
                        label: t('admin.products.table.category'),
                        value:
                          product.categories && product.categories.length > 0 ? (
                            <span className="flex flex-wrap justify-end gap-1">
                              {product.categories.slice(0, 2).map((cat, index) => {
                                const c = categoryColor(cat.name);
                                return (
                                  <span
                                    key={index}
                                    className="inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium"
                                    style={{ backgroundColor: `${c}1f`, color: c }}
                                  >
                                    <span
                                      className="h-1.5 w-1.5 rounded-full"
                                      style={{ backgroundColor: c }}
                                    />
                                    {cat.name}
                                  </span>
                                );
                              })}
                              {product.categories.length > 2 && (
                                <span className="text-[11px] text-[var(--text-tertiary)]">
                                  +{product.categories.length - 2}
                                </span>
                              )}
                            </span>
                          ) : (
                            <span className="text-[var(--text-tertiary)]">—</span>
                          ),
                      },
                      {
                        label: t('admin.products.table.price'),
                        value: (
                          <span className="font-semibold tabular-nums text-[var(--text-primary)]">
                            {calculateDisplayPrice(product)}
                          </span>
                        ),
                      },
                      {
                        label: t('admin.products.table.stock'),
                        value: (
                          <span className="flex items-center justify-end gap-2">
                            <span
                              className="w-8 text-right text-xs font-bold tabular-nums"
                              style={{ color: sc }}
                            >
                              {stockVal}
                            </span>
                            <span className="h-1.5 w-16 overflow-hidden rounded-full bg-[var(--border-default)]">
                              <span
                                className="block h-full rounded-full"
                                style={{ width: `${stockPct}%`, backgroundColor: sc }}
                              />
                            </span>
                          </span>
                        ),
                      },
                    ]}
                    actions={
                      <>
                        <button
                          type="button"
                          onClick={() => openQuickView(product)}
                          className="rounded-lg p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--color-info)]/10 hover:text-[var(--color-info)]"
                          title={t('admin.products.actions.view')}
                        >
                          <Eye className="h-4 w-4" strokeWidth={2.25} />
                        </button>
                        <button
                          type="button"
                          onClick={() => navigate(buildRoute.adminProductEdit(product.id))}
                          className="rounded-lg p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--accent)]/10 hover:text-[var(--accent)]"
                          title={t('admin.products.actions.edit')}
                        >
                          <Pencil className="h-4 w-4" strokeWidth={2.25} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleCloneProduct(product.id)}
                          disabled={isCloning}
                          className="rounded-lg p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--color-violet)]/10 hover:text-[var(--color-violet)] disabled:cursor-not-allowed disabled:opacity-40"
                          title={t('admin.products.actions.clone')}
                        >
                          <Copy className="h-4 w-4" strokeWidth={2.25} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmId(product.id)}
                          className="rounded-lg p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
                          title={t('admin.products.actions.delete')}
                        >
                          <Trash2 className="h-4 w-4" strokeWidth={2.25} />
                        </button>
                      </>
                    }
                  />
                );
              })}
            </div>
          </>
        )}

        {/* Pagination */}
        {pagination && !isEmpty && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-[var(--border-default)]">
            <span className="text-xs text-[var(--text-tertiary)]">
              {t('admin.products.pagination.total', {
                start: (currentPage - 1) * (pagination?.itemsPerPage || 10) + 1,
                end: Math.min(
                  currentPage * (pagination?.itemsPerPage || 10),
                  pagination?.totalItems || 0,
                ),
                total: pagination?.totalItems || 0,
              })}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition"
                aria-label="Previous"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const page = i + 1;
                const isActive = currentPage === page;
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={cn(
                      'min-w-[36px] h-9 px-3 rounded-lg text-sm font-medium transition tabular-nums',
                      isActive
                        ? 'bg-[var(--accent)] text-white shadow-md shadow-[var(--accent)]/20'
                        : 'text-[var(--text-secondary)] hover:bg-white/5',
                    )}
                  >
                    {page}
                  </button>
                );
              })}
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="p-2 rounded-lg text-[var(--text-secondary)] hover:bg-white/5 disabled:opacity-30 disabled:cursor-not-allowed transition"
                aria-label="Next"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirm dialog — glass */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="glass-dialog !border-[var(--color-danger)]/20 max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--color-danger)]/15 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-[var(--color-danger)]" strokeWidth={2.25} />
              </div>
              <div>
                <DialogTitle>{t('admin.products.messages.deleteTitle')}</DialogTitle>
                <p className="text-sm text-[var(--text-tertiary)] mt-1">
                  {t('admin.products.messages.deleteDescription')}
                </p>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDeleteProduct(deleteConfirmId)}
            >
              {t('admin.products.actions.delete')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Quick view modal — glass */}
      <Dialog open={isQuickViewOpen} onOpenChange={setIsQuickViewOpen}>
        <DialogContent className="glass-dialog max-w-[640px]">
          <DialogHeader>
            <DialogTitle>{t('admin.products.modal.viewTitle')}</DialogTitle>
          </DialogHeader>
          <AnimatePresence>
            {selectedProduct && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-1 sm:grid-cols-3 gap-4"
              >
                <div className="sm:col-span-1">
                  <div className="aspect-square rounded-xl overflow-hidden bg-[var(--bg-surface)] ring-1 ring-[var(--border-default)]">
                    <img
                      className="w-full h-full object-cover"
                      src={selectedProduct.images?.[0] || '/placeholder-image.jpg'}
                      alt={selectedProduct.name}
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder-image.jpg';
                      }}
                    />
                  </div>
                </div>
                <div className="sm:col-span-2 space-y-3 text-sm">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-0.5">
                      {t('admin.products.modal.productName')}
                    </div>
                    <div className="font-semibold text-[var(--text-primary)]">
                      {selectedProduct.name}
                    </div>
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                      {t('admin.products.modal.category')}
                    </div>
                    {selectedProduct.categories && selectedProduct.categories.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {selectedProduct.categories.map((cat, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-[var(--color-info)]/10 text-[var(--color-info)] border border-[var(--color-info)]/20"
                          >
                            {cat.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span className="text-[var(--text-tertiary)]">—</span>
                    )}
                  </div>
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-0.5">
                      {t('admin.products.modal.price')}
                    </div>
                    <div className="font-bold text-[var(--text-primary)] tabular-nums">
                      {
                        calculatePriceRange(
                          selectedProduct.price,
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          selectedProduct.variants as any,
                        ).priceText
                      }
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                        {t('admin.products.modal.stock')}
                      </div>
                      <StatusPill
                        variant={
                          ((selectedProduct.stockQuantity ?? 0) || (selectedProduct.stock ?? 0)) > 0
                            ? 'success'
                            : 'error'
                        }
                        label={String(
                          selectedProduct.stockQuantity !== undefined
                            ? selectedProduct.stockQuantity
                            : selectedProduct.stock,
                        )}
                        showDot={false}
                      />
                    </div>
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                        {t('admin.products.modal.status')}
                      </div>
                      <StatusPill
                        variant={STATUS_VARIANT[selectedProduct.status] || 'neutral'}
                        label={
                          selectedProduct.status
                            ? t(`admin.products.status.${selectedProduct.status}`)
                            : ''
                        }
                      />
                    </div>
                  </div>
                  {selectedProduct.description && (
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-1">
                        {t('admin.products.modal.description')}
                      </div>
                      <p className="text-sm text-[var(--text-secondary)] line-clamp-3">
                        {selectedProduct.description}
                      </p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuickViewOpen(false)}>
              {t('admin.products.modal.close')}
            </Button>
            <Button
              className="admin-btn-primary"
              onClick={() => {
                setIsQuickViewOpen(false);
                navigate(buildRoute.adminProductEdit(selectedProduct?.id ?? ''));
              }}
            >
              <Pencil className="w-4 h-4 mr-2" strokeWidth={2.25} />
              {t('admin.products.modal.edit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ProductExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        currentPageData={products}
        selectedRows={selectedRows}
        filters={{
          search: searchTerm,
          category: categoryFilter !== 'all' ? categoryFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          sortBy,
          sortOrder,
        }}
        onExportAll={handleExportAll}
        isLoading={isFetchingForExport}
      />
    </div>
  );
};

export default ProductsPage;
