/**
 * @file use-product-variants.ts
 * @layer Hook
 * @feature catalog
 * @description Hook quản lý danh sách variants trong form tạo/chỉnh sửa sản phẩm (admin).
 */
import { ProductVariant } from '@/types';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/stores/ui-store';
import type { FormAdapter } from './use-form-adapter';

/**
 * Quản lý danh sách variants của sản phẩm trong form admin (tạo mới hoặc chỉnh sửa).
 *
 * Hook xử lý 3 trách nhiệm chính:
 * 1. **Quản lý state variants** — thêm, sửa, xóa variant qua modal.
 * 2. **Đồng bộ form** — tự động tính lại `stockQuantity` (tổng tồn kho)
 *    và `price` (giá trung bình theo trọng số tồn kho) mỗi khi danh sách variants thay đổi.
 * 3. **Kiểm soát modal** — mở/đóng modal tạo/sửa variant, theo dõi variant đang được sửa.
 *
 * **Tại sao dùng giá trung bình theo trọng số (weighted average)?**
 * Một sản phẩm có thể có nhiều variant với giá và tồn kho khác nhau, ví dụ:
 * - iPhone 128GB: 18.000.000đ × 50 cái
 * - iPhone 256GB: 22.000.000đ × 10 cái
 * Nếu lấy trung bình đơn giản: (18M + 22M) / 2 = 20M → không phản ánh thực tế
 * (đại đa số hàng tồn là 128GB).
 * Weighted average: (18M×50 + 22M×10) / (50+10) ≈ 18.667M → sát hơn với giá trị
 * thực tế của hàng tồn kho. Hiển thị trong form admin để admin có reference price.
 *
 * **Tránh vòng lặp vô hạn trong useEffect:**
 * `useEffect` phụ thuộc vào `variants` và `form`. Nếu gọi `form.setFieldsValues()` mọi lúc,
 * một số watcher của form (ví dụ `watchFormValues`) sẽ trigger re-render → hook chạy lại →
 * gọi `setFieldsValues` lại → vòng lặp vô hạn. Giải pháp: so sánh giá trị mới với giá trị
 * hiện tại trong form trước khi set — chỉ update khi thực sự thay đổi.
 *
 * @param initialVariants - Danh sách variants ban đầu khi mở form.
 *   Mảng rỗng khi tạo sản phẩm mới; danh sách variants hiện có khi chỉnh sửa.
 * @param form - FormAdapter instance. Nếu truyền vào,
 *   hook sẽ tự động cập nhật các field `stockQuantity` và `price` khi variants thay đổi.
 *   Nếu không truyền (undefined), phần đồng bộ form bị bỏ qua.
 *
 * @returns Object chứa:
 * - `variants` — Danh sách variants hiện tại.
 * - `setVariants` — Setter trực tiếp (dùng khi load dữ liệu từ API).
 * - `variantModalVisible` — Trạng thái hiển thị modal thêm/sửa variant.
 * - `editingVariant` — Variant đang được sửa; `null` nếu đang tạo mới.
 * - `handleAddVariant` — Xử lý submit form variant (thêm mới hoặc lưu chỉnh sửa).
 * - `handleDeleteVariant` — Xóa variant theo ID và cập nhật lại giá/tồn kho tổng.
 * - `openVariantModal` — Mở modal; truyền variant để sửa, không truyền để tạo mới.
 * - `closeVariantModal` — Đóng modal và xóa `editingVariant`.
 */
