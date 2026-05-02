import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import { RootState } from '@/store';
import { useGetCurrentUserQuery } from '@/services/authApi';
import { loginSuccess, logout } from '@/features/auth/authSlice';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface AuthProviderProps {
  children: React.ReactNode;
}

/**
 * AuthProvider Component
 *
 * Nhiệm vụ:
 * 1. Kiểm tra token trong localStorage khi app khởi động
 * 2. Nếu có token, gọi API để lấy thông tin user hiện tại
 * 3. Cập nhật Redux state với thông tin user
 * 4. Xử lý trường hợp token không hợp lệ
 */
const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const { token, isAuthenticated, user } = useSelector(
    (state: RootState) => state.auth
  );

  // Chỉ gọi API khi có token nhưng chưa có user info
  const shouldFetchUser = token && !user && isAuthenticated;

  const {
    data: currentUser,
    error,
    isLoading,
    isSuccess,
    isError,
  } = useGetCurrentUserQuery(undefined, {
    // Chỉ gọi API khi cần thiết
    skip: !shouldFetchUser,
    // Refetch khi component mount lại
    refetchOnMountOrArgChange: true,
  });

  useEffect(() => {
    // Nếu API trả về user successfully, cập nhật Redux state
    if (isSuccess && currentUser && token) {
      console.log('✅ Lấy thông tin người dùng thành công:', currentUser);
      console.log('👤 Quyền người dùng:', currentUser.role);
      console.log('🔐 Token:', token);

      dispatch(
        loginSuccess({
          user: currentUser,
          token: token,
          refreshToken: localStorage.getItem('refreshToken') || '',
        })
      );

      console.log('📦 Đã dispatch loginSuccess với dữ liệu người dùng');
    }
  }, [isSuccess, currentUser, token, dispatch]);

  useEffect(() => {
    // Nếu API trả về lỗi (token không hợp lệ), logout user
    if (isError && error) {
      console.log('❌ Lấy thông tin người dùng thất bại:', error);
      console.log('🔐 Đăng xuất do token không hợp lệ...');

      // Xóa trạng thái xác thực
      dispatch(logout());
    }
  }, [isError, error, dispatch]);

  // Hiển thị loading khi đang fetch user info
  if (shouldFetchUser && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">
            {t('auth.loading')}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};

export default AuthProvider;
