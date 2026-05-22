import { useEffect } from 'react';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { BrowserRouter as Router, useNavigate, useLocation } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { useCartStore } from '@/stores/cart-store';
import { cartKeys } from '@/features/cart';
import { HelmetProvider } from 'react-helmet-async';
import AppRoutes from '@/routes/AppRoutes';
import Notifications from '@/components/common/Notifications';
import { ChatWidgetPortal, ChatbotErrorBoundary } from '@/features/ai';
import { useTokenRefresh } from '@/hooks/use-token-refresh';
import { LoginSuccess, AuthProvider } from '@/features/auth';
import { useAntdToast } from '@/hooks/use-antd-toast';
import { setNavigateFunction } from '@/utils/auth-utils';
import { useUiStore } from '@/stores/ui-store';
// Khởi tạo cấu hình i18n
import '@/config/i18n';
import '@/styles/index.scss';

// Component con có quyền truy cập useNavigate (phải nằm trong Router)
const AppContent: React.FC = () => {
  const theme = useUiStore((s) => s.theme);
  const { contextHolder } = useAntdToast();
  const clearLocalCart = useCartStore((s) => s.clearLocalCart);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const location = useLocation();

  // Lắng nghe trạng thái thanh toán thành công ở cấp global
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hasSuccess =
      params.get('payment') === 'success' ||
      (params.get('status') === 'momo-return' && params.get('resultCode') === '0');

    if (hasSuccess) {
      // Xóa giỏ hàng khỏi storage và Zustand state sau khi thanh toán thành công
      localStorage.removeItem('cartItems');
      clearLocalCart();
      queryClient.invalidateQueries({ queryKey: cartKeys.all });
      queryClient.invalidateQueries({ queryKey: cartKeys.count });
    }
  }, [location.search, clearLocalCart, queryClient]);

  // Khởi tạo logic tự động làm mới token
  useTokenRefresh();

  // Gán hàm navigate cho authUtils để dùng khi logout
  useEffect(() => {
    setNavigateFunction(() => navigate('/login'));
  }, [navigate]);

  // Áp dụng class theme vào document
  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);

  return (
    <HelmetProvider>
      <AuthProvider>
        {contextHolder}
        <Notifications />
        <LoginSuccess />
        <AppRoutes />
        <ChatbotErrorBoundary>
          <ChatWidgetPortal />
        </ChatbotErrorBoundary>
      </AuthProvider>
    </HelmetProvider>
  );
};

const App: React.FC = () => {
  return (
    <ConfigProvider locale={viVN}>
      <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AppContent />
      </Router>
    </ConfigProvider>
  );
};

export default App;
