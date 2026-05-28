/**
 * @file CategoriesPage.tsx
 * @layer Page
 * @feature admin
 * @description Quản lý danh mục — glass design + tree structure (spec §7, §16.2)
 */
import React, { useState, useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import {
  Plus,
  Pencil,
  Trash2,
  FolderOpen,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from 'lucide-react';
import { useUiStore } from '@/stores/ui-store';
import { getErrorMsg } from '@/utils/error-utils';
import { categorySchema } from '@/schemas/admin';
import { cn } from '@/utils/cn';
import {
  useGetCategoryTreeQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
} from '@features/catalog/api/category-api';
import type { Category } from '@features/catalog/types/category.types';
import ImageUpload from '@/components/common/ImageUpload';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
  Switch,
} from '@/components/ui';
import StatusPill from '../../components/StatusPill';

interface CategoryFormData {
  name: string;
  description?: string;
  image?: string;
  parentId?: string | null;
  isActive: boolean;
  sortOrder: number;
}

interface FormErrors {
  name?: string;
}

const initialFormData: CategoryFormData = {
  name: '',
  description: '',
  image: '',
  parentId: null,
  isActive: true,
  sortOrder: 0,
};

const easeOutQuart = [0.22, 1, 0.36, 1] as const;
const rowStagger = { animate: { transition: { staggerChildren: 0.025 } } };
const rowItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: easeOutQuart } },
};

