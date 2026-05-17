/**
 * @file ProtectedRoute.tsx
 * @layer Component
 * @feature auth
 * @description UI component cho feature auth
 */
import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '@/stores/authStore';
import { ROUTES } from '@/routes/paths';

interface ProtectedRouteProps {
  children: React.ReactNode;
  requiredRoles?: string[];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  requiredRoles = [],
}) => {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const location = useLocation();

  if (!isAuthenticated) {
    // Chuyển hướng đến trang đăng nhập kèm URL trả về
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  // Kiểm tra quyền truy cập theo vai trò nếu cần
  if (requiredRoles.length > 0 && user) {
    const hasRequiredRole = requiredRoles.includes(user.role);
    if (!hasRequiredRole) {
      return <Navigate to={ROUTES.UNAUTHORIZED} replace />;
    }
  }

  return <>{children}</>;
};

export default ProtectedRoute;

