# Models — Sequelize ORM Models (32 models)

> 32 Sequelize models tại `src/models/`. Associations định nghĩa **toàn bộ** trong `index.js`.

← Quay lại [`backend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Lưu ý đọc file](#1-lưu-ý-đọc-file)
- [2. Model — File — Table mapping](#2-model--file--table-mapping)
- [3. Conventions quan trọng](#3-conventions-quan-trọng)
- [4. Associations hub](#4-associations-hub)
- [5. Models đã DROP — KHÔNG dùng](#5-models-đã-drop--không-dùng)

---

## 1. Lưu ý đọc file

**KHÔNG đọc hết** — chỉ đọc model cụ thể khi cần. Dùng mapping bên dưới để tìm đúng file.

Associations chỉ được định nghĩa trong `index.js` — không lặp lại trong từng model file.

---

## 2. Model — File — Table mapping

| Model                 | File                       | Table                    | Ghi chú quan trọng                                                                         |
| --------------------- | -------------------------- | ------------------------ | ------------------------------------------------------------------------------------------ |
| User                  | user.js                    | users                    | `beforeCreate`: bcrypt password; `toJSON`: strip password/otp/resetToken                   |
| Address               | address.js                 | addresses                | paranoid                                                                                   |
| Category              | category.js                | categories               | `beforeValidate`: auto-slug từ `nameVi`; paranoid                                          |
| Brand                 | brand.js                   | brands                   | `beforeValidate`: auto-slug từ `nameVi`                                                    |
| Product               | product.js                 | products                 | `afterCreate/Update/Destroy`: sync vectorStore; `beforeValidate`: auto-slug unique         |
| ProductVariant        | product-variant.js         | product_variants         | paranoid                                                                                   |
| ProductImage          | product-image.js           | product_images           | paranoid; có `variantId` FK (nullable)                                                     |
| ProductAttribute      | product-attribute.js       | product_attributes       | —                                                                                          |
| ProductSpecification  | product-specification.js   | product_specifications   | —                                                                                          |
| ProductAttributeGroup | product-attribute-group.js | product_attribute_groups | junction (M-M Product ↔ AttributeGroup)                                                    |
| ProductCategory       | product-category.js        | product_categories       | junction (M-M Product ↔ Category)                                                          |
| ProductWarranty       | product-warranty.js        | product_warranties       | junction (M-M Product ↔ WarrantyPackage)                                                   |
| AttributeGroup        | attribute-group.js         | attribute_groups         | type: color/size/storage/custom                                                            |
| AttributeValue        | attribute-value.js         | attribute_values         | `colorCode` hex; `priceAdjustment`                                                         |
| Review                | review.js                  | product_reviews          | paranoid; `rating` 1–5 validated                                                           |
| Cart                  | cart.js                    | carts                    | status: active/merged/converted/abandoned                                                  |
| CartItem              | cart-item.js               | cart_items               | `unitPrice` snapshot; `warrantyPackageIds` JSON                                            |
| Order                 | order.js                   | orders                   | paranoid; `pointsEarned/Used/Discount`; `warrantyCost`                                     |
| OrderItem             | order-item.js              | order_items              | `unitPrice/name/sku` snapshot (không cần join Product)                                     |
| DiscountCode          | discount-code.js           | discount_codes           | paranoid; type: percent/fixed                                                              |
| Wishlist              | wishlist.js                | wishlists                | junction (M-M User ↔ Product)                                                              |
| WarrantyPackage       | warranty-package.js        | warranty_packages        | —                                                                                          |
| Banner                | banner.js                  | banners                  | paranoid; position: home_hero/middle/sidebar                                               |
| News                  | news.js                    | news                     | paranoid; `userId` nullable                                                                |
| Feedback              | feedback.js                | feedbacks                | status: pending/reviewed/resolved                                                          |
| ChatMessage           | chat-message.js            | chat_messages            | role: user/assistant; messageType: ai_chatbot/support                                      |
| InventoryLog          | inventory-log.js           | inventory_logs           | **immutable** (`updatedAt: false`)                                                         |
| AuditLog              | audit-log.js               | audit_logs               | admin action log                                                                           |
| LoyaltyHistory        | loyalty-history.js         | loyalty_histories        | type: earn/spend/refund/adjustment                                                         |
| SearchHistory         | search-history.js          | search_histories         | **immutable** (`updatedAt: false`)                                                         |
| RecentlyViewed        | recently-viewed.js         | recently_viewed          | —                                                                                          |
| Image                 | image.js                   | images                   | associations đã xóa khỏi `index.js`; image module vẫn `require('@models/image')` trực tiếp |

---

## 3. Conventions quan trọng

- **`paranoid: true`** → soft-delete (`deletedAt`), giữ record cho audit — dùng cho mọi business-critical entity
- **Immutable logs** (`updatedAt: false`): `InventoryLog`, `SearchHistory` — không được update sau khi tạo
- **i18n per-column**: `nameVi`/`nameEn`, `descriptionVi`/`descriptionEn` — Product, Category, Brand, Banner, News
- **Snapshot pattern**: `OrderItem.unitPrice/name/sku`, `CartItem.unitPrice` — copy tại thời điểm tạo, không join về Product sau này
- **JSON fields** (MySQL JSON type): `tags`, `specifications`, `attributes`, `warrantyPackageIds`, `images`

---

## 4. Associations hub

Product là trung tâm — toàn bộ associations:

```
Product
├── belongsTo Category (direct FK, as 'category')
├── belongsToMany Category (via ProductCategory, as 'categories')
├── belongsTo Brand (as 'brand')
├── hasMany ProductVariant (as 'variants')
├── hasOne ProductVariant (scope isDefault=true, as 'defaultVariant')
├── hasMany ProductImage (as 'productImages')
├── hasMany ProductAttribute (as 'productAttributes')
├── hasMany ProductSpecification (as 'productSpecifications')
├── belongsToMany AttributeGroup (via ProductAttributeGroup, as 'attributeGroups')
├── belongsToMany WarrantyPackage (via ProductWarranty, as 'warrantyPackages')
├── hasMany ProductWarranty (as 'productWarranties')
├── hasMany Review (as 'reviews')
├── hasMany InventoryLog (as 'inventoryLogs')
├── hasMany RecentlyViewed (as 'recentlyViewed')
└── belongsToMany User (via Wishlist, as 'wishlistedBy')

User
├── hasMany Address (as 'addresses')
├── hasMany Order (as 'orders')
├── hasMany Cart (as 'carts')
├── hasMany Review (as 'reviews')
├── hasMany ChatMessage (as 'chatMessages')
├── hasMany SearchHistory (as 'searchHistories')
├── hasMany LoyaltyHistory (as 'loyaltyHistories')
├── hasMany InventoryLog (as 'inventoryLogs', FK: createdBy)
├── hasMany RecentlyViewed (as 'recentlyViewed')
├── hasMany AuditLog (as 'auditLogs', FK: adminId)
├── hasMany News (as 'news')
└── belongsToMany Product (via Wishlist, as 'wishlist')

Order → hasMany OrderItem (as 'items')
      → hasMany LoyaltyHistory
      → hasMany InventoryLog
      → belongsTo DiscountCode (as 'appliedDiscount')

Cart → hasMany CartItem (as 'items')
CartItem → belongsTo Product, ProductVariant

ProductVariant → hasMany ProductImage (as 'images')
AttributeGroup → hasMany AttributeValue (as 'values')
```

---

## 5. Models đã DROP — KHÔNG dùng

Các model này đã bị drop hoàn toàn (migrations 2026052001–2026052003). **Không reference lại:**

- `Collection`, `product_collections` — dropped
- `EmailCampaign`, `email_campaigns` — dropped
- `NewsletterSubscriber`, `newsletter_subscribers` — dropped
- `ImportLog`, `import_logs` — dropped

`Image` model (`image.js`) vẫn tồn tại nhưng **associations đã xóa khỏi `index.js`** (migration 2026051615). Image module require trực tiếp `@models/image` — không đi qua `index.js`.
