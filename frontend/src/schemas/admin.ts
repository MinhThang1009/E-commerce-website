import { z } from 'zod';

export const categorySchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên danh mục').min(2, 'Tên danh mục tối thiểu 2 ký tự'),
  description: z.string().optional(),
  parentId: z.string().optional(),
  image: z.string().optional(),
});

export const brandSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên thương hiệu'),
  website: z
    .string()
    .optional()
    .refine(
      (v) =>
        !v ||
        v.trim().length === 0 ||
        (() => {
          try {
            new URL(v);
            return true;
          } catch {
            return false;
          }
        })(),
      { message: 'Website không hợp lệ (VD: https://example.com)' },
    ),
  description: z.string().optional(),
  image: z.string().optional(),
});

export const discountCodeSchema = z
  .object({
    code: z
      .string()
      .min(1, 'Vui lòng nhập mã giảm giá')
      .regex(/^[A-Z0-9_]+$/, 'Mã chỉ gồm chữ in hoa, số và dấu gạch dưới'),
    type: z.enum(['percent', 'fixed']),
    value: z.number({ error: 'Vui lòng nhập giá trị giảm' }).positive('Giá trị phải lớn hơn 0'),
    minOrderAmount: z.number().min(0).optional(),
    maxDiscountAmount: z.number().positive().optional().nullable(),
    usageLimit: z.number().int().positive().optional().nullable(),
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  })
  .refine((data) => !(data.type === 'percent' && data.value > 100), {
    message: 'Giảm theo % không được vượt quá 100',
    path: ['value'],
  });

// productSchema: chỉ validate basic fields (form sản phẩm dùng antd Form — không dùng schema này trực tiếp)
export const productSchema = z.object({
  name: z.string().min(1, 'Vui lòng nhập tên sản phẩm'),
  basePrice: z.number({ error: 'Vui lòng nhập giá' }).positive('Giá phải lớn hơn 0'),
  categoryIds: z.array(z.string()).min(1, 'Vui lòng chọn ít nhất 1 danh mục'),
  description: z.string().min(1, 'Vui lòng nhập mô tả sản phẩm'),
});

export type CategoryInput = z.infer<typeof categorySchema>;
export type BrandInput = z.infer<typeof brandSchema>;
export type DiscountCodeInput = z.infer<typeof discountCodeSchema>;
export type ProductInput = z.infer<typeof productSchema>;
