/**
 * @file DiscountCodesPage.tsx
 * @layer Page
 * @feature admin
 * @description Page component của feature admin
 */
import React, { useState, useEffect, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Percent,
  Banknote,
  Search,
  Zap,
  CalendarX,
  TrendingUp,
} from 'lucide-react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { formatPrice as formatPriceUtil } from '@/utils/format';
import {
  useGetDiscountCodesQuery,
  useCreateDiscountCodeMutation,
  useUpdateDiscountCodeMutation,
  useDeleteDiscountCodeMutation,
} from '../api/discount-code-api';
import { DiscountCode } from '@/types/discount.types';
import { getErrorMsg } from '@/utils/error-utils';
import { discountCodeSchema } from '@/schemas/admin';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Pagination } from '@/components/common';
import { useUiStore } from '@/stores/ui-store';
import StatusPill from '../components/StatusPill';
import AdminPageHeader from '../components/AdminPageHeader';
import AdminStatCard from '../components/AdminStatCard';
import AdminMobileCard from '../components/AdminMobileCard';

interface DiscountFormData {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  maxDiscountAmount?: number;
  minOrderAmount: number;
  usageLimit?: number;
  startDate: string;
  endDate: string;
  description: string;
  isActive: boolean;
}

const INITIAL_FORM: DiscountFormData = {
  code: '',
  type: 'percent',
  value: 0,
  maxDiscountAmount: undefined,
  minOrderAmount: 0,
  usageLimit: undefined,
  startDate: '',
  endDate: '',
  description: '',
  isActive: true,
};

