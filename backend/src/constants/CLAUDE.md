# Backend Constants

> Hằng số toàn cục cho backend. Tập trung 1 nơi, không hardcode rải rác.

← Quay lại [`backend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Mục đích](#1-mục-đích)
- [2. Danh sách hằng số](#2-danh-sách-hằng-số)
- [3. Cách dùng](#3-cách-dùng)
- [4. Gotchas](#4-gotchas)

---

# 1. Mục đích

File `src/constants/index.js` chứa tất cả hằng số business-level dùng chung trong backend:

- Ngưỡng phí ship
- Giới hạn upload, phân trang, cart
- Thời gian hết hạn OTP, JWT refresh

Bất cứ giá trị nào lặp lại ở >1 file → đưa vào đây.

---

# 2. Danh sách hằng số

| Constant                   |           Giá trị | Mô tả                                                     |
| -------------------------- | ----------------: | --------------------------------------------------------- |
| `SHIPPING_FREE_THRESHOLD`  |         `2000000` | Miễn phí ship nếu subtotal ≥ 2,000,000 VND                |
| `SHIPPING_BASE_RATE`       |           `30000` | Phí ship cơ bản (VND)                                     |
| `SHIPPING_WEIGHT_RATE`     |            `5000` | +5,000 VND mỗi kg vượt 2kg                                |
| `JWT_REFRESH_EXPIRY`       |           `'30d'` | Thời hạn refresh token (access dùng env `JWT_EXPIRES_IN`) |
| `PAGINATION_DEFAULT_LIMIT` |              `20` | Số item mặc định / trang                                  |
| `PAGINATION_MAX_LIMIT`     |             `100` | Trần limit để chặn DOS                                    |
| `MAX_UPLOAD_SIZE`          | `5 * 1024 * 1024` | Giới hạn file upload 5MB                                  |
| `OTP_EXPIRY_MINUTES`       |              `10` | OTP hết hạn sau 10 phút                                   |
| `MAX_CART_QUANTITY`        |              `99` | Số lượng tối đa 1 SP trong cart                           |

---

# 3. Cách dùng

```js
const constants = require('@constants'); // hoặc inject qua module factory
// app.js inject constants vào ordersModule (xem app.js)
const ordersModule = buildOrdersModule({ ..., constants });
```

Trong service:

```js
if (subtotal >= this.constants.SHIPPING_FREE_THRESHOLD) {
  shippingFee = 0;
}
```

---

# 4. Gotchas

- **Đừng inline số magic** trong service. Ví dụ KHÔNG: `if (subtotal >= 2000000)`. Phải dùng `constants.SHIPPING_FREE_THRESHOLD`.
- File này là **server-side**, không expose ra frontend. Frontend có constants riêng tại `frontend/src/constants/`.
