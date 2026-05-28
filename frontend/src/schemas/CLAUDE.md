# Schemas — Zod Validation Schemas — TechStore Frontend

← Quay lại [`frontend/CLAUDE.md`](../../CLAUDE.md)

## 1. Tổng quan

Form validation schemas dùng Zod v4. Tập trung validation logic — không bị duplicate giữa các form.

Error messages bằng **tiếng Việt** trực tiếp (không qua i18n `t()`).

## 2. Files

```
schemas/
  auth.ts      — loginSchema, registerSchema, forgotPasswordSchema, resetPasswordSchema
  checkout.ts  — shippingSchema (checkout shipping form)
  admin.ts     — categorySchema, brandSchema, discountCodeSchema, productSchema (ref only)
  index.ts     — barrel export
```

## 3. Usage pattern

```ts
import { loginSchema } from '@/schemas/auth';

const validateForm = () => {
  const result = loginSchema.safeParse({ email, password });
  if (!result.success) {
    const fe = result.error.flatten().fieldErrors;
    setErrors({ email: fe.email?.[0], password: fe.password?.[0] });
    return false;
  }
  setErrors({});
  return true;
};
```

## 4. Schemas

### admin.ts

| Schema               | Fields                                    | Đặc biệt                                          |
| -------------------- | ----------------------------------------- | ------------------------------------------------- |
| `categorySchema`     | name, description?, parentId?, image?     | name min 2 chars                                  |
| `brandSchema`        | name, website?, description?, image?      | website: URL format nếu có                        |
| `discountCodeSchema` | code, type, value, ...                    | code regex `^[A-Z0-9_]+$`; value ≤100 nếu percent |
| `productSchema`      | name, basePrice, categoryIds, description | ref only — product form dùng antd Form riêng      |

**Lưu ý Zod v4:** dùng `z.number({ error: '...' })` (không phải `invalid_type_error` của v3).

### auth.ts

| Schema                 | Fields                                                                     | Đặc biệt                                              |
| ---------------------- | -------------------------------------------------------------------------- | ----------------------------------------------------- |
| `loginSchema`          | email, password                                                            | email format, password min 6                          |
| `registerSchema`       | firstName, lastName, email, password, confirmPassword, phone?, acceptTerms | `.refine` check password match; acceptTerms phải true |
| `forgotPasswordSchema` | email                                                                      | email format                                          |
| `resetPasswordSchema`  | password, confirmPassword                                                  | `.refine` check password match                        |

### checkout.ts

| Schema           | Fields                                                  | Đặc biệt                                                                 |
| ---------------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| `shippingSchema` | firstName, lastName, email, phone, address, city, state | phone: VN format `(0\|+84)[0-9]{9}`; address: `.refine` >= 3 comma parts |

## 5. Gotchas

- **Tests**: khi update error message trong schema → update test assertions tương ứng trong `src/__tests__/auth-pages.test.tsx` và `auth-pages-extra.test.tsx`.
- **i18n**: error messages là hardcoded Vietnamese — không dùng `t()` vì schemas định nghĩa ngoài React component.
- **Zod v4**: API tương tự v3. `z.string().min(1, 'msg')` là cách viết chuẩn.
