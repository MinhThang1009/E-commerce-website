// Barrel export feature auth — public surface
// Sau Phase 42 (Modular Monolith), code ngoài feature import qua barrel này
// thay vì deep import từ subfolders để giảm coupling.

// Trang
export { default as LoginPage } from './pages/LoginPage';
export { default as RegisterPage } from './pages/RegisterPage';
export { default as ForgotPasswordPage } from './pages/ForgotPasswordPage';
export { default as ResetPasswordPage } from './pages/ResetPasswordPage';
export { default as VerifyEmailPage } from './pages/VerifyEmailPage';

// Component giao diện + route guard
export { default as AuthProvider } from './components/AuthProvider';
export { default as ProtectedRoute } from './components/ProtectedRoute';
export { default as PublicOnlyRoute } from './components/PublicOnlyRoute';
export { default as AdminRoute } from './components/AdminRoute';
export { default as GoogleLoginButton } from './components/GoogleLoginButton';
export { default as LoginSuccess } from './components/LoginSuccess';

// Hook
export { useAuth } from './hooks/useAuth';

// Zustand store
export { useAuthStore } from '@/stores/authStore';

// API endpoints (TanStack Query hooks)
export {
  useLoginMutation,
  useRegisterMutation,
  useRefreshTokenMutation,
  useLogoutMutation,
  useResetPasswordMutation,
  useResendVerificationMutation,
  useGetCurrentUserQuery,
  useVerifyOtpMutation,
  useForgotPasswordMutation,
  useGoogleLoginMutation,
} from './api/authApi';

// Kiểu dữ liệu
export type {
  AuthState,
  AuthResponse,
  LoginCredentials,
  RegisterData,
} from './types/auth.types';
