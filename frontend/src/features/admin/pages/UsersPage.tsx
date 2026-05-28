/**
 * @file UsersPage.tsx
 * @layer Page
 * @feature admin
 * @description Page component của feature admin
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
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buildRoute } from '@/routes/paths';
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
import { Card, CardContent } from '@/components/ui/card';
import { Pagination } from '@/components/common';
import { useUiStore } from '@/stores/ui-store';

interface UserFormData {
  firstName: string;
  lastName: string;
  phone?: string;
  role: 'customer' | 'admin';
  isEmailVerified: boolean;
  isActive: boolean;
}

const UsersPage: React.FC = () => {
  const { t, i18n } = useTranslation();
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
    if (!formData.firstName.trim()) {
      errors.firstName = t('admin.users.form.firstNameRequired');
    }
    if (!formData.lastName.trim()) {
      errors.lastName = t('admin.users.form.lastNameRequired');
    }
    if (formData.phone && !/^(0|\+84)[0-9]{9}$/.test(formData.phone)) {
      errors.phone = t('validation.phone.invalid');
    }
    if (!formData.role) {
      errors.role = t('admin.users.form.roleRequired');
    }
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

  const getRoleColor = (role: string) => {
    switch (role) {
      case 'admin':
        return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400';
      case 'customer':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400';
      default:
        return 'bg-neutral-100 text-neutral-800 dark:bg-neutral-700 dark:text-neutral-300';
    }
  };

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin':
        return <Crown className="size-3" />;
      default:
        return <User className="size-3" />;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'admin':
        return t('admin.users.roles.admin');
      case 'customer':
        return t('admin.users.roles.customer');
      default:
        return role;
    }
  };

  const totalUsers = pagination?.totalItems || 0;
  const adminCount = users.filter((u) => u.role === 'admin').length;
  const customerCount = users.filter((u) => u.role === 'customer').length;
  const verifiedCount = users.filter((u) => u.isEmailVerified).length;
  const totalPages = pagination ? Math.ceil(pagination.totalItems / pagination.itemsPerPage) : 1;

  return (
    <div className="p-2 sm:p-4 md:p-6">
      <Card className="dark:bg-neutral-800">
        <CardContent className="pt-6">
          <div className="mb-6">
            <h2 className="text-xl md:text-2xl font-semibold dark:text-white mb-1">
              {t('admin.users.title')}
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400">{t('admin.users.subtitle')}</p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card className="dark:bg-neutral-700">
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-neutral-500 dark:text-neutral-300 mb-1">
                  {t('admin.users.stats.total')}
                </p>
                <div className="flex items-center gap-2">
                  <User className="size-5" style={{ color: 'var(--admin-info)' }} />
                  <span className="text-2xl font-semibold" style={{ color: 'var(--admin-info)' }}>
                    {totalUsers}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card className="dark:bg-neutral-700">
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-neutral-500 dark:text-neutral-300 mb-1">
                  {t('admin.users.stats.admins')}
                </p>
                <div className="flex items-center gap-2">
                  <Crown className="size-5" style={{ color: 'var(--admin-error)' }} />
                  <span className="text-2xl font-semibold" style={{ color: 'var(--admin-error)' }}>
                    {adminCount}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card className="dark:bg-neutral-700">
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-neutral-500 dark:text-neutral-300 mb-1">
                  {t('admin.users.stats.customers')}
                </p>
                <div className="flex items-center gap-2">
                  <Users className="size-5" style={{ color: 'var(--admin-success)' }} />
                  <span
                    className="text-2xl font-semibold"
                    style={{ color: 'var(--admin-success)' }}
                  >
                    {customerCount}
                  </span>
                </div>
              </CardContent>
            </Card>
            <Card className="dark:bg-neutral-700">
              <CardContent className="pt-4 pb-4">
                <p className="text-sm text-neutral-500 dark:text-neutral-300 mb-1">
                  {t('admin.users.stats.verified')}
                </p>
                <div className="flex items-center gap-2">
                  <Mail className="size-5 text-purple-600 dark:text-purple-400" />
                  <span className="text-2xl font-semibold text-purple-600 dark:text-purple-400">
                    {verifiedCount}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters */}
          <div className="mb-4 p-4 bg-gray-50 dark:bg-neutral-700 rounded-lg">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 items-end">
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-neutral-400" />
                  <Input
                    placeholder={t('admin.users.searchPlaceholder')}
                    value={filters.search}
                    onChange={(e) => handleSearch(e.target.value)}
                    className="pl-9"
                  />
                </div>
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
              <Select
                value={filters.sortBy}
                onValueChange={(value) => handleFilterChange('sortBy', value)}
              >
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
                  onValueChange={(value) => handleFilterChange('sortOrder', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('admin.users.filter.sortOrder')} />
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
                  <RefreshCw className={`size-4 ${isLoading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800">
                  <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300">
                    {t('admin.users.table.user')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300 w-[120px]">
                    {t('admin.users.table.role')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300 w-[150px]">
                    {t('common.status')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300 w-[120px]">
                    {t('admin.users.table.createdAt')}
                  </th>
                  <th className="text-left px-4 py-3 font-medium text-neutral-700 dark:text-neutral-300 w-[120px]">
                    {t('admin.common.actions')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-neutral-500">
                      {t('common.loading')}
                    </td>
                  </tr>
                ) : users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-neutral-500">
                      {t('common.noData')}
                    </td>
                  </tr>
                ) : (
                  users.map((record) => (
                    <tr
                      key={record.id}
                      className="border-b border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          {record.avatar ? (
                            <img
                              src={record.avatar}
                              alt={`${record.firstName} ${record.lastName}`}
                              className="w-12 h-12 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-12 h-12 rounded-full bg-neutral-200 dark:bg-neutral-700 flex items-center justify-center">
                              <User className="size-5 text-neutral-500" />
                            </div>
                          )}
                          <div>
                            <div className="font-medium dark:text-white">
                              {record.firstName} {record.lastName}
                            </div>
                            <div className="text-sm text-gray-500 flex items-center gap-1">
                              <Mail className="size-3" />
                              {record.email}
                            </div>
                            {record.phone && (
                              <div className="text-sm text-gray-500 flex items-center gap-1">
                                <Phone className="size-3" />
                                {record.phone}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${getRoleColor(record.role)}`}
                        >
                          {getRoleIcon(record.role)}
                          {getRoleLabel(record.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="space-y-1">
                          <div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                record.isActive
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                  : 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                              }`}
                            >
                              {record.isActive
                                ? t('admin.users.status.active')
                                : t('admin.users.status.locked')}
                            </span>
                          </div>
                          <div>
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                                record.isEmailVerified
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                              }`}
                            >
                              {record.isEmailVerified
                                ? t('admin.users.table.verified')
                                : t('admin.users.table.notVerified')}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-neutral-600 dark:text-neutral-400">
                        {new Date(record.createdAt).toLocaleDateString(
                          i18n.language === 'vi' ? 'vi-VN' : 'en-US',
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => navigate(buildRoute.adminUserDetail(record.id))}
                          >
                            <Eye className="size-4" />
                          </Button>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination
              currentPage={pagination?.currentPage || 1}
              totalPages={totalPages}
              onPageChange={(page) => setFilters((prev) => ({ ...prev, page }))}
            />
          )}
        </CardContent>
      </Card>

      {/* Edit User Dialog */}
      <Dialog
        open={isModalVisible}
        onOpenChange={(open) => {
          if (!open) {
            setIsModalVisible(false);
            setEditingUser(null);
          }
        }}
      >
        <DialogContent className="max-w-[600px]">
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
                  <p className="text-xs text-red-500 mt-1">{formErrors.firstName}</p>
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
                  <p className="text-xs text-red-500 mt-1">{formErrors.lastName}</p>
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
              {formErrors.phone && <p className="text-xs text-red-500 mt-1">{formErrors.phone}</p>}
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
              {formErrors.role && <p className="text-xs text-red-500 mt-1">{formErrors.role}</p>}
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
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
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
                  <span className="text-sm text-neutral-600 dark:text-neutral-400">
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