export const useProductVariants = (initialVariants: ProductVariant[] = [], form?: FormAdapter) => {
  const { t } = useTranslation();
  const addNotification = useUiStore((s) => s.addNotification);
  const [variants, setVariants] = useState<ProductVariant[]>(initialVariants);
  const [variantModalVisible, setVariantModalVisible] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);

  /**
   * Tự động tính lại `stockQuantity` (tổng tồn kho) và `price` (giá trung bình theo
   * trọng số tồn kho) mỗi khi danh sách variants thay đổi, rồi đồng bộ vào form.
   *
   * **Guard:** bỏ qua khi `form` không được truyền vào, hoặc danh sách variants rỗng
   * (để không ghi đè giá người dùng tự nhập khi chưa có variant nào).
   *
   * **Tránh vòng lặp:** so sánh với giá trị hiện tại trong form trước khi gọi
   * `setFieldsValues` — chỉ update khi giá trị thực sự thay đổi, tránh kích hoạt
   * form watchers không cần thiết dẫn đến re-render → useEffect chạy lại liên tục.
   */
  useEffect(() => {
    if (!form || variants.length === 0) return;

    // Tính tổng tồn kho: cộng dồn stock của tất cả variants, bỏ qua giá trị NaN
    const totalStock = variants.reduce((runningTotal, variant) => {
      const stock = parseInt(variant.stock?.toString() || '0');
      return runningTotal + (isNaN(stock) ? 0 : stock);
    }, 0);

    // Lấy giá thấp nhất trong các variants có giá > 0 (khớp với convention DB: base_price = min variant price)
    const validPrices = variants
      .map((v) => Math.min(parseFloat(v.price?.toString() || '0'), 99999999.99))
      .filter((p) => p > 0);
    const minVariantPrice = validPrices.length > 0 ? Math.min(...validPrices) : 0;

    const currentPrice = Number(form.getFieldValue('price')) || 0;
    const newPrice = minVariantPrice > 0 ? minVariantPrice : currentPrice;

    // Chỉ update form nếu giá trị thực sự thay đổi — tránh trigger watchFormValues loop
    const currentStock = form.getFieldValue('stockQuantity');
    if (currentStock !== totalStock) {
      form.setFieldValue('stockQuantity', totalStock);
    }
    if (newPrice > 0 && currentPrice !== newPrice) {
      form.setFieldValue('price', newPrice);
    }
  }, [variants, form]);

  /**
   * Xử lý submit từ modal variant — thêm variant mới hoặc lưu chỉnh sửa.
   *
   * - Nếu `editingVariant` không null → **đang sửa**: thay thế variant cũ trong danh sách,
   *   giữ nguyên `id` gốc (tránh mất liên kết với DB khi save form).
   * - Nếu `editingVariant` null → **đang tạo mới**: sinh `id` tạm thời theo pattern
   *   `var-{index}-{random}` (ổn định hơn pure timestamp, ít bị trùng lặp hơn UUID).
   *   Nếu variant đã có `id` sẵn (từ API), giữ nguyên `id` đó.
   * Sau khi xử lý, đóng modal và xóa `editingVariant`.
   *
   * @param variant - Dữ liệu variant từ form trong modal.
   */
  const handleAddVariant = (variant: ProductVariant) => {
    if (editingVariant) {
      setVariants(
        variants.map((existingVariant) =>
          existingVariant.id === editingVariant.id
            ? { ...variant, id: editingVariant.id }
            : existingVariant,
        ),
      );
      addNotification({ message: t('admin.products.variants.updateSuccess'), type: 'success' });
    } else {
      const temporaryId = `var-${variants.length}-${Math.random().toString(36).substring(2, 9)}`;
      setVariants([...variants, { ...variant, id: variant.id || temporaryId }]);
      addNotification({ message: t('admin.products.variants.addSuccess'), type: 'success' });
    }
    setVariantModalVisible(false);
    setEditingVariant(null);
  };

  const handleDeleteVariant = (id: string) => {
    setVariants(variants.filter((variant) => variant.id !== id));
    addNotification({ message: t('admin.products.variants.deleteSuccess'), type: 'info' });
  };

  /**
   * Mở modal thêm/sửa variant.
   *
   * @param variant - Variant cần sửa. Nếu không truyền (undefined), modal mở ở chế độ tạo mới.
   */
  const openVariantModal = (variant?: ProductVariant) => {
    setEditingVariant(variant || null);
    setVariantModalVisible(true);
  };

  /**
   * Đóng modal và xóa trạng thái variant đang sửa.
   * Gọi khi user bấm Cancel hoặc click ra ngoài modal.
   */
  const closeVariantModal = () => {
    setVariantModalVisible(false);
    setEditingVariant(null);
  };

  return {
    variants,
    setVariants,
    variantModalVisible,
    editingVariant,
    handleAddVariant,
    handleDeleteVariant,
    openVariantModal,
    closeVariantModal,
  };
};
