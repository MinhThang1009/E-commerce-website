/**
 * @file ProfilePage.tsx
 * @layer Page
 * @feature users
 * @description Page component của feature users
 */
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ProfileAddressesTab } from '@/features/users';
import Button from '@/components/common/Button';
import { ROUTES } from '@/routes/paths';
import { useAuthStore } from '@/stores/auth-store';
import { useGetCurrentUserQuery } from '@/features/auth';
import { useUiStore } from '@/stores/ui-store';
import {
  useUpdateProfileMutation,
  useChangePasswordMutation,
  useGetAddressesQuery,
  useAddAddressMutation,
  useUpdateAddressMutation,
  useDeleteAddressMutation,
  useSetDefaultAddressMutation,
} from '@/features/users';
import { Address } from '@/types/user.types';
import { getErrorMsg } from '@/utils/error-utils';

type TabKey = 'info' | 'password' | 'orders' | 'addresses';

// Form trạng thái địa chỉ
interface AddressForm {
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

const emptyAddressForm: AddressForm = {
  name: '',
  firstName: '',
  lastName: '',
  phone: '',
  address1: '',
  address2: '',
  city: '',
  state: '',
  zip: '',
  country: '',
};

const ProfilePage: React.FC = () => {
  const { t } = useTranslation();
  const user = useAuthStore((s) => s.user);
  const updateUserStore = useAuthStore((s) => s.updateUser);
  const addNotification = useUiStore((s) => s.addNotification);
  const [activeTab, setActiveTab] = useState<TabKey>('info');

  const { data: currentUser, isLoading: isLoadingUser } = useGetCurrentUserQuery();
  const { mutateAsync: updateProfile, isPending: isUpdating } = useUpdateProfileMutation();
  const { mutateAsync: changePassword, isPending: isChangingPassword } =
    useChangePasswordMutation();

  // Hooks địa chỉ
  const { data: addressesData, isLoading: isLoadingAddresses } = useGetAddressesQuery();
  const { mutateAsync: addAddress, isPending: isAddingAddress } = useAddAddressMutation();
  const { mutateAsync: updateAddress, isPending: isUpdatingAddress } = useUpdateAddressMutation();
  const { mutateAsync: deleteAddress } = useDeleteAddressMutation();
  const { mutateAsync: setDefaultAddress } = useSetDefaultAddressMutation();

  // Trạng thái UI quản lý địa chỉ
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [editingAddressId, setEditingAddressId] = useState<string | null>(null);
  const [addressForm, setAddressForm] = useState<AddressForm>(emptyAddressForm);

  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });

  useEffect(() => {
    if (currentUser) {
      setFormData((prev) => ({
        ...prev,
        firstName: currentUser.firstName || '',
        lastName: currentUser.lastName || '',
        email: currentUser.email || '',
        phone: currentUser.phone || '',
      }));
    }
  }, [currentUser]);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isEditing, setIsEditing] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }));
  };

  const validateInfoForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.firstName) newErrors.firstName = t('profile.validation.firstNameRequired');
    if (!formData.lastName) newErrors.lastName = t('profile.validation.lastNameRequired');
    if (!formData.email) newErrors.email = t('profile.validation.emailRequired');
    else if (!/\S+@\S+\.\S+/.test(formData.email))
      newErrors.email = t('profile.validation.emailInvalid');
    if (
      formData.phone?.trim() &&
      !/^(0|\+84)[0-9]{9}$/.test(formData.phone.trim().replace(/[\s.-]/g, ''))
    )
      newErrors.phone = t('validation.phone.invalid');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePasswordForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.currentPassword)
      newErrors.currentPassword = t('profile.validation.currentPasswordRequired');
    if (!formData.newPassword) newErrors.newPassword = t('profile.validation.newPasswordRequired');
    else if (formData.newPassword.length < 6)
      newErrors.newPassword = t('profile.validation.newPasswordMin');
    if (!formData.confirmPassword)
      newErrors.confirmPassword = t('profile.validation.confirmPasswordRequired');
    else if (formData.newPassword !== formData.confirmPassword)
      newErrors.confirmPassword = t('profile.validation.passwordMismatch');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdateInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateInfoForm()) return;
    try {
      const updatedUser = await updateProfile({
        firstName: formData.firstName,
        lastName: formData.lastName,
        phone: formData.phone,
      });
      updateUserStore({
        firstName: updatedUser.firstName,
        lastName: updatedUser.lastName,
        phone: updatedUser.phone,
        avatar: updatedUser.avatar,
      });
      addNotification({
        type: 'success',
        message: t('profile.info.updateSuccess'),
        duration: 3000,
      });
      setIsEditing(false);
    } catch (error) {
      addNotification({
        type: 'error',
        message: getErrorMsg(error, t('profile.info.updateError')),
        duration: 5000,
      });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePasswordForm()) return;
    try {
      await changePassword({
        currentPassword: formData.currentPassword,
        newPassword: formData.newPassword,
        confirmPassword: formData.confirmPassword,
      });
      addNotification({
        type: 'success',
        message: t('profile.password.changeSuccess'),
        duration: 3000,
      });
      setFormData((prev) => ({
        ...prev,
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      }));
    } catch (error) {
      addNotification({
        type: 'error',
        message: getErrorMsg(error, t('profile.password.changeError')),
        duration: 5000,
      });
    }
  };

  // Xử lý mở form thêm địa chỉ mới
  const handleOpenAddAddress = () => {
    setEditingAddressId(null);
    setAddressForm(emptyAddressForm);
    setShowAddressForm(true);
  };

  // Xử lý mở form sửa địa chỉ
  const handleOpenEditAddress = (addr: Address) => {
    setEditingAddressId(addr.id);
    setAddressForm({
      name: addr.name || '',
      firstName: addr.firstName,
      lastName: addr.lastName,
      phone: addr.phone || '',
      address1: addr.address1,
      address2: addr.address2 || '',
      city: addr.city,
      state: addr.state,
      zip: addr.zip,
      country: addr.country,
    });
    setShowAddressForm(true);
  };

  // Xử lý lưu địa chỉ (thêm mới hoặc cập nhật)
  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    const addrErrors: Record<string, string> = {};
    if (!addressForm.firstName?.trim())
      addrErrors.firstName = t('profile.validation.firstNameRequired');
    if (!addressForm.lastName?.trim())
      addrErrors.lastName = t('profile.validation.lastNameRequired');
    if (!addressForm.address1?.trim()) addrErrors.address1 = t('checkout.validation.required');
    if (!addressForm.city?.trim()) addrErrors.city = t('checkout.validation.required');
    if (
      addressForm.phone?.trim() &&
      !/^(0|\+84)[0-9]{9}$/.test(addressForm.phone.trim().replace(/[\s.-]/g, ''))
    )
      addrErrors.phone = t('validation.phone.invalid');
    if (Object.keys(addrErrors).length > 0) {
      setErrors(addrErrors);
      return;
    }
    try {
      if (editingAddressId) {
        await updateAddress({ id: editingAddressId, ...addressForm });
        addNotification({
          type: 'success',
          message: t('profile.addresses.updateSuccess'),
          duration: 3000,
        });
      } else {
        await addAddress(addressForm as Omit<Address, 'id'>);
        addNotification({
          type: 'success',
          message: t('profile.addresses.addSuccess'),
          duration: 3000,
        });
      }
      setShowAddressForm(false);
      setEditingAddressId(null);
      setAddressForm(emptyAddressForm);
    } catch (err) {
      addNotification({
        type: 'error',
        message: getErrorMsg(err, t('common.error')),
        duration: 5000,
      });
    }
  };

  // Xử lý xóa địa chỉ
  const handleDeleteAddress = async (id: string) => {
    if (!window.confirm(t('profile.addresses.confirmDelete'))) return;
    try {
      await deleteAddress(id);
      addNotification({
        type: 'success',
        message: t('profile.addresses.deleteSuccess'),
        duration: 3000,
      });
    } catch (err) {
      addNotification({
        type: 'error',
        message: getErrorMsg(err, t('common.error')),
        duration: 5000,
      });
    }
  };

  // Xử lý đặt địa chỉ mặc định
  const handleSetDefault = async (id: string) => {
    try {
      await setDefaultAddress(id);
      addNotification({
        type: 'success',
        message: t('profile.addresses.defaultSuccess'),
        duration: 3000,
      });
    } catch (err) {
      addNotification({
        type: 'error',
        message: getErrorMsg(err, t('common.error')),
        duration: 5000,
      });
    }
  };

  const displayName =
    `${formData.firstName} ${formData.lastName}`.trim() || t('profile.defaultName');
  const initials =
    `${formData.firstName?.[0] || ''}${formData.lastName?.[0] || ''}`.toUpperCase() || 'U';

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    {
      key: 'info',
      label: t('profile.tabs.info'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
    },
    {
      key: 'password',
      label: t('profile.tabs.password'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
          />
        </svg>
      ),
    },
    {
      key: 'orders',
      label: t('profile.tabs.orders'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
          />
        </svg>
      ),
    },
    {
      key: 'addresses',
      label: t('profile.tabs.addresses'),
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
          />
        </svg>
      ),
    },
  ];

  if (isLoadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-primary-200 border-t-primary-600"></div>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">{t('profile.loading')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 pb-16">
      {/* Hero Header */}
      <div className="relative h-48 bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-700 overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        ></div>
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-neutral-50 dark:from-neutral-950 to-transparent"></div>
      </div>

      <div className="container mx-auto px-4 max-w-4xl -mt-16 relative z-10">
        {/* Avatar + Name Card */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-md border border-neutral-100 dark:border-neutral-800 p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {user?.avatar ? (
                <img
                  src={user.avatar}
                  alt={displayName}
                  className="w-24 h-24 rounded-2xl object-cover ring-4 ring-white dark:ring-neutral-900 shadow-lg"
                />
              ) : (
                <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-primary-500 to-indigo-600 flex items-center justify-center ring-4 ring-white dark:ring-neutral-900 shadow-lg">
                  <span className="text-white text-3xl font-bold tracking-wide">{initials}</span>
                </div>
              )}
              <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900"></div>
            </div>

            {/* Info */}
            <div className="flex-1 text-center sm:text-left">
              <h1 className="text-2xl font-bold text-neutral-900 dark:text-white">{displayName}</h1>
              <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-0.5">
                {formData.email}
              </p>
              <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-3 py-1 rounded-full border border-primary-200 dark:border-primary-800">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {t('profile.roleCustomer')}
                </span>
                {user?.isEmailVerified && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                      <path
                        fillRule="evenodd"
                        d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    {t('profile.emailVerified')}
                  </span>
                )}
              </div>
            </div>

            {/* Quick links */}
            <div className="flex gap-2">
              <Link
                to={ROUTES.ORDERS}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-sm font-medium transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
                {t('profile.quickLinks.orders')}
              </Link>
              <button className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/30 text-sm font-medium transition-colors border border-amber-200 dark:border-amber-800">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-white dark:bg-neutral-900 rounded-xl p-1.5 mb-6 shadow-sm border border-neutral-100 dark:border-neutral-800">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                activeTab === tab.key
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white hover:bg-neutral-50 dark:hover:bg-neutral-800'
              }`}
            >
              {tab.icon}
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === 'info' && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                  {t('profile.info.title')}
                </h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {t('profile.info.subtitle')}
                </p>
              </div>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                    />
                  </svg>
                  {t('profile.info.edit')}
                </button>
              )}
            </div>

            <form onSubmit={handleUpdateInfo}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {t('profile.info.firstName')}
                  </label>
                  <input
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleChange}
                    disabled={!isEditing || isUpdating}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors ${
                      isEditing
                        ? 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none'
                        : 'border-transparent bg-neutral-50 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 cursor-default'
                    } ${errors.firstName ? 'border-red-400' : ''}`}
                  />
                  {errors.firstName && <p className="text-xs text-red-500">{errors.firstName}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {t('profile.info.lastName')}
                  </label>
                  <input
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleChange}
                    disabled={!isEditing || isUpdating}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors ${
                      isEditing
                        ? 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none'
                        : 'border-transparent bg-neutral-50 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 cursor-default'
                    } ${errors.lastName ? 'border-red-400' : ''}`}
                  />
                  {errors.lastName && <p className="text-xs text-red-500">{errors.lastName}</p>}
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Email
                    <span className="ml-2 text-xs text-neutral-400 dark:text-neutral-500 font-normal">
                      {t('profile.info.emailReadOnly')}
                    </span>
                  </label>
                  <input
                    name="email"
                    type="email"
                    value={formData.email}
                    disabled
                    className="w-full px-4 py-2.5 rounded-xl border border-transparent bg-neutral-50 dark:bg-neutral-800/50 text-neutral-500 dark:text-neutral-400 cursor-not-allowed text-sm"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {t('profile.info.phone')}
                  </label>
                  <input
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={formData.phone}
                    onChange={(e) =>
                      handleChange({
                        target: { name: 'phone', value: e.target.value.replace(/[^0-9]/g, '') },
                      } as React.ChangeEvent<HTMLInputElement>)
                    }
                    disabled={!isEditing || isUpdating}
                    placeholder={t('profile.info.phonePlaceholder')}
                    className={`w-full px-4 py-2.5 rounded-xl border text-sm transition-colors ${
                      isEditing
                        ? 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 outline-none'
                        : 'border-transparent bg-neutral-50 dark:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300 cursor-default'
                    }`}
                  />
                </div>
              </div>

              {isEditing && (
                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-neutral-100 dark:border-neutral-800">
                  <button
                    type="button"
                    onClick={() => {
                      setIsEditing(false);
                      setFormData((prev) => ({
                        ...prev,
                        firstName: currentUser?.firstName || user?.firstName || '',
                        lastName: currentUser?.lastName || user?.lastName || '',
                        phone: currentUser?.phone || user?.phone || '',
                      }));
                      setErrors({});
                    }}
                    className="px-5 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-sm font-medium transition-colors"
                  >
                    {t('common.cancel')}
                  </button>
                  <Button
                    type="submit"
                    variant="primary"
                    size="sm"
                    disabled={isUpdating}
                    isLoading={isUpdating}
                  >
                    {t('profile.info.save')}
                  </Button>
                </div>
              )}
            </form>
          </div>
        )}

        {activeTab === 'password' && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-800 p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                {t('profile.password.title')}
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                {t('profile.password.subtitle')}
              </p>
            </div>

            <form onSubmit={handleChangePassword} className="max-w-md space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {t('profile.password.currentPassword')}
                </label>
                <input
                  name="currentPassword"
                  type="password"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-primary-500/20 outline-none transition-colors ${errors.currentPassword ? 'border-red-400' : 'border-neutral-300 dark:border-neutral-600 focus:border-primary-500'}`}
                />
                {errors.currentPassword && (
                  <p className="text-xs text-red-500">{errors.currentPassword}</p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {t('profile.password.newPassword')}
                </label>
                <input
                  name="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={handleChange}
                  placeholder={t('profile.password.newPasswordPlaceholder')}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-primary-500/20 outline-none transition-colors ${errors.newPassword ? 'border-red-400' : 'border-neutral-300 dark:border-neutral-600 focus:border-primary-500'}`}
                />
                {errors.newPassword && <p className="text-xs text-red-500">{errors.newPassword}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                  {t('profile.password.confirmPassword')}
                </label>
                <input
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder={t('profile.password.confirmPasswordPlaceholder')}
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-primary-500/20 outline-none transition-colors ${errors.confirmPassword ? 'border-red-400' : 'border-neutral-300 dark:border-neutral-600 focus:border-primary-500'}`}
                />
                {errors.confirmPassword && (
                  <p className="text-xs text-red-500">{errors.confirmPassword}</p>
                )}
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={isChangingPassword}
                  isLoading={isChangingPassword}
                >
                  {t('profile.password.change')}
                </Button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-800 p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
                {t('profile.orders.title')}
              </h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                {t('profile.orders.subtitle')}
              </p>
            </div>
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg
                  className="w-8 h-8 text-neutral-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                  />
                </svg>
              </div>
              <p className="text-neutral-500 dark:text-neutral-400 mb-4">
                {t('profile.orders.description')}
              </p>
              <Button variant="primary" size="sm" as={Link} to={ROUTES.ORDERS}>
                {t('profile.orders.viewAll')}
              </Button>
            </div>
          </div>
        )}

        {activeTab === 'addresses' && (
          <ProfileAddressesTab
            showAddressForm={showAddressForm}
            editingAddressId={editingAddressId}
            addressForm={addressForm}
            onAddressFormChange={setAddressForm}
            onOpenAddAddress={handleOpenAddAddress}
            onOpenEditAddress={handleOpenEditAddress}
            onSaveAddress={handleSaveAddress}
            onDeleteAddress={handleDeleteAddress}
            onSetDefault={handleSetDefault}
            onCancelForm={() => {
              setShowAddressForm(false);
              setEditingAddressId(null);
              setAddressForm(emptyAddressForm);
            }}
            isAddingAddress={isAddingAddress}
            isUpdatingAddress={isUpdatingAddress}
            isLoadingAddresses={isLoadingAddresses}
            addressesData={addressesData}
          />
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
