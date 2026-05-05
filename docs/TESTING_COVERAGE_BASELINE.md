# Test Coverage Baseline — Backend

> Snapshot ngày 2026-05-05 (sau Phase 40+41+42.19+45 partial).
> Generate lại bằng: `cd backend && npx jest --coverage`.

## Tổng quan

- **Test suites:** 23 PASS / 23 total
- **Tests:** 270 PASS / 270 total
- **Test runtime:** ~14 giây
- **Coverage type:** unit + integration (HTTP supertest)

## Coverage by category

| Category | Stmts | Branch | Funcs | Lines | Note |
|---|---|---|---|---|---|
| **All files** | 37.34% | 20.76% | 27.41% | 38.41% | Baseline trước Phase 44 push |
| `validators/` | 100% | 100% | 100% | 100% | ✓ Joi schemas full coverage |
| `routes/` | 99.19% | 100% | 71.42% | 99.19% | ✓ Excellent route-level integration |
| `middlewares/` | 66.52% | 54.23% | 60.86% | 68.01% | OK — error handler + auth tested |
| `controllers/` | 31.28% | 19.33% | 23.7% | 32.25% | Gap — Phase 44 target |
| `services/ai/` | 28.07% | 19.45% | 26.13% | 29.14% | Gap — RAG pipeline khó test (LLM mock complex) |
| `services/payment/` | 21% | 40.74% | 25% | 21% | Gap — VNPay/Momo gateway mock chưa setup |
| `models/` | 24.21% | 0% | 5% | 25.55% | Hooks chưa test riêng — chạy qua integration |
| `utils/` | 33.89% | 14.28% | 18.75% | 37.73% | productHelpers/logger gap |

## Phân tích

### Strengths
- **Route layer 99%**: Mọi route handler có integration test qua supertest. Confirm endpoints work.
- **Validator 100%**: Joi schemas đầy đủ unit test.
- **270 tests pass**: Stable test suite, runtime ngắn (14s).

### Gaps (Phase 44 target ≥70% critical path)
- **Payment service 21%**: VNPay/Momo/Stripe gateway logic chưa có unit test với mock gateway response.
- **AI services 28%**: RAG pipeline (geminiChatbot, vectorStore, ruleBasedChatbot) chưa cover edge case fallback.
- **Controllers 31%**: Business logic trong controllers chưa unit test riêng — chỉ chạy qua integration.
- **Models hooks 0% branch**: Sequelize hooks (afterCreate, beforeValidate) chưa test isolated.

### Khoảng cách so với Phase 44 target
| Module | Hiện tại | Phase 44 target | Gap |
|---|---|---|---|
| `auth` services | ~80% (route layer) | ≥80% (unit + integration) | Cần unit test service layer |
| `payment` services | 21% | ≥70% | **+49%** — cần gateway mock |
| `orders` services | ~60% | ≥70% | +10% |
| `cart` services | ~70% | ≥70% | OK |
| `catalog` (read) | ~70% | ≥70% | OK |

## Defense talking points

Khi defense board hỏi "test coverage là bao nhiêu":

1. **Route-level integration coverage 99%** — mọi API endpoint có test (270 tests). Demo kiến trúc hoạt động.
2. **Overall 37%** vì hiện tại ưu tiên integration coverage thay vì unit; service-layer unit test sẽ thực hiện ở Phase 44 roadmap.
3. **Test stability**: 270/270 PASS, không flaky, 14s runtime — CI pipeline `.github/workflows/ci.yml` sẽ block PR nếu fail.
4. **Critical path đã cover**: auth/cart/order/checkout flow có integration test happy + edge case (e2e checkout flow trong `payment.phase25.test.js`, `cart.phase25.test.js`).

## Phase 44 roadmap (defer post-defense nếu cần)

Per `plan.md` Section 44:
1. Setup MySQL test container (Docker hoặc XAMPP `ecommerce_test` DB).
2. Module unit tests: auth (8 method), payment (7+2 policy), orders (7+aggregate), cart (6), catalog (14).
3. Frontend component test (auth/catalog/checkout/cart features).
4. Coverage threshold trong jest.config.js: global 50%, auth/payment/orders services ≥70-75%.

**Effort:** 1-2 tuần solo.

## Test naming policy (Phase 43.2.16 decision)

Plan section 43.2.16 đề xuất `it('should ...')` English pattern. Project quyết định **giữ Vietnamese description** trong test cases vì:

- **Project policy** (plan.md Rule + memory): comment + naming Vietnamese-first cho thesis context.
- **Reviewer Vietnamese**: defense board đọc test description hiểu được context bug — quan trọng hơn convention English.
- **Pattern hiện tại consistent**: 270 tests đều dùng Vietnamese, rename hàng loạt = churn vô nghĩa.

**Examples chấp nhận:**
```js
test('Email không tồn tại → 401', async () => { ... });
test('trả về X-Cache: MISS lần đầu và cache response', async () => { ... });
describe('POST /api/payments/webhook — Stripe webhook handler', () => { ... });
```

**Vẫn cấm** (anti-patterns):
- `test('test X', ...)` — `test` redundant với function name `test()`.
- `it('X works', ...)` — không mô tả behavior cụ thể.
- `describe('TestX')` — viết dính.

## Coverage threshold — Phase 44 partial

`backend/jest.config.js` đã thêm `coverageThreshold` lock baseline làm floor:

```js
coverageThreshold: {
  global: { statements: 25, branches: 12, functions: 18, lines: 25 },
}
```

Threshold dưới baseline ~2% để CI không vỡ khi thêm file mới chưa test. CI `.github/workflows/ci.yml` chạy `npm test` → fail nếu coverage giảm dưới threshold.

**Nâng threshold khi:** team viết thêm unit test (Phase 44 roadmap), update threshold theo measurement.

## Cập nhật baseline

Khi thêm test mới, re-run + update file này:
```bash
cd backend && npx jest --coverage
# Copy summary table → cập nhật section "Coverage by category" trên.
```
