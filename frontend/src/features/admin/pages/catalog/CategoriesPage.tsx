/**
 * @file CategoriesPage.tsx
 * @layer Page
 * @feature catalog
 * @description Page component của feature catalog
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/stores/ui-store';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  useGetCategoryTreeQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,
} from '@features/catalog/api/category-api';
import type { Category } from '@features/catalog/types/category.types';
import ImageUpload from '@/components/common/ImageUpload';
import { getErrorMsg } from '@/utils/error-utils';
import {
  Button,
  Card,
  CardContent,
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
import {
  Plus,
  Pencil,
  Trash2,
  FolderOpen,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

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

  const categories = React.useMemo(() => {
    if (!categoriesData?.data) return [];
    if (Array.isArray(categoriesData.data)) return categoriesData.data;
    return [categoriesData.data];
  }, [categoriesData]);

  // Phân trang thủ công
  const totalPages = Math.ceil(categories.length / pageSize);
  const paginatedCategories = categories.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const getParentOptions = (excludeId?: string) =>
    categories
      .filter((cat: Category) => cat.id !== excludeId && !cat.parentId)
      .map((cat: Category) => ({ value: cat.id, label: cat.name }));

  const validateForm = (): boolean => {
    const errors: FormErrors = {};
    if (!formData.name || formData.name.trim().length === 0) {
      errors.name = t('admin.categories.form.nameRequired');
    } else if (formData.name.trim().length < 2) {
      errors.name = t('admin.categories.form.nameMinLength') || 'Min 2 characters';
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
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

  return (
    <div className="p-2 sm:p-4 md:p-6">
      <Card className="dark:bg-neutral-800">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <div>
              <h2 className="text-xl md:text-2xl font-semibold mb-1 dark:text-white">
                {t('admin.categories.title')}
              </h2>
              <p className="text-neutral-600 dark:text-neutral-400">
                {t('admin.categories.subtitle')}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => refetch()}
                disabled={isLoading}
                className="dark:text-neutral-300"
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                {t('common.refresh')}
              </Button>
              <Button onClick={handleCreate}>
                <Plus className="w-4 h-4 mr-2" />
                {t('admin.categories.addCategory')}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : (
              <>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-700">
                      <th className="p-3 text-left w-20">{t('admin.categories.table.image')}</th>
                      <th className="p-3 text-left">{t('admin.categories.table.name')}</th>
                      <th className="p-3 text-left">{t('admin.brands.form.description')}</th>
                      <th className="p-3 text-left">{t('admin.categories.table.parent')}</th>
                      <th className="p-3 text-left">{t('common.status')}</th>
                      <th className="p-3 text-left w-20">{t('admin.categories.table.order')}</th>
                      <th className="p-3 text-left w-[120px]">{t('admin.common.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedCategories.map((record: Category) => (
                      <tr
                        key={record.id}
                        className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                      >
                        <td className="p-3">
                          {record.image ? (
                            <img
                              src={record.image}
                              alt={record.name}
                              className="w-[50px] h-[50px] object-cover rounded"
                            />
                          ) : (
                            <div className="w-12 h-12 bg-gray-100 dark:bg-neutral-700 rounded flex items-center justify-center">
                              <FolderOpen className="w-5 h-5 text-gray-400" />
                            </div>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="font-medium">{record.name}</div>
                          <div className="text-sm text-gray-500">{record.slug}</div>
                        </td>
                        <td className="p-3">
                          {record.description ? (
                            <div className="max-w-xs truncate" title={record.description}>
                              {record.description}
                            </div>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          {!record.parentId ? (
                            <span className="inline-block px-2 py-0.5 text-xs rounded bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                              {t('admin.categories.table.root')}
                            </span>
                          ) : (
                            (() => {
                              const parent = categories.find(
                                (cat: Category) => cat.id === record.parentId,
                              );
                              return parent ? (
                                <span className="inline-block px-2 py-0.5 text-xs rounded bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                                  {parent.name}
                                </span>
                              ) : (
                                <span className="text-gray-400">—</span>
                              );
                            })()
                          )}
                        </td>
                        <td className="p-3">
                          <span
                            className={`inline-block px-2 py-0.5 text-xs rounded ${
                              record.isActive
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                            }`}
                          >
                            {record.isActive ? t('common.active') : t('admin.common.hidden')}
                          </span>
                        </td>
                        <td className="p-3">{record.sortOrder || 0}</td>
                        <td className="p-3">
                          <div className="flex items-center gap-1">
                            <button
                              className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400"
                              onClick={() => handleEdit(record)}
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400"
                              onClick={() => setDeleteConfirmId(record.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Phân trang */}
                {categories.length > pageSize && (
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">
                      {t('admin.categories.totalItems', {
                        range0: (currentPage - 1) * pageSize + 1,
                        range1: Math.min(currentPage * pageSize, categories.length),
                        total: categories.length,
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
                      {Array.from({ length: totalPages }, (_, i) => (
                        <button
                          key={i + 1}
                          className={`px-3 py-1 rounded text-sm ${
                            currentPage === i + 1
                              ? 'bg-primary-600 text-white'
                              : 'hover:bg-neutral-100 dark:hover:bg-neutral-700'
                          }`}
                          onClick={() => setCurrentPage(i + 1)}
                        >
                          {i + 1}
                        </button>
                      ))}
                      <button
                        className="p-2 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-40"
                        disabled={currentPage >= totalPages}
                        onClick={() => setCurrentPage((p) => p + 1)}
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Delete confirm dialog */}
          <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('admin.categories.deleteTitle')}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {t('admin.categories.deleteConfirm')}
              </p>
              <div className="flex justify-end gap-2 mt-4">
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

          {/* Create/Edit modal */}
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
            <DialogContent className="max-w-[600px]">
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
                    <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cat-description">{t('admin.brands.form.description')}</Label>
                  <textarea
                    id="cat-description"
                    rows={3}
                    placeholder={t('admin.brands.form.descriptionPlaceholder')}
                    className="flex w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 shadow-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
                    value={formData.description || ''}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, description: e.target.value }))
                    }
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
                    onValueChange={(val) =>
                      setFormData((prev) => ({ ...prev, parentId: val || null }))
                    }
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
                      className="flex h-10 w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 shadow-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-primary-500/30 focus:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50"
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
                      <span className="text-sm text-neutral-600 dark:text-neutral-400">
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
        </CardContent>
      </Card>
    </div>
  );
};

export default CategoriesPage;
