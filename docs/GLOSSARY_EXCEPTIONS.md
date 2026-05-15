# Domain Glossary Exceptions

> Audit Phase 43.1 ngày 2026-05-05. List các occurrence của "forbidden term" trong Domain Glossary ([DOMAIN_GLOSSARY.md](naming/DOMAIN_GLOSSARY.md)) nhưng KHÔNG phải vi phạm thực sự — kèm rationale.

## True violation đã fix

| Term | File | Action | Commit |
|---|---|---|---|
| `coupon` | `backend/src/models/orderItem.js:38` (comment) | Đổi sang `discountCode` | (this commit) |

## False positives (KHÔNG phải Domain Glossary violation)

### Browser/HTML/Library API standard names — KHÔNG đổi
| Term | Context | Reason |
|---|---|---|
| `alert` | `role="alert"` ARIA attribute trong `Notifications.tsx` | HTML/ARIA standard, không phải domain entity |
| `alert` | `alert(t('...'))` browser dialog | JavaScript built-in API |
| `client` | axios `apiClient`, `httpClient` | Generic HTTP client variable, không phải user concept |
| `customer` | Payment SDK customer concept | Third-party API field name (payment domain ≠ our domain) |
| `transaction` | `sequelize.transaction(async (t) => {})` | DB transaction, không phải payment record |
| `option` | HTML `<option>` element, dropdown options | HTML/UI element, không phải productAttribute |
| `feature` | `features/` folder, feature flag | Code organization term, không phải product spec |
| `account` | "user account" general English | Generic noun, không phải concept-level term |

### UI section/component names — explicit exceptions per glossary
| Term | Context | Reason |
|---|---|---|
| `hero` | `HeroSection.tsx`, i18n `homepage.hero.*` | Glossary documented: "hero là section name" |
| `slide` | `HERO_SLIDES` carousel internal trong HeroSection | Carousel slide concept — UI-internal, không phải DB Banner entity |
| `bundle` | "production bundle" comment trong PaymentQRPage | Vite/build term, không phải Collection entity |

### Verb forms / generic English — chấp nhận
| Term | Context | Reason |
|---|---|---|
| `purchase` | Comment "purchase history" trong promptTemplates.ts | Verb form (action), không phải Order entity reference |
| `delivery` | Intent classification string `'delivery'` trong ruleBasedChatbot | NLU intent label, mapping sang shipping logic |

## Nuanced cases — accepted với rationale

### `voucher` (30+ refs trong CartPage.tsx + locales)
- **Per glossary:** `discountCode` là canonical term, `voucher` cấm dùng.
- **Implementation:** `voucherCode`, `appliedVoucher`, `applyingVoucher` state vars + `cart.voucher.*` i18n keys.
- **Rationale giữ nguyên:**
  1. UX-driven naming: user-facing UI hiển thị "Voucher" (en) / "Mã giảm giá" (vi). Code identifier match UI helps developer trace bug back to UI element.
  2. Backend models + API endpoints DÙNG đúng `discountCode` — boundary là CartPage component layer.
  3. Refactor 30+ refs ROI thấp; risk break test/UX state.
- **Future:** Nếu Phase 42 main refactor (ModularMonolith) chạy, `cart` module có thể rename internal — nhưng UI strings giữ "voucher" cho UX.

### `attributeType` (15 refs trong SimpleAttributeSelector.tsx, 1 trong productNaming.ts)
- **Per glossary:** `attributeGroup` là canonical term cho concept "category of attribute".
- **Implementation:** Param name `attributeType: string` (dạng "Color", "RAM", "Storage") trong handler function.
- **Rationale giữ nguyên:**
  1. Param semantic: "type" of attribute (string discriminator) — không reference DB `attribute_groups` row entity.
  2. Generic param name in 1 isolated component, không leak ra public API.
  3. Đổi sang `attributeGroupName` dài + verbose, không gain clarity.
- **Future:** Nếu component refactor sang typed enum hoặc domain-specific structure, cân nhắc rename khi đó.

## Quy tắc tham khảo cho audit tương lai

Khi grep Domain Glossary forbidden term, classify:
1. **HTML/ARIA/standard library** → false positive, không đổi.
2. **Third-party SDK/API field** (Google, VNPay, MoMo, etc.) → false positive.
3. **Code-level technical concept** (DB transaction, HTTP client, build bundle) → false positive.
4. **Verb form** (purchase as action) → false positive.
5. **UI section/component name** đã document trong glossary → false positive.
6. **Domain entity reference SAI** (vd dùng `coupon` cho discount entity) → **TRUE violation**, fix.
7. **UX-driven term match user-facing string** → document exception với rationale.
