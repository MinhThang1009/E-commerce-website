import { useEffect } from 'react';
import { BrowserRouter as Router, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { clearCart } from '@/features/cart/cartSlice';
import { cartApi } from '@/services/cartApi';
import { HelmetProvider } from 'react-helmet-async';
import { RootState } from '@/store';
import AppRoutes from '@/routes/AppRoutes';
import Notifications from '@/components/common/Notifications';
import { ChatWidgetPortal } from '@/features/ai';
import SupportChat from '@/components/chat/SupportChat';
import { useTokenRefresh } from '@/hooks/useTokenRefresh';
import LoginSuccess from '@/components/auth/LoginSuccess';
import AuthProvider from '@/components/auth/AuthProvider';
import StripeProvider from '@/contexts/StripeContext';
import { useAntdToast } from '@/hooks/useAntdToast';
import { setNavigateFunction } from '@/utils/authUtils';
// Import i18n configuration
import '@/config/i18n';
import '@/styles/index.scss';

// Inner component that has access to useNavigate
const AppContent: React.FC = () => {
  const theme = useSelector((state: RootState) => state.ui.theme);
  const { contextHolder } = useAntdToast();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const location = useLocation();

  // Global payment success listener
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const hasSuccess = params.get('payment') === 'success' ||
      (params.get('status') === 'momo-return' && params.get('resultCode') === '0');

    if (hasSuccess) {
      console.log('[DEBUG] Global payment success detected, clearing cart state and storage.');
      // Remove from storage first
      localStorage.removeItem('cartItems');
      // Dispatch clear action
      dispatch(clearCart());
      // Force API re-fetch for Header count
      dispatch(cartApi.util.invalidateTags(['Cart', 'CartCount']));
    }
  }, [location.search, dispatch]);

  // Initialize token refresh logic
  useTokenRefresh();

  // Setup navigation function for auth utils
  useEffect(() => {
    setNavigateFunction(() => navigate('/login'));
  }, [navigate]);

  // Apply theme class to document
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
        <StripeProvider>
          {contextHolder}
          <Notifications />
          <LoginSuccess />
          <AppRoutes />
          <ChatWidgetPortal />
          {<SupportChat />}
        </StripeProvider>
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
