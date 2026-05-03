import { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store';
import { useAuth } from './useAuth';
import { useGetCartQuery, useSyncCartMutation } from '@/services/cartApi';
import { setServerCart, clearCart } from '@/features/cart/cartSlice';

/**
 * Hook đồng bộ dữ liệu giỏ hàng giữa local storage và server
 * Xử lý việc đồng bộ khi người dùng đăng nhập/đăng xuất
 */
export const useCartSync = () => {
  const dispatch = useDispatch();
  const { isAuthenticated } = useAuth();
  const localCartItems = useSelector((state: RootState) => state.cart.items);
  const justLoggedIn = useSelector((state: RootState) => state.auth.justLoggedIn);

  // Lấy server cart cho người dùng đã xác thực
  const {
    data: serverCart,
    isLoading: isLoadingCart,
    error: cartError,
  } = useGetCartQuery(undefined, {
    skip: !isAuthenticated,
    // Tắt polling - cart sẽ cập nhật qua invalidatesTags khi có mutation
    // pollingInterval: 30000, // Tắt để tránh spam API
  });

  // Mutation đồng bộ giỏ hàng
  const [syncCart, { isLoading: isSyncing }] = useSyncCartMutation();

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
          const syncedCart = await syncCart({ items: itemsToSync }).unwrap();

          // Cập nhật Redux store với response từ server
          dispatch(setServerCart(syncedCart));

          console.log('✅ Đồng bộ giỏ hàng lên server thành công');
        } catch (error) {
          console.error('❌ Không thể đồng bộ giỏ hàng lên server:', error);
        }
      }
    };

    syncLocalCartToServer();
  }, [isAuthenticated, justLoggedIn, dispatch, syncCart]); // Không bao gồm localCartItems để tránh vòng lặp vô hạn

  // Cập nhật Redux store khi server cart thay đổi
  useEffect(() => {
    if (isAuthenticated && serverCart && !isSyncing) {
      dispatch(setServerCart(serverCart));
    }
  }, [serverCart, isAuthenticated, dispatch, isSyncing]);

  // Xóa giỏ hàng khi người dùng đăng xuất
  useEffect(() => {
    if (!isAuthenticated) {
      // Chỉ xóa dữ liệu server cart, giữ giỏ hàng cục bộ cho khách
      dispatch(
        setServerCart({
          id: null,
          items: [],
          totalItems: 0,
          subtotal: 0,
        })
      );
    }
  }, [isAuthenticated, dispatch]);

  return {
    isLoadingCart,
    isSyncing,
    cartError,
    serverCart,
  };
};

export default useCartSync;