const CategoriesPage: React.FC = () => {
  const { t } = useTranslation();
  const addNotification = useUiStore((s) => s.addNotification);
  const [formData, setFormData] = useState<CategoryFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const { data: categoriesData, isLoading, refetch } = useGetCategoryTreeQuery();
  const { mutateAsync: createCategory, isPending: isCreating } = useCreateCategoryMutation();
  const { mutateAsync: updateCategory, isPending: isUpdating } = useUpdateCategoryMutation();
  const { mutateAsync: deleteCategory } = useDeleteCategoryMutation();

  const categories = useMemo(() => {
    if (!categoriesData?.data) return [];
    if (Array.isArray(categoriesData.data)) return categoriesData.data;
    return [categoriesData.data];
  }, [categoriesData]);

  const totalPages = Math.max(1, Math.ceil(categories.length / pageSize));
  const paginatedCategories = categories.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const getParentOptions = (excludeId?: string) =>
    categories
      .filter((cat: Category) => cat.id !== excludeId && !cat.parentId)
      .map((cat: Category) => ({ value: cat.id, label: cat.name }));

  const validateForm = (): boolean => {
    const result = categorySchema.safeParse({ name: formData.name });
    if (!result.success) {
      const fe = result.error.flatten().fieldErrors;
      setFormErrors({ name: fe.name?.[0] });
      return false;
    }
    setFormErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      if (editingCategory) {
        await updateCategory({ id: editingCategory.id, ...formData });
        addNotification({ message: t('admin.categories.messages.editSuccess'), type: 'success' });
      } else {
        await createCategory(formData);
        addNotification({ message: t('admin.categories.messages.addSuccess'), type: 'success' });
      }
      setIsModalVisible(false);
      setEditingCategory(null);
      setFormData(initialFormData);
      setFormErrors({});
      refetch();
    } catch (error) {
      addNotification({ message: getErrorMsg(error, t('common.errorOccurred')), type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteCategory(id);
      addNotification({ message: t('admin.categories.messages.deleteSuccess'), type: 'success' });
      refetch();
    } catch (error) {
      addNotification({
        message: getErrorMsg(error, t('admin.categories.messages.deleteError')),
        type: 'error',
      });
    }
    setDeleteConfirmId(null);
  };

  const handleCreate = () => {
    setEditingCategory(null);
    setIsModalVisible(true);
    setFormData(initialFormData);
    setFormErrors({});
  };

  const handleEdit = (category: Category) => {
    setEditingCategory(category);
    setIsModalVisible(true);
    setFormData({
      name: category.name,
      description: category.description ?? '',
      image: category.image ?? '',
      parentId: category.parentId ?? null,
      isActive: category.isActive ?? true,
      sortOrder: category.sortOrder ?? 0,
    });
    setFormErrors({});
  };

  const isEmpty = !isLoading && categories.length === 0;

  return (
    <div>
      {/* Page header với gradient subtle */}
      <div className="relative rounded-3xl bg-[var(--bg-base)] dark:bg-white/[0.03] border border-[var(--border-default)] p-6 mb-5 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-50 pointer-events-none"
          style={{
            background: `
              radial-gradient(circle at 100% 0%, rgba(82, 196, 26, 0.10) 0%, transparent 40%),
              radial-gradient(circle at 0% 100%, rgba(114, 46, 209, 0.08) 0%, transparent 35%)
            `,
          }}
        />
        <div className="relative flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3">
          <div>
            <span className="section-number">03 / DANH MỤC</span>
            <div className="flex items-center gap-2.5 mt-2">
              <h1 className="display-heading">{t('admin.categories.title')}</h1>
              <Sparkles className="w-5 h-5 text-[var(--accent)]/60" aria-hidden="true" />
            </div>
            <p className="text-sm text-[var(--text-tertiary)] mt-1.5">
              {t('admin.categories.subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
              <RefreshCw
                className={cn('w-4 h-4 mr-2', isLoading && 'animate-spin')}
                strokeWidth={2.25}
              />
              {t('common.refresh')}
            </Button>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" strokeWidth={2.25} />
              {t('admin.categories.addCategory')}
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-[var(--bg-base)] dark:bg-white/[0.03] border border-[var(--border-default)] overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="shimmer h-14 rounded-lg" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="relative w-20 h-20 mb-5">
              <div className="absolute inset-0 rounded-3xl bg-[var(--accent)]/10 blur-2xl" />
              <div className="relative w-full h-full rounded-3xl bg-gradient-to-br from-[var(--accent)]/15 to-[var(--color-secondary)]/10 flex items-center justify-center border border-[var(--accent)]/20">
                <FolderOpen className="w-10 h-10 text-[var(--accent)]" strokeWidth={1.5} />
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-1.5 text-[var(--text-primary)]">
              {t('admin.categories.empty.title', { defaultValue: 'Chưa có danh mục nào' })}
            </h3>
            <p className="text-sm text-[var(--text-tertiary)] text-center max-w-sm mb-6">
              {t('admin.categories.empty.description', {
                defaultValue: 'Tạo danh mục đầu tiên để phân loại sản phẩm dễ dàng hơn.',
              })}
            </p>
            <Button onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" strokeWidth={2.25} />
              {t('admin.categories.addCategory')}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.02]">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] w-20">
                    {t('admin.categories.table.image')}
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    {t('admin.categories.table.name')}
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    {t('admin.brands.form.description')}
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    {t('admin.categories.table.parent')}
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    {t('common.status')}
                  </th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] w-20">
                    {t('admin.categories.table.order')}
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] w-[120px]">
                    {t('admin.common.actions')}
                  </th>
                </tr>
              </thead>
              <motion.tbody variants={rowStagger} initial="initial" animate="animate">
                {paginatedCategories.map((record: Category) => {
                  const parent = record.parentId
                    ? categories.find((cat: Category) => cat.id === record.parentId)
                    : null;
                  return (
                    <motion.tr
                      key={record.id}
                      variants={rowItem}
                      className="border-t border-[var(--border-default)] hover:bg-white/[0.03] transition group"
                    >
                      <td className="px-4 py-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--bg-surface)] ring-1 ring-[var(--border-default)] group-hover:ring-[var(--accent)]/30 transition flex items-center justify-center">
                          {record.image ? (
                            <img
                              src={record.image}
                              alt={record.name}
                              className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                            />
                          ) : (
                            <FolderOpen
                              className="w-5 h-5 text-[var(--text-tertiary)]"
                              strokeWidth={1.75}
                            />
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-[var(--text-primary)]">{record.name}</div>
                        <div className="text-[11px] text-[var(--text-tertiary)] tabular-nums">
                          {record.slug}
                        </div>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        {record.description ? (
                          <div
                            className="truncate text-[var(--text-secondary)]"
                            title={record.description}
                          >
                            {record.description}
                          </div>
                        ) : (
                          <span className="text-[var(--text-tertiary)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {!record.parentId ? (
                          <StatusPill
                            variant="success"
                            label={t('admin.categories.table.root')}
                            showDot={false}
                          />
                        ) : parent ? (
                          <StatusPill variant="info" label={parent.name} showDot={false} />
                        ) : (
                          <span className="text-[var(--text-tertiary)]">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill
                          variant={record.isActive ? 'success' : 'error'}
                          label={record.isActive ? t('common.active') : t('admin.common.hidden')}
                        />
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-[var(--text-secondary)]">
                        {record.sortOrder || 0}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleEdit(record)}
                            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] transition"
                            title={t('admin.common.actions')}
                          >
                            <Pencil className="w-4 h-4" strokeWidth={2.25} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteConfirmId(record.id)}
                            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--admin-error)]/10 hover:text-[var(--admin-error)] transition"
                            title={t('common.delete')}
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
        )}

        {/* Pagination */}
        {categories.length > pageSize && !isEmpty && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-[var(--border-default)]">
            <span className="text-xs text-[var(--text-tertiary)]">
              {t('admin.categories.totalItems', {
                range0: (currentPage - 1) * pageSize + 1,
                range1: Math.min(currentPage * pageSize, categories.length),
                total: categories.length,
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
              {Array.from({ length: totalPages }, (_, i) => {
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
        <DialogContent className="glass-dialog !border-[var(--admin-error)]/20 max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--admin-error)]/15 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-[var(--admin-error)]" strokeWidth={2.25} />
              </div>
              <div>
                <DialogTitle>{t('admin.categories.deleteTitle')}</DialogTitle>
                <p className="text-sm text-[var(--text-tertiary)] mt-1">
                  {t('admin.categories.deleteConfirm')}
                </p>
              </div>
            </div>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setDeleteConfirmId(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              {t('common.delete')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Create/Edit modal — glass */}
      <Dialog
        open={isModalVisible}
        onOpenChange={(open) => {
          if (!open) {
            setIsModalVisible(false);
            setEditingCategory(null);
            setFormData(initialFormData);
            setFormErrors({});
          }
        }}
      >
        <DialogContent className="glass-dialog max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {editingCategory
                ? t('admin.categories.editCategory')
                : t('admin.categories.addCategoryModal')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">{t('admin.categories.table.name')}</Label>
              <Input
                id="cat-name"
                placeholder={t('admin.categories.form.namePlaceholder') || ''}
                value={formData.name}
                onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
              />
              {formErrors.name && (
                <p className="text-[var(--admin-error)] text-xs mt-1">{formErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="cat-description">{t('admin.brands.form.description')}</Label>
              <textarea
                id="cat-description"
                rows={3}
                placeholder={t('admin.brands.form.descriptionPlaceholder')}
                className="flex w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] dark:bg-white/[0.03] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition disabled:opacity-50"
                value={formData.description || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('admin.categories.table.image')}</Label>
              <ImageUpload
                type="categories"
                multiple={false}
                value={formData.image || ''}
                onChange={(val) =>
                  setFormData((prev) => ({
                    ...prev,
                    image: typeof val === 'string' ? val : val[0] || '',
                  }))
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{t('admin.categories.form.parentCategory')}</Label>
              <Select
                value={formData.parentId || ''}
                onValueChange={(val) => setFormData((prev) => ({ ...prev, parentId: val || null }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('admin.categories.form.selectParent')} />
                </SelectTrigger>
                <SelectContent>
                  {getParentOptions(editingCategory?.id).map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cat-sortOrder">{t('admin.categories.form.displayOrder')}</Label>
                <input
                  id="cat-sortOrder"
                  type="number"
                  min={0}
                  placeholder="0"
                  className="flex h-10 w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] dark:bg-white/[0.03] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition tabular-nums"
                  value={formData.sortOrder}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, sortOrder: Number(e.target.value) || 0 }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label>{t('common.status')}</Label>
                <div className="flex items-center gap-2 pt-2">
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, isActive: checked }))
                    }
                  />
                  <span className="text-sm text-[var(--text-secondary)]">
                    {formData.isActive ? t('common.active') : t('admin.common.hidden')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap justify-end gap-2 mt-6">
              <Button
                variant="outline"
                type="button"
                onClick={() => {
                  setIsModalVisible(false);
                  setEditingCategory(null);
                  setFormData(initialFormData);
                  setFormErrors({});
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isCreating || isUpdating}>
                {(isCreating || isUpdating) && <LoadingSpinner size="sm" />}
                {editingCategory ? t('common.update') : t('common.create')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CategoriesPage;
