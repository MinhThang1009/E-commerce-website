/**
 * @file useCartSync.ts
 * @layer Hook
 * @feature cart
 * @description Custom React hook cho feature cart
 */
import { useEffect } from 'react';
import { useCartStore } from '@/stores/cart-store';
import { useAuthStore } from '@/stores/auth-store';
import { useAuth } from '@/features/auth';
import { useGetCartQuery, useSyncCartMutation } from '@/features/cart';

/**
 * Hook đồng bộ dữ liệu giỏ hàng giữa local storage và server
 * Xử lý việc đồng bộ khi người dùng đăng nhập/đăng xuất
 */
export const useCartSync = () => {
  const { isAuthenticated } = useAuth();
  const localCartItems = useCartStore((s) => s.items);
  const setServerCart = useCartStore((s) => s.setServerCart);
  const justLoggedIn = useAuthStore((s) => s.justLoggedIn);

  // Lấy server cart cho người dùng đã xác thực
  const {
    data: serverCart,
    isLoading: isLoadingCart,
    error: cartError,
  } = useGetCartQuery({
    enabled: isAuthenticated,
  });

  // Mutation đồng bộ giỏ hàng
  const { mutateAsync: syncCart, isPending: isSyncing } = useSyncCartMutation();

  // Đồng bộ giỏ hàng cục bộ lên server khi người dùng đăng nhập
  useEffect(() => {
    const syncLocalCartToServer = async () => {
      // Bỏ qua nếu justLoggedIn — useCartMerge sẽ xử lý merge khi login
      if (isAuthenticated && localCartItems.length > 0 && !justLoggedIn) {
        try {
          // Chuyển đổi cart item cục bộ sang định dạng server
          const itemsToSync = localCartItems.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            quantity: item.quantity,
            name: item.name,
            price: item.price,
            image: item.image,
            attributes: item.attributes,
          }));

          // Đồng bộ lên server
          const syncedCart = await syncCart({ items: itemsToSync });

          // Cập nhật Zustand store với response từ server
          setServerCart(syncedCart);
        } catch (error) {
          console.error('Không thể đồng bộ giỏ hàng lên server:', error);
        }
      }
    };

    syncLocalCartToServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Không bao gồm localCartItems để tránh vòng lặp vô hạn khi sync thay đổi cart
  }, [isAuthenticated, justLoggedIn, syncCart, setServerCart]);

  // Cập nhật Zustand store khi server cart thay đổi
  // Không overwrite local cart bằng empty server cart khi đang sync
  // (tránh race condition: server trả [] trước khi sync local → server hoàn thành)
  useEffect(() => {
    if (!isAuthenticated || !serverCart || isSyncing) return;
    const hasLocalItems = localCartItems.length > 0;
    const hasServerItems = (serverCart.items?.length ?? 0) > 0;
    // Chỉ overwrite nếu server có items, hoặc cả 2 đều rỗng
    if (hasServerItems || !hasLocalItems) {
      setServerCart(serverCart);
    }
  }, [serverCart, isAuthenticated, isSyncing, localCartItems.length, setServerCart]);

  // Xóa giỏ hàng khi người dùng đăng xuất
  useEffect(() => {
    if (!isAuthenticated) {
      // Chỉ xóa dữ liệu server cart, giữ giỏ hàng cục bộ cho khách
      setServerCart({
        id: null,
        items: [],
        totalItems: 0,
        subtotal: 0,
      });
    }
  }, [isAuthenticated, setServerCart]);

  return {
    isLoadingCart,
    isSyncing,
    cartError,
    serverCart,
  };
};

export default useCartSync;
