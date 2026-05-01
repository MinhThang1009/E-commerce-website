import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import Input from '@/components/common/Input';
import { RootState } from '@/store';
import { updateUser } from '@/features/auth/authSlice';
import { addNotification } from '@/features/ui/uiSlice';
import {
  useUpdateProfileMutation,
  useChangePasswordMutation,
} from '@/services/userApi';
import { useGetCurrentUserQuery } from '@/services/authApi';
import { useGetLoyaltyInfoQuery } from '@/services/loyaltyApi';
import { formatPrice } from '@/utils/format';

type TabKey = 'info' | 'password' | 'orders' | 'loyalty';

const ProfilePage: React.FC = () => {
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState<TabKey>('info');

  const { data: currentUser, isLoading: isLoadingUser } = useGetCurrentUserQuery();
  const { data: loyaltyData } = useGetLoyaltyInfoQuery();
  const [updateProfile, { isLoading: isUpdating }] = useUpdateProfileMutation();
  const [changePassword, { isLoading: isChangingPassword }] = useChangePasswordMutation();

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
    if (!formData.firstName) newErrors.firstName = 'Vui lòng nhập tên';
    if (!formData.lastName) newErrors.lastName = 'Vui lòng nhập họ';
    if (!formData.email) newErrors.email = 'Vui lòng nhập email';
    else if (!/\S+@\S+\.\S+/.test(formData.email)) newErrors.email = 'Email không hợp lệ';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validatePasswordForm = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.currentPassword) newErrors.currentPassword = 'Vui lòng nhập mật khẩu hiện tại';
    if (!formData.newPassword) newErrors.newPassword = 'Vui lòng nhập mật khẩu mới';
    else if (formData.newPassword.length < 6) newErrors.newPassword = 'Mật khẩu tối thiểu 6 ký tự';
    if (!formData.confirmPassword) newErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu mới';
    else if (formData.newPassword !== formData.confirmPassword) newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp';
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
      }).unwrap();
      dispatch(updateUser({ firstName: updatedUser.firstName, lastName: updatedUser.lastName, phone: updatedUser.phone, avatar: updatedUser.avatar }));
      dispatch(addNotification({ type: 'success', message: 'Cập nhật hồ sơ thành công!', duration: 3000 }));
      setIsEditing(false);
    } catch (error: any) {
      dispatch(addNotification({ type: 'error', message: error.data?.message || 'Cập nhật thất bại', duration: 5000 }));
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validatePasswordForm()) return;
    try {
      await changePassword({ currentPassword: formData.currentPassword, newPassword: formData.newPassword, confirmPassword: formData.confirmPassword }).unwrap();
      dispatch(addNotification({ type: 'success', message: 'Đổi mật khẩu thành công!', duration: 3000 }));
      setFormData((prev) => ({ ...prev, currentPassword: '', newPassword: '', confirmPassword: '' }));
    } catch (error: any) {
      dispatch(addNotification({ type: 'error', message: error.data?.message || 'Đổi mật khẩu thất bại', duration: 5000 }));
    }
  };

  const displayName = `${formData.firstName} ${formData.lastName}`.trim() || 'Người dùng';
  const initials = `${formData.firstName?.[0] || ''}${formData.lastName?.[0] || ''}`.toUpperCase() || 'U';

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    {
      key: 'info',
      label: 'Thông tin cá nhân',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
    {
      key: 'password',
      label: 'Đổi mật khẩu',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      ),
    },
    {
      key: 'orders',
      label: 'Đơn hàng',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
      ),
    },
    {
      key: 'loyalty',
      label: 'Điểm tích lũy',
      icon: (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      ),
    },
  ];

  if (isLoadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="animate-spin rounded-full h-14 w-14 border-4 border-primary-200 border-t-primary-600"></div>
          <p className="text-neutral-500 dark:text-neutral-400 text-sm">Đang tải hồ sơ...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950 pb-16">
      {/* Hero Header */}
      <div className="relative h-48 bg-gradient-to-r from-primary-600 via-primary-700 to-indigo-700 overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)', backgroundSize: '60px 60px' }}></div>
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-neutral-50 dark:from-neutral-950 to-transparent"></div>
      </div>

      <div className="container mx-auto px-4 max-w-4xl -mt-16 relative z-10">
        {/* Avatar + Name Card */}
        <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-md border border-neutral-100 dark:border-neutral-800 p-6 mb-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5">
            {/* Avatar */}
            <div className="relative flex-shrink-0">
              {user?.avatar ? (
                <img src={user.avatar} alt={displayName} className="w-24 h-24 rounded-2xl object-cover ring-4 ring-white dark:ring-neutral-900 shadow-lg" />
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
              <p className="text-neutral-500 dark:text-neutral-400 text-sm mt-0.5">{formData.email}</p>
              <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
                <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-3 py-1 rounded-full border border-primary-200 dark:border-primary-800">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
                  Khách hàng
                </span>
                {user?.isEmailVerified && (
                  <span className="inline-flex items-center gap-1.5 text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 px-3 py-1 rounded-full border border-emerald-200 dark:border-emerald-800">
                    <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" /></svg>
                    Đã xác minh
                  </span>
                )}
              </div>
            </div>

            {/* Quick links */}
            <div className="flex gap-2">
              <Link to="/orders" className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-sm font-medium transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
                Đơn hàng
              </Link>
              <button 
                onClick={() => setActiveTab('loyalty')}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-800/30 text-sm font-medium transition-colors border border-amber-200 dark:border-amber-800"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {loyaltyData?.data?.points || 0} Điểm
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
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Thông tin cá nhân</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Quản lý thông tin hồ sơ của bạn</p>
              </div>
              {!isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-800 text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                  Chỉnh sửa
                </button>
              )}
            </div>

            <form onSubmit={handleUpdateInfo}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Họ</label>
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
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Tên</label>
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
                    <span className="ml-2 text-xs text-neutral-400 dark:text-neutral-500 font-normal">(không thể thay đổi)</span>
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
                  <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Số điện thoại</label>
                  <input
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    disabled={!isEditing || isUpdating}
                    placeholder="Chưa cập nhật"
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
                    Hủy
                  </button>
                  <button
                    type="submit"
                    disabled={isUpdating}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                  >
                    {isUpdating ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                        Đang lưu...
                      </>
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                        Lưu thay đổi
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          </div>
        )}

        {activeTab === 'password' && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-800 p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Đổi mật khẩu</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Đảm bảo mật khẩu của bạn đủ mạnh và an toàn</p>
            </div>

            <form onSubmit={handleChangePassword} className="max-w-md space-y-5">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Mật khẩu hiện tại</label>
                <input
                  name="currentPassword"
                  type="password"
                  value={formData.currentPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-primary-500/20 outline-none transition-colors ${errors.currentPassword ? 'border-red-400' : 'border-neutral-300 dark:border-neutral-600 focus:border-primary-500'}`}
                />
                {errors.currentPassword && <p className="text-xs text-red-500">{errors.currentPassword}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Mật khẩu mới</label>
                <input
                  name="newPassword"
                  type="password"
                  value={formData.newPassword}
                  onChange={handleChange}
                  placeholder="Tối thiểu 6 ký tự"
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-primary-500/20 outline-none transition-colors ${errors.newPassword ? 'border-red-400' : 'border-neutral-300 dark:border-neutral-600 focus:border-primary-500'}`}
                />
                {errors.newPassword && <p className="text-xs text-red-500">{errors.newPassword}</p>}
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Xác nhận mật khẩu mới</label>
                <input
                  name="confirmPassword"
                  type="password"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Nhập lại mật khẩu mới"
                  className={`w-full px-4 py-2.5 rounded-xl border text-sm bg-white dark:bg-neutral-800 focus:ring-2 focus:ring-primary-500/20 outline-none transition-colors ${errors.confirmPassword ? 'border-red-400' : 'border-neutral-300 dark:border-neutral-600 focus:border-primary-500'}`}
                />
                {errors.confirmPassword && <p className="text-xs text-red-500">{errors.confirmPassword}</p>}
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isChangingPassword}
                  className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed shadow-sm"
                >
                  {isChangingPassword ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-2 border-white/30 border-t-white"></div>
                      Đang xử lý...
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                      Đổi mật khẩu
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        )}

        {activeTab === 'orders' && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-800 p-6">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Đơn hàng của bạn</h2>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Theo dõi lịch sử mua hàng của bạn</p>
            </div>
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" /></svg>
              </div>
              <p className="text-neutral-500 dark:text-neutral-400 mb-4">Xem toàn bộ lịch sử đơn hàng của bạn</p>
              <Link to="/orders" className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                Xem đơn hàng
              </Link>
            </div>
          </div>
        )}

        {activeTab === 'loyalty' && (
          <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-800 p-6">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">Điểm tích lũy</h2>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">Lịch sử tích lũy và sử dụng điểm của bạn</p>
              </div>
              <div className="bg-amber-50 dark:bg-amber-900/20 px-6 py-3 rounded-2xl border border-amber-200 dark:border-amber-800 text-center">
                <span className="block text-xs text-amber-600 dark:text-amber-400 font-medium uppercase tracking-wider mb-1">Tổng điểm hiện tại</span>
                <span className="text-2xl font-bold text-amber-700 dark:text-amber-300">{loyaltyData?.data?.points || 0}</span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-neutral-100 dark:border-neutral-800">
                    <th className="pb-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Ngày</th>
                    <th className="pb-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider">Loại</th>
                    <th className="pb-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider text-right">Số điểm</th>
                    <th className="pb-4 text-xs font-semibold text-neutral-400 uppercase tracking-wider pl-8">Mô tả</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800">
                  {loyaltyData?.data?.history?.items?.length > 0 ? (
                    loyaltyData.data.history.items.map((item: any) => (
                      <tr key={item.id} className="group hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors">
                        <td className="py-4 text-sm text-neutral-600 dark:text-neutral-400">
                          {new Date(item.createdAt).toLocaleDateString('vi-VN')}
                        </td>
                        <td className="py-4">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            item.type === 'earn' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' :
                            item.type === 'spend' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                            item.type === 'refund' ? 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300' :
                            'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
                          }`}>
                            {item.type === 'earn' ? 'Tích điểm' : 
                             item.type === 'spend' ? 'Sử dụng' : 
                             item.type === 'refund' ? 'Hoàn điểm' : 'Điều chỉnh'}
                          </span>
                        </td>
                        <td className={`py-4 text-sm font-bold text-right ${item.points >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                          {item.points >= 0 ? `+${item.points}` : item.points}
                        </td>
                        <td className="py-4 text-sm text-neutral-600 dark:text-neutral-400 pl-8">
                          {item.description}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-12 text-center text-neutral-400 dark:text-neutral-500 italic">
                        Chưa có lịch sử giao dịch điểm
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            <div className="mt-8 p-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-2xl border border-neutral-100 dark:border-neutral-800">
              <h4 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2 flex items-center gap-1.5">
                <svg className="w-4 h-4 text-amber-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                Chính sách tích điểm
              </h4>
              <ul className="text-xs text-neutral-500 dark:text-neutral-400 space-y-1.5 list-disc list-inside">
                <li>Tích lũy 1 điểm cho mỗi 100,000đ giá trị đơn hàng khi giao hàng thành công.</li>
                <li>Mỗi 1 điểm tương ứng với 1,000đ khi sử dụng để thanh toán đơn hàng.</li>
                <li>Điểm không có giá trị quy đổi thành tiền mặt.</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProfilePage;
