/**
 * @file ProductsPage.tsx
 * @layer Page
 * @feature catalog
 * @description Page component của feature catalog
 */
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildRoute } from '@/routes/paths';
import {
  useGetAdminProductsQuery,
  useDeleteProductMutation,
  useCloneProductMutation,
  useUpdateProductStatusMutation,
  useLazyGetAdminProductsQuery,
} from '@/features/admin';
import { useGetAllCategoriesQuery } from '@features/catalog/api/category-api';
import { useTranslation } from 'react-i18next';
import { ProductExportModal } from '@/features/admin';
import { calculatePriceRange } from '@/utils/price-utils';
import { getLocale } from '@/utils/format';
import { useUiStore } from '@/stores/ui-store';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  Button,
  Card,
  CardContent,
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
  Alert,
  AlertTitle,
  AlertDescription,
} from '@/components/ui';
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
} from 'lucide-react';

// Kiểu sản phẩm dùng trong bảng quản trị
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

  // Trạng thái bộ lọc
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortOrder, setSortOrder] = useState<'ASC' | 'DESC'>('DESC');

  // Trạng thái chọn hàng
  const [selectedRowKeys, setSelectedRowKeys] = useState<string[]>([]);
  const [selectedRows, setSelectedRows] = useState<AdminProductRow[]>([]);

  // Trạng thái xuất dữ liệu
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Trạng thái modal
  const [selectedProduct, setSelectedProduct] = useState<AdminProductRow | null>(null);
  const [isQuickViewOpen, setIsQuickViewOpen] = useState(false);

  // Trạng thái confirm delete
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Lấy danh mục từ API
  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useGetAllCategoriesQuery();

  // Các query và mutation API
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

  const { mutateAsync: deleteProduct, isPending: _isDeleting } = useDeleteProductMutation();
  const { mutateAsync: cloneProduct, isPending: isCloning } = useCloneProductMutation();
  const { mutateAsync: updateProductStatus, isPending: _isUpdatingStatus } =
    useUpdateProductStatusMutation();
  const { trigger: triggerGetProducts } = useLazyGetAdminProductsQuery();
  const [isFetchingForExport, _setIsFetchingForExport] = useState(false);

  // Xử lý dữ liệu sản phẩm từ API
  const products = useMemo(
    () => productsResponse?.data?.products || [],
    [productsResponse?.data?.products],
  );
  const pagination = productsResponse?.data?.pagination;

  // Xử lý dữ liệu danh mục từ API
  const rawCategories = categoriesResponse?.data;
  const apiCategories = useMemo(() => {
    return Array.isArray(rawCategories) ? rawCategories : rawCategories ? [rawCategories] : [];
  }, [rawCategories]);

  // Tạo options cho dropdown danh mục
  const categoryOptions = [
    { value: 'all', label: t('admin.products.filters.allCategories') },
    ...(Array.isArray(apiCategories)
      ? apiCategories.map((cat: { id: string; name: string }) => ({
          value: cat.id,
          label: cat.name,
        }))
      : []),
  ];

  // Xử lý xóa sản phẩm
  const handleDeleteProduct = async (productId: string) => {
    try {
      await deleteProduct(productId);
      addNotification({ message: t('admin.products.messages.deleteSuccess'), type: 'success' });
      refetch();
    } catch (error) {
      addNotification({ message: t('admin.products.messages.deleteError'), type: 'error' });
      console.error('Xóa sản phẩm thất bại:', error);
    }
    setDeleteConfirmId(null);
  };

  // Xử lý thay đổi trạng thái sản phẩm
  const handleStatusChange = async (productId: string, newStatus: string) => {
    try {
      await updateProductStatus({ id: productId, status: newStatus });
      addNotification({ message: t('admin.products.messages.statusSuccess'), type: 'success' });
    } catch (error) {
      addNotification({ message: t('admin.products.messages.statusError'), type: 'error' });
      console.error('Thay đổi trạng thái thất bại:', error);
    }
  };

  // Xử lý nhân bản sản phẩm
  const handleCloneProduct = async (productId: string) => {
    try {
      await cloneProduct(productId);
      addNotification({ message: t('admin.products.messages.cloneSuccess'), type: 'success' });
      refetch();
    } catch (error) {
      addNotification({ message: t('admin.products.messages.cloneError'), type: 'error' });
      console.error('Nhân bản sản phẩm thất bại:', error);
    }
  };

  // Xử lý lấy dữ liệu xuất
  const handleExportAll = async (exportFilters: Record<string, unknown>) => {
    try {
      const result = await triggerGetProducts({
        ...exportFilters,
        limit: 99999, // Lấy tất cả để xuất
      });
      return result?.data?.products || [];
    } catch (error) {
      console.error('Lấy sản phẩm để xuất thất bại:', error);
      throw error;
    }
  };

  // Mở modal xem nhanh
  const openQuickView = (product: AdminProductRow) => {
    setSelectedProduct(product);
    setIsQuickViewOpen(true);
  };

  // Xử lý tìm kiếm với debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setCurrentPage(1); // Quay về trang đầu khi tìm kiếm
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, categoryFilter, statusFilter]);

  // Định dạng tiền tệ — luôn VND, locale động theo ngôn ngữ UI
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat(getLocale(), {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  // Tính giá thấp nhất từ biến thể hoặc giá cơ bản
  const calculateDisplayPrice = (product: AdminProductRow) => {
    if (product.variants && product.variants.length > 0) {
      const prices = product.variants.map((variant) => parseFloat(String(variant.price)));
      const minPrice = Math.min(...prices);
      return formatCurrency(minPrice);
    }
    return formatCurrency(product.price);
  };

  // Lấy style tag trạng thái
  const getStatusClasses = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400';
      case 'inactive':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400';
      case 'draft':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  // Xử lý sắp xếp
  const handleSort = (field: string) => {
    if (sortBy === field) {
      if (sortOrder === 'ASC') {
        setSortOrder('DESC');
      } else {
        // Reset về mặc định khi user click lần 3 để bỏ sort
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

  // Chọn / bỏ chọn tất cả
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

  // Chọn / bỏ chọn 1 hàng
  const handleSelectRow = (product: AdminProductRow, checked: boolean) => {
    if (checked) {
      setSelectedRowKeys((prev) => [...prev, product.id]);
      setSelectedRows((prev) => [...prev, product]);
    } else {
      setSelectedRowKeys((prev) => prev.filter((k) => k !== product.id));
      setSelectedRows((prev) => prev.filter((r) => r.id !== product.id));
    }
  };

  if (error) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('admin.products.messages.loadError')}</AlertTitle>
          <AlertDescription className="flex items-center justify-between">
            <span>{t('admin.products.messages.loadError')}</span>
            <Button variant="outline" size="sm" onClick={() => refetch()}>
              {t('admin.products.actions.retry')}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="p-2 sm:p-4 md:p-6">
      {/* Tiêu đề trang */}
      <Card className="mb-4 md:mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-semibold text-neutral-900 dark:text-white">
                {t('admin.products.title')}
              </h2>
              <p className="mt-2 text-sm text-neutral-600 dark:text-neutral-400">
                {pagination?.totalItems
                  ? t('admin.products.stats', {
                      totalItems: pagination.totalItems,
                      totalPages: pagination.totalPages,
                    })
                  : t('admin.products.subtitle')}
              </p>
            </div>
            <div className="flex justify-start sm:justify-end gap-2">
              <Button variant="outline" onClick={() => setIsExportModalOpen(true)} size="default">
                <Download className="w-4 h-4 mr-2" />
                {t('admin.products.actions.export')}
              </Button>
              <Button onClick={() => navigate('/admin/products/create')} size="default">
                <Plus className="w-4 h-4 mr-2" />
                {t('admin.products.actions.add')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bộ lọc */}
      <Card className="mb-4 md:mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center">
            <div className="md:col-span-5 lg:col-span-4 relative">
              <Input
                placeholder={t('admin.products.filters.searchPlaceholder')}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            </div>
            <div className="md:col-span-3 lg:col-span-2">
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
            <div className="md:col-span-3 lg:col-span-2">
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
        </CardContent>
      </Card>

      {/* Bảng sản phẩm */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="flex justify-center py-12">
              <LoadingSpinner size="lg" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="p-3 text-left w-10">
                      <input
                        type="checkbox"
                        className="rounded border-neutral-300 dark:border-neutral-600"
                        checked={
                          (products as unknown as AdminProductRow[]).length > 0 &&
                          selectedRowKeys.length ===
                            (products as unknown as AdminProductRow[]).length
                        }
                        onChange={(e) => handleSelectAll(e.target.checked)}
                      />
                    </th>
                    <th className="p-3 text-left w-20">{t('admin.products.table.image')}</th>
                    <th className="p-3 text-left">
                      <button
                        className="flex items-center gap-1 hover:text-primary-600"
                        onClick={() => handleSort('name')}
                      >
                        {t('admin.products.table.name')} <SortIcon field="name" />
                      </button>
                    </th>
                    <th className="p-3 text-left">{t('admin.products.table.category')}</th>
                    <th className="p-3 text-left">
                      <button
                        className="flex items-center gap-1 hover:text-primary-600"
                        onClick={() => handleSort('price')}
                      >
                        {t('admin.products.table.price')} <SortIcon field="price" />
                      </button>
                    </th>
                    <th className="p-3 text-left">
                      <button
                        className="flex items-center gap-1 hover:text-primary-600"
                        onClick={() => handleSort('stockQuantity')}
                      >
                        {t('admin.products.table.stock')} <SortIcon field="stockQuantity" />
                      </button>
                    </th>
                    <th className="p-3 text-left w-[150px]">{t('admin.products.table.status')}</th>
                    <th className="p-3 text-left w-[150px]">{t('admin.products.table.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(products as unknown as AdminProductRow[]).map((product) => (
                    <tr
                      key={product.id}
                      className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    >
                      <td className="p-3">
                        <input
                          type="checkbox"
                          className="rounded border-neutral-300 dark:border-neutral-600"
                          checked={selectedRowKeys.includes(product.id)}
                          onChange={(e) => handleSelectRow(product, e.target.checked)}
                        />
                      </td>
                      <td className="p-3">
                        <img
                          width={50}
                          height={50}
                          src={product.images?.[0] || '/placeholder-image.jpg'}
                          alt={t('product.imageAlt')}
                          className="object-cover rounded w-[50px] h-[50px]"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = '/placeholder-image.jpg';
                          }}
                        />
                      </td>
                      <td className="p-3">
                        <div className="max-w-[200px]">
                          <div className="font-medium">{product.name}</div>
                        </div>
                      </td>
                      <td className="p-3">
                        {product.categories && product.categories.length > 0 ? (
                          product.categories.map((cat, index) => (
                            <span
                              key={index}
                              className="inline-block px-2 py-0.5 mr-1 mb-1 text-xs rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                            >
                              {cat.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-neutral-400">-</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className="font-medium" style={{ color: 'var(--admin-success)' }}>
                          {calculateDisplayPrice(product)}
                        </span>
                      </td>
                      <td className="p-3">
                        {(() => {
                          const stock =
                            product.stockQuantity !== undefined
                              ? product.stockQuantity
                              : product.stock;
                          return (
                            <span
                              style={{
                                color:
                                  (stock ?? 0) > 0 ? 'var(--admin-success)' : 'var(--admin-error)',
                              }}
                            >
                              {stock}
                            </span>
                          );
                        })()}
                      </td>
                      <td className="p-3">
                        <Select
                          value={product.status}
                          onValueChange={(value) => handleStatusChange(product.id, value)}
                        >
                          <SelectTrigger className="w-[140px] h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {statusOptions
                              .filter((opt) => opt.value !== 'all')
                              .map((opt) => (
                                <SelectItem key={opt.value} value={opt.value}>
                                  <span
                                    className={`inline-block px-2 py-0.5 text-xs rounded ${getStatusClasses(opt.value)}`}
                                  >
                                    {opt.label}
                                  </span>
                                </SelectItem>
                              ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1">
                          <button
                            className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400"
                            onClick={() => openQuickView(product)}
                            title={t('admin.products.actions.view')}
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400"
                            onClick={() => navigate(buildRoute.adminProductEdit(product.id))}
                            title={t('admin.products.actions.edit')}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-blue-600 dark:text-blue-400"
                            onClick={() => handleCloneProduct(product.id)}
                            disabled={isCloning}
                            title={t('admin.products.actions.clone')}
                          >
                            <Copy className="w-4 h-4" />
                          </button>
                          <button
                            className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                            onClick={() => setDeleteConfirmId(product.id)}
                            title={t('admin.products.actions.delete')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Phân trang */}
          {pagination && (
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-2">
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
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
                  className="p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-40"
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {Array.from({ length: Math.min(pagination.totalPages || 1, 7) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      className={`px-3 py-1 rounded text-sm ${
                        currentPage === page
                          ? 'bg-primary-600 text-white'
                          : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'
                      }`}
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  className="p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-40"
                  disabled={currentPage >= (pagination.totalPages || 1)}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('admin.products.messages.deleteTitle')}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {t('admin.products.messages.deleteDescription')}
          </p>
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

      {/* Modal xem nhanh */}
      <Dialog open={isQuickViewOpen} onOpenChange={setIsQuickViewOpen}>
        <DialogContent className="max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t('admin.products.modal.viewTitle')}</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <img
                  className="w-full rounded"
                  src={selectedProduct.images?.[0] || '/placeholder-image.jpg'}
                  alt={selectedProduct.name}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder-image.jpg';
                  }}
                />
              </div>
              <div className="col-span-2 space-y-3">
                <div>
                  <strong>{t('admin.products.modal.productName')}:</strong> {selectedProduct.name}
                </div>
                <div>
                  <strong>{t('admin.products.modal.category')}:</strong>{' '}
                  {selectedProduct.categories && selectedProduct.categories.length > 0 ? (
                    selectedProduct.categories.map((cat: { name: string }, index: number) => (
                      <span
                        key={index}
                        className="inline-block px-2 py-0.5 mr-1 text-xs rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400"
                      >
                        {cat.name}
                      </span>
                    ))
                  ) : (
                    <span>-</span>
                  )}
                </div>
                <div>
                  <strong>{t('admin.products.modal.price')}:</strong>{' '}
                  <span className="font-medium" style={{ color: 'var(--admin-success)' }}>
                    {
                      calculatePriceRange(
                        selectedProduct.price,
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        selectedProduct.variants as any,
                      ).priceText
                    }
                  </span>
                </div>
                <div>
                  <strong>{t('admin.products.modal.stock')}:</strong>{' '}
                  <span
                    style={{
                      color:
                        ((selectedProduct.stockQuantity ?? 0) || (selectedProduct.stock ?? 0)) > 0
                          ? 'var(--admin-success)'
                          : 'var(--admin-error)',
                    }}
                  >
                    {selectedProduct.stockQuantity !== undefined
                      ? selectedProduct.stockQuantity
                      : selectedProduct.stock}
                  </span>
                </div>
                <div>
                  <strong>{t('admin.products.modal.status')}:</strong>{' '}
                  <span
                    className={`inline-block px-2 py-0.5 text-xs rounded ${getStatusClasses(selectedProduct.status)}`}
                  >
                    {selectedProduct.status
                      ? t(`admin.products.status.${selectedProduct.status}`)
                      : ''}
                  </span>
                </div>
                {selectedProduct.description && (
                  <div>
                    <strong>{t('admin.products.modal.description')}:</strong>
                    <p className="mt-2">{selectedProduct.description}</p>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsQuickViewOpen(false)}>
              {t('admin.products.modal.close')}
            </Button>
            <Button
              onClick={() => {
                setIsQuickViewOpen(false);
                navigate(buildRoute.adminProductEdit(selectedProduct?.id ?? ''));
              }}
            >
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
