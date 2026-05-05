# Schema Drift Report — Phase 46.1

> Generated: 2026-05-05T16:10:54.654Z
> Models audited: 39

## Tổng kết

| Loại | Mô tả | Count |
|---|---|---|
| **A** | Model column ∉ DB (INSERT fail) | **0** |
| **B** | Paranoid ∉ deleted_at (SELECT fail) | **0** |
| **C** | DB col ∉ Model (orphan) | **1** |
| **D** | Type mismatch | **0** |

✅ **NO BLOCKING DRIFT** — DB khớp 100% với models (A+B = 0).

## Chi tiết theo model

### ProductCategory (`product_categories`)

**C. DB col ∉ Model (orphan, non-blocking):**
- `id`
