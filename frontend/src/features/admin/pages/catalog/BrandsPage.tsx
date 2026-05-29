/**
 * @file BrandsPage.tsx
 * @layer Page
 * @feature admin
 * @description Quản lý thương hiệu — glass design (spec §7, §16.2)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
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
import { useUiStore } from '@/stores/ui-store';
import { getUploadUrl } from '@/utils/upload-url';
import { getErrorMsg } from '@/utils/error-utils';
import { brandSchema } from '@/schemas/admin';
import { cn } from '@/utils/cn';
import {
  useGetBrandsQuery,
  useCreateBrandMutation,
  useUpdateBrandMutation,
  useDeleteBrandMutation,
} from '@features/catalog/api/brand-api';
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
  Switch,
} from '@/components/ui';
import StatusPill from '../../components/StatusPill';
import AdminPageHeader from '../../components/AdminPageHeader';

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

const easeOutQuart = [0.22, 1, 0.36, 1] as const;
const rowStagger = { animate: { transition: { staggerChildren: 0.025 } } };
const rowItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: easeOutQuart } },
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

  const { data: brandsData, isLoading, isFetching, refetch } = useGetBrandsQuery();
  const { mutateAsync: createBrand, isPending: isCreating } = useCreateBrandMutation();
  const { mutateAsync: updateBrand, isPending: isUpdating } = useUpdateBrandMutation();
  const { mutateAsync: deleteBrand } = useDeleteBrandMutation();

  const brands = brandsData?.data || [];
  const totalPages = Math.max(1, Math.ceil(brands.length / pageSize));
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

  const isEmpty = !isLoading && brands.length === 0;

  return (
    <div>
      {/* Page header */}
      <AdminPageHeader
        sectionNumber="04 / THƯƠNG HIỆU"
        title={t('admin.brands.title')}
        gradientTitle
        sparkle
        subtitle={t('admin.brands.subtitle')}
        actions={
          <>
            <Button variant="outline" onClick={() => refetch()} disabled={isFetching}>
              <RefreshCw
                className={cn('w-4 h-4 mr-2', isFetching && 'animate-spin')}
                strokeWidth={2.25}
              />
              {t('common.refresh')}
            </Button>
            <Button className="admin-btn-primary" onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" strokeWidth={2.25} />
              {t('admin.brands.addBrand')}
            </Button>
          </>
        }
      />

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
              <div className="absolute inset-0 rounded-3xl bg-[var(--color-secondary)]/10 blur-2xl" />
              <div className="relative w-full h-full rounded-3xl bg-gradient-to-br from-[var(--color-secondary)]/15 to-[var(--accent)]/10 flex items-center justify-center border border-[var(--color-secondary)]/20">
                <Award className="w-10 h-10 text-[var(--color-secondary)]" strokeWidth={1.5} />
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-1.5 text-[var(--text-primary)]">
              {t('admin.brands.empty.title', { defaultValue: 'Chưa có thương hiệu nào' })}
            </h3>
            <p className="text-sm text-[var(--text-tertiary)] text-center max-w-sm mb-6">
              {t('admin.brands.empty.description', {
                defaultValue: 'Tạo thương hiệu đầu tiên để khách hàng dễ nhận biết sản phẩm.',
              })}
            </p>
            <Button className="admin-btn-primary" onClick={handleCreate}>
              <Plus className="w-4 h-4 mr-2" strokeWidth={2.25} />
              {t('admin.brands.addBrand')}
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-white/[0.02]">
                <tr>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] w-20">
                    {t('admin.brands.table.logo')}
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    {t('admin.brands.table.name')}
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    {t('admin.brands.table.website') || 'Website'}
                  </th>
                  <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    {t('admin.brands.table.status')}
                  </th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] w-[120px]">
                    {t('admin.brands.table.actions')}
                  </th>
                </tr>
              </thead>
              <motion.tbody variants={rowStagger} initial="initial" animate="animate">
                {paginatedBrands.map((record: any) => {
                  const fullLogoUrl = getUploadUrl(record.logoUrl);
                  return (
                    <motion.tr
                      key={record.id}
                      variants={rowItem}
                      className="border-t border-[var(--border-default)] hover:bg-white/[0.03] transition group"
                    >
                      <td className="px-4 py-3">
                        <div className="w-12 h-12 rounded-lg overflow-hidden bg-[var(--bg-surface)] ring-1 ring-[var(--border-default)] group-hover:ring-[var(--color-secondary)]/30 transition flex items-center justify-center p-1.5">
                          {record.logoUrl ? (
                            <img
                              src={fullLogoUrl}
                              alt={record.name}
                              className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300"
                            />
                          ) : (
                            <Award
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
                      <td className="px-4 py-3">
                        {record.website ? (
                          <a
                            href={record.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 text-[var(--accent)] hover:underline transition"
                          >
                            <Globe className="w-3.5 h-3.5" strokeWidth={2.25} />
                            <span className="text-sm">{new URL(record.website).hostname}</span>
                          </a>
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
        {brands.length > pageSize && !isEmpty && (
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-5 py-4 border-t border-[var(--border-default)]">
            <span className="text-xs text-[var(--text-tertiary)]">
              {t('admin.brands.totalItems', { total: brands.length })}
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

      {/* Delete confirm — glass */}
      <Dialog open={!!deleteConfirmId} onOpenChange={() => setDeleteConfirmId(null)}>
        <DialogContent className="glass-dialog !border-[var(--admin-error)]/20 max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[var(--admin-error)]/15 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5 text-[var(--admin-error)]" strokeWidth={2.25} />
              </div>
              <div>
                <DialogTitle>{t('admin.brands.deleteTitle')}</DialogTitle>
                <p className="text-sm text-[var(--text-tertiary)] mt-1">
                  {t('admin.brands.deleteConfirm')}
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
            setEditingBrand(null);
            setFormData(initialFormData);
            setFormErrors({});
          }
        }}
      >
        <DialogContent className="glass-dialog max-w-[600px]">
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
                <p className="text-[var(--admin-error)] text-xs mt-1">{formErrors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="brand-description">{t('admin.brands.form.description')}</Label>
              <textarea
                id="brand-description"
                rows={3}
                placeholder={t('admin.brands.form.descriptionPlaceholder')}
                className="flex w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] dark:bg-white/[0.03] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition disabled:opacity-50"
                value={formData.description || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
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
                <p className="text-[var(--admin-error)] text-xs mt-1">{formErrors.website}</p>
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
                <span className="text-sm text-[var(--text-secondary)]">
                  {formData.isActive ? t('common.active') : t('admin.common.hidden')}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" type="button" onClick={() => setIsModalVisible(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                className="admin-btn-primary"
                disabled={isCreating || isUpdating}
              >
                {(isCreating || isUpdating) && <LoadingSpinner size="sm" />}
                {editingBrand ? t('common.update') : t('common.create')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BrandsPage;
