/**
 * @file useAuth.ts
 * @layer Hook
 * @feature auth
 * @description Custom React hook cho feature auth
 */
import { useAuthStore } from '@/stores/auth-store';
import { useCartStore } from '@/stores/cart-store';
import { useWishlistStore } from '@/stores/wishlist-store';
import { useLogoutMutation } from '../api/auth-api';
import { queryClient } from '@/lib/query-client';

/**
 * Custom hook để quản lý authentication
 */
export const useAuth = () => {
  const { mutateAsync: logoutMutation } = useLogoutMutation();

  // Lấy auth state từ Zustand
  const authState = useAuthStore();

  const logout = async () => {
    try {
      await logoutMutation();

      useAuthStore.getState().logout();
      useWishlistStore.getState().clearWishlistLocal();
      useCartStore.getState().initializeCart();
      queryClient.clear();

      localStorage.removeItem('wishlist');
      localStorage.removeItem('recentSearches');
      localStorage.removeItem('cartItems');
    } catch (error) {
      useAuthStore.getState().logout();
    }
  };

  const hasRole = (role: string): boolean => {
    return authState.user?.role === role;
  };

  const isAdmin = (): boolean => {
    const result = hasRole('admin');
    return result;
  };

  const getUserFullName = (): string => {
    if (authState.user?.firstName && authState.user?.lastName) {
      return `${authState.user.firstName} ${authState.user.lastName}`;
    }
    return authState.user?.name || authState.user?.email || 'User';
  };

  return {
    ...authState,

    logout,
    hasRole,
    isAdmin,
    getUserFullName,

    isLoggedIn: authState.isAuthenticated && !!authState.user,
    hasToken: !!authState.token,
    needsUserInfo: authState.isAuthenticated && !authState.user,
  };
};

export default useAuth;
