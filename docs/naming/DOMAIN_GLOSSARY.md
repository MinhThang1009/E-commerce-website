# Naming — Domain-Specific Conventions (E-Commerce)

## Number unit suffix
Tránh ambiguous, e-commerce có nhiều unit:
- **Tiền:** trong dự án này dùng `DECIMAL(15,2)` cho VND và GIỮ NGUYÊN tên `base_price`, `unit_price`, `total_amount`, `shipping_cost`, etc. (đã chuẩn ở Phase 40). KHÔNG đổi thêm suffix `Vnd` vì project chỉ có 1 currency — thêm suffix sẽ rename ~30 column DB và ~50 file FE/BE, ROI thấp. Convention `priceVnd`/`priceInCents` chỉ áp dụng nếu sau này có multi-currency.
- **Thời gian:** `timeoutMs`, `delayMs`, `ttlSeconds`, `expiresInDays`, `cacheTtlMin`.
- **Khối lượng:** `weightKg`, `weightG`.
- **Kích thước:** `widthCm`, `heightCm`, `lengthCm`, `diagonalInch`.
- **Phần trăm:** `discountPercent` (0-100), `taxPercent` — tránh `discount` mơ hồ.

## Date field naming
- **Timestamp** (ISO 8601 datetime): suffix `At` — `createdAt`, `updatedAt`, `deletedAt`.
- **Date-only** (không có time): suffix `Date` — `birthDate`, `expirationDate`, `releaseDate`.
- **Action timestamp**: `cancelledAt`, `paidAt`, `shippedAt`, `deliveredAt`, `refundedAt`, `verifiedAt`.
- KHÔNG dùng: `createDate`, `dateCreated`, `created_date` (dù DB là snake_case `created_at`, JS-level luôn `createdAt`).

## Domain Glossary (Ubiquitous Language)
> **Quan trọng nhất với Modular Monolith.** 1 thuật ngữ duy nhất cho mỗi concept — KHÔNG mix.

| Concept | Term DUY NHẤT dùng | KHÔNG dùng |
|---|---|---|
| Người mua hàng | `user` | `customer`, `buyer`, `client`, `account` |
| Sản phẩm chính | `product` | `item`, `goods`, `merchandise` |
| Biến thể sản phẩm | `productVariant` (DB: `product_variants`) | `variant`, `sku`, `productItem` |
| Mã giảm giá | `discountCode` | `coupon`, `promoCode`, `voucher` |
| Đơn hàng | `order` | `purchase`, `transaction` (transaction = payment record) |
| Mục trong đơn | `orderItem` | `lineItem`, `purchaseItem` |
| Mục trong giỏ | `cartItem` | `basketItem` |
| Đánh giá sản phẩm | `review` | `rating`, `feedback` |
| Phản hồi liên hệ | `feedback` (form contact) | KHÔNG dùng cho review |
| Bảo hành | `warrantyPackage` | `warranty`, `guaranteePlan` |
| Tích điểm | `loyaltyPoints` | `rewardPoints`, `cashback` |
| Lịch sử điểm | `loyaltyHistory` | `pointsLog`, `rewardLog` |
| Thông báo (system) | `notification` | `alert`, `message` (message = chat) |
| Tin nhắn chat | `chatMessage` | `notification`, `dm` |
| Banner trang chủ | `banner` | `slide`, `hero` (hero là section name) |
| Tin tức / blog | `news` | `post`, `article`, `blog` |
| Bộ sưu tập | `collection` | `series`, `bundle`, `pack` |
| Thuộc tính sản phẩm | `productAttribute` (color, size...) | `option`, `feature`, `spec` |
| Nhóm thuộc tính | `attributeGroup` | `attributeCategory`, `attributeType` |
| Vận chuyển | `shipping` | `delivery` (giữ nhất quán với DB `shipping_*`) |
| Thanh toán | `payment` | `checkout` (checkout = process), `transaction` |

