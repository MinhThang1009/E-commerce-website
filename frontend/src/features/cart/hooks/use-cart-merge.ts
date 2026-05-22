/**
 * @file use-cart-merge.ts
 * @layer Hook
 * @feature cart
 * @description Hook tự động gộp giỏ hàng guest vào giỏ hàng server sau khi user đăng nhập.
 */
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '@/stores/cart-store';
import { useAuthStore } from '@/stores/auth-store';
import { useMergeCartMutation, useAddToCartMutation, useGetCartQuery } from '@/features/cart';
import { useUiStore } from '@/stores/ui-store';

/**
 * Tự động gộp giỏ hàng guest (localStorage) vào giỏ hàng server ngay sau khi user đăng nhập.
 *
 * **Flow hoạt động:**
 * 1. Hook lắng nghe cặp flag `(isAuthenticated, justLoggedIn)`.
 * 2. Khi cả hai đều `true`, hook kiểm tra `localStorage.cartItems`.
 * 3. Nếu có item local → gọi `addToCart` **tuần tự** từng item một lên server,
 *    rồi `refetch` để lấy giỏ hàng cập nhật mới nhất.
 * 4. Nếu không có item local → gọi `mergeCart` một lần để server tự gộp
 *    guest session cart với tài khoản.
 * 5. Sau khi xử lý xong (dù thành công hay thất bại), gọi `clearJustLoggedIn()`
 *    để reset flag — tránh hook chạy lại vô tận mỗi khi component re-render.
 *
 * **Partial success:** nếu 1 item không thể thêm (hết hàng, lỗi mạng...), hook bỏ qua item đó
 * và tiếp tục xử lý các item còn lại — không throw lỗi toàn bộ, vì mất 1 item
 * vẫn tốt hơn mất toàn bộ giỏ hàng.
 *
 * **Race condition — fallback `serverCart`:** sau khi gọi xong tất cả `addToCart`,
 * hook gọi `refetch()` để cập nhật Zustand store. Nếu `refetch` trả về `undefined`
 * (do cache chưa cập nhật hoặc mạng chậm), hook dùng `serverCart` hiện tại làm
 * fallback — tránh cập nhật store bằng dữ liệu rỗng, gây mất hiển thị giỏ hàng.
 *
 * @param isAuthenticated - `true` khi user đã đăng nhập (lấy từ `authStore`).
 *   Dùng để enable `useGetCartQuery` — khi `false`, query bị tắt, tránh gọi API lúc guest.
 * @param justLoggedIn - Flag bật lên ngay sau khi user vừa đăng nhập thành công.
 *   Phân biệt lần đầu login với các lần re-render thông thường khi đã logged in.
 *   **Bắt buộc phải reset** (qua `clearJustLoggedIn`) sau khi gộp xong — nếu không,
 *   mỗi lần component re-render đều kích hoạt merge lại.
 * @returns void — Hook không trả về giá trị. Tác dụng phụ là cập nhật server cart
 *   và hiển thị notification.
 */
