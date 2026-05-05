import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store';
import { refreshTokenIfNeeded, isTokenExpired } from '@/utils/tokenManager';
import { logout } from '@/features/auth';

export const useTokenRefresh = () => {
  const dispatch = useDispatch();
  const { token, refreshToken, isAuthenticated } = useSelector(
    (state: RootState) => state.auth
  );

  useEffect(() => {
    if (!isAuthenticated || !token || !refreshToken) {
      return;
    }

    // Kiểm tra tính hợp lệ của token mỗi 5 phút
    const checkTokenValidity = async () => {
      if (isTokenExpired(token)) {
        const newToken = await refreshTokenIfNeeded();

        if (!newToken) {
          dispatch(logout());
        }
      }
    };

    // Kiểm tra ngay lập tức
    checkTokenValidity();

    // Đặt interval kiểm tra mỗi 5 phút
    const interval = setInterval(checkTokenValidity, 5 * 60 * 1000);

    return () => clearInterval(interval);
  }, [token, refreshToken, isAuthenticated, dispatch]);

  // Cũng kiểm tra khi trang được hiển thị lại
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && isAuthenticated && token) {
        if (isTokenExpired(token)) {
          await refreshTokenIfNeeded();
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () =>
      document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [token, isAuthenticated]);
};

