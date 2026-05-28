/**
 * @file BrandsPage.tsx
 * @layer Page
 * @feature catalog
 * @description Page component của feature catalog
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { useUiStore } from '@/stores/ui-store';
import { useTranslation } from 'react-i18next';
import ImageUpload from '@/components/common/ImageUpload';
import { getUploadUrl } from '@/utils/upload-url';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  useGetBrandsQuery,
  useCreateBrandMutation,
  useUpdateBrandMutation,
  useDeleteBrandMutation,
} from '@features/catalog/api/brand-api';
import { getErrorMsg } from '@/utils/error-utils';
import { brandSchema } from '@/schemas/admin';
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
  Switch,
} from '@/components/ui';
import {
  Plus,
  Pencil,
  Trash2,
  Globe,
  RefreshCw,
  Award,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';

interface BrandFormData {
  name: string;
  description?: string;
  logoUrl?: string;
  website?: string;
  isActive: boolean;
}

interface FormErrors {
  name?: string;
  website?: string;
}

const initialFormData: BrandFormData = {
  name: '',
  description: '',
  logoUrl: '',
  website: '',
  isActive: true,
};

const BrandsPage: React.FC = () => {
  const { t } = useTranslation();
  const addNotification = useUiStore((s) => s.addNotification);
  const [formData, setFormData] = useState<BrandFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingBrand, setEditingBrand] = useState<any>(null);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const { data: brandsData, isLoading, refetch } = useGetBrandsQuery();
  const { mutateAsync: createBrand, isPending: isCreating } = useCreateBrandMutation();
  const { mutateAsync: updateBrand, isPending: isUpdating } = useUpdateBrandMutation();
  const { mutateAsync: deleteBrand, isPending: _isDeleting } = useDeleteBrandMutation();

  const brands = brandsData?.data || [];
  const totalPages = Math.ceil(brands.length / pageSize);
  const paginatedBrands = brands.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  const validateForm = (): boolean => {
    const result = brandSchema.safeParse({
      name: formData.name,
      website: formData.website,
    });
    if (!result.success) {
      const fe = result.error.flatten().fieldErrors;
      setFormErrors({ name: fe.name?.[0], website: fe.website?.[0] });
      return false;
    }
    setFormErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      if (editingBrand) {
        await updateBrand({ id: editingBrand.id, body: formData });
        addNotification({ message: t('admin.brands.messages.editSuccess'), type: 'success' });
      } else {
        await createBrand(formData);
        addNotification({ message: t('admin.brands.messages.addSuccess'), type: 'success' });
      }
      setIsModalVisible(false);
      setEditingBrand(null);
      setFormData(initialFormData);
      setFormErrors({});
      refetch();
    } catch (error) {
      addNotification({ message: getErrorMsg(error, t('common.errorOccurred')), type: 'error' });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteBrand(id);
      addNotification({ message: t('admin.brands.messages.deleteSuccess'), type: 'success' });
      refetch();
    } catch (error) {
      addNotification({
        message: getErrorMsg(error, t('admin.brands.messages.deleteError')),
        type: 'error',
      });
    }
    setDeleteConfirmId(null);
  };

  const handleCreate = () => {
    setEditingBrand(null);
    setIsModalVisible(true);
    setFormData(initialFormData);
    setFormErrors({});
  };

  const handleEdit = (brand: any) => {
    setEditingBrand(brand);
    setIsModalVisible(true);
    setFormData({
      name: brand.name,
      description: brand.description || '',
      logoUrl: brand.logoUrl || '',
      website: brand.website || '',
      isActive: brand.isActive,
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
                {t('admin.brands.title')}
              </h2>
              <p className="text-neutral-600 dark:text-neutral-400">{t('admin.brands.subtitle')}</p>
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
                {t('admin.brands.addBrand')}
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
                      <th className="p-3 text-left w-20">{t('admin.brands.table.logo')}</th>
                      <th className="p-3 text-left">{t('admin.brands.table.name')}</th>
                      <th className="p-3 text-left">
                        {t('admin.brands.table.website') || 'Website'}
                      </th>
                      <th className="p-3 text-left">{t('admin.brands.table.status')}</th>
                      <th className="p-3 text-left w-[120px]">{t('admin.brands.table.actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedBrands.map((record: any) => {
                      const fullLogoUrl = getUploadUrl(record.logoUrl);
                      return (
                        <tr
                          key={record.id}
                          className="border-b border-neutral-100 dark:border-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                        >
                          <td className="p-3">
                            {record.logoUrl ? (
                              <img
                                src={fullLogoUrl}
                                alt={record.name}
                                className="w-[50px] h-[50px] object-contain rounded bg-gray-100 p-1"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-gray-100 dark:bg-neutral-700 rounded flex items-center justify-center">
                                <Award className="w-5 h-5 text-gray-400" />
                              </div>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="font-medium">{record.name}</div>
                            <div className="text-sm text-gray-500">{record.slug}</div>
                          </td>
                          <td className="p-3">
                            {record.website ? (
                              <a
                                href={record.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:underline"
                              >
                                <Globe className="w-4 h-4" /> {new URL(record.website).hostname}
                              </a>
                            ) : (
                              <span className="text-gray-400">—</span>
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
                      );
                    })}
                  </tbody>
                </table>

                {/* Phân trang */}
                {brands.length > pageSize && (
                  <div className="mt-4 flex items-center justify-between">
                    <span className="text-sm text-neutral-500 dark:text-neutral-400">
                      {t('admin.brands.totalItems', { total: brands.length })}
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
                <DialogTitle>{t('admin.brands.deleteTitle')}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {t('admin.brands.deleteConfirm')}
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
                setEditingBrand(null);
                setFormData(initialFormData);
                setFormErrors({});
              }
            }}
          >
            <DialogContent className="max-w-[600px]">
              <DialogHeader>
                <DialogTitle>
                  {editingBrand ? t('admin.brands.editBrand') : t('admin.brands.addBrandModal')}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="brand-name">{t('admin.brands.form.name')}</Label>
                  <Input
                    id="brand-name"
                    placeholder={t('admin.brands.form.namePlaceholder')}
                    value={formData.name}
                    onChange={(e) => setFormData((prev) => ({ ...prev, name: e.target.value }))}
                  />
                  {formErrors.name && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.name}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brand-description">{t('admin.brands.form.description')}</Label>
                  <textarea
                    id="brand-description"
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
                  <Label>{t('admin.brands.form.logo')}</Label>
                  <ImageUpload
                    type="brands"
                    multiple={false}
                    value={formData.logoUrl || ''}
                    onChange={(val) =>
                      setFormData((prev) => ({
                        ...prev,
                        logoUrl: typeof val === 'string' ? val : val[0] || '',
                      }))
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="brand-website">{t('admin.brands.form.website')}</Label>
                  <Input
                    id="brand-website"
                    placeholder={t('admin.brands.form.websitePlaceholder')}
                    value={formData.website || ''}
                    onChange={(e) => setFormData((prev) => ({ ...prev, website: e.target.value }))}
                  />
                  {formErrors.website && (
                    <p className="text-red-500 text-xs mt-1">{formErrors.website}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>{t('common.status')}</Label>
                  <div className="flex items-center gap-2 pt-1">
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

                <div className="flex justify-end gap-2 mt-6">
                  <Button variant="outline" type="button" onClick={() => setIsModalVisible(false)}>
                    {t('common.cancel')}
                  </Button>
                  <Button type="submit" disabled={isCreating || isUpdating}>
                    {(isCreating || isUpdating) && <LoadingSpinner size="sm" />}
                    {editingBrand ? t('common.update') : t('common.create')}
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

export default BrandsPage;
