import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';

interface PublicOnlyRouteProps {
  children: React.ReactNode;
  redirectTo?: string;
}

const PublicOnlyRoute: React.FC<PublicOnlyRouteProps> = ({
  children,
  redirectTo = '/',
}) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  if (isAuthenticated) {
    // Chuyển hướng người dùng đã đăng nhập ra khỏi các trang xác thực
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
};

export default PublicOnlyRoute;

