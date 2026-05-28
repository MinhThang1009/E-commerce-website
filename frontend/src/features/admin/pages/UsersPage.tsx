/**
 * @file UsersPage.tsx
 * @layer Page
 * @feature admin
 * @description Quản lý người dùng — glass design (spec §7, §16.2)
 */
import React, { useState } from 'react';
import {
  User,
  Pencil,
  Trash2,
  RefreshCw,
  Search,
  Mail,
  Phone,
  Crown,
  Users,
  Eye,
  Sparkles,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion } from 'framer-motion';
import { buildRoute } from '@/routes/paths';
import { formatDate } from '@/utils/format';
import { cn } from '@/utils/cn';
import {
  useGetAllUsersQuery,
  useUpdateUserMutation,
  useDeleteUserMutation,
  type UserDetail,
  type UserFilters,
} from '../api/admin-user-api';
import { getErrorMsg } from '@/utils/error-utils';
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
import { Pagination } from '@/components/common';
import { useUiStore } from '@/stores/ui-store';
import StatusPill from '../components/StatusPill';
import FlipNumber from '../components/FlipNumber';

interface UserFormData {
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'customer' | 'admin';
  isEmailVerified: boolean;
  isActive: boolean;
}

const easeOutQuart = [0.22, 1, 0.36, 1] as const;
const rowStagger = { animate: { transition: { staggerChildren: 0.025 } } };
const rowItem = {
  initial: { opacity: 0, y: 8 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.25, ease: easeOutQuart } },
};

const UsersPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { addNotification } = useUiStore();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDetail | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    firstName: '',
    lastName: '',
    phone: '',
    role: 'customer',
    isEmailVerified: false,
    isActive: true,
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [filters, setFilters] = useState<UserFilters>({
    page: 1,
    limit: 10,
    search: '',
    role: '',
    sortBy: 'createdAt',
    sortOrder: 'DESC',
  });

  const { data: usersData, isLoading, refetch } = useGetAllUsersQuery(filters);
  const { mutateAsync: updateUser, isPending: isUpdating } = useUpdateUserMutation();
  const { mutateAsync: deleteUser } = useDeleteUserMutation();

  const users = usersData?.data?.users || [];
  const pagination = usersData?.data?.pagination;

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    if (!formData.firstName.trim()) errors.firstName = t('admin.users.form.firstNameRequired');
    if (!formData.lastName.trim()) errors.lastName = t('admin.users.form.lastNameRequired');
    if (formData.phone && !/^(0|\+84)[0-9]{9}$/.test(formData.phone))
      errors.phone = t('validation.phone.invalid');
    if (!formData.role) errors.role = t('admin.users.form.roleRequired');
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser || !validateForm()) return;
    try {
      await updateUser({ id: editingUser.id, ...formData });
      addNotification({ type: 'success', message: t('admin.users.messages.editSuccess') });
      setIsModalVisible(false);
      setEditingUser(null);
    } catch (error) {
      addNotification({
        type: 'error',
        message: getErrorMsg(error, t('admin.users.messages.editError')),
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm(t('admin.users.deleteConfirm'))) return;
    try {
      await deleteUser(id);
      addNotification({ type: 'success', message: t('admin.users.messages.deleteSuccess') });
    } catch (error) {
      addNotification({
        type: 'error',
        message: getErrorMsg(error, t('admin.users.messages.deleteError')),
      });
    }
  };

  const handleEdit = (user: UserDetail) => {
    setEditingUser(user);
    setFormData({
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone || '',
      role: user.role,
      isEmailVerified: user.isEmailVerified,
      isActive: user.isActive,
    });
    setFormErrors({});
    setIsModalVisible(true);
  };

  const handleSearch = (value: string) => {
    setFilters((prev) => ({ ...prev, search: value, page: 1 }));
  };

  const handleFilterChange = (
    key: keyof UserFilters,
    value: string | number | boolean | undefined,
  ) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const totalUsers = pagination?.totalItems || 0;
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const customerCount = users.filter((u) => u.role === 'customer').length;
  const verifiedCount = users.filter((u) => u.isEmailVerified).length;
  const totalPages = pagination ? Math.ceil(pagination.totalItems / pagination.itemsPerPage) : 1;
  const isEmpty = !isLoading && users.length === 0;

  return (
    <div>
      {/* Page header */}
      <div className="relative rounded-3xl bg-[var(--bg-base)] dark:bg-white/[0.03] border border-[var(--border-default)] p-6 mb-5 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-50 pointer-events-none"
          style={{
            background: `
              radial-gradient(circle at 100% 0%, rgba(24, 144, 255, 0.10) 0%, transparent 40%),
              radial-gradient(circle at 0% 100%, rgba(114, 46, 209, 0.08) 0%, transparent 35%)
            `,
          }}
        />
        <div className="relative">
          <span className="section-number">06 / NGƯỜI DÙNG</span>
          <div className="flex items-center gap-2.5 mt-2">
            <h1 className="display-heading">{t('admin.users.title')}</h1>
            <Sparkles className="w-5 h-5 text-[var(--accent)]/60" aria-hidden="true" />
          </div>
          <p className="text-sm text-[var(--text-tertiary)] mt-1.5">{t('admin.users.subtitle')}</p>
        </div>
      </div>

      {/* Mini KPI stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
        {[
          {
            label: t('admin.users.stats.total'),
            value: totalUsers,
            Icon: User,
            color: '--admin-info',
          },
          {
            label: t('admin.users.stats.admins'),
            value: adminCount,
            Icon: Crown,
            color: '--admin-error',
          },
          {
            label: t('admin.users.stats.customers'),
            value: customerCount,
            Icon: Users,
            color: '--admin-success',
          },
          {
            label: t('admin.users.stats.verified'),
            value: verifiedCount,
            Icon: Mail,
            color: '--admin-purple',
          },
        ].map(({ label, value, Icon, color }) => (
          <div
            key={label}
            className="rounded-2xl bg-[var(--bg-base)] dark:bg-white/[0.03] border border-[var(--border-default)] p-4 shadow-sm hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                {label}
              </span>
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: `var(${color}) / 0.12` }}
              >
                <Icon className="w-4 h-4" style={{ color: `var(${color})` }} strokeWidth={2.25} />
              </div>
            </div>
            <FlipNumber value={value} className="text-2xl font-bold text-[var(--text-primary)]" />
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div className="rounded-2xl bg-[var(--bg-base)] dark:bg-white/[0.03] border border-[var(--border-default)] p-4 mb-5 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[var(--text-tertiary)] pointer-events-none" />
            <Input
              placeholder={t('admin.users.searchPlaceholder')}
              value={filters.search}
              onChange={(e) => handleSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={filters.role || 'all'}
            onValueChange={(value) => handleFilterChange('role', value === 'all' ? '' : value)}
          >
            <SelectTrigger>
              <SelectValue placeholder={t('admin.users.filter.role')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('common.all')}</SelectItem>
              <SelectItem value="admin">{t('admin.users.roles.admin')}</SelectItem>
              <SelectItem value="customer">{t('admin.users.roles.customer')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filters.sortBy} onValueChange={(v) => handleFilterChange('sortBy', v)}>
            <SelectTrigger>
              <SelectValue placeholder={t('admin.users.filter.sortBy')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="createdAt">{t('admin.users.filter.sortByDate')}</SelectItem>
              <SelectItem value="firstName">{t('admin.users.filter.sortByName')}</SelectItem>
              <SelectItem value="email">{t('admin.users.filter.sortByEmail')}</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex gap-2">
            <Select
              value={filters.sortOrder}
              onValueChange={(v) => handleFilterChange('sortOrder', v)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="DESC">{t('admin.users.filter.desc')}</SelectItem>
                <SelectItem value="ASC">{t('admin.users.filter.asc')}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="outline"
              onClick={() => refetch()}
              disabled={isLoading}
              className="shrink-0"
            >
              <RefreshCw
                className={cn('w-4 h-4', isLoading && 'animate-spin')}
                strokeWidth={2.25}
              />
            </Button>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-[var(--bg-base)] dark:bg-white/[0.03] border border-[var(--border-default)] overflow-hidden shadow-sm">
        {isLoading ? (
          <div className="p-5 space-y-3">
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="shimmer h-16 rounded-lg" />
            ))}
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-16 px-6">
            <div className="relative w-20 h-20 mb-5">
              <div className="absolute inset-0 rounded-3xl bg-[var(--admin-info)]/10 blur-2xl" />
              <div className="relative w-full h-full rounded-3xl bg-gradient-to-br from-[var(--admin-info)]/15 to-[var(--accent)]/10 flex items-center justify-center border border-[var(--admin-info)]/20">
                <Users className="w-10 h-10 text-[var(--admin-info)]" strokeWidth={1.5} />
              </div>
            </div>
            <h3 className="text-lg font-semibold mb-1.5">{t('common.noData')}</h3>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[800px]">
              <thead className="bg-white/[0.02]">
                <tr>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
                    {t('admin.users.table.user')}
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] w-[120px]">
                    {t('admin.users.table.role')}
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] w-[150px]">
                    {t('common.status')}
                  </th>
                  <th className="text-left px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] w-[120px]">
                    {t('admin.users.table.createdAt')}
                  </th>
                  <th className="text-right px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] w-[140px]">
                    {t('admin.common.actions')}
                  </th>
                </tr>
              </thead>
              <motion.tbody variants={rowStagger} initial="initial" animate="animate">
                {users.map((record) => (
                  <motion.tr
                    key={record.id}
                    variants={rowItem}
                    className="border-t border-[var(--border-default)] hover:bg-white/[0.03] transition group"
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {record.avatar ? (
                          <img
                            src={record.avatar}
                            alt={`${record.firstName} ${record.lastName}`}
                            className="w-10 h-10 rounded-full object-cover ring-2 ring-[var(--border-default)] group-hover:ring-[var(--accent)]/30 transition"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--color-primary-dark)] flex items-center justify-center text-white font-semibold text-sm ring-2 ring-[var(--accent)]/20">
                            {(record.firstName?.[0] || 'U').toUpperCase()}
                          </div>
                        )}
                        <div className="min-w-0">
                          <div className="font-medium text-[var(--text-primary)] truncate">
                            {record.firstName} {record.lastName}
                          </div>
                          <div className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1">
                            <Mail className="w-3 h-3" />
                            {record.email}
                          </div>
                          {record.phone && (
                            <div className="text-[11px] text-[var(--text-tertiary)] flex items-center gap-1">
                              <Phone className="w-3 h-3" />
                              {record.phone}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill
                        variant={record.role === 'admin' ? 'error' : 'info'}
                        label={
                          <span className="inline-flex items-center gap-1">
                            {record.role === 'admin' ? (
                              <Crown className="w-3 h-3" />
                            ) : (
                              <User className="w-3 h-3" />
                            )}
                            {record.role === 'admin'
                              ? t('admin.users.roles.admin')
                              : t('admin.users.roles.customer')}
                          </span>
                        }
                        showDot={false}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="space-y-1">
                        <StatusPill
                          variant={record.isActive ? 'success' : 'error'}
                          label={
                            record.isActive
                              ? t('admin.users.status.active')
                              : t('admin.users.status.locked')
                          }
                        />
                        <StatusPill
                          variant={record.isEmailVerified ? 'info' : 'warning'}
                          label={
                            record.isEmailVerified
                              ? t('admin.users.table.verified')
                              : t('admin.users.table.notVerified')
                          }
                          showDot={false}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[var(--text-secondary)] tabular-nums text-xs">
                      {formatDate(record.createdAt, { dateStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={() => navigate(buildRoute.adminUserDetail(record.id))}
                          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--admin-info)]/10 hover:text-[var(--admin-info)] transition"
                          title={t('admin.orders.actions.view')}
                        >
                          <Eye className="w-4 h-4" strokeWidth={2.25} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleEdit(record)}
                          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--accent)]/10 hover:text-[var(--accent)] transition"
                        >
                          <Pencil className="w-4 h-4" strokeWidth={2.25} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(record.id)}
                          className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:bg-[var(--admin-error)]/10 hover:text-[var(--admin-error)] transition"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={2.25} />
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </motion.tbody>
            </table>
          </div>
        )}

        {totalPages > 1 && (
          <div className="px-5 py-4 border-t border-[var(--border-default)]">
            <Pagination
              currentPage={pagination?.currentPage || 1}
              totalPages={totalPages}
              onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
            />
          </div>
        )}
      </div>

      {/* Edit User Dialog — glass */}
      <Dialog
        open={isModalVisible}
        onOpenChange={(open) => {
          if (!open) {
            setIsModalVisible(false);
            setEditingUser(null);
          }
        }}
      >
        <DialogContent className="glass-card-lg max-w-[600px]">
          <DialogHeader>
            <DialogTitle>{t('admin.users.editUser')}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('admin.users.form.firstName')}</Label>
                <Input
                  value={formData.firstName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, firstName: e.target.value }))}
                  placeholder={t('admin.users.form.firstNamePlaceholder')}
                  className="mt-1"
                />
                {formErrors.firstName && (
                  <p className="text-xs text-[var(--admin-error)] mt-1">{formErrors.firstName}</p>
                )}
              </div>
              <div>
                <Label>{t('admin.users.form.lastName')}</Label>
                <Input
                  value={formData.lastName}
                  onChange={(e) => setFormData((prev) => ({ ...prev, lastName: e.target.value }))}
                  placeholder={t('admin.users.form.lastNamePlaceholder')}
                  className="mt-1"
                />
                {formErrors.lastName && (
                  <p className="text-xs text-[var(--admin-error)] mt-1">{formErrors.lastName}</p>
                )}
              </div>
            </div>

            <div>
              <Label>{t('admin.users.form.phone')}</Label>
              <Input
                value={formData.phone || ''}
                onChange={(e) => setFormData((prev) => ({ ...prev, phone: e.target.value }))}
                placeholder={t('admin.users.form.phonePlaceholder')}
                maxLength={10}
                className="mt-1"
              />
              {formErrors.phone && (
                <p className="text-xs text-[var(--admin-error)] mt-1">{formErrors.phone}</p>
              )}
            </div>

            <div>
              <Label>{t('admin.users.form.role')}</Label>
              <Select
                value={formData.role}
                onValueChange={(value) =>
                  setFormData((prev) => ({ ...prev, role: value as 'customer' | 'admin' }))
                }
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder={t('admin.users.form.rolePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="customer">{t('admin.users.roles.customer')}</SelectItem>
                  <SelectItem value="admin">{t('admin.users.roles.admin')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('admin.users.form.emailStatus')}</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Switch
                    checked={formData.isEmailVerified}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, isEmailVerified: checked }))
                    }
                  />
                  <span className="text-sm text-[var(--text-secondary)]">
                    {formData.isEmailVerified
                      ? t('admin.users.form.emailVerified')
                      : t('admin.users.form.emailNotVerified')}
                  </span>
                </div>
              </div>
              <div>
                <Label>{t('admin.users.form.accountStatus')}</Label>
                <div className="flex items-center gap-2 mt-2">
                  <Switch
                    checked={formData.isActive}
                    onCheckedChange={(checked) =>
                      setFormData((prev) => ({ ...prev, isActive: checked }))
                    }
                  />
                  <span className="text-sm text-[var(--text-secondary)]">
                    {formData.isActive
                      ? t('admin.users.status.active')
                      : t('admin.users.status.locked')}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsModalVisible(false);
                  setEditingUser(null);
                }}
              >
                {t('common.cancel')}
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating ? t('common.loading') : t('common.update')}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default UsersPage;