**Quy tắc khi thêm feature mới:** bắt buộc check glossary trước; bổ sung term mới vào table này nếu thật sự là concept mới (không trùng existing).

## Translation key namespace (i18n)
- **Pattern:** `{feature}.{section}.{key}` — nested object, không flat:
  ```json
  // ✅ Đúng
  {
    "checkout": {
      "summary": { "title": "Tóm tắt đơn hàng", "subtotal": "Tạm tính" },
      "address": { "title": "Địa chỉ giao hàng" }
    }
  }
  // ❌ Sai (flat)
  { "checkoutSummaryTitle": "..." }
  ```
- **Key casing:** **camelCase** trong JSON — `addToCart`, `subtotal`, không `add_to_cart`.
- **Value:** tiếng tự nhiên có dấu (vi.json) hoặc plain English (en.json).
- **Tên file:** `{lang}.json` — `vi.json`, `en.json`.
- **Common keys** dùng chung nhiều feature: namespace `common.*` — `common.save`, `common.cancel`, `common.confirm`.

## Folder casing
- **Project root folders:** lowercase — `backend/`, `frontend/`, `docs/`, `node_modules/`.
- **Source folders** (within `src/`):
  - BE: lowercase — `controllers/`, `services/`, `repositories/`, `modules/`.
  - FE: lowercase — `components/`, `features/`, `pages/`, `hooks/`.
- **Feature/domain folders**:
  - `features/{plural}/` — match REST resource (`features/products/`, `features/orders/`).
  - `components/domain/{singular}/` — match noun (`components/domain/product/`, `components/domain/order/`).
- **Component-as-folder** (component có sub-files: index, styles, test): PascalCase folder match component name — `Button/{index.tsx, Button.module.css, Button.test.tsx}`. Mặc định project hiện tại: 1 file/component, không cần folder.
- **KHÔNG mix kebab + camelCase + Pascal** trong cùng level.

## CSS / Styling
- **Default: Tailwind utility-first** — class trực tiếp trong JSX.
- **Custom CSS:** chỉ khi Tailwind không express được (animation phức tạp, third-party override) — dùng CSS Modules: `Component.module.css` co-located với component.
- **Inline style:** chỉ cho dynamic value runtime (vd `style={{ width: progress + '%' }}`) — KHÔNG cho static value.
- **Theme:** dùng `tailwind.config.js` `extend` cho color/spacing/font/breakpoint — KHÔNG hardcode hex trong className.
- **Class naming custom CSS:** kebab-case (CSS standard) — `.product-card`, `.checkout-summary`. KHÔNG dùng `.productCard` (BEM hoặc kebab, nhất quán toàn project).
- **Ant Design:** override qua `theme` token trong ConfigProvider thay vì CSS hack.

## Test naming pattern
- **File:** `{Subject}.test.{ts|tsx|js}` co-located với source file. Vd `Button.test.tsx` cùng folder với `Button.tsx`.
- **Unit-only (BE):** `{Subject}.unit.test.js`.
- **Integration (BE):** `{flow}.integration.test.js` (vd `checkoutFlow.integration.test.js`).
- **E2E (nếu có):** `{flow}.e2e.test.js`.
- **Mocks folder:** `__mocks__/` cùng cấp với module được mock.
- **Fixtures:** `__fixtures__/` cho test data shared.
- **Snapshot:** `__snapshots__/` (Jest auto-generate).
- **describe/it pattern:**
  ```ts
  describe('ProductCard', () => {
    describe('when product is in stock', () => {
      it('should display the price', () => { ... });
      it('should enable the add-to-cart button', () => { ... });
    });
    describe('when product is out of stock', () => {
      it('should display "Out of stock" badge', () => { ... });
      it('should disable the add-to-cart button', () => { ... });
    });
  });
  ```
- **KHÔNG** dùng `"test X"` hay `"X works"` — phải mô tả behavior cụ thể với `"should ..."`.
