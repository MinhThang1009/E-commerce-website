/**
 * @file AdminRoute.tsx
 * @layer Component
 * @feature auth
 * @description UI component cho feature auth
 */
import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '@/stores/auth-store';
import { ROUTES } from '@/routes/paths';
import { useGetCurrentUserQuery } from '@features/auth/api/auth-api';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface AdminRouteProps {
  children: ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { t } = useTranslation();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const location = useLocation();

  // Nếu có token nhưng chưa có thông tin user, cần gọi API lấy user — phải khai báo hook trước early return
  const shouldFetchUser = token && !user;
  const {
    data: currentUser,
    isLoading,
    error,
  } = useGetCurrentUserQuery({
    enabled: !!shouldFetchUser,
  });

  // Nếu không có token, chuyển hướng đến trang đăng nhập
  if (!token) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  // Hiển thị loading khi đang tải thông tin user
  if (shouldFetchUser && isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-900">
        <div className="text-center">
          <LoadingSpinner size="large" />
          <p className="mt-4 text-neutral-600 dark:text-neutral-400">
            {t('admin.verifyingAccess')}
          </p>
        </div>
      </div>
    );
  }

  // Nếu tải thất bại, chuyển hướng đến trang đăng nhập
  if (error) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  // Dùng currentUser từ API nếu có, ngược lại dùng user từ state
  const userToCheck = currentUser || user;

  if (!isAuthenticated && !currentUser) {
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  // Kiểm tra xem user có phải admin hoặc manager không
  if (userToCheck?.role !== 'admin' && userToCheck?.role !== 'manager') {
    return <Navigate to={ROUTES.UNAUTHORIZED} replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;
