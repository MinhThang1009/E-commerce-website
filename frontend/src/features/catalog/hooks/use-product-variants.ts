/**
 * @file use-product-variants.ts
 * @layer Hook
 * @feature catalog
 * @description Hook quản lý danh sách variants trong form tạo/chỉnh sửa sản phẩm (admin).
 */
import { ProductVariant } from '@/types';
import { useEffect, useState } from 'react';
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

    // Tính giá trung bình theo trọng số tồn kho (weighted average price):
    // Chỉ tính các variant có stock > 0 VÀ price > 0 để tránh chia cho 0
    // và tránh variants chưa nhập giá kéo lệch kết quả.
    let weightedPriceSum = 0;
    let totalWeightedStock = 0;
    variants.forEach((variant) => {
      const stock = parseInt(variant.stock?.toString() || '0');
      // Cap giá tại 99999999.99 — giới hạn của trường price trong DB (DECIMAL(10,2))
      const price = Math.min(parseFloat(variant.price?.toString() || '0'), 99999999.99);
      if (stock > 0 && price > 0) {
        weightedPriceSum += price * stock;
        totalWeightedStock += stock;
      }
    });

    // Nếu tất cả variants đều có stock = 0, không có cơ sở tính weighted average
    // → giữ nguyên giá hiện tại trong form thay vì ghi 0
    const weightedAveragePrice = totalWeightedStock > 0 ? weightedPriceSum / totalWeightedStock : 0;
    const newPrice =
      weightedAveragePrice > 0
        ? Math.round(weightedAveragePrice)
        : form.getFieldValue('price') || 0;

    // Chỉ update form nếu giá trị thực sự thay đổi — tránh trigger watchFormValues loop
    const currentStock = form.getFieldValue('stockQuantity');
    const currentPrice = form.getFieldValue('price');
    if (currentStock !== totalStock || currentPrice !== newPrice) {
      form.setFieldsValue({ stockQuantity: totalStock, price: newPrice });
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
      // Chế độ sửa: thay thế variant cũ, giữ nguyên id gốc để không mất liên kết với DB
      setVariants(
        variants.map((existingVariant) =>
          existingVariant.id === editingVariant.id
            ? { ...variant, id: editingVariant.id }
            : existingVariant,
        ),
      );
    } else {
      // Chế độ tạo mới: sinh id tạm thời cho variant chưa có id từ server
      const temporaryId = `var-${variants.length}-${Math.random().toString(36).substring(2, 9)}`;
      setVariants([...variants, { ...variant, id: variant.id || temporaryId }]);
    }
    setVariantModalVisible(false);
    setEditingVariant(null);
  };

  /**
   * Xóa variant khỏi danh sách theo ID.
   * Sau khi xóa, useEffect sẽ tự động tính lại `stockQuantity` và `price`
   * trong form dựa trên danh sách variants còn lại.
   *
   * @param id - ID của variant cần xóa (có thể là id từ server hoặc id tạm thời).
   */
  const handleDeleteVariant = (id: string) => {
    setVariants(variants.filter((variant) => variant.id !== id));
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
