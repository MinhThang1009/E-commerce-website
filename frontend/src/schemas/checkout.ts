import { z } from 'zod';

const vietnamesePhoneRegex = /^(0|\+84)[0-9]{9}$/;

export const shippingSchema = z.object({
  firstName: z.string().min(1, 'Vui lòng nhập họ'),
  lastName: z.string().min(1, 'Vui lòng nhập tên'),
  email: z.string().min(1, 'Vui lòng nhập email').email('Email không hợp lệ'),
  phone: z
    .string()
    .min(1, 'Vui lòng nhập số điện thoại')
    .transform((v) => v.trim().replace(/[\s.-]/g, ''))
    .pipe(z.string().regex(vietnamesePhoneRegex, 'Số điện thoại không hợp lệ (VD: 0912345678)')),
  address: z.string().refine(
    (v) => {
      const parts = v
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      return parts.length >= 3;
    },
    { message: 'Vui lòng chọn đầy đủ tỉnh, quận và số nhà/đường' },
  ),
  city: z.string().min(1, 'Vui lòng chọn tỉnh/thành phố'),
  state: z.string().min(1, 'Vui lòng chọn quận/huyện'),
});

export type ShippingInput = z.infer<typeof shippingSchema>;
