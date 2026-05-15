import { useEffect } from 'react';
import { BrowserRouter as Router, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { clearCart } from '@/features/cart';
import { cartApi } from '@/features/cart';
import { HelmetProvider } from 'react-helmet-async';
import { RootState } from '@/store';
import AppRoutes from '@/routes/AppRoutes';
import Notifications from '@/components/common/Notifications';
import { ChatWidgetPortal } from '@/features/ai';
import ChatbotErrorBoundary from '@/features/ai/components/ChatbotErrorBoundary';
import { SupportChat } from '@/features/chat';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';
import { LoginSuccess, AuthProvider } from '@/features/auth';
import { useAntdToast } from '@/hooks/useAntdToast';
import { setNavigateFunction } from '@/utils/authUtils';
// Khởi tạo cấu hình i18n
import '@/config/i18n';
import '@/styles/index.scss';

// Component con có quyền truy cập useNavigate (phải nằm trong Router)
const AppContent: React.FC = () => {
  const theme = useSelector((state: RootState) => state.ui.theme);
  const { contextHolder } = useAntdToast();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const location = useLocation();

  // Lắng nghe trạng thái thanh toán thành công ở cấp global
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hasSuccess = params.get('payment') === 'success' ||
      (params.get('status') === 'momo-return' && params.get('resultCode') === '0');

    if (hasSuccess) {
      // Xóa giỏ hàng khỏi storage và Redux state sau khi thanh toán thành công
      localStorage.removeItem('cartItems');
      dispatch(clearCart());
      dispatch(cartApi.util.invalidateTags(['Cart', 'CartCount']));
    }
  }, [location.search, dispatch]);

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
          {<SupportChat />}
      </AuthProvider>
    </HelmetProvider>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AppContent />
    </Router>
  );
};

export default App;

