/**
 * @file DiscountCodesPage.tsx
 * @layer Page
 * @feature admin
 * @description Page component của feature admin
 */
import React, { useState } from 'react';
import { Plus, Pencil, Trash2, Percent, DollarSign, CheckCircle, Ban, Search } from 'lucide-react';
import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';
import { getLocale } from '@/utils/format';
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
import { Card, CardContent } from '@/components/ui/card';
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';
import { Pagination } from '@/components/common';
import { useUiStore } from '@/stores/ui-store';

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

  const discountCodes = discountCodesData?.data?.discountCodes || [];
  const totalPages = Math.ceil((discountCodesData?.data?.pagination?.total || 0) / filters.limit);

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

  // Luôn VND — locale động theo ngôn ngữ UI
  const formatPrice = (price: number | string) => {
    const num = parseFloat(String(price));
    if (isNaN(num)) return `0${t('common.currencySymbol')}`;
    return new Intl.NumberFormat(getLocale(), { style: 'currency', currency: 'VND' }).format(num);
  };

  const handleSearch = () => {
    setFilters({ ...filters, search: searchValue, page: 1 });
  };

  return (
    <div className="p-2 sm:p-4 md:p-6">
      <Card className="mb-4 md:mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-xl md:text-2xl font-bold flex items-center gap-2 m-0 dark:text-white">
                <Percent className="size-5 text-blue-500" />
                {t('admin.discountCodes.title')}
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 mt-1">
                {t('admin.discountCodes.subtitle')}
              </p>
            </div>
            <Button onClick={handleCreate} size="lg">
              <Plus className="size-4 mr-1" />
              {t('admin.discountCodes.createCode')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          {/* Search */}
          <div className="mb-4 flex gap-2">
            <div className="relative w-[300px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
              <Input
                placeholder={t('admin.discountCodes.searchPlaceholder')}
                value={searchValue}
                onChange={(e) => setSearchValue(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                className="pl-9"
              />
            </div>
            <Button variant="outline" onClick={handleSearch}>
              <Search className="size-4" />
            </Button>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
                  <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300">
                    {t('admin.discountCodes.table.code')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300">
                    {t('admin.discountCodes.table.type')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300">
                    {t('admin.discountCodes.table.minOrder')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300">
                    {t('admin.discountCodes.table.period')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300">
                    {t('admin.discountCodes.table.usage')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300">
                    {t('common.status')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300">
                    {t('admin.common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-neutral-500">
                      {t('common.loading')}
                    </td>
                  </tr>
                ) : discountCodes.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-neutral-500">
                      {t('common.noData')}
                    </td>
                  </tr>
                ) : (
                  discountCodes.map((record: DiscountCode) => (
                    <tr
                      key={record.id}
                      className="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    >
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">
                          {record.code}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 dark:text-neutral-200">
                          {record.type === 'percent' ? (
                            <Percent className="size-4 text-orange-500" />
                          ) : (
                            <DollarSign className="size-4 text-green-500" />
                          )}
                          <span className="font-medium">
                            {record.type === 'percent'
                              ? `${record.value}%`
                              : formatPrice(record.value)}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                        {formatPrice(record.minOrderAmount)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 dark:text-neutral-400">
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
                              <span className="font-semibold text-blue-600">
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
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                            record.isActive
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                          }`}
                        >
                          {record.isActive ? (
                            <CheckCircle className="size-3" />
                          ) : (
                            <Ban className="size-3" />
                          )}
                          {record.isActive
                            ? t('admin.discountCodes.status.active')
                            : t('admin.discountCodes.status.paused')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(record)}>
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                            onClick={() => handleDelete(record.id)}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <Pagination
              currentPage={filters.page}
              totalPages={totalPages}
              onPageChange={(page) => setFilters({ ...filters, page })}
            />
          )}
        </CardContent>
      </Card>

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
        <DialogContent className="max-w-[700px] max-h-[85vh] overflow-y-auto">
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
                {formErrors.code && <p className="text-xs text-red-500 mt-1">{formErrors.code}</p>}
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
                  <p className="text-xs text-red-500 mt-1">{formErrors.value}</p>
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
                className="mt-1 flex w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 shadow-sm transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:border-primary-500"
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
                <span className="text-sm text-neutral-600 dark:text-neutral-400">
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
              <Button type="submit" disabled={isCreating || isUpdating}>
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
