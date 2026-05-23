# Audit Plan — CLAUDE.md Files

> Phase 1a output. Được tạo ngày 2026-05-23.

## Tóm tắt

| Metric | Giá trị |
|---|---|
| CLAUDE.md files thực tế | **71** |
| CLAUDE.md files được claim trong audit prompt | 72 |
| Sai lệch | −1 (`.claude/plans/CLAUDE.md` referenced nhưng không tồn tại) |
| Broken references trong root CLAUDE.md | 1 |
| Orphaned files (có nhưng không trong Map) | 5 |

---

## 1. Danh sách đầy đủ 71 CLAUDE.md files (path tương đối)

### Root & CI (3 files)
```
CLAUDE.md
.github/workflows/CLAUDE.md
scripts/CLAUDE.md
```

### Backend (41 files)
```
backend/CLAUDE.md
backend/data/CLAUDE.md
backend/docs/CLAUDE.md
backend/scripts/CLAUDE.md
backend/src/__api__/CLAUDE.md
backend/src/__e2e__/CLAUDE.md
backend/src/__integration__/CLAUDE.md
backend/src/__tests__/CLAUDE.md
backend/src/config/CLAUDE.md
backend/src/constants/CLAUDE.md
backend/src/jobs/CLAUDE.md
backend/src/locales/CLAUDE.md
backend/src/middlewares/CLAUDE.md
backend/src/migrations/CLAUDE.md
backend/src/models/CLAUDE.md
backend/src/modules/admin/CLAUDE.md
backend/src/modules/ai/CLAUDE.md
backend/src/modules/ai/services/chatbot/CLAUDE.md        ← ORPHANED (không có trong Map)
backend/src/modules/attribute/CLAUDE.md
backend/src/modules/auth/CLAUDE.md
backend/src/modules/cart/CLAUDE.md
backend/src/modules/catalog/CLAUDE.md
backend/src/modules/content/CLAUDE.md
backend/src/modules/discount-code/CLAUDE.md
backend/src/modules/image/CLAUDE.md
backend/src/modules/inventory/CLAUDE.md
backend/src/modules/orders/CLAUDE.md
backend/src/modules/payment/CLAUDE.md
backend/src/modules/reviews/CLAUDE.md
backend/src/modules/search-history/CLAUDE.md
backend/src/modules/upload/CLAUDE.md
backend/src/modules/users/CLAUDE.md
backend/src/modules/wishlist/CLAUDE.md
backend/src/routes/CLAUDE.md
backend/src/services/CLAUDE.md
backend/src/services/embedding/CLAUDE.md                 ← ORPHANED (không có trong Map)
backend/src/services/vector-store/CLAUDE.md              ← ORPHANED (không có trong Map)
backend/src/shared/CLAUDE.md
backend/src/shared/errors/CLAUDE.md                      ← ORPHANED (không có trong Map)
backend/src/shared/persistence/CLAUDE.md                 ← ORPHANED (không có trong Map)
backend/src/utils/CLAUDE.md
```

### Frontend (27 files)
```
frontend/CLAUDE.md
frontend/src/__tests__/CLAUDE.md
frontend/src/components/CLAUDE.md
frontend/src/config/CLAUDE.md
frontend/src/constants/CLAUDE.md
frontend/src/features/admin/CLAUDE.md
frontend/src/features/ai/CLAUDE.md
frontend/src/features/auth/CLAUDE.md
frontend/src/features/cart/CLAUDE.md
frontend/src/features/catalog/CLAUDE.md
frontend/src/features/checkout/CLAUDE.md
frontend/src/features/content/CLAUDE.md
frontend/src/features/orders/CLAUDE.md
frontend/src/features/payment/CLAUDE.md
frontend/src/features/reviews/CLAUDE.md
frontend/src/features/upload/CLAUDE.md
frontend/src/features/users/CLAUDE.md
frontend/src/features/wishlist/CLAUDE.md
frontend/src/hooks/CLAUDE.md
frontend/src/lib/CLAUDE.md
frontend/src/locales/CLAUDE.md
frontend/src/pages/CLAUDE.md
frontend/src/routes/CLAUDE.md
frontend/src/stores/CLAUDE.md
frontend/src/styles/CLAUDE.md
frontend/src/types/CLAUDE.md
frontend/src/utils/CLAUDE.md
```

---

## 2. Broken References

| File | Tham chiếu | Trạng thái |
|---|---|---|
| `CLAUDE.md` (section 9, dòng cuối) | `.claude/plans/CLAUDE.md` | ❌ NOT FOUND — thư mục `.claude/plans/` tồn tại nhưng file không có |

**Action cần làm:** Xóa dòng reference đến `.claude/plans/CLAUDE.md` trong root CLAUDE.md Map, hoặc tạo file đó.

---

## 3. Orphaned Files (có trong codebase nhưng không trong Map)

| File | Lý do orphaned |
|---|---|
| `backend/src/modules/ai/services/chatbot/CLAUDE.md` | Map chỉ liệt kê `modules/ai/CLAUDE.md`, không liệt kê sub-service |
| `backend/src/services/embedding/CLAUDE.md` | Map liệt kê `services/CLAUDE.md` nhưng không có sub-items |
| `backend/src/services/vector-store/CLAUDE.md` | Map liệt kê `services/CLAUDE.md` nhưng không có sub-items |
| `backend/src/shared/errors/CLAUDE.md` | Map liệt kê `shared/CLAUDE.md` nhưng không có sub-items |
| `backend/src/shared/persistence/CLAUDE.md` | Map liệt kê `shared/CLAUDE.md` nhưng không có sub-items |

**Action cần làm:** Bổ sung 5 files này vào root CLAUDE.md Map (section 9) — sẽ thực hiện trong Phase 1b.

---

## 4. Kế hoạch audit theo Phase

| Phase | Files | Modules/Areas | Độ phức tạp |
|---|---|---|---|
| **1b** | 10 | Root CLAUDE.md + shared infra (shared/, services/, middlewares/, utils/, config/, jobs/, locales/) | HIGH |
| **1c** | 4 | auth, users, catalog, cart | HIGH |
| **1d** | 4 | orders, payment, inventory, reviews | CRITICAL |
| **1e** | 5 | ai, admin, discount-code, content, wishlist | CRITICAL |
| **1f** | 5 | upload, image, attribute, search-history + constants | MEDIUM |
| **1g** | 27 | Tất cả frontend CLAUDE.md files | MEDIUM |
| **1h** | 71 | Cross-file consistency + link verification | HIGH |
| **1i** | N/A | Bổ sung CLAUDE.md cho modules thiếu (nếu có) | MEDIUM |
| **1j** | 71 | Verification cuối + tổng kết | HIGH |

---

## 5. Thứ tự ưu tiên

### P0 — Critical (audit cực kỹ)
- `orders` — checkout flow, state machine, inventory coupling
- `payment` — MoMo/VNPay IPN, idempotency, usedCount timing
- `inventory` — SELECT FOR UPDATE, transaction safety
- `ai` — RAG pipeline params (topK, minScore, temperature, TTL, rate limits)

### P1 — High
- `catalog` — COALESCE sort gotcha, 3 mount points
- `auth` — JWT, OAuth Google, OTP
- `discount-code` — usedCount increment timing vs payment type

### P2 — Medium
- Shared infrastructure (EventBus, errors, UnitOfWork)
- Frontend features (auth, cart, checkout, orders, payment)

### P3 — Low
- Static/data files (data/, docs/, scripts/)
- Frontend utilities/styles/types