const DiscountCodesPage: React.FC = () => {
  const { t } = useTranslation();
  const { addNotification } = useUiStore();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<DiscountCode | null>(null);
  const [formData, setFormData] = useState<DiscountFormData>(INITIAL_FORM);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [searchValue, setSearchValue] = useState('');
  const [filters, setFilters] = useState({ page: 1, limit: 10, search: '' });

  const { data: discountCodesData, isLoading } = useGetDiscountCodesQuery(filters);
  const { mutateAsync: createDiscountCode, isPending: isCreating } =
    useCreateDiscountCodeMutation();
  const { mutateAsync: updateDiscountCode, isPending: isUpdating } =
    useUpdateDiscountCodeMutation();
  const { mutateAsync: deleteDiscountCode } = useDeleteDiscountCodeMutation();

  const discountCodes = useMemo(
    () => discountCodesData?.data?.discountCodes || [],
    [discountCodesData],
  );
  const totalPages = Math.ceil((discountCodesData?.data?.pagination?.total || 0) / filters.limit);

  // Instant search — debounce 300ms (bỏ nút search riêng theo spec §8)
  useEffect(() => {
    const id = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchValue, page: 1 }));
    }, 300);
    return () => clearTimeout(id);
  }, [searchValue]);

  // Aggregate cho StatStrip — tính từ danh sách đã tải (data thật)
  const stats = useMemo(() => {
    const now = dayjs();
    let running = 0;
    let expired = 0;
    let totalUsage = 0;
    for (const c of discountCodes) {
      totalUsage += c.usedCount || 0;
      if (c.endDate && dayjs(c.endDate).isBefore(now)) expired += 1;
      else if (c.isActive) running += 1;
    }
    return { running, expired, totalUsage };
  }, [discountCodes]);

  const generateRandomCode = () => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < 8; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setFormData((prev) => ({ ...prev, code: result }));
  };

  const handleCreate = () => {
    setEditingCode(null);
    setFormData(INITIAL_FORM);
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleEdit = (record: DiscountCode) => {
    setEditingCode(record);
    setFormData({
      code: record.code,
      type: record.type as 'percent' | 'fixed',
      value: Number(record.value) || 0,
      maxDiscountAmount: record.maxDiscountAmount ? Number(record.maxDiscountAmount) : undefined,
      minOrderAmount: Number(record.minOrderAmount) || 0,
      usageLimit: record.usageLimit || undefined,
      startDate: record.startDate ? dayjs(record.startDate).format('YYYY-MM-DDTHH:mm') : '',
      endDate: record.endDate ? dayjs(record.endDate).format('YYYY-MM-DDTHH:mm') : '',
      description: record.description || '',
      isActive: record.isActive,
    });
    setFormErrors({});
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('admin.discountCodes.deleteConfirm'))) return;
    try {
      await deleteDiscountCode(id);
      addNotification({
        type: 'success',
        message: t('admin.discountCodes.messages.deleteSuccess'),
      });
    } catch (error) {
      addNotification({
        type: 'error',
        message: getErrorMsg(error, t('admin.discountCodes.messages.deleteError')),
      });
    }
  };

  const validateForm = (): boolean => {
    const result = discountCodeSchema.safeParse({
      code: formData.code,
      type: formData.type,
      value: formData.value,
    });
    if (!result.success) {
      const fe = result.error.flatten().fieldErrors;
      const errors: Record<string, string> = {};
      if (fe.code?.[0]) errors.code = fe.code[0];
      if (fe.value?.[0]) errors.value = fe.value[0];
      setFormErrors(errors);
      return false;
    }
    setFormErrors({});
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const data: any = { ...formData };
      if (data.startDate) data.startDate = new Date(data.startDate).toISOString();
      else delete data.startDate;
      if (data.endDate) data.endDate = new Date(data.endDate).toISOString();
      else delete data.endDate;

      Object.keys(data).forEach((key) => {
        if (data[key] === null || data[key] === '' || data[key] === undefined) delete data[key];
      });

      if (editingCode) {
        await updateDiscountCode({ id: editingCode.id, ...data });
        addNotification({
          type: 'success',
          message: t('admin.discountCodes.messages.editSuccess'),
        });
      } else {
        await createDiscountCode(data);
        addNotification({
          type: 'success',
          message: t('admin.discountCodes.messages.createSuccess'),
        });
      }

      setIsModalOpen(false);
      setFormData(INITIAL_FORM);
      setEditingCode(null);
    } catch (error) {
      addNotification({
        type: 'error',
        message: getErrorMsg(error, t('common.errorOccurred')),
      });
    }
  };

  const formatPrice = (price: number | string) => formatPriceUtil(price);

  return (
    <div>
      {/* Page header */}
      <AdminPageHeader
        sectionNumber="03 / MÃ GIẢM GIÁ"
        title={t('admin.discountCodes.title')}
        gradientTitle
        sparkle
        subtitle={t('admin.discountCodes.subtitle')}
        actions={
          <Button className="admin-btn-primary" onClick={handleCreate}>
            <Plus className="w-4 h-4 mr-2" strokeWidth={2.25} />
            {t('admin.discountCodes.createCode')}
          </Button>
        }
      />

      {/* StatStrip — đang chạy / hết hạn / tổng lượt dùng */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5">
        <AdminStatCard
          label={t('admin.discountCodes.stats.running')}
          value={stats.running}
          icon={Zap}
          accentVar="--color-success"
          isLoading={isLoading}
        />
        <AdminStatCard
          label={t('admin.discountCodes.stats.expired')}
          value={stats.expired}
          icon={CalendarX}
          accentVar="--color-danger"
          isLoading={isLoading}
        />
        <AdminStatCard
          label={t('admin.discountCodes.stats.totalUsage')}
          value={stats.totalUsage}
          icon={TrendingUp}
          accentVar="--color-info"
          isLoading={isLoading}
        />
      </div>

      {/* Filter + table card */}
      <div className="rounded-2xl bg-[var(--bg-base)] dark:bg-white/[0.03] border border-[var(--border-default)] overflow-hidden shadow-sm">
        <div className="p-4 border-b border-[var(--border-default)]">
          <div className="relative max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] pointer-events-none" />
            <Input
              placeholder={t('admin.discountCodes.searchPlaceholder')}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm min-w-[800px]">
            <thead className="bg-white/[0.02]">
              <tr>
                {['code', 'type', 'minOrder', 'period', 'usage'].map((key) => (
                  <th
                    key={key}
                    className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]"
                  >
                    {t(`admin.discountCodes.table.${key}`)}
                  </th>
                ))}
                <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  {t('common.status')}
                </th>
                <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                  {t('admin.common.actions')}
                </th>
              </tr>
            </thead>
            <motion.tbody
              initial="initial"
              animate="animate"
              variants={{ animate: { transition: { staggerChildren: 0.025 } } }}
            >
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[var(--text-tertiary)]">
                    {t('common.loading')}
                  </td>
                </tr>
              ) : discountCodes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-[var(--text-tertiary)]">
                    {t('common.noData')}
                  </td>
                </tr>
              ) : (
                discountCodes.map((record: DiscountCode) => (
                  <motion.tr
                    key={record.id}
                    variants={{
                      initial: { opacity: 0, y: 8 },
                      animate: { opacity: 1, y: 0, transition: { duration: 0.25 } },
                    }}
                    className="border-t border-[var(--border-default)] hover:bg-white/[0.03] transition group"
                  >
                    <td className="px-4 py-3">
                      <StatusPill
                        variant="info"
                        label={record.code}
                        showDot={false}
                        className="font-mono font-semibold"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-[var(--text-primary)]">
                        {record.type === 'percent' ? (
                          <Percent className="size-4 text-[var(--color-warning)]" />
                        ) : (
                          <Banknote className="size-4 text-[var(--color-success)]" />
                        )}
                        <span className="font-medium">
                          {record.type === 'percent'
                            ? `${record.value}%`
                            : formatPrice(record.value)}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)]">
                      {formatPrice(record.minOrderAmount)}
                    </td>
                    <td className="px-4 py-3 text-sm text-[var(--text-secondary)]">
                      <div>
                        {t('admin.discountCodes.table.from')}{' '}
                        {record.startDate
                          ? dayjs(record.startDate).format('DD/MM/YYYY')
                          : t('admin.discountCodes.table.unlimited')}
                      </div>
                      <div>
                        {t('admin.discountCodes.table.to')}{' '}
                        {record.endDate
                          ? dayjs(record.endDate).format('DD/MM/YYYY')
                          : t('admin.discountCodes.table.unlimited')}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <div className="text-sm cursor-default">
                            <span className="font-semibold text-[var(--color-info)]">
                              {record.usedCount}
                            </span>{' '}
                            / {record.usageLimit || '∞'}
                          </div>
                        </TooltipTrigger>
                        <TooltipContent>
                          {t('admin.discountCodes.table.usageInfo', {
                            used: record.usedCount,
                            limit: record.usageLimit || t('admin.discountCodes.table.noLimit'),
                          })}
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        variant={record.isActive ? 'success' : 'error'}
                        label={
                          record.isActive
                            ? t('admin.discountCodes.status.active')
                            : t('admin.discountCodes.status.paused')
                        }
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={() => handleEdit(record)}
                          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] transition"
                          title={t('common.edit')}
                          aria-label={t('common.edit')}
                        >
                          <Pencil className="w-4 h-4" strokeWidth={2.25} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(record.id)}
                          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)] transition"
                          title={t('common.delete')}
                          aria-label={t('common.delete')}
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={2.25} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </motion.tbody>
          </table>
        </div>

        {/* Mobile: card-list thay cho table */}
        {!isLoading && discountCodes.length > 0 && (
          <div className="space-y-3 p-3 md:hidden">
            {discountCodes.map((record: DiscountCode) => (
              <AdminMobileCard
                key={record.id}
                title={<span className="font-mono font-semibold">{record.code}</span>}
                status={
                  <StatusPill
                    variant={record.isActive ? 'success' : 'error'}
                    label={
                      record.isActive
                        ? t('admin.discountCodes.status.active')
                        : t('admin.discountCodes.status.paused')
                    }
                  />
                }
                fields={[
                  {
                    label: t('admin.discountCodes.table.type'),
                    value: (
                      <span className="inline-flex items-center gap-1 font-medium text-[var(--text-primary)]">
                        {record.type === 'percent' ? (
                          <Percent className="size-4 text-[var(--color-warning)]" />
                        ) : (
                          <Banknote className="size-4 text-[var(--color-success)]" />
                        )}
                        {record.type === 'percent' ? `${record.value}%` : formatPrice(record.value)}
                      </span>
                    ),
                  },
                  {
                    label: t('admin.discountCodes.table.minOrder'),
                    value: formatPrice(record.minOrderAmount),
                  },
                  {
                    label: t('admin.discountCodes.table.period'),
                    value: (
                      <span className="text-right">
                        {record.startDate
                          ? dayjs(record.startDate).format('DD/MM/YYYY')
                          : t('admin.discountCodes.table.unlimited')}
                        {' → '}
                        {record.endDate
                          ? dayjs(record.endDate).format('DD/MM/YYYY')
                          : t('admin.discountCodes.table.unlimited')}
                      </span>
                    ),
                  },
                  {
                    label: t('admin.discountCodes.table.usage'),
                    value: (
                      <span>
                        <span className="font-semibold text-[var(--color-info)]">
                          {record.usedCount}
                        </span>{' '}
                        / {record.usageLimit || '∞'}
                      </span>
                    ),
                  },
                ]}
                actions={
                  <>
                    <button
                      type="button"
                      onClick={() => handleEdit(record)}
                      className="rounded-lg p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--accent)]/10 hover:text-[var(--accent)]"
                      title={t('common.edit')}
                      aria-label={t('common.edit')}
                    >
                      <Pencil className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(record.id)}
                      className="rounded-lg p-1.5 text-[var(--text-secondary)] transition hover:bg-[var(--color-danger)]/10 hover:text-[var(--color-danger)]"
                      title={t('common.delete')}
                      aria-label={t('common.delete')}
                    >
                      <Trash2 className="h-4 w-4" strokeWidth={2.25} />
                    </button>
                  </>
                }
              />
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-[var(--border-default)]">
            <Pagination
              currentPage={filters.page}
              totalPages={totalPages}
              onPageChange={(page) => setFilters({ ...filters, page })}
            />
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsModalOpen(false);
            setFormData(INITIAL_FORM);
            setEditingCode(null);
          }
        }}
      >
        <DialogContent className="glass-dialog max-w-[700px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCode
                ? t('admin.discountCodes.editCode')
                : t('admin.discountCodes.createCodeModal')}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Code + Type */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('admin.discountCodes.form.code')}</Label>
                <div className="flex gap-2 mt-1">
                  <Input
                    value={formData.code}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, code: e.target.value.toUpperCase() }))
                    }
                    placeholder={t('admin.discountCodes.form.codePlaceholder')}
                    className="flex-1 uppercase"
                  />
                  <Button type="button" variant="outline" onClick={generateRandomCode} size="sm">
                    <Plus className="size-4" />
                  </Button>
                </div>
                {formErrors.code && (
                  <p className="text-xs text-[var(--color-danger)] mt-1">{formErrors.code}</p>
                )}
              </div>
              <div>
                <Label>{t('admin.discountCodes.form.type')}</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      type: value as 'percent' | 'fixed',
                    }))
                  }
                >
                  <SelectTrigger className="mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">
                      {t('admin.discountCodes.form.typePercent')}
                    </SelectItem>
                    <SelectItem value="fixed">{t('admin.discountCodes.form.typeFixed')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Value + Max Discount */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>
                  {formData.type === 'percent'
                    ? t('admin.discountCodes.form.valuePercent')
                    : t('admin.discountCodes.form.valueFixed')}
                </Label>
                <Input
                  type="number"
                  min={0}
                  max={formData.type === 'percent' ? 100 : undefined}
                  value={formData.value}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, value: Number(e.target.value) }))
                  }
                  className="mt-1"
                />
                {formErrors.value && (
                  <p className="text-xs text-[var(--color-danger)] mt-1">{formErrors.value}</p>
                )}
              </div>
              {formData.type === 'percent' && (
                <div>
                  <Label>{t('admin.discountCodes.form.maxDiscount')}</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.maxDiscountAmount ?? ''}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        maxDiscountAmount: e.target.value ? Number(e.target.value) : undefined,
                      }))
                    }
                    className="mt-1"
                  />
                </div>
              )}
            </div>

            {/* Min Order + Usage Limit */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('admin.discountCodes.form.minOrder')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.minOrderAmount}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      minOrderAmount: Number(e.target.value),
                    }))
                  }
                  className="mt-1"
                />
              </div>
              <div>
                <Label>{t('admin.discountCodes.form.usageLimit')}</Label>
                <Input
                  type="number"
                  min={0}
                  value={formData.usageLimit ?? ''}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      usageLimit: e.target.value ? Number(e.target.value) : undefined,
                    }))
                  }
                  placeholder={t('admin.discountCodes.form.usageLimitPlaceholder')}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Date Range */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('admin.discountCodes.table.from')}</Label>
                <Input
                  type="datetime-local"
                  value={formData.startDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, startDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label>{t('admin.discountCodes.table.to')}</Label>
                <Input
                  type="datetime-local"
                  value={formData.endDate}
                  onChange={(e) => setFormData((prev) => ({ ...prev, endDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <Label>{t('admin.discountCodes.form.description')}</Label>
              <textarea
                rows={2}
                value={formData.description}
                onChange={(e) => setFormData((prev) => ({ ...prev, description: e.target.value }))}
                placeholder={t('admin.discountCodes.form.descriptionPlaceholder')}
                className="mt-1 flex w-full rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] dark:bg-white/[0.03] px-3 py-2 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] transition"
              />
            </div>

            {/* Active switch */}
            <div>
              <Label>{t('common.status')}</Label>
              <div className="flex items-center gap-2 mt-2">
                <Switch
                  checked={formData.isActive}
                  onCheckedChange={(checked) =>
                    setFormData((prev) => ({ ...prev, isActive: checked }))
                  }
                />
                <span className="text-sm text-[var(--text-secondary)]">
                  {formData.isActive
                    ? t('admin.discountCodes.status.active')
                    : t('admin.discountCodes.status.paused')}
                </span>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setIsModalOpen(false)}>
                {t('common.cancel')}
              </Button>
              <Button
                type="submit"
                className="admin-btn-primary"
                disabled={isCreating || isUpdating}
              >
                {isCreating || isUpdating
                  ? t('common.loading')
                  : editingCode
                    ? t('common.update')
                    : t('common.create')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DiscountCodesPage;