export const useCartMerge = (isAuthenticated: boolean, justLoggedIn: boolean) => {
  const { t } = useTranslation();
  const addNotification = useUiStore((s) => s.addNotification);
  const setServerCart = useCartStore((s) => s.setServerCart);
  const { mutateAsync: mergeCart } = useMergeCartMutation();
  const { mutateAsync: addToCart } = useAddToCartMutation();

  // Lấy server cart hiện tại — chỉ enable khi đã xác thực để tránh request 401 lúc guest
  const { data: serverCart, refetch } = useGetCartQuery({
    enabled: isAuthenticated,
  });

  useEffect(() => {
    /**
     * Thực hiện toàn bộ logic gộp giỏ hàng bất đồng bộ.
     * Khai báo async riêng để dùng await bên trong useEffect (useEffect callback không thể async trực tiếp).
     */
    const performCartMerge = async () => {
      // Chỉ chạy ngay sau khi vừa đăng nhập — tránh chạy lại ở mọi re-render
      if (isAuthenticated && justLoggedIn) {
        try {
          // Đọc giỏ hàng đã lưu trong localStorage lúc còn là guest
          const localItems = JSON.parse(localStorage.getItem('cartItems') || '[]');

          if (localItems.length > 0) {
            // ── Chiến lược 1: Có item local → add từng item lên server ──
            // Lý do dùng addToCart thay vì syncCart: syncCart ghi đè toàn bộ server cart,
            // còn addToCart cộng dồn vào cart hiện có — giữ nguyên các item đã có trên server.

            // Đồng bộ server cart trước để Zustand store có dữ liệu mới nhất làm base
            await refetch();

            // Đếm tổng số lượng đã thêm để hiển thị thông báo chính xác
            let totalQuantityAdded = 0;

            // Thêm tuần tự từng item — song song có thể gây race condition trên server
            for (const item of localItems) {
              try {
                await addToCart({
                  productId: item.productId,
                  variantId: item.variantId,
                  quantity: item.quantity,
                });

                totalQuantityAdded += item.quantity;
              } catch (itemError) {
                // Partial success: bỏ qua item lỗi, tiếp tục item tiếp theo
                // Lý do: mất 1 item vẫn tốt hơn mất toàn bộ giỏ hàng
                console.error(`Không thể thêm sản phẩm ${item.name} vào giỏ hàng:`, itemError);
              }
            }

            // Lấy trạng thái giỏ hàng cuối cùng sau khi đã add xong tất cả item
            try {
              const refetchResult = await refetch();
              if (refetchResult && refetchResult.data) {
                // Cập nhật Zustand store với dữ liệu mới nhất từ server
                setServerCart(refetchResult.data);
              } else if (serverCart) {
                // Fallback: refetch trả undefined (cache chưa ready hoặc mạng chậm)
                // → dùng serverCart hiện tại, tránh cập nhật store bằng dữ liệu rỗng
                setServerCart(serverCart);
              }
            } catch (refetchError) {
              console.error('Không thể refetch giỏ hàng:', refetchError);
              // Vẫn thử dùng serverCart hiện tại nếu có để không mất dữ liệu hiển thị
              if (serverCart) {
                setServerCart(serverCart);
              }
            }

            // Thông báo tổng kết cho user biết có bao nhiêu sản phẩm đã được gộp
            if (totalQuantityAdded > 0) {
              addNotification({
                message: t('cart.itemsAdded', { count: totalQuantityAdded }),
                type: 'success',
                duration: 3000,
              });
            }
          } else {
            // ── Chiến lược 2: Không có item local → merge server-side một lần ──
            // Server sẽ tự gộp guest session cart (cookie-based) với tài khoản,
            // xử lý deduplication và conflict — đơn giản hơn nhiều so với chiến lược 1.
            const mergedCart = await mergeCart();

            // Cập nhật Zustand store với giỏ hàng đã gộp
            setServerCart(mergedCart);

            // Chỉ thông báo khi thực sự có item trong giỏ (tránh thông báo "0 sản phẩm")
            if (mergedCart.totalItems > 0) {
              addNotification({
                message: t('cart.itemsMerged', { count: mergedCart.totalItems }),
                type: 'success',
                duration: 3000,
              });
            }
          }

          // Xóa local cart sau khi đã gộp thành công — tránh item bị add lại ở lần login sau
          localStorage.removeItem('cartItems');

          // QUAN TRỌNG: Reset flag để hook không chạy lại ở các re-render tiếp theo
          useAuthStore.getState().clearJustLoggedIn();
        } catch (error) {
          console.error('Gộp giỏ hàng thất bại:', error);

          // Reset flag ngay cả khi thất bại — tránh retry loop vô tận
          // Nếu không reset, mỗi re-render đều kích hoạt merge lại cho đến khi thành công
          useAuthStore.getState().clearJustLoggedIn();

          // Thông báo lỗi để user biết giỏ hàng chưa được gộp
          addNotification({
            message: t('cart.mergeFailed'),
            type: 'error',
            duration: 3000,
          });
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
    setServerCart,
    addNotification,
    serverCart,
    t,
  ]);
};
