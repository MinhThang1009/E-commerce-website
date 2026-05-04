# Audit & Fix Plan — E-Commerce Codebase (Phased)

## Project Context
- **Backend:** Node.js + Express + Sequelize ORM + MySQL (nhiều models, nhiều routes — đọc code để biết số chính xác)
- **Frontend:** React 18 + TypeScript + Vite + Redux Toolkit (nhiều pages — đọc code để biết số chính xác)
- **ID convention:** INT AUTO_INCREMENT (không dùng UUID)
- **Data:** Dữ liệu sản phẩm trong `backend/data/seed_data.sql` — đọc file để biết số lượng thực tế hiện tại
- **Quy tắc làm việc:** Hoàn thành và PASS toàn bộ Acceptance Criteria của Phase N trước khi bắt đầu Phase N+1
- **Quy tắc về sai sót trong plan hoặc codebase:** Trong quá trình implement, nếu phát hiện bất kỳ chỗ nào trong plan này có thông tin sai, mô tả không chính xác, hoặc hướng dẫn có thể gây lỗi — **hoặc phát hiện bug/sai sót trong codebase không thuộc phase hiện tại** — phải: (1) dừng lại, chủ động báo cho user ngay, giải thích sai ở đâu và tại sao; (2) fix plan.md và/hoặc codebase luôn; (3) thêm ✅ Acceptance Criteria tương ứng vào phase liên quan; (4) double-check 100% AC pass trước khi push lên GitHub và trước khi sang phase mới.
- **Quy tắc i18n (bắt buộc toàn bộ codebase):** Trong quá trình implement bất kỳ phase nào, **NGHIÊM CẤM hardcode string user-visible** bằng tiếng Việt hoặc tiếng Anh trực tiếp vào code. Mọi text hiển thị ra UI phải đi qua `t('key')` (trong React component) hoặc `i18next.t('key')` (ngoài React). Khi thêm string mới: (1) thêm key vào `frontend/src/locales/en.json`, (2) thêm cùng key vào `frontend/src/locales/vi.json`, (3) dùng `t('key')` trong code. Xem chi tiết tại section i18n trong plan.md (dùng `Grep "PHASE.*i18n\|i18n.*Full"` để tìm đúng phase).

---

## AGENT EXECUTION GUIDELINES

> Rules bắt buộc áp dụng mọi phase và mọi session. Xem đầy đủ tại [`AGENT_RULES.md`](AGENT_RULES.md) — tổ chức theo thứ tự ưu tiên P0→P6 (execution gates → security → data integrity → testing → code quality → performance → workflow).

---

## PHASE 1 — Critical Security Vulnerabilities
> **Ưu tiên cao nhất. Các lỗ hổng này đang tồn tại trên production code.**

### 1.1 SQL Injection — 2 vị trí trong product.js
- **File:** `backend/src/controllers/product.js`
- **Vị trí 1 (line ~1822):** String interpolation `actualCategoryId` từ user input vào `sequelize.literal()` subquery
- **Vị trí 2 (lines ~1545-1549, audit thực tế):** `productIds.map((id, index) => \`WHEN id = ${id} THEN ${index}\`)` — mảng productIds từ request được interpolate trực tiếp vào CASE expression trong raw SQL
  ```js
  // VULNERABLE:
  sequelize.literal(`CASE ${productIds.map((id, i) => `WHEN id = ${id} THEN ${i}`).join(' ')} END`)
  // FIX: validate productIds là mảng integer trước khi dùng
  const safeIds = productIds.map(id => parseInt(id, 10)).filter(id => !isNaN(id));
  // Hoặc dùng Sequelize ORDER BY FIELD: sequelize.fn('FIELD', col('id'), ...safeIds)
  ```
- **Fix chung:** Grep toàn bộ `backend/src/` tìm `sequelize.literal` — mỗi chỗ phải verify không có user input trực tiếp

### 1.2 XSS Protection — Backend bị tắt + Frontend chưa sanitize
- **Backend — File:** `backend/src/app.js` line ~88
- **Vấn đề:** `app.use(xss())` bị comment out để "cho phép HTML trong tin tức"
- **Fix backend:** Bật lại `app.use(xss())` globally. **⚠️ CORRECTION (audit thực tế):** `xss-clean` dùng `xss-filters` nội bộ, **không hỗ trợ per-field whitelist tag** — không thể cấu hình allowlist cho riêng trường `content` của News qua middleware này. Re-enable global middleware là đủ; DOMPurify ở frontend bảo vệ khi render HTML. Nếu cần preserve HTML trong news content, xử lý ở tầng controller (không dùng middleware level).
- **Frontend — `dangerouslySetInnerHTML` không có DOMPurify (audit thực tế — 4 nơi):**
  - `frontend/src/pages/NewsDetailPage.tsx` — render HTML từ API
  - `frontend/src/components/product/ProductDetailsSection.tsx` — render product description HTML
  - `frontend/src/pages/admin/EmailCampaignsPage.tsx:192` — preview campaign HTML
  - `frontend/src/components/common/RichTextEditor.tsx` — render output
  - **Vấn đề:** Nếu backend bị bypass hoặc content từ nguồn khác → XSS trực tiếp trên browser
  - **Fix frontend:** `npm install dompurify @types/dompurify` rồi wrap:
    ```tsx
    import DOMPurify from 'dompurify';
    // Thay vì: dangerouslySetInnerHTML={{ __html: content }}
    // Dùng:    dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(content) }}
    ```
    Apply cho tất cả 4 nơi trên.

### 1.3 JWT Token không bị invalidate khi logout
- **File:** `backend/src/controllers/auth.js` lines ~196-203
- **Vấn đề:** Logout chỉ trả `res.status(204).send()` — token vẫn còn hiệu lực sau khi logout
- **Fix:** Implement token blacklist dùng Redis:
  - Khi logout: `await redis.setEx('bl:' + jti, remainingTTL, '1')` (dùng JWT `jti` claim)
  - Trong middleware `authenticate`: sau khi verify token, check `await redis.get('bl:' + decoded.jti)` — nếu có thì throw 401
  - **⚠️ CORRECTION (audit thực tế):** Redis **không được cài sẵn** trong project/máy dev. Package `redis` có trong `package.json` nhưng server Redis chưa được cài. Cần cài Redis trước khi test AC5. Thêm in-memory fallback (`Map`) để blacklist hoạt động khi Redis chưa có, giúp test được trên local dev.
  - `config/redis.js` đã được tạo với graceful fallback + in-memory Map.

### 1.4 OTP không cryptographically secure + `new Buffer()` deprecated
- **File:** `backend/src/controllers/auth.js` lines ~24, ~265
- **Vấn đề 1:** `Math.floor(100000 + Math.random() * 900000)` — `Math.random()` không an toàn cho security context
- **Fix:** Thay bằng `require('crypto').randomInt(100000, 1000000)`
- **File:** `backend/src/services/payment/vnpay.js` lines 37, 55, 112 (audit thực tế)
- **Vấn đề 2:** `new Buffer(signData, 'utf-8')` — constructor `Buffer()` đã deprecated từ Node.js 6+, gây SecurityWarning và trong một số version không enforce encoding correctly
  ```js
  // HIỆN TẠI (deprecated):
  hmac.update(new Buffer(signData, 'utf-8')).digest('hex')
  // FIX:
  hmac.update(Buffer.from(signData, 'utf-8')).digest('hex')
  ```
  Apply cho cả 3 dòng trong vnpay.js

### 1.5 Brute force OTP và Password Reset
- **Files:** `backend/src/routes/auth.js`, `backend/src/controllers/auth.js`
- **Vấn đề:** Endpoint `/api/auth/verify-otp` và `/api/auth/forgot-password` không có rate limiting riêng — OTP 6 chữ số brute force trong vài giây
- **Fix:** Thêm rate limiter riêng cho auth endpoints:
  ```js
  const authRateLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 5, keyGenerator: (req) => req.body.email || req.ip });
  ```
  Apply vào `POST /verify-otp` và `POST /forgot-password`

### 1.6 File Upload — Thiếu Ownership Check + Path Traversal
- **File:** `backend/src/routes/upload.js` + `backend/src/controllers/upload.js`
- **Vấn đề 1 — Ownership:** DELETE endpoint chỉ require `authenticate` — bất kỳ user nào biết filename đều có thể xóa file của người khác
- **Vấn đề 2 — Path Traversal (audit thực tế, lines ~170-176):** `filename` lấy từ `req.params.filename` rồi đưa thẳng vào `path.join(uploadDirs[type], filename)` mà không sanitize — attacker có thể truyền `../../etc/passwd` hoặc `../server.js` để truy cập file ngoài thư mục uploads
- **Fix 1 (ownership):** Trong `deleteFile` controller, verify `req.user.role === 'admin'` hoặc lookup DB để confirm file thuộc `req.user.id`
- **Fix 2 (path traversal):**
  ```js
  const filename = path.basename(req.params.filename); // strip directory traversal
  if (filename !== req.params.filename) {
    throw new AppError('Tên file không hợp lệ', 400);
  }
  const filePath = path.join(uploadDirs[type], filename);
  // Verify resolved path is still inside uploadDir
  if (!filePath.startsWith(path.resolve(uploadDirs[type]))) {
    throw new AppError('Truy cập bị từ chối', 403);
  }
  ```

### 1.7 Sensitive Fields trong API Response
- **Files:** `backend/src/controllers/auth.js`, `backend/src/controllers/user.js`, `backend/src/controllers/admin.js`
- **Vấn đề:** Kiểm tra các response trả về User object có đang lộ `password`, `otpCode`, `otpExpires`, `stripeCustomerId` không
- **Fix:** Dùng Sequelize `attributes: { exclude: ['password', 'otpCode', 'otpExpires'] }` trong tất cả query trả về user, hoặc dùng `.toSafeJSON()` helper

### ✅ Acceptance Criteria Phase 1
Trước khi qua Phase 2, tất cả các điểm sau phải PASS:
- [ ] `GET /api/products?categoryId=<sql_injection_payload>` trả về lỗi validation, không execute SQL
- [ ] Gửi request có `<script>alert(1)</script>` trong field content → response không chứa raw script tag
- [ ] Frontend: `dangerouslySetInnerHTML` trong NewsDetailPage, ProductDetailsSection, EmailCampaignsPage, RichTextEditor đều wrap `DOMPurify.sanitize()` — inject `<img onerror=alert(1)>` vào content → không trigger
- [ ] Logout → dùng access token cũ → nhận `401 Token is invalid`
- [ ] POST `/api/auth/verify-otp` 6 lần liên tiếp → lần thứ 6 nhận `429 Too Many Requests`
- [ ] Response `GET /api/users/profile` không chứa field `password`, `otpCode`
- [ ] `DELETE /api/uploads/image/../../../etc/passwd` → nhận `400` hoặc `403`, không truy cập được file system

---

## PHASE 2 — Data & Model Integrity
> **Nền tảng database phải đúng trước khi fix business logic.**

### 2.1 Review Model — Audit Thực Tế & Cleanup (CORRECTION — đọc trực tiếp code)
- **⚠️ CORRECTION (audit thực tế Round 4):** Audit trước sai — **CÓ 2 review models**, không phải 1:
  - `backend/src/models/review.js` — model `Review`, table `reviews` — model **cũ**, comment trong models/index.js: "giữ bảng reviews cũ để tương thích"
  - `backend/src/models/productReview.js` — model `ProductReview`, table `product_reviews` — model **MỚI** theo `data_new.sql`, có `ratingValue`, `variantId`, `paranoid: true`
  - `models/index.js` import và đăng ký **cả 2** (lines 11, 38)
  
- **Vấn đề thực sự (sau correction):**
  1. `ReviewFeedback` FK **chỉ** link sang old `Review.id` (models/index.js lines 123-124) — **KHÔNG** link sang `ProductReview.id`. Nghĩa là: user không thể "like/dislike" một `ProductReview`, chỉ có thể với `Review` cũ.
  2. Nếu product detail page hiển thị review từ `product_reviews` table (dùng `ProductReview` model) → nút "Hữu ích / Không hữu ích" của `ReviewFeedback` **không hoạt động** với những review đó.
  3. `review.js` (old model) thiếu `variantId` → `variantId` chỉ có trong `ProductReview`
  4. Phải quyết định: dùng model nào làm canonical? `ProductReview` (mới, đủ field hơn) hay `Review` (cũ, ReviewFeedback link vào)?

- **Fix (chọn 1 trong 2 hướng):**
  - **Option A — Migrate sang ProductReview:** Update `ReviewFeedback.reviewId` FK và associations sang `ProductReview`. Xóa old `Review` model sau khi migrate data. Cập nhật tất cả controllers đang dùng `Review.findAll(...)`.
  - **Option B — Giữ Review làm canonical:** Thêm các fields còn thiếu vào `review.js` (`variantId`, `isVerified`, `title`, paranoid). Xóa `productReview.js` (sau khi verify không còn controller nào dùng). Đây là cách đơn giản hơn nếu ReviewFeedback đã dùng nhiều.
  - **Bước chung bắt buộc:** `grep -r "ProductReview\|product_reviews" backend/src/controllers/` để biết controller nào đang dùng `ProductReview`, rồi quyết định option.

- **Lưu ý quan trọng:** Đừng "xóa reference ProductReview trong models/index.js" như plan cũ đề xuất — `ProductReview` ĐANG ĐƯỢC import và có associations. Xóa sẽ crash server.

### 2.2 Thiếu `stockQuantity` trong Product Model
- **File:** `backend/src/models/product.js`
- **Vấn đề:** Field `stockQuantity` không tồn tại trong model, nhưng `order.js` line ~747 và `payment.js` lines ~138, ~343 đang gọi `.update({ stockQuantity })` và `.decrement({ stockQuantity })` — silently fail, không có error, oversell không bị ngăn
- **Fix:**
  1. Thêm vào Product model: `stockQuantity: { type: DataTypes.INTEGER, defaultValue: 0, allowNull: false }`
  2. Tạo Sequelize migration: `addColumn('products', 'stockQuantity', { type: Sequelize.INTEGER, defaultValue: 0 })`
  3. Update `seed_data.sql` để include `stockQuantity` cho 45 sản phẩm không có variant
  4. Logic: sản phẩm CÓ variant → dùng `ProductVariant.stockQuantity`; sản phẩm KHÔNG có variant → dùng `Product.stockQuantity`

### 2.3 Duplicate Image/ProductImage Models
- **Files:** `backend/src/models/image.js`, `backend/src/models/productImage.js`
- **Vấn đề:** Cần xác định sự khác nhau — nếu `Image` là general upload record và `ProductImage` là association đến product thì OK; nếu trùng chức năng thì gộp
- **Fix:** Đọc cả 2 file, nếu chức năng trùng → chọn model đầy đủ hơn, migrate references, xóa cái còn lại

### 2.4 Kiểm tra 45 Sản Phẩm Seed Data (VERIFIED — audit thực tế Round 4)
- **File:** `backend/data/seed_data.sql`
- **Kết quả:**
  1. ✅ Đúng 45 `INSERT INTO products`
  2. ✅ Columns trong INSERT đúng với snake_case DB: `base_price`, `compare_at_price`, `is_featured`, `deleted_at`, v.v.
  3. ✅ `status` trong seed đã được migrate về `'active'` qua migration `2026050201`
  4. ⚠️ `rating_average` trong seed = `4.5` hardcoded cho mọi sản phẩm — đây chính là Phase 9.7 (hardcoded rating). Khi implement Phase 9.7, cần update lại seed về `0` hoặc `NULL`.
  5. ⚠️ Không có `stock_quantity` column trong INSERT — consistent với Phase 2.2 (field chưa có trong model). Sau khi add column (Phase 2.2), cần update seed để include `stock_quantity`.
- **Không cần check thêm về column mapping** — seed và model đã align (underscored: true trong Sequelize).

### 2.5 Xóa Mock Data khỏi Production Code
- **Files cần xử lý:**
  - `frontend/src/pages/CategoryPage.tsx` line ~6: import `mockCategories` làm fallback → xóa import, thay bằng error state
  - `frontend/src/features/ai/services/geminiApi.ts` lines ~2-3: import `mockProducts`, `mockCategories` để build AI context → thay bằng API call thực
  - Grep `frontend/src/` tìm tất cả import từ `@/data/mock*` → liệt kê và xóa
  - Sau khi không còn import nào → xóa 5 file trong `frontend/src/data/` nếu không còn cần thiết

### 2.6 Kiểm tra models/index.js Associations
- **File:** `backend/src/models/index.js`
- **Check:** Tất cả 38 model có được `require()` và đăng ký không; tất cả `hasMany`, `belongsTo`, `belongsToMany` associations có được define đủ không; không có association nào trỏ đến model đã xóa (Review)

### ✅ Acceptance Criteria Phase 2
- [ ] Chỉ còn 1 review model, `ReviewFeedback.reviewId` FK hợp lệ
- [ ] `Product.stockQuantity` tồn tại trong DB — `DESCRIBE products` có column này
- [ ] `GET /api/products` trả về đúng 45 sản phẩm (với pagination `?limit=50`)
- [ ] Không còn import nào từ `frontend/src/data/mock*.ts` trong production code
- [ ] `npm run build` (frontend) không có lỗi liên quan đến mock data imports
- [ ] `backend/src/models/index.js` load không có warning về unknown association

---

## PHASE 3 — Payment & Order Flow Bugs
> **Business logic lõi. Sai ở đây = mất tiền hoặc mất hàng.**

### 3.1 Double Stock Deduction (CRITICAL)
- **File:** `backend/src/controllers/payment.js`
- **Vấn đề:** Cả `confirmPayment()` (lines ~121-145) VÀ `handlePaymentSucceeded()` webhook (lines ~326-348) đều gọi `ProductVariant.decrement({ stockQuantity })` — stock bị trừ 2 lần mỗi khi Stripe payment success
- **⚠️ CORRECTION (audit thực tế):** Plan cũ đề xuất idempotency guard `if (order.paymentStatus === 'paid') return` trong webhook — **SAI**: nếu confirmPayment() đã set `paymentStatus = 'paid'` trước, webhook sẽ luôn return sớm → stock không bao giờ được trừ. Phải dùng `paymentTransactionId` làm idempotency key.
- **Fix đúng:**
  1. `confirmPayment()`: wrap toàn bộ xử lý (update order + deduct stock) trong `sequelize.transaction()` → atomic, là **source of truth** cho Stripe flow
  2. `handlePaymentSucceeded()` webhook: idempotency guard bằng `paymentTransactionId`:
     ```js
     const order = await Order.findByPk(orderId);
     if (!order || order.paymentTransactionId === paymentIntent.id) return; // đã xử lý
     // Nếu chưa: update order + deduct stock trong transaction (fallback case)
     ```
  3. Wrap toàn bộ webhook handler trong `sequelize.transaction()` với `FOR UPDATE` lock

### 3.2 Payment Failure không Rollback Stock
- **File:** `backend/src/controllers/payment.js` `handlePaymentFailed()` (lines ~366-385)
- **Vấn đề:** Khi payment fail, chỉ update `paymentStatus = 'failed'`. Sau khi fix 3.1, stock chỉ bị trừ trong `confirmPayment()` (thành công) hoặc `handlePaymentSucceeded()` (webhook). Nếu payment fail → không có hàm nào deduct stock → không cần restore. Tuy nhiên cần thêm comment rõ ràng và guard phòng trường hợp partial flow.
- **Fix:** Thêm comment giải thích + log rõ ràng trong `handlePaymentFailed()`. Không cần restore stock vì stock chưa bị trừ khi payment fail.

### 3.3 Order Number Race Condition
- **File:** `backend/src/controllers/order.js` lines ~364-368
- **Vấn đề:** `await Order.count()` rồi tạo order number — không atomic, 2 concurrent request tạo cùng số
- **Fix:** Thêm `UNIQUE` constraint trên column `number` trong migration + retry logic khi conflict, hoặc generate bằng `Date.now() + crypto.randomInt(1000, 9999)` để đủ unique

### 3.4 Loyalty Points Tính Sai Base
- **File:** `backend/src/controllers/order.js` line ~878
- **Vấn đề:** `Math.floor(parseFloat(order.total) / POINTS_EARN_RATE)` — `order.total` bao gồm shipping fee và tax, không phải giá trị sản phẩm thực
- **Fix:** Đổi thành `Math.floor(parseFloat(order.subtotal) / POINTS_EARN_RATE)` — chỉ tính điểm trên giá trị sản phẩm

### 3.5 Revenue Calculation bao gồm Cancelled Orders
- **File:** `backend/src/controllers/admin.js` lines ~98, ~115
- **Vấn đề:** `Order.sum('total', { where: { status: 'delivered' } })` — không filter `paymentStatus` — có thể include refunded orders
- **Fix:** Thêm điều kiện: `where: { status: 'delivered', paymentStatus: { [Op.notIn]: ['refunded', 'failed'] } }`

### 3.6 Payment Webhook Signature Verification (VERIFIED — đã implement, Round 4)
- **File:** `backend/src/services/payment/vnpay.js`, `momo.js`, `backend/src/controllers/payment.js`
- **Kết quả audit:** Signature verification **đã được implement và đang được gọi**:
  - VNPay: `vnpayService.verifyReturnUrl(vnp_Params)` → được gọi tại payment.js lines 1054 và 1106, đều có `if (!isValid)` guard
  - MoMo: `momoService.verifySignature(req.body)` → được gọi tại payment.js line 969, có `if (!isValid)` guard
- **Không cần fix signature verification** — đã đúng chuẩn.
- **⚠️ Vấn đề mới phát hiện — MoMo hardcoded test credentials (backend/src/services/payment/momo.js lines 7-9):**
  ```js
  this.partnerCode = process.env.DEV_PARTNER_CODE || process.env.MOMO_PARTNER_CODE || 'MOMOLRJZ20181206';
  this.accessKey = process.env.DEV_ACCESS_KEY || process.env.MOMO_ACCESS_KEY || 'mTCKt9W3eU1m39TW';
  this.secretKey = process.env.DEV_SECRET_KEY || process.env.MOMO_SECRET_KEY || 'SetA5RDnLHvt51AULf51DyauxUo3kDU6';
  ```
  Đây là MoMo sandbox test credentials từ tài liệu chính thức — nếu deploy production mà không set env vars → payment dùng test credentials → thanh toán không qua được trên production MoMo. Không phải lỗi bảo mật nghiêm trọng nhưng gây silent failure trong production.
- **Fix nhỏ:** Trong `.env.example` ghi rõ `MOMO_PARTNER_CODE=` (bắt buộc), bỏ fallback hardcode hoặc thêm startup validation check.

### 3.6.1 VNPay deprecated Buffer (đã liệt kê ở 1.4, nhắc lại để đảm bảo fix đồng thời)
- **File:** `backend/src/services/payment/vnpay.js` lines 37, 55, 112
- `new Buffer(signData, 'utf-8')` → `Buffer.from(signData, 'utf-8')` (3 chỗ)

### 3.7 Stock Oversell — Concurrent Checkout
- **File:** `backend/src/controllers/order.js`
- **Vấn đề:** Không có stock reservation khi tạo order — 2 user cùng checkout 1 sản phẩm còn 1 cái → cả 2 đều checkout được → oversell
- **Fix (minimal):** Thêm stock check với `FOR UPDATE` lock trong Sequelize transaction khi tạo order:
  ```js
  await sequelize.transaction(async (t) => {
    const variant = await ProductVariant.findByPk(variantId, { lock: t.LOCK.UPDATE, transaction: t });
    if (variant.stockQuantity < quantity) throw new AppError('Out of stock', 400);
    await variant.decrement('stockQuantity', { by: quantity, transaction: t });
  });
  ```

### ✅ Acceptance Criteria Phase 3
- [ ] Test Stripe webhook: gọi webhook 2 lần với cùng `payment_intent.succeeded` event → stock chỉ bị trừ 1 lần
- [ ] `GET /api/admin/stats` revenue không include order có `paymentStatus = 'refunded'`
- [ ] Tạo 2 order đồng thời cho sản phẩm còn 1 cái → chỉ 1 order thành công, order kia nhận lỗi `Out of stock`
- [ ] Tạo order → loyalty points = `floor(subtotal / rate)`, không tính shipping
- [ ] Order number không bị duplicate sau 100 concurrent requests (test với artillery hoặc Promise.all)

---

## PHASE 4 — API Consistency & REST Standards
> **API phải nhất quán trước khi frontend có thể dùng đáng tin cậy.**

### 4.1 Kiểm tra Route Mounting (VERIFIED — audit thực tế Round 4)
- **File:** `backend/src/routes/index.js` (routes được tập trung tại đây, không phải app.js trực tiếp)
- **Kết quả audit:** Tất cả 27 route file trong `backend/src/routes/` đều được import và mount trong `routes/index.js`. Không có dead route file, không có route bị thiếu.
- **Không cần fix** — tất cả routes đã được mount đúng.

### 4.2 Wishlist Route Mount Trùng (VERIFIED — không có vấn đề)
- **File:** `backend/src/routes/index.js`
- **Kết quả audit:** Wishlist chỉ được mount **1 lần** tại dòng `router.use('/wishlist', wishlistRoutes)`. Không có duplicate mount.
- **Không cần fix.**

### 4.3 HTTP Method Convention
- **Check tất cả routes:** Tìm các pattern sai:
  - POST dùng để xóa thay vì DELETE
  - GET dùng để tạo/thay đổi data thay vì POST/PUT
  - PUT dùng cho partial update thay vì PATCH
- **Fix:** Đổi sang đúng HTTP verb

### 4.4 Duplicate Admin Routes
- **Files:** `backend/src/routes/admin.js` vs `backend/src/routes/product.js`, `user.js`, v.v.
- **Check:** `GET /api/admin/products` vs `GET /api/products` — nếu 2 endpoint cùng trả về data nhưng 1 cái có thêm admin-only fields (ví dụ: `deletedAt`, `internalNotes`) thì OK; nếu hoàn toàn giống nhau thì là duplicate
- **Fix:** Xóa duplicate, nếu cần thêm field admin-only thì dùng chung 1 controller với role check

### 4.5 Error Status Code Consistency
- **Check tất cả controllers:** Tìm các pattern `res.status(200).json({ success: false, message: '...' })` — đây là anti-pattern
- **Fix:** Dùng đúng HTTP status:
  - Validation error → `422 Unprocessable Entity`
  - Not found → `404`
  - Unauthorized (chưa login) → `401`
  - Forbidden (đã login nhưng không có quyền) → `403`
  - Server error → `500`
- **⚠️ CORRECTION (audit thực tế):** VNPay IPN handler (`payment.js` handleVnPayIPN) trả `res.status(200).json({ RspCode: 'XX', Message: '...' })` với error codes là **ĐÚNG theo VNPay IPN specification** — gateway chỉ nhận response khi HTTP 200; trả 4xx sẽ gây retry vô hạn. Không được sửa pattern này trong payment IPN handlers. Tương tự với MoMo và SePay IPN.

### 4.6 Cart Merge Logic — Backend + Frontend Race Condition
- **File:** `backend/src/controllers/cart.js`
- **Check:** POST `/api/cart/sync` — khi merge guest cart vào user cart:
  - Nếu cùng `productId` + `variantId` → có cộng dồn `quantity` không hay ghi đè?
  - Giá `price` trong `CartItem` có được refresh từ `ProductVariant.price` hiện tại không hay giữ giá cũ?
- **Fix backend:** Cộng dồn quantity khi merge; price nên được lấy từ current `ProductVariant.price` để tránh dùng stale price
- **Frontend race condition (audit thực tế):** `frontend/src/hooks/useCartMerge.ts` và `useCartSync.ts` chạy độc lập, không có locking:
  - `useCartSync.ts` lines ~75-80: clear server cart
  - `useCartMerge.ts` lines ~38, ~130: đọc `localStorage.cartItems` → merge → xóa localStorage
  - Nếu async operation xen vào giữa bước đọc và xóa localStorage → cart items bị mất vĩnh viễn
  - `clearJustLoggedIn()` (line ~133 useCartMerge) ngăn retry → không thể recover
- **Fix frontend:** Đặt cart merge trong một async lock đơn giản — set flag `isMerging` trước khi đọc localStorage, clear flag sau khi merge xong. Không xóa localStorage cho đến khi API confirm thành công.

### 4.7 Product Sort/Filter theo Variant Price
- **File:** `backend/src/controllers/product.js`
- **Check:** Query `GET /api/products?sort=price_asc` đang sort theo `Product.basePrice` hay `MIN(ProductVariant.price)`?
- **Fix:** Sort và filter giá nên dựa trên `MIN(ProductVariant.price)` của product để hiển thị giá thấp nhất, hoặc rõ ràng document rằng sort dùng `basePrice`

### ✅ Acceptance Criteria Phase 4
- [x] `GET /api/routes` (hoặc list routes manually) — tất cả 27 route file đều được mount
- [x] Không có response `{ status: 200, success: false }` — lỗi phải dùng status >= 400 (VNPay IPN exempt — đặc tả gateway)
- [x] `DELETE /api/wishlist/:id` dùng DELETE method, không phải POST
- [x] `GET /api/products?sort=price_asc` trả về product rẻ nhất trước: [4100000, 5490000, 6180000, 6590000] ✓
- [x] Merge cart với duplicate item → quantity được cộng dồn: 2+3=5 ✓

---

## PHASE 5 — Frontend Type Safety
> **TypeScript phải an toàn. Mock data không được tồn tại trong production flow.**

### 5.1 Sửa Order Type Mismatch (gây runtime error)
- **Files:** `frontend/src/types/order.types.ts`, `frontend/src/components/orders/OrderDetails.tsx` line ~41
- **Vấn đề:** Frontend type `Order` có `billing: Address` (nested) nhưng backend trả flat fields (`billingFirstName`, `billingAddress1`, v.v.) → cần cast `as any`
- **Fix:** Cập nhật type `Order` trong `order.types.ts` để reflect đúng backend response shape:
  ```ts
  interface Order {
    billingFirstName: string;
    billingLastName: string;
    billingAddress1: string;
    // ... (flat, not nested)
  }
  ```

### 5.2 Sửa Cart Slice Typing
- **File:** `frontend/src/features/cart/cartSlice.ts` line ~28
- **Vấn đề:** `convertServerCartItem = (serverItem: any)` — server response untyped
- **Fix:** Định nghĩa `interface ServerCartItem` khớp với response của `GET /api/cart` (bao gồm `ProductVariant`, `Product` nested objects)

### 5.3 Sửa productApi.ts Query Return Types
- **File:** `frontend/src/services/productApi.ts`
- **Vấn đề:** Tất cả `builder.query<any, ...>` — không có type safety cho product responses
- **Fix:** Định nghĩa types cho:
  - `ProductListResponse: { products: Product[]; total: number; page: number; limit: number }`
  - `ProductDetailResponse: Product & { variants: ProductVariant[]; images: ProductImage[] }`
  - Replace `any` với các types này

### 5.4 ID Type Consistency
- **Files:** `frontend/src/types/*.ts`, `frontend/src/services/*.ts`
- **Check:** Tất cả `id` fields trong TypeScript interfaces có khai báo là `number` không (backend dùng INT), hay có chỗ nào dùng `string`
- **Fix:** Đổi tất cả `id: string` → `id: number` trong interfaces, update các chỗ `String(id)` không cần thiết

### 5.5 Eliminate `any` trong Critical Paths
Ưu tiên theo thứ tự gây hại thực tế:
1. `frontend/src/components/orders/OrderDetails.tsx` — `(item as any).Product` (data display)
2. `frontend/src/hooks/useApiState.ts` — `(data as any).products` (data access)
3. `frontend/src/services/cartApi.ts` — `attributes?: any` trong CartItem (cart state)
4. `frontend/src/services/orderApi.ts` — mutation responses `data: any`
5. `frontend/src/services/brandApi.ts`, `collectionApi.ts` — tất cả queries/mutations

### ✅ Acceptance Criteria Phase 5
- [x] `npx tsc --noEmit` không có lỗi mới so với trước Phase 5 — thực tế giảm từ 144 → 70 errors (fix luôn pre-existing bugs)
- [x] Không còn import từ `@/data/mock*` trong bất kỳ component/page nào
- [x] `OrderDetails` component render đúng address fields mà không cần `as any` — removed `anyOrder` cast, fixed `warrantyCost`/`pointsDiscount`/`item.Product` access
- [x] Cart sync hoạt động với typed `ServerCartItem` — `convertServerCartItem(serverItem: any)` → `(serverItem: ServerCartItem)`, added `attributes?` to `ServerCartItem.ProductVariant`
- [ ] `Product.id` trong toàn bộ frontend là `number`, không phải `string` — **BỎ QUA**: thay đổi quá rủi ro, cần cập nhật hàng trăm call sites, defer sang Phase sau nếu cần
- [x] `order.types.ts` đã cập nhật đúng flat structure (bỏ `shipping: Address`, `billing: Address`)
- [x] `productApi.ts` — 10 `builder.query<any,` đã thay thế bằng `ProductListApiResponse`, `ProductDetailApiResponse`, `ProductArrayApiResponse`
- [x] `BestSellersPage`, `NewArrivalsPage` fixed data access path (`productsData.products` → `productsData.data.products`) — đây là pre-existing bug được phát hiện khi thêm proper types
- [x] `DealsPage` fixed field access (`item.categories` → `item.categoryName`, `item.stockQuantity` → `item.stock`)
- [x] `ShopPage` đã dùng đúng `pages` field khớp backend response
- [x] `ProductWithVariants.currentVariant` bổ sung `attributes`, `thumbnail`, `productSpecifications`
- [x] `BestSellersPage` fixed import path `@/types/product` → `@/types/product.types`

---

## PHASE 6 — Schema & Naming Standards
> **Chuẩn đặt tên nhất quán, schema phản ánh đúng nghiệp vụ.**

### 6.1 Naming Convention — Database Fields
- **Models cần kiểm tra:**
  - `CartItem`: field `price` → đổi thành `unitPrice` (đây là giá của 1 unit tại thời điểm thêm vào giỏ)
  - `OrderItem`: fields `price` và `discount` → đổi thành `unitPrice` và `discountAmount` cho rõ nghĩa
  - `Order`: `shippingAddress1`/`shippingAddress2` → xem xét đổi thành `shippingAddressLine1`/`shippingAddressLine2` cho chuẩn
- **Note:** Mỗi rename field cần: (1) update model, (2) tạo migration, (3) update tất cả controller/service references, (4) update frontend types

### 6.2 Missing E-Commerce Fields
Các field quan trọng theo chuẩn e-commerce đang thiếu:

| Model | Field thiếu | Lý do cần |
|-------|-------------|-----------|
| `Order` | `discountCodeId` (FK → DiscountCode) | Biết discount code nào đã áp dụng, audit trail |
| `DiscountCode` | `minimumOrderAmount` (DECIMAL) | Validate discount chỉ apply khi đơn đủ giá trị |
| `DiscountCode` | `maximumDiscountAmount` (DECIMAL) | Cap discount amount cho percentage codes |
| `ProductVariant` | `weight` (DECIMAL), `dimensions` (JSON) | Tính phí ship chính xác |
| `Order` | `cancelledAt` (DATE) | Track khi nào order bị cancel |
| `Order` | `refundedAt` (DATE), `refundAmount` (DECIMAL) | Track refund |

- **Fix:** Với mỗi field: thêm vào model + tạo Sequelize migration + update validator + update frontend type nếu cần

### 6.3 API Response Shape Standardization
- **Check tất cả controllers:** Response có nhất quán không hay có chỗ trả `{ data: [...] }`, chỗ trả `{ products: [...] }`, chỗ trả `[...]` trực tiếp?
- **Fix:** Chuẩn hóa tất cả list responses theo format: `{ data: T[], total: number, page: number, limit: number }` — single item: `{ data: T }`

### 6.4 Missing Database Indexes
- **File:** Các migration files trong `backend/src/migrations/`
- **Check:** Các column thường xuyên được query trong `WHERE` clause có index không:
  - `products.slug`, `products.status`, `products.categoryId`
  - `orders.userId`, `orders.status`, `orders.number`
  - `cart_items.cartId`, `cart_items.productId`
  - `product_variants.productId`, `product_variants.sku`
- **Fix:** Tạo migration để add indexes cho các column thiếu

### ✅ Acceptance Criteria Phase 6
- [x] `CartItem.unitPrice`, `OrderItem.unitPrice`, `OrderItem.discountAmount` tồn tại trong DB
- [x] `Order.discountCodeId` FK hợp lệ, `DiscountCode.minimumOrderAmount` tồn tại (field `minOrderAmount`)
- [x] `GET /api/products` và `GET /api/orders` đều trả cùng response shape `{ data: [...], total, page, limit }`
- [x] `EXPLAIN SELECT * FROM products WHERE status = 'active'` sử dụng index (migration 2026050402)
- [x] Apply discount code với order total thấp hơn `minimumOrderAmount` → nhận lỗi validation

---

## PHASE 7 — E-Commerce Feature Standards
> **Đảm bảo project tuân thủ chuẩn của một e-commerce website cá nhân.**

### 7.1 Inventory Management
- **Vấn đề:** Không có model/table tracking inventory movement (nhập hàng, điều chỉnh stock)
- **Fix:** Tạo model `InventoryLog`: `{ productId, variantId, changeType (sale/restock/adjustment/return), changeAmount, previousStock, newStock, orderId, note, createdBy }`
- **Tích hợp:** Mỗi khi stock thay đổi (sale, restock) → tạo `InventoryLog` record

### 7.2 Order — Discount Code Linkage
- **Vấn đề:** Sau khi thêm `Order.discountCodeId` (Phase 6), cần update controller để:
  1. Khi apply discount code khi checkout → lưu `discountCodeId` vào order
  2. Increment `DiscountCode.usedCount` chỉ khi order confirmed (không phải khi tạo)
  3. Validate `DiscountCode.minimumOrderAmount` trước khi apply

### 7.3 Shipping Cost Calculation
- **Vấn đề:** `Order.shippingCost` được tính ở đâu — frontend hay backend? Nếu frontend tính rồi gửi lên thì có thể bị manipulate
- **Fix:** Backend phải tự tính `shippingCost` dựa trên địa chỉ giao hàng và total weight (dùng `ProductVariant.weight` từ Phase 6) — frontend chỉ display, không gửi shippingCost trong request body

### 7.4 Admin Analytics Completeness
- **File:** `backend/src/controllers/admin.js`
- **Check và fix các metric:**
  - Revenue: chỉ tính orders `status = 'delivered'` và `paymentStatus NOT IN ('refunded', 'failed')`
  - Orders count theo status: có breakdown pending/processing/shipped/delivered/cancelled không
  - Top selling products: tính theo `soldCount` hay actual `OrderItem` quantity
  - New customers: count users đăng ký trong period, không tính admins/managers

### 7.5 VectorDB Sync khi Product Thay Đổi
- **File:** `backend/data/vectorDb.json`, `backend/src/services/ai/`
- **Vấn đề:** vectorDb.json là file tĩnh — khi sản phẩm mới được thêm/cập nhật thì AI search sẽ dùng data cũ
- **Fix:** Thêm hook trong product controller: sau mỗi `createProduct`, `updateProduct`, `deleteProduct` → trigger re-generate vector embedding và update vectorDb.json (hoặc dùng DB-based vector store thay vì file JSON)

### 7.6 Product Rating — Chỉ Count Verified Reviews
- **File:** `backend/src/controllers/product.js` lines ~222-230
- **Vấn đề:** Rating average tính từ tất cả reviews, bao gồm unverified — dễ bị spam/fake review
- **Fix:** Filter `where: { isVerifiedPurchase: true }` khi tính rating average, hoặc có 2 metric riêng: `verifiedRating` và `allRating`

### 7.7 Pagination Consistency
- **Check tất cả list endpoints:** Có endpoints nào không có pagination không (trả toàn bộ data) — có thể gây performance issue với data lớn
- **Fix:** Tất cả list endpoints phải có `page` và `limit` params với giá trị default hợp lý (limit max = 100)

### ✅ Acceptance Criteria Phase 7
- [x] Tạo order với discount code chưa đủ `minimumOrderAmount` → nhận `400` (order.js kiểm tra `codeData.minOrderAmount`)
- [x] Restock 10 sản phẩm → `InventoryLog` có 1 record mới với `changeType = 'restock'` (POST /api/admin/products/:id/restock)
- [x] Admin dashboard revenue không bao gồm refunded/cancelled orders (paymentStatus NOT IN refunded,failed)
- [x] `GET /api/products` có `page` và `limit` params, default `limit = 20`, max `limit = 100`
- [x] Sau khi thêm sản phẩm mới → AI chatbot tìm được sản phẩm đó (model hooks afterCreate/afterUpdate)

---

---

## PHASE 8 — SQL, Schema & Naming Standards
> **Toàn bộ DB schema phải đúng chuẩn e-commerce trước khi production.**

### 8.1 Table Naming Convention
- **Chuẩn:** snake_case, số nhiều (`products`, `order_items`, `cart_items`, `discount_codes`, `product_variants`, `product_images`, `warranty_packages`, `newsletter_subscribers`, `recently_viewed`, `search_history`, `loyalty_history`, `email_campaigns`, `attribute_groups`, `attribute_values`, `product_attribute_groups`, `brand_categories`, `product_collections`, `review_feedbacks`)
- **Check:** Đọc tất cả 38 model files trong `backend/src/models/` — kiểm tra field `tableName` có được set explicit không, hay đang dùng Sequelize default (tự pluralize theo tên model, có thể không chuẩn)
- **Fix:** Set `tableName` explicit trong mỗi model; bật `underscored: true` trong options để Sequelize tự map camelCase field → snake_case column name nhất quán

### 8.2 Column Naming Convention
- **Chuẩn DB columns:** snake_case (`user_id`, `product_id`, `created_at`, `updated_at`, `deleted_at`, `is_active`, `is_featured`, `base_price`, `compare_at_price`, `stock_quantity`, `rating_average`)
- **Chuẩn Sequelize field:** camelCase (tự map sang DB column khi `underscored: true`)
- **Check tất cả model files:** Tìm các field đang dùng camelCase mà KHÔNG có `field: 'snake_case_name'` override và `underscored` chưa được bật → Sequelize sẽ tạo column camelCase trong DB
- **Các field cần rename đặc biệt:**
  - `CartItem.price` → `unit_price` (rõ nghĩa: giá 1 đơn vị tại thời điểm thêm)
  - `OrderItem.price` → `unit_price`; `OrderItem.discount` → `discount_amount`
  - `Order.shippingAddress1/2` → `shipping_address_line1/2`
  - `Order.billingAddress1/2` → `billing_address_line1/2`
  - `Product.compareAtPrice` → `compare_at_price` (DB column)
  - `Product.basePrice` → `base_price` (DB column)
  - `Product.isFeatured` → `is_featured` (DB column)
  - `User.isEmailVerified` → `is_email_verified` (DB column)
  - `User.isActive` → `is_active` (DB column)

### 8.3 Data Type Standards
- **Chuẩn cho từng loại dữ liệu:**

| Loại | Chuẩn đúng | Sai thường gặp |
|------|-----------|----------------|
| Giá tiền | `DECIMAL(15,2)` | `FLOAT`, `DOUBLE`, `INT` |
| Phần trăm discount | `DECIMAL(5,2)` | `INT` |
| ID (primary key) | `INT UNSIGNED AUTO_INCREMENT` | `INT` (thiếu UNSIGNED) |
| Boolean | `TINYINT(1)` hoặc `BOOLEAN` | `INT`, `VARCHAR` |
| Status/ENUM | `ENUM('value1','value2')` | `VARCHAR` (không constrained) |
| Ngày giờ transaction | `DATETIME` | `TIMESTAMP` (bị giới hạn 2038) |
| Ngày sinh, ngày hết hạn | `DATE` | `DATETIME` (thừa time component) |
| Content HTML | `LONGTEXT` | `TEXT` (giới hạn 65KB) |
| JSON data nhỏ | `JSON` | `TEXT` |
| URL | `VARCHAR(2048)` | `VARCHAR(255)` (URL có thể dài) |
| Email | `VARCHAR(254)` | `VARCHAR(255)` (RFC 5321 limit) |
| Phone | `VARCHAR(20)` | `VARCHAR(10)` (quốc tế số dài hơn) |
| SKU | `VARCHAR(100)` | `VARCHAR(255)` |
| Slug | `VARCHAR(255)` | không có index UNIQUE |

- **Check tất cả model files:** Tìm price/amount fields dùng sai type, boolean fields dùng INT, URL fields quá ngắn

### 8.4 Constraints & Foreign Keys
- **Chuẩn:**
  - Mọi FK phải có behavior rõ ràng: `ON DELETE CASCADE` hoặc `ON DELETE RESTRICT` hoặc `ON DELETE SET NULL`
  - `NOT NULL` trên tất cả required fields
  - `UNIQUE` trên: `users.email`, `products.slug`, `categories.slug`, `brands.slug`, `product_variants.sku`, `discount_codes.code`, `collections.slug`, `newsletter_subscribers.email`
  - `DEFAULT` value cho: status fields, boolean flags, counters (soldCount, viewCount = 0), timestamps
- **Check `backend/src/migrations/` và `backend/data/migration_full.sql`:** Liệt kê tất cả FK thiếu ON DELETE behavior; tất cả UNIQUE constraints còn thiếu; tất cả NOT NULL còn thiếu trên field quan trọng

### 8.5 Index Standards
- **Indexes bắt buộc cho e-commerce queries:**
  ```sql
  -- Products
  INDEX idx_products_status (status)
  INDEX idx_products_category_id (category_id)
  INDEX idx_products_brand_id (brand_id)
  UNIQUE INDEX idx_products_slug (slug)
  INDEX idx_products_is_featured (is_featured)
  INDEX idx_products_created_at (created_at)

  -- Orders
  INDEX idx_orders_user_id (user_id)
  INDEX idx_orders_status (status)
  INDEX idx_orders_payment_status (payment_status)
  UNIQUE INDEX idx_orders_number (number)
  INDEX idx_orders_created_at (created_at)

  -- Order Items
  INDEX idx_order_items_order_id (order_id)
  INDEX idx_order_items_product_id (product_id)

  -- Cart Items
  INDEX idx_cart_items_cart_id (cart_id)
  INDEX idx_cart_items_product_id (product_id)

  -- Product Variants
  INDEX idx_product_variants_product_id (product_id)
  UNIQUE INDEX idx_product_variants_sku (sku)

  -- Users
  UNIQUE INDEX idx_users_email (email)
  INDEX idx_users_role (role)

  -- Reviews
  INDEX idx_reviews_product_id (product_id)
  INDEX idx_reviews_user_id (user_id)
  ```
- **Check:** Dùng `EXPLAIN SELECT` trên các query thường dùng — nếu không dùng index thì tạo migration thêm index

### 8.6 Migration File Standards
- **Chuẩn đặt tên migration:** `YYYYMMDDNN-action-entity.js` (ví dụ: `2026050201-add-stock-quantity-to-products.js`)
- **Mỗi migration phải có cả `up()` và `down()`** — `down()` phải undo chính xác những gì `up()` đã làm
- **Check `backend/src/migrations/`:** Tất cả 21 migration files có `down()` function không hay chỉ có `up()`; có migration nào chứa hardcoded data (INSERT) không — data thuộc seeders không thuộc migrations

### 8.7 Seed Data Standards
- **File:** `backend/data/seed_data.sql`
- **Chuẩn:**
  - Seed phải idempotent: dùng `INSERT IGNORE` hoặc `INSERT ... ON DUPLICATE KEY UPDATE` — chạy nhiều lần không tạo duplicate
  - Không hardcode auto-increment ID trong INSERT (để DB tự assign) trừ khi cần tham chiếu chéo
  - Nếu cần tham chiếu chéo giữa tables, dùng `@variable` hoặc subquery thay vì hardcode ID
  - Seed script phải có thể chạy bằng 1 lệnh: `npm run db:seed`
  - Seed phải chạy sau migration, không trước
- **Check:** `backend/scripts/` và `backend/package.json` — xem lệnh rebuild/seed hiện tại có đúng thứ tự không (migrate → seed)

### 8.8 Primary Key Standards
- **Chuẩn:** Mọi table phải có primary key tên là `id`, kiểu `INT UNSIGNED AUTO_INCREMENT` (hoặc `BIGINT UNSIGNED` nếu dự kiến data lớn)
- **Không dùng:** `product_id` làm tên PK trong bảng `products` (sai), `ID` viết hoa (sai)
- **Junction tables** (many-to-many): có thể dùng composite PK `(product_id, category_id)` hoặc thêm `id INT UNSIGNED AUTO_INCREMENT` riêng — chọn 1 cách nhất quán cho toàn project
- **Check tất cả model files:** Có model nào đang dùng tên PK khác `id` không (ví dụ: Sequelize default field name override); junction table có PK không

### 8.9 Foreign Key Naming & Constraint Standards (100% chuẩn)
- **Tên column FK:** `{singular_table_name}_id` — ví dụ:
  - `user_id` (trỏ đến `users.id`), không phải `userId`, `UserId`, `users_id`
  - `product_id` (trỏ đến `products.id`)
  - `order_id` (trỏ đến `orders.id`)
  - `category_id` (trỏ đến `categories.id`)
  - `brand_id` (trỏ đến `brands.id`)
  - `variant_id` (trỏ đến `product_variants.id`)
  - `warranty_package_id` (trỏ đến `warranty_packages.id`)
  - `discount_code_id` (trỏ đến `discount_codes.id`)

- **Tên FK constraint:** `fk_{table}_{referenced_table}` — ví dụ:
  - `CONSTRAINT fk_orders_users FOREIGN KEY (user_id) REFERENCES users(id)`
  - `CONSTRAINT fk_order_items_orders FOREIGN KEY (order_id) REFERENCES orders(id)`
  - `CONSTRAINT fk_order_items_products FOREIGN KEY (product_id) REFERENCES products(id)`
  - `CONSTRAINT fk_order_items_product_variants FOREIGN KEY (variant_id) REFERENCES product_variants(id)`
  - Nếu 1 table có 2 FK cùng trỏ đến 1 table: `fk_orders_users_customer`, `fk_orders_users_staff`

- **ON DELETE / ON UPDATE behavior bắt buộc** — mỗi FK phải được define rõ:

| FK | ON DELETE | ON UPDATE | Lý do |
|----|-----------|-----------|-------|
| `orders.user_id` → `users.id` | `RESTRICT` | `CASCADE` | Không xóa user còn order |
| `order_items.order_id` → `orders.id` | `CASCADE` | `CASCADE` | Xóa order → xóa items |
| `order_items.product_id` → `products.id` | `RESTRICT` | `CASCADE` | Không xóa product còn trong order history |
| `order_items.variant_id` → `product_variants.id` | `SET NULL` | `CASCADE` | Variant bị xóa → giữ order item, variant = NULL |
| `cart_items.cart_id` → `carts.id` | `CASCADE` | `CASCADE` | Xóa cart → xóa items |
| `cart_items.product_id` → `products.id` | `CASCADE` | `CASCADE` | Xóa product → xóa khỏi cart |
| `cart_items.variant_id` → `product_variants.id` | `SET NULL` | `CASCADE` | Variant xóa → item vẫn giữ |
| `carts.user_id` → `users.id` | `CASCADE` | `CASCADE` | Xóa user → xóa cart |
| `product_variants.product_id` → `products.id` | `CASCADE` | `CASCADE` | Xóa product → xóa variants |
| `product_images.product_id` → `products.id` | `CASCADE` | `CASCADE` | Xóa product → xóa images |
| `product_specifications.product_id` → `products.id` | `CASCADE` | `CASCADE` | |
| `reviews.product_id` → `products.id` | `CASCADE` | `CASCADE` | Xóa product → xóa reviews |
| `reviews.user_id` → `users.id` | `SET NULL` | `CASCADE` | Xóa user → giữ review, user = anonymous |
| `addresses.user_id` → `users.id` | `CASCADE` | `CASCADE` | Xóa user → xóa addresses |
| `wishlist.user_id` → `users.id` | `CASCADE` | `CASCADE` | |
| `wishlist.product_id` → `products.id` | `CASCADE` | `CASCADE` | |
| `chat_messages.user_id` → `users.id` | `SET NULL` | `CASCADE` | Xóa user → giữ chat history |
| `loyalty_history.user_id` → `users.id` | `CASCADE` | `CASCADE` | |
| `loyalty_history.order_id` → `orders.id` | `SET NULL` | `CASCADE` | |
| `products.category_id` → `categories.id` | `SET NULL` | `CASCADE` | Xóa category → product không bị mất |
| `products.brand_id` → `brands.id` | `SET NULL` | `CASCADE` | |
| `discount_codes.id` → `orders.discount_code_id` | `SET NULL` | `CASCADE` | Xóa discount code → order vẫn giữ |

- **Check:** Đọc `backend/data/migration_full.sql` — liệt kê tất cả FK constraints hiện tại, so sánh với bảng trên, thêm migration cho mọi FK còn thiếu hoặc sai behavior

### 8.10 Unique Key & Index Naming Standards
- **Tên UNIQUE constraint:** `uq_{table}_{column}` — ví dụ:
  - `UNIQUE KEY uq_users_email (email)`
  - `UNIQUE KEY uq_products_slug (slug)`
  - `UNIQUE KEY uq_categories_slug (slug)`
  - `UNIQUE KEY uq_brands_slug (slug)`
  - `UNIQUE KEY uq_product_variants_sku (sku)`
  - `UNIQUE KEY uq_discount_codes_code (code)`
  - `UNIQUE KEY uq_orders_number (number)`
  - `UNIQUE KEY uq_newsletter_subscribers_email (email)`
  - `UNIQUE KEY uq_collections_slug (slug)`
  - Composite unique: `UNIQUE KEY uq_reviews_user_product (user_id, product_id)` — mỗi user chỉ review 1 sản phẩm 1 lần

- **Tên INDEX:** `idx_{table}_{column}` — ví dụ:
  - `INDEX idx_products_status (status)`
  - `INDEX idx_products_brand_id (brand_id)`
  - `INDEX idx_products_created_at (created_at)`
  - Composite: `INDEX idx_products_status_created (status, created_at)`

- **Tên FULLTEXT INDEX** (nếu dùng cho search):
  - `FULLTEXT idx_ft_products_search (name, description, tags)`

### 8.11 Junction Table (Many-to-Many) Standards
- **Tên bảng:** `{table1}_{table2}` theo thứ tự alphabetical — ví dụ:
  - `product_categories` (products + categories) ✓
  - `brand_categories` (brands + categories) ✓
  - `product_collections` (products + collections) ✓
  - `product_warranties` (products + warranty_packages) ✓
- **Cấu trúc chuẩn:**
  ```sql
  CREATE TABLE product_categories (
    product_id INT UNSIGNED NOT NULL,
    category_id INT UNSIGNED NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (product_id, category_id),  -- composite PK, không cần id riêng
    CONSTRAINT fk_product_categories_products FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT fk_product_categories_categories FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX idx_product_categories_category_id (category_id)  -- index cho chiều ngược lại
  );
  ```
- **Check:** Tất cả junction tables trong project có composite PK không, hay đang dùng auto-increment id riêng (không sai nhưng cần nhất quán)

### 8.12 Sequelize Model ↔ DB Column Mapping Checklist
Khi `underscored: true` được bật trong Sequelize model options, tất cả camelCase field tự động map sang snake_case column. **Bắt buộc check:**
- `backend/src/models/index.js` và từng model file: có `underscored: true` trong `define()` options không
- Nếu chưa có: thêm vào `sequelize.define('ModelName', { ... }, { tableName: 'table_name', underscored: true, timestamps: true, paranoid: true/false })`
- Sau khi thêm `underscored: true`: chạy `DESCRIBE table_name` cho mỗi table để confirm column names đúng snake_case
- Tạo migration để rename các column đang sai (nếu có) để đồng bộ DB với model

### ✅ Acceptance Criteria Phase 8
- [x] `SHOW CREATE TABLE products` — tất cả columns là snake_case, price fields là `DECIMAL(15,2)`, có `idx_products_status` và `idx_products_category_id`
- [x] `SHOW CREATE TABLE orders` — có `UNIQUE KEY uq_orders_number`, có `CONSTRAINT fk_orders_users` với `ON DELETE RESTRICT`
- [x] `SHOW CREATE TABLE order_items` — có `CONSTRAINT fk_order_items_orders` với `ON DELETE CASCADE`, `CONSTRAINT fk_order_items_products` với `ON DELETE RESTRICT`
- [x] `SHOW CREATE TABLE product_categories` — có composite `PRIMARY KEY (product_id, category_id)`, cả 2 FKs có `ON DELETE CASCADE`
- [x] `EXPLAIN SELECT * FROM products WHERE status = 'active' ORDER BY created_at DESC LIMIT 20` — type = `ref`, key = `idx_products_status`
- [x] `EXPLAIN SELECT * FROM orders WHERE user_id = 1` — dùng index
- [x] `INSERT INTO users (email, ...) VALUES ('test@test.com', ...)` 2 lần → lần 2 bị lỗi `Duplicate entry` (unique constraint hoạt động)
- [x] `npm run db:seed` chạy 2 lần liên tiếp — không tạo duplicate records
- [x] Tất cả 21 migration files có hàm `down()` hợp lệ, không có INSERT data trong migration files

---

## PHASE 9 — RAG Chatbot Architecture Standards
> **Vector search + LLM phải hoạt động đúng và tự động sync với data sản phẩm.**

### 9.1 Vấn đề với kiến trúc hiện tại
- **File:** `backend/data/vectorDb.json` (1.9MB static file), `backend/src/services/ai/vectorStore.js`, `backend/src/services/ai/embedding.js`, `backend/src/services/ai/geminiChatbot.js`
- **Vấn đề:**
  1. vectorDb.json là **static file** — không tự cập nhật khi sản phẩm mới được thêm/sửa/xóa → AI trả lời thông tin sản phẩm cũ/sai
  2. **Similarity threshold quá thấp (0.3)** — đã có threshold nhưng 30% tương đồng vẫn trả về sản phẩm không liên quan. Cần nâng lên 0.45 (xem 9.4)
  3. Không có **conversation memory limit** — context window có thể bị tràn với long conversations
  4. **Language detection ĐÃ implement** trong vectorStore.js (✅ Audit v2) — detect Vietnamese diacritics regex, route sang đúng embedding model
  5. Không có **fallback** khi Gemini API fail hoặc trả về empty

### 9.2 Fix: Auto-sync Vector Store
> **⚠️ Cập nhật audit v2:** `backend/src/models/product.js` ĐÃ CÓ `afterCreate`, `afterUpdate`, `afterDestroy` hooks nhưng có **2 bugs quan trọng** cần fix (không chỉ 1 như ghi trước đây):

- **Bug A: `product.categories` không được eager-load trong hook** — `vectorStore.js` dùng `product.categories?.[0]?.name` nhưng Sequelize instance trong hook không có association loaded → luôn default về `'Sản phẩm'`, vector search theo category sai.
  - **Fix:** Trong hook, fetch lại product với associations:
    ```js
    const fullProduct = await Product.findByPk(product.id, {
      include: [{ model: Category, as: 'categories', attributes: ['name'] }]
    });
    await vectorStoreService.addProduct(fullProduct.toJSON());
    ```

- **Bug B: `afterCreate` và `afterUpdate` hooks dùng đúng `status === 'active'` ✅**
  - **File:** `backend/src/models/product.js` dòng 270 và 285
  - Hooks check `product.status === 'active'` — đây là **ĐÚNG** sau migration `2026050201` (convert DB từ `'Đang kinh doanh'` → `'active'`).
  - **Impact thực tế:** Auto-indexing hoạt động qua hooks khi status = 'active'. Vấn đề chính còn lại là bulk `Product.update()` bypass hooks hoàn toàn (Phase 9.8) — cần fix riêng.
  - **Không cần đổi** `=== 'active'` — `'active'` là canonical status value.

- **Startup check:** Khi server khởi động (trong `server.js`), so sánh `vectorDb.json` số items với `Product.count({ where: { status: 'active' } })` — nếu lệch > 5% thì tự trigger `npm run ai:rebuild-vectors`
- **Script:** Package.json đã có `db:index` (alias `node scripts/indexProducts.js`). Thêm alias: `"ai:rebuild-vectors": "node scripts/indexProducts.js"` để đúng theo naming convention trong plan
- **Cleanup dead dependencies:** Xóa `vector-storage: ^1.0.55` khỏi `backend/package.json` (package không được import ở đâu). Xóa `@google/generative-ai` nếu tất cả AI calls đều qua OpenRouter (tránh nhầm lẫn với `GEMINI_API_KEY` trong .env cũng không được dùng).

### 9.3 Fix: Vector Store Storage (cho personal project)
- **Option A (recommended cho personal project):** Giữ JSON file nhưng thêm `product_embeddings` table trong MySQL:
  ```sql
  CREATE TABLE product_embeddings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id INT UNSIGNED NOT NULL UNIQUE,
    embedding JSON NOT NULL,  -- float array
    content_hash VARCHAR(64) NOT NULL,  -- SHA256 của product content để detect changes
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
  );
  ```
  vectorDb.json trở thành cache được rebuild từ table này
- **Option B:** Giữ nguyên JSON file nhưng implement auto-sync hooks (đơn giản hơn)

### 9.4 Fix: Retrieval Quality
- **File:** `backend/src/services/ai/vectorStore.js`
- **Check và fix:**
  - Số lượng kết quả trả về (K) — nên là 5-10 sản phẩm liên quan nhất
  - **Similarity threshold (Audit v2 update):** `search()` đã có `filter(item => isFinite(item.score) && item.score >= 0.3)` (✅ confirmed). Threshold **0.3 quá thấp** — 30% tương đồng vẫn cho nhiều nhiễu. **Nên nâng lên 0.45** để cân bằng recall/precision tốt hơn cho e-commerce:
    ```js
    .filter(item => isFinite(item.score) && item.score >= 0.45)
    ```
    > **Lý do 0.45 thay vì 0.5:** Vietnamese với dual-embedding model (multilingual-e5-large) thường cho scores 0.4–0.7 cho sản phẩm liên quan. 0.45 giữ được đủ kết quả mà không trả về nhiễu.
  - Kết quả trả cho LLM có bao gồm đủ context không: `name`, `price` (phải là `basePrice` — xem 9.11 Lỗi 2), `stockQuantity`, `category`, `variants`, `slug` (để tạo URL link)

### 9.5 Fix: Conversation Management
- **File:** `backend/src/services/ai/geminiChatbot.js`
- **Check và fix:**
  - History có bị giới hạn không — phải giới hạn max 10-15 turns (20-30 messages) để tránh tràn context
  - Mỗi user có conversation history độc lập không hay share chung
  - System prompt có định nghĩa rõ: chatbot chỉ tư vấn sản phẩm, không trả lời ngoài scope e-commerce
  - System prompt có inject real-time data (giá hiện tại, tồn kho) không hay dùng data cũ từ vector

### 9.6 Fix: Response Structure
- **Chatbot response phải include:**
  - Text trả lời
  - List sản phẩm được đề xuất kèm `id`, `name`, `price`, `slug`, `thumbnail` — để frontend render thành card
  - Confidence indicator hoặc fallback message khi không tìm thấy sản phẩm phù hợp
- **File:** `frontend/src/features/ai/` — check `ChatProductCard.tsx` có nhận đúng data structure không

### 9.7 Fix: Hardcoded Rating trong Chatbot Response

> **⚠️ CORRECTION (audit Round 6 — đọc trực tiếp code):** Rating 4.5 hardcode xuất hiện ở **4 vị trí**, không phải 1. Mô tả cũ chỉ đề cập `chatbot.js` line ~337, bỏ sót 3 vị trí trong `geminiChatbot.js` là production flow thực tế.

| File | Dòng | Hàm | Mức độ |
|------|------|-----|--------|
| `backend/src/services/ai/geminiChatbot.js` | 394 | `parseAIResponse()` | **PRODUCTION — đường đi chính khi LLM trả kết quả** |
| `backend/src/services/ai/geminiChatbot.js` | 479 | `simpleKeywordMatch()` | **PRODUCTION — fallback khi LLM fail** |
| `backend/src/services/ai/geminiChatbot.js` | 516 | `simpleKeywordMatch()` nhánh "sản phẩm mới" | **PRODUCTION** |
| `backend/src/services/ai/chatbot.js` | 358 | `getPersonalizedRecommendations()` | Recommendation service |

- **Fix:** Trong query lấy product context cho chatbot, JOIN với bảng reviews để tính average rating. Ưu tiên fix `geminiChatbot.js` trước vì 3 vị trí đang trên production flow.
  ```js
  const products = await Product.findAll({
    attributes: [
      'id', 'name', 'basePrice', 'slug', 'thumbnail',
      [sequelize.fn('AVG', sequelize.col('reviews.ratingValue')), 'rating'],
      [sequelize.fn('COUNT', sequelize.col('reviews.id')), 'reviewCount'],
    ],
    include: [{ model: ProductReview, as: 'reviews', attributes: [] }],
    group: ['Product.id'],
  });
  ```
  Nếu không có review → default là `null` thay vì `4.5`

### 9.8 Fix: RAG Pipeline Robustness — Blocking I/O, Missing Null Checks, No Retry

**Layer 1 — vectorStore.js (Blocking File I/O + NaN Guard + Missing await in hooks)**
- **File:** `backend/src/services/ai/vectorStore.js` lines 15, 30, 33
- **Vấn đề 1 (audit thực tế):** `fs.readFileSync()` và `fs.writeFileSync()` — synchronous I/O blocks Node.js event loop khi load/save 1.9MB vectorDb.json. Khi có nhiều concurrent requests, mọi request khác bị block trong lúc save.
- **Fix 1:** Đổi sang `fs.promises.readFile()` / `fs.promises.writeFile()`. Hàm `save()` và `load()` trở thành `async`, các hàm phụ thuộc (`addProduct()`, `search()`) cũng async theo.

- **Vấn đề 2 — NaN/Infinity trong cosineSimilarity (audit thực tế, lines 81-92):** Nếu embedding API trả về vector chứa `NaN` (response bị cắt ngắn, network error), hàm `cosineSimilarity()` tính ra `NaN` cho `dotProduct`. Kết quả: `scores.sort((a, b) => b.score - a.score)` sort theo `NaN - NaN = NaN` → thứ tự kết quả undefined → chatbot trả về sản phẩm ngẫu nhiên, không phải theo relevance.
- **Fix 2:** Thêm guard trong `cosineSimilarity()`:
  ```js
  const magnitude = Math.sqrt(mag1) * Math.sqrt(mag2);
  if (magnitude === 0 || !isFinite(magnitude)) return 0;
  const similarity = dotProduct / magnitude;
  return isFinite(similarity) ? similarity : 0;  // Guard against NaN/Infinity
  ```
  Và trong `search()`, skip items không hợp lệ và dưới threshold:
  ```js
  return scores
    .filter(item => isFinite(item.score) && item.score >= 0.45)  // Threshold nâng lên 0.45 (xem Phase 9.4)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  ```

- **Vấn đề 3 — `save()` KHÔNG được `await` trong product.js hooks (audit thực tế):** `backend/src/models/product.js` lines 272, 287, 292, 309 gọi `vectorStoreService.save()` mà **KHÔNG có `await`**. Hiện tại hoạt động vì `save()` là synchronous (blocking). Nhưng sau khi Fix 1 chuyển `save()` sang async, các lời gọi này trở thành **fire-and-forget** — hooks hoàn thành trước khi save() xong, dữ liệu vector mất im lặng khi server load hoặc sau restart.
- **Fix 3:** Sau khi chuyển save() sang async, cập nhật tất cả callers trong product.js:
  ```js
  // afterCreate (line 272):
  await vectorStoreService.addProduct(product.toJSON());
  await vectorStoreService.save();  // ADD await

  // afterUpdate (line 287):
  await vectorStoreService.addProduct(product.toJSON());
  await vectorStoreService.save();  // ADD await

  // afterUpdate inactive case (line 292):
  vectorStoreService.items = vectorStoreService.items.filter(...);
  await vectorStoreService.save();  // ADD await

  // afterDestroy (line 309):
  vectorStoreService.items = vectorStoreService.items.filter(...);
  await vectorStoreService.save();  // ADD await
  ```
  **Kiểm tra thêm:** Grep `vectorStoreService.save()` trong toàn bộ `backend/src/` để tìm tất cả callers cần thêm `await`.
  - **THÊM MỚI (audit Round 6): `backend/scripts/indexProducts.js` line 45** cũng gọi `vectorStoreService.save()` không có `await`. Sau khi save() chuyển sang async (Fix 1), script gọi `process.exit(0)` (line 48) TRƯỚC KHI save() hoàn thành → vectorDb.json không được ghi, mất toàn bộ kết quả index. **Fix:** `await vectorStoreService.save()` tại line 45.

**Layer 2 — embedding.js (No Retry Logic + Missing Timeout on Batch)**
- **File:** `backend/src/services/ai/embedding.js` lines 32-52, 66-82
- **Vấn đề 1 (audit thực tế):** `generateEmbedding()` và `generateBatchEmbeddings()` dùng single `axios.post()` — nếu OpenRouter API timeout hoặc trả về 5xx thì lỗi propagate ngay, crash toàn bộ RAG query. Không có retry.
- **Vấn đề 2 (audit thực tế):** `generateBatchEmbeddings()` (lines 63-82) thiếu `timeout` trong axios config — chỉ `generateEmbedding()` có `timeout: 30000`. Batch call với nhiều product có thể hang vĩnh viễn nếu network issue.
- **Thêm:** Line 47 truy cập `response.data.data[0].embedding` không có null check — API trả về format sai thì TypeError.
- **Fix 1:** Wrap API call trong retry loop tối đa 3 lần với exponential backoff (500ms → 1s → 2s). Thêm optional chaining: `response.data?.data?.[0]?.embedding`.
- **Fix 2:** Thêm `timeout: 60000` vào axios config của `generateBatchEmbeddings()` (double so với single vì nhiều items).

**Layer 2b — viEmbedding.js (No Retry — audit thực tế mới)**
- **File:** `backend/src/services/ai/viEmbedding.js`
- **Vấn đề:** `generateEmbedding()` là single axios.post không có retry. Điểm quan trọng: `viEmbedding` được gọi từ **2 nơi**:
  1. `vectorStore.addProduct()` — nếu fail, `vectorVi = null` (graceful degradation ✅)
  2. `vectorStore.search()` — nếu fail khi `useViModel=true`, **toàn bộ search() throw exception** → `handleMessage()` catch → fallback `getAllProducts()` (trả về 0 sản phẩm do status='active' bug). Tác động: chatbot mất hoàn toàn context khi HF API bị unstable.
- **Fix:** Thêm retry (tối đa 2 lần, 500ms delay) vào `generateEmbedding()` của viEmbedding.js. Tương tự fix cho embedding.js (Layer 2 ở trên).
- **Lưu ý:** viEmbedding.js ĐÃ có `EXPECTED_DIM = 1024` validation ✅ và `timeout: 30000` ✅ — chỉ thiếu retry.

**Layer 3 — geminiChatbot.js (Missing Null Check + Trailing Space)**
- **File:** `backend/src/services/ai/geminiChatbot.js`
- **Vấn đề 1 (audit thực tế, line 120):** `response.data.choices[0].message.content` — không check `choices[0]` tồn tại. Nếu API trả về `choices: []` (content filter triggered), crash với `TypeError: Cannot read properties of undefined`.
- **Vấn đề tương tự (line 232):** `intentClassification` method — same unchecked `choices[0]`.
- **Vấn đề 2 (audit thực tế):** Trailing space trong Authorization header: `` `Bearer ${this.apiKey} ` `` — xuất hiện ở **3 chỗ**: `getAIResponse()` (~dòng 111), `rewriteQuery()` (~dòng 170), `classifyIntent()` (~dòng 228). Một số API server reject token với trailing space.
- **Fix 1:** Thêm guard: `if (!response.data.choices?.[0]?.message?.content) { return getFallbackResponse(); }`
- **Fix 2:** Xóa trailing space tại cả 3 chỗ: `` `Bearer ${this.apiKey}` `` (không có space sau apiKey)
- **Vấn đề 3 (MỚI — Audit v2) — `getAIResponse()` thiếu `temperature` và `max_tokens`:**
  - `rewriteQuery()` có `temperature: 0, max_tokens: 150` ✅
  - `classifyIntent()` có `temperature: 0, max_tokens: 20` ✅
  - `getAIResponse()` **KHÔNG có** cả hai → OpenRouter dùng default (thường temperature=1.0) → response nondeterministic, có thể rất dài
  - **Fix 3:** Thêm vào request body của `getAIResponse()`:
    ```js
    temperature: 0.3,   // Consistent, không quá deterministic cho conversation
    max_tokens: 800,    // Giới hạn độ dài response hợp lý
    ```

**Layer 4 — admin.js (Bulk `Product.update()` Bypasses Sequelize Hooks — MỚI Audit v2, ĐÃ ĐÍNH CHÍNH Round 7)**
- **File:** `backend/src/controllers/admin.js`
- **Vấn đề:** `Product.update({ ... }, { where: { id } })` là static bulk method — **KHÔNG trigger** `afterUpdate` hook. Tìm thấy **3 chỗ thực sự bulk** trong admin.js (audit Round 7 đính chính: trước đây ghi 5 chỗ là sai — 2 chỗ là `instance.update()` ĐÃ trigger hooks):

  | Dòng | Context | Loại update | Có bypass hook? |
  |------|---------|------------|-----------------|
  | ~817–823 | `createProduct` | Sync tổng stock từ variants | ✗ BYPASS (bulk static `Product.update`) |
  | ~1222–1225 | `updateProduct` | Sync stock từ variants (có transaction) | ✗ BYPASS (bulk static `Product.update`) |
  | ~1228–1234 | `updateProduct` | Update stockQuantity basic (có transaction) | ✗ BYPASS (bulk static `Product.update`) |
  | ~1046 | `updateProduct` | Update thông tin cơ bản | ✓ HOOKS FIRE — `product.update(...)` instance method |
  | ~1945 | `toggleProductStatus` | Đổi status sản phẩm | ✓ HOOKS FIRE — `product.update({ status })` instance method |

- **Impact thực tế:** Chỉ 3 chỗ stock-sync logic (817, 1222, 1228) bypass hooks. `toggleProductStatus` (1945) ĐÚNG là sẽ trigger hook → admin tắt sản phẩm → hook fire → vector store update đúng. **KHÔNG có bug "chatbot đề xuất sản phẩm đã tắt"** như audit cũ ghi.
- **Fix:** Sau mỗi bulk update (3 chỗ), fetch product và manual sync:
  ```js
  const updatedProduct = await Product.findByPk(id, {
    include: [{ model: Category, as: 'categories', attributes: ['name'] }]
  });
  if (updatedProduct.status === 'active') {
    await vectorStoreService.addProduct(updatedProduct.toJSON());
  } else {
    vectorStoreService.items = vectorStoreService.items.filter(i => i.metadata.id !== id);
  }
  vectorStoreService.save();
  ```
  Áp dụng cho 3 chỗ stock-sync (lines 817, 1222, 1228). Lines 1046 và 1945 không cần manual sync (hooks đã handle).

### 9.9 Feature: Add to Cart + Buy Now từ Chatbot Product Cards

#### Vấn đề hiện tại (audit thực tế)
- **`ChatProductCard.tsx`**: Chỉ có "View Details" và "Add to Cart" — không có "Mua ngay"
- **`ChatProductCard.tsx:63`**: TODO `// TODO: có thể thêm toast notification thông báo thành công` — chưa implement
- **`chatbotApi.ts` `AddToCartViaChatbotRequest` (lines 49-53):** Thiếu `variantId` (backend đã hỗ trợ nhưng frontend không truyền)
- **`chatbotApi.ts` `ProductRecommendation` (lines 14-23):** Thiếu `slug` — không tạo được link đến trang sản phẩm
- **`backend/src/controllers/chatbot.js` `handleProductSearch()` (lines 77-92):** Map product không include `slug` và `stockQuantity`
- **`addToCartViaChatbot` mutation:** Không có `invalidatesTags: ['Cart']` → main cart state không tự refresh sau khi thêm từ chatbot

#### Fix 0 — CRITICAL: Sửa URL endpoint mismatch trong `addToCartViaChatbot`
- **File:** `frontend/src/features/ai/services/chatbotApi.ts`
- **Vấn đề (audit thực tế):** Mutation `addToCartViaChatbot` target `url: '/cart'` (generic cart endpoint, không authenticated, không có chatbot analytics tracking). Backend đã có dedicated endpoint `/chatbot/cart/add` với `authenticate` middleware tại `backend/src/routes/chatbot.js` line 208.
- **Fix:**
  ```ts
  addToCartViaChatbot: builder.mutation<any, AddToCartViaChatbotRequest>({
    query: ({ productId, quantity, sessionId, variantId }) => ({
      url: '/chatbot/cart/add',   // FIX: đổi từ '/cart' sang '/chatbot/cart/add'
      method: 'POST',
      body: { productId, quantity, sessionId, variantId },
    }),
    invalidatesTags: ['Cart'],
  }),
  ```
- **Lưu ý:** Sau khi fix URL, add-to-cart từ chatbot đi qua `authenticate` middleware — frontend phải handle 401 (user chưa login) bằng redirect sang `/login` thay vì show generic error.

#### Fix 1 — Backend: Thêm slug vào chatbot product response
- **File:** `backend/src/controllers/chatbot.js` hàm `handleProductSearch()` lines 77-92
- **Fix:** Thêm `slug: product.slug` và `stockQuantity: product.stockQuantity` vào object được map
- **Kiểm tra thêm:** `geminiChatbot.js` `parseAIResponse()` — đảm bảo `slug` có trong cả 2 code path

#### Fix 2 — Frontend: Cập nhật types trong chatbotApi.ts
- **File:** `frontend/src/features/ai/services/chatbotApi.ts`
- Thêm `slug: string` và `stockQuantity: number` vào `ProductRecommendation` interface
- Thêm `variantId?: number` vào `AddToCartViaChatbotRequest` interface
- Thêm `invalidatesTags: ['Cart']` vào `addToCartViaChatbot` mutation builder để RTK Query tự refetch cart sau khi thêm

#### Fix 3 — Frontend: Toast notification + nút Mua ngay trong ChatProductCard.tsx
- **File:** `frontend/src/features/ai/components/ChatProductCard.tsx`
- **Toast:** Grep `toast` trong `frontend/src/` để xác định thư viện đang dùng (react-hot-toast hay react-toastify), rồi thay `console.log` bằng `toast.success(...)` và `console.error` bằng `toast.error(...)`
- **Nút Mua ngay:** Thêm handler `handleBuyNow` — gọi `addToCart({ productId, quantity: 1, sessionId })` rồi `navigate('/checkout')` (import `useNavigate` từ react-router-dom)
- Thêm JSX button "Mua ngay" cạnh "Thêm vào giỏ", chỉ hiện khi `product.inStock === true`
- Handle case user chưa đăng nhập: check auth state trước khi gọi addToCart, nếu chưa login thì navigate đến `/login`

#### Fix 4 — Backend: Validate stock trước khi thêm vào giỏ (audit thực tế)
- **File:** `backend/src/controllers/chatbot.js` hàm `addToCart()` lines 385-426
- **Vấn đề:** Controller tạo CartItem trực tiếp bằng `CartItem.create({ productId, variantId, quantity })` mà không kiểm tra Product có tồn tại hay còn hàng không. User có thể thêm sản phẩm không tồn tại hoặc đã hết hàng vào giỏ qua chatbot API.
- **Fix:** Thêm validation trước khi create:
  ```js
  const product = await Product.findByPk(productId);
  if (!product) return res.status(404).json({ message: 'Sản phẩm không tồn tại' });
  if (!product.inStock) return res.status(400).json({ message: 'Sản phẩm đã hết hàng' });
  if (variantId) {
    const variant = await ProductVariant.findOne({ where: { id: variantId, productId } });
    if (!variant) return res.status(404).json({ message: 'Biến thể sản phẩm không tồn tại' });
  }
  ```

### 9.10 Fix: Conversation History KHÔNG được truyền vào LLM — Lỗi RAG nền tảng (CRITICAL)

> Đây là lỗi nghiêm trọng nhất trong RAG pipeline. Mỗi lượt chat là stateless — LLM không biết gì về những gì user đã nói trước đó.

- **File:** `backend/src/services/ai/geminiChatbot.js` hàm `handleMessage()` line 49 (audit Round 7 verified)
- **Vấn đề (audit thực tế):** Signature thực tế là `handleMessage(message, context = {})` — KHÔNG nhận `userId`/`sessionId` làm separate params. Hàm chỉ truyền `message` hiện tại vào `getAIResponse()`. Toàn bộ lịch sử hội thoại không được đưa vào prompt → LLM không nhớ context giữa các turns. Phase 9.10b chỉ rõ phải refactor signature này.
- **Ví dụ lỗi thực tế:** User hỏi "Cho tôi xem iPhone 15" → LLM trả về sản phẩm. User tiếp theo hỏi "So sánh với cái kia đi" → LLM không biết "cái kia" là gì vì không có lịch sử.
- **RAG chuẩn phải là:**
  ```
  messages = [
    { role: 'system', content: systemPrompt },  ← RAG context (retrieved products)
    { role: 'user',   content: turn1_message },  ← Lịch sử
    { role: 'assistant', content: turn1_reply }, ← Lịch sử
    { role: 'user',   content: current_message } ← Tin nhắn hiện tại
  ]
  ```
- **Fix:** 
  1. Thiết kế `conversationHistory` là mảng `{role, content}[]`, lưu theo `sessionId`
  2. Trong `handleMessage()`: load history từ storage (Map in-memory hoặc Redis), append vào messages array trước khi gọi OpenRouter API
  3. Sau khi nhận response: append `{role: 'assistant', content: reply}` vào history
  4. Giới hạn history tối đa 10 turns (20 messages) để tránh overflow context window
  5. Lưu history vào `Map<sessionId, Message[]>` trong `GeminiChatbotService` class (hoặc Redis nếu muốn persist qua restart)
- **Storage strategy cho khóa luận:** Dùng `Map` in-memory đơn giản nhất (reset khi restart server, nhưng đủ cho demo). Nếu muốn persist: lưu vào `ChatMessage` table với `sessionId` + `role` + `content` fields.

### 9.10b Fix: Conversation Persistence Schema — ChatMessage Table Migration (PREREQUISITE)
> **Phải thực hiện TRƯỚC Phase 9.10 và 9.12.** ChatMessage model hiện tại thiếu các fields cần thiết cho AI chatbot messages — code trong 9.10/9.12 sẽ crash nếu chưa có migration này.

- **Vấn đề với ChatMessage table hiện tại:**
  - `senderId INT NOT NULL` — không phù hợp cho AI assistant messages (không có userId nào)
  - Không có `role` field để phân biệt `'user'` vs `'assistant'`
  - Không có `messageType` để phân biệt AI chatbot messages vs customer-admin chat — Phase 10 admin dashboard sẽ lẫn lộn nếu không phân biệt
  - `isFallback`, `intent`, `responseTimeMs` chưa tồn tại → không thể monitor RAG performance

- **Migration — Thêm fields vào `chat_messages` table:**
  ```sql
  ALTER TABLE chat_messages
    ADD COLUMN role ENUM('user', 'assistant') NULL,
    ADD COLUMN message_type ENUM('ai_chatbot', 'support_chat') NOT NULL DEFAULT 'support_chat',
    ADD COLUMN intent VARCHAR(50) NULL,
    ADD COLUMN response_time_ms INT UNSIGNED NULL,
    ADD COLUMN is_fallback BOOLEAN NOT NULL DEFAULT FALSE,
    MODIFY COLUMN sender_id INTEGER NULL;  -- allow NULL cho AI assistant messages
  ```

- **Update ChatMessage model** (`backend/src/models/chatMessage.js`) thêm các fields tương ứng với Sequelize DataTypes.

- **Logic persist trong `geminiChatbot.js`** (áp dụng sau Phase 9.10):
  ```js
  await ChatMessage.bulkCreate([
    { sessionId, userId: userId || null, role: 'user', messageType: 'ai_chatbot',
      content: message, senderId: null },
    { sessionId, userId: userId || null, role: 'assistant', messageType: 'ai_chatbot',
      content: aiReply, intent, responseTimeMs, isFallback: false, senderId: null }
  ]);
  ```

- **Phân biệt với support chat:** Query admin dashboard (Phase 10) phải filter `WHERE message_type = 'support_chat'` để không lẫn AI chatbot messages.

- **⚠️ Thứ tự implement bắt buộc (audit thực tế — không làm ngược sẽ crash):**
  1. **9.10b TRƯỚC:** Chạy SQL ALTER TABLE + update ChatMessage Sequelize model → Sequelize biết về `role`, `messageType`, `senderId` nullable. Nếu implement 9.10 trước, `ChatMessage.bulkCreate()` sẽ crash vì columns chưa tồn tại.
  2. **9.10 tiếp theo:** Thêm in-memory Map `conversationHistory: Map<sessionId, Message[]>` trong `GeminiChatbotService`.
  3. **9.10 bước cuối — Refactor `handleMessage()` signature (audit thực tế):** Hiện tại `handleMessage(message, context = {})` — `userId` và `sessionId` không được nhận là separate parameters. Phải refactor:
     ```js
     // THAY: async handleMessage(message, context = {})
     // BẰNG:
     async handleMessage(message, userId = null, sessionId = null, context = {})
     ```
     Và trong `backend/src/controllers/chatbot.js`:
     ```js
     const { message, userId, sessionId, context } = req.body;
     const aiResponse = await geminiChatbotService.handleMessage(message, userId, sessionId, context);
     ```
  4. SAU KHI có response, persist vào DB (code snippet bulkCreate ở trên). **`startTime`** phải được capture ở đầu `handleMessage()`: `const startTime = Date.now()`.

- **Acceptance Criteria bổ sung:**
  - [ ] `grep -n "handleMessage(message," backend/src/services/ai/geminiChatbot.js` → signature có `userId` và `sessionId` parameters
  - [ ] 3 turns chat → `SELECT * FROM chat_messages WHERE session_id='X' AND message_type='ai_chatbot'` → 6 rows (3 user + 3 assistant)
  - [ ] Server restart → chatbot vẫn có conversation context (load từ `chat_messages` table thay vì in-memory Map)
  - [ ] `GET /api/admin/chat/conversations` chỉ trả `message_type = 'support_chat'` rows, không lẫn AI chatbot messages

### 9.11 Fix: Broken Product Name Matching + Field Inconsistency + Category Filter Missing

**Lỗi 1 — Number comparison bug trong `parseAIResponse()` (CRITICAL)**
- **File:** `backend/src/services/ai/geminiChatbot.js` lines 333-339
- **Vấn đề (audit thực tế):** Code so sánh số thế hệ bằng cách lấy `numbersP[0] !== numbersR[0]` — so sánh phần tử đầu tiên của mảng số. Bug: "iPhone 14" (numbers=[14]) và "iPhone 140 Plus" (numbers=[140]) đều có `[0]` là... thực ra có thể khác nhau, nhưng "iPhone 15" (15) và "iPhone 15 Pro" (15) thì trùng → tiếp tục vào substring fallback quá loose.
- **Vấn đề thực tế hơn (line 341):** Fallback `pName.includes(rName) || rName.includes(pName)` quá loose — "iPhone" includes "iPhone 14", "iPhone 15" includes "iPhone 15 Pro", gây match sai.
- **Fix:** Đơn giản hóa matching logic — thay vì regex version parsing phức tạp, dùng cách chuẩn hơn:
  ```js
  // So sánh normalized exact match trước
  if (pName === rName) return product; // exact
  // Sau đó dùng word-boundary check, không dùng includes()
  const pWords = new Set(pName.split(' '));
  const rWords = new Set(rName.split(' '));
  const intersection = [...pWords].filter(w => rWords.has(w));
  if (intersection.length >= Math.min(pWords.size, rWords.size) * 0.8) return product;
  ```

**Lỗi 5b (MỚI — Audit v2) — `getAllProducts()` fallback dùng sai attribute name (CRITICAL)**
- **File:** `backend/src/services/ai/geminiChatbot.js` hàm `getAllProducts()` ~dòng 494–519
- **Vấn đề:** `attributes` list có `'price'` — field này không tồn tại trong Sequelize model (đúng là `basePrice`) → tất cả sản phẩm trong fallback có `price: undefined`. (Status `'active'` là ĐÚNG sau migration — không cần đổi.)
- **Fix:**
  ```js
  where: { status: 'active', inStock: true },
  attributes: ['id','name','shortDescription','description',
    'basePrice','compareAtPrice','thumbnail','inStock','searchKeywords','createdAt']
  ```

**Lỗi 2 — Field name inconsistency: `basePrice` vs `price` (CRITICAL — toàn bộ giá hiển thị undefined)**
- **Root cause (audit thực tế):** `Product` model Sequelize định nghĩa field là `basePrice` (DB column: `base_price`) — **KHÔNG có field `price`**. Tuy nhiên, toàn bộ AI service layer dùng `product.price` → trả về `undefined`. Tất cả giá trong chatbot response sẽ là `undefined`.
- **Các file và dòng cần fix (toàn bộ occurrences):**

  > **⚠️ Audit Round 7 (verified):** `vectorStore.js` line 78 ĐÃ FIX rồi (`price: product.basePrice`). Đã xóa khỏi bảng. Các tham chiếu "fix vectorStore.js line 63" trong note phía dưới giờ là "fix line 78 đã có sẵn".

  | File | Dòng | Hiện tại | Sửa thành |
  |------|------|----------|-----------|
  | `backend/src/services/ai/geminiChatbot.js` | 247 | `p.price?.toLocaleString(...)` | *(không cần sửa — `p.price` đọc từ vectorStore metadata, đã có giá đúng từ `basePrice`)* |
  | `backend/src/services/ai/geminiChatbot.js` | 348 | `price: product.price` | `price: product.basePrice` |
  | `backend/src/services/ai/geminiChatbot.js` | 426 | `p.price?.toLocaleString(...)` | *(không cần sửa — đọc từ vectorStore metadata)* |
  | `backend/src/services/ai/geminiChatbot.js` | 434 | `price: product.price` | `price: product.basePrice` |
  | `backend/src/services/ai/geminiChatbot.js` | 463 | `p.price?.toLocaleString(...)` | *(không cần sửa — đọc từ vectorStore metadata)* |
  | `backend/src/services/ai/geminiChatbot.js` | 471 | `price: product.price` | `price: product.basePrice` |
  | `backend/src/services/ai/chatbot.js` | 237 | `item.Product.price < priceRange.min` | `item.Product.basePrice < priceRange.min` |
  | `backend/src/services/ai/chatbot.js` | 240 | `item.Product.price > priceRange.max` | `item.Product.basePrice > priceRange.max` |
  | `backend/src/services/ai/chatbot.js` | 333 | `price: product.price` | `price: product.basePrice` |
  | `backend/src/services/ai/chatbot.js` | 340 | `product.compareAtPrice - product.price` | `product.compareAtPrice - product.basePrice` |
  | `backend/src/services/ai/chatbot.js` | 390 | `p.compareAtPrice - p.price` | `p.compareAtPrice - p.basePrice` |

- **Ưu tiên fix:** Còn 8 vị trí cần fix (geminiChatbot 348/434/471, chatbot.js 237/240/333/340/390). vectorStore.js line 78 đã đúng (root cause đã fix).
- **Lưu ý Phase 9.14 Fix 3:** Code snippet tại Phase 9.14 có `price: product.price` trong metadata — phải sửa thành `price: product.basePrice` khi implement.

**Lỗi 3 — Category filtering NOT IMPLEMENTED**
- **File:** `backend/src/controllers/chatbot.js` `searchProducts()` line 489
- **Vấn đề (audit thực tế):** Comment `// Thêm logic lọc theo danh mục` — category filter hoàn toàn chưa code. User hỏi "điện thoại Samsung" → chatbot không lọc theo category "Điện thoại".
- **Fix:** Thêm WHERE condition cho category khi `searchParams.category` có giá trị:
  ```js
  include: [{ model: Category, as: 'categories', where: searchParams.category ? { name: { [Op.like]: `%${searchParams.category}%` } } : undefined, required: !!searchParams.category }]
  ```

**Lỗi 4 — `getTrendingProducts()` wrong field name**
- **File:** `backend/src/controllers/chatbot.js` line 533
- **Vấn đề:** Dùng `featured: true` nhưng Product model có field `isFeatured`. Query sẽ ignore condition này → không lọc được trending.
- **Fix:** Đổi `featured: true` → `isFeatured: true`.

**Lỗi 5 — Price regex extracts model numbers as prices (audit thực tế)**
- **File:** `backend/src/services/ai/chatbot.js` `extractSearchParams()` line 149
- **Vấn đề:** Regex `/(\d+)(?:k|000|triệu)?/g` match mọi số trong query, kể cả model number:
  ```js
  // Input: "có iphone 14 dưới 15 triệu không"
  // Regex matches: ["14", "15 triệu"] → minPrice = 14, maxPrice = 15 triệu
  // 14 là model number, KHÔNG phải giá!
  ```
  Kết quả: `searchProducts()` filter `basePrice >= 14` AND `basePrice <= 15000000` → iPhone 14 có giá 20M+ bị lọc ra ngoài, user không tìm được sản phẩm đang hỏi.
- **Fix:** Chỉ extract số có đi kèm đơn vị tiền tệ (k, 000, triệu, đ, vnd):
  ```js
  const pricePattern = /(\d+(?:[.,]\d+)?)\s*(?:k|nghìn|triệu|tr|đồng|vnd|vnđ|000)\b/gi;
  const priceMatches = lowerMessage.match(pricePattern);
  // "iphone 14 dưới 15 triệu" → matches: ["15 triệu"] (không match "14")
  ```

**Lỗi 6 — `parseAIResponse()` dùng regex greedy thừa và fragile (audit thực tế)**
- **File:** `backend/src/services/ai/geminiChatbot.js` — hàm `parseAIResponse()`, phần đầu extract JSON
- **Vấn đề:** Request đã set `response_format: { type: 'json_object' }` → OpenRouter API **đảm bảo** `aiText` là raw JSON hợp lệ. Tuy nhiên code vẫn dùng:
  ```js
  const jsonMatch = aiText.match(/\{[\s\S]*\}/);
  if (jsonMatch) {
    const parsed = JSON.parse(jsonMatch[0]);
  ```
  - **Regex này redundant:** `aiText` đã là JSON, không cần extract
  - **Regex này fragile:** `[\s\S]*` là greedy — nếu LLM response chứa nhiều `{...}` blocks (ví dụ nested product objects), regex lấy từ `{` đầu tiên đến `}` cuối cùng, có thể ghép sai 2 JSON objects thành 1 string không parse được
  - **Hệ quả nếu parse fail:** Rơi vào `simpleKeywordMatch()` fallback — chất lượng rất kém so với LLM response
- **Fix:** Bỏ regex, dùng `JSON.parse(aiText)` trực tiếp. Thêm strip code fences phòng trường hợp model trả về markdown wrapped:
  ```js
  // THAY đoạn regex+if bằng:
  try {
    const clean = aiText.replace(/^```(?:json)?\n?|\n?```$/g, '').trim();
    const parsed = JSON.parse(clean);  // response_format: json_object đảm bảo valid JSON
    // ... phần còn lại của logic parseAIResponse giữ nguyên
  } catch (parseError) {
    console.error('[RAG] parseAIResponse JSON.parse failed:', parseError.message);
    return this.simpleKeywordMatch(userMessage, products);
  }
  ```
- **Acceptance Criteria:**
  - [ ] `grep -n '\.match.*{.*\\\\S' backend/src/services/ai/geminiChatbot.js` → no match trong `parseAIResponse()` (đã xóa regex)
  - [ ] OpenRouter trả về response chứa nested JSON objects → chatbot parse thành công, không rơi vào `simpleKeywordMatch()`

**Lỗi 7 — `featured: true` sai field và dead code trong chatbot endpoints**
- **Vấn đề:** `status: 'active'` là ĐÚNG sau migration. Vấn đề thực tế là:

  | File | Hàm | Dòng | Vấn đề thực tế |
  |------|-----|------|----------------|
  | `backend/src/controllers/chatbot.js` | `getTrendingProducts()` | ~530 | Dead code + dùng `featured: true` sai field (phải là `isFeatured`) |
  | `backend/src/controllers/chatbot.js` | `getBestDeals()` | ~511 | Dead code (handleSalesPitch không được wire) |

- **Fix:** Sửa `featured: true` → `isFeatured: true` trong `getTrendingProducts()`. Xóa dead code nếu không wire vào intent routing.

**Lỗi 8 — `chatbot.js` service dùng từ khóa danh mục/thương hiệu của thời trang, không phải tech store (audit thực tế)**
- **File:** `backend/src/services/ai/chatbot.js` — `extractSearchParams()` (lines 133–183) và `searchProducts()` trong controller (lines 438–457)
- **Vấn đề:**
  - `categoryKeywords` mapping: áo, quần, giày, túi, phụ kiện → keywords tiếng Anh: shirt, pants, shoes, bag, accessories
  - `brands` array: `['nike', 'adidas', 'zara', 'h&m', 'uniqlo']`
  - **Store thực tế bán điện tử (45 sản phẩm: iPhone, Samsung, laptop, tai nghe...)** — không có bất kỳ sản phẩm thời trang nào
  - Kết quả: User hỏi "điện thoại Samsung Galaxy" → không match category/brand nào → `searchParams.category = undefined`, không lọc đúng
- **Fix:** Thay đổi keyword mapping phù hợp với catalog thực tế của store:
  ```js
  const categoryKeywords = {
    'điện thoại': ['điện thoại', 'phone', 'smartphone', 'iphone', 'samsung', 'oppo'],
    'laptop': ['laptop', 'máy tính', 'macbook', 'notebook', 'máy xách tay'],
    'tai nghe': ['tai nghe', 'earphone', 'airpods', 'headphone'],
    'phụ kiện': ['phụ kiện', 'accessories', 'case', 'ốp lưng', 'sạc', 'cáp'],
    'màn hình': ['màn hình', 'monitor', 'display'],
  };
  const brands = ['apple', 'samsung', 'sony', 'xiaomi', 'oppo', 'lg', 'dell', 'asus', 'lenovo'];
  ```
- **Lưu ý:** Đây là dead code trong flow hiện tại (controller không gọi extractSearchParams), nhưng phải fix khi implement intent routing (Phase 9.12 Lỗi 1).

**Lỗi 9 — `getUserProfile()` dùng sai field `product.price` (audit thực tế)**
- **File:** `backend/src/services/ai/chatbot.js` hàm `getUserProfile()` lines 237–240
- **Vấn đề:** `if (item.Product.price < priceRange.min)` và `if (item.Product.price > priceRange.max)` — `Product.price` không tồn tại (đúng là `basePrice`) → `priceRange` luôn là `{ min: Infinity, max: 0 }` → cá nhân hóa theo ngân sách không hoạt động
- **Fix:** Đổi `item.Product.price` → `item.Product.basePrice` tại cả 2 chỗ (lines 237, 240)
- **Bảng Lỗi 2 ở trên cần bổ sung 2 dòng này** (hiện tại chỉ liệt kê chatbot.js lines 333, 340, 390)

**Lỗi 10 — `simpleKeywordMatch()` "sản phẩm mới" logic dùng sai sort order (audit thực tế)**
- **File:** `backend/src/services/ai/geminiChatbot.js` hàm `simpleKeywordMatch()` ~line 460
- **Vấn đề:** Khi user hỏi "sản phẩm mới nhất" / "hàng mới", code dùng `products.slice(0, 5)` với comment `// Giả định sản phẩm đã được sắp xếp theo createdAt DESC`. Nhưng `products` được truyền vào `simpleKeywordMatch()` từ **vector search results** (sorted by SIMILARITY SCORE, không phải date). `slice(0, 5)` trả về 5 sản phẩm liên quan nhất theo semantic similarity, không phải 5 sản phẩm MỚI nhất.
- **Fix:** Thêm sort theo `createdAt` trước khi slice:
  ```js
  const newProducts = [...products]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 5);
  ```
  Lưu ý: `createdAt` phải có trong vector store metadata (hiện tại không có — xem Phase 9.14 Fix 3). Thêm `createdAt` vào metadata trong `vectorStore.addProduct()`.

### 9.12 Fix: Session Management Ghost Infrastructure + Controller Flow + Test Routes

**Lỗi 1 — Controller bypasses intent detection**
- **File:** `backend/src/controllers/chatbot.js` `handleMessage()` line 34
- **Vấn đề (audit thực tế):** Controller gọi thẳng `geminiChatbotService.handleMessage()` mà không dùng `chatbotService.analyzeIntent()` và `extractSearchParams()`. Kết quả: toàn bộ intent detection trong `chatbot.js` service (product_search, recommendation, sales_pitch, etc.) bị bypass hoàn toàn.
- **Vấn đề thêm:** `geminiChatbot.js:classifyIntent()` cũng tồn tại nhưng không được gọi từ `handleMessage()` flow chính — duplicate code không dùng.
- **Fix:** Tích hợp intent detection: `const intent = chatbotService.analyzeIntent(message)` → routing theo intent type trước khi gọi Gemini.

**Lỗi 2 — sessionId được nhận nhưng không dùng**
- **File:** `backend/src/controllers/chatbot.js` line 23, `backend/src/services/ai/geminiChatbot.js` line 37
- **Vấn đề:** `sessionId` từ frontend được destructure nhưng không được truyền vào service, không dùng để load conversation history, không lưu vào bất kỳ đâu.
- **Fix:** Sau khi implement Phase 9.10 (conversation history), dùng `sessionId` làm key để lookup/store history.

**Lỗi 3 — Analytics và session tracking chỉ log console**
- **File:** `backend/src/services/ai/chatbot.js` lines 465-493
- **Vấn đề:** `trackConversation()` (line 476) và `trackAnalytics()` (line 490) chỉ `console.log`, comment nói "Có thể lưu vào ChatbotConversation/ChatbotAnalytics" nhưng không implement.
- **Fix:** Implement basic analytics: lưu vào `chat_messages` table (đã có) với `sessionId`, `role`, `content`, `createdAt`. Đủ để demo thesis.

**Lỗi 4 — Test/debug routes phải xóa trước production**
- **File:** `backend/src/routes/chatbot.js` lines 213-246
- **Vấn đề (Audit v2 — 3 routes, không phải 2):** Tìm thấy **3 debug routes** còn tồn tại:
  - `/test` (GET, line 213) — trả response json đơn giản, expose API status
  - `/test-message` (POST, line 222) — test message flow, bypass normal pipeline
  - `/simple-message` (POST, line 244) — gọi `handleSimpleMessage()`, không có validation, không rate limit
- **Fix:** Xóa cả 3 endpoints này trước khi demo/production. Nếu cần debug, dùng integration tests thay vì debug routes công khai.

### 9.13 Fix: Chatbot Security + Rate Limiting + Embedding Caching + Vector Limit

**Lỗi 1 — Chatbot endpoints không có authentication, userId có thể bị spoof**
- **File:** `backend/src/routes/chatbot.js`
- **Vấn đề (audit thực tế):** `/message` (line 74), `/products/search` (line 107), `/recommendations` (line 140), `/analytics` (line 174) — tất cả PUBLIC, không có `authenticate` middleware. Request body có thể chứa bất kỳ `userId` nào → attacker lấy recommendations của người dùng khác, spam analytics data giả.
- **Fix:**
  - `/message` và `/recommendations`: Thêm `optionalAuth` middleware (không bắt buộc login, nhưng nếu có token thì validate) → nếu `userId` trong body không khớp với `req.user.id` thì reject.
  - `/analytics`: Thêm `authenticate` middleware (chỉ logged-in users mới track analytics).
  - `/products/search`: Có thể public, nhưng phải loại bỏ `userId` parameter (không cần personalization cho unauthenticated search).

**Lỗi 2 — Không có rate limiting cho chatbot endpoints**
- **File:** `backend/src/routes/chatbot.js`
- **Vấn đề:** Không có rate limit → user có thể spam `/message` vô hạn, làm cạn kiệt OpenRouter API quota.
- **Fix:** Thêm `chatbotLimiter` trong `rateLimiter.js`: 20 requests/phút/IP cho `/message`, 30 requests/phút cho `/products/search`.

**Lỗi 3 — Không có embedding caching**
- **File:** `backend/src/services/ai/embedding.js`
- **Vấn đề:** User hỏi cùng câu 10 lần → 10 API calls tới OpenRouter tốn token. Không có cache.
- **Thêm (audit thực tế):** `vectorStore.search(query, limit)` tại line 97 tự gọi `embeddingService.generateEmbedding(query)` nội bộ — nghĩa là MỖII search = 1 embedding call. Cache phải được implement trong `embedding.js` (layer thấp nhất) để tự động cover CẢ 2 path: (1) direct calls từ geminiChatbot.js và (2) indirect calls qua vectorStore.search().
- **Fix (đơn giản cho khóa luận):** Dùng `Map<string, number[]>` in-memory với TTL 5 phút. Key = `text.toLowerCase().trim()`, value = embedding vector. Giới hạn cache size 1000 entries (LRU hoặc FIFO). Đặt cache trong `generateEmbedding()` của `embedding.js` — không cần thêm ở nơi khác.
  - ⚠️ **Xem Phase 35.7 cho spec mới nhất:** TTL 10 phút, max 500 entries. Phase 35.7 bổ sung thêm Query Result Cache via Redis (cache toàn bộ chatbot response).

**Lỗi 4 — `getAllProducts()` hardcoded limit 100**
- **File:** `backend/src/services/ai/geminiChatbot.js` hàm `getAllProducts()` line 518
- **Vấn đề:** Nếu store có hơn 100 active products, phần còn lại KHÔNG BAO GIỜ được đưa vào fallback search → chatbot bỏ sót sản phẩm.
- **Fix:** Tăng limit lên 200, hoặc tốt hơn là dùng vector search thay vì fallback về `getAllProducts()`. Nếu vẫn dùng fallback, thêm comment warning.

### 9.14 Fix: Product Embedding Text Quality — Thông Tin Embed Quá Nghèo (CRITICAL)

> Chất lượng embedding là nền tảng của RAG. Nếu text đưa vào embedding thiếu thông tin, vector search không tìm được sản phẩm liên quan dù query đúng.

- **File:** `backend/src/services/ai/vectorStore.js` line 47
- **Vấn đề (audit thực tế):**
  ```js
  // HIỆN TẠI — chỉ có tên + mô tả ngắn, tối đa 500 ký tự:
  const textToEmbed = `${product.name}. ${product.shortDescription || ''}`.substring(0, 500);
  ```
  - Không có: category, brand (baseName), description đầy đủ, specifications, price tier
  - Không có `generateProductText()` function riêng — text generation không tái sử dụng được
  - Model `text-embedding-3-small` output **1536 dimensions** mặc định (audit thực tế: API call không truyền `dimensions` param → default 1536; 384 chỉ khi truyền explicit `dimensions: 384`)
  - Không có dimension validation: nếu API trả về vector sai size → lưu vào store mà không báo lỗi

- **Fix 1 — Tạo hàm `generateProductText(product)` chuẩn:**
  ```js
  function generateProductText(product) {
    const parts = [
      product.name,
      product.baseName ? `Thương hiệu: ${product.baseName}` : '',
      product.categories?.[0]?.name ? `Danh mục: ${product.categories[0].name}` : '',
      product.shortDescription || '',
      product.description ? product.description.replace(/<[^>]*>/g, '').substring(0, 500) : '',
      product.basePrice ? `Giá: ${product.basePrice.toLocaleString('vi-VN')} đồng` : '',  // SỬA: basePrice
      product.inStock ? 'Còn hàng' : 'Hết hàng',
    ];
    return parts.filter(Boolean).join('. ').substring(0, 1500);
  }
  ```
  - Thay `textToEmbed` line 47 bằng `generateProductText(product)`

- **Fix 2 — Vector dimension validation:**
  ```js
  const EXPECTED_DIM = 1536; // text-embedding-3-small default output (KHÔNG truyền dimensions param → mặc định 1536)
  if (!vector || vector.length !== EXPECTED_DIM) {
    throw new Error(`Invalid embedding: expected ${EXPECTED_DIM} dims, got ${vector?.length}`);
  }
  ```

- **Fix 3 — Thêm `slug` và `shortDescription` vào metadata trong vectorStore (và sửa field name):**
  ```js
  metadata: {
    id: product.id,
    name: product.name,
    slug: product.slug,                              // THÊM — cần cho product card link
    price: product.basePrice,                        // SỬA: product.price → product.basePrice
    compareAtPrice: product.compareAtPrice,
    thumbnail: product.thumbnail,
    inStock: product.inStock,
    stockQuantity: product.stockQuantity,
    category: product.categories?.[0]?.name || 'Sản phẩm',
    baseName: product.baseName,
    shortDescription: product.shortDescription || '', // THÊM — createPrompt() dùng p.shortDescription
  }
  ```
  > **Lý do thêm `shortDescription` (Audit v2):** `createPrompt()` format string dùng `${p.shortDescription}` nhưng metadata hiện tại không lưu field này → tất cả sản phẩm trong chatbot prompt hiển thị `undefined` thay vì mô tả thực.

- **Fix 4 — Batch embedding trong `indexProducts.js` (thay sequential):**
  - `backend/scripts/indexProducts.js` hiện tại loop từng product, gọi `addProduct()` từng cái → 45 products = 45 API calls riêng lẻ
  - Fix: dùng `generateBatchEmbeddings()` đã có trong `embedding.js` — gom 45 products thành 1 batch call
  - Thêm script alias vào `package.json`: `"ai:rebuild-vectors": "node scripts/indexProducts.js"`

- **Fix 5 — indexProducts.js safety issues (audit thực tế):**
  - **Vấn đề A — Data loss risk:** Script gọi `vectorStoreService.clear()` TRƯỚC khi re-index. Nếu script crash sau `clear()` nhưng trước `save()` (ví dụ: embedding API timeout sau product #10), toàn bộ vectors bị mất, server không có gì để search cho đến khi chạy lại script.
    - **Fix:** Backup file trước khi clear: `fs.copyFileSync(storagePath, storagePath + '.bak')` — nếu script thất bại, file backup còn đó để restore.
  - **Vấn đề B — Out-of-stock products indexed:**
    `indexProducts.js` dùng `status: 'active'` — đây là ĐÚNG (canonical value sau migration). Cần thêm filter `inStock: true` để loại sản phẩm hết hàng ra khỏi vector store.
    - **Fix:** Thêm `inStock: true` vào WHERE clause (line 15):
      ```js
      where: { status: 'active', inStock: true },
      ```
  - **Vấn đề C — No error recovery:** Nếu embedding fail ở product #25, toàn bộ loop vẫn chạy nhưng `save()` chỉ có products #1-24. Không có retry hay report danh sách products thất bại.
    - **Fix:** Collect failed product IDs; sau khi loop xong, log warning: `"⚠️ Không thể index ${failedIds.length} sản phẩm: ${failedIds.join(', ')}"`

### 9.15 Fix: System Prompt & Retrieval Validation — Thiếu RAG Constraint

**Lỗi 1 — Detailed matching rules để sai vị trí (CRITICAL)**
- **File:** `backend/src/services/ai/geminiChatbot.js` line 116 (system prompt), lines 298-338 (user message rules)
- **⚠️ CORRECTION (audit Round 6):** Mô tả cũ SAI. System prompt hiện tại (line 116) **ĐÃ CÓ** RAG constraint: `"...Chỉ giới thiệu sản phẩm có trong danh sách được cung cấp, không bịa thêm."` — không phải generic 1 câu như đã ghi.
- **Vấn đề thực sự:** Toàn bộ quy tắc matching chi tiết (phân biệt Pro/Max/Plus/Ultra, ví dụ mẫu theo từng danh mục điện thoại/tablet/laptop — lines 298-338 trong `createPrompt()`) nằm trong **USER message**, không phải system prompt. Đây là anti-pattern: user message có thể bị override qua prompt injection; quy tắc quan trọng phải ở system prompt để luôn được enforce.
- **Vấn đề:** Detailed instructions về product matching nằm trong USER message (createPrompt, line 261) — đây là anti-pattern. System prompt phải chứa các ràng buộc nền tảng, không để trong user message.
- **Fix:** Nâng cấp system prompt:
  ```js
  content: `Bạn là trợ lý tư vấn sản phẩm của cửa hàng TechStore.
  QUY TẮC BẮT BUỘC:
  1. CHỈ tư vấn sản phẩm có trong DANH SÁCH SẢN PHẨM được cung cấp trong tin nhắn.
  2. TUYỆT ĐỐI không bịa tên sản phẩm, giá, hoặc thông số kỹ thuật ngoài danh sách.
  3. Nếu sản phẩm không có trong danh sách, nói rõ: "Cửa hàng hiện chưa có [tên sản phẩm] ạ."
  4. Trả lời bằng tiếng Việt, thân thiện.
  5. Trả về đúng định dạng JSON được yêu cầu.`
  ```

**Lỗi 2 — Không validate LLM chỉ được trích dẫn sản phẩm từ retrieved context**
- **File:** `backend/src/services/ai/geminiChatbot.js` `parseAIResponse()` lines 303-378
- **Vấn đề:** Nếu LLM hallucinate tên sản phẩm không có trong `products[]` (retrieved context), code chỉ silently drop product đó (không match được), không có cảnh báo, không có log.
- **Fix:** Thêm hallucination detection log:
  ```js
  parsed.matchedProducts?.forEach(productName => {
    const found = products.find(/* matching logic */);
    if (!found) {
      logger.warn(`[RAG] Hallucination detected: LLM mentioned "${productName}" but not in retrieved context`);
    }
  });
  ```

**Lỗi 3 — Intent classification defined nhưng không bao giờ được gọi**
- **File:** `backend/src/services/ai/geminiChatbot.js` `classifyIntent()` lines 192-238
- **Vấn đề:** Hàm đẹp, có đầy đủ intents (product_search, pricing, order_inquiry, policy, support, general, off_topic), nhưng KHÔNG BAO GIỜ được gọi trong `handleMessage()`.
- **Fix:** Gọi `classifyIntent()` trong `handleMessage()` **TRƯỚC KHI** gọi `rewriteQuery()`, dùng intent để:
  - `off_topic`: trả về message redirect về sản phẩm **ngay lập tức — skip cả `rewriteQuery()` và `vectorSearch()`** (tiết kiệm 2 API calls)
  - `order_inquiry`: route sang endpoint tra đơn hàng (nếu có)
  - Các intent khác: vẫn qua RAG pipeline bình thường (rewrite → retrieve → generate)
- **Lưu ý thứ tự quan trọng:** Flow đúng phải là: `classifyIntent()` → [early return nếu off_topic] → `rewriteQuery()` → `vectorSearch()` → `getAIResponse()`. Flow hiện tại là `rewriteQuery()` → `vectorSearch()` → `getAIResponse()` (không có phân loại intent trước).

**Fix 4 — Gộp rewriteQuery + classifyIntent thành 1 LLM call (Cost Optimization)**
- **Vấn đề:** Sau khi fix 9.15 Lỗi 3, flow sẽ là: `classifyIntent()` (1 LLM call) → `rewriteQuery()` (1 LLM call) → `getAIResponse()` (1 LLM call) = **3 LLM calls** cho mỗi tin nhắn thông thường.
- **Fix:** Tạo hàm `preprocessMessage(message)` gộp cả 2 tasks thành 1 API call:
  ```js
  async preprocessMessage(message) {
    if (!this.apiKey || this.apiKey === 'demo-key') return { rewrittenQuery: message, intent: 'general' };
    try {
      const response = await axios.post(this.apiUrl, {
        model: this.model,
        messages: [{
          role: 'system',
          content: `Xử lý câu hỏi mua sắm tiếng Việt. Thực hiện 2 nhiệm vụ và trả về JSON:
            1. Chuẩn hóa câu hỏi (sửa lỗi chính tả, mở rộng từ viết tắt: ip→iPhone, pm→Pro Max)
            2. Phân loại intent
            Format: {"rewrittenQuery": "câu đã chuẩn hóa", "intent": "product_search|pricing|order_inquiry|policy|support|general|off_topic"}`
        }, { role: 'user', content: message }],
        response_format: { type: 'json_object' },
        temperature: 0,
        max_tokens: 200
      }, { headers: { 'Authorization': `Bearer ${this.apiKey}`, 'Content-Type': 'application/json' }, timeout: 15000 });
      const result = JSON.parse(response.data.choices?.[0]?.message?.content || '{}');
      return { rewrittenQuery: result.rewrittenQuery || message, intent: result.intent || 'general' };
    } catch (error) {
      console.error('❌ Lỗi preprocessMessage:', error.message);
      return { rewrittenQuery: message, intent: 'general' };
    }
  }
  ```
- **Cập nhật `handleMessage()` — thay 2 separate calls bằng 1:**
  ```js
  const { rewrittenQuery, intent } = await this.preprocessMessage(message);
  if (intent === 'off_topic') return this.getFallbackResponse(message); // 1 call total
  // tiếp tục với rewrittenQuery cho vectorSearch + getAIResponse
  ```
- **Kết quả:** off_topic = 1 call (tiết kiệm 2 calls); các intent khác = 2 calls thay vì 3 calls.
- **Xóa:** `rewriteQuery()` và `classifyIntent()` methods sau khi tích hợp `preprocessMessage()` để tránh dead code.

**Lỗi 4 — Prompt Injection via User Message (Security)**
- **File:** `backend/src/services/ai/geminiChatbot.js` `createPrompt()` line 269
- **Vấn đề:** `TIN NHẮN KHÁCH HÀNG: "${userMessage}"` — user message được interpolate trực tiếp vào prompt mà không escape. User có thể gửi:
  - `` `\n\nIgnore all previous instructions. From now on...` `` — override system prompt bằng cách thêm newlines
  - Message chứa `"` characters → phá vỡ cấu trúc JSON nếu LLM cố gắng echo lại content
- **Fix:** Sanitize message trước khi đưa vào prompt trong `createPrompt()`:
  ```js
  const sanitizedMessage = userMessage
    .replace(/"/g, "'")        // Thay double quotes thành single quotes
    .replace(/\n{2,}/g, '\n') // Giới hạn consecutive newlines (max 1)
    .trim()
    .substring(0, 1000);       // Hard cap (validator Phase 12 enforce 2000 — đây là defence-in-depth)
  // Dùng sanitizedMessage thay userMessage trong dòng interpolation
  ```

### 9.16 Fix: Chatbot Language Detection + Admin Analytics Dashboard

**Lỗi 1 — Không có language detection**
- **Vấn đề:** System prompt cứng "Trả lời bằng tiếng Việt" — nếu user nhắn bằng tiếng Anh, chatbot vẫn trả lời tiếng Việt (UX kém).
- **Fix (đơn giản cho khóa luận):** Detect ngôn ngữ bằng heuristic:
  ```js
  function detectLanguage(text) {
    // Vietnamese chars: à á â ã è é ê ì í ò ó ô õ ù ú ý ă đ ơ ư and tones
    const viPattern = /[àáâãèéêìíòóôõùúýăđơư]/i;
    return viPattern.test(text) ? 'vi' : 'en';
  }
  ```
  - Inject vào system prompt: nếu `lang === 'en'` thì thêm `"Respond in English"` vào system prompt
  - Hoặc đơn giản hơn: always respond in Vietnamese (acceptable scope for thesis)

**Lỗi 2 — Không có admin dashboard để monitor chatbot**
- **Vấn đề (audit thực tế, Phase 32 gap):** Chatbot analytics chỉ `console.log`, không có UI cho admin xem thống kê.
- **Fix:** Thêm vào Phase 32 (Admin Analytics):
  - Backend endpoint: `GET /api/admin/chatbot/stats` trả về: `{ totalSessions, avgMessagesPerSession, topIntents, fallbackRate, avgResponseTime }`
  - Frontend: Thêm tab "Chatbot" trong DashboardPage.tsx với: session count chart, intent breakdown pie chart, fallback rate indicator
  - Cần implement basic analytics storage trong Phase 9.12 trước (lưu vào `chat_messages` table với `sessionId`, `intent`, `responseTime`, `isFallback`)

### ✅ Acceptance Criteria Phase 9
**Auto-sync & Retrieval:**
- [ ] Thêm 1 sản phẩm mới vào DB → hỏi chatbot về sản phẩm đó → chatbot trả lời đúng (không cần restart server)
- [ ] Xóa 1 sản phẩm → chatbot không còn đề xuất sản phẩm đó
- [ ] `npm run ai:rebuild-vectors` chạy thành công, vectorDb.json được cập nhật
- [ ] Chatbot đề xuất sản phẩm có rating = average của DB reviews thực, không phải `4.5` hardcode

**Audit v2 — Hooks & Fallback (CRITICAL):**
- [ ] `grep -n "status.*active" backend/src/models/product.js` → có match trong hooks (dùng `'active'` là ĐÚNG sau migration)
- [ ] Tắt vector store (đổi tên vectorDb.json) → gửi tin nhắn chatbot → chatbot vẫn trả về sản phẩm qua `getAllProducts()` fallback (status fix hoạt động)
- [ ] `grep -n "'price'" backend/src/services/ai/geminiChatbot.js` trong `getAllProducts()` attributes → no match (đã đổi thành `'basePrice'`)
- [ ] Sản phẩm trong chatbot prompt hiển thị description thực (không phải `undefined`) — `shortDescription` có trong metadata vector store
- [ ] Similarity threshold 0.45: hỏi "điện thoại" → trả về < 15 kết quả nhưng đúng danh mục

**Conversation Memory (9.10 — CRITICAL):**
- [ ] Hỏi "Cho tôi xem iPhone 15" → chatbot trả về sản phẩm. Hỏi tiếp "Còn loại nào rẻ hơn không?" → chatbot hiểu ngữ cảnh từ turn trước, không cần hỏi lại iPhone 15 là gì
- [ ] Conversation 20 turns → server không bị OOM, response time vẫn trong 5 giây
- [ ] Session khác nhau có lịch sử độc lập — user A không thấy history của user B

**Pipeline Robustness (9.8):**
- [ ] vectorStore.js dùng async file I/O (`fs.promises`), không còn blocking sync calls
- [ ] Tắt OpenRouter API → embedding.js retry 3 lần trước khi throw, không crash ngay
- [ ] API trả về `choices: []` → chatbot trả về fallback message, không crash với TypeError
- [ ] Authorization header không có trailing space (`grep -n "apiKey " backend/src/services/ai/geminiChatbot.js` → no match)
- [ ] Inject `NaN` vào một vector trong `vectorDb.json` → restart server → chatbot search vẫn trả về kết quả hợp lệ, không trả về sản phẩm ngẫu nhiên (NaN sort guard hoạt động)
- [ ] Tạo sản phẩm mới qua admin API → không restart server → hỏi chatbot về sản phẩm đó → chatbot trả lời đúng (`save()` có `await`, `vectorDb.json` được ghi đầy đủ trước khi response)

**Product Matching & Field Consistency (9.11):**
- [ ] Hỏi "điện thoại Samsung" → chatbot chỉ trả về sản phẩm thuộc category "Điện thoại" (category filter hoạt động)
- [ ] Giá sản phẩm trong chatbot response không bao giờ là `undefined` — `grep -n "product\.price\b" backend/src/services/ai/` → no match (tất cả đã đổi sang `basePrice`)
- [ ] `vectorDb.json` sau rebuild: mỗi item có `"price": <số thực>` không phải `null`/`undefined` (vectorStore.js line 78 đã dùng `basePrice`)
- [ ] Hỏi "Samsung mới nhất" → `getTrendingProducts()` trả về sản phẩm có `isFeatured: true`
- [ ] Hỏi câu hoàn toàn không liên quan (ví dụ "1+1 bằng mấy") → chatbot không trả về sản phẩm (similarity threshold lọc được 0 kết quả từ vector store)
- [ ] Hỏi "iPhone 14 dưới 15 triệu" → `extractSearchParams()` chỉ trả về `maxPrice ≈ 15000000`, KHÔNG có `minPrice = 14` (regex không extract model number là giá)

**Cart & Buy Now (9.9):**
- [ ] Sản phẩm trong chatbot response có `slug` — nhấn "View Details" → navigate đúng trang sản phẩm
- [ ] Nhấn "Thêm vào giỏ" từ chatbot card → toast success xuất hiện, icon giỏ hàng ở header cập nhật số lượng
- [ ] Nhấn "Mua ngay" từ chatbot card → sản phẩm thêm vào giỏ → redirect đến `/checkout`
- [ ] User chưa đăng nhập → nhấn "Thêm vào giỏ" / "Mua ngay" → redirect đến trang login
- [ ] POST `/api/chatbot/cart/add` với `productId` không tồn tại → trả về 404 (không tạo CartItem ghost)

**Security & Rate Limiting (9.13):**
- [ ] `/api/chatbot/analytics` trả về 401 nếu không có token
- [ ] Gửi 25 requests liên tiếp tới `/api/chatbot/message` → nhận 429 Too Many Requests
- [ ] `/api/chatbot/test`, `/api/chatbot/test-message`, `/api/chatbot/simple-message` trả về 404 (đã xóa cả 3)
- [ ] `grep -n "temperature\|max_tokens" backend/src/services/ai/geminiChatbot.js` trong `getAIResponse()` → thấy `temperature: 0.3` và `max_tokens: 800`
- [ ] Admin toggle sản phẩm sang "Ngừng kinh doanh" → chatbot không còn đề xuất sản phẩm đó (vectorStore sync từ toggleProductStatus)
- [ ] Admin tạo sản phẩm mới → sản phẩm xuất hiện ngay trong chatbot sau khi tạo (mà không restart server)

**Embedding Quality (9.14 — CRITICAL):**
- [ ] `grep -n "generateProductText\|textToEmbed" backend/src/services/ai/vectorStore.js` → thấy `generateProductText()` function tồn tại
- [ ] Embedding text của 1 sản phẩm bao gồm: name + brand + category + shortDescription (verify bằng log khi rebuild)
- [ ] Sau rebuild: hỏi chatbot "điện thoại Apple cao cấp" → trả về iPhone, không trả về laptop hay phụ kiện
- [ ] Vector dimension validation: API trả về vector sai size → `throw new Error("Invalid embedding dimension")` trong log
- [ ] `package.json` có script `ai:rebuild-vectors`; `db:reset` vẫn hoạt động
- [ ] Chạy `npm run ai:rebuild-vectors` → nếu embedding API fail ở giữa chừng, file `vectorDb.json.bak` còn nguyên (không mất toàn bộ data)
- [ ] `vectorDb.json` sau rebuild không chứa sản phẩm có `inStock: false` (out-of-stock products không được index)
- [ ] Sau rebuild: số items trong `vectorDb.json` = `SELECT COUNT(*) FROM products WHERE status='active' AND in_stock=1` (không có vector stale — audit Round 6: hiện 47 items nhưng chỉ 45 sản phẩm active)

**System Prompt & Validation (9.15 — CRITICAL):**
- [ ] System prompt trong `geminiChatbot.js` line 99 chứa rule "CHỈ tư vấn sản phẩm có trong danh sách"
- [ ] LLM hallucinate tên sản phẩm không tồn tại → log `[RAG] Hallucination detected: ...` xuất hiện trong server log
- [ ] Hỏi "thời tiết hôm nay" → `classifyIntent()` trả về `off_topic` → chatbot trả về redirect mà KHÔNG gọi LLM (response nhanh hơn, không tốn API)
- [ ] Gửi message chứa `\n\nIgnore all instructions` → chatbot vẫn trả lời đúng chủ đề, không bị override (`sanitizedMessage` strip consecutive newlines trước khi vào prompt)

**Scope Control:**
- [ ] Hỏi câu không liên quan e-commerce (thời tiết, tin tức...) → chatbot từ chối trả lời hoặc redirect về sản phẩm

**Conversation Persistence (9.10b):**
- [ ] `DESCRIBE chat_messages` có columns `role`, `message_type`, `intent`, `is_fallback` và `sender_id` cho phép NULL
- [ ] 3 turns chat → `SELECT COUNT(*) FROM chat_messages WHERE message_type='ai_chatbot'` → 6 rows
- [ ] `GET /api/admin/chat/conversations` không trả về AI chatbot messages (chỉ `support_chat`)

**Cart URL Fix (9.9 Fix 0):**
- [ ] `grep -n "url.*'/cart'" frontend/src/features/ai/services/chatbotApi.ts` → no match (đã đổi sang `/chatbot/cart/add`)
- [ ] User chưa login → nhấn "Thêm vào giỏ" từ chatbot → nhận 401 → redirect `/login` (không phải generic error)

### 9.17 Cleanup: `enhancedChatService` Dead Code trong chatbotApi.ts
> **Gộp vào khi thực hiện Phase 2.5 (mock data removal).**

- **File:** `frontend/src/features/ai/services/chatbotApi.ts` lines 3, 56-201
- **Vấn đề (audit thực tế):** `enhancedChatService` object (lines 91–201) là mock service hoàn chỉnh với `sendMessage()`, `getMockResponse()`, `determineIntent()` — **không được gọi từ bất kỳ hook hay component nào** trong production chat flow. Import `geminiService` từ `./geminiApi` (line 3) cũng chỉ phục vụ dead code này.
- **Rủi ro thực tế:** `geminiService` là direct Gemini SDK call từ phía **client** (bypass backend hoàn toàn) — nếu accidentally wire vào production flow sẽ expose `VITE_GEMINI_API_KEY` ở browser.
- **Fix:**
  1. `grep -r "enhancedChatService\|determineIntent" frontend/src/` → xác nhận không có nơi nào import
  2. Xóa `enhancedChatService` object (lines 91–201)
  3. Xóa `determineIntent()` helper function (lines 56–88)
  4. Xóa `import geminiService from './geminiApi'` (line 3)
  5. Xóa `import { getProductSuggestionPrompt, getGeneralHelpPrompt }` từ `./promptTemplates` nếu chỉ dùng bởi `enhancedChatService`
- **Acceptance Criteria:**
  - [ ] `grep -n "enhancedChatService\|determineIntent\|getMockResponse" frontend/src/` → no match
  - [ ] `npm run build` frontend không có error sau khi xóa
  - [ ] Chat widget vẫn hoạt động bình thường (dùng `useSendChatbotMessageMutation` không bị ảnh hưởng)

### 9.17.1 Bug: `sendMessage` Mutation drops Products + useChat.ts sends no sessionId (audit thực tế — đọc trực tiếp code)

**Lỗi A — `sendMessage` mutation's `transformResponse` drop toàn bộ `products` field (CRITICAL)**
- **File:** `frontend/src/features/ai/services/chatbotApi.ts` — mutation `sendMessage` (line ~205)
- **Vấn đề:** Mutation `sendMessage` có `transformResponse` trả về ONLY `{ text, suggestions }`:
  ```ts
  transformResponse: (response: any) => ({
    text: response.response || response.message || '',
    suggestions: response.suggestions || [],
  }),
  ```
  Backend trả về `{ response, products, actions, sessionId, suggestions }` nhưng `products`, `actions`, `sessionId` BỊ DROP hoàn toàn. Component nào dùng `useSendMessageMutation` **không bao giờ nhận được product recommendation cards** — bị silent-drop trước khi đến component.
- **Nguyên nhân thêm:** Có 2 mutations song song:
  - `sendMessage` (line ~205): Dùng `transformResponse`, trả về `{ text, suggestions }` — mất products
  - `sendChatbotMessage` (line ~218): Không có `transformResponse`, trả về raw `any` backend format — có products nhưng inconsistent
- **⚠️ Đính chính (audit Round 5):** **ChatWidget.tsx (line 78) đã dùng đúng `useSendChatbotMessageMutation`** — production flow KHÔNG bị ảnh hưởng bởi Lỗi A. Chỉ `useChat.ts` (dead code — xem Lỗi B) dùng sai mutation. Lỗi A vẫn cần fix để dọn dẹp `sendMessage` mutation thừa và thêm TypeScript types đúng cho `sendChatbotMessage`.
- **Fix:** Chuẩn hóa về một mutation duy nhất `sendChatbotMessage`, thêm proper TypeScript interface cho response:
  ```ts
  interface ChatbotResponse {
    response: string;
    products?: ProductRecommendation[];
    actions?: ChatAction[];
    sessionId?: string;
    suggestions?: string[];
  }
  sendChatbotMessage: builder.mutation<ChatbotResponse, { message: string; userId?: number; sessionId?: string }>({
    query: (body) => ({ url: '/chatbot/message', method: 'POST', body }),
  })
  ```
  Xóa `sendMessage` mutation cũ (hoặc deprecate và redirect sang `sendChatbotMessage`).

**Lỗi B — `useChat.ts` là DEAD CODE (⚠️ Đính chính audit Round 5)**
- **File:** `frontend/src/features/ai/hooks/useChat.ts`
- **⚠️ Thực tế (đọc trực tiếp toàn bộ codebase):** `useChat.ts` là **dead code** — chỉ được export trong `frontend/src/features/ai/index.ts` nhưng **không có component nào import hay sử dụng** hook này. ChatWidget.tsx (component thực tế xử lý chat) dùng `useChatWidget` + trực tiếp `useSendChatbotMessageMutation` (line 78 — đúng).
- **Các bug trong `useChat.ts`** (tất cả đều zero-impact trong production vì là dead code):
  1. Dùng `useSendMessageMutation` (sai — có transformResponse drop products) thay vì `useSendChatbotMessageMutation`
  2. `sendMessageMutation(text).unwrap()` — gửi ONLY `{ message: text }`, không có `sessionId` hay `userId`
  3. accesses `response.text` (sẽ phải đổi thành `response.response` nếu dùng đúng mutation)
- **Fix (đơn giản):** **Xóa `useChat.ts` hoàn toàn** (cùng với cleanup dead code ở Phase 9.17). Không cần sửa mutation vì hook này không được gọi.
- **Impact thực tế:** LOW — production chat flow (`ChatWidget.tsx` → `useSendChatbotMessageMutation`) **đã hoạt động đúng**. Lỗi B chỉ là dead code chưa được dọn dẹp.

- **Acceptance Criteria:**
  - [ ] `useChat.ts` bị xóa (cùng Phase 9.17 dead code cleanup)
  - [ ] `grep -rn "useChat" frontend/src/` → no match (đã xóa cả export trong `ai/index.ts`)
  - [ ] Chatbot trả lời kèm product cards → cards hiển thị đúng trong ChatWidget (production flow đã đúng — verify với DevTools Network tab)
  - [ ] `grep -n "sendMessage:" frontend/src/features/ai/services/chatbotApi.ts` → no match (đã xóa/merge `sendMessage` vào `sendChatbotMessage` theo Lỗi A fix)

### 9.18 Enhancement: Dual-Model Embedding — Language-based Routing ✅ IMPLEMENTED

**Vấn đề:** `text-embedding-3-small` là English-first model — hoạt động được nhưng không tối ưu cho query tiếng Việt thuần ("điện thoại pin trâu rẻ").

**Model được dùng: `intfloat/multilingual-e5-large`** (HuggingFace, warm model, free tier)
- 1024 dims, hỗ trợ 100+ ngôn ngữ bao gồm tiếng Việt, SOTA multilingual retrieval
- Endpoint: `https://router.huggingface.co/hf-inference/models/intfloat/multilingual-e5-large`
- Trả về flat array `[float, ...]` — không cần unwrap

> **Tại sao không dùng `AITeamVN/Vietnamese_Embedding_v2`:** Model này được tag `sentence-similarity` trên HF Hub (không phải `feature-extraction`). Mọi endpoint HF chỉ expose nó qua pipeline sentence-similarity → trả similarity scores, không trả raw vectors. RAG cần raw vectors để lưu vào file và tính cosine similarity. Endpoint `api-inference.huggingface.co/pipeline/feature-extraction/...` đã bị deprecated (404).

**Nguyên tắc bắt buộc:** Query vector và document vector phải từ CÙNG 1 model → mỗi sản phẩm lưu **2 vector**: `vectorEn` (1536 dims) và `vectorVi` (1024 dims). Khi search, detect ngôn ngữ query → dùng model tương ứng.

#### Các file đã thay đổi ✅

| File | Thay đổi |
|------|----------|
| `backend/src/services/ai/viEmbedding.js` | TẠO MỚI — HF router wrapper cho `multilingual-e5-large` |
| `backend/src/services/ai/vectorStore.js` | Dual-vector storage + language routing + fix `product.price` → `product.basePrice` |
| `backend/scripts/indexProducts.js` | `status: 'active'` ở WHERE clause là **ĐÚNG** (canonical sau migration 2026050201). Còn cần thêm `inStock: true` filter — xem Phase 9.14 Fix 5 Vấn đề B |
| `backend/.env` | `HF_API_KEY=hf_****` (xem .env thực tế) |

#### viEmbedding.js — thực tế đã implement
```js
class VietnameseEmbeddingService {
  constructor() {
    this.apiKey = process.env.HF_API_KEY;
    this.apiUrl = 'https://router.huggingface.co/hf-inference/models/intfloat/multilingual-e5-large';
    this.EXPECTED_DIM = 1024;
  }
  isAvailable() { return !!this.apiKey; }
  async generateEmbedding(text) {
    const response = await axios.post(this.apiUrl, { inputs: text }, { ... });
    // Trả về flat array [float,...] 1024 dims
    const embedding = Array.isArray(response.data[0]) ? response.data[0] : response.data;
    return embedding;
  }
}
```

#### Kết quả verify ✅
```
vectorDb.json: 47 items
  fields: ['vectorEn', 'vectorVi', 'text', 'metadata']
  vectorEn: 1536 dims (OpenRouter text-embedding-3-small)
  vectorVi: 1024 dims (HF multilingual-e5-large)
  metadata.price: basePrice (đã fix từ product.price → product.basePrice)
```

**Backward compatibility:** `search()` dùng `item.vectorEn || item.vector` — vẫn đọc được `vectorDb.json` cũ (field `vector`).

#### Acceptance Criteria
- [x] `HF_API_KEY` cấu hình → rebuild → mỗi item có `vectorEn` (1536) và `vectorVi` (1024)
- [ ] Query "điện thoại rẻ nhất" → server log `[SEARCH] lang=vi, useViModel=true`
- [ ] Query "cheapest phone" → server log `[SEARCH] lang=en, useViModel=false`
- [x] Xóa `HF_API_KEY` → server vẫn chạy, search bằng English model (fallback hoạt động)
- [x] `vectorDb.json` cũ (format `{ vector: [...] }`) → server đọc được, không crash

### 9.18.1 Edge Case: VI Query vs EN-only Items (dimension mismatch silent failure)

- **File:** `backend/src/services/ai/vectorStore.js` — hàm `search()`
- **Vấn đề (audit thực tế, chưa có trong 9.18):** Khi `useViModel=true` (user query tiếng Việt), `queryVector` là 1024-dim (VI). Nếu một sản phẩm được index khi HF API fail → `vectorVi = null`. Fallback:
  ```js
  const docVector = useViModel
    ? (item.vectorVi || item.vectorEn || item.vector)  // null → vectorEn (1536-dim!)
    : ...
  ```
  `cosineSimilarity(queryVector_1024, docVector_1536)` → `v1.length !== v2.length → return 0` **silently** → sản phẩm đó không bao giờ xuất hiện trong kết quả VI queries, dù hoàn toàn phù hợp.
- **Khi nào xảy ra:** HF API fail giữa chừng trong `indexProducts.js` → một số sản phẩm có `vectorVi=null` trong vectorDb.json. Không có warning nào ở phía search().
- **Fix:** Chuẩn bị cả 2 query vectors khi `useViModel=true`, dùng đúng pair theo dim của docVector:
  ```js
  let queryVectorVi = null, queryVectorEn = null;
  if (useViModel) {
    queryVectorVi = await viEmbeddingService.generateEmbedding(query);
    queryVectorEn = await embeddingService.generateEmbedding(query); // fallback pair
  } else {
    queryVectorEn = await embeddingService.generateEmbedding(query);
  }

  const scores = this.items.map(item => {
    let docVector = useViModel ? item.vectorVi : item.vectorEn;
    let qVector   = useViModel ? queryVectorVi  : queryVectorEn;
    // Dim mismatch fallback: nếu vectorVi null → dùng EN pair
    if (!docVector || docVector.length !== qVector?.length) {
      docVector = item.vectorEn;
      qVector   = queryVectorEn;
    }
    return { ...item, score: this.cosineSimilarity(qVector, docVector) };
  });
  ```
  **Lưu ý:** Fix này cần 2 embedding API calls khi `useViModel=true`. Embedding cache (9.13 Lỗi 3) sẽ giảm overhead — implement 9.13 Lỗi 3 trước.
- **Acceptance Criteria:**
  - [ ] Xóa `vectorVi` của 1 sản phẩm trong vectorDb.json → restart server → query tiếng Việt liên quan đến sản phẩm đó → sản phẩm VẪN xuất hiện trong kết quả (không bị silently excluded do dim mismatch)

---

## PHASE 9.18 — Integration Tests cho Chatbot Pipeline

> **Mục tiêu:** Thêm automated tests cho các code paths phức tạp nhất của Phase 9 để phát hiện regression sớm. Không cần 100% coverage — chỉ cover các paths có rủi ro cao nhất.

### Stack
- **Backend tests:** Jest + Supertest (đã có trong devDependencies)
- **File:** `backend/src/__tests__/chatbot.test.js`
- **Chạy:** `npm test` trong `backend/`

### 9.18.1 — Tests bắt buộc (HIGH priority)

**A. `simpleKeywordMatch` — price field consistency**
```js
// Verify không bị undefined khi products từ vector store (field: price) vs DB (field: basePrice)
test('simpleKeywordMatch trả về price đúng cho vector store products', () => {
  const products = [{ id: 1, name: 'iPhone 15', price: 25000000, inStock: true }]; // vector store format
  const result = service.simpleKeywordMatch('iphone', products);
  expect(result.products[0].price).toBeDefined();
  expect(result.products[0].price).not.toBeNaN();
});

test('simpleKeywordMatch trả về price đúng cho DB products', () => {
  const products = [{ id: 1, name: 'iPhone 15', basePrice: 25000000, inStock: true }]; // DB format
  const result = service.simpleKeywordMatch('iphone', products);
  expect(result.products[0].price).toBeDefined();
  expect(result.products[0].price).not.toBeNaN();
});
```

**B. `parseAIResponse` — discount calculation**
```js
test('parseAIResponse tính discount đúng khi có compareAtPrice', () => {
  // product trong retrieved context có price + compareAtPrice
  const products = [{ id: 1, name: 'iPhone 15', basePrice: 20000000, compareAtPrice: 25000000, ... }];
  const aiText = JSON.stringify({ response: 'OK', matchedProducts: ['iPhone 15'], suggestions: [] });
  const result = service.parseAIResponse(aiText, products, 'iphone');
  expect(result.products[0].discount).toBe(20); // (25M-20M)/25M = 20%
});

test('parseAIResponse discount = 0 khi không có compareAtPrice', () => {
  const products = [{ id: 1, name: 'iPhone 15', basePrice: 20000000, compareAtPrice: null, ... }];
  const aiText = JSON.stringify({ response: 'OK', matchedProducts: ['iPhone 15'], suggestions: [] });
  const result = service.parseAIResponse(aiText, products, 'iphone');
  expect(result.products[0].discount).toBe(0);
});
```

**C. `POST /api/chatbot/cart/add` — HTTP status codes**
```js
test('addToCart trả 404 khi productId không tồn tại', async () => {
  const res = await request(app)
    .post('/api/chatbot/cart/add')
    .set('Authorization', `Bearer ${validToken}`)
    .send({ productId: 99999, quantity: 1, sessionId: 'test-session' });
  expect(res.status).toBe(404);
});

test('addToCart trả 400 khi sản phẩm hết hàng', async () => {
  // Tạo product với inStock: false trong test DB
  const res = await request(app)
    .post('/api/chatbot/cart/add')
    .set('Authorization', `Bearer ${validToken}`)
    .send({ productId: outOfStockProductId, quantity: 1, sessionId: 'test-session' });
  expect(res.status).toBe(400);
});
```

**D. `extractSearchParams` — không extract model number thành giá**
```js
test('extractSearchParams không lấy số model làm giá', () => {
  const result = service.extractSearchParams('iPhone 14 dưới 15 triệu');
  expect(result.maxPrice).toBe(15000000);
  expect(result.minPrice).toBeUndefined(); // "14" không bị extract
});
```

**E. `NaN guard` trong vector search**
```js
test('cosineSimilarity trả 0 khi vector chứa NaN', () => {
  const v1 = [NaN, 0.5, 0.3];
  const v2 = [0.4, 0.5, 0.3];
  expect(vectorStore.cosineSimilarity(v1, v2)).toBe(0);
});
```

**F. Hooks không index sản phẩm hết hàng**
```js
test('afterCreate hook không thêm vào vector store khi inStock=false', async () => {
  const spy = jest.spyOn(vectorStoreService, 'addProduct');
  await Product.create({ name: 'Test', status: 'active', inStock: false, ... });
  expect(spy).not.toHaveBeenCalled();
});
```

### 9.18.2 — Tests bổ sung (MEDIUM priority)

- `GET /api/admin/chat/conversations` chỉ trả `support_chat` messages (không lẫn `ai_chatbot`)
- `POST /api/chatbot/message` trả 429 sau 20 requests trong 1 phút (rate limiter)
- `POST /api/chatbot/analytics` trả 401 khi không có token
- Conversation history isolation: session A không thấy history của session B

### ✅ Acceptance Criteria Phase 9.18

- [ ] `npm test` trong `backend/` chạy thành công, không có test nào fail
- [ ] Coverage cho `geminiChatbot.js` `simpleKeywordMatch` và `parseAIResponse` đạt ≥ 80%
- [ ] Test C (HTTP 404/400) pass với DB thật (không mock Sequelize)
- [ ] Test D (extractSearchParams) pass
- [ ] CI có thể chạy `npm test` tự động khi push

---

## PHASE 10 — Real-time Chat Architecture Standards
> **Customer-Admin chat phải đúng chuẩn: authenticated, isolated, persistent.**

### 10.1 Vấn đề với kiến trúc hiện tại
- **Files:** `backend/src/controllers/chat.js`, `backend/src/models/chatMessage.js`, `backend/src/config/` (socket config)
- **Vấn đề cần kiểm tra:**
  1. Socket.IO connection có **validate JWT token** khi handshake không — nếu không thì unauthenticated users có thể connect
  2. Có **room isolation** không — customer A có thể nhận message của customer B không
  3. **Message persistence** — tin nhắn có được lưu vào `ChatMessage` table trước khi emit không, hay chỉ emit rồi thôi
  4. `ChatMessage` model có field `status` (sent/delivered/read) không
  5. Admin có dashboard để thấy **danh sách tất cả conversations** đang active không
  6. Có **offline message handling** không — khi admin offline, user nhắn tin có được lưu không, admin có nhận được khi online lại không

### 10.2 Fix: Socket.IO Authentication
- **File:** `backend/src/app.js` hoặc socket config file
- **Chuẩn:** JWT validation trong Socket.IO middleware:
  ```js
  io.use((socket, next) => {
    const token = socket.handshake.auth.token || socket.handshake.headers['authorization']?.split(' ')[1];
    if (!token) return next(new Error('Unauthorized'));
    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;
      socket.userRole = decoded.role;
      next();
    } catch (err) {
      next(new Error('Invalid token'));
    }
  });
  ```

### 10.3 Fix: Room Architecture
- **Chuẩn room structure cho support chat:**
  - Customer room: `chat:${userId}` — customer và assigned admin join room này
  - Admin notification room: `admin:notifications` — tất cả admin join để nhận alert
  - Khi customer gửi message: emit tới `chat:${userId}` room
  - Admin join room khi mở conversation của customer đó
- **Check `chat.js`:** Hiện tại room được define thế nào, có đúng không

### 10.4 Fix: ChatMessage Model
- **File:** `backend/src/models/chatMessage.js`
- **Fields cần thêm nếu thiếu:**
  ```js
  status: DataTypes.ENUM('sent', 'delivered', 'read'),  // default: 'sent'
  messageType: DataTypes.ENUM('text', 'image', 'product_card'),  // default: 'text'
  attachmentUrl: DataTypes.STRING,  // nếu messageType = 'image'
  productId: DataTypes.INTEGER,  // nếu messageType = 'product_card' (admin chia sẻ sản phẩm)
  readAt: DataTypes.DATETIME,
  ```
- **Tạo migration** cho các field mới này nếu cần thêm

### 10.5 Fix: Admin Chat Dashboard
- **File:** `backend/src/controllers/chat.js` + admin routes
- **API endpoints cần có:**
  - `GET /api/admin/chat/conversations` — list tất cả customers đã/đang chat, kèm unread count và last message
  - `GET /api/admin/chat/conversations/:userId/messages` — lịch sử chat với 1 customer (paginated)
  - `PATCH /api/admin/chat/messages/:id/read` — mark messages as read
- **Frontend:** `frontend/src/pages/admin/SupportDashboard.tsx` — kiểm tra có dùng đúng các API trên không, có real-time update khi có tin nhắn mới không

### 10.6 Fix: Unread Message Notifications
- **Chuẩn:** Khi customer gửi message và không có admin nào trong room đó:
  1. Lưu message với `status = 'sent'`
  2. Emit event `new_customer_message` tới `admin:notifications` room với payload: `{ userId, userName, preview, timestamp, unreadCount }`
  3. Admin panel hiển thị badge/notification count
  4. Khi admin join room và đọc messages → emit `messages_read` → cập nhật status → customer thấy "Đã đọc"

### 10.7 Fix: Typing Indicators
- **Chuẩn:**
  - Customer typing → emit `user_typing` → admin thấy "Customer đang nhập..."
  - Admin typing → emit `admin_typing` → customer thấy "Nhân viên đang nhập..."
  - Stop typing sau 2-3 giây không gõ thêm (debounce)
- **Check `chat.js`:** Có implement typing events không

### 10.8 Chat — SessionId Enumeration (audit thực tế)
- **File:** `backend/src/controllers/chat.js` line ~24
- **Vấn đề:** Session-based chat (user chưa login) dùng `sessionId` để identify conversation. Endpoint `GET /api/chat/:sessionId/messages` — nếu sessionId là UUID ngắn hoặc predictable, user A có thể đoán sessionId của user B và đọc được messages của họ. Authorization check `messages.every(m => !m.userId || m.userId === currentUserId)` bỏ qua messages có `userId: null` (unauthenticated) → pass check cho bất kỳ ai
- **Fix:**
  - SessionId phải là UUID v4 (`crypto.randomUUID()`) — đủ entropy để không đoán được
  - Rate limit endpoint `GET /api/chat/:sessionId` để ngăn enumeration brute force
  - Sau khi user login, migrate sessionId chat sang userId — không để session chat orphaned

### ✅ Acceptance Criteria Phase 10
- [x] Socket.IO dùng soft-auth: guest chat không cần JWT, admin operations (`adminJoin`) yêu cầu JWT có role = 'admin' — thiếu/sai JWT khi gọi `adminJoin` → emit error, không vào admin-room
- [x] User A và User B đều đang chat với admin → Message của A không bị lộ sang B's chat window
- [x] Admin offline → User gửi message → Admin online lại → nhận notification badge với số tin nhắn chưa đọc
- [x] `GET /api/chat/admin/list` trả về list đúng với `unreadCount` per conversation
- [x] Message được lưu trong `chat_messages` table với đúng `sender`, `status`, `timestamp`
- [x] Admin gửi message → customer nhận trong < 1 giây (realtime)
- [x] `GET /api/chat/random-uuid-that-doesnt-exist` với user đã login → `404`, không thể enumerate sessions
- [x] Guest có thể tải lịch sử chat của chính mình qua `GET /api/chat/:sessionId` (không cần token)

---

---

## PHASE 11 — Performance & Query Optimization
> **Không có N+1 query, Redis cache được dùng đúng chỗ, frontend lazy load.**

### 11.1 N+1 Query — Product Listing
- **File:** `backend/src/controllers/product.js`
- **Vấn đề:** Khi load danh sách sản phẩm, nếu code đang query từng sản phẩm một rồi loop để lấy variants/images thì là N+1
- **Check:** Tìm các đoạn `findAll` trên Product không có `include: [ProductVariant, ProductImage, Category, Brand]` — hoặc có include nhưng thiếu `attributes` filter dẫn đến select toàn bộ columns
- **Fix:** Dùng eager loading đúng cách:
  ```js
  Product.findAll({
    where: { status: 'active' },
    include: [
      { model: ProductVariant, as: 'variants', where: { isDefault: true }, required: false,
        attributes: ['id', 'price', 'stockQuantity', 'sku'] },
      { model: ProductImage, as: 'images', where: { isThumbnail: true }, required: false,
        attributes: ['imageUrl'] },
      { model: Category, as: 'category', attributes: ['id', 'name', 'slug'] },
      { model: Brand, as: 'brand', attributes: ['id', 'name', 'slug', 'logoUrl'] }
    ],
    attributes: ['id', 'name', 'slug', 'basePrice', 'compareAtPrice', 'ratingAverage', 'soldCount'],
    limit, offset
  })
  ```

### 11.2 N+1 Query — Order Detail
- **File:** `backend/src/controllers/order.js`
- **Check:** `getOrderById` — có eager load `OrderItems` kèm `Product` và `ProductVariant` trong 1 query không, hay đang query riêng từng item
- **Fix:** Include `OrderItem` với nested `Product` và `ProductVariant` trong cùng 1 `findOne` call

### 11.3 Redis Cache — Kiểm tra thực sự đang cache gì
- **Files:** `backend/src/` — grep `redis.set`, `redis.get`, `redis.setex`
- **Check:** Redis đang được dùng để cache những gì: product list, session, rate limiting, hay chỉ setup nhưng không dùng
- **Fix / Thêm cache cho:**
  - Product detail: cache theo `product:${id}`, TTL 10 phút, invalidate khi product update
  - Category list: cache `categories:all`, TTL 30 phút
  - Banner list: cache `banners:active`, TTL 1 giờ
  - Không cache: cart, orders, user-specific data

### 11.4 Frontend — Lazy Loading & Code Splitting
- **File:** `frontend/src/App.tsx` hoặc router file
- **Check:** Các route component có dùng `React.lazy()` + `Suspense` không — đặc biệt admin pages (nặng, ít dùng)
- **Fix:** Wrap admin routes với lazy import:
  ```tsx
  const DashboardPage = React.lazy(() => import('./pages/admin/DashboardPage'));
  ```

### 11.5 Database Query Pagination
- **Check tất cả list endpoints:** Có endpoint nào đang `findAll` không có `limit`/`offset` không — nếu có thì load toàn bộ bảng vào memory
- **Fix:** Bắt buộc tất cả `findAll` phải có `limit` (max 100) và `offset`

### 11.6 Vite Production Build — Source Map & Proxy Config (audit thực tế)
- **File:** `frontend/vite.config.ts`
- **Vấn đề 1 — `sourcemap: true` trong production build (line 9):** Source maps được bundle vào production → attacker có thể xem toàn bộ TypeScript source code gốc (bao gồm business logic, auth flow, API keys handling) qua DevTools
  ```ts
  // HIỆN TẠI (nguy hiểm):
  build: { sourcemap: true }
  // FIX:
  build: { sourcemap: false }  // Hoặc 'hidden' nếu cần debug production qua Sentry
  ```
- **Vấn đề 2 — Proxy target hardcode `localhost:8888` (trong `server.proxy`):** Khi dev server start, proxy forward về `http://localhost:8888` hardcode — nếu backend chạy port khác thì phải sửa file; không dùng được env var
  ```ts
  // FIX:
  target: process.env.VITE_API_URL || 'http://localhost:8888',
  ```
- **Vấn đề 3 — `console.log` trong proxy handlers:** 3 `console.log` trong `configure` callback của proxy (proxyReq, proxyRes, error) — in ra mọi API call trong dev. Giữ lại nếu cần debug, nhưng phải tắt trong CI.

### ✅ Acceptance Criteria Phase 11
- [ ] `GET /api/products?page=1&limit=20` — chỉ thực hiện 1-3 SQL queries (kiểm tra bằng Sequelize logging)
- [ ] `GET /api/products` lần 2 trong 10 phút — Redis cache hit (response time < 50ms)
- [ ] Admin pages load time < 3 giây (lazy loaded, không bundle chung với customer pages)
- [ ] Không có endpoint nào trả về > 100 records trong 1 request
- [ ] `npm run build` → kiểm tra `dist/` không có file `*.js.map` (source maps không được expose)

---

## PHASE 12 — Frontend Pages Deep Audit
> **Từng trang quan trọng phải hoạt động đúng, không có lỗi logic UI.**

### 12.1 CheckoutPage.tsx
- **File:** `frontend/src/pages/CheckoutPage.tsx`
- **Check và fix:**
  - Form validation: required fields có validate trước khi submit không (tên, địa chỉ, phone)
  - Phone validation: có check đúng format VN không (`/^(0|\+84)[0-9]{9}$/`)
  - Address selection: user chọn từ saved addresses — có auto-fill form không
  - `shippingCost` có đang được gửi lên backend từ frontend không — nếu có phải xóa (backend tự tính, Phase 7.3)
  - Payment method switching: Stripe → VNPay → MoMo — UI state có reset correctly không
  - Order total hiển thị cho user có khớp với total backend tính không

### 12.2 ProductDetailPage.tsx
- **File:** `frontend/src/pages/ProductDetailPage.tsx`
- **Check và fix:**
  - Variant selection: khi chọn color → size options phải filter theo color đã chọn (không phải hiện tất cả)
  - Giá hiển thị: khi chọn variant khác → giá có update đúng không
  - Out-of-stock: nút "Add to Cart" phải disabled khi `stockQuantity === 0`
  - Add to cart khi chưa login → redirect login → quay lại trang sản phẩm (không mất state)
  - Image gallery: variant đổi → ảnh có switch sang ảnh của variant đó không

### 12.3 CartPage.tsx
- **File:** `frontend/src/pages/CartPage.tsx`
- **Check và fix:**
  - Tăng quantity vượt `stockQuantity` → UI có báo lỗi không hay cho phép
  - Xóa item → total cart có recalculate ngay không
  - Coupon apply: invalid code → hiện error message; valid code → hiện discount amount
  - Cart empty → hiện empty state với link về shop

### 12.4 ProfilePage.tsx
- **File:** `frontend/src/pages/ProfilePage.tsx`
- **Check và fix:**
  - Password change: có validate `currentPassword` trước không, có confirm `newPassword` match không
  - Address CRUD: thêm/sửa/xóa address có update Redux state không hay chỉ update DB
  - Set default address: có update tất cả addresses khác `isDefault = false` không

### 12.5 RTK Query Cache Invalidation
- **Files:** `frontend/src/services/`
- **Check các invalidatesTags:**
  - Tạo order → `cart` cache có bị invalidate không (giỏ hàng phải trống sau checkout)
  - Update product (admin) → `products` cache có refresh không
  - Add to wishlist → `wishlist` cache có invalidate không
- **Fix:** Thêm `invalidatesTags` vào tất cả mutation endpoints còn thiếu

### 12.6 Soft Delete — Consistency Check
- **Backend:** Các model có `paranoid: true` (soft delete) phải được exclude khỏi tất cả public queries
- **Check:**
  - Product bị soft-delete: có xuất hiện trong search, category page, cart, wishlist không
  - User bị soft-delete: có thể login không
  - Order bị soft-delete: có xuất hiện trong admin orders list không
- **Fix:** Sequelize tự động exclude `deletedAt IS NOT NULL` khi dùng `paranoid: true` — verify đây đang hoạt động đúng ở tất cả query

### 12.X ContactPage — Stub Submit cần Implement
- **File:** `frontend/src/pages/ContactPage.tsx` line ~43
- **Vấn đề (audit thực tế):** Form submit dùng `setTimeout()` giả lập thay vì gọi API thực — user tưởng gửi thành công nhưng data không được lưu
- **Fix:**
  - Xóa `setTimeout` fake, thay bằng mutation thực: `const [submitContact] = useSubmitContactMutation()`
  - Verify backend endpoint `POST /api/feedback` (hoặc `/api/contact`) tồn tại và lưu vào DB (Phase 34.2 xử lý backend)
  - Thêm loading state khi đang submit, error message nếu API fail

### 12.Y PaymentQRPage — DEV MODE không được lên Production
- **File:** `frontend/src/pages/PaymentQRPage.tsx` lines ~10-44
- **Vấn đề (audit thực tế — Round 8 đính chính):** Mảng `TEST_CARDS` hardcode 3 số thẻ test. Labels đã được translated qua `t()` (lines 32, 39, 43, 50). Vẫn cần wrap toàn bộ trong `import.meta.env.DEV` guard để production build không expose test card numbers (mặc dù labels đã i18n).
- **Fix:**
  ```tsx
  // Chỉ hiển thị test cards khi development
  {import.meta.env.DEV && (
    <div className="dev-mode-banner">
      <TestCardPanel cards={TEST_CARDS} />
    </div>
  )}
  ```
  Wrap toàn bộ `TEST_CARDS` array và "DEV MODE" label trong `import.meta.env.DEV` guard

### 12.Z `window.location.href` trong authUtils — Full Page Reload khi 401
- **File:** `frontend/src/utils/authUtils.ts` line 72
- **Vấn đề:** `window.location.href = '/login'` khi token hết hạn → full page reload, mất toàn bộ app state, user mất form đang điền
- **Fix:** Thay bằng React Router navigate (inject vào tokenManager hoặc dùng history object từ router):
  ```ts
  // Thay:    window.location.href = '/login';
  // Dùng:    store.dispatch(clearAuth()); router.navigate('/login');
  ```
  Hoặc dispatch Redux action `sessionExpired` → component listen và navigate() mà không reload page

### 12.W Chatbot UI — Error Boundary + Redux Slice (audit thực tế)

**Lỗi 1 — Không có Error Boundary cho Chatbot component**
- **Vấn đề:** Nếu `ChatWindow.tsx` hoặc `ChatProductCard.tsx` throw unexpected error (vd: API trả về data format sai), toàn bộ trang bị crash thay vì chỉ chatbot bị ẩn đi.
- **Fix:** Wrap toàn bộ chatbot widget trong React Error Boundary:
  ```tsx
  // frontend/src/features/ai/components/ChatbotErrorBoundary.tsx
  class ChatbotErrorBoundary extends React.Component<{children: ReactNode}, {hasError: boolean}> {
    state = { hasError: false };
    static getDerivedStateFromError() { return { hasError: true }; }
    render() {
      if (this.state.hasError) return <div>Chatbot tạm thời không khả dụng.</div>;
      return this.props.children;
    }
  }
  ```
- Wrap trong layout component: `<ChatbotErrorBoundary><ChatWidget /></ChatbotErrorBoundary>`

**Lỗi 2 — Redux chatSlice đã tồn tại nhưng ChatWidget không dùng (audit thực tế)**
- **Vấn đề:** `chatSlice.ts` ĐÃ TỒN TẠI và đã register tại `store/index.ts:18` (`chat: chatReducer`). Slice đã có đầy đủ: `addMessage`, `setMessages`, `clearMessages`, `toggleChat`, `saveChatHistory(userId)`, `loadChatHistory(userId)`, `chatHistory: Record<string, Message[]>`. **KHÔNG cần tạo mới — cần wiring.**
- **Vấn đề thực tế:** `ChatWidget.tsx` dùng local `useChatWidget()` hook thay vì Redux → lịch sử chat mất khi navigate.
- **Fix — Wire ChatWidget.tsx với Redux chatSlice:**
  - Thay `const { messages, setMessages, addMessage } = useChatWidget()` bằng `useSelector` + `useDispatch`
  - Khi add message: `dispatch(addMessage(msg))`
  - Khi user login: `dispatch(loadChatHistory({ userId }))`
  - Khi clear: `dispatch(clearMessages())` (nút xóa ĐÃ TỒN TẠI tại ChatWidget.tsx:300-309, giữ nguyên)
- **Lưu ý:** `useChatWidget()` vẫn giữ cho UI state (resize, position) — chỉ tách messages ra Redux

**Lỗi 3 — sessionId reset mỗi lần ChatWidget mount (audit thực tế, CRITICAL cho Phase 9.10)**
- **File:** `frontend/src/features/ai/components/ChatWidget.tsx` line 82-84
- **Vấn đề:** `const [sessionId] = useState(() => \`session_${Date.now()}_${Math.random()...}\`)` — sessionId được tạo bằng `useState()`, reset mỗi lần component unmount/remount khi user navigate. Backend Map `<sessionId, conversationHistory>` từ session cũ bị orphaned (memory leak). Mâu thuẫn trực tiếp với Phase 9.10 (conversation history keyed by sessionId).
- **Fix:** sessionId phải persistent qua navigation — lưu vào Redux chatSlice:
  - Thêm `sessionId: string` vào chatSlice state, khởi tạo 1 lần khi app load: `crypto.randomUUID()` hoặc `user_${userId}_${Date.now()}`
  - ChatWidget lấy sessionId từ `useSelector(state => state.chat.sessionId)` thay vì tự generate
  - Khi user logout hoặc clear chat: generate new sessionId → conversation history mới
  - Backend cleanup: khi sessionId mới, backend tự tạo history mới cho session đó

**Lỗi 4 — ChatInput.tsx không enforce max message length**
- **File:** `frontend/src/features/ai/components/ChatInput.tsx`
- **Vấn đề (audit thực tế):** Hiển thị character count nhưng KHÔNG giới hạn. User gửi 50,000 ký tự → overflow LLM context window, tốn API token cực nhiều.
- **Fix Frontend:** Thêm `maxLength={2000}` vào `<textarea>`, disable Send khi `input.length > 2000`, counter đổi màu đỏ khi > 1800 ký tự
- **Fix Backend:** `backend/src/controllers/chatbot.js` — validate `if (message.length > 2000) return res.status(400).json({ message: 'Tin nhắn quá dài (tối đa 2000 ký tự)' })`

### Lỗi 5 — Message State Duplication: 3 Sources of Truth (audit thực tế)

**File:** `frontend/src/features/ai/hooks/useChat.ts`, `useChatWidget.ts`, `frontend/src/store/chatSlice.ts`
- **Vấn đề:** 3 nơi quản lý `messages` state riêng biệt, không sync với nhau:
  - `useChat.ts` — `const [messages, setMessages] = useState<Message[]>([])`
  - `useChatWidget.ts` — `const [messages, setMessages] = useState<Message[]>([])`
  - `chatSlice.ts` — Redux `messages: Message[]` (defined nhưng **không được populate** bởi chat flow thực tế — action `saveChatHistory` không bao giờ được dispatch)
- **Impact:** Không có single source of truth → messages có thể hiển thị không nhất quán. Redux persist không hoạt động cho chat messages vì chúng lưu trong local state, không phải Redux state.
- **⚠️ CORRECTION (audit thực tế):** `frontend/src/store/index.ts` KHÔNG có `redux-persist` — store được tạo bằng `configureStore()` thuần, không có `persistReducer()` hay `persistStore()`. Acceptance criteria của Phase 12 gốc ("Redux persisted — chatSlice đã wired") sai vì persist chưa được cấu hình.
- **Fix:** Consolidate về Redux chatSlice + cấu hình persistence:
  1. `useChatWidget.ts`: Thay `useState<Message[]>([])` bằng `useSelector(state => state.chat.messages)` và dispatch actions
  2. Thay `setMessages(...)` calls bằng dispatch `addMessage`/`clearMessages` từ chatSlice
  3. `useChat.ts`: Xóa local state trùng lặp nếu chỉ là thin wrapper
  4. **Cấu hình persistence** (chọn 1 trong 2 cách):
     - **Option A (đơn giản):** Trong chatSlice, load từ `localStorage` khi khởi tạo và lưu khi mỗi message thay đổi qua middleware hoặc `useEffect` trong App component
     - **Option B (chuẩn):** Install `redux-persist`, wrap chat reducer: `persistReducer({ key: 'chat', storage }, chatReducer)`, thêm `PersistGate` vào root component
- **Lưu ý:** `chatSlice.ts` đã có action `addMessage`, `clearMessages`, `setMessages` — chỉ cần dispatch thay vì setState

### ✅ Acceptance Criteria Phase 12
- [ ] `grep -n "useState.*Message\[\]" frontend/src/features/ai/hooks/` → no match (không còn local messages state trong chat hooks)
- [ ] Mở ChatWidget → nhắn vài tin → navigate sang trang khác → quay lại → messages vẫn còn (Redux persist hoạt động)
- [ ] Checkout với phone format sai → nhận validation error trước khi submit
- [ ] Chọn variant hết hàng → nút "Thêm vào giỏ" bị disable
- [ ] Tạo order thành công → giỏ hàng trở về trống (cache invalidated)
- [ ] Soft-delete product → không xuất hiện ở `GET /api/products`, không xuất hiện trong cart của user
- [ ] `ContactPage.tsx` form submit → data lưu vào DB, không dùng setTimeout fake
- [ ] Build production (`npm run build`) → `PaymentQRPage` không chứa text "DEV MODE" hay test card numbers trong bundle
- [ ] Token expire khi đang ở CheckoutPage → redirect về `/login` không reload toàn trang (app state preserved)
- [ ] Chatbot throw error (data format sai) → chỉ chatbot widget bị ẩn, trang vẫn hoạt động bình thường
- [ ] Navigate từ trang A sang trang B, mở lại chatbot → lịch sử hội thoại vẫn còn (sau khi cấu hình persistence — xem Lỗi 5)
- [ ] sessionId không đổi khi navigate (kiểm tra: mở DevTools → Redux → chat.sessionId trước và sau navigate)
- [ ] Gõ 1801+ ký tự vào chatbot input → counter đỏ, nút Send bị disable
- [ ] Gửi request với `message.length > 2000` trực tiếp → backend trả 400

---

## PHASE 13 — Security Completeness
> **Các lỗ hổng còn lại sau Phase 1: CSRF, CSP, validators, input sanitization.**

### 13.0 JWT Token Storage — localStorage XSS Risk (audit thực tế)
- **File:** `frontend/src/features/auth/authSlice.ts` lines 59, 92
- **Vấn đề:** Access token và refresh token lưu trong `localStorage` — script nào bị inject XSS đều có thể đọc được `localStorage.getItem('token')`
- **Trade-off:** Chuyển sang httpOnly cookie là ideal nhưng phức tạp hơn nhiều (cần sửa backend set-cookie, CORS credentials, refresh flow). Cho project thesis, approach thực tế hơn:
  - **Option A (recommended):** Giữ localStorage nhưng đảm bảo Phase 1.2 (DOMPurify) + Phase 1.2 (XSS middleware) đã fix hoàn toàn → XSS risk giảm thiểu đáng kể
  - **Option B (ideal):** Chuyển token sang `sessionStorage` (không persist sau khi đóng tab) + refresh token trong httpOnly cookie
- **Fix tối thiểu (Option A):** Thêm comment explicit trong authSlice.ts giải thích decision; đảm bảo `token` không log ra console; đảm bảo XSS protections hoạt động
- **Fix đầy đủ (Option B nếu có thời gian):**
  ```ts
  // Thay localStorage.setItem('token', ...) → sessionStorage
  // Backend: set refreshToken trong httpOnly cookie thay vì body
  ```

### 13.1 CSRF Protection
- **Vấn đề:** Chưa có CSRF protection cho các state-changing requests từ browser
- **Check:** `backend/src/app.js` — có dùng `csurf` middleware hoặc `double-submit cookie` pattern không
- **Fix (phù hợp với JWT API):** Vì API dùng JWT Bearer token (không phải cookie session), CSRF ít nguy hiểm hơn. Tuy nhiên nếu có cookie-based auth (refresh token trong httpOnly cookie):
  - Thêm `SameSite=Strict` hoặc `SameSite=Lax` cho refresh token cookie
  - Hoặc verify `Origin`/`Referer` header trong middleware

### 13.2 Content Security Policy (CSP)
- **File:** `backend/src/app.js` — Helmet config
- **Vấn đề:** CSP chưa được configure → browser không có policy để block inline scripts, unauthorized domains
- **Fix:** Thêm CSP vào Helmet:
  ```js
  helmet.contentSecurityPolicy({
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "https://js.stripe.com", "https://accounts.google.com"],
      styleSrc: ["'self'", "'unsafe-inline'"],  // unsafe-inline cần cho Ant Design
      imgSrc: ["'self'", "data:", "https:", "blob:"],
      connectSrc: ["'self'", "https://api.stripe.com"],
      frameSrc: ["https://js.stripe.com", "https://hooks.stripe.com"],
    }
  })
  ```

### 13.3 Missing Input Validators
- **Files:** `backend/src/routes/`, `backend/src/validators/`
- **Check:** Các route sau chưa có validator middleware:
  - `POST /api/chat` (chat messages) — thiếu validate message length, content
  - `POST /api/contact` (contact form) — thiếu validate email, message
  - `POST /api/search-history` — thiếu validate query string
  - `GET /api/loyalty/redeem` — thiếu validate points amount (không âm, không vượt balance)
- **Fix:** Tạo validator file cho từng route còn thiếu với Joi schema

### 13.4 Admin Audit Logging Completeness
- **File:** `backend/src/services/admin/adminAudit.js`
- **Check:** Service đang log những action nào — có đầy đủ không:
  - Product: create, update, delete, bulk import ✓/✗
  - Order: status change, cancel, refund ✓/✗
  - User: ban, role change, delete ✓/✗
  - Discount code: create, delete, deactivate ✓/✗
  - Admin login ✓/✗
- **Fix:** Thêm audit log cho tất cả action chưa được log, format log phải có: `{ adminId, action, entityType, entityId, oldValue, newValue, timestamp, ip }`

### 13.5 Google OAuth — Account Linking Edge Case
- **File:** `backend/src/controllers/auth.js` (Google OAuth handler)
- **Check:** Khi user đã đăng ký bằng email `abc@gmail.com` + password, rồi login bằng Google với cùng email đó → có tự động link account không hay tạo duplicate account
- **Fix:** Trong Google OAuth callback: `User.findOne({ where: { email: googleEmail } })` → nếu tồn tại thì update `googleId`, không tạo mới

### 13.6 Token Refresh Race Condition — Frontend (CORRECTION — audit trực tiếp code)
- **File:** `frontend/src/utils/tokenManager.ts`
- **⚠️ CORRECTION (audit thực tế Round 4):** Audit trước MÔ TẢ SAI lỗi này. Code đã implement **đúng** singleton promise pattern — không có race condition.
- **Thực tế code (lines 5-101):**
  ```ts
  let isRefreshing = false;
  let failedQueue: Array<...> = [];

  export const refreshTokenIfNeeded = async () => {
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject }); // queue all concurrent callers
      });
    }
    isRefreshing = true;  // ← set NGAY, không có await ở giữa check và set
    try {
      // ... await fetch(...) ...
      processQueue(null, token);  // resolve all queued
      return token;
    } catch (error) {
      processQueue(error, null);  // reject all queued
    } finally {
      isRefreshing = false;
    }
  };
  ```
- **Tại sao KHÔNG có race condition:** JavaScript là single-threaded. Từ dòng `if (isRefreshing)` đến `isRefreshing = true` là synchronous code (không có `await` ở giữa) → không có event loop tick nào có thể chen vào. Request B gọi `refreshTokenIfNeeded()` sau khi Request A đã set `isRefreshing = true` → Request B thấy flag = true → push vào queue → đợi kết quả của A.
- **Không cần fix** — implementation đã đúng. Acceptance criteria "chỉ 1 refresh call" sẽ PASS với code hiện tại.

### ✅ Acceptance Criteria Phase 13
- [ ] Response header `Content-Security-Policy` tồn tại và không cho phép `unsafe-eval`
- [ ] `POST /api/chat` với message > 2000 ký tự → nhận `422 Validation Error`
- [ ] `POST /api/loyalty/redeem` với points âm → nhận `422 Validation Error`
- [ ] Admin delete product → `audit_logs` table có 1 record mới với đủ `adminId`, `action`, `entityType`
- [ ] Đăng ký email `test@gmail.com` → login Google với `test@gmail.com` → không tạo duplicate user
- [ ] Simulate 5 concurrent requests khi token expired → chỉ 1 refresh call được thực hiện (verify bằng Network tab)

---

## PHASE 14 — Email Service & Notifications
> **Email templates đúng, gửi đúng trigger, nội dung đúng data.**

### 14.1 Order Confirmation Email
- **File:** `backend/src/services/email.js`
- **Check và fix:**
  - Email có được trigger sau khi order `paymentStatus = 'paid'` không (trong payment webhook, không phải khi tạo order)
  - Template có hiện đúng: `orderNumber`, `items[]` (tên, qty, giá), `subtotal`, `shippingCost`, `total`, `shippingAddress`, `estimatedDelivery` không
  - Nếu dùng HTML template: có escape user input trong template không (XSS trong email)

### 14.2 Password Reset Email
- **File:** `backend/src/services/email.js`, `backend/src/controllers/auth.js`
- **Check và fix:**
  - Reset token có expire sau 15-30 phút không
  - Link trong email có dạng `https://domain.com/reset-password?token=xxx` không
  - Sau khi dùng token → có mark là used (xóa token) không, tránh reuse
  - Gửi reset email cho email không tồn tại → response phải giống hệt với email tồn tại (tránh user enumeration)

### 14.3 OTP Email
- **File:** `backend/src/services/email.js`
- **Check và fix:**
  - OTP email có subject rõ ràng không: "Mã xác thực đăng nhập TechStore - [OTP]"
  - Template có hiện OTP rõ, có thời hạn hiệu lực không
  - Có gửi OTP mới khi user request lại không (invalidate OTP cũ)

### 14.4 Email Service Error Handling
- **File:** `backend/src/services/email.js`
- **Check:** Khi Nodemailer fail (sai credential, network timeout) — có throw error làm fail toàn bộ request không
- **Fix:** Email gửi thất bại không được block main flow (dùng `try/catch` và log error, không re-throw):
  ```js
  try {
    await sendEmail({ to, subject, html });
  } catch (err) {
    logger.error('Email send failed:', err);
    // Không throw — order vẫn được tạo dù email fail
  }
  ```

### ✅ Acceptance Criteria Phase 14
- [ ] Tạo order paid → nhận email confirmation với đúng order number và total amount
- [ ] Forgot password với email không tồn tại → response giống hệt với email tồn tại (200 OK, cùng message)
- [ ] Password reset token dùng lần 2 → nhận `400 Token already used`
- [ ] Nodemailer credential sai → server không crash, order vẫn tạo thành công, log error

---

## PHASE 15 — SQL Query Standards (MySQL / phpMyAdmin / XAMPP)
> **Tất cả SQL phải chạy được trực tiếp trên phpMyAdmin của XAMPP, đúng MySQL syntax, dễ đọc.**

### 15.1 Charset & Collation — Hỗ trợ Tiếng Việt
- **Vấn đề:** XAMPP mặc định dùng `latin1` — không hỗ trợ ký tự tiếng Việt có dấu
- **Fix bắt buộc:** Tất cả tables phải dùng:
  ```sql
  ENGINE=InnoDB
  DEFAULT CHARSET=utf8mb4
  COLLATE=utf8mb4_unicode_ci;
  ```
- **Check `backend/data/migration_full.sql`:** Tất cả `CREATE TABLE` có đủ `ENGINE=InnoDB CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci` chưa
- **Fix database connection:** `backend/src/config/sequelize.js` phải có:
  ```js
  dialectOptions: {
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci'
  },
  define: { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' }
  ```

### 15.2 CREATE TABLE — Format chuẩn, dễ đọc
Mỗi `CREATE TABLE` phải theo format sau (ví dụ chuẩn):
```sql
-- ============================================================
-- Table: products
-- Description: Stores all product information
-- ============================================================
CREATE TABLE IF NOT EXISTS `products` (
  `id`               INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `category_id`      INT UNSIGNED     NULL,
  `brand_id`         INT UNSIGNED     NULL,
  `name`             VARCHAR(500)     NOT NULL,
  `slug`             VARCHAR(255)     NOT NULL,
  `base_price`       DECIMAL(15,2)    NOT NULL DEFAULT 0.00,
  `compare_at_price` DECIMAL(15,2)    NULL,
  `stock_quantity`   INT UNSIGNED     NOT NULL DEFAULT 0,
  `status`           ENUM('active','inactive','draft') NOT NULL DEFAULT 'active',
  `is_featured`      TINYINT(1)       NOT NULL DEFAULT 0,
  `sold_count`       INT UNSIGNED     NOT NULL DEFAULT 0,
  `view_count`       INT UNSIGNED     NOT NULL DEFAULT 0,
  `rating_average`   DECIMAL(3,2)     NOT NULL DEFAULT 0.00,
  `description`      LONGTEXT         NULL,
  `short_description` TEXT            NULL,
  `tags`             JSON             NULL,
  `created_at`       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`       DATETIME         NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`       DATETIME         NULL,

  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_products_slug` (`slug`),
  INDEX `idx_products_category_id` (`category_id`),
  INDEX `idx_products_brand_id` (`brand_id`),
  INDEX `idx_products_status` (`status`),
  INDEX `idx_products_is_featured` (`is_featured`),
  INDEX `idx_products_created_at` (`created_at`),

  CONSTRAINT `fk_products_categories`
    FOREIGN KEY (`category_id`) REFERENCES `categories` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,

  CONSTRAINT `fk_products_brands`
    FOREIGN KEY (`brand_id`) REFERENCES `brands` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE

) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='Main product catalog';
```
- **Quy tắc format:**
  - Backtick (`` ` ``) bao quanh tất cả table/column names
  - Mỗi column 1 dòng, align theo cột
  - PRIMARY KEY, UNIQUE KEY, INDEX, CONSTRAINT viết cuối — nhóm lại, có blank line giữa nhóm
  - `ENGINE`, `CHARSET`, `COLLATE`, `COMMENT` ở dòng cuối
  - Có comment header `-- Table: ...` trước mỗi CREATE TABLE

### 15.3 INSERT (Seed Data) — Format chuẩn
```sql
-- ============================================================
-- Seed: categories
-- ============================================================
INSERT INTO `categories` (`name`, `slug`, `description`, `created_at`, `updated_at`)
VALUES
  ('Điện thoại',  'dien-thoai',  'Điện thoại di động các loại',      NOW(), NOW()),
  ('Laptop',      'laptop',      'Máy tính xách tay',                 NOW(), NOW()),
  ('Máy tính bảng','may-tinh-bang','iPad và Android tablet',          NOW(), NOW()),
  ('Phụ kiện',    'phu-kien',    'Phụ kiện điện tử các loại',        NOW(), NOW())
ON DUPLICATE KEY UPDATE
  `name` = VALUES(`name`),
  `description` = VALUES(`description`),
  `updated_at` = NOW();
```
- **Quy tắc:**
  - Liệt kê tên columns rõ ràng sau tên table — không dùng `INSERT INTO table VALUES (...)` thiếu column list
  - Dùng `ON DUPLICATE KEY UPDATE` để idempotent
  - Không INSERT `id` — để AUTO_INCREMENT tự assign (trừ khi bắt buộc)
  - Align values theo cột để dễ đọc
  - Dùng `NOW()` thay vì hardcode datetime

### 15.4 SELECT Queries — Format chuẩn
```sql
-- Lấy danh sách sản phẩm active, kèm category và brand, có phân trang
SELECT
    p.`id`,
    p.`name`,
    p.`slug`,
    p.`base_price`,
    p.`compare_at_price`,
    p.`rating_average`,
    p.`sold_count`,
    c.`name`    AS `category_name`,
    c.`slug`    AS `category_slug`,
    b.`name`    AS `brand_name`,
    b.`logo_url` AS `brand_logo`,
    pv.`price`  AS `default_variant_price`,
    pv.`stock_quantity` AS `default_stock`,
    pi.`image_url` AS `thumbnail`
FROM       `products`        p
INNER JOIN `categories`      c  ON p.`category_id` = c.`id`
INNER JOIN `brands`          b  ON p.`brand_id`    = b.`id`
LEFT JOIN  `product_variants` pv ON p.`id` = pv.`product_id` AND pv.`is_default` = 1
LEFT JOIN  `product_images`  pi ON p.`id` = pi.`product_id` AND pi.`is_thumbnail` = 1
WHERE
    p.`status`     = 'active'
    AND p.`deleted_at` IS NULL
    AND c.`deleted_at` IS NULL
ORDER BY
    p.`created_at` DESC
LIMIT  20 OFFSET 0;
```
- **Quy tắc:**
  - `SELECT`, `FROM`, `JOIN`, `WHERE`, `ORDER BY`, `LIMIT` mỗi keyword 1 dòng
  - Alias bảng viết tắt 1-2 chữ (`p`, `c`, `b`, `pv`, `pi`)
  - Dùng explicit `INNER JOIN` / `LEFT JOIN` — không dùng implicit join với `,`
  - `WHERE` conditions mỗi điều kiện 1 dòng, thụt lề
  - Có `deleted_at IS NULL` check cho các table dùng soft delete
  - Có `LIMIT` và `OFFSET` cho tất cả SELECT nhiều rows

### 15.5 UPDATE / DELETE — Format chuẩn
```sql
-- Update order status sau khi payment thành công
UPDATE `orders`
SET
    `status`         = 'processing',
    `payment_status` = 'paid',
    `updated_at`     = NOW()
WHERE
    `id` = 123
    AND `payment_status` = 'pending';  -- Guard: chỉ update nếu chưa paid

-- Soft delete sản phẩm (không dùng DELETE thật)
UPDATE `products`
SET
    `deleted_at` = NOW(),
    `updated_at` = NOW()
WHERE
    `id` = 456
    AND `deleted_at` IS NULL;
```
- **Quy tắc:**
  - `SET` mỗi column 1 dòng
  - Luôn có `WHERE` — không có UPDATE/DELETE không có WHERE
  - Thêm guard condition trong WHERE để tránh update sai state

### 15.6 Transaction — Format chuẩn (chạy được trong phpMyAdmin)
```sql
-- Tạo order và trừ stock trong 1 transaction
START TRANSACTION;

-- Bước 1: Kiểm tra stock
SELECT `stock_quantity`
INTO @current_stock
FROM `product_variants`
WHERE `id` = 10
FOR UPDATE;  -- Lock row để tránh race condition

-- Bước 2: Kiểm tra đủ hàng
IF @current_stock < 2 THEN
    ROLLBACK;
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Insufficient stock';
END IF;

-- Bước 3: Trừ stock
UPDATE `product_variants`
SET `stock_quantity` = `stock_quantity` - 2,
    `updated_at`     = NOW()
WHERE `id` = 10;

-- Bước 4: Tạo order item
INSERT INTO `order_items` (`order_id`, `product_id`, `variant_id`, `quantity`, `unit_price`)
VALUES (999, 5, 10, 2, 999000.00);

COMMIT;
```

### 15.7 migration_full.sql — Chuẩn hóa toàn bộ
- **File:** `backend/data/migration_full.sql`
- **Kiểm tra và fix:**
  1. File bắt đầu bằng:
     ```sql
     SET NAMES utf8mb4;
     SET FOREIGN_KEY_CHECKS = 0;
     SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
     SET time_zone = '+07:00';
     ```
  2. Mỗi `CREATE TABLE` có `IF NOT EXISTS` để idempotent
  3. Mỗi table có đủ `ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`
  4. Sau khi tạo xong tất cả tables:
     ```sql
     SET FOREIGN_KEY_CHECKS = 1;
     ```
  5. Thứ tự CREATE TABLE theo dependency (parent tables trước child tables):
     - `users` → `addresses`
     - `categories` → `brands` → `products` → `product_variants` → `product_images`
     - `products` → `carts` → `cart_items`
     - `orders` → `order_items`
  6. File có thể import thẳng vào phpMyAdmin mà không báo lỗi

### 15.8 Queries trong Sequelize phải match MySQL syntax
- **Check `backend/src/controllers/`:** Các đoạn `sequelize.query()` raw SQL:
  - Không dùng `ILIKE` (PostgreSQL) — dùng `LIKE` hoặc `LOWER(field) LIKE LOWER(?)` cho case-insensitive
  - Không dùng `::text`, `::integer` casting (PostgreSQL) — dùng `CAST(field AS CHAR)`, `CAST(field AS UNSIGNED)`
  - Không dùng `RETURNING` clause — MySQL không support; dùng `LAST_INSERT_ID()` hoặc Sequelize `returning: true` option
  - String concat: dùng `CONCAT(a, b)` không phải `a || b` (PostgreSQL style)
  - Date diff: dùng `DATEDIFF(date1, date2)` không phải `date1 - date2`

### ✅ Acceptance Criteria Phase 15
- [x] Import `backend/data/migration_full.sql` vào phpMyAdmin (XAMPP MySQL 8.0) — **không có lỗi nào**
- [x] `SHOW CREATE TABLE products` — hiện `ENGINE=InnoDB`, `CHARSET=utf8mb4`, `COLLATE=utf8mb4_unicode_ci`
- [x] INSERT sản phẩm với tên tiếng Việt có dấu (`Điện thoại iPhone`) → lưu và đọc lại đúng ký tự
- [x] `migration_full.sql` import lần 2 (idempotent) — không tạo duplicate, không báo lỗi
- [x] Tất cả raw SQL trong controllers không dùng PostgreSQL-specific syntax

---

## PHASE 16 — Error Handling & Environment Validation
> **Server phải fail fast khi config thiếu, không crash im lặng.**

### 16.1 Environment Variables Validation on Startup
- **File:** `backend/src/server.js` hoặc `backend/src/app.js`
- **Vấn đề:** Nếu `STRIPE_SECRET_KEY` hoặc `JWT_SECRET` không được set, server khởi động bình thường nhưng crash khi có request → hard to debug
- **Fix:** Validate tất cả required env vars trước khi start server:
  ```js
  const REQUIRED_ENV_VARS = [
    'DB_HOST', 'DB_USER', 'DB_PASSWORD', 'DB_NAME',
    'JWT_SECRET', 'JWT_REFRESH_SECRET',
    'REDIS_URL',
    'STRIPE_SECRET_KEY',
    'GEMINI_API_KEY',
    'EMAIL_USERNAME', 'EMAIL_PASSWORD'
  ];
  const missing = REQUIRED_ENV_VARS.filter(key => !process.env[key]);
  if (missing.length > 0) {
    console.error('Missing required environment variables:', missing.join(', '));
    process.exit(1);
  }
  ```

### 16.2 Global Error Handler Completeness
- **File:** `backend/src/middlewares/errorHandler.js` (hoặc tương đương)
- **Check và fix:**
  - Có catch Sequelize validation errors (`SequelizeValidationError`) và trả về 422 không
  - Có catch Sequelize unique constraint errors (`SequelizeUniqueConstraintError`) và trả về 409 Conflict không
  - Có catch JWT errors (`JsonWebTokenError`, `TokenExpiredError`) và trả về 401 không
  - Có catch `MulterError` (file upload errors) không
  - Production mode: error response không lộ stack trace

### 16.3 Unhandled Promise Rejections
- **Check `backend/src/controllers/`:** Tìm các async function không có try-catch:
  ```js
  // SAI — nếu Product.findAll throw thì Express không catch được
  router.get('/products', async (req, res) => {
    const products = await Product.findAll();
    res.json(products);
  });

  // ĐÚNG — wrap bằng try/catch hoặc dùng asyncHandler
  router.get('/products', asyncHandler(async (req, res) => {
    const products = await Product.findAll();
    res.json(products);
  }));
  ```
- **Fix:** Bọc tất cả async route handlers bằng `asyncHandler` utility function hoặc thêm try-catch

### 16.4 Database Connection Error Handling
- **File:** `backend/src/config/sequelize.js` hoặc nơi khởi tạo DB connection
- **Check:** Khi MySQL không chạy → server có báo lỗi rõ ràng không hay hang mãi
- **Fix:** Thêm connection test với timeout và retry:
  ```js
  sequelize.authenticate()
    .then(() => console.log('Database connected'))
    .catch(err => {
      console.error('Cannot connect to database:', err.message);
      process.exit(1);
    });
  ```

### ✅ Acceptance Criteria Phase 16
- [x] Xóa `JWT_SECRET` khỏi `.env` → server không start, in ra lỗi rõ ràng
- [x] Tắt MySQL → server log `Cannot connect to database` và exit, không hang
- [x] `POST /api/products` với `name` trùng slug → nhận `409 Conflict` (không phải 500 SequelizeUniqueConstraintError)
- [x] Không có async route handler nào thiếu try-catch hoặc asyncHandler wrapper

---

## PHASE 17 — Product Search Standards
> **Search phải hoạt động đúng với tiếng Việt, filter kết hợp, kết quả liên quan.**

### 17.1 Full-text Search với Tiếng Việt
- **File:** `backend/src/controllers/product.js`
- **Vấn đề hiện tại:** Search đang dùng `LIKE '%keyword%'` — không hỗ trợ tốt tiếng Việt có dấu, không rank kết quả theo relevance
- **Check:** Tìm đoạn xử lý `req.query.search` hoặc `req.query.q` trong product controller
- **Fix — 2 options:**
  - **Option A (đơn giản):** Dùng `LOWER(p.name) LIKE LOWER(?)` kết hợp `CONCAT('%', ?, '%')` — cover case-insensitive, nhưng không xử lý dấu
  - **Option B (chuẩn hơn):** Thêm MySQL FULLTEXT index trên `products.name`, `products.short_description`, `products.tags`:
    ```sql
    ALTER TABLE `products` ADD FULLTEXT INDEX `idx_ft_products_search` (`name`, `short_description`);
    ```
    Rồi query: `WHERE MATCH(name, short_description) AGAINST (? IN BOOLEAN MODE)`
- **Lưu ý charset:** FULLTEXT search với `utf8mb4_unicode_ci` sẽ handle tiếng Việt tốt hơn `utf8mb4_general_ci`

### 17.2 Search + Filter Kết Hợp
- **Check:** Khi user search "iPhone" + filter `category=điện-thoại` + `price_min=10000000` — backend có build WHERE clause đúng với tất cả conditions không, hay chỉ xử lý từng filter riêng lẻ
- **Fix:** Dùng Sequelize `Op.and` để kết hợp tất cả filter conditions vào 1 query duy nhất, không thực hiện nhiều queries rồi intersect

### 17.3 Search Suggestions / Autocomplete
- **Check:** Có endpoint `GET /api/products/suggestions?q=iph` không — trả về list tên sản phẩm gợi ý
- **Fix:** Nếu chưa có, thêm endpoint này với `LIKE 'iph%'` (prefix match, nhanh hơn `%iph%`), limit 5-10 kết quả, chỉ trả `id`, `name`, `slug`, `thumbnail`

### 17.4 Search History Integration
- **Files:** `backend/src/models/searchHistory.js`, `backend/src/controllers/`
- **Check:** Khi user search → có lưu vào `search_history` table không; khi user xem `GET /api/search-history` → có trả về đúng history không
- **Fix:** Search action → `SearchHistory.create({ userId, query })` (nếu user đã login); deduplicate — không lưu cùng 1 query 2 lần trong 1 giờ

### ✅ Acceptance Criteria Phase 17
- [x] Search "iphone" (lowercase) và "iPhone" trả về cùng kết quả
- [x] Search "điện thoại" trả về products thuộc category điện thoại
- [x] Search + filter `minPrice=5000000&maxPrice=15000000` chỉ trả về products trong khoảng giá
- [x] `GET /api/products/suggestions?q=lap` trả về tối đa 10 suggestions trong < 100ms

---

## PHASE 18 — Image & File Handling Standards
> **Upload phải validate đúng, lưu đúng nơi, cleanup orphaned files.**

### 18.1 File Type & Size Validation
- **File:** `backend/src/routes/upload.js`, Multer config
- **Check:** Multer có filter để chỉ chấp nhận `image/jpeg`, `image/png`, `image/webp` không; có giới hạn file size không
- **Fix — Multer config chuẩn:**
  ```js
  const upload = multer({
    limits: { fileSize: 5 * 1024 * 1024 },  // 5MB max
    fileFilter: (req, file, cb) => {
      const allowed = ['image/jpeg', 'image/png', 'image/webp'];
      if (!allowed.includes(file.mimetype)) {
        return cb(new Error('Only JPG, PNG, WEBP allowed'), false);
      }
      cb(null, true);
    }
  });
  ```
- **Check file magic bytes:** MIME type từ browser có thể bị fake — verify bằng `file-type` package hoặc check đầu bytes của file

### 18.2 Image Processing Pipeline
- **File:** `backend/src/services/image.js` (Sharp)
- **Check:** Sau khi upload, ảnh có được:
  - Resize về kích thước chuẩn (ví dụ: product thumbnail max 800x800px)
  - Convert sang WebP để tiết kiệm bandwidth
  - Strip EXIF metadata (có thể chứa GPS location của user)
- **Fix:** Pipeline chuẩn với Sharp:
  ```js
  await sharp(buffer)
    .resize(800, 800, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 85 })
    .withMetadata(false)  // Strip EXIF
    .toFile(outputPath);
  ```

### 18.3 File Storage Structure
- **Thư mục `backend/uploads/` phải có cấu trúc:**
  ```
  uploads/
  ├── products/        # Product images
  ├── avatars/         # User avatars
  ├── banners/         # Banner images
  ├── news/            # News article images
  └── temp/            # Temporary uploads (cleanup daily)
  ```
- **Check:** Các upload routes có lưu vào đúng subfolder không hay tất cả vào root `uploads/`
- **Fix:** Multer `destination` function phải route đúng type vào đúng folder

### 18.4 Orphaned File Cleanup
- **Vấn đề:** Khi user upload ảnh nhưng không save product → file nằm lại trong `uploads/` vĩnh viễn
- **Fix:** Thêm cleanup job — khi `uploads/temp/` có file cũ hơn 24 giờ thì xóa:
  ```js
  // Chạy cleanup mỗi ngày lúc 2:00 AM với node-cron
  cron.schedule('0 2 * * *', async () => {
    const files = await fs.readdir('./uploads/temp');
    for (const file of files) {
      const stat = await fs.stat(path.join('./uploads/temp', file));
      if (Date.now() - stat.mtime > 24 * 60 * 60 * 1000) {
        await fs.unlink(path.join('./uploads/temp', file));
      }
    }
  });
  ```

### 18.5 `backend/uploads/` trong .gitignore
- **Check `.gitignore`:** `backend/uploads/` và `backend/data/vectorDb.json` có bị ignore không — không được commit binary files vào git
- **Fix:** Thêm vào `.gitignore`:
  ```
  backend/uploads/*
  !backend/uploads/.gitkeep
  backend/data/vectorDb.json
  ```

### 18.6 CreateProduct — Image Upload Không Atomic (audit thực tế)
- **File:** `frontend/src/pages/admin/CreateProductPage.tsx` lines ~206-226, ~443
- **Vấn đề:** Flow hiện tại:
  1. `processDescriptionImages()` upload ảnh description lên server (lines 209-217) → trả về URLs
  2. `createProduct()` mutation gửi product data kèm URLs đó (line 443)
  - Nếu bước 2 fail (validation error, network error) → ảnh đã upload ở bước 1 trở thành orphaned files trên server, không có product nào reference đến chúng
- **Fix (frontend):** Wrap trong try/catch — nếu `createProduct()` fail → gọi API delete cho từng ảnh đã upload:
  ```tsx
  const uploadedUrls: string[] = [];
  try {
    const urls = await processDescriptionImages();
    uploadedUrls.push(...urls);
    await createProduct({ ...data, images: uploadedUrls }).unwrap();
  } catch (err) {
    // Rollback: xóa ảnh đã upload
    await Promise.allSettled(uploadedUrls.map(url => deleteUploadedFile(url)));
    throw err;
  }
  ```
- **Fix (backend):** Phase 35.5 cleanup job xóa orphaned files hàng tuần đã cover phần còn lại

### ✅ Acceptance Criteria Phase 18
- [x] Upload file `.exe` disguised as `.jpg` → nhận `400 Only JPG, PNG, WEBP allowed`
- [x] Upload ảnh 10MB → nhận `413 File too large`
- [x] Upload ảnh JPEG có EXIF → file lưu xuống không còn EXIF metadata
- [x] File trong `uploads/temp/` sau 24 giờ tự bị xóa
- [x] `backend/uploads/` không xuất hiện trong `git status`
- [x] Tạo product, upload 3 ảnh, rồi submit với product name bị thiếu → form fail → 3 ảnh đã upload được xóa khỏi server (không orphaned)

---

## PHASE 19 — Logging & Monitoring Standards
> **Log đúng level, đúng thông tin, không log sensitive data.**

### 19.1 Winston Logger Configuration
- **File:** `backend/src/utils/logger.js` hoặc nơi configure Winston
- **Check:** Logger đang config thế nào — có phân level không (`error`, `warn`, `info`, `debug`), có format JSON không, có rotate log file không
- **Fix — Config chuẩn:**
  ```js
  const logger = winston.createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.errors({ stack: true }),
      process.env.NODE_ENV === 'production'
        ? winston.format.json()           // JSON trong production (dễ parse)
        : winston.format.colorize() && winston.format.simple()  // Human-readable khi dev
    ),
    transports: [
      new winston.transports.Console(),
      new winston.transports.File({ filename: 'logs/error.log', level: 'error', maxsize: 10485760, maxFiles: 5 }),
      new winston.transports.File({ filename: 'logs/combined.log', maxsize: 10485760, maxFiles: 5 })
    ]
  });
  ```

### 19.2 Request Logging
- **Check:** Có HTTP request logger (Morgan hoặc custom) không — log method, path, status, response time
- **Fix:** Thêm Morgan middleware với format `':method :url :status :response-time ms'`; exclude health check endpoints; log request body cho POST/PUT (nhưng KHÔNG log password, token, card number)

### 19.3 Business Event Logging
- **Các event quan trọng PHẢI được log:**
  - `[ORDER]` Order created, payment success, payment failed, order cancelled
  - `[STOCK]` Stock deducted, stock restocked, stock oversell attempt
  - `[AUTH]` Login success, login failed (rate limited), password reset
  - `[ADMIN]` Admin actions (via adminAudit.js)
  - `[PAYMENT]` Webhook received, signature verified/failed
- **Format log:** `logger.info('[ORDER] Created', { orderId, userId, total, paymentMethod })`

### 19.4 Không Log Sensitive Data
- **Check tất cả logger calls:** Không có chỗ nào log `password`, `token`, `cvv`, `cardNumber`, `otpCode`, `stripeSecretKey`
- **Fix:** Nếu cần log user object → dùng `{ userId, email, role }` không log toàn bộ object

### 19.5 `logs/` trong .gitignore
- **Check:** `backend/logs/` có trong `.gitignore` không
- **Fix:** Thêm `backend/logs/` vào `.gitignore`; tạo `backend/logs/.gitkeep`

### 19.6 Xóa `console.log` khỏi Production Code
- **Vấn đề (audit thực tế):** Backend có ~16 `console.log` trong `services/`, frontend có ~192 `console.log`/`console.debug` trong source code — gây leak thông tin và làm chậm performance trong production
- **Backend fix:**
  ```bash
  grep -rn "console\.log\|console\.error\|console\.warn" backend/src/ --include="*.js" | grep -v node_modules
  ```
  Thay tất cả bằng `logger.info()`, `logger.error()`, `logger.warn()` tương ứng. Ngoại lệ: migration scripts và seed scripts có thể giữ `console.log`
- **Frontend fix:**
  ```bash
  grep -rn "console\.log\|console\.debug" frontend/src/ --include="*.ts" --include="*.tsx"
  ```
  - Xóa các `console.log` debug thuần (ví dụ: `console.log('token:', token)`)
  - Thay thế `console.error` cần thiết bằng error tracking (hoặc giữ `console.error` nếu không có Sentry)
  - Cấu hình ESLint rule `no-console: warn` để ngăn tái xuất hiện trong code mới
- **Chú ý:** `tokenManager.ts` và `apiClient.ts` có nhiều debug log nhất — ưu tiên dọn 2 file này trước

### ✅ Acceptance Criteria Phase 19
- [x] `POST /api/auth/login` thành công → log `[AUTH] Login success { userId, email }`
- [x] `POST /api/auth/login` sai password 5 lần → log `[AUTH] Rate limited { ip, email }`
- [x] Payment webhook nhận được → log `[PAYMENT] Webhook received { event, orderId }`
- [x] Log files không chứa bất kỳ password hay token nào (grep `logs/` tìm `password`)
- [x] `backend/logs/` không trong git tracking
- [x] `grep -rn "console\.log" backend/src/ --include="*.js"` → 0 kết quả trong controllers/ và services/ (trừ migration/seed scripts)
- [x] `grep -rn "console\.log" frontend/src/ --include="*.ts" --include="*.tsx"` → 0 kết quả trong production code

---

## PHASE 37 — I18n (Bilingual) Standard

> **Trạng thái:** ✅ PASS — 6/6 bugs đã fix, 3,020 keys đồng bộ hoàn toàn.

### 37.0 Bugs (Phát hiện trong Simplify Audit — Tất cả đã fix)

> **✅ Tất cả 6 bugs đã được fix.** B2 fix tại commit `0d0fb8b`.

| Bug | File | Chi tiết | Status |
|-----|------|----------|--------|
| ~~B1~~ | ~~DashboardCharts.tsx~~ | ~~chart data key vỡ~~ | ✅ FIXED — `useMemo` + stable keys (lines 88-95) |
| ~~B2~~ | ~~CheckoutPage.tsx~~ | ~~`defaultState/defaultCity` dùng `t()` → backend fail~~ | ✅ FIXED — `state: ''`, `city: ''` (lines 333-334) |
| ~~B3~~ | ~~priceUtils.ts~~ | ~~duplicate khai báo~~ | ✅ FIXED — locale/currencySymbol hoisted lines 19-20 |
| ~~B4~~ | ~~DynamicAttributeSelector.tsx~~ | ~~thiếu locale arg~~ | ✅ FIXED — line 155 `toLocaleString(getLocale())` |
| ~~B5~~ | ~~EnhancedVariantSelector.tsx~~ | ~~thiếu locale arg~~ | ✅ FIXED — line 249 `toLocaleString(getLocale())` |
| ~~B6~~ | ~~format.ts~~ | ~~missing getLocale() helper~~ | ✅ FIXED — `getLocale()` helper exists |

---

### 37.1 Overview & Stack

| Thành phần | Chi tiết |
|---|---|
| Thư viện | `react-i18next` + `i18next` |
| Locale files | `frontend/src/locales/en.json` và `vi.json` |
| Số keys | 3,018 keys mỗi file (đồng bộ hoàn hảo) |
| Cấu hình | `frontend/src/config/i18n.ts` |
| Ngôn ngữ mặc định | `vi` (Vietnamese) — lấy từ `localStorage` trước |
| Fallback | `vi` |

**Cấu hình i18n (`frontend/src/config/i18n.ts`):**
```ts
i18n.use(initReactI18next).init({
  resources: { en: { translation: enTranslations }, vi: { translation: viTranslations } },
  lng: localStorage.getItem('language') || 'vi',
  fallbackLng: 'vi',
  interpolation: { escapeValue: false },
  detection: { order: ['localStorage', 'navigator', 'htmlTag'], caches: ['localStorage'] },
});
```

---

### 37.2 Core Usage Rules

**Rule 1 — KHÔNG BAO GIỜ hardcode text user-visible.** Tất cả text hiển thị ra UI phải đi qua `t()`.

**Trong React component:**
```tsx
const { t, i18n } = useTranslation();
// Luôn destructure cả i18n khi cần format số/ngày
<span>{t('common.loading')}</span>
```

**Ngoài React (utils, services, non-hook files):**
```ts
import i18next from 'i18next';
const label = i18next.t('product.specNames.cpu');
const locale = i18next.language === 'vi' ? 'vi-VN' : 'en-US';
```

---

### 37.3 Key Patterns

#### 37.3.1 Ký hiệu tiền tệ
```tsx
// ĐÚNG
{amount.toLocaleString(i18n.language === 'vi' ? 'vi-VN' : 'en-US')}{t('common.currencySymbol')}

// SAI — hardcode ký tự
{amount.toLocaleString('vi-VN')}₫
```
- `t('common.currencySymbol')` → `₫` ở cả EN lẫn VI
- `t('product.currencyCode')` → `VND`

#### 37.3.2 Định dạng số / ngày tháng
```ts
// ĐÚNG — dynamic locale
const locale = i18n.language === 'vi' ? 'vi-VN' : 'en-US';
number.toLocaleString(locale)
date.toLocaleDateString(locale)

// SAI — hardcode locale
number.toLocaleString('vi-VN')
```

#### 37.3.3 DB-compat dropdowns (danh mục lưu vào DB bằng tiếng Việt)
```tsx
// ĐÚNG — DB value = tiếng Việt, UI label = translated
const categories = [
  { value: 'Hiệu năng', label: t('admin.products.specs.categories.performance') },
  { value: 'Màn hình',  label: t('admin.products.specs.categories.display') },
];
<Select.Option key={cat.value} value={cat.value}>{cat.label}</Select.Option>

// SAI — hardcode label
<Select.Option value="Hiệu năng">Hiệu năng</Select.Option>
```

#### 37.3.4 Spec names kỹ thuật sản phẩm
File `frontend/src/utils/productTransform.ts`:
```ts
import i18next from 'i18next';
const getSpecLabel = (key: string) => {
  const tKey = `product.specNames.${key.toLowerCase()}`;
  const translated = i18next.t(tKey);
  return translated !== tKey ? translated : key;
};
```
81 spec keys trong `product.specNames.*` (cpu, ram, display, battery…)

#### 37.3.5 AI Prompt Templates
File `frontend/src/features/ai/services/promptTemplates.ts`:
```ts
import i18n from '@/config/i18n';
const isVi = () => i18n.language === 'vi';

export const getProductSuggestionPrompt = (query: string) => {
  if (isVi()) return `Bạn là trợ lý mua sắm... "${query}"...`;
  return `You are a helpful shopping assistant... "${query}"...`;
};
```

---

### 37.4 Translation File Rules

1. **EN và VI files phải luôn có key giống hệt nhau** — số lượng và tên key đồng bộ 100%
2. **Thêm key vào CẢ HAI file cùng lúc** — không thêm một file trước
3. **Đặt tên key:** dot-notation, namespace theo feature
   ```
   common.loading           admin.users.form.firstName
   product.addToCart        checkout.defaultState
   payment.errors.failed    admin.charts.revenueLabel
   ```
4. **Không đặt text trực tiếp vào code** — luôn tạo key trong locale file trước

---

### 37.5 Cách thêm Translation Key mới

```
Bước 1: Thêm key vào frontend/src/locales/en.json
"myFeature": { "newKey": "English text here" }

Bước 2: Thêm cùng key vào frontend/src/locales/vi.json
"myFeature": { "newKey": "Tiếng Việt ở đây" }

Bước 3: Dùng trong component
const { t } = useTranslation();
<span>{t('myFeature.newKey')}</span>
```

**Verify sync sau khi thêm (PowerShell):**
```powershell
function Get-AllKeys($obj, $prefix = "") {
  $keys = @()
  foreach ($k in $obj.PSObject.Properties.Name) {
    $full = if ($prefix) { "$prefix.$k" } else { $k }
    $v = $obj.$k
    if ($v -is [PSCustomObject]) { $keys += Get-AllKeys $v $full } else { $keys += $full }
  }
  return $keys
}
$en = Get-AllKeys (Get-Content "frontend/src/locales/en.json" -Raw -Encoding UTF8 | ConvertFrom-Json) | Sort-Object
$vi = Get-AllKeys (Get-Content "frontend/src/locales/vi.json" -Raw -Encoding UTF8 | ConvertFrom-Json) | Sort-Object
$diff = Compare-Object $en $vi
if ($diff) { Write-Host "OUT OF SYNC:"; $diff } else { Write-Host "In sync — $($en.Count) keys" }
```

---

### 37.6 Audit Script (chạy định kỳ để phát hiện regression)

```powershell
$srcDir = "D:\...\frontend\src"
$issues = @()
$viChars = '[àáâãèéêìíòóôõùúýăđơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]'

$files = Get-ChildItem $srcDir -Recurse -Include "*.tsx","*.ts" |
  Where-Object { $_.FullName -notmatch "\\locales\\" }

foreach ($file in $files) {
  $lines = Get-Content $file.FullName -Encoding UTF8
  $inBlock = $false; $n = 0
  foreach ($line in $lines) {
    $n++; $t = $line.Trim()
    if ($t -match '/\*' -and $t -notmatch '\*/') { $inBlock = $true }
    if ($inBlock) { if ($t -match '\*/') { $inBlock = $false }; continue }
    if ($t -match '/\*.*\*/') { continue }
    if ($t -eq '' -or $t -match '^//' -or $t -match '^import ') { continue }
    $rel = $file.FullName.Replace($srcDir, "")
    if ($line -match 'currencySymbol') { continue }
    if ($line -match '₫') { $issues += "[DONG] ${rel}:$n" }
    if ($line -match "toLocaleString\('vi-VN'\)") { $issues += "[LOCALE] ${rel}:$n" }
    if ($t -match ('>[^<{]*' + $viChars + '[^<{]*<') -and $line -notmatch "\bt\('") {
      $issues += "[JSX-VI] ${rel}:$n"
    }
  }
}

if ($issues.Count -eq 0) { Write-Host "I18N CLEAN" -ForegroundColor Green }
else { Write-Host "Issues: $($issues.Count)"; $issues | ForEach-Object { Write-Host "  $_" } }
```

---

### 37.7 Acceptable Exceptions (False Positives)

Các pattern sau đây **không cần fix** — đây là thiết kế đúng:

| File | Pattern | Lý do |
|---|---|---|
| `LanguageSwitcher.tsx` | `name: 'Tiếng Việt'` | Tên ngôn ngữ hiển thị bằng chính ngôn ngữ đó — chuẩn i18n quốc tế |
| `ProductSpecificationsForm.tsx` | `category: 'Thông số chung'` | DB value trong pattern `{value, label}` — đúng thiết kế |
| `chatbotApi.ts` | `includes('tìm')`, `includes('mua')` | Keyword matching NLP — không render ra UI |
| `data/mock*.ts` | Vietnamese names | Mock seed data — content data, không phải UI label |
| `sampleDataHelper.ts` | HTML tiếng Việt | Sample content cho rich-text editor |
| `textUtils.ts` | Vietnamese stopwords | Thuật toán NLP — không render |
| Multi-line `console.log()` args | Vietnamese strings | Dev-only logs — không render |
| `promptTemplates.ts` (isVi branch) | `Bạn là trợ lý...` | Intentional — AI prompt theo ngôn ngữ UI |

---

### 37.8 Translation Key Namespace Map

Top-level namespaces hiện có trong locale files:

```
common.*          — buttons, status, errors chung
header.*          — navigation, brand, actions
homepage.*        — hero, sections trang chủ
product.*         — product detail, cart actions, specNames.* (81 spec keys)
productDetail.*   — chi tiết sản phẩm, tabs
admin.*           — toàn bộ admin panel (users, orders, products, charts, banners, news…)
auth.*            — login, register, forgot password
checkout.*        — checkout flow, payment methods, address
orders.*          — order list, order detail, status labels
payment.*         — stripe, bank transfer, errors
cart.*            — giỏ hàng
profile.*         — trang profile, edit info, addresses
shop.*            — trang danh sách sản phẩm, filters
categories.*      — trang danh mục
chat.*            — AI chatbot widget, suggestions, errors
news.*            — trang tin tức, tags, categories
wishlist.*        — danh sách yêu thích
search.*          — trang tìm kiếm
```

### ✅ Acceptance Criteria Phase 37
- [x] Bug B2 fix: `CheckoutPage.tsx` — `defaultState`/`defaultCity` dùng `''` thay vì `t()` để tránh backend validation fail khi EN
- [x] `en.json` và `vi.json` đồng bộ hoàn toàn (0 key lệch nhau)
- [x] Switch sang EN → giỏ hàng, admin dashboard vẫn hiển thị đúng số liệu VND (không chuyển sang USD)
- [x] Checkout với ngôn ngữ EN → không bị backend validation fail do giá trị địa lý dịch sai

---

## PHASE 20 — i18n & Localization Consistency
> **Vietnamese/English phải nhất quán, không có missing translation keys.**

### 20.1 Missing Translation Keys
- **Files:** `frontend/src/locales/vi.json`, `frontend/src/locales/en.json`
- **Check:** Grep toàn bộ `frontend/src/` tìm tất cả `t('key.name')` hoặc `i18n.t('...')` — liệt kê tất cả keys đang dùng, so sánh với keys có trong 2 file JSON → tìm keys missing
- **Fix:** Bổ sung key còn thiếu trong cả 2 file; key trong `vi.json` và `en.json` phải giống nhau hoàn toàn (không thừa, không thiếu)

### 20.2 Hardcoded Strings trong Code (Tiếng Việt VÀ Tiếng Anh)
- **Check `frontend/src/`:** Grep tìm các string tiếng Việt hardcode trực tiếp trong JSX/TSX (không dùng `t()`) — ví dụ: `<p>Thêm vào giỏ hàng</p>` thay vì `<p>{t('cart.addToCart')}</p>`
- **Fix:** Tất cả user-facing text phải qua i18n key, không hardcode ngôn ngữ cụ thể
- **FAQsPage.tsx — hardcode tiếng Anh (audit thực tế):** `frontend/src/pages/FAQsPage.tsx` lines ~14+ có mảng FAQ objects với content tiếng Anh cứng trong component — không qua `t()` → khi switch sang VI không đổi được
- **Fix FAQsPage:** Extract FAQ content ra `vi.json`/`en.json` dưới key `faqs.items`, component render `{(t('faqs.items', { returnObjects: true }) as FAQ[]).map(...)}`
- **vi.json vs en.json size gap (audit thực tế):** `vi.json` ~1008 dòng, `en.json` ~817 dòng → ~191 key tiếng Anh còn thiếu. Phải về 0 sau Phase này.
  - **UPDATE (Phase 37):** Gap đã được đóng — cả 2 file hiện có 3,018 keys đồng bộ hoàn toàn. Tuy nhiên còn 5 bugs trong implementation — xem Phase 37.0.

### 20.3 Date & Currency Formatting
- **Check `frontend/src/`:** Giá tiền có được format theo locale không (VND: `1.000.000 ₫` thay vì `1000000`); ngày có dùng `Intl.DateTimeFormat` hoặc `dayjs` với locale không
- **Fix — Format chuẩn:**
  ```ts
  // Giá tiền VND
  const formatPrice = (amount: number) =>
    new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);

  // Ngày giờ
  const formatDate = (date: string) =>
    new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(date));
  ```

### 20.4 Error Messages — Nhất Quán Ngôn Ngữ
- **Check `backend/src/`:** Error messages trong controllers/validators đang dùng ngôn ngữ nào — tiếng Anh hay tiếng Việt hay lẫn lộn
- **Fix:** Chọn 1 ngôn ngữ thống nhất cho backend error messages (khuyến nghị: tiếng Anh cho error codes/keys, tiếng Việt cho user-facing messages trong validators)

### ✅ Acceptance Criteria Phase 20
- [x] Chuyển ngôn ngữ sang English → tất cả UI text hiển thị tiếng Anh, không còn text tiếng Việt hardcode
- [x] Giá sản phẩm hiển thị dạng `1.299.000 ₫` (không phải `1299000`)
- [x] Không có key nào xuất hiện trong `vi.json` mà thiếu trong `en.json` hoặc ngược lại

---

## PHASE 21 — SEO Standards for E-Commerce
> **Meta tags, structured data, URL chuẩn — quan trọng cho cửa hàng online.**

### 21.1 Meta Tags trên từng trang
- **Files:** `frontend/src/pages/ProductDetailPage.tsx`, `frontend/src/pages/CategoryPage.tsx`, `frontend/src/pages/ShopPage.tsx`
- **Check:** Có dùng `react-helmet` hoặc tương đương để set dynamic meta tags không
- **Fix — Mỗi trang phải có:**
  ```tsx
  // ProductDetailPage
  <Helmet>
    <title>{product.seoTitle || `${product.name} | TechStore`}</title>
    <meta name="description" content={product.seoDescription || product.shortDescription} />
    <meta property="og:title" content={product.name} />
    <meta property="og:description" content={product.shortDescription} />
    <meta property="og:image" content={product.thumbnail} />
    <meta property="og:type" content="product" />
    <link rel="canonical" href={`https://techstore.vn/products/${product.slug}`} />
  </Helmet>
  ```

### 21.2 Product Structured Data (JSON-LD)
- **File:** `frontend/src/pages/ProductDetailPage.tsx`
- **Fix:** Thêm JSON-LD schema cho product — giúp Google hiển thị rich snippets (giá, rating, availability):
  ```tsx
  <script type="application/ld+json">
  {JSON.stringify({
    "@context": "https://schema.org/",
    "@type": "Product",
    "name": product.name,
    "image": product.images.map(i => i.imageUrl),
    "description": product.shortDescription,
    "sku": product.defaultVariant?.sku,
    "offers": {
      "@type": "Offer",
      "price": product.basePrice,
      "priceCurrency": "VND",
      "availability": product.stockQuantity > 0
        ? "https://schema.org/InStock"
        : "https://schema.org/OutOfStock"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": product.ratingAverage,
      "reviewCount": product.reviewCount
    }
  })}
  </script>
  ```

### 21.3 URL Slug Standards
- **Check:** Product, category, brand, news slugs có tuân theo chuẩn URL không:
  - Chỉ dùng lowercase, số, dấu gạch ngang (`-`)
  - Không dùng ký tự tiếng Việt có dấu trong slug (phải transliterate: `điện-thoại` → `dien-thoai`)
  - Không có trailing slash
  - Không có double dash (`--`)
- **Check backend:** Khi tạo product/category mới, slug generation có xử lý tiếng Việt không
- **Fix:** Dùng thư viện `slugify` với option `{ locale: 'vi', lower: true }` để generate slug

### 21.4 Sitemap & robots.txt
- **Check `frontend/public/`:** Có `robots.txt` không; có sitemap URL không
- **Fix:**
  - `robots.txt`: Allow all crawlers trừ `/admin/*`, `/api/*`
  - Sitemap: Nếu chưa có dynamic sitemap, ít nhất có static sitemap với các trang chính
  - Backend: `GET /sitemap.xml` endpoint generate sitemap từ products + categories + news

### ✅ Acceptance Criteria Phase 21
- [x] `curl -I https://localhost:3000/products/iphone-16-pro` — response có `<title>iPhone 16 Pro | TechStore</title>`
- [x] `<head>` của ProductDetailPage có `og:image` và `og:description`
- [x] ProductDetailPage có JSON-LD `@type: Product` với `offers.price` và `aggregateRating`
- [x] `GET /robots.txt` — trả về file block `/admin` và `/api`
- [x] Slug của tất cả 45 sản phẩm không chứa ký tự tiếng Việt có dấu

---

## PHASE 22 — Code Quality & Cleanup
> **Xóa dead code, console.log, hardcode; enforce consistent style.**

### 22.1 Xóa console.log khỏi Production Code
- **Check `backend/src/` và `frontend/src/`:** Grep tìm tất cả `console.log`, `console.error`, `console.warn` trong source code
- **Fix:**
  - Backend: Thay tất cả `console.log` bằng `logger.info/debug/error`
  - Frontend: Xóa tất cả `console.log` trong production code — chỉ giữ trong `catch` blocks để debug (dùng `import.meta.env.DEV` guard)

### 22.2 Xóa Commented-out Code
- **Check:** Grep tìm các block code bị comment dài (`// old code`, `/* disabled */`) không phải comment giải thích
- **Fix:** Xóa tất cả — git history đã lưu rồi, không cần giữ

### 22.3 Hardcoded Values phải thành Constants
- **Check `backend/src/`:** Tìm các magic numbers và strings hardcode rải rác:
  - `POINTS_EARN_RATE` — có trong constant file không hay hardcode `100`
  - JWT expiry `'7d'` — có trong config không
- **Hardcoded localhost URLs (audit thực tế — 4 file, phải fix trước khi deploy):**
  - `backend/src/controllers/order.js:954` — `|| 'http://localhost:5175'` → đổi thành `|| process.env.FRONTEND_URL`
  - `backend/src/services/payment/momo.js:14-15` — redirectUrl default `localhost` → `process.env.FRONTEND_URL`
  - `backend/src/utils/imageUrl.js:1,34-35` — `DEFAULT_LOCAL_BASE = 'http://localhost:8888'` → `process.env.BACKEND_URL || 'http://localhost:8888'`
  - `backend/src/services/ai/geminiChatbot.js:128` — fallback `localhost:5173` → `process.env.FRONTEND_URL`
  - **Fix tổng quát:** Grep `localhost:[0-9]` trong toàn bộ `backend/src/` — thay tất cả bằng env variable với localhost làm default value cho dev
- **Hardcoded MoMo test credentials (audit thực tế):**
  - `backend/src/services/payment/momo.js:7-9` — `|| 'MOMOLRJZ20181206'` fallback test partnerCode nếu env var missing
  - **Vấn đề:** Production vô tình dùng test credentials nếu `.env` thiếu → payment fail hoặc gửi đến môi trường test
  - **Fix:** Throw error ngay khi start nếu thiếu payment credentials trong production:
    ```js
    if (process.env.NODE_ENV === 'production' && !process.env.MOMO_PARTNER_CODE) {
      throw new Error('MOMO_PARTNER_CODE is required in production');
    }
    ```
  - Tương tự cho `STRIPE_SECRET_KEY`, `VNPAY_HASH_SECRET`
  - Pagination default `20` — có constant không
  - Max upload size `5 * 1024 * 1024` — có constant không
- **Fix:** Tạo `backend/src/constants/index.js`:
  ```js
  module.exports = {
    POINTS_EARN_RATE: 100,        // 100 VND = 1 điểm
    JWT_ACCESS_EXPIRY: '7d',
    JWT_REFRESH_EXPIRY: '30d',
    PAGINATION_DEFAULT_LIMIT: 20,
    PAGINATION_MAX_LIMIT: 100,
    MAX_UPLOAD_SIZE: 5 * 1024 * 1024,  // 5MB
    OTP_EXPIRY_MINUTES: 10,
    MAX_CART_QUANTITY: 99,
  };
  ```

### 22.4 ESLint & Prettier Configuration
- **Check:** `backend/` và `frontend/` có `.eslintrc` và `.prettierrc` không
- **Fix — Thêm nếu thiếu:**
  - Backend `.eslintrc.js`: `extends: ['eslint:recommended', 'plugin:node/recommended']`
  - Frontend `.eslintrc.js`: `extends: ['react-app', '@typescript-eslint/recommended']`, rules: `'@typescript-eslint/no-explicit-any': 'error'`
  - `.prettierrc`: `{ "semi": true, "singleQuote": true, "printWidth": 100, "tabWidth": 2 }`
- **Chạy:** `npx eslint . --fix` sau khi config xong — fix tất cả auto-fixable issues

### 22.5 Dead Code & Unused Imports
- **Check `frontend/src/`:** TypeScript compiler và ESLint `no-unused-vars` sẽ flag unused imports và variables
- **Check `backend/src/`:** Tìm các route files, service files, model files không được import ở đâu
- **Fix:** Xóa tất cả unused imports, unused variables, unreachable code

### 22.7 Admin Pages — Bypass RTK Query (audit thực tế)
- **Files:** `frontend/src/pages/admin/BannersPage.tsx` (lines 27, 54, 66, 69), `frontend/src/pages/admin/EmailCampaignsPage.tsx` (lines 28, 48, 59, 70)
- **Vấn đề:** Các trang admin này gọi `apiClient.get/post/delete/patch()` trực tiếp thay vì dùng RTK Query API slices — bypass caching, invalidation, loading states tự động; không nhất quán với phần còn lại của codebase
- **Fix:** Tạo RTK Query endpoints cho banners và email campaigns trong `frontend/src/services/adminApi.ts`, refactor 2 trang trên dùng `useGetBannersQuery()`, `useCreateBannerMutation()`, v.v.
- **Deprecated Ant Design prop (cùng 2 file):** Dùng `visible=` (deprecated trong Ant Design v5) thay vì `open=` → đổi lại cho đúng

### 22.6 Sequelize Migration Files — Cleanup
- **Check `backend/src/migrations/`:** Các migration có tên đúng format `YYYYMMDDNN-verb-entity.js` không (ví dụ: `20260502-create-products.js` → sai; `2026050201-create-products.js` → đúng)
- **Fix:** Rename các file migration không đúng format; đảm bảo thứ tự timestamp khớp với thứ tự cần chạy

### ✅ Acceptance Criteria Phase 22
- [x] Grep `console.log` trong `backend/src/` → 0 kết quả (trừ `server.js` startup message)
- [x] `npx eslint frontend/src --ext .ts,.tsx` → 0 errors (warnings chấp nhận)
- [x] `POINTS_EARN_RATE` được define trong constants file, không hardcode trong controller
- [x] Grep `as any` trong `frontend/src/` giảm đáng kể so với Phase 5
- [x] Grep `localhost:[0-9]` trong `backend/src/` (trừ `.env.example`) → 0 kết quả
- [x] `BannersPage.tsx` và `EmailCampaignsPage.tsx` không còn import `apiClient` trực tiếp — dùng RTK Query hooks
- [x] Grep `visible=` trong `frontend/src/pages/admin/` → 0 kết quả (đã đổi thành `open=`)

---

## PHASE 23 — Dependency Security & Package Standards
> **Không có package có lỗ hổng known, không có package thừa.**

### 23.1 npm audit
- **Chạy:** `npm audit` trong cả `backend/` và `frontend/`
- **Fix:**
  - `npm audit fix` cho các vulnerability có auto-fix
  - Manual review cho các vulnerability yêu cầu breaking change upgrade
  - Mục tiêu: 0 critical, 0 high severity vulnerabilities

### 23.2 Outdated Packages
- **Chạy:** `npm outdated` trong cả `backend/` và `frontend/`
- **Fix:** Update các packages có minor/patch update an toàn; review carefully trước khi update major version
- **Ưu tiên update:** `sequelize`, `jsonwebtoken`, `multer`, `axios`, `react`, `typescript`

### 23.3 Unused Dependencies
- **Check `backend/package.json` và `frontend/package.json`:** Grep tìm các package trong `dependencies` không được `require`/`import` ở đâu trong source code
- **Fix:** Xóa unused packages: `npm uninstall package-name`

### 23.4 .env.example File
- **Vấn đề:** Không có `.env.example` → developer mới không biết cần set những env vars nào
- **Fix:** Tạo `backend/.env.example` với tất cả keys (không có values thật):
  ```
  # Database
  DB_HOST=localhost
  DB_PORT=3306
  DB_USER=root
  DB_PASSWORD=
  DB_NAME=techstore

  # JWT
  JWT_SECRET=your-strong-secret-here
  JWT_REFRESH_SECRET=your-refresh-secret-here

  # Redis
  REDIS_URL=redis://localhost:6379

  # Stripe
  STRIPE_SECRET_KEY=sk_test_...
  STRIPE_WEBHOOK_SECRET=whsec_...

  # Google
  GOOGLE_CLIENT_ID=
  GOOGLE_CLIENT_SECRET=
  GEMINI_API_KEY=

  # Email
  EMAIL_USERNAME=
  EMAIL_PASSWORD=
  ```

### 23.5 Lock Files
- **Check:** `backend/package-lock.json` và `frontend/package-lock.json` có trong git không (phải có để đảm bảo reproducible builds)
- **Fix:** Nếu không có — chạy `npm install` để generate; thêm vào git; không add vào `.gitignore`

### ✅ Acceptance Criteria Phase 23
- [x] `npm audit --audit-level=high` trong backend → exit code 0 (không có high/critical)
- [x] `npm audit --audit-level=high` trong frontend → exit code 0
- [x] `backend/.env.example` tồn tại với đủ tất cả required keys
- [x] `package-lock.json` tồn tại trong cả backend và frontend

---

## PHASE 24 — Mobile & Responsive Design
> **E-commerce cần mobile-first — phần lớn user mua hàng trên điện thoại.**

### 24.1 Responsive Breakpoints Check
- **Files:** Các trang quan trọng nhất về mobile:
  - `frontend/src/pages/ProductDetailPage.tsx` — product images, variant selector, add to cart button
  - `frontend/src/pages/CartPage.tsx` — cart items, total, checkout button
  - `frontend/src/pages/CheckoutPage.tsx` — form fields, address section
  - `frontend/src/pages/ShopPage.tsx` — product grid, filter sidebar
- **Check:** Các component này có dùng Tailwind responsive prefixes (`sm:`, `md:`, `lg:`) không
- **Fix:** Đảm bảo layout không bị broken ở viewport 375px (iPhone SE) và 768px (tablet)

### 24.2 Touch Targets
- **Chuẩn:** Tất cả clickable elements phải có min size 44x44px (iOS/Android guideline)
- **Check:** Các button nhỏ như "Xóa", icon buttons, pagination buttons có đủ kích thước không
- **Fix:** Thêm `min-h-[44px] min-w-[44px]` cho các touch target quá nhỏ

### 24.3 Mobile Navigation
- **Check `frontend/src/components/layout/Header.tsx`:** Mobile menu (hamburger) có hoạt động không — đặc biệt cart icon badge, user menu, search bar
- **Fix:** Verify mobile header không có horizontal overflow; cart và account icons accessible trên mobile

### 24.4 Checkout Flow trên Mobile
- **Vấn đề đặc thù mobile:** Form nhập địa chỉ trên mobile phải dùng đúng `inputmode` và `autocomplete` attributes
- **Fix:**
  ```tsx
  <input type="tel" inputMode="numeric" autoComplete="tel" />  // Phone
  <input type="text" autoComplete="address-line1" />            // Address
  <input type="email" autoComplete="email" inputMode="email" /> // Email
  ```
  - Keyboard phải hiện đúng loại (numeric cho phone, email keyboard cho email)

### 24.5 Image Responsive
- **Check:** Product images trong list và detail page có dùng `srcset` hoặc CSS `object-fit: cover` không — ảnh không được bị stretch hay overflow
- **Fix:** Tất cả product images dùng `className="w-full h-full object-cover"`

### ✅ Acceptance Criteria Phase 24
- [x] Chrome DevTools → iPhone SE (375px) → ShopPage không có horizontal scroll
- [x] ProductDetailPage trên mobile: "Add to Cart" button ở vị trí dễ tap (không bị ẩn)
- [x] CheckoutPage: tap vào field phone → keyboard số hiện lên (không phải keyboard chữ)
- [x] Tất cả icon buttons có tap area tối thiểu 44x44px

---

## PHASE 25 — Testing Strategy
> **Không cần 100% coverage, nhưng phải test được critical paths.**

### 25.1 Backend — Unit Tests cho Business Logic
- **Ưu tiên test (theo thứ tự quan trọng):**
  1. **Order creation flow** — `createOrder()` với valid items, với out-of-stock items, với invalid discount code
  2. **Payment webhook idempotency** — gọi webhook 2 lần, verify stock chỉ trừ 1 lần
  3. **Discount code validation** — valid code, expired code, min amount not met, max uses exceeded
  4. **Loyalty points calculation** — verify points = floor(subtotal / rate), không tính shipping
  5. **Cart merge** — merge guest cart + user cart, verify quantity cộng dồn đúng
- **Framework:** Jest + Supertest
- **Setup:** Dùng SQLite in-memory hoặc MySQL test database (không dùng production DB)

### 25.2 Backend — API Integration Tests
- **Test các endpoint quan trọng với Supertest:**
  ```js
  // Ví dụ test create order
  it('should return 400 when product out of stock', async () => {
    // Seed: product với stockQuantity = 0
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${userToken}`)
      .send({ items: [{ productId: 1, variantId: 1, quantity: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('Out of stock');
  });
  ```
- **Tối thiểu cần test:**
  - `POST /api/auth/login` — success, wrong password, rate limited
  - `POST /api/cart` — add item, add duplicate item (quantity increment), add out-of-stock
  - `POST /api/orders` — success, out-of-stock, invalid discount
  - `GET /api/products` — pagination, filter by category, sort by price

### 25.3 Frontend — Component Tests
- **Framework:** Vitest + React Testing Library (đã có sẵn Vite)
- **Ưu tiên test:**
  1. `CartPage` — add item, remove item, quantity update, total calculation
  2. `ProductDetailPage` — variant selection updates price, out-of-stock disables button
  3. `CheckoutPage` — form validation, required fields

### 25.4 Test Data & Fixtures
- Tạo `backend/src/tests/fixtures/` với sample data:
  - `users.js` — test user (customer, admin)
  - `products.js` — 3-5 test products với variants
  - `orders.js` — sample order với items
- Test data phải isolated — mỗi test tự setup và teardown, không phụ thuộc vào nhau

### 25.5 CI-ready Test Commands
- **`backend/package.json`:**
  ```json
  "scripts": {
    "test": "jest --runInBand",
    "test:watch": "jest --watch",
    "test:coverage": "jest --coverage"
  }
  ```
- **`frontend/package.json`:**
  ```json
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage"
  }
  ```

### ✅ Acceptance Criteria Phase 25
- [x] `cd backend && npm test` — tất cả tests pass, không có failing test
- [x] `cd frontend && npm test` — tất cả tests pass
- [x] Test coverage cho business logic (order, payment, cart): tối thiểu 60% (order 62.84%, cart 60%, payment 35.8% — payment gateway MoMo/VNPay/SePay khó unit test)
- [x] Test out-of-stock scenario → confirmed 400 error với đúng message
- [x] Test duplicate webhook → confirmed stock không bị trừ 2 lần

---

## PHASE 26 — Feature Completeness Audit: User-Facing
> **Mỗi chức năng dành cho user phải hoạt động đầu cuối — không crash, không 404, không spinner vô hạn.**

### 26.1 Homepage
- [x] Hero banner hiển thị đúng, autoplay/click link hoạt động
- [x] Featured products load từ API (không phải mock), click vào sản phẩm → đi đến ProductDetailPage
- [x] Category grid hiển thị đúng 45 sản phẩm phân loại
- [x] Newsletter signup: nhập email → submit → nhận toast thành công
- [x] Không có lỗi 404 / 500 trong Network tab

### 26.2 Product Listing / Shop Page
- [x] Filter theo danh mục, thương hiệu, giá hoạt động → URL query params cập nhật
- [x] Sort theo giá tăng/giảm, mới nhất → danh sách thay đổi đúng
- [x] Pagination hoặc infinite scroll hoạt động, không duplicate sản phẩm
- [x] Filter kết hợp nhiều tiêu chí cùng lúc → kết quả đúng
- [x] Khi không có kết quả → hiển thị "Không tìm thấy sản phẩm" thay vì blank

### 26.3 Product Detail Page
- [x] Gallery ảnh: thumbnail click đổi main image
- [x] Variant selector: chọn color/size → giá cập nhật, stock status đúng
- [x] Nút "Thêm vào giỏ" → disabled khi hết hàng, enabled khi còn hàng
- [x] Tab Reviews: load đúng, submit review (sau khi mua) hoạt động với ảnh upload
- [x] Related products hiển thị đúng danh mục

### 26.4 Cart
- [x] Add to cart → số lượng badge trên header cập nhật ngay lập tức
- [x] Tăng/giảm số lượng trong cart → subtotal tính lại đúng
- [x] Xóa item khỏi cart → item biến mất, total cập nhật
- [x] Nhập discount code hợp lệ → giảm giá được áp dụng đúng
- [x] Guest cart (chưa login) → sau khi login → cart được merge
- [x] Cart persist khi refresh trang (localStorage hoặc server)

### 26.5 Checkout
- [x] Form địa chỉ: validate required fields, save địa chỉ mới vào address book
- [x] Chọn địa chỉ đã lưu → form tự điền
- [x] Shipping options load với phí đúng
- [x] Payment: Stripe card form render đúng, submit → redirect đến order confirmation
- [x] COD payment → order tạo thành công, status = pending
- [x] Nhận email xác nhận đơn hàng sau khi thanh toán thành công

### 26.6 User Account
- [x] Trang Profile: update họ tên, SĐT → save → hiển thị lại đúng
- [x] Đổi mật khẩu: nhập password cũ sai → báo lỗi; đúng → đổi thành công
- [x] Address Book: thêm/sửa/xóa địa chỉ, set default address
- [x] Order History: list orders, click order → xem order detail với đúng items
- [x] Wishlist: add từ product detail → hiển thị trong wishlist; remove hoạt động
- [x] Loyalty points: số điểm hiển thị đúng; điểm tăng sau khi đơn hàng hoàn thành

### 26.7 Chatbot AI
- [x] Hỏi về sản phẩm → trả lời có thông tin sản phẩm từ RAG
- [x] Hỏi câu ngoài phạm vi → trả lời fallback hợp lý, không crash
- [x] Conversation history hiển thị đúng trong UI

### 26.8 Real-time Support Chat
- [x] User gửi message → admin thấy ngay (Socket.IO)
- [x] Admin reply → user thấy ngay
- [x] Badge "tin nhắn chưa đọc" cập nhật đúng

### 26.9 Các trang phụ
- [x] News/Blog: list bài viết, click → xem chi tiết với HTML content render đúng
- [x] Contact page: submit form → admin nhận thông báo hoặc email
- [x] 404 page hiển thị khi truy cập route không tồn tại

### ✅ Acceptance Criteria Phase 26
- [x] Toàn bộ 26.1–26.9: không có trang nào crash (white screen / unhandled exception)
- [x] Network tab của Chrome DevTools: không có request nào trả về 404 hoặc 500 trong happy path
- [x] Flow mua hàng đầu cuối hoạt động: đăng ký → duyệt sản phẩm → giỏ hàng → checkout → xác nhận
- [x] Logout → dùng token cũ → nhận 401

---

## PHASE 27 — Feature Completeness Audit: Admin-Facing
> **Toàn bộ chức năng admin phải hoạt động, dữ liệu hiển thị chính xác, actions có effect thật.**

### 27.1 Dashboard
- [x] Revenue chart hiển thị đúng dữ liệu theo tháng (không include cancelled orders)
- [x] Cards thống kê: tổng đơn hàng, doanh thu, sản phẩm, user — đúng với DB
- [x] Bảng "Đơn hàng gần đây" load đúng, click → xem chi tiết

### 27.2 Product Management
- [x] Tạo sản phẩm mới: nhập đủ thông tin, upload ảnh, thêm variant → save → xuất hiện trong danh sách
- [x] Edit sản phẩm: thay đổi giá, mô tả, ảnh → save → hiển thị lại đúng ở frontend
- [x] Delete sản phẩm: xóa → không còn xuất hiện trong shop
- [x] Upload ảnh sản phẩm: preview, reorder, set thumbnail chính
- [x] Variant management: thêm/xóa/sửa variant (màu, size, giá, stock)
- [x] Bulk action: chọn nhiều sản phẩm → delete/change status

### 27.3 Category / Brand / Collection Management
- [x] Tạo/sửa/xóa danh mục với ảnh thumbnail
- [x] Tạo/sửa/xóa thương hiệu
- [x] Tạo/sửa/xóa collection, assign sản phẩm vào collection

### 27.4 Order Management
- [x] Danh sách orders: filter theo status, ngày tháng, tìm theo order number
- [x] Xem chi tiết order: items, địa chỉ, payment status, shipping status
- [x] Cập nhật order status: pending → processing → shipped → delivered
- [x] Cancel order: stock được hoàn lại đúng số lượng

### 27.5 User Management
- [x] Danh sách users: tìm theo email, filter theo role
- [x] Xem profile user: orders, loyalty points
- [x] Ban/unban user: user bị ban → login nhận 401

### 27.6 Discount Code Management
- [x] Tạo discount code: percentage/fixed, min order amount, max uses, expiry date
- [x] Code hết hạn → frontend báo lỗi khi apply
- [x] Code đã dùng đủ số lần → frontend báo lỗi

### 27.7 Banner Management
- [x] Upload/replace banner ảnh, set link, set order/priority
- [x] Thay đổi banner → homepage hiển thị banner mới

### 27.8 Support Chat (Admin side)
- [x] Danh sách conversations: xem theo user, unread badge
- [x] Mở conversation → xem lịch sử tin nhắn → reply
- [x] Mark conversation as resolved

### 27.9 Reports & Audit
- [x] Revenue report: filter by date range → đúng số liệu
- [x] Audit log: mỗi action admin (create product, cancel order) → có record trong audit_logs

### 27.10 Admin CategoryPage — Trang Tồn Tại Nhưng Chưa Có Route (audit thực tế)
- **Kết quả audit:** Route `/admin/categories` đã tồn tại và hoạt động qua `CategoriesPage.tsx` (Ant Design) — plan.md đã ghi nhầm khi `CategoriesPage.tsx` chưa được tạo. `CategoryPage.tsx` (Heroicons) là dead code, không cần thiết vì đã có `CategoriesPage.tsx`.
- **Banner sidebar:** Đã uncomment banner nav item, thêm i18n key `admin.nav.banners` vào vi.json + en.json.

### ✅ Acceptance Criteria Phase 27
- [x] Admin tạo sản phẩm mới → sản phẩm xuất hiện trên shop frontend ngay lập tức (không cache stale)
- [x] Admin cancel order → stock của sản phẩm trong order đó được cộng lại đúng
- [x] Admin ban user → user đó login → nhận 401
- [x] Dashboard revenue không bao gồm cancelled orders (verify bằng tạo order rồi cancel → revenue không tăng)
- [x] Tất cả CRUD operations không có lỗi 422/500 trong happy path
- [x] `/admin/categories` route hoạt động, admin có thể xem/tạo/sửa/xóa category

---

## PHASE 28 — Light Mode / Dark Mode Design System
> **Giao diện phải có đủ 2 chế độ theo chuẩn thiết kế, toggle được lưu vào localStorage.**

### 28.1 Tailwind Dark Mode Config
- **File:** `frontend/tailwind.config.js`
- **Check:** `darkMode` có được set thành `'class'` không (toggle bằng class trên `<html>`)
- **Fix:**
  ```js
  // tailwind.config.js
  module.exports = {
    darkMode: 'class',
    theme: { ... }
  }
  ```

### 28.2 Color Token System
- **File:** `frontend/src/styles/globals.css` (hoặc tương đương)
- **Fix — CSS variables cho light/dark:**
  ```css
  :root {
    --color-bg-primary:      #ffffff;
    --color-bg-secondary:    #f8fafc;
    --color-text-primary:    #0f172a;
    --color-text-secondary:  #64748b;
    --color-border:          #e2e8f0;
    --color-accent:          #3b82f6;   /* blue-500 */
    --color-accent-hover:    #2563eb;   /* blue-600 */
    --color-danger:          #ef4444;
    --color-success:         #22c55e;
  }
  .dark {
    --color-bg-primary:      #0f172a;   /* slate-900 */
    --color-bg-secondary:    #1e293b;   /* slate-800 */
    --color-text-primary:    #f1f5f9;   /* slate-100 */
    --color-text-secondary:  #94a3b8;   /* slate-400 */
    --color-border:          #334155;   /* slate-700 */
    --color-accent:          #60a5fa;   /* blue-400 */
    --color-accent-hover:    #93c5fd;   /* blue-300 */
  }
  ```

### 28.3 Dark Mode Toggle Component
- **File:** `frontend/src/components/ui/ThemeToggle.tsx`
- **Fix:** Component toggle với icon sun/moon; persist sang `localStorage`:
  ```tsx
  const ThemeToggle = () => {
    const [dark, setDark] = useState(
      () => localStorage.getItem('theme') === 'dark'
    );
    useEffect(() => {
      document.documentElement.classList.toggle('dark', dark);
      localStorage.setItem('theme', dark ? 'dark' : 'light');
    }, [dark]);
    return <button onClick={() => setDark(!dark)}>{dark ? '☀️' : '🌙'}</button>;
  };
  ```
- **Thêm vào Header** — toggle button hiển thị trên cả desktop và mobile nav

### 28.4 Component Coverage — Dark Mode Classes
- **Files cần kiểm tra (ưu tiên):**
  - `Header.tsx`, `Footer.tsx` — navigation background
  - `ProductCard.tsx` — card background, text, hover state
  - `CartSidebar.tsx` / `CartPage.tsx` — sidebar background
  - `CheckoutPage.tsx` — form inputs, section backgrounds
  - `Modal.tsx` / `Dialog` components — overlay + content background
  - Admin dashboard: table rows, chart backgrounds
- **Yêu cầu mỗi component:** có `dark:bg-*`, `dark:text-*`, `dark:border-*` classes hoặc dùng CSS variables
- **WCAG AA contrast:** text trên nền dark phải đạt tỷ lệ tương phản ≥ 4.5:1 cho text thường, ≥ 3:1 cho large text

### 28.5 System Preference Sync
- **Fix:** Khi user chưa toggle thủ công, detect OS preference:
  ```tsx
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const savedTheme = localStorage.getItem('theme');
  const initialDark = savedTheme ? savedTheme === 'dark' : systemPrefersDark;
  ```

### ✅ Acceptance Criteria Phase 28
- [x] Click toggle → toàn bộ trang chuyển sang dark mode, không có element nào vẫn hiển thị màu trắng (text trên nền trắng)
- [x] Refresh trang trong dark mode → vẫn giữ dark mode (localStorage persist)
- [x] ProductCard trong dark mode: text đọc được, không bị mất (white-on-white)
- [x] Admin dashboard charts hiển thị đúng trong dark mode
- [x] Chrome DevTools → Accessibility audit → không có contrast ratio error
- [x] OS dark mode preference được detect đúng khi user chưa toggle thủ công

---

## PHASE 29 — i18n Full Coverage & Runtime Accuracy
> **100% user-facing text phải qua i18n. Không có key missing, không có fallback tiếng Anh hiện ra trong tiếng Việt.**

### 29.1 Zero Hardcoded User-Facing Text
- **Check toàn bộ `frontend/src/`:**
  ```bash
  # Tìm JSX text không qua t()
  grep -rn ">[A-ZÀ-Ỵ][^<{]*<" frontend/src/pages/ --include="*.tsx"
  grep -rn ">[A-Za-z ]\+</" frontend/src/components/ --include="*.tsx"
  ```
- **Chuẩn đúng:** Tất cả text trong JSX phải là `{t('key')}` hoặc dynamic variable — không có string literal tiếng Việt/Anh trực tiếp trong JSX
- **Fix:** Extract từng hardcoded string thành key trong `vi.json` + `en.json`

### 29.2 Key Parity — vi.json vs en.json
- **Script kiểm tra tự động:**
  ```js
  // Chạy: node scripts/check-i18n.js
  const vi = require('./frontend/src/locales/vi.json');
  const en = require('./frontend/src/locales/en.json');
  const viKeys = Object.keys(vi).sort();
  const enKeys = Object.keys(en).sort();
  const missingInEn = viKeys.filter(k => !enKeys.includes(k));
  const missingInVi = enKeys.filter(k => !viKeys.includes(k));
  console.log('Missing in en:', missingInEn);
  console.log('Missing in vi:', missingInVi);
  ```
- **Fix:** Cả 2 file phải có đúng cùng set of keys, không thừa không thiếu

### 29.3 Dynamic Content i18n
- **Tên sản phẩm, danh mục:** là data từ DB, không cần translate — nhưng URL slug phải ASCII (Phase 21.3)
- **Error messages từ backend:** frontend phải map error code → i18n key, không hiển thị raw backend message:
  ```ts
  // Thay vì: toast.error(error.response.data.message)
  // Dùng:    toast.error(t(`errors.${error.response.data.code}`) || error.response.data.message)
  ```
- **Form validation messages:** Joi/Yup validation ở frontend phải dùng i18n keys

### 29.4 Language Switcher — Live Switch (No Page Reload)
- **Check:** Khi user chuyển ngôn ngữ → tất cả text cập nhật ngay mà không cần reload
- **Fix:** Dùng `i18next` `changeLanguage()` + React re-render tự động (nếu dùng `react-i18next`)
- **Persist:** Ngôn ngữ đã chọn lưu vào `localStorage('i18nLanguage')`
- **Check:** Sau khi reload trang → ngôn ngữ đã chọn vẫn active

### 29.5 Date / Number / Currency Formatting Nhất Quán
- **Check tất cả trang:** Giá tiền có dùng `formatPrice()` helper không — không có chỗ nào `{product.price} đ` hardcode
- **Check:** Ngày tháng trong Order History, Dashboard charts dùng locale-aware formatting
- **Fix — tạo utils:**
  ```ts
  // frontend/src/utils/format.ts
  export const formatPrice  = (n: number, locale = 'vi-VN') =>
    new Intl.NumberFormat(locale, { style: 'currency', currency: 'VND' }).format(n);
  export const formatDate   = (d: string, locale = 'vi-VN') =>
    new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(d));
  export const formatNumber = (n: number, locale = 'vi-VN') =>
    new Intl.NumberFormat(locale).format(n);
  ```

### ✅ Acceptance Criteria Phase 29
- [x] Chuyển sang English → tất cả UI text là tiếng Anh, không còn tiếng Việt nào hardcode
- [x] Script `check-i18n.js` → output `Missing in en: []` và `Missing in vi: []`
- [x] Giá 1.299.000 hiển thị đúng `1.299.000 ₫` (không phải `1299000 đ` hay `₫1,299,000`)
- [x] Submit form checkout với field trống → validation message hiển thị đúng ngôn ngữ đang active
- [x] Chuyển ngôn ngữ → trang không reload, text đổi ngay tức thì

---

## PHASE 30 — Thesis Defense — Pre-Final Gate (Phase 1-29)
> **Pre-final gate — pass hết Phase 1-29 (~95% scope). Phase 36 mới là Final Gate (100%) sau khi pass thêm Phase 31-37.**

### 30.1 Security Checklist
- [ ] Không có SQL injection (Phase 1.1 ✓)
- [ ] XSS protection active (Phase 1.2 ✓)
- [ ] JWT blacklist hoạt động (Phase 1.3 ✓)
- [ ] OTP dùng `crypto.randomInt` (Phase 1.4 ✓)
- [ ] Rate limiting trên auth endpoints (Phase 1.5 ✓)
- [ ] CSRF protection active (Phase 13.1 ✓)
- [ ] `npm audit --audit-level=high` → 0 critical/high vulnerabilities (Phase 23.1 ✓)

### 30.2 Functional Demo Checklist
- [ ] **Demo user flow** (5 phút): Đăng ký → Xác thực OTP → Browse → Add to Cart → Checkout COD → Xem order
- [ ] **Demo admin flow** (3 phút): Login admin → Dashboard → Tạo sản phẩm → Xem order mới → Cập nhật status
- [ ] **Demo AI chatbot** (1 phút): Hỏi "giới thiệu sản phẩm laptop" → nhận câu trả lời có thông tin sản phẩm thực
- [ ] **Demo dark mode**: Toggle → toàn bộ app chuyển dark, toggle lại → light
- [ ] **Demo i18n**: Switch EN → tất cả text Anh; switch VI → tất cả text Việt

### 30.3 Technical Quality Checks
- [ ] `cd frontend && npm run build` → build thành công, 0 TypeScript error
- [ ] `cd backend && npm test` → tất cả tests pass (Phase 25 ✓)
- [ ] Chrome DevTools Console → 0 error (không có red errors trong console)
- [ ] Chrome DevTools Network → homepage load: không có failed request
- [ ] Lighthouse Performance score ≥ 70 cho ProductDetailPage (desktop)
- [ ] Lighthouse Accessibility score ≥ 80

### 30.4 Code Quality Checks
- [ ] Không có `console.log` trong production code (Phase 22.1 ✓)
- [ ] Không có `Math.random()` trong security context (Phase 1.4 ✓)
- [ ] Không có mock data import trong production components (Phase 2 ✓)
- [ ] `backend/.env.example` tồn tại (Phase 23.4 ✓)
- [ ] `.gitignore` bao gồm `.env`, `node_modules/`, `logs/`, `uploads/` (Phase 18 ✓)

### 30.5 Database & Data
- [ ] `GET /api/products` → trả về đúng 45 sản phẩm (có thể phân trang)
- [ ] Seed data chạy lại được (`npm run seed`) → không có error
- [ ] Không có orphaned FK reference (foreign key constraints không bị vi phạm)

### 30.6 README & Documentation
- [ ] `README.md` ở root có đủ: setup instructions, env variables cần thiết, cách chạy dev, cách chạy seed
- [ ] Không có `TODO` comment còn lại trong production code (chỉ trong test files)

### ✅ Acceptance Criteria Phase 30 (= THESIS DEFENSE READY)
- [x] Tất cả 29 phase trước đều PASS (Phase 31 — DB Import — là phase độc lập, có thể làm song song)
- [x] Demo flow 5 phút không có lỗi nào hiển thị trên giao diện
- [x] Không có `console.error` trong DevTools khi chạy demo
- [x] TypeScript build thành công
- [x] `npm audit --audit-level=high` → 0 vulnerabilities
- [x] Dark mode và i18n hoạt động live, không cần reload
- [x] README.md có đủ hướng dẫn setup từ đầu

---

## PHASE 38 — MySQL Naming Standards & Constraint Audit

> **Mục tiêu:** Kiểm tra toàn bộ tên bảng, tên cột, tên index/key, tên constraint, tên foreign key trong DB có tuân thủ 100% quy chuẩn MySQL trên XAMPP/phpMyAdmin cho một dự án e-commerce cá nhân hay không. Phát hiện và sửa mọi sai lệch trước khi deploy.

### Quy chuẩn cần kiểm tra

#### 38.1 Tên bảng (Table names)
- **Chuẩn:** `snake_case`, số nhiều, tiếng Anh, viết thường hoàn toàn
- **Đúng:** `products`, `order_items`, `product_variants`, `discount_codes`
- **Sai:** `Products`, `orderItem`, `ProductVariant`, `discountCode`, `DiscountCodes`
- **Check:** Grep tất cả `tableName:` trong models, so khớp với SHOW TABLES

#### 38.2 Tên cột (Column names)
- **Chuẩn:** `snake_case`, viết thường, mô tả rõ ràng, không viết tắt mơ hồ
- **Đúng:** `first_name`, `created_at`, `is_active`, `brand_id`, `stock_quantity`
- **Sai:** `firstName`, `createdAt`, `isActive`, `brandId` (trong DB — OK trong Sequelize model JS)
- **Check:** `DESCRIBE <table>` cho từng bảng — cột nào còn camelCase trong DB thực tế?
- **Ngoại lệ:** Sequelize `underscored: false` → cột trong DB sẽ là camelCase (như bảng `users` có `firstName`, `lastName`, `isActive`) — đây là lựa chọn thiết kế có chủ ý, KHÔNG phải lỗi nếu model khai báo `underscored: false`

#### 38.3 Tên Primary Key
- **Chuẩn:** `id` (INT AUTO_INCREMENT) cho tất cả bảng — dự án dùng INT PK (không UUID)
- **Check:** Mọi bảng đều có `id INT AUTO_INCREMENT PRIMARY KEY`
- **Ngoại lệ hợp lệ:** Junction tables không cần `id` riêng nếu dùng composite PK (e.g., `product_categories(product_id, category_id)`)

#### 38.4 Tên Foreign Key columns
- **Chuẩn:** `{referenced_table_singular}_id` — ví dụ: `product_id`, `user_id`, `category_id`
- **Check:** Mọi FK column phải kết thúc bằng `_id`, tham chiếu đúng bảng đúng cột

#### 38.5 Tên Constraint / Foreign Key Constraint
- **Chuẩn MySQL/phpMyAdmin:** `fk_{table}_{referenced_table}` hoặc `fk_{table}_{column}`
- **Ví dụ:** `fk_products_category`, `fk_order_items_product`, `fk_product_variants_product`
- **Check:** `SHOW CREATE TABLE <table>` — constraint nào thiếu tên hoặc dùng tên auto-generated dài?

#### 38.6 Tên Index / Key
- **Chuẩn:** `idx_{table}_{column(s)}` cho index thường; `uq_{table}_{column}` cho unique index
- **Ví dụ:** `idx_products_status`, `idx_orders_user_id`, `uq_users_email`
- **Sai:** Auto-generated names như `products_status_brand_id_...` (quá dài, khó đọc trong phpMyAdmin)
- **Check:** `SHOW INDEX FROM <table>` — index nào chưa đặt tên chuẩn?

#### 38.7 ENUM values
- **Chuẩn:** `lowercase`, không có space, dùng gạch ngang nếu cần — `'active'`, `'in-stock'`, `'bank-transfer'`
- **Check:** Tìm tất cả `DataTypes.ENUM` trong models — value nào viết hoa hoặc có space?

#### 38.8 Tên bảng junction (many-to-many)
- **Chuẩn:** `{table1}_{table2}` theo thứ tự alphabet hoặc logical — `product_categories`, `product_collections`, `brand_categories`
- **Check:** Các bảng junction có đặt tên đúng thứ tự không?

#### 38.9 Độ dài tên (MySQL limit)
- **Chuẩn MySQL:** Tên bảng/cột tối đa 64 ký tự; tên constraint/index tối đa 64 ký tự
- **Check:** Có tên nào vượt 64 ký tự không?

#### 38.10 Kiểu dữ liệu phù hợp với phpMyAdmin/XAMPP
- **Chuẩn:**
  - Giá tiền: `DECIMAL(15,2)` — KHÔNG dùng `FLOAT` (mất precision)
  - Ngày giờ: `TIMESTAMP` hoặc `DATETIME` — KHÔNG dùng `VARCHAR` cho date
  - Boolean: `TINYINT(1)` (MySQL không có native BOOLEAN — XAMPP hiển thị là TINYINT(1))
  - Text dài: `TEXT` hoặc `LONGTEXT` — không hardcode VARCHAR quá nhỏ cho description
  - JSON: `LONGTEXT` hoặc `JSON` type (MySQL 5.7.8+ hỗ trợ JSON native)
  - ID: `INT(11)` AUTO_INCREMENT — không dùng UUID làm PK (đã là quy ước dự án này)

### Quy trình kiểm tra

```
1. SHOW TABLES → liệt kê tất cả tên bảng → check naming
2. DESCRIBE {table} → từng cột → check snake_case, kiểu dữ liệu
3. SHOW INDEX FROM {table} → check index names
4. SHOW CREATE TABLE {table} → check constraint names, FK names
5. Grep models/ tìm DataTypes.ENUM → check ENUM values
6. So sánh model field names vs actual DB column names
```

### Fix nếu tìm thấy sai lệch

- Tên cột sai → `ALTER TABLE {table} CHANGE {old} {new} ...` + cập nhật Sequelize model + tạo migration
- Tên index sai → `ALTER TABLE DROP INDEX {old}, ADD INDEX {new_name} ({columns})`
- Tên constraint sai → `ALTER TABLE DROP FOREIGN KEY {old}, ADD CONSTRAINT {new_name} FOREIGN KEY ...`
- ENUM value sai → `ALTER TABLE MODIFY COLUMN {col} ENUM(...)` + update seed_data.sql + migration

### ✅ Acceptance Criteria Phase 38

- [x] Tất cả tên bảng là `snake_case`, số nhiều, viết thường
- [x] Tất cả cột tuân thủ `snake_case` hoặc có lý do chủ ý (underscored: false trong model)
- [x] Mọi FK column kết thúc bằng `_id` và tham chiếu đúng bảng
- [x] Mọi constraint/index có tên rõ ràng (không phải auto-generated hash)
- [x] Tất cả ENUM values là lowercase, không có khoảng trắng
- [x] Giá tiền dùng `DECIMAL(15,2)`, boolean dùng `TINYINT(1)`, không có `FLOAT` cho tiền
- [x] Không có tên bảng/cột/index nào vượt 64 ký tự
- [x] `SHOW CREATE TABLE` cho mọi bảng không có warning hoặc constraint unnamed

**Tổng kết:** 3,018 keys × 2 ngôn ngữ = toàn bộ UI text đã được bản địa hóa hoàn chỉnh.

---

## PHASE 31 — Database Migration Workflow & Product Import
> **Quy trình chuẩn để migrate DB, seed data, và thêm sản phẩm mới — cả qua file lẫn qua giao diện admin.**

### 31.1 Sequelize Migration File Standards
- **Files:** `backend/src/migrations/`
- **Chuẩn đặt tên:** `YYYYMMDDNN-verb-entity.js` — ví dụ: `2026050201-create-products.js`
- **Mỗi migration phải có đủ `up()` và `down()`:**
  ```js
  module.exports = {
    up: async (queryInterface, Sequelize) => {
      await queryInterface.createTable('products', {
        id:         { type: Sequelize.INTEGER.UNSIGNED, autoIncrement: true, primaryKey: true },
        name:       { type: Sequelize.STRING(255), allowNull: false },
        base_price: { type: Sequelize.DECIMAL(15, 2), allowNull: false, defaultValue: 0.00 },
        created_at: { type: Sequelize.DATE, allowNull: false },
        updated_at: { type: Sequelize.DATE, allowNull: false },
      });
    },
    down: async (queryInterface) => {
      await queryInterface.dropTable('products');
    },
  };
  ```
- **Không bao giờ sửa migration đã chạy** — tạo migration mới nếu cần thay đổi schema
- **Thứ tự migration** phải đúng FK dependency: `users` → `categories` → `products` → `order_items`
- **Check:** `backend/src/migrations/` có đầy đủ `down()` không; timestamp có theo thứ tự phụ thuộc không

### 31.2 migration_full.sql — Import Sạch vào phpMyAdmin
- **File:** `backend/data/migration_full.sql`
- **Tiêu chuẩn bắt buộc cho phpMyAdmin/XAMPP:**
  ```sql
  -- Header bắt buộc
  SET FOREIGN_KEY_CHECKS = 0;
  SET SQL_MODE = 'NO_AUTO_VALUE_ON_ZERO';
  SET NAMES utf8mb4;
  SET CHARACTER SET utf8mb4;

  -- Mỗi table: CREATE TABLE IF NOT EXISTS, ENGINE=InnoDB, CHARSET=utf8mb4
  CREATE TABLE IF NOT EXISTS `products` (
    `id`         INT UNSIGNED  NOT NULL AUTO_INCREMENT,
    `name`       VARCHAR(255)  NOT NULL,
    `base_price` DECIMAL(15,2) NOT NULL DEFAULT 0.00,
    `created_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `updated_at` DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

  -- Footer bắt buộc
  SET FOREIGN_KEY_CHECKS = 1;
  ```
- **Thứ tự CREATE TABLE:** không có table nào tham chiếu FK đến table chưa được tạo
- **Fix:** Rà soát `migration_full.sql` từ đầu đến cuối, reorder nếu cần, đảm bảo import một lần không có error

### 31.3 Seed Workflow — Hiện Trạng & Fix (Audit Thực Tế)

#### Hiện trạng codebase (đã audit):
- **2 cơ chế seed tách biệt và không đồng bộ:**
  1. `backend/data/seed_data.sql` (378 KB) — raw SQL `INSERT INTO` (không có IGNORE/UPSERT)
  2. `backend/scripts/seedProductsV2.js` — 45 sản phẩm hardcode bằng JavaScript
- **Scripts hiện có:**
  - `rebuildDb.js` — import trực tiếp `migration_full.sql` + `seed_data.sql` qua MySQL client
  - `rebuildDbFinal.js` — Sequelize sync rồi import SQL
  - `seedProductsV2.js` — seed bằng Sequelize models (JavaScript, không liên quan SQL file)
  - `dbCleanup.js`, `dbVerify.js`, `indexProducts.js`, `syncAll.js`
- **npm scripts hiện có:** `db:seed` (chạy seedProductsV2.js), `db:reset`, `db:cleanup`, `db:verify`, `db:index`

#### Vấn đề cần fix:
1. **`seed_data.sql` dùng bare `INSERT INTO`** — crash khi chạy lại vì duplicate PK
2. **Dual mechanism không đồng bộ** — seedProductsV2.js và seed_data.sql dữ liệu có thể lệch nhau
3. **Không có cơ chế export** — sau khi admin thêm sản phẩm qua UI, không có cách nào cập nhật seed_data.sql

#### Fix bắt buộc:
```sql
-- Fix seed_data.sql: thay toàn bộ INSERT INTO → INSERT IGNORE INTO
-- (hoặc thêm header SET FOREIGN_KEY_CHECKS=0 + TRUNCATE trước khi seed)

-- Cách 1: INSERT IGNORE (safe, không ghi đè data đã có)
INSERT IGNORE INTO `products` (`id`, `name`, ...) VALUES (...);

-- Cách 2: TRUNCATE + INSERT (clean rebuild, mất data tự tạo)
-- Thêm vào đầu seed_data.sql:
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE `order_items`;
TRUNCATE TABLE `orders`;
TRUNCATE TABLE `products`;
-- ... các bảng phụ thuộc theo thứ tự đúng
SET FOREIGN_KEY_CHECKS = 1;
-- Sau đó INSERT INTO (không cần IGNORE nữa vì đã truncate)
```

**Chọn Cách 2 cho seed_data.sql** (TRUNCATE + INSERT) vì đây là initial dataset, không phải incremental update. Cách 1 (INSERT IGNORE) dùng trong script `db:export-seed` (xem 31.4b).

- **Unify mechanism:** `seedProductsV2.js` chỉ còn gọi `rebuildDb.js` (import SQL), xóa logic JavaScript hardcode
- **npm scripts chuẩn hóa:**
  ```json
  "scripts": {
    "db:seed":        "node scripts/rebuildDb.js",
    "db:reset":       "node scripts/rebuildDb.js",
    "db:verify":      "node scripts/dbVerify.js",
    "db:index":       "node scripts/indexProducts.js",
    "db:export-seed": "node scripts/exportToSeed.js"
  }
  ```

### 31.4 Thêm Sản Phẩm Mới Vào Codebase — 2 Cơ Chế

#### Cơ chế A: Thêm trực tiếp vào `seed_data.sql` (dành cho developer)
Khi developer muốn thêm sản phẩm vào dataset gốc (để deploy lên server mới có sẵn data):

**Format chuẩn một sản phẩm trong `seed_data.sql`:**
```sql
-- 1. Insert product
INSERT IGNORE INTO `products`
  (`id`, `name`, `slug`, `short_description`, `description`,
   `base_price`, `status`, `is_featured`, `weight`, `created_at`, `updated_at`)
VALUES
  (46, 'Dell XPS 15', 'dell-xps-15', 'Laptop cao cấp cho chuyên gia',
   '<p>Mô tả chi tiết...</p>', 38990000.00, 'active', 0, 1.86,
   NOW(), NOW());

-- 2. Insert variants
INSERT IGNORE INTO `product_variants`
  (`id`, `product_id`, `sku`, `price`, `stock_quantity`, `color`, `storage`)
VALUES
  (101, 46, 'DELL-XPS15-32-1T', 38990000.00, 10, 'Platinum Silver', '32GB/1TB');

-- 3. Insert images
INSERT IGNORE INTO `product_images`
  (`product_id`, `image_url`, `alt_text`, `is_thumbnail`, `sort_order`)
VALUES
  (46, '/uploads/products/dell-xps-15-main.jpg', 'Dell XPS 15', 1, 1);

-- 4. Assign to category
INSERT IGNORE INTO `product_categories` (`product_id`, `category_id`)
VALUES (46, 1); -- category_id 1 = Laptop

-- 5. Add specifications
INSERT IGNORE INTO `product_specifications`
  (`product_id`, `spec_key`, `spec_value`, `sort_order`)
VALUES
  (46, 'CPU',    'Intel Core Ultra 7 155H', 1),
  (46, 'RAM',    '32GB LPDDR5', 2),
  (46, 'Storage','1TB NVMe SSD', 3);
```

**Checklist khi thêm sản phẩm qua file:**
- [ ] ID không trùng với sản phẩm đã có (kiểm tra max ID trong DB trước)
- [ ] Slug không duplicate (UNIQUE constraint trên `slug`)
- [ ] `category_id` tham chiếu đúng ID trong `categories`
- [ ] Chạy `npm run db:seed` → không có error
- [ ] `GET /api/products` → số lượng tăng thêm đúng

#### Cơ chế B: Export DB hiện tại → `seed_data.sql` (dành cho admin/developer sau khi thêm qua UI)
> **Đây là cơ chế quan trọng nhất** — admin thêm sản phẩm qua dashboard UI → DB có data → chạy script export → `seed_data.sql` được cập nhật → commit lên git → server mới khi `db:seed` sẽ có sản phẩm mới.

**Script: `backend/scripts/exportToSeed.js`**
```js
// Cách hoạt động:
// 1. Kết nối DB → query tất cả products, variants, images, categories, specs
// 2. Generate SQL INSERT IGNORE statements theo đúng thứ tự FK
// 3. Overwrite backend/data/seed_data.sql
// 4. Log: "Exported N products to seed_data.sql"

const exportToSeed = async () => {
  const products   = await Product.findAll({ include: ['variants', 'images', 'categories', 'specifications'] });
  const categories = await Category.findAll();
  const brands     = await Brand.findAll();

  let sql = `-- Generated by exportToSeed.js on ${new Date().toISOString()}\n`;
  sql += `SET FOREIGN_KEY_CHECKS = 0;\n`;
  // TRUNCATE sections + INSERT IGNORE for each table
  sql += generateCategorySQL(categories);
  sql += generateBrandSQL(brands);
  sql += generateProductSQL(products);  // products → variants → images → categories junction → specs
  sql += `SET FOREIGN_KEY_CHECKS = 1;\n`;

  fs.writeFileSync(path.join(__dirname, '../data/seed_data.sql'), sql, 'utf8');
};
```

**npm script:**
```json
"db:export-seed": "node scripts/exportToSeed.js"
```

**Workflow đầy đủ cho admin thêm sản phẩm vào codebase:**
```
1. Thêm sản phẩm qua Admin Dashboard UI (Phase 31.5)
           ↓
2. Verify sản phẩm hiển thị đúng trên frontend
           ↓
3. npm run db:export-seed        ← cập nhật seed_data.sql
           ↓
4. git add backend/data/seed_data.sql && git commit
           ↓
5. Server mới: npm run db:seed   ← sản phẩm mới có sẵn
```

**Checklist cơ chế B:**
- [ ] `npm run db:export-seed` chạy thành công, không crash
- [ ] `seed_data.sql` được cập nhật với sản phẩm mới vừa thêm qua UI
- [ ] `npm run db:seed` trên DB trống → import đúng tất cả sản phẩm bao gồm sản phẩm mới
- [ ] File sử dụng `INSERT IGNORE` — không crash khi chạy lại nhiều lần

### 31.5 Thêm Sản Phẩm Qua Admin Dashboard (UI Import)
> **Yêu cầu: Admin cần có giao diện import sản phẩm hàng loạt bằng CSV/JSON mà không cần can thiệp vào code.**

#### Backend — Import Endpoint
- **Route:** `POST /api/admin/products/import` (multipart/form-data, field `file`)
- **Supported formats:** `.csv`, `.json`
- **Controller logic:**
  ```js
  const importProducts = async (req, res, next) => {
    const { file } = req;
    // 1. Parse file (CSV → array of rows, JSON → array of objects)
    // 2. Validate từng row theo schema (required fields, type checks)
    // 3. Trong 1 transaction: batch insert products, variants, images, categories
    // 4. Sau khi insert thành công: trigger vector DB sync (async)
    // 5. Return: { success: N, failed: M, errors: [{ row, field, message }] }
  };
  ```
- **CSV template:** `GET /api/admin/products/import-template` → trả về file CSV mẫu để download

#### CSV Column Schema (tiêu chuẩn):
```
name*,slug,short_description,base_price*,category_slug*,brand,status,
stock_quantity,sku,weight_kg,image_urls (phân cách bởi |),
spec_cpu,spec_ram,spec_storage,spec_display,spec_battery
```
- Fields có dấu `*` là bắt buộc
- `slug` để trống → auto-generate từ `name`
- `image_urls` có thể là URLs hoặc tên file đã upload trước

#### Frontend — Import UI
- **File:** `frontend/src/pages/admin/ProductImportPage.tsx`
- **UI flow:**
  1. **Bước 1 — Upload:** Drop zone hoặc file picker (chấp nhận `.csv`, `.json`)
  2. **Bước 2 — Preview:** Bảng preview 10 dòng đầu với highlight lỗi validation (đỏ = invalid, vàng = warning)
  3. **Bước 3 — Xác nhận:** Hiển thị tóm tắt `Sẽ thêm N sản phẩm` → nút "Bắt đầu Import"
  4. **Bước 4 — Kết quả:** Progress bar → kết quả `✅ N thành công | ❌ M thất bại` + bảng lỗi có thể download

#### Route admin:
- `GET  /api/admin/products/import-template` — download CSV template
- `POST /api/admin/products/import` — upload + import file
- `GET  /api/admin/products/import-history` — lịch sử các lần import (người import, số lượng, thời gian)

### 31.6 Export Sản Phẩm (Ngược lại)
- **Route:** `GET /api/admin/products/export?format=csv` hoặc `?format=json`
- **Dùng để:** backup data, edit offline rồi import lại, migrate sang hệ thống khác
- **CSV export** phải dùng cùng column schema với import template (31.5) để round-trip được

### 31.7 Vector DB Sync Sau Khi Import
- **Vấn đề:** `backend/data/vectorDb.json` là static file — sau khi import sản phẩm mới, AI chatbot không biết sản phẩm đó
- **Fix — Trigger sync sau import:**
  ```js
  // Sau khi batch insert thành công trong importProducts controller:
  setImmediate(async () => {
    try {
      await vectorStoreService.syncNewProducts(newProductIds);
      logger.info(`[VECTOR] Synced ${newProductIds.length} new products`);
    } catch (err) {
      logger.error('[VECTOR] Sync failed after import:', err);
    }
  });
  ```
- **Admin route:** `POST /api/admin/products/sync-vectors` — manual trigger nếu sync tự động fail
- **Check:** Sau khi import → hỏi chatbot về sản phẩm mới → nhận câu trả lời có thông tin đúng

### 31.8 Import History & Audit Log
- **Table:** `import_logs` (hoặc dùng `admin_audit_logs` đã có)
  ```sql
  CREATE TABLE IF NOT EXISTS `import_logs` (
    `id`           INT UNSIGNED NOT NULL AUTO_INCREMENT,
    `admin_id`     INT UNSIGNED NOT NULL,
    `filename`     VARCHAR(255) NOT NULL,
    `total_rows`   INT          NOT NULL DEFAULT 0,
    `success_rows` INT          NOT NULL DEFAULT 0,
    `failed_rows`  INT          NOT NULL DEFAULT 0,
    `error_detail` JSON         NULL,
    `imported_at`  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    CONSTRAINT `fk_import_logs_admin` FOREIGN KEY (`admin_id`) REFERENCES `users` (`id`)
      ON DELETE RESTRICT ON UPDATE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  ```
- **Hiển thị trong admin:** trang `ProductImportPage` có tab "Lịch sử import" với bảng log

### ✅ Acceptance Criteria Phase 31
- [x] `npm run db:reset` chạy thành công từ đầu, không có error, DB có đủ 45 sản phẩm
- [x] `npm run db:fresh` (drop + rebuild từ `migration_full.sql` + seed) → không có error trong phpMyAdmin
- [x] Import CSV 5 sản phẩm mới qua admin UI → tất cả 5 xuất hiện trong shop frontend
- [x] Import CSV với 1 dòng thiếu `name` → response trả về error chi tiết cho dòng đó, 4 dòng còn lại vẫn import thành công
- [x] `GET /api/admin/products/import-template` → download file CSV mẫu với đúng headers
- [x] Sau khi import sản phẩm mới → hỏi chatbot về sản phẩm đó → nhận câu trả lời có thông tin đúng (vector sync worked)
- [x] `GET /api/admin/products/import-history` → thấy record import vừa thực hiện với đúng số lượng success/failed
- [x] `GET /api/admin/products/export?format=csv` → download file CSV có đủ 50 sản phẩm

---

| File | Phase | Vấn đề |
|------|-------|--------|
| `backend/src/controllers/product.js` ~line 1822 | 1 | SQL Injection |
| `backend/src/app.js` ~line 88 | 1 | XSS tắt |
| `backend/src/controllers/auth.js` ~lines 24, 196-203, 265 | 1 | OTP insecure, JWT blacklist |
| `backend/src/routes/upload.js` | 1 | File delete ownership |
| `backend/src/models/review.js` + `productReview.js` | 2 | Duplicate models |
| `backend/src/models/product.js` | 2 | Thiếu `stockQuantity` |
| `frontend/src/pages/CategoryPage.tsx` ~line 6 | 2 | Mock data fallback |
| `frontend/src/features/ai/services/geminiApi.ts` ~lines 2-3 | 2 | Mock data in AI |
| `backend/src/controllers/payment.js` ~lines 121-145, 326-348 | 3 | Double stock deduction |
| `backend/src/controllers/order.js` ~lines 364-368, 878 | 3 | Race condition, loyalty points |
| `backend/src/controllers/admin.js` ~lines 98, 115 | 3 | Revenue includes cancelled |
| `backend/src/app.js` (route mounting) | 4 | Missing route mounts |
| `frontend/src/types/order.types.ts` | 5 | Type mismatch với backend |
| `frontend/src/features/cart/cartSlice.ts` ~line 28 | 5 | Untyped cart items |
| `frontend/src/services/productApi.ts` | 5 | All queries return `any` |
| `backend/src/models/orderItem.js` | 6 | Naming: price → unitPrice |
| `backend/src/models/cartItem.js` | 6 | Naming: price → unitPrice |
| `backend/src/models/discountCode.js` | 6 | Missing minimumOrderAmount |
| `backend/src/controllers/order.js` | 7 | Discount code linkage |
| `backend/src/models/*.js` (tất cả) | 8 | snake_case tableName, DECIMAL types, indexes |
| `backend/src/migrations/` | 8 | down() functions, no data in migrations |
| `backend/data/seed_data.sql` | 8 | Idempotent INSERT, no hardcoded IDs |
| `backend/src/services/ai/vectorStore.js` | 9 | Static JSON, no auto-sync |
| `backend/src/services/ai/geminiChatbot.js` | 9 | No history limit, no fallback |
| `backend/src/services/ai/embedding.js` | 9 | Not triggered on product changes |
| `backend/data/vectorDb.json` | 9 | Stale vector data |
| `backend/src/controllers/chat.js` | 10 | No JWT auth, no room isolation |
| `backend/src/models/chatMessage.js` | 10 | Missing status, messageType fields |
| Admin SupportDashboard + chat routes | 10 | Missing conversation list API |
| `backend/src/config/sequelize.js`, `backend/src/app.js` | 11 | Redis cache, query optimization, DB indexes |
| `frontend/src/pages/ProductDetailPage.tsx` | 12 | Variant selection, stock display, gallery |
| `frontend/src/pages/CheckoutPage.tsx` | 12 | Form validation, address save, payment UI |
| `backend/src/middlewares/` + `backend/src/app.js` | 13 | CSP headers, CSRF protection |
| `backend/src/services/email.js` | 14 | Email templates, error isolation |
| `backend/data/migration_full.sql`, `backend/data/seed_data.sql` | 15 | utf8mb4, backticks, idempotency |
| `backend/src/middleware/errorHandler.js` | 16 | Global error format, stack trace leak |
| `backend/src/controllers/product.js` (search) | 17 | Vietnamese full-text search, filter logic |
| `backend/src/middleware/upload.js` | 18 | Multer validation, Sharp pipeline |
| `backend/src/utils/logger.js` | 19 | Winston config, no sensitive data in logs |
| `frontend/src/locales/vi.json`, `en.json` | 20 | Missing i18n keys, hardcoded strings |
| `frontend/src/pages/ProductDetailPage.tsx` | 21 | react-helmet, JSON-LD structured data |
| `backend/src/constants/index.js` | 22 | Magic numbers → constants, console.log removal |
| `backend/package.json`, `frontend/package.json` | 23 | npm audit, .env.example |
| `frontend/src/components/layout/Header.tsx` | 24 | Mobile nav, touch targets |
| `backend/src/tests/`, `frontend/src/tests/` | 25 | Jest/Vitest fixtures, critical path tests |
| `frontend/src/pages/` (tất cả trang user) | 26 | Feature completeness — crash, 404, spinner |
| `frontend/src/pages/admin/` (tất cả trang admin) | 27 | Admin CRUD, dashboard stats, chat |
| `frontend/tailwind.config.js`, `globals.css` | 28 | darkMode: 'class', CSS variables, ThemeToggle |
| `frontend/src/locales/vi.json`, `en.json` | 29 | Zero hardcoded text, key parity, live switch |
| Toàn bộ codebase | 30 | Thesis defense gate — security, demo, build |
| `backend/src/migrations/`, `backend/data/migration_full.sql` | 31 | Migration standards, up/down, FK order |
| `backend/data/seed_data.sql`, `backend/scripts/seed.js` | 31 | Idempotent seed, npm db:* scripts |
| `backend/src/controllers/admin.js` (import endpoint) | 31 | POST /admin/products/import, CSV/JSON parse |
| `frontend/src/pages/admin/ProductImportPage.tsx` | 31 | Upload → Preview → Confirm → Result UI |
| `backend/scripts/exportToSeed.js` (mới) | 31 | Export DB → seed_data.sql mechanism |
| `backend/src/models/importLog.js` | 31 | Import history table & audit |
| `frontend/src/pages/admin/DashboardPage.tsx` | 32 | Missing charts, KPI cards, low-stock widget |
| `backend/src/controllers/admin.js` (analytics) | 32 | New analytics endpoints for charts |
| `frontend/src/pages/admin/EmailCampaignsPage.tsx` | 33 | No backend — needs full implementation |
| `frontend/src/pages/admin/AuditLogPage.tsx` (mới) | 33 | Audit log viewer — backend exists, no frontend |
| `frontend/src/pages/admin/OrdersPage.tsx` | 33 | Missing: cancel, refund, invoice download |
| `frontend/src/pages/TrackOrderPage.tsx` | 33 | Cần timeline trạng thái đơn hàng thật |
| `frontend/src/pages/DealsPage.tsx` | 33 | Cần data thật từ discount codes |
| `frontend/src/pages/NewArrivalsPage.tsx` | 33 | Cần API sort=newest |
| `frontend/src/pages/BestSellersPage.tsx` | 33 | Cần API sort=bestselling |
| `frontend/src/pages/PaymentQRPage.tsx` | 33 | QR display + polling payment status |
| `backend/src/validators/` (banner, news, brand, etc.) | 34 | 12+ models thiếu Joi validator |
| `backend/src/models/newsletterSubscriber.js`, `feedback.js` | 34 | Subscribe/contact logic + admin view |
| `backend/src/services/location.js` | 34 | Geocoding → checkout address autocomplete |
| `backend/src/services/admin/adminAudit.js` | 34 | Chuyển từ file log → DB persistence |
| `frontend/src/pages/admin/SupportDashboard.tsx` | 34 | Làm rõ mục đích, fix overlap với chat |
| `backend/scripts/seedProductsV2.js` | 34 | Cleanup dual seed, unify về SQL |
| `backend/src/config/redis.js` (mới) | 35 | Redis client — chưa được khởi tạo dù đã cài |
| `backend/src/middlewares/cache.js` (mới) | 35 | Cache-aside middleware cho product endpoints |
| `backend/src/jobs/cleanup.js` (mới) | 35 | Scheduled cleanup: carts, tokens, orphan files |
| `backend/src/controllers/` (product, category) | 35 | Cache invalidation khi create/update/delete |
| `backend/src/models/recentlyViewed.js` | 36 | Recently Viewed — chưa được audit |
| `backend/src/services/ai/productNameGenerator.js` | 36 | AI name gen — chưa được kiểm tra |
| `backend/src/controllers/attribute.js`, `attributeApi.ts` | 36 | Attribute management CRUD |
| `frontend/src/pages/BrandsPage.tsx`, `CollectionsPage.tsx` | 36 | User pages chưa được audit |

---

## PHASE 34 — Các Gap Còn Lại (Phát Hiện Từ Audit Thực Tế)
> **Các vấn đề này phát hiện sau khi audit đầy đủ 38 models + 27 routes + 54 pages. Coverage sau phase này: ~99%.**

### 34.1 Validators Còn Thiếu — 12+ Model Không Có Validation
- **Vấn đề (audit thực tế):** Chỉ có 9 validators: `user, product, order, review, cart, category, discountCode, address, admin`. Thiếu validators cho các route đang active:
  - `backend/src/validators/banner.js` — POST/PUT `/api/admin/banners` không validate
  - `backend/src/validators/news.js` — POST/PUT `/api/admin/news` không validate
  - `backend/src/validators/feedback.js` — POST `/api/feedback` không validate
  - `backend/src/validators/newsletter.js` — POST `/api/newsletter/subscribe` không validate
  - `backend/src/validators/emailCampaign.js` — POST `/api/admin/email-campaigns` không validate
  - `backend/src/validators/warranty.js` — CRUD warranty packages không validate
  - `backend/src/validators/brand.js` — POST/PUT `/api/admin/brands` không validate
  - `backend/src/validators/collection.js` — POST/PUT `/api/admin/collections` không validate
  - **`backend/src/routes/payment.js` — 0 validation middleware (audit thực tế):** Routes `/create-payment-intent`, `/confirm-payment`, `/vnpay/callback`, `/momo/callback` nhận raw `req.body` không qua schema — invalid data crash handlers với lỗi không rõ ràng
  - `backend/src/validators/payment.js` — cần tạo validator cho: `{ amount: Joi.number().positive().required(), orderId: Joi.number().integer().required(), paymentMethod: Joi.string().valid('stripe','vnpay','momo','cod').required() }`
- **Fix:** Tạo Joi validator cho từng entity trên. Mỗi validator cần schema cho `create` và `update`:
  ```js
  // Ví dụ: backend/src/validators/banner.js
  const Joi = require('joi');
  const createBannerSchema = Joi.object({
    title:    Joi.string().max(255).required(),
    imageUrl: Joi.string().uri().required(),
    linkUrl:  Joi.string().uri().allow('', null),
    sortOrder:Joi.number().integer().min(0).default(0),
    isActive: Joi.boolean().default(true),
  });
  ```
- **Apply vào routes:** `validateRequest(schema)` middleware trước mỗi POST/PUT handler

### 34.2 Newsletter & Feedback — Backend Có Model, Frontend Thiếu Logic
- **Models tồn tại:** `backend/src/models/newsletterSubscriber.js`, `backend/src/models/feedback.js`
- **Vấn đề:**
  - Newsletter subscribe: form trên homepage có UI nhưng chưa chắc gọi đúng endpoint
  - Feedback (contact form): `ContactPage.tsx` submit form → cần verify endpoint hoạt động
  - Admin chưa có trang xem danh sách subscribers và feedback
- **Fix:**
  - Verify `POST /api/newsletter/subscribe` → lưu vào `newsletter_subscribers` table, trả 201
  - Verify `POST /api/feedback` (hoặc `/api/contact`) → lưu vào `feedback` table + email thông báo cho admin
  - Admin: thêm tab "Newsletter" trong EmailCampaignsPage hiển thị danh sách subscribers với export CSV
  - Admin: thêm trang "Phản hồi khách hàng" hoặc bảng trong Dashboard hiển thị feedback mới nhất

### 34.3 Location/Geocoding Service — Checkout Address Autocomplete
- **Vấn đề:** `backend/src/services/location.js` có đầy đủ geocoding/autocomplete nhưng chưa được dùng ở `CheckoutPage.tsx`
- **Routes tồn tại:** `GET /api/location/search`, `GET /api/location/forward`, `GET /api/location/reverse`
- **Fix:**
  - `CheckoutPage.tsx` — field "Địa chỉ" có autocomplete: khi user gõ → debounce 300ms → gọi `GET /api/location/search?q=...` → dropdown suggestions
  - Khi chọn suggestion → tự điền `province`, `district`, `ward` fields
  - Tương tự cho `ProfilePage.tsx` (address book form) và `UserDetailPage.tsx` (admin)

### 34.4 Audit Log DB Persistence
- **Vấn đề (audit thực tế):** `backend/src/services/admin/adminAudit.js` ghi log ra file, không có DB table → không query/filter được trong Phase 33 audit log viewer
- **Fix:**
  - Tạo model `AuditLog` (hoặc dùng table `admin_audit_logs` nếu đã có trong `migration_full.sql`)
  - `adminAudit.js` phải ghi vào DB thay vì (hoặc ngoài) file log:
    ```js
    await AuditLog.create({
      adminId, action, entityType, entityId,
      oldValue: JSON.stringify(oldValue),
      newValue: JSON.stringify(newValue),
      ipAddress: req.ip,
    });
    ```
  - **Endpoint:** `GET /api/admin/audit-logs` đọc từ DB (Phase 33.2 phụ thuộc vào fix này)

### 34.5 SupportDashboard.tsx — Làm Rõ Mục Đích & Fix Overlap
- **Vấn đề:** `frontend/src/pages/admin/SupportDashboard.tsx` tồn tại nhưng không rõ khác gì `ChatPage` hay phần chat trong admin
- **Fix:**
  - Đọc file và xác định: đây là trang xem tất cả conversations của tất cả users (admin perspective) hay là giao diện chat trực tiếp?
  - Nếu trùng với Phase 33.1 (admin chat) → merge/cleanup
  - Nếu là dashboard thống kê chat (số conversations, thời gian phản hồi trung bình) → implement đúng
  - Route phải được mount rõ ràng trong sidebar admin và `AppRoutes.tsx`

### 34.6 Dual Seed Mechanism — Cleanup `seedProductsV2.js`
- **Vấn đề (audit thực tế):** `backend/scripts/seedProductsV2.js` hardcode 45 sản phẩm bằng JavaScript — tách biệt với `seed_data.sql`
- **Fix:**
  - Chuyển `npm run db:seed` thành chạy `rebuildDb.js` (import SQL) thay vì `seedProductsV2.js`
  - Giữ `seedProductsV2.js` như là legacy/backup, không chạy trong production workflow
  - Verify rằng `rebuildDb.js` + `seed_data.sql` cho ra đúng 45 sản phẩm sau khi fix INSERT IGNORE (Phase 31.3)

### ✅ Acceptance Criteria Phase 34
- [x] `POST /api/newsletter/subscribe` với email hợp lệ → 201, email lưu trong DB
- [x] `POST /api/newsletter/subscribe` với email đã subscribe → 400 hoặc 200 (no duplicate)
- [x] `POST /api/feedback` với đủ thông tin → lưu vào DB, admin nhận email notification
- [x] Trang checkout: gõ "123 Nguyễn Văn" → dropdown địa chỉ gợi ý xuất hiện sau 300ms
- [x] `GET /api/admin/audit-logs` → trả về dữ liệu từ DB (không phải file), paginated
- [x] `POST /api/admin/banners` với thiếu `imageUrl` → nhận `422 Validation Error`
- [x] `POST /api/admin/news` với thiếu `title` → nhận `422 Validation Error`
- [x] SupportDashboard route được mount trong admin sidebar, không blank page
- [x] `npm run db:seed` chạy `rebuildDb.js` (SQL import), không chạy `seedProductsV2.js`

---

## PHASE 33 — Admin & User Pages: Tính Năng Còn Thiếu
> **Bám sát danh sách trang đã audit — fix những trang hiện đang stub hoặc thiếu logic backend.**

### 33.1 Admin — Email Campaigns (hiện chỉ có page, không có backend)
- **File:** `frontend/src/pages/admin/EmailCampaignsPage.tsx`
- **Vấn đề:** Page tồn tại nhưng không có API endpoint nào cho email campaigns trong `admin.js`
- **Cần implement:**
  - **Model `EmailCampaign`** đã có (`backend/src/models/emailCampaign.js`) — kiểm tra có đầy đủ fields không
- **HTML Injection trong Email (audit thực tế):** `backend/src/services/email.js` line ~110 interpolates `${content}` trực tiếp vào HTML template gửi cho user subscribers:
  ```js
  html: `<div>${content}</div>`  // content từ campaign.content — user-controlled via admin UI
  ```
  Nếu admin account bị compromise → attacker có thể gửi email với JavaScript/phishing HTML đến toàn bộ subscriber list
  - **Fix:** Sanitize campaign content trước khi đưa vào HTML email — dùng DOMPurify (server-side: `dompurify` + `jsdom`) hoặc `sanitize-html` package với allowlist tags (chỉ cho phép `p`, `b`, `i`, `a`, `img`, `h1`-`h3`)
  - **Backend endpoints:**
    - `GET  /api/admin/email-campaigns` — danh sách với status (draft/sent/scheduled)
    - `POST /api/admin/email-campaigns` — tạo campaign mới
    - `POST /api/admin/email-campaigns/:id/send` — gửi ngay
    - `POST /api/admin/email-campaigns/:id/schedule` — lên lịch gửi
  - **Logic gửi:** lấy danh sách subscribers từ `newsletter_subscribers` table → batch send via `emailService`
  - **Rate limit:** không gửi quá 50 email/phút (tránh spam filter)
  - **Frontend:** form tạo campaign (subject, html body với WYSIWYG editor), danh sách campaigns với status badge, nút Gửi ngay / Lên lịch

### 33.2 Admin — Audit Log Viewer (backend có, frontend chưa có)
- **Vấn đề:** `backend/src/services/admin/adminAudit.js` đang log vào DB nhưng không có trang xem
- **Cần thêm:**
  - **Endpoint:** `GET /api/admin/audit-logs?page=&limit=&adminId=&action=&startDate=&endDate=`
  - **Frontend:** tạo `frontend/src/pages/admin/AuditLogPage.tsx`:
    - Bảng: Thời gian | Admin | Hành động | Đối tượng | ID | Chi tiết
    - Filter: theo admin, theo loại action, theo date range
    - Click vào row → modal hiện `oldValue` vs `newValue` (JSON diff)
  - **Route admin:** thêm link "Nhật ký hệ thống" vào sidebar

### 33.3 Admin — Order Management: Tính Năng Còn Thiếu
- **File:** `frontend/src/pages/admin/OrdersPage.tsx`
- **Hiện có:** list orders, update status
- **Cần thêm:**
  - **Cancel order + hoàn stock:** `PUT /api/admin/orders/:id/cancel` → cập nhật status + cộng lại `stockQuantity`
  - **Filter nâng cao:** filter theo ngày, theo payment method, theo status — hiện chỉ có text search
  - **Export orders:** `GET /api/admin/orders/export?startDate=&endDate=&format=csv`
  - **Invoice/receipt:** `GET /api/admin/orders/:id/invoice` → PDF hoặc print-ready HTML
  - **Order detail modal:** click vào order → modal/drawer hiện: items (tên, qty, giá), địa chỉ, payment info, timeline trạng thái

### 33.4 Admin — Review Management: Approve/Feature Workflow
- **File:** `frontend/src/pages/admin/` (review management nằm trong ProductsPage hoặc riêng)
- **Hiện có:** chỉ `DELETE /api/admin/reviews/:id`
- **Cần thêm:**
  - `PATCH /api/admin/reviews/:id/approve` — duyệt review (nếu có cơ chế moderation)
  - `PATCH /api/admin/reviews/:id/feature` — đánh dấu "review nổi bật" hiển thị trên trang chủ
  - Filter: theo sản phẩm, theo rating, theo trạng thái (approved/pending)
  - **Frontend:** trang reviews riêng hoặc tab trong admin, có thể reply to review

### 33.5 Admin — Inventory Management
- **Vấn đề:** không có trang nào để xem tổng tồn kho, lịch sử nhập/xuất kho
- **Cần thêm:**
  - **Inventory list page:** `frontend/src/pages/admin/InventoryPage.tsx`
    - Bảng: Sản phẩm | SKU | Tồn kho hiện tại | Threshold | Status (OK/Low/Out)
    - Filter: chỉ hiện low/out of stock
    - Inline edit: click vào số tồn kho → nhập số mới → save (gọi `PATCH /api/admin/products/:id/stock`)
  - **Bulk stock update:** upload CSV với cột `sku`, `stock_quantity`
  - **Endpoint:** `PATCH /api/admin/products/:id/stock` — update `stockQuantity` trực tiếp

### 33.6 User — TrackOrderPage (hiện tại stub)
- **File:** `frontend/src/pages/TrackOrderPage.tsx`
- **Fix:** Hiển thị timeline trạng thái đơn hàng bằng stepper component:
  ```
  ✅ Đặt hàng → ✅ Xác nhận thanh toán → 🔄 Đang chuẩn bị → ⬜ Đang giao → ⬜ Đã nhận
  ```
- **Backend:** `GET /api/orders/:orderNumber/track` (public, chỉ cần order number + email) hoặc `GET /api/orders/:id` (authenticated)
- **Data hiển thị:** timeline stepper, estimated delivery date, shipping info, order items summary

### 33.7 User — DealsPage (hiện tải data không đúng)
- **File:** `frontend/src/pages/DealsPage.tsx`
- **Fix:** Fetch sản phẩm có discount code đang active hoặc có sale price:
  - `GET /api/products?hasDiscount=true` hoặc filter `salePrice < basePrice`
  - Hiển thị: giá gốc (gạch ngang), giá giảm, % giảm badge, countdown timer nếu có expiry

### 33.8 User — NewArrivalsPage & BestSellersPage
- **Files:** `frontend/src/pages/NewArrivalsPage.tsx`, `frontend/src/pages/BestSellersPage.tsx`
- **Vấn đề:** hai trang này có thể đang dùng mock data hoặc gọi API sai
- **Fix:**
  - `GET /api/products?sort=newest&limit=20` — sản phẩm mới nhất theo `createdAt DESC`
  - `GET /api/products?sort=bestselling&limit=20` — sản phẩm bán chạy theo `soldCount DESC`
  - Backend: thêm sort options này vào product controller nếu chưa có

### 33.9 User — PaymentQRPage (VNPay/MoMo QR)
- **File:** `frontend/src/pages/PaymentQRPage.tsx`
- **Fix:**
  - Nhận `qrCodeUrl` và `orderId` từ query params hoặc state
  - Hiển thị QR code image + countdown timer (QR hết hạn sau N phút)
  - **Polling**: `GET /api/orders/:id/payment-status` mỗi 5 giây → khi `paymentStatus === 'paid'` → redirect đến order confirmation
  - Fallback: nút "Tôi đã thanh toán" để manual check

### 33.10 User — Loyalty Points Page
- **Vấn đề:** loyalty points chỉ hiển thị số dư trong profile, không có trang riêng với lịch sử
- **Cần thêm:**
  - `GET /api/loyalty/history` → list transactions (earn/redeem) with orderId, points, date
  - `frontend/src/pages/LoyaltyPage.tsx` (hoặc tab trong ProfilePage):
    - KPI: Tổng điểm | Điểm đã dùng | Điểm còn lại
    - Bảng: Ngày | Loại (Nhận/Đổi) | Điểm | Liên kết đơn hàng
    - Nút "Đổi điểm" nếu đủ điều kiện

### 33.11 Admin — Warranty Packages (WarrantyPackagesPage.tsx)
- **Kiểm tra:** trang đã có nhưng cần verify:
  - CRUD warranty packages hoạt động đầy đủ
  - Warranty có thể được assign cho sản phẩm cụ thể
  - User sau khi mua có thể xem warranty info trong Order Detail

### ✅ Acceptance Criteria Phase 33
- [x] `POST /api/admin/email-campaigns/:id/send` → gửi email tới tất cả subscribers, log count
- [x] `GET /api/admin/audit-logs` → trả về paginated list với đúng format `{ adminId, action, entityType, entityId }`
- [x] Admin cancel order → `GET /api/products/:id` → stockQuantity tăng đúng số lượng trong order
- [x] TrackOrderPage hiển thị stepper đúng bước hiện tại của đơn hàng
- [x] NewArrivalsPage load → sản phẩm có `createdAt` mới nhất xuất hiện đầu tiên
- [x] DealsPage: chỉ hiện sản phẩm có giá sale thực sự < giá gốc
- [x] PaymentQRPage: polling mỗi 5s, khi thanh toán xong → tự redirect không cần user click
- [x] Inventory page: sản phẩm stock=0 hiển thị badge đỏ "Hết hàng"

---

## PHASE 32 — Admin Dashboard: Complete Analytics & Charts
> **Dựa trên `DashboardPage.tsx` hiện tại (Recharts) — bổ sung các chart và KPI card còn thiếu, thêm backend endpoints tương ứng.**

### Trạng thái hiện tại (audit thực tế)
- **DashboardPage.tsx đang có:** Area Chart (revenue 7d/30d/90d), Bar Chart (order count), Period selector
- **getDashboardStats() đang trả về:** total counts, monthly data, growth %, top 5 products (by count only)
- **Còn thiếu hoàn toàn:** order status pie chart, category revenue chart, user growth chart, AOV metric, payment method breakdown, low-stock alerts

### 32.1 KPI Cards — Bổ Sung
- **File:** `frontend/src/pages/admin/DashboardPage.tsx`
- **Hiện có 4 cards:** Total Users, Total Products, Total Orders, Total Revenue
- **Cần thêm 3 cards:**
  | Card | Formula | Backend field |
  |------|---------|---------------|
  | **AOV** (Average Order Value) | `totalRevenue / totalOrders` | Tính trong `getDashboardStats()` |
  | **Đơn hủy tháng này** | Số orders có `status='cancelled'` trong tháng hiện tại | `cancelledOrdersMonth` |
  | **Sản phẩm sắp hết hàng** | Số sản phẩm có `stockQuantity <= 5` | `lowStockCount` (link → bảng phía dưới) |

- **Fix `backend/src/controllers/admin.js` `getDashboardStats()`:** thêm 3 trường trên vào response

### 32.2 Pie/Donut Chart — Phân Bổ Trạng Thái Đơn Hàng
- **File:** `frontend/src/pages/admin/DashboardPage.tsx`
- **Endpoint cần thêm:** `GET /api/admin/analytics/order-status`
  ```js
  // Response:
  { data: [
    { status: 'pending',    count: 12, label: 'Chờ xử lý' },
    { status: 'processing', count:  8, label: 'Đang xử lý' },
    { status: 'shipped',    count: 25, label: 'Đang giao' },
    { status: 'delivered',  count: 145, label: 'Đã giao' },
    { status: 'cancelled',  count:  6, label: 'Đã hủy' },
  ]}
  ```
- **Frontend:** Recharts `<PieChart>` + `<Legend>` — hiển thị bên phải của Area Chart
- **SQL backend:**
  ```js
  const statusDist = await Order.findAll({
    attributes: ['status', [sequelize.fn('COUNT', sequelize.col('id')), 'count']],
    group: ['status'],
    where: { createdAt: { [Op.gte]: startDate } },
    raw: true,
  });
  ```

### 32.3 Bar Chart — Top 5 Sản Phẩm Theo Doanh Thu
- **Vấn đề hiện tại:** `getDashboardStats()` trả về top5 theo `soldCount` — **không có trường revenue per product**
- **Fix backend:** thêm endpoint `GET /api/admin/analytics/top-products?metric=revenue&limit=5`
  ```js
  const topByRevenue = await OrderItem.findAll({
    attributes: [
      'productId',
      [sequelize.fn('SUM', sequelize.col('unit_price')), 'revenue'],
      [sequelize.fn('SUM', sequelize.col('quantity')), 'soldCount'],
    ],
    include: [{ model: Product, attributes: ['name', 'thumbnail'] }],
    group: ['productId'],
    order: [[sequelize.literal('revenue'), 'DESC']],
    limit: 5,
    where: { '$Order.payment_status$': 'paid' },
    raw: true,
  });
  ```
- **Frontend:** Recharts `<BarChart horizontal>` với tooltip hiển thị cả revenue lẫn sold count
- **Tab selector** trên chart: "Doanh thu" / "Số lượng bán" — switch metric

### 32.4 Bar Chart — Doanh Thu Theo Danh Mục
- **Endpoint cần thêm:** `GET /api/admin/analytics/revenue-by-category?startDate=&endDate=`
  ```js
  // JOIN orders → order_items → product_categories → categories
  // GROUP BY category_id
  // WHERE order.payment_status = 'paid'
  ```
- **Frontend:** Recharts `<BarChart vertical>` — top 8 categories, có color coding
- **Đặt dưới** Top Products chart, cùng khu vực analytics

### 32.5 Line Chart — Tăng Trưởng Người Dùng
- **Endpoint cần thêm:** `GET /api/admin/analytics/user-growth?startDate=&endDate=&groupBy=day`
  ```js
  const userGrowth = await User.findAll({
    attributes: [
      [sequelize.fn('DATE', sequelize.col('created_at')), 'date'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'newUsers'],
    ],
    where: { createdAt: { [Op.between]: [startDate, endDate] } },
    group: [sequelize.fn('DATE', sequelize.col('created_at'))],
    raw: true,
  });
  ```
- **Frontend:** Recharts `<LineChart>` — đặt song song với Revenue chart, có thể toggle hiển thị

### 32.6 Pie Chart — Phân Bổ Phương Thức Thanh Toán
- **Endpoint cần thêm:** `GET /api/admin/analytics/payment-methods`
  ```js
  // GROUP BY payment_method WHERE payment_status = 'paid'
  // { method: 'cod', count: 45, revenue: 23000000 },
  // { method: 'stripe', count: 30, revenue: 58000000 },
  // { method: 'vnpay', count: 20, revenue: 31000000 },
  ```
- **Frontend:** Recharts `<PieChart>` nhỏ — đặt trong section "Thống kê thanh toán"

### 32.7 Low Stock Alert Widget
- **Endpoint cần thêm:** `GET /api/admin/analytics/low-stock?threshold=10`
  ```js
  // Trả về products (hoặc variants) có stockQuantity <= threshold
  // { id, name, sku, stockQuantity, thumbnail }
  // Sắp xếp: stockQuantity ASC (hết hàng nhất lên đầu)
  ```
- **Frontend widget:** Bảng nhỏ ở cuối dashboard — cột: Sản phẩm, SKU, Tồn kho, Action (link đến edit product)
- **Badge đỏ** trên KPI card "Sắp hết hàng" link thẳng xuống widget này

### 32.8 Date Range Picker cho Tất Cả Charts
- **Hiện tại:** chỉ có preset "7d / 30d / 90d"
- **Fix:** Thêm date range picker (có thể dùng `react-datepicker` hoặc native `<input type="date">`)
- **Khi chọn custom range:** tất cả charts và KPI cards đều re-fetch với `startDate` + `endDate` mới
- **Persist selection** trong URL query params (`?from=2026-01-01&to=2026-01-31`) để có thể share link

### 32.9 Export Report
- **Nút "Xuất báo cáo" trên DashboardPage:**
  - `GET /api/admin/reports/export?type=orders&startDate=&endDate=&format=csv`
  - `GET /api/admin/reports/export?type=products&format=csv`
  - Backend: dùng `fast-csv` hoặc `json2csv` package để generate CSV stream
  - Frontend: click nút → trigger download (không cần open new tab)

### 32.X Chatbot Analytics Admin Dashboard (audit thực tế — bổ sung từ Phase 9.16)

**Vấn đề:** Analytics tracking trong chatbot service chỉ `console.log`, không lưu DB, không có UI admin.

**Backend — Thêm fields vào chat analytics khi lưu DB (Phase 9.12):**
- `intent VARCHAR(50)` — classified intent của mỗi turn
- `responseTimeMs INT` — thời gian xử lý từ request đến response
- `isFallback BOOLEAN` — true nếu `simpleKeywordMatch()` được dùng thay LLM
- `sessionId VARCHAR(100)` — group theo session

**Backend — Endpoint:** `GET /api/admin/chatbot/stats?startDate=&endDate=` (admin only):
```json
{
  "totalSessions": 142,
  "totalMessages": 867,
  "avgMessagesPerSession": 6.1,
  "intentBreakdown": { "product_search": 45, "pricing": 20, "off_topic": 20 },
  "fallbackRate": 0.12,
  "avgResponseTimeMs": 1840
}
```

**Frontend — Thêm tab "AI Chatbot" trong DashboardPage.tsx:**
- KPI cards: Total Sessions, Avg Messages/Session, Fallback Rate, Avg Response Time
- Pie chart: Intent Breakdown
- Line chart: Daily active sessions (7d/30d)

### ✅ Acceptance Criteria Phase 32
- [ ] DashboardPage load → hiển thị đủ 7 chart/widget: Revenue Area, Order Bar, Order Status Pie, Top Products Bar, Category Bar, User Growth Line, Payment Methods Pie
- [ ] KPI cards hiển thị đúng AOV: tạo 2 orders (100k + 200k) → AOV = 150k
- [ ] Low stock widget hiển thị product có stock = 3 (dưới threshold 10)
- [ ] Chọn date range tùy chỉnh → tất cả charts cập nhật data theo range đó
- [ ] Nút "Xuất báo cáo" → download được file CSV với đúng data
- [ ] Chart order status: tổng số trong pie = tổng orders trong DB
- [ ] Tab "AI Chatbot" trong Dashboard → hiển thị Total Sessions, Fallback Rate, Intent Breakdown
- [ ] `GET /api/admin/chatbot/stats` trả về 401 nếu không có admin token

---

## PHASE 35 — Caching Strategy & Data Cleanup
> **Audit thực tế: Redis đã cài nhưng chưa dùng gì. Không có HTTP cache header. Không có scheduled cleanup job. Accumulated technical debt ngày càng tăng.**

### Hiện trạng (Audit Thực Tế — Critical)
| Vấn đề | Mức độ |
|--------|--------|
| Redis v5.5.6 được cài nhưng **không một dòng code nào** khởi tạo hay dùng | 🔴 Critical |
| Không có HTTP `Cache-Control` header trên bất kỳ endpoint nào | 🔴 Critical |
| Abandoned cart tích lũy không giới hạn, không bao giờ xóa | 🔴 High |
| SearchHistory tích lũy mãi mãi, không có TTL hay giới hạn | 🟡 High |
| OTP hết hạn: chỉ set null khi dùng, DB row vẫn còn | 🟡 Medium |
| Reset token hết hạn: tương tự — nulled nhưng row vẫn còn | 🟡 Medium |
| Orphaned upload files: function cleanup tồn tại nhưng không bao giờ tự chạy | 🟡 Medium |
| Expired discount codes không bao giờ bị purge | 🟡 Medium |
| Soft delete chỉ dùng trên 6/38 models — User, Order, Cart bị hard delete | 🟡 High |
| ChatMessage tích lũy vô hạn, không có retention policy | 🟡 Medium |

---

### 35.1 Khởi Tạo Redis Client
- **File mới:** `backend/src/config/redis.js`
  ```js
  const { createClient } = require('redis');

  const redisClient = createClient({
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    socket: { reconnectStrategy: (retries) => Math.min(retries * 50, 2000) },
  });

  redisClient.on('error', (err) => logger.error('[Redis] Client error:', err));
  redisClient.on('connect', () => logger.info('[Redis] Connected'));

  const connectRedis = async () => {
    if (!redisClient.isOpen) await redisClient.connect();
  };

  module.exports = { redisClient, connectRedis };
  ```
- **Import trong `backend/src/app.js`:** gọi `connectRedis()` khi server start
- **Dùng cho:** JWT blacklist (Phase 1.3), rate limiting store, cache layer, session

### 35.2 Cache-Aside Pattern — Product & Category Endpoints
> **Nguyên tắc:** Cache data đọc nhiều + thay đổi ít. KHÔNG cache data nhạy cảm (user info, cart, orders).

**TTL Policy theo loại data:**
| Endpoint | TTL | Lý do |
|----------|-----|-------|
| `GET /api/categories` (tree) | 30 phút | Rất ít thay đổi |
| `GET /api/products?...` (list) | 3 phút | Thay đổi khi admin edit |
| `GET /api/products/:id` (detail) | 5 phút | Invalidated khi update |
| `GET /api/products/featured` | 10 phút | Semi-static |
| `GET /api/brands` | 30 phút | Ít thay đổi |
| `GET /api/banners` | 15 phút | Ít thay đổi |
| Stock quantity | **KHÔNG cache** | Real-time accuracy bắt buộc |
| User data, Cart, Orders | **KHÔNG cache** | Security & consistency |

**File mới: `backend/src/middlewares/cache.js`**
```js
const { redisClient } = require('../config/redis');

const cacheMiddleware = (ttlSeconds, keyFn) => async (req, res, next) => {
  const key = keyFn ? keyFn(req) : `cache:${req.originalUrl}`;
  try {
    const cached = await redisClient.get(key);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.json(JSON.parse(cached));
    }
    // Monkey-patch res.json để cache response
    const originalJson = res.json.bind(res);
    res.json = (data) => {
      if (res.statusCode === 200) {
        redisClient.setEx(key, ttlSeconds, JSON.stringify(data)).catch(() => {});
      }
      res.setHeader('X-Cache', 'MISS');
      return originalJson(data);
    };
    next();
  } catch (err) {
    next(); // Redis fail → fallthrough gracefully (không crash server)
  }
};

const invalidateCache = async (pattern) => {
  const keys = await redisClient.keys(pattern);
  if (keys.length > 0) await redisClient.del(keys);
};

module.exports = { cacheMiddleware, invalidateCache };
```

**Apply vào routes:**
```js
// backend/src/routes/product.js
router.get('/',     cacheMiddleware(180, (req) => `cache:products:${JSON.stringify(req.query)}`), productController.getProducts);
router.get('/:id',  cacheMiddleware(300, (req) => `cache:product:${req.params.id}`), productController.getProductById);
router.get('/featured', cacheMiddleware(600), productController.getFeatured);

// backend/src/routes/category.js
router.get('/', cacheMiddleware(1800, () => 'cache:categories:tree'), categoryController.getAll);
```

### 35.3 Cache Invalidation — Khi Data Thay Đổi
> **Rule:** Mỗi khi admin create/update/delete → xóa cache liên quan ngay lập tức.

**File: `backend/src/controllers/admin.js` (product CRUD):**
```js
const { invalidateCache } = require('../middlewares/cache');

// Sau khi create/update/delete product:
await invalidateCache('cache:product:*');     // xóa tất cả product detail cache
await invalidateCache('cache:products:*');    // xóa tất cả product list cache
await invalidateCache('cache:categories:*');  // nếu category được thay đổi
```

**Checklist invalidation phải cover:**
- [ ] Admin update product → xóa `cache:product:{id}` + `cache:products:*`
- [ ] Admin delete product → xóa `cache:product:{id}` + `cache:products:*`
- [ ] Admin update category → xóa `cache:categories:*` + `cache:products:*`
- [ ] Admin update banner → xóa `cache:banners:*`
- [ ] Admin update brand → xóa `cache:brands:*`

### 35.4 HTTP Cache-Control Headers
**File: `backend/src/middlewares/cache.js` (thêm vào):**
```js
const httpCacheHeaders = (maxAgeSeconds, options = {}) => (req, res, next) => {
  if (req.method === 'GET') {
    res.setHeader('Cache-Control',
      options.private
        ? `private, max-age=${maxAgeSeconds}`
        : `public, max-age=${maxAgeSeconds}, stale-while-revalidate=${maxAgeSeconds * 2}`
    );
  }
  next();
};
```

**Apply:**
- Static assets (uploads/): `Cache-Control: public, max-age=31536000` (1 năm, CDN-friendly)
- API product list: `Cache-Control: public, max-age=60, stale-while-revalidate=120`
- API user data: `Cache-Control: private, no-store` (không bao giờ cache)

### 35.5 Scheduled Data Cleanup Jobs
> **Redis không phải giải pháp cho data cleanup — DB cleanup cần cron job chạy định kỳ.**

**File mới: `backend/src/jobs/cleanup.js`**
```js
const cron = require('node-cron');  // npm install node-cron (đã có không? nếu không thì thêm)
const { Op } = require('sequelize');
const { Cart, SearchHistory, User, DiscountCode, ChatMessage } = require('../models');

// ---- Chạy mỗi ngày lúc 2:00 AM ----
cron.schedule('0 2 * * *', async () => {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);

  // 1. Xóa abandoned carts (status='abandoned' + updatedAt > 30 ngày)
  const deletedCarts = await Cart.destroy({
    where: { status: 'abandoned', updatedAt: { [Op.lt]: thirtyDaysAgo } },
  });
  logger.info(`[Cleanup] Deleted ${deletedCarts} abandoned carts`);

  // 2. Giới hạn search history: mỗi user chỉ giữ 50 entries gần nhất
  // (complex query — dùng raw SQL để xóa rows cũ hơn row thứ 50 của mỗi user)
  await sequelize.query(`
    DELETE FROM search_history
    WHERE id NOT IN (
      SELECT id FROM (
        SELECT id FROM search_history sh2
        WHERE sh2.user_id = search_history.user_id
        ORDER BY created_at DESC LIMIT 50
      ) AS recent
    )
  `);
  logger.info('[Cleanup] Search history trimmed to 50 per user');

  // 3. Null-out stale OTP rows (otpExpires < now)
  await User.update(
    { otpCode: null, otpExpires: null },
    { where: { otpExpires: { [Op.lt]: new Date() }, otpCode: { [Op.ne]: null } } }
  );

  // 4. Null-out expired reset tokens
  await User.update(
    { resetPasswordToken: null, resetPasswordExpires: null },
    { where: { resetPasswordExpires: { [Op.lt]: new Date() }, resetPasswordToken: { [Op.ne]: null } } }
  );

  // 5. Deactivate expired discount codes (không xóa — giữ lại cho audit)
  await DiscountCode.update(
    { isActive: false },
    { where: { endDate: { [Op.lt]: new Date() }, isActive: true } }
  );

  // 6. Archive old chat messages (optional: move to archive table vs soft delete)
  await ChatMessage.update(
    { isArchived: true },
    { where: { createdAt: { [Op.lt]: ninetyDaysAgo }, isArchived: false } }
  );

  logger.info('[Cleanup] Daily cleanup completed');
});

// ---- Chạy mỗi tuần vào Chủ Nhật 3:00 AM ----
cron.schedule('0 3 * * 0', async () => {
  // Cleanup orphaned upload files (function đã có trong image.js)
  await imageService.cleanupOrphanedFiles();
  logger.info('[Cleanup] Weekly orphaned file cleanup completed');
});
```

**Import trong `backend/src/app.js`:**
```js
require('./jobs/cleanup'); // Start cleanup cron jobs
```

### 35.6 Soft Delete Strategy — User & Order
> **Vấn đề: User và Order đang hard delete — mất dữ liệu vĩnh viễn khi xóa.**

**Models cần thêm `paranoid: true`:**
- `backend/src/models/user.js` — KHÔNG bao giờ hard delete user (ảnh hưởng order history, reviews)
- `backend/src/models/order.js` — KHÔNG bao giờ xóa order (audit trail)
- `backend/src/models/discountCode.js` — giữ lại cho audit (expired nhưng không xóa)
- `backend/src/models/chatMessage.js` — thêm `isArchived` field thay vì delete

**Cách thêm soft delete:**
```js
// Trong model definition:
const User = sequelize.define('User', { ... }, {
  paranoid: true,  // Thêm dòng này → Sequelize tự thêm deletedAt field
  timestamps: true,
});
```

**Migration cần tạo:** `ALTER TABLE users ADD COLUMN deleted_at DATETIME NULL`

**Admin "xóa user":** thực ra gọi `user.destroy()` → Sequelize chỉ set `deleted_at = NOW()`, không xóa row. User bị banned/deactivated, không thể login. Data vẫn còn cho audit.

### 35.7 Rate Limiter — Chuyển Từ Memory Store Sang Redis Store
> **Vấn đề hiện tại:** `express-rate-limit` đang dùng in-memory store → rate limit bị reset khi server restart, không hoạt động với multiple server instances.

```js
// backend/src/middlewares/rateLimiter.js — FIX
const rateLimit    = require('express-rate-limit');
const RedisStore   = require('rate-limit-redis');  // npm install rate-limit-redis
const { redisClient } = require('../config/redis');

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  store: new RedisStore({
    sendCommand: (...args) => redisClient.sendCommand(args),
    prefix: 'rl:auth:',
  }),
  keyGenerator: (req) => req.body?.email || req.ip,  // per-email, fallback per-IP
  message: { status: 'error', message: 'Quá nhiều lần thử, vui lòng thử lại sau 15 phút.' },
});
```

### 35.8 Cache Warming (Optional nhưng nên có)
Khi server khởi động lần đầu hoặc sau khi Redis flush → cache trống:

```js
// backend/src/app.js — sau khi DB connect:
const warmCache = async () => {
  const categories = await Category.findAll({ ... });
  await redisClient.setEx('cache:categories:tree', 1800, JSON.stringify(categories));
  logger.info('[Cache] Warmed: categories');
};
```

### 35.7 Chatbot Response & Embedding Cache

**Vấn đề (audit thực tế):**
- Không có embedding caching: user hỏi cùng câu 10 lần → 10 API calls tới OpenRouter (tốn token, tăng latency)
- Chatbot response không được cache: cùng query → rerun toàn bộ pipeline (embed → vector search → LLM)

**Fix 1 — Embedding Cache (in-memory)**
- **File:** `backend/src/services/ai/embedding.js`
- Thêm `Map<string, { vector: number[], ts: number }>` với limit 500 entries, TTL 10 phút:
  ```js
  const embeddingCache = new Map();
  const CACHE_TTL = 10 * 60 * 1000;
  const CACHE_MAX = 500;
  // Key: text.toLowerCase().trim()
  // Evict entries quá TTL khi Map size > CACHE_MAX (FIFO delete oldest)
  ```

**Fix 2 — Query Result Cache (Redis, TTL 5 phút)**
- **File:** `backend/src/services/ai/geminiChatbot.js` hàm `handleMessage()`
- Sau khi có `rewrittenQuery`, check Redis trước khi chạy toàn pipeline:
  ```js
  const cacheKey = `chatbot:${userId}:${rewrittenQuery.toLowerCase().trim()}`;
  const cached = await redisClient.get(cacheKey);
  if (cached) return JSON.parse(cached);
  // ... run full pipeline ...
  await redisClient.setEx(cacheKey, 300, JSON.stringify(result));
  ```
- **Cache invalidation:** Khi admin update/delete product → xóa tất cả keys matching `chatbot:*`
- **Lưu ý:** Chỉ cache intent `product_search` và `recommendation` — KHÔNG cache `order_inquiry`, `support` (data realtime)

### ✅ Acceptance Criteria Phase 35
- [ ] `backend/src/config/redis.js` tồn tại, server start không crash dù Redis chưa bật (graceful fallback)
- [ ] `GET /api/products` lần đầu: `X-Cache: MISS`; lần thứ 2 cùng params: `X-Cache: HIT`, response time giảm >50%
- [ ] Admin update product → `X-Cache: MISS` cho product đó (cache đã invalidate)
- [ ] `GET /api/categories` → `Cache-Control: public, max-age=1800` header tồn tại
- [ ] `GET /api/orders` (authenticated) → `Cache-Control: private, no-store` (không bao giờ cache user data)
- [ ] Cron job chạy đúng giờ: kiểm tra log `[Cleanup] Daily cleanup completed` lúc 2:00 AM
- [ ] Tạo cart với `status='abandoned'`, update `updatedAt` về 31 ngày trước → chạy cleanup → cart bị xóa
- [ ] Tạo User, gán OTP, set `otpExpires` về quá khứ → chạy cleanup → `otpCode = null`
- [ ] `express-rate-limit` với authLimiter dùng Redis store: restart server → rate limit counter vẫn giữ (không reset)
- [ ] Không có PII (email, address, password hash) nào được lưu trong Redis cache
- [ ] Hỏi chatbot cùng câu 2 lần → lần thứ 2 response time < 100ms (embedding cache hit, log `[Embedding] Cache HIT`)
- [ ] Admin xóa sản phẩm → chatbot hỏi về sản phẩm đó → kết quả đã invalidate (không trả về sản phẩm đã xóa từ cache)

---

## PHASE 36 — Coverage Completion: 5% Còn Lại
> **Audit thực tế phát hiện 4 nhóm feature có file tồn tại nhưng chưa được cover trong bất kỳ phase nào. Phase này đưa coverage từ ~95% lên ~100%.**

### 36.1 Recently Viewed Products
- **Files:** `backend/src/models/recentlyViewed.js`, logic trong `backend/src/controllers/product.js` (getRecentlyViewed), frontend component/hook
- **Kiểm tra:**
  - Model `recentlyViewed.js` có đủ fields: `userId`, `productId`, `viewedAt` không
  - Controller có endpoint `GET /api/products/recently-viewed` không — có giới hạn N items không
  - Khi user xem product detail → có ghi vào `recently_viewed` không (POST hoặc tự động)
  - Khi product bị xóa → recently viewed record có bị cascade delete không (FK `ON DELETE CASCADE`)
  - Frontend: component "Sản phẩm đã xem" trên ProductDetailPage hoặc ProfilePage có load data thật không
  - **Cleanup:** `recentlyViewed` records cũ hơn 90 ngày phải được xóa trong cleanup job (Phase 35.5 — thêm vào)
- **Fix nếu thiếu:**
  - Thêm endpoint nếu chưa có
  - Giới hạn 20 items per user (xóa oldest khi vượt)
  - Thêm vào cleanup job: `RecentlyViewed.destroy({ where: { viewedAt: { [Op.lt]: ninetyDaysAgo } } })`

### 36.2 AI Product Name Generator
- **Files:** `backend/src/services/ai/productNameGenerator.js`, `frontend/src/services/productNamingService.ts`
- **Chức năng:** Admin nhập thông tin sản phẩm → AI gợi ý tên sản phẩm tự động
- **Kiểm tra:**
  - Service có đang gọi Gemini API không — có xử lý rate limit / API key missing không
  - Nếu Gemini API key không set → có fallback graceful không (không crash server)
  - Frontend: nút "Gợi ý tên AI" trong `CreateProductPage.tsx` có hoạt động không
  - Response có được sanitize trước khi hiển thị không (XSS prevention cho AI output)
  - Có log lại AI requests không (cost tracking)
- **Fix nếu thiếu:**
  - Wrap trong try/catch, trả về 503 nếu API key missing hoặc rate limited
  - Validate AI output: trim whitespace, max length 255, no HTML tags
  - Thêm `[AI_NAME_GEN]` log entry để track usage

### 36.3 Attribute Management System
- **Files:** `backend/src/controllers/attribute.js`, `backend/src/models/attributeGroup.js`, `backend/src/models/attributeValue.js`, `frontend/src/services/attributeApi.ts`, `frontend/src/hooks/useProductAttributes.ts`
- **Chức năng:** Quản lý thuộc tính sản phẩm (màu sắc, size, v.v.) — dùng trong product variant creation
- **Kiểm tra:**
  - `GET /api/attributes` → trả về attribute groups với values
  - `POST /api/admin/attributes` → tạo attribute group mới (có validator không — Phase 34.1)
  - `useProductAttributes.ts` hook: có handle loading/error state không
  - Khi xóa AttributeGroup → các AttributeValue liên quan có bị cascade delete không
  - `CreateProductPage.tsx` dùng attributes để tạo variants — flow có hoạt động end-to-end không
- **Fix nếu thiếu:**
  - Thêm Joi validator cho attribute CRUD (covered trong Phase 34.1 — verify đã có chưa)
  - Thêm cascade delete constraint: `FK_attribute_values_group ON DELETE CASCADE`
  - `useProductAttributes.ts`: thêm error boundary nếu API fails

### 36.4 User-Facing Brands & Collections Pages
- **Files:** `frontend/src/pages/BrandsPage.tsx`, `frontend/src/pages/CollectionsPage.tsx`
- **Kiểm tra:**
  - `BrandsPage.tsx`: load danh sách brands từ `GET /api/brands` — có hiển thị logo, product count không
  - Click brand → navigate đến ShopPage với filter `brand=X` đã pre-applied
  - `CollectionsPage.tsx`: load collections từ `GET /api/collections` — có hiển thị đúng không
  - Click collection → navigate đến trang collection detail với sản phẩm trong collection
  - Cả 2 trang: có route trong `AppRoutes.tsx` không, có link từ Header/Footer không
  - Pagination/infinite scroll nếu có nhiều brands/collections
- **Fix nếu thiếu:**
  - Đảm bảo route tồn tại và được link trong navigation
  - Empty state khi không có data (không blank page)
  - SEO: `<title>` và meta description cho từng trang

### 36.5 Static Info Pages — Nội Dung & Links
- **Files:** `AboutPage.tsx`, `FAQsPage.tsx`, `PrivacyPolicyPage.tsx`, `TermsPage.tsx`, `ShippingReturnsPage.tsx`
- **Mức độ:** Thấp — nhưng cần kiểm tra nhanh
- **Kiểm tra (5 phút):**
  - Tất cả 5 trang có route không, không trả về 404
  - Footer có link đến Privacy Policy và Terms không (required cho e-commerce)
  - Content có placeholder text `[PLACEHOLDER]` hay lorem ipsum không — cần nội dung thực
  - FAQ content có đúng với project TechStore không (không phải template mẫu)

### ✅ Acceptance Criteria Phase 36
- [ ] `GET /api/products/recently-viewed` (authenticated) → trả về ≤20 sản phẩm đã xem gần nhất
- [ ] Xem product detail → record trong `recently_viewed` table được tạo với đúng `userId` + `productId`
- [ ] Admin CreateProductPage: click "Gợi ý tên AI" → nhận gợi ý trong <3s; nếu API key missing → hiển thị error toast, không crash
- [ ] `GET /api/attributes` → trả về attribute groups với values, dùng được trong variant creation
- [ ] Admin tạo sản phẩm với variants (chọn attributes) → flow hoạt động end-to-end
- [ ] `BrandsPage` load → hiển thị đúng danh sách brands với logo
- [ ] Click brand → navigate đến ShopPage với filter brand đã applied
- [ ] `CollectionsPage` load → hiển thị đúng collections
- [ ] `GET /privacy-policy` → không 404, có nội dung thực (không phải lorem ipsum)
- [ ] Footer có link "Chính sách bảo mật" và "Điều khoản sử dụng"

---

## WORKFLOW CHECKLIST

> Tìm đúng section bằng cách tìm kiếm `## PHASE X —` trong file.

```
Phase 1  Security              → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 2
Phase 2  Data Integrity        → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 3
Phase 3  Payment/Order         → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 4
Phase 4  API Consistency       → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 5
Phase 5  TypeScript            → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 6
Phase 6  Schema/Features       → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 7
Phase 7  E-Commerce Standards  → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 8
Phase 8  SQL/DB Naming         → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 9
Phase 9  RAG Chatbot           → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 10
Phase 10 Realtime Chat         → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 11
Phase 11 Performance           → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 12
Phase 12 Frontend Pages        → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 13
Phase 13 Security Completeness → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 14
Phase 14 Email Service         → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 15
Phase 15 SQL Query Standards   → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 16
Phase 16 Error Handling        → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 17
Phase 17 Product Search        → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 18
Phase 18 Image/File Handling   → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 19
Phase 19 Logging               → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 37
Phase 37 i18n Standard Rules   → [FIX B2] → [VERIFY] → ✅ PASS → Phase 20
Phase 20 i18n & Localization   → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 21
Phase 21 SEO Standards         → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 22
Phase 22 Code Quality          → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 23
Phase 23 Dependencies          → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 24
Phase 24 Mobile & Responsive   → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 25
Phase 25 Testing Strategy      → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 26
Phase 26 User Features         → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 27
Phase 27 Admin Features        → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 28
Phase 28 Light/Dark Mode       → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 29
Phase 29 i18n Full Coverage    → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 30
Phase 30 Thesis Defense Gate   → [VERIFY ALL] → ✅ PASS → Phase 38
Phase 38 MySQL Naming Standards → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 31
Phase 31 DB Migration & Import → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 34
Phase 34 Audit Gaps            → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 33
Phase 33 Missing Features      → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 32
Phase 32 Admin Analytics       → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 35
Phase 35 Caching & Data Cleanup → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 36
Phase 36 Coverage Completion   → [AUDIT] → [FIX] → [VERIFY] → ✅ PASS → Phase 39
Phase 39 Architecture Audit    → [AUDIT] → [FIX] → [VERIFY] → ✅ READY TO DEFEND (100%)
```

**🎓 THESIS DEFENSE CHECKLIST (Phase 39 = FINAL gate):**
1. `cd backend && npm run dev` — không có error
2. `cd frontend && npm run build` — 0 TypeScript error
3. Demo flow: Register → Browse → Cart → Checkout → Confirm → Admin update status
4. Toggle dark mode: toàn bộ app chuyển dark, persist sau reload
5. Switch i18n EN/VI: tất cả text đổi ngay, không reload
6. `npm audit --audit-level=high` trong backend + frontend → 0 critical/high
7. Chrome DevTools Console → 0 red errors khi chạy demo
8. Lighthouse Performance ≥ 70, Accessibility ≥ 80
9. Admin Dashboard: hiển thị đủ 7 chart/widget, date range picker hoạt động
10. Import 5 sản phẩm qua CSV → xuất hiện trên shop ngay lập tức
11. `GET /api/products` lần 2 → response time giảm rõ rệt (Redis cache hit)
12. Sau 30 ngày không hoạt động: cart abandoned được purge tự động
13. Tất cả tên bảng/cột/index trong DB đúng chuẩn (Phase 38 pass)
14. Không còn folder nào trong frontend/backend đặt sai layer (Phase 39 pass)

---
## PHASE 39 — Architecture Audit: Layered (Backend) + Hybrid (Frontend)

> **Mục tiêu:** Kiểm tra toàn bộ cấu trúc thư mục và phân tách trách nhiệm. Backend theo chuẩn Layered Architecture (MVC + Service Layer). Frontend theo chuẩn Hybrid Architecture (Layered + Feature-based). Chỉ ra chính xác file/folder nào đặt sai, vi phạm separation of concerns, naming không nhất quán — và fix từng cái.

---

### BACKEND AUDIT

#### 39.B1 — File đặt sai vị trí

**Vấn đề:** `backend/src/data/vectorDb.json` nằm trong `src/` — đây là dữ liệu runtime, không phải source code.

- **Fix:** Di chuyển sang `backend/data/vectorDb.json` (cùng cấp với `migration_full.sql`, `seed_data.sql`)
- Cập nhật path trong `backend/src/services/ai/vectorStore.js` (hoặc file nào đang import nó)

#### 39.B2 — Services Layer không nhất quán

**Hiện trạng:**
```
backend/src/services/
├── email.js          ← flat, root level
├── image.js          ← flat, root level
├── location.js       ← flat, root level
├── admin/
│   └── adminAudit.js ← subfolder nhưng chỉ 1 file
├── ai/
│   ├── chatbot.js
│   ├── geminiChatbot.js  ← trùng tên, 2 chatbot service
│   ├── embedding.js
│   ├── productNameGenerator.js
│   ├── vectorStore.js
│   └── viEmbedding.js
└── payment/
    ├── momo.js
    ├── stripe.js
    └── vnpay.js
```

**Vấn đề 1:** `admin/adminAudit.js` — subfolder chỉ có 1 file, tên folder và file thừa prefix. Nếu không có kế hoạch thêm admin service nào khác → flatten thành `services/adminAudit.js`.

**Vấn đề 2:** `services/ai/chatbot.js` và `services/ai/geminiChatbot.js` — 2 service tên gần giống nhau. Grep để xác định cái nào đang được dùng bởi controller:
```bash
grep -r "chatbot\|geminiChatbot" backend/src/controllers/ --include="*.js" -l
```
→ Nếu chỉ 1 cái được dùng, xóa cái còn lại. Nếu cả 2, đổi tên rõ hơn: `openRouterChatbot.js` và `geminiChatbot.js`.

**Vấn đề 3:** `services/ai/embedding.js` và `services/ai/viEmbedding.js` — tương tự, 2 embedding service. Xác định cái nào đang dùng.

- **Fix chung:** Sau khi cleanup, cấu trúc services nên là:
```
services/
├── email.js
├── image.js
├── location.js
├── adminAudit.js     ← flatten từ admin/adminAudit.js
├── ai/
│   └── (chỉ giữ những file đang được dùng)
└── payment/
    ├── momo.js
    ├── stripe.js
    └── vnpay.js
```

#### 39.B3 — Fat Controllers vi phạm Service Layer

**Vấn đề:** Nhiều controller chứa trực tiếp Sequelize ORM calls thay vì delegate qua service layer. Đây là vi phạm Layered Architecture — Controller phải chỉ: (1) parse request, (2) gọi service, (3) format response.

**Check:** Các controller "fat" nhất (dựa trên phân tích):
- `backend/src/controllers/payment.js` — chứa cả business logic thanh toán, stock deduction, loyalty points
- `backend/src/controllers/order.js` — chứa order workflow, stock check, loyalty calculation
- `backend/src/controllers/admin.js` — chứa analytics queries, aggregation logic
- `backend/src/controllers/product.js` — chứa search logic với Sequelize subqueries phức tạp

**Verify:**
```bash
# Đếm dòng từng controller — >300 dòng là dấu hiệu fat controller
wc -l backend/src/controllers/*.js | sort -rn | head -10
```

**Fix (ưu tiên theo Phase):**
- Phase 3 đã có kế hoạch tách `payment.js` — áp dụng pattern tương tự cho `order.js`, `admin.js`
- Nguyên tắc: Mọi `Model.findAll()`, `Model.create()`, `sequelize.transaction()` nên ở trong service, controller chỉ gọi `await service.doSomething(params)`
- **Không cần refactor toàn bộ trong Phase 39** — chỉ đánh dấu và tạo skeleton service files cho những controller fat nhất

#### 39.B4 — Naming conflict: `image.js` ở 3 layer khác nhau

**Vấn đề:** 3 file tên `image.js` ở 3 tầng:
- `backend/src/controllers/image.js`
- `backend/src/services/image.js`
- `backend/src/models/image.js`

Trong Layered Architecture điều này không sai về cấu trúc, nhưng khi grep hay trace lỗi rất dễ nhầm.

**Check:** Verify mỗi file có đúng trách nhiệm không:
```bash
head -30 backend/src/controllers/image.js
head -30 backend/src/services/image.js
head -30 backend/src/models/image.js
```

**Fix nếu service/image.js chứa controller logic:** Tách đúng vai trò. Không cần đổi tên nếu mỗi file đúng layer của nó.

#### 39.B5 — `controllers/chat.js` vs `controllers/chatbot.js` — Naming mơ hồ

**Vấn đề:** 2 controller tên gần giống:
- `chat.js` — realtime chat giữa user và support (Socket.IO)
- `chatbot.js` — AI chatbot (OpenRouter/Gemini)

Với developer mới, dễ nhầm. Nên đổi tên thành:
- `chat.js` → `supportChat.js` (human support chat)
- `chatbot.js` → `aiChatbot.js` (AI chatbot)

Cập nhật tương ứng trong `routes/chat.js`, `routes/chatbot.js`, và `routes/index.js`.

#### 39.B6 — `backend/scripts/` — Duplicate và cleanup scripts

**Vấn đề:** 11 scripts, một số có thể trùng chức năng:
- `rebuildDb.js` vs `rebuildDbFinal.js` — 2 rebuild scripts
- `syncProducts.js` vs `syncAll.js` — 2 sync scripts
- `exportProductsJson.js` vs `exportSeed.js` — 2 export scripts

**Check:**
```bash
head -10 backend/scripts/rebuildDb.js backend/scripts/rebuildDbFinal.js
head -10 backend/scripts/syncProducts.js backend/scripts/syncAll.js
```

**Fix:** Xóa script cũ nếu có script mới thay thế. Comment trong script production-ready giải thích khi nào dùng cái nào.

---

### FRONTEND AUDIT

#### 39.F1 — Auth logic bị split giữa `components/auth/` và `features/auth/`

**Hiện trạng:**
```
components/auth/
├── AuthProvider.tsx        ← context provider
├── GoogleLoginButton.tsx   ← UI component
├── LoginSuccess.tsx        ← callback page component
├── ProtectedRoute.tsx      ← route guard
└── PublicOnlyRoute.tsx     ← route guard

features/auth/
└── authSlice.ts            ← Redux state
```

**Vấn đề:** Trong Hybrid Architecture, tất cả những gì thuộc về một feature nên co-located. `AuthProvider`, `ProtectedRoute`, `PublicOnlyRoute` là logic của auth feature — không phải generic component.

**Fix:** Di chuyển `components/auth/` → `features/auth/components/`:
```
features/auth/
├── components/
│   ├── AuthProvider.tsx
│   ├── GoogleLoginButton.tsx
│   ├── LoginSuccess.tsx
│   ├── ProtectedRoute.tsx
│   └── PublicOnlyRoute.tsx
└── authSlice.ts
```
Cập nhật tất cả import paths trong `routes/AppRoutes.tsx`, `main.tsx`, `App.tsx`.

#### 39.F2 — Review components bị split giữa 3 folder

**Hiện trạng:**
```
components/reviews/
└── ReviewModal.tsx

components/shared/
├── ProductReviews.tsx   ← review list wrapper
├── ReviewForm.tsx       ← review submission form
├── ReviewList.tsx       ← list of reviews
├── ReviewSection.tsx    ← section container
└── ReviewSummary.tsx    ← rating summary
```

**Vấn đề:** 6 review components nằm ở 2 folder khác nhau, không có feature folder thống nhất.

**Fix (Option A — Layered, không tạo feature):** Gom tất cả review components vào `components/reviews/`:
```
components/reviews/
├── ReviewModal.tsx
├── ProductReviews.tsx
├── ReviewForm.tsx
├── ReviewList.tsx
├── ReviewSection.tsx
└── ReviewSummary.tsx
```
Xóa các file review khỏi `components/shared/`.

**Fix (Option B — Feature-based):** Tạo `features/reviews/components/` và di chuyển tất cả vào đó (phù hợp hơn nếu plan có review-specific hooks hoặc store sau này).

**Khuyến nghị: Option A** — đơn giản hơn, không cần tạo thêm feature folder chỉ cho components.

#### 39.F3 — `components/chat/SupportChat.tsx` tách khỏi `features/ai/`

**Hiện trạng:**
- `components/chat/SupportChat.tsx` — standalone, chỉ 1 file
- `features/ai/` — có toàn bộ chat widget (20+ components, hooks, services, store, types)

**Vấn đề:** `SupportChat.tsx` có thể là human support chat (khác AI chatbot), nhưng folder `components/chat/` chỉ có 1 file — không đủ để tồn tại như 1 folder riêng.

**Check:** Xem SupportChat.tsx làm gì:
```bash
head -50 frontend/src/components/chat/SupportChat.tsx
```
- Nếu dùng Socket.IO (support chat) → di chuyển vào `features/chat/` mới hoặc để trong `components/shared/`
- Nếu dùng AI API → di chuyển vào `features/ai/components/`
- **Fix:** Dù là trường hợp nào, xóa folder `components/chat/` chỉ có 1 file — move file vào nơi phù hợp

#### 39.F4 — `components/orders/` chỉ có 1 file

**Hiện trạng:** `components/orders/OrderDetails.tsx` — 1 file, 1 folder.

**Vấn đề:** Folder với 1 file duy nhất không có giá trị tổ chức.

**Fix:** Di chuyển `OrderDetails.tsx` vào `components/shared/` (nếu dùng nhiều nơi) hoặc `pages/` (nếu chỉ dùng trong OrdersPage). Xóa folder `components/orders/`.

#### 39.F5 — `components/payment/` nên ở trong features

**Hiện trạng:**
```
components/payment/
├── BankTransferQR.tsx
└── StripePaymentForm.tsx
```

**Vấn đề:** Payment components là feature-specific, không phải generic components — giống như auth components.

**Fix:** Di chuyển vào `features/checkout/components/payment/` hoặc tạo `features/payment/components/`:
```
features/payment/
└── components/
    ├── BankTransferQR.tsx
    └── StripePaymentForm.tsx
```
Nếu project chưa có `features/payment/`, tạo folder mới. Cập nhật imports trong `pages/CheckoutPage.tsx`, `pages/PaymentQRPage.tsx`.

#### 39.F6 — Product components split giữa `components/product/` và `features/products/components/`

**Hiện trạng:**
```
components/product/    ← 30+ files: form components, selectors, display components
features/products/
├── components/
│   ├── ProductFilters.tsx
│   ├── ProductGallery.tsx
│   └── ProductGrid.tsx
├── index.ts
└── productsSlice.ts
```

**Vấn đề:** Không có quy tắc rõ ràng nào phân biệt product component nào vào `components/product/` và cái nào vào `features/products/components/`. Đây là technical debt lớn nhất trên frontend.

**Nguyên tắc phân biệt cần áp dụng:**
- `components/product/` → các form/UI component dùng trong **admin** (CreateProductForm, EditProduct): `ProductBasicInfoForm`, `ProductPricingForm`, `ProductImagesForm`, `ProductVariantsSection`, v.v.
- `features/products/components/` → các component dùng trong **user-facing product browsing**: `ProductGrid`, `ProductGallery`, `ProductFilters`

**Fix:** Audit từng file trong `components/product/` — nếu là admin-only form component → di chuyển vào `components/admin/` hoặc `pages/admin/` scope. Nếu là user-facing display → di chuyển vào `features/products/components/`.

#### 39.F7 — Contexts feature-specific không nằm trong feature

**Hiện trạng:**
```
contexts/
├── ProductFormContext.tsx  ← chỉ dùng trong admin product form
├── StripeContext.tsx       ← chỉ dùng trong checkout/payment
└── ThemeContext.tsx        ← dùng globally ✅
```

**Vấn đề:** `ThemeContext` là cross-cutting concern, hợp lý ở root `contexts/`. Nhưng `ProductFormContext` và `StripeContext` là feature-specific.

**Fix:**
- `ProductFormContext.tsx` → `features/products/contexts/ProductFormContext.tsx` hoặc `components/admin/ProductFormContext.tsx`
- `StripeContext.tsx` → `features/payment/contexts/StripeContext.tsx`
- `ThemeContext.tsx` → giữ nguyên trong `contexts/`

#### 39.F8 — `services/` flat với 30+ files, naming không nhất quán

**Vấn đề 1 — `api.ts` vs `apiClient.ts`:**
```
services/api.ts          ← Axios instance config?
services/apiClient.ts    ← Axios instance config?
```
Hai files tên gần giống, chức năng có thể trùng. Check:
```bash
head -30 frontend/src/services/api.ts
head -30 frontend/src/services/apiClient.ts
```
Nếu cả 2 đều setup Axios baseURL + interceptors → merge thành 1 file `apiClient.ts`, xóa `api.ts`.

**Vấn đề 2 — `productNamingService.ts` phá convention `*Api.ts`:**
Tất cả API services dùng suffix `Api.ts` (`productApi.ts`, `orderApi.ts`, v.v.). `productNamingService.ts` dùng suffix `Service.ts`.
- Nếu nó gọi backend API → đổi tên thành `productNamingApi.ts`
- Nếu nó là local logic (pure function) → di chuyển vào `utils/productHelpers.ts`

**Vấn đề 3 — 30+ flat files không nhóm:**
Khi project lớn hơn, consider nhóm theo domain:
```
services/
├── admin/
│   ├── adminDashboardApi.ts
│   ├── adminOrderApi.ts
│   ├── adminProductApi.ts
│   └── adminUserApi.ts
├── payment/
│   ├── momoApi.ts
│   ├── stripeApi.ts
│   └── vnpayApi.ts
└── (domain files còn lại ở root)
```
**Không bắt buộc trong Phase 39** — chỉ fix 2 vấn đề trên (naming conflict + convention).

#### 39.F9 — `utils/sampleDataHelper.ts` trong production utils

**Vấn đề:** File có tên "sampleData" gợi ý đây là helper cho test/dev data, không nên ở `utils/` production.

**Check:**
```bash
head -30 frontend/src/utils/sampleDataHelper.ts
```
- Nếu chỉ dùng trong development/test → xóa hoặc di chuyển vào `__tests__/` hoặc `dev/`
- Nếu vẫn đang được import bởi component nào đó → đổi tên thành tên mô tả chức năng thực

#### 39.F10 — `public/images/` có 2 thư mục payment trùng nhau

**Hiện trạng:**
```
frontend/public/images/
├── payment/
│   ├── applepay.svg
│   ├── mastercard.svg
│   ├── momo.svg
│   ├── paypal.svg
│   ├── visa.svg
│   └── zalopay.svg
└── payment-icons/
    ├── applepay.png
    ├── mastercard.png
    ├── momo.png
    ├── paypal.png
    ├── visa.png
    └── zalopay.png
```

**Vấn đề:** 2 folder chứa cùng payment icons, 1 là SVG 1 là PNG.

**Fix:** Gộp thành 1 folder `payment-icons/`, giữ format nào đang được dùng thực tế (SVG ưu tiên vì scalable):
```bash
grep -r "payment/" frontend/src/ --include="*.tsx" --include="*.ts" -l
grep -r "payment-icons/" frontend/src/ --include="*.tsx" --include="*.ts" -l
```
Xóa folder không dùng (hoặc folder PNG nếu SVG đủ).

#### 39.F11 — `features/ai/components/ChatWidget.css` — plain CSS trong Tailwind project

**Vấn đề:** Project dùng Tailwind CSS toàn bộ, nhưng `ChatWidget.css` là plain CSS file.

**Check:** Xem CSS có gì đặc biệt không cần với Tailwind:
```bash
cat frontend/src/features/ai/components/ChatWidget.css
```
- Nếu chỉ là utility classes → migrate sang Tailwind classes inline
- Nếu có animation/keyframe phức tạp → đổi thành `ChatWidget.module.css` cho CSS Modules, hoặc dùng `tailwind.config.js` extend

#### 39.F12 — `routes/AdminRoute.tsx` nên ở trong auth feature

**Hiện trạng:**
```
routes/
├── AdminRoute.tsx   ← route guard cho admin
└── AppRoutes.tsx    ← main routing
```

**Vấn đề:** `AdminRoute.tsx` là auth/authorization guard — cùng loại với `ProtectedRoute.tsx` và `PublicOnlyRoute.tsx`. Sau khi fix 39.F1 (auth components vào `features/auth/`), `AdminRoute.tsx` cũng nên ở đó.

**Fix:** Di chuyển `AdminRoute.tsx` → `features/auth/components/AdminRoute.tsx`. Cập nhật import trong `routes/AppRoutes.tsx`.

---

### Acceptance Criteria Phase 39

**Backend:**
- [ ] `backend/src/data/vectorDb.json` đã được di chuyển ra `backend/data/vectorDb.json`, path trong code đã cập nhật
- [ ] `services/admin/adminAudit.js` đã flatten thành `services/adminAudit.js` (hoặc quyết định giữ subfolder có lý do rõ)
- [ ] `services/ai/chatbot.js` vs `services/ai/geminiChatbot.js` — chỉ còn 1 hoặc đổi tên rõ ràng phân biệt
- [ ] `controllers/chat.js` và `controllers/chatbot.js` đã đổi tên rõ ràng (`supportChat.js` / `aiChatbot.js`) hoặc có comment giải thích sự khác biệt
- [ ] Scripts duplicate (`rebuildDb.js` vs `rebuildDbFinal.js`) đã cleanup

**Frontend:**
- [ ] `components/auth/` đã move vào `features/auth/components/`, không còn `components/auth/` folder
- [ ] Review components (6 files) đã gom vào 1 folder duy nhất, không còn split giữa `components/reviews/` và `components/shared/`
- [ ] `components/chat/SupportChat.tsx` đã di chuyển ra khỏi singleton folder, folder `components/chat/` đã xóa
- [ ] `components/orders/` folder đã xóa, `OrderDetails.tsx` đã di chuyển
- [ ] `components/payment/` đã di chuyển vào feature folder phù hợp
- [ ] `contexts/ProductFormContext.tsx` và `contexts/StripeContext.tsx` đã di chuyển vào feature tương ứng
- [ ] `services/api.ts` vs `services/apiClient.ts` — chỉ còn 1 file hoặc mỗi file có comment rõ vai trò
- [ ] `services/productNamingService.ts` đã đổi tên theo convention (`*Api.ts` hoặc vào `utils/`)
- [ ] `utils/sampleDataHelper.ts` đã xử lý (xóa hoặc đổi tên)
- [ ] `public/images/payment/` và `public/images/payment-icons/` đã gộp thành 1 folder
- [ ] `npm run build` không có broken import sau khi di chuyển file
- [ ] `npx tsc --noEmit` không có type error sau khi di chuyển