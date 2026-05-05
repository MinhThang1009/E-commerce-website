import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store';
import { logout as logoutAction } from '../store/authSlice';
import { useLogoutMutation } from '../api/authApi';
import { clearWishlistLocal } from '@/features/wishlist';
import { initializeCart } from '@/features/cart';
import { api } from '@/services/api';

/**
 * Custom hook để quản lý authentication
 *
 * Cung cấp:
 * - Thông tin authentication state
 * - Helper functions
 * - Easy access cho components
 */
export const useAuth = () => {
  const dispatch = useDispatch();
  const [logoutMutation] = useLogoutMutation();

  // Lấy auth state từ Redux
  const authState = useSelector((state: RootState) => state.auth);

  /**
   * Logout function với error handling
   */
  const logout = async () => {
    try {
      // Gọi API logout (optional, có thể skip nếu server không cần)
      await logoutMutation().unwrap();

      // Xóa Redux state
      dispatch(logoutAction());
      dispatch(clearWishlistLocal()); // Xóa danh sách yêu thích khỏi Redux
      dispatch(initializeCart());     // Reset giỏ hàng về trạng thái ban đầu
      dispatch(api.util.resetApiState()); // Reset toàn bộ cache của RTK Query

      // Xóa các dữ liệu khác khỏi localStorage nếu cần
      localStorage.removeItem('wishlist');
      localStorage.removeItem('recentSearches');
      localStorage.removeItem('cartItems');
    } catch (error) {
      // Vẫn logout dù API call thất bại
      dispatch(logoutAction());
    }
  };

  /**
   * Kiểm tra user có role cụ thể không
   */
  const hasRole = (role: string): boolean => {
    return authState.user?.role === role;
  };

  /**
   * Kiểm tra user có phải admin không
   */
  const isAdmin = (): boolean => {
    const result = hasRole('admin');
    return result;
  };

  /**
   * Kiểm tra user có phải manager không
   */
  const isManager = (): boolean => {
    return hasRole('manager');
  };

  /**
   * Lấy full name của user
   */
  const getUserFullName = (): string => {
    if (authState.user?.firstName && authState.user?.lastName) {
      return `${authState.user.firstName} ${authState.user.lastName}`;
    }
    return authState.user?.name || authState.user?.email || 'User';
  };

  return {
    // Trạng thái xác thực
    ...authState,

    // Các hàm hỗ trợ
    logout,
    hasRole,
    isAdmin,
    isManager,
    getUserFullName,

    // Giá trị tính toán
    isLoggedIn: authState.isAuthenticated && !!authState.user,
    hasToken: !!authState.token,
    needsUserInfo: authState.isAuthenticated && !authState.user,
  };
};

export default useAuth;

