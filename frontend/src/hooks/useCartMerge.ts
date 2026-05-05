import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import {
  useMergeCartMutation,
  useAddToCartMutation,
  useGetCartQuery,
} from '@/features/cart';
import { setServerCart } from '@/features/cart';
import { addNotification } from '@/features/ui/uiSlice';
import { clearJustLoggedIn } from '@/features/auth';
import { RootState } from '@/store';

export const useCartMerge = (
  isAuthenticated: boolean,
  justLoggedIn: boolean
) => {
  const { t } = useTranslation();
  const dispatch = useDispatch();
  const [mergeCart] = useMergeCartMutation();
  const [addToCart] = useAddToCartMutation();

  // Lấy cart items từ Redux store
  const { items } = useSelector((state: RootState) => state.cart);

  // Lấy server cart hiện tại - không bỏ qua khi đã xác thực và vừa đăng nhập
  const { data: serverCart, refetch } = useGetCartQuery(undefined, {
    skip: !isAuthenticated,
    refetchOnMountOrArgChange: true,
  });

  useEffect(() => {
    const performCartMerge = async () => {
      if (isAuthenticated && justLoggedIn) {
        try {

          // Kiểm tra xem có item nào trong localStorage không
          const localItems = JSON.parse(
            localStorage.getItem('cartItems') || '[]'
          );

          if (localItems.length > 0) {

            // Trước tiên, lấy server cart hiện tại
            await refetch();

            // Thêm từng item cục bộ vào server cart

            // Theo dõi số item đã thêm để hiển thị thông báo
            let addedItemsCount = 0;

            // Thêm từng item một để giữ nguyên cart hiện có
            for (const item of localItems) {
              try {
                await addToCart({
                  productId: item.productId,
                  variantId: item.variantId,
                  quantity: item.quantity,
                }).unwrap();

                addedItemsCount += item.quantity;
              } catch (itemError) {
                console.error(
                  `❌ Không thể thêm sản phẩm ${item.name} vào giỏ hàng:`,
                  itemError
                );
              }
            }

            // Lấy cart cuối cùng sau khi đã cập nhật
            try {
              const result = await refetch();
              if (result && result.data) {
                // Cập nhật Redux store với cart mới nhất
                dispatch(setServerCart(result.data));
              } else if (serverCart) {
                // Dự phòng dùng serverCart hiện tại nếu refetch không trả dữ liệu mới
                dispatch(setServerCart(serverCart));
              }
            } catch (refetchError) {
              console.error('❌ Không thể refetch giỏ hàng:', refetchError);
              // Vẫn thử dùng serverCart hiện tại nếu có
              if (serverCart) {
                dispatch(setServerCart(serverCart));
              }
            }

            // Hiển thị thông báo về các item đã gộp
            if (addedItemsCount > 0) {
              dispatch(
                addNotification({
                  message: t('cart.itemsAdded', { count: addedItemsCount }),
                  type: 'success',
                  duration: 3000,
                })
              );
            }
          } else {
            // Không có item cục bộ, chỉ gộp session cart trên server
            const mergedCart = await mergeCart().unwrap();

            // Cập nhật Redux store với cart đã gộp
            dispatch(setServerCart(mergedCart));


            // Hiển thị thông báo nếu có item được gộp
            if (mergedCart.totalItems > 0) {
              dispatch(
                addNotification({
                  message: t('cart.itemsMerged', { count: mergedCart.totalItems }),
                  type: 'success',
                  duration: 3000,
                })
              );
            }
          }

          // Xóa localStorage để tránh item trùng lặp
          localStorage.removeItem('cartItems');

          // Reset cờ justLoggedIn để tránh gộp lại khi reload
          dispatch(clearJustLoggedIn());
        } catch (error: any) {
          console.error('❌ Gộp giỏ hàng thất bại:', error);

          // Reset justLoggedIn ngay cả khi gộp thất bại để tránh vòng lặp retry
          dispatch(clearJustLoggedIn());

          // Hiển thị lỗi cho người dùng
          dispatch(
            addNotification({
              message: t('cart.mergeFailed'),
              type: 'error',
              duration: 3000,
            })
          );
        }
      }
    };

    performCartMerge();
  }, [
    isAuthenticated,
    justLoggedIn,
    mergeCart,
    addToCart,
    refetch,
    dispatch,
    // items,
  ]);
};

