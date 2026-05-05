# Test Coverage Baseline — Backend

> Snapshot ngày 2026-05-05 (sau Phase 40+41+42.19+44 partial+45 partial).
> Generate lại bằng: `cd backend && npx jest --coverage`.

## Tổng quan

- **Test suites:** 29 PASS / 29 total
- **Tests:** 342 PASS / 342 total (270 integration + 72 unit Phase 44 partial)
- **Test runtime:** ~13 giây
- **Coverage type:** unit (StripeService 12, AdminAuditService 11, VNPayService 11, MoMoService 9, LocationService 6, productHelpers 23) + integration (HTTP supertest 270)

## Coverage by category

| Category | Stmts | Branch | Funcs | Lines | Note |
|---|---|---|---|---|---|
| **All files** | 30.01% | 20.15% | 25.40% | 30.53% | Sau Phase 44 partial round 3 (6 unit suites) |
| `validators/` | 100% | 100% | 100% | 100% | ✓ Joi schemas full coverage |
| `routes/` | 99.19% | 100% | 71.42% | 99.19% | ✓ Excellent route-level integration |
| `middlewares/` | 66.52% | 54.23% | 60.86% | 68.01% | OK — error handler + auth tested |
| `controllers/` | 31.28% | 19.33% | 23.7% | 32.25% | Gap — Phase 44 target |
| `services/ai/` | 28.07% | 19.45% | 26.13% | 29.14% | Gap — RAG pipeline khó test (LLM mock complex) |
| `services/payment/` | **88.74%** | **94.28%** | **81.25%** | **88.74%** | ⬆️⬆️ Phase 44 round 2: Stripe+VNPay+MoMo all covered. Vượt target 70% (Phase 44 plan) |
| `services/` (toàn bộ) | 16.04% | 27.20% | 20.33% | 16.22% | LocationService added; AI submodule (28%) vẫn untested |
| `models/` | 24.21% | 0% | 5% | 25.55% | Hooks chưa test riêng — chạy qua integration |
| `utils/` | **42.75%** | **43.18%** | **53.33%** | **42.40%** | ⬆️ +9% từ productHelpers unit tests (23 tests, pure func coverage) |

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

## Phase 44 partial — pattern unit test với SDK mock

Tham khảo 2 file mới để viết unit test cho service layer:

### 1. `__tests__/stripeService.unit.test.js` (12 tests)
Pattern: mock `stripe` SDK module + test StripeService methods directly.

```js
// Set env trước require
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy';

// Mock SDK
const mockStripeSdk = {
  paymentIntents: { create: jest.fn(), ... },
  webhooks: { constructEvent: jest.fn() },
  // ...
};
jest.mock('stripe', () => jest.fn(() => mockStripeSdk));

// Mock logger
jest.mock('../utils/logger', () => ({ debug: jest.fn(), info: jest.fn(), error: jest.fn() }));

const stripeService = require('../services/payment/stripe');
```

Cover: amount conversion (USD * 100, VND giữ nguyên), error wrap → AppError, signature verify webhook.

### 2. `__tests__/adminAuditService.unit.test.js` (11 tests)
Pattern: mock logger + mock `models` module (lazy require pattern).

```js
const mockLogger = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
jest.mock('../utils/logger', () => mockLogger);

const mockAuditLogCreate = jest.fn().mockResolvedValue({ id: 1 });
jest.mock('../models', () => ({ AuditLog: { create: mockAuditLogCreate } }));

const { AdminAuditService } = require('../services/adminAudit');
```

Cover: logger shape mỗi method, writeToDb async với entity payload đúng, error handling khi DB fail (silent swallow).

**Áp dụng cho future tests:** AI services (mock OpenRouter), VNPay/Momo (mock crypto + HTTP), order service (mock repository).

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
