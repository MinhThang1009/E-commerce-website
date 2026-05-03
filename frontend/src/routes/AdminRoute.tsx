import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';
import { RootState } from '@/store';
import { useGetCurrentUserQuery } from '@/services/authApi';
import LoadingSpinner from '@/components/common/LoadingSpinner';

interface AdminRouteProps {
  children: ReactNode;
}

const AdminRoute: React.FC<AdminRouteProps> = ({ children }) => {
  const { t } = useTranslation();
  const { isAuthenticated, user, token } = useSelector(
    (state: RootState) => state.auth
  );
  const location = useLocation();

  // Nếu không có token, chuyển hướng đến trang đăng nhập
  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Nếu có token nhưng chưa có thông tin user, tải thông tin user
  const shouldFetchUser = token && !user;
  const {
    data: currentUser,
    isLoading,
    error,
  } = useGetCurrentUserQuery(undefined, {
    skip: !shouldFetchUser,
  });

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
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Dùng currentUser từ API nếu có, ngược lại dùng user từ state
  const userToCheck = currentUser || user;

  if (!isAuthenticated && !currentUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Kiểm tra xem user có phải admin hoặc manager không
  if (userToCheck?.role !== 'admin' && userToCheck?.role !== 'manager') {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
};

export default AdminRoute;

