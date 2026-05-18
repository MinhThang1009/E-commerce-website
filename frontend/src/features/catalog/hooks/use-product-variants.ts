/**
 * @file useProductVariants.ts
 * @layer Hook
 * @feature catalog
 * @description Custom React hook cho feature catalog
 */
import { ProductVariant } from '@/types';
import { useEffect, useState } from 'react';
import type { FormInstance } from 'antd';

export const useProductVariants = (initialVariants: ProductVariant[] = [], form?: FormInstance) => {
  const [variants, setVariants] = useState<ProductVariant[]>(initialVariants);
  const [variantModalVisible, setVariantModalVisible] = useState(false);
  const [editingVariant, setEditingVariant] = useState<ProductVariant | null>(null);

  // Tự động cập nhật tổng số lượng tồn kho và giá trung bình khi variants thay đổi
  useEffect(() => {
    if (!form || variants.length === 0) return;

    const totalStock = variants.reduce((total, variant) => {
      const stock = parseInt(variant.stock?.toString() || '0');
      return total + (isNaN(stock) ? 0 : stock);
    }, 0);

    let weightedPriceSum = 0;
    let totalWeightedStock = 0;
    variants.forEach((variant) => {
      const stock = parseInt(variant.stock?.toString() || '0');
      const price = Math.min(parseFloat(variant.price?.toString() || '0'), 99999999.99);
      if (stock > 0 && price > 0) {
        weightedPriceSum += price * stock;
        totalWeightedStock += stock;
      }
    });

    const averagePrice = totalWeightedStock > 0 ? weightedPriceSum / totalWeightedStock : 0;
    const newPrice = averagePrice > 0 ? Math.round(averagePrice) : form.getFieldValue('price') || 0;

    // Chỉ update form nếu giá trị thực sự thay đổi — tránh trigger watchFormValues loop
    const currentStock = form.getFieldValue('stockQuantity');
    const currentPrice = form.getFieldValue('price');
    if (currentStock !== totalStock || currentPrice !== newPrice) {
      form.setFieldsValue({ stockQuantity: totalStock, price: newPrice });
    }
  }, [variants, form]);

  // Variant handlers
  const handleAddVariant = (variant: ProductVariant) => {
    if (editingVariant) {
      setVariants(
        variants.map((v) =>
          v.id === editingVariant.id ? { ...variant, id: editingVariant.id } : v,
        ),
      );
    } else {
      // Sử dụng một ID ổn định hơn, không phụ thuộc vào thời gian
      const newId = `var-${variants.length}-${Math.random().toString(36).substring(2, 9)}`;
      setVariants([...variants, { ...variant, id: variant.id || newId }]);
    }
    setVariantModalVisible(false);
    setEditingVariant(null);
  };

  const handleDeleteVariant = (id: string) => {
    setVariants(variants.filter((v) => v.id !== id));
  };

  const openVariantModal = (variant?: ProductVariant) => {
    setEditingVariant(variant || null);
    setVariantModalVisible(true);
  };

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
