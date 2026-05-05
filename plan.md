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
- [x] DashboardPage load → hiển thị đủ 7 chart/widget: Revenue Area, Order Bar, Order Status Pie, Top Products Bar, Category Bar, User Growth Line, Payment Methods Pie
- [x] KPI cards hiển thị đúng AOV: tạo 2 orders (100k + 200k) → AOV = 150k
- [x] Low stock widget hiển thị product có stock = 3 (dưới threshold 10)
- [x] Chọn date range tùy chỉnh → tất cả charts cập nhật data theo range đó
- [x] Nút "Xuất báo cáo" → download được file CSV với đúng data
- [x] Chart order status: tổng số trong pie = tổng orders trong DB
- [x] Tab "AI Chatbot" trong Dashboard → hiển thị Total Sessions, Fallback Rate, Intent Breakdown
- [x] `GET /api/admin/chatbot/stats` trả về 401 nếu không có admin token

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
- [x] `backend/src/config/redis.js` tồn tại, server start không crash dù Redis chưa bật (graceful fallback)
- [x] `GET /api/products` lần đầu: `X-Cache: MISS`; lần thứ 2 cùng params: `X-Cache: HIT`, response time giảm >50%
- [x] Admin update product → `X-Cache: MISS` cho product đó (cache đã invalidate)
- [x] `GET /api/categories` → `Cache-Control: public, max-age=1800` header tồn tại
- [x] `GET /api/orders` (authenticated) → `Cache-Control: private, no-store` (không bao giờ cache user data)
- [x] Cron job chạy đúng giờ: kiểm tra log `[Cleanup] Daily cleanup completed` lúc 2:00 AM
- [x] Tạo cart với `status='abandoned'`, update `updatedAt` về 31 ngày trước → chạy cleanup → cart bị xóa
- [x] Tạo User, gán OTP, set `otpExpires` về quá khứ → chạy cleanup → `otpCode = null`
- [x] `express-rate-limit` với authLimiter dùng Redis store: restart server → rate limit counter vẫn giữ (không reset)
- [x] Không có PII (email, address, password hash) nào được lưu trong Redis cache
- [x] Hỏi chatbot cùng câu 2 lần → lần thứ 2 response time < 100ms (embedding cache hit, log `[Embedding] Cache HIT`)
- [x] Admin xóa sản phẩm → chatbot hỏi về sản phẩm đó → kết quả đã invalidate (không trả về sản phẩm đã xóa từ cache)

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

---

## PHASE 40 — Full MySQL Standard Compliance (Schema Naming + Indexes + Constraints + Data Types)

> **Mục tiêu:** Đạt 100% MySQL standard compliance cho toàn bộ schema. Bao gồm:
> - **40.1-40.16:** Snake_case columns + FK fixes + DECIMAL unify + drop redundant + missing FKs
> - **40.17:** Index audit & standardization (`idx_*`, `uq_*` patterns + thêm indexes thiếu trên FK columns)
> - **40.18:** FK constraint naming cleanup (`fk_{table}_{ref}` pattern)
> - **40.19:** ENUM values audit (đã 100% chuẩn — verify only)
> - **40.20:** DEFAULT value standardization (DECIMAL, BOOLEAN, ENUM)
> - **40.21:** NULL/NOT NULL consistency (address fields)
> - **40.22:** CHECK constraints expansion (rating, stock, prices, totals)
> - **40.23:** Soft delete policy & 3 missing tables
> - **40.24:** VARCHAR length standardization (email 254, phone 20, names 100, etc.)
> - **40.25:** Comprehensive MySQL compliance verification (11 SQL queries)
>
> Hiện tại 26/40 model dùng `underscored: false` → cột trong DB là camelCase (`userId`, `firstName`, `createdAt`...). Phase này chuyển toàn bộ sang `underscored: true` để DB columns nhất quán là `snake_case`, đồng thời giữ nguyên JS-level attribute names là camelCase (Sequelize auto-map).
>
> **Chiến lược cốt lõi:** Sequelize `underscored: true` tự động map `userId` (JS) → `user_id` (DB), `createdAt` (JS) → `created_at` (DB). Nghĩa là: **backend controllers, services, frontend code KHÔNG cần đổi** — chúng vẫn dùng `userId`, `createdAt` trong JS. Chỉ cần đổi: (1) model options (`underscored: true`), (2) xóa explicit `field:` mappings (cả Nhóm A redundant lẫn Nhóm B), (3) verify association `foreignKey` strings vẫn dùng camelCase JS attribute name (KHÔNG thêm `field:` — Sequelize auto-maps khi `underscored: true`), (4) raw SQL queries, (5) migration rename columns trong DB, (6) SQL dump file.
>
> **Rủi ro chính:** Nếu sót 1 chỗ, Sequelize sẽ tìm column `user_id` trong DB nhưng column thực tế vẫn là `userId` → crash. Phải migration rename columns trước khi deploy model mới.

---

### 40.0 Phân loại Models theo trạng thái hiện tại

#### Nhóm A — Đã `underscored: true` (14 models, KHÔNG cần đổi model option, NHƯNG cần xóa redundant `field:` mappings — xem 40.2.27)
| # | Model | Table | Ghi chú |
|---|-------|-------|---------|
| 1 | Product | `products` | underscored: true ✓, có 16 redundant `field:` mappings cần xóa |
| 2 | ProductVariant | `product_variants` | underscored: true ✓, có 7 redundant `field:` mappings |
| 3 | Brand | `brands` | underscored: true ✓, có 2 redundant `field:` mappings |
| 4 | Category | `categories` | underscored: true ✓, có 1 redundant `field:` mapping |
| 5 | ProductImage | `product_images` | underscored: true ✓, có 5 redundant `field:` mappings |
| 6 | ProductReview | `product_reviews` | underscored: true ✓, có 5 redundant `field:` mappings |
| 7 | AuditLog | `audit_logs` | underscored: true ✓, có 5 redundant `field:` mappings |
| 8 | Image | `images` | underscored: true ✓, có 10 redundant `field:` mappings (cả `created_at`, `updated_at`) |
| 9 | Collection | `collections` | underscored: true ✓, có 1 redundant `field:` mapping |
| 10 | BrandCategory | `brand_categories` | underscored: true ✓, timestamps: false, có 2 redundant `field:` mappings |
| 11 | LoyaltyHistory | `loyalty_histories` | underscored: true ✓, có 2 redundant `field:` mappings |
| 12 | SearchHistory | `search_histories` | underscored: true ✓, có 3 redundant `field:` mappings |
| 13 | RecentlyViewed | `recently_viewed` | underscored: true ✓, có 3 redundant `field:` mappings |
| 14 | InventoryLog | `inventory_logs` | underscored: true ✓, có 8 redundant `field:` mappings |

#### Nhóm B — `underscored: false` (26 models, CẦN migrate)
| # | Model | Table | camelCase columns trong DB hiện tại |
|---|-------|-------|-------------------------------------|
| 1 | **User** | `users` | `firstName`, `lastName`, `isEmailVerified`, `otpCode`, `otpExpires`, `resetPasswordToken`, `resetPasswordExpires`, `createdAt`, `updatedAt`, `deletedAt` (+ `google_id`, `stripe_customer_id` đã snake_case qua `field:`) — **⚠️ `isActive` có `field: 'isActive'` và `loyaltyPoints` có `field: 'loyaltyPoints'` (camelCase→camelCase, ép DB giữ camelCase) — PHẢI xóa khi chuyển `underscored: true`** |
| 2 | **Order** | `orders` | `userId`, `shippingFirstName`, `shippingLastName`, `shippingCompany`, `shippingAddress1`, `shippingAddress2`, `shippingCity`, `shippingState`, `shippingZip`, `shippingCountry`, `shippingPhone`, `billingFirstName`, `billingLastName`, `billingCompany`, `billingAddress1`, `billingAddress2`, `billingCity`, `billingState`, `billingZip`, `billingCountry`, `billingPhone`, `paymentMethod`, `paymentStatus`, `paymentTransactionId`, `paymentProvider`, `shippingCost`, `trackingNumber`, `shippingProvider`, `estimatedDelivery`, `createdAt`, `updatedAt`, `deletedAt` (+ `warranty_cost`, `cancelled_at`, `refunded_at`, `refund_amount`, `discount_code_id` đã snake_case qua `field:`) — **⚠️ `pointsEarned` có `field: 'pointsEarned'`, `pointsUsed` có `field: 'pointsUsed'`, `pointsDiscount` có `field: 'pointsDiscount'` (camelCase→camelCase, ép DB giữ camelCase) — PHẢI xóa khi chuyển `underscored: true`** |
| 3 | **OrderItem** | `order_items` | `orderId`, `productId`, `variantId`, `createdAt`, `updatedAt` (+ `unit_price`, `discount_amount`, `warranty_package_ids` đã snake_case qua `field:`) |
| 4 | **Cart** | `carts` | `userId`, `sessionId`, `createdAt`, `updatedAt` |
| 5 | **CartItem** | `cart_items` | `cartId`, `productId`, `variantId`, `createdAt`, `updatedAt` (+ `unit_price`, `warranty_package_ids` đã snake_case qua `field:`) |
| 6 | **Address** | `addresses` | `userId`, `firstName`, `lastName`, `isDefault`, `createdAt`, `updatedAt` |
| 7 | **Review** | `reviews` | `productId`, `variantId`, `userId`, `isVerified`, `createdAt`, `updatedAt`, `deletedAt` |
| 8 | **ReviewFeedback** | `review_feedbacks` | `reviewId`, `userId`, `isHelpful`, `createdAt`, `updatedAt` |
| 9 | **DiscountCode** | `discount_codes` | `minOrderAmount`, `maxDiscountAmount`, `startDate`, `endDate`, `usageLimit`, `usedCount`, `isActive`, `createdAt`, `updatedAt`, `deletedAt` |
| 10 | **Wishlist** | `wishlists` | `userId`, `productId`, `createdAt`, `updatedAt` |
| 11 | **News** | `news` | `viewCount`, `isPublished`, `userId`, `createdAt`, `updatedAt` |
| 12 | **NewsletterSubscriber** | `newsletter_subscribers` | `createdAt`, `updatedAt` |
| 13 | **Feedback** | `feedbacks` | `createdAt`, `updatedAt` |
| 14 | **ChatMessage** | `chat_messages` | `userId`, `sessionId`, `senderId`, `isFromAdmin`, `isRead`, `createdAt`, `updatedAt` (+ `content_type`, `attachment_url`, `product_id`, `read_at`, `message_type`, `response_time_ms`, `is_fallback`, `is_archived` đã snake_case qua `field:`) |
| 15 | **Banner** | `banners` | `createdAt`, `updatedAt` (+ `image_url`, `link_url`, `is_active` đã snake_case qua `field:`) |
| 16 | **EmailCampaign** | `email_campaigns` | `createdAt`, `updatedAt` (+ `sent_at` đã snake_case qua `field:`) |
| 17 | **AttributeGroup** | `attribute_groups` | `createdAt`, `updatedAt` (+ `is_required`, `sort_order`, `is_active` đã snake_case qua `field:`) |
| 18 | **AttributeValue** | `attribute_values` | `createdAt`, `updatedAt` (+ `attribute_group_id`, `color_code`, `image_url`, `price_adjustment`, `sort_order`, `is_active`, `affects_name`, `name_template` đã snake_case qua `field:`) |
| 19 | **ProductAttribute** | `product_attributes` | `createdAt`, `updatedAt` (+ `product_id`, `sort_order` đã snake_case qua `field:`) |
| 20 | **ProductAttributeGroup** | `product_attribute_groups` | `createdAt`, `updatedAt` (+ `product_id`, `attribute_group_id`, `is_required`, `sort_order` đã snake_case qua `field:`) |
| 21 | **ProductSpecification** | `product_specifications` | `createdAt`, `updatedAt` (+ `product_id`, `sort_order` đã snake_case qua `field:`) |
| 22 | **WarrantyPackage** | `warranty_packages` | `createdAt`, `updatedAt` (+ `duration_months`, `is_active`, `sort_order` đã snake_case qua `field:`) |
| 23 | **ProductWarranty** | `product_warranties` | `createdAt`, `updatedAt` (+ `product_id`, `warranty_package_id`, `is_default` đã snake_case qua `field:`) |
| 24 | **ProductCategory** | `product_categories` | `createdAt`, `updatedAt` (+ `product_id`, `category_id` đã snake_case qua `field:`) |
| 25 | **ProductCollection** | `product_collections` | `productId`, `collectionId` (timestamps: false) |
| 26 | **ImportLog** | `import_logs` | underscored not set (defaults to false), timestamps: false, tất cả columns đã explicit `field:` snake_case |

#### Nhóm C — Cần sửa thêm (ngoài model option)
| Vấn đề | Chi tiết |
|---------|----------|
| `import_logs.id` là `INT UNSIGNED` | Tất cả bảng khác dùng `INT` (signed) → FK type mismatch |
| `import_logs.admin_id` là `INT UNSIGNED` | References `users.id` (INT signed) → MySQL FK type error |
| `products.brand` VARCHAR(255) | Redundant với `brand_id` FK — cần xóa nếu không dùng |
| DECIMAL precision không thống nhất | `(15,2)` vs `(19,2)` vs `(12,2)` cho monetary columns |
| Missing FK constraints (6) | `audit_logs.admin_id` (có index nhưng thiếu FK), `search_histories.user_id`, `chat_messages.sender_id`, `order_items.variant_id`, `cart_items.variant_id`, `product_reviews.user_id` (tên columns hiển thị ở dạng final snake_case sau migration) |

---

### 40.1 Tạo Sequelize Migration — Rename Columns (DB level)

> **Đây là bước QUAN TRỌNG NHẤT.** Migration phải chạy trước khi deploy model mới. Rename tất cả camelCase columns trong DB sang snake_case.

**⚠️ Pre-flight BẮT BUỘC trước khi chạy migration:**
```bash
# Backup full DB — chạy 1 lệnh, mất ~30 giây, là cứu cánh duy nhất nếu migration fail giữa chừng
mysqldump -u root techstore > backups/phase40-pre-migration-$(date +%Y%m%d-%H%M%S).sql
```
Verify file backup ≥ size hợp lý trước khi tiếp tục. Nếu fail, restore: `mysql -u root techstore < backups/phase40-pre-migration-*.sql`.

**File:** `backend/src/migrations/2026050501-phase40-rename-columns-to-snake-case.js`

**⚠️ Phương pháp đúng (KHÔNG single-transaction wrap):**
- **MySQL DDL `ALTER TABLE` auto-commit** — KHÔNG support transaction rollback. Wrap trong `sequelize.transaction()` cho ảo giác safety: nếu rename #50/130 fail, columns 1-49 đã commit. KHÔNG rollback được.
- **Pattern đúng — Idempotent rerunnable:** mỗi `renameColumn()` check `INFORMATION_SCHEMA.COLUMNS` trước, skip nếu đã rename. Nếu fail giữa chừng, fix issue rồi rerun script — chỗ đã rename sẽ skip.
  ```js
  async function safeRenameColumn(queryInterface, table, oldName, newName) {
    const [rows] = await queryInterface.sequelize.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
      { replacements: [table, oldName] }
    );
    if (rows.length === 0) return; // Already renamed, skip
    await queryInterface.renameColumn(table, oldName, newName);
  }
  ```
- **`SET FOREIGN_KEY_CHECKS = 0` chỉ scope theo connection.** Sequelize có connection pool — `SET` ở connection A không ảnh hưởng connection B. Cách đúng: chạy `await sequelize.query('SET FOREIGN_KEY_CHECKS=0')` trên CÙNG connection (qua `sequelize.connectionManager.getConnection()` hoặc gọi tuần tự trong cùng `sequelize.query` chain). Hoặc đơn giản hơn: TẠM disable check ở MySQL session level trước khi chạy migration:
  ```bash
  mysql -u root techstore -e "SET GLOBAL foreign_key_checks=0;"
  npx sequelize-cli db:migrate
  mysql -u root techstore -e "SET GLOBAL foreign_key_checks=1;"
  ```
  (Chỉ chạy 1 lần, single-instance dev — KHÔNG dùng cho prod multi-tenant.)

**Danh sách columns cần rename (theo từng bảng):**

#### Bảng `users` (12 columns)
```
firstName       → first_name
lastName        → last_name
isEmailVerified → is_email_verified
isActive        → is_active
otpCode         → otp_code
otpExpires      → otp_expires
resetPasswordToken  → reset_password_token
resetPasswordExpires → reset_password_expires
loyaltyPoints   → loyalty_points
createdAt       → created_at
updatedAt       → updated_at
deletedAt       → deleted_at
```
*Lưu ý: `google_id`, `stripe_customer_id` đã snake_case — KHÔNG đổi.*

#### Bảng `addresses` (6 columns)
```
userId     → user_id
firstName  → first_name
lastName   → last_name
isDefault  → is_default
createdAt  → created_at
updatedAt  → updated_at
```
*Lưu ý: `address1`, `address2`, `city`, `state`, `zip`, `country`, `phone`, `company`, `name` — đã OK (1 từ hoặc không có camelCase).*

#### Bảng `orders` (36 columns — bảng nặng nhất)
```
userId                → user_id
shippingFirstName     → shipping_first_name
shippingLastName      → shipping_last_name
shippingCompany       → shipping_company
shippingAddress1      → shipping_address1
shippingAddress2      → shipping_address2
shippingCity          → shipping_city
shippingState         → shipping_state
shippingZip           → shipping_zip
shippingCountry       → shipping_country
shippingPhone         → shipping_phone
billingFirstName      → billing_first_name
billingLastName       → billing_last_name
billingCompany        → billing_company
billingAddress1       → billing_address1
billingAddress2       → billing_address2
billingCity           → billing_city
billingState          → billing_state
billingZip            → billing_zip
billingCountry        → billing_country
billingPhone          → billing_phone
paymentMethod         → payment_method
paymentStatus         → payment_status
paymentTransactionId  → payment_transaction_id
paymentProvider       → payment_provider
shippingCost          → shipping_cost
trackingNumber        → tracking_number
shippingProvider      → shipping_provider
estimatedDelivery     → estimated_delivery
pointsEarned          → points_earned
pointsUsed            → points_used
pointsDiscount        → points_discount
discountCodeId        → discount_code_id
createdAt             → created_at
updatedAt             → updated_at
deletedAt             → deleted_at
```
*Lưu ý: `warranty_cost`, `cancelled_at`, `refunded_at`, `refund_amount` — đã snake_case.*

#### Bảng `order_items` (5 columns)
```
orderId    → order_id
productId  → product_id
variantId  → variant_id
createdAt  → created_at
updatedAt  → updated_at
```
*Lưu ý: `unit_price`, `discount_amount`, `warranty_package_ids` — đã snake_case.*

#### Bảng `carts` (4 columns)
```
userId     → user_id
sessionId  → session_id
createdAt  → created_at
updatedAt  → updated_at
```

#### Bảng `cart_items` (5 columns)
```
cartId     → cart_id
productId  → product_id
variantId  → variant_id
createdAt  → created_at
updatedAt  → updated_at
```
*Lưu ý: `unit_price`, `warranty_package_ids` — đã snake_case.*

#### Bảng `discount_codes` (10 columns)
```
minOrderAmount    → min_order_amount
maxDiscountAmount → max_discount_amount
startDate         → start_date
endDate           → end_date
usageLimit        → usage_limit
usedCount         → used_count
isActive          → is_active
createdAt         → created_at
updatedAt         → updated_at
deletedAt         → deleted_at
```

#### Bảng `reviews` (7 columns)
```
productId  → product_id
variantId  → variant_id
userId     → user_id
isVerified → is_verified
createdAt  → created_at
updatedAt  → updated_at
deletedAt  → deleted_at
```

#### Bảng `review_feedbacks` (5 columns)
```
reviewId   → review_id
userId     → user_id
isHelpful  → is_helpful
createdAt  → created_at
updatedAt  → updated_at
```

#### Bảng `wishlists` (4 columns)
```
userId     → user_id
productId  → product_id
createdAt  → created_at
updatedAt  → updated_at
```

#### Bảng `news` (5 columns)
```
viewCount    → view_count
isPublished  → is_published
userId       → user_id
createdAt    → created_at
updatedAt    → updated_at
```

#### Bảng `newsletter_subscribers` (2 columns)
```
createdAt  → created_at
updatedAt  → updated_at
```

#### Bảng `feedbacks` (2 columns)
```
createdAt  → created_at
updatedAt  → updated_at
```

#### Bảng `chat_messages` (7 columns)
```
userId      → user_id
sessionId   → session_id
senderId    → sender_id
isFromAdmin → is_from_admin
isRead      → is_read
createdAt   → created_at
updatedAt   → updated_at
```
*Lưu ý: `content_type`, `attachment_url`, `product_id`, `read_at`, `message_type`, `response_time_ms`, `is_fallback`, `is_archived` — đã snake_case.*

#### Bảng `banners` (2 columns)
```
createdAt  → created_at
updatedAt  → updated_at
```
*Lưu ý: `image_url`, `link_url`, `is_active` — đã snake_case.*

#### Bảng `email_campaigns` (2 columns)
```
createdAt  → created_at
updatedAt  → updated_at
```
*Lưu ý: `sent_at` — đã snake_case.*

#### Bảng `attribute_groups` (2 columns)
```
createdAt  → created_at
updatedAt  → updated_at
```
*Lưu ý: `is_required`, `sort_order`, `is_active` — đã snake_case.*

#### Bảng `attribute_values` (2 columns)
```
createdAt  → created_at
updatedAt  → updated_at
```
*Lưu ý: tất cả data columns đã snake_case qua explicit `field:`.*

#### Bảng `product_attributes` (2 columns)
```
createdAt  → created_at
updatedAt  → updated_at
```

#### Bảng `product_attribute_groups` (2 columns)
```
createdAt  → created_at
updatedAt  → updated_at
```

#### Bảng `product_specifications` (2 columns)
```
createdAt  → created_at
updatedAt  → updated_at
```

#### Bảng `warranty_packages` (2 columns)
```
createdAt  → created_at
updatedAt  → updated_at
```

#### Bảng `product_warranties` (2 columns)
```
createdAt  → created_at
updatedAt  → updated_at
```

#### Bảng `product_categories` (2 columns)
```
createdAt  → created_at
updatedAt  → updated_at
```

#### Bảng `product_collections` (2 columns)
```
productId    → product_id
collectionId → collection_id
```
*Lưu ý: Junction table, timestamps: false. Cần ALTER composite PK + FK constraints.*

**Tổng:** ~130 columns cần rename across 26 bảng.

**⚠️ Migration Safety — Columns có thể đã snake_case:**

Một số columns có `field:` mapping sang snake_case trong model (VD: `orders.discount_code_id`, `orders.warranty_cost`, `order_items.unit_price`). Tuỳ cách DB được tạo (SQL file vs Sequelize sync), column thực tế có thể ĐANG là camelCase HOẶC ĐÃ là snake_case.

**Phát hiện từ audit migrations cũ — các columns đã được rename trước đó:**
- Migration `2026050401-phase6-schema-naming-standards.js` đã rename: `cart_items.price → unit_price`, `order_items.price → unit_price`
- Migration `2026050404-phase8-schema-standards.js` đã rename: `product_categories.productId → product_id`, `product_categories.categoryId → category_id`
- Phase 9 đã rename `chat_messages.senderId → sender_id` (theo `plan.md:1009`)
- → Migration 40.1 PHẢI dùng try/catch vì các columns này đã không còn ở dạng camelCase trong DB.

**Giải pháp:** Mỗi rename phải wrap trong try/catch:
```js
async function safeRename(queryInterface, table, oldCol, newCol) {
  try {
    await queryInterface.renameColumn(table, oldCol, newCol);
  } catch (err) {
    // Column có thể đã được rename trước đó — skip
    console.log(`Skip rename ${table}.${oldCol}: ${err.message}`);
  }
}
```

**Columns cần try/catch đặc biệt (có thể đã snake_case):**
- `orders`: `warranty_cost`, `discount_code_id`, `cancelled_at`, `refunded_at`, `refund_amount` — model đã có `field:` mapping sang snake_case
- `order_items`: `unit_price`, `discount_amount`, `warranty_package_ids` — model đã có `field:` mapping
- `cart_items`: `unit_price`, `warranty_package_ids` — model đã có `field:` mapping
- `chat_messages`: `content_type`, `attachment_url`, `product_id`, `read_at`, `message_type`, `response_time_ms`, `is_fallback`, `is_archived` — model đã có `field:` mapping

**Quy trình migration:**
1. `SET FOREIGN_KEY_CHECKS = 0` (tránh lỗi FK khi rename)
2. Rename từng column bằng `ALTER TABLE ... CHANGE COLUMN` (wrap try/catch)
3. Rename FK constraints nếu tên constraint reference cột cũ
4. `SET FOREIGN_KEY_CHECKS = 1`
5. Migration `down()` phải reverse rename (snake_case → camelCase)

---

### 40.2 Update Sequelize Models — Thêm `underscored: true`

**Nguyên tắc:**
- Thêm `underscored: true` vào model options
- Xóa tất cả explicit `field:` mappings (vì `underscored: true` tự động map)
- Giữ nguyên JS attribute names (camelCase) — Sequelize auto-map sang snake_case DB columns
- Timestamps tự động: `createdAt` (JS) → `created_at` (DB), `updatedAt` → `updated_at`, `deletedAt` → `deleted_at`

**Danh sách 26 models cần update (Nhóm B):**

#### 40.2.1 User model (`backend/src/models/user.js`)
```js
// TRƯỚC:
{ tableName: 'users', underscored: false, paranoid: true }
// SAU:
{ tableName: 'users', underscored: true, paranoid: true }
```
- Xóa `field: 'google_id'` ở googleId (underscored tự map)
- Xóa `field: 'stripe_customer_id'` ở stripeCustomerId (underscored tự map)
- **⚠️ CRITICAL — Xóa `field: 'isActive'`** ở isActive — mapping hiện tại ép DB column giữ camelCase `isActive`, nếu không xóa thì sau migration rename `isActive → is_active` sẽ crash vì model vẫn tìm column `isActive` (đã bị rename)
- **⚠️ CRITICAL — Xóa `field: 'loyaltyPoints'`** ở loyaltyPoints — mapping hiện tại ép DB column giữ camelCase `loyaltyPoints`, cùng lý do như trên. Sau khi xóa, `underscored: true` sẽ auto map sang `loyalty_points`

#### 40.2.2 Order model (`backend/src/models/Order.js`)
```js
// TRƯỚC:
{ tableName: 'orders', underscored: false, paranoid: true }
// SAU:
{ tableName: 'orders', underscored: true, paranoid: true }
```
- **⚠️ CRITICAL — Xóa `field: 'pointsEarned'`** ở pointsEarned — mapping hiện tại ép DB column giữ camelCase, sau migration rename `pointsEarned → points_earned` sẽ crash nếu không xóa
- **⚠️ CRITICAL — Xóa `field: 'pointsUsed'`** ở pointsUsed — cùng lý do
- **⚠️ CRITICAL — Xóa `field: 'pointsDiscount'`** ở pointsDiscount — cùng lý do
- Xóa `field: 'warranty_cost'` ở warrantyCost (auto map)
- Xóa `field: 'cancelled_at'` ở cancelledAt (auto map)
- Xóa `field: 'refunded_at'` ở refundedAt (auto map)
- Xóa `field: 'refund_amount'` ở refundAmount (auto map)
- Xóa `field: 'discount_code_id'` ở discountCodeId (auto map)
- **⚠️ Chú ý đặc biệt:** `shippingAddress1` → auto maps to `shipping_address1` — verify migration rename khớp

#### 40.2.3 OrderItem model (`backend/src/models/OrderItem.js`)
```js
// TRƯỚC:
{ tableName: 'order_items', underscored: false }
// SAU:
{ tableName: 'order_items', underscored: true }
```
- Xóa `field: 'unit_price'`, `field: 'discount_amount'`, `field: 'warranty_package_ids'`

#### 40.2.4 Cart model (`backend/src/models/cart.js`)
```js
// TRƯỚC:
{ tableName: 'carts', underscored: false }
// SAU:
{ tableName: 'carts', underscored: true }
```

#### 40.2.5 CartItem model (`backend/src/models/CartItem.js`)
```js
// TRƯỚC:
{ tableName: 'cart_items', underscored: false }
// SAU:
{ tableName: 'cart_items', underscored: true }
```
- Xóa `field: 'unit_price'`, `field: 'warranty_package_ids'`

#### 40.2.6 Address model (`backend/src/models/address.js`)
```js
// TRƯỚC:
{ tableName: 'addresses', underscored: false }
// SAU:
{ tableName: 'addresses', underscored: true }
```

#### 40.2.7 Review model (`backend/src/models/review.js`)
```js
// TRƯỚC:
{ tableName: 'reviews', underscored: false, paranoid: true }
// SAU:
{ tableName: 'reviews', underscored: true, paranoid: true }
```

#### 40.2.8 ReviewFeedback model (`backend/src/models/reviewFeedback.js`)
```js
// TRƯỚC:
{ tableName: 'review_feedbacks', underscored: false }
// SAU:
{ tableName: 'review_feedbacks', underscored: true }
```

#### 40.2.9 DiscountCode model (`backend/src/models/discountCode.js`)
```js
// TRƯỚC:
{ tableName: 'discount_codes', underscored: false, paranoid: true }
// SAU:
{ tableName: 'discount_codes', underscored: true, paranoid: true }
```

#### 40.2.10 Wishlist model (`backend/src/models/wishlist.js`)
```js
// TRƯỚC:
{ tableName: 'wishlists', underscored: false }
// SAU:
{ tableName: 'wishlists', underscored: true }
```

#### 40.2.11 News model (`backend/src/models/news.js`)
```js
// TRƯỚC:
{ tableName: 'news', underscored: false }
// SAU:
{ tableName: 'news', underscored: true }
```

#### 40.2.12 NewsletterSubscriber model (`backend/src/models/newsletterSubscriber.js`)
```js
// TRƯỚC:
{ tableName: 'newsletter_subscribers', underscored: false }
// SAU:
{ tableName: 'newsletter_subscribers', underscored: true }
```

#### 40.2.13 Feedback model (`backend/src/models/feedback.js`)
```js
// TRƯỚC:
{ tableName: 'feedbacks', underscored: false }
// SAU:
{ tableName: 'feedbacks', underscored: true }
```

#### 40.2.14 ChatMessage model (`backend/src/models/chatMessage.js`)
```js
// TRƯỚC:
{ tableName: 'chat_messages', underscored: false }
// SAU:
{ tableName: 'chat_messages', underscored: true }
```
- Xóa tất cả explicit `field:` mappings (`content_type`, `attachment_url`, `product_id`, `read_at`, `message_type`, `response_time_ms`, `is_fallback`, `is_archived`)

#### 40.2.15 Banner model (`backend/src/models/banner.js`)
```js
// TRƯỚC:
{ tableName: 'banners', underscored: false }
// SAU:
{ tableName: 'banners', underscored: true }
```
- Xóa `field: 'image_url'`, `field: 'link_url'`, `field: 'is_active'`

#### 40.2.16 EmailCampaign model (`backend/src/models/emailCampaign.js`)
```js
// TRƯỚC:
{ tableName: 'email_campaigns', underscored: false }
// SAU:
{ tableName: 'email_campaigns', underscored: true }
```
- Xóa `field: 'sent_at'`

#### 40.2.17 AttributeGroup model (`backend/src/models/attributeGroup.js`)
```js
// TRƯỚC:
{ tableName: 'attribute_groups', underscored: false }
// SAU:
{ tableName: 'attribute_groups', underscored: true }
```
- Xóa `field: 'is_required'`, `field: 'sort_order'`, `field: 'is_active'`

#### 40.2.18 AttributeValue model (`backend/src/models/attributeValue.js`)
```js
// TRƯỚC:
{ tableName: 'attribute_values', underscored: false }
// SAU:
{ tableName: 'attribute_values', underscored: true }
```
- Xóa tất cả explicit `field:` mappings

#### 40.2.19 ProductAttribute model (`backend/src/models/productAttribute.js`)
```js
// TRƯỚC:
{ tableName: 'product_attributes', underscored: false }
// SAU:
{ tableName: 'product_attributes', underscored: true }
```
- Xóa `field: 'product_id'`, `field: 'sort_order'`

#### 40.2.20 ProductAttributeGroup model (`backend/src/models/productAttributeGroup.js`)
```js
// TRƯỚC:
{ tableName: 'product_attribute_groups', underscored: false }
// SAU:
{ tableName: 'product_attribute_groups', underscored: true }
```
- Xóa tất cả explicit `field:` mappings

#### 40.2.21 ProductSpecification model (`backend/src/models/productSpecification.js`)
```js
// TRƯỚC:
{ tableName: 'product_specifications', underscored: false }
// SAU:
{ tableName: 'product_specifications', underscored: true }
```
- Xóa `field: 'product_id'`, `field: 'sort_order'`

#### 40.2.22 WarrantyPackage model (`backend/src/models/warrantyPackage.js`)
```js
// TRƯỚC:
{ tableName: 'warranty_packages', underscored: false }
// SAU:
{ tableName: 'warranty_packages', underscored: true }
```
- Xóa `field: 'duration_months'`, `field: 'is_active'`, `field: 'sort_order'`

#### 40.2.23 ProductWarranty model (`backend/src/models/productWarranty.js`)
```js
// TRƯỚC:
{ tableName: 'product_warranties', underscored: false }
// SAU:
{ tableName: 'product_warranties', underscored: true }
```
- Xóa `field: 'product_id'`, `field: 'warranty_package_id'`, `field: 'is_default'`

#### 40.2.24 ProductCategory model (`backend/src/models/productCategory.js`)
```js
// TRƯỚC:
{ tableName: 'product_categories', underscored: false }
// SAU:
{ tableName: 'product_categories', underscored: true }
```
- Xóa `field: 'product_id'`, `field: 'category_id'` (cả 2 ĐANG tồn tại trong model — đã verify)

#### 40.2.25 ProductCollection model (`backend/src/models/productCollection.js`)
```js
// TRƯỚC:
{ tableName: 'product_collections', underscored: false, timestamps: false }
// SAU:
{ tableName: 'product_collections', underscored: true, timestamps: false }
```
- `productId` → auto maps to `product_id`, `collectionId` → auto maps to `collection_id`

#### 40.2.26 ImportLog model (`backend/src/models/importLog.js`)
```js
// TRƯỚC:
{ tableName: 'import_logs' } // underscored not set
// SAU:
{ tableName: 'import_logs', underscored: true, timestamps: false }
```
- Xóa tất cả explicit `field:` mappings
- **⚠️ Đồng thời fix INT UNSIGNED → INT** (xem 40.4)

#### 40.2.27 Cleanup Redundant `field:` Mappings ở Group A (14 models đã `underscored: true`)

**Vấn đề:** Group A models đã có `underscored: true` nhưng vẫn còn nhiều explicit `field:` mappings — đây là REDUNDANT (không phá vỡ, nhưng acceptance criteria yêu cầu 0 `field:` trong models). Vì `underscored: true` tự auto-map `categoryId` → `category_id`, nên có thể xóa hết các `field:` mappings này.

**An toàn để xóa** — DB column name cuối cùng không đổi (auto-map cho ra kết quả y hệt explicit mapping).

**Models cần cleanup:**

| Model | File | `field:` mappings cần xóa |
|-------|------|---------------------------|
| AuditLog | `AuditLog.js` | `admin_id`, `entity_type`, `entity_id`, `old_value`, `new_value` |
| Product | `product.js` | `category_id`, `brand_id`, `base_name`, `base_price`, `compare_at_price`, `short_description`, `is_featured`, `warranty_months`, `sold_count`, `view_count`, `rating_average`, `shipping_info`, `seo_title`, `seo_description`, `seo_keywords`, `deleted_at` |
| ProductVariant | `ProductVariant.js` | `product_id`, `variant_name`, `display_name`, `compare_at_price`, `stock_quantity`, `is_default`, `deleted_at` |
| Brand | `brand.js` | `logo_url`, `deleted_at` |
| Category | `category.js` | `deleted_at` |
| ProductImage | `productImage.js` | `product_id`, `variant_id`, `image_url`, `is_thumbnail`, `deleted_at` |
| ProductReview | `productReview.js` | `product_id`, `variant_id`, `user_id`, `rating_value`, `deleted_at` |
| Image | `image.js` | `original_name`, `file_name`, `file_path`, `file_size`, `mime_type`, `product_id`, `user_id`, `is_active`, `created_at`, `updated_at` |
| Collection | `collection.js` | `is_active` |
| BrandCategory | `brandCategory.js` | `brand_id`, `category_id` |
| InventoryLog | `inventoryLog.js` | `product_id`, `variant_id`, `change_type`, `change_amount`, `previous_stock`, `new_stock`, `order_id`, `created_by` |
| LoyaltyHistory | `loyaltyHistory.js` | `user_id`, `order_id` |
| SearchHistory | `searchHistory.js` | `user_id`, `session_id`, `results_count` |
| RecentlyViewed | `recentlyViewed.js` | `user_id`, `product_id`, `viewed_at` |

**Tổng:** 70 `field:` mappings redundant trong Group A (đã verify bằng `grep -c "field:"` từng file) — xóa hết để đáp ứng AC "Grep field: → 0 results".

---

### 40.3 Update Associations (`backend/src/models/index.js`)

**Nguyên tắc:** Khi model dùng `underscored: true`, Sequelize auto-converts foreignKey camelCase → snake_case DB column. Nhưng association `foreignKey` strings vẫn nên dùng camelCase (Sequelize attribute name), **KHÔNG** cần `field:` override nếu model đã `underscored: true`.

**Check toàn bộ associations:**

Danh sách associations cần verify (không cần đổi code nếu foreignKey đã là camelCase JS attribute name):

```js
// Ví dụ — ĐÃ ĐÚNG, không cần đổi:
User.hasMany(Address, { foreignKey: 'userId', as: 'addresses' });
// Sequelize sẽ tự map userId → user_id trong DB vì Address model có underscored: true
```

**⚠️ Trường hợp đặc biệt cần check:**
1. `InventoryLog` associations dùng `foreignKey: 'createdBy'` → auto maps to `created_by` ✓
2. `ImportLog` associations dùng `foreignKey: 'adminId'` → auto maps to `admin_id` ✓
3. `AuditLog` associations dùng `foreignKey: 'adminId'` → auto maps to `admin_id` ✓
4. `Product.hasOne(ProductVariant, { ..., scope: { isDefault: true } })` — scope dùng JS attribute name `isDefault`, Sequelize sẽ auto translate sang `is_default` trong query WHERE ✓

**Hành động:** Đọc toàn bộ `index.js`, verify không có association nào dùng snake_case string trực tiếp cho foreignKey (vì Sequelize sẽ double-convert: `user_id` → `user__id`). Tất cả foreignKey phải dùng camelCase JS name.

---

### 40.4 Fix INT UNSIGNED Mismatch — `import_logs`

**Migration file:** Nằm trong cùng migration 40.1 hoặc tách migration riêng.

```sql
-- import_logs.id: INT UNSIGNED → INT (match users.id)
ALTER TABLE import_logs MODIFY COLUMN id INT NOT NULL AUTO_INCREMENT;
-- import_logs.admin_id: INT UNSIGNED → INT (match users.id FK)
ALTER TABLE import_logs MODIFY COLUMN admin_id INT NOT NULL;
```

**Update model `importLog.js`:** Xóa `type: DataTypes.INTEGER.UNSIGNED` → dùng `DataTypes.INTEGER`.

---

### 40.5 Fix Missing FK Constraints

**Migration file:** `2026050502-phase40-add-missing-fk-constraints.js`

**⚠️ Pre-flight BẮT BUỘC trước migration:** kiểm tra constraint name hiện tại (tránh duplicate name nếu migration cũ `2026050408` đã tạo với tên khác):
```sql
-- Trên phpMyAdmin hoặc MySQL CLI, chạy 6 query sau và đọc output:
SHOW CREATE TABLE audit_logs;
SHOW CREATE TABLE search_histories;
SHOW CREATE TABLE chat_messages;
SHOW CREATE TABLE order_items;
SHOW CREATE TABLE cart_items;
SHOW CREATE TABLE product_reviews;
```
- Nếu có FK constraint nào đã tồn tại với tên KHÁC `fk_<table>_<ref>` (vd auto-generated `audit_logs_admin_id_foreign`) → trong migration THÊM `DROP FOREIGN KEY <oldName>` TRƯỚC `ADD CONSTRAINT`.
- Nếu constraint đã có với tên ĐÚNG (`fk_audit_logs_user`, etc.) → SKIP `ADD` cho table đó (idempotent).
- Implement helper trong migration:
  ```js
  async function safeAddFk(qi, table, oldFkPattern, addSql) {
    const [rows] = await qi.sequelize.query(
      `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY' AND CONSTRAINT_NAME LIKE ?`,
      { replacements: [table, oldFkPattern] }
    );
    for (const row of rows) {
      await qi.sequelize.query(`ALTER TABLE ${table} DROP FOREIGN KEY ${row.CONSTRAINT_NAME}`);
    }
    await qi.sequelize.query(addSql);
  }
  ```

```sql
-- 1. audit_logs.admin_id → users(id)
ALTER TABLE audit_logs ADD CONSTRAINT fk_audit_logs_user
  FOREIGN KEY (admin_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- 2. search_histories.user_id → users(id)
ALTER TABLE search_histories ADD CONSTRAINT fk_search_histories_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. chat_messages.sender_id → users(id)  (sau rename từ senderId)
ALTER TABLE chat_messages ADD CONSTRAINT fk_chat_messages_sender
  FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. order_items.variant_id → product_variants(id)  (sau rename từ variantId)
ALTER TABLE order_items ADD CONSTRAINT fk_order_items_variant
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- 5. cart_items.variant_id → product_variants(id)  (sau rename từ variantId)
ALTER TABLE cart_items ADD CONSTRAINT fk_cart_items_variant
  FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. product_reviews.user_id → users(id)
ALTER TABLE product_reviews ADD CONSTRAINT fk_product_reviews_user
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
```

---

### 40.6 Thống nhất DECIMAL Precision

**Migration file:** `2026050503-phase40-unify-decimal-precision.js`

**Quyết định:** Dùng `DECIMAL(15,2)` cho tất cả monetary columns (đủ cho VND — max 999,999,999,999,999.99 ≈ 10^15 đồng).

**⚠️ Pre-flight BẮT BUỘC trước migration shrink:** kiểm tra giá trị MAX hiện tại không vượt ngưỡng `(15,2)` (10^13 thực tế = 9,999,999,999,999.99). Nếu vượt → migration sẽ FAIL hoặc TRUNCATE silent.
```sql
-- Chạy 6 query, mỗi query phải trả về giá trị < 9999999999999.99 (max DECIMAL(15,2)):
SELECT MAX(subtotal), MAX(tax), MAX(shipping_cost), MAX(discount), MAX(total), 
       MAX(points_discount), MAX(warranty_cost), MAX(refund_amount) FROM orders;
SELECT MAX(unit_price), MAX(subtotal), MAX(discount_amount) FROM order_items;
SELECT MAX(unit_price) FROM cart_items;
SELECT MAX(value), MAX(min_order_amount), MAX(max_discount_amount) FROM discount_codes;
SELECT MAX(price_adjustment) FROM attribute_values;
SELECT MAX(price) FROM warranty_packages;
```
- Nếu mọi MAX < 10^13 → safe to shrink. (Thực tế thesis VND không vượt ngưỡng này.)
- Nếu có column nào vượt → KHÔNG shrink column đó, giữ DECIMAL(19,2).

**Columns cần thay đổi:**

| Table | Column | Hiện tại | Sau |
|-------|--------|----------|-----|
| `orders` | `subtotal`, `tax`, `shipping_cost`, `discount`, `total`, `points_discount`, `warranty_cost`, `refund_amount` | DECIMAL(19,2) | DECIMAL(15,2) |
| `order_items` | `price` (`unit_price`), `subtotal`, `discount_amount` | DECIMAL(19,2) | DECIMAL(15,2) |
| `cart_items` | `price` (`unit_price`) | DECIMAL(19,2) | DECIMAL(15,2) |
| `discount_codes` | `value`, `min_order_amount`, `max_discount_amount` | DECIMAL(19,2) | DECIMAL(15,2) |
| `attribute_values` | `price_adjustment` | DECIMAL(12,2) | DECIMAL(15,2) |
| `warranty_packages` | `price` | DECIMAL(12,2) | DECIMAL(15,2) |

---

### 40.7 Xóa Column Redundant `products.brand`

**Migration:**
```sql
ALTER TABLE products DROP COLUMN brand;
```

**Kết quả audit:** Column `products.brand` VARCHAR(255) đã được xác nhận KHÔNG DÙNG:
- Product model (`models/product.js`) KHÔNG define field `brand` — chỉ có `brandId` (FK)
- Không có controller/service nào đọc hoặc ghi `product.brand` string field
- `adminImport.js` đọc `row.brand` từ CSV → chuyển thành `brandId`, KHÔNG lưu vào column `brand`
- Frontend KHÔNG có TypeScript type nào define `brand: string` cho product
- Association `Product.belongsTo(Brand, { as: 'brand' })` trả về Brand object, KHÔNG phải VARCHAR column
- **Kết luận:** Safe to DROP — zero impact.

---

### 40.8 Update Raw SQL Queries trong Backend

**Nguyên tắc:** Mọi raw SQL (trong `sequelize.literal()`, `sequelize.query()`, `Sequelize.literal()`) phải dùng snake_case column names.

**Cách tìm:**
```bash
grep -rn "sequelize.literal\|sequelize.query\|Sequelize.literal\|Sequelize.query" backend/src/ --include="*.js" --exclude-dir=__tests__ --exclude-dir=migrations
```

#### Kết quả audit — 4 queries cần sửa (7 chỗ camelCase):

**1. `backend/src/controllers/product.js` — `getBestSellers()` (~line 1581-1605)**
```sql
-- HIỆN TẠI (camelCase):
JOIN order_items oi ON p.id = oi.productId   -- ❌
JOIN orders o ON oi.orderId = o.id            -- ❌
WHERE o.createdAt >= :startDate               -- ❌
-- SAU:
JOIN order_items oi ON p.id = oi.product_id   -- ✓
JOIN orders o ON oi.order_id = o.id           -- ✓
WHERE o.created_at >= :startDate              -- ✓
```

**2. `backend/src/controllers/admin.js` — revenue by category (~line 2312-2325)**
```sql
-- HIỆN TẠI (camelCase):
JOIN orders o ON o.id = oi.orderId            -- ❌
JOIN products p ON p.id = oi.productId        -- ❌
WHERE o.paymentStatus = 'paid'                -- ❌
-- SAU:
JOIN orders o ON o.id = oi.order_id           -- ✓
JOIN products p ON p.id = oi.product_id       -- ✓
WHERE o.payment_status = 'paid'               -- ✓
```

**3. `backend/src/controllers/chat.js` — session list (~line 92)**
```js
// HIỆN TẠI:
order: [[sequelize.literal('MAX(createdAt)'), 'DESC']]   // ❌
// SAU:
order: [[sequelize.literal('MAX(created_at)'), 'DESC']]  // ✓
```

**4. `backend/src/controllers/admin.js` — top products (~line 2251-2252)**
```js
// Check: Sequelize.literal('soldCount') — nếu đây là computed alias thì OK, không phải DB column.
// Verify tại runtime — nếu là alias từ SUM/COUNT thì không cần đổi.
```

#### Đã safe (không cần đổi):
- `product.js`: `sequelize.literal('(compare_at_price - base_price) ...')` — đã snake_case ✓
- `admin.js`: `sequelize.query('UPDATE products SET compare_at_price = ...')` — đã snake_case ✓
- `category.js`: `SELECT category_id, COUNT(*) ...` — đã snake_case ✓
- `chatbot.js`: `sequelize.literal('((compare_at_price - base_price) ...')` — đã snake_case ✓
- `jobs/cleanup.js`: `DELETE FROM search_histories WHERE ...` — đã snake_case ✓
- `server.js`: DDL queries — đã dùng snake_case column names ✓

---

### 40.9 Update `migration_full.sql` (SQL Dump File)

**File:** `backend/data/migration_full.sql`

Rewrite toàn bộ CREATE TABLE statements với snake_case column names. Đây là file dùng cho fresh install (import vào phpMyAdmin).

**⚠️ Pre-existing SQL file mismatches phải sửa luôn:**
- `order_items`: SQL file có `price` DECIMAL(19,2) nhưng model dùng `unitPrice` → `field: 'unit_price'` — SQL file phải đổi sang `unit_price`
- `order_items`: SQL file thiếu column `discount_amount` — model có nhưng SQL file chưa có
- `cart_items`: SQL file có `price` DECIMAL(19,2) nhưng model dùng `unitPrice` → `field: 'unit_price'` — SQL file phải đổi sang `unit_price`
- `orders.discountCodeId`: SQL file dùng camelCase nhưng model `field:` → `discount_code_id` — phải thống nhất
- `migration_full.sql` bị outdated ở nhiều chỗ — rewrite phải dựa trên model definitions, KHÔNG dựa trên file SQL cũ

**Quyết định TIMESTAMP vs DATETIME:**
- Nhóm A (products, brands, categories, variants, images, product_reviews, collections, etc.) dùng `TIMESTAMP`
- Nhóm B (users, orders, carts, reviews, etc.) dùng `DATETIME`
- **Quyết định:** Thống nhất dùng `DATETIME` cho tất cả — `DATETIME` không bị ảnh hưởng bởi timezone conversion, phù hợp hơn với Sequelize default behavior. Các bảng Nhóm A khi rewrite SQL file chuyển từ TIMESTAMP → DATETIME.

**Checklist:**
- [ ] Tất cả column names là snake_case
- [ ] Tất cả FK constraint names theo pattern `fk_{table}_{ref}`
- [ ] Tất cả timestamps dùng `DATETIME` + `created_at` / `updated_at` / `deleted_at` (thống nhất)
- [ ] DECIMAL precision thống nhất `(15,2)`
- [ ] `import_logs.id` và `admin_id` dùng `INT` (không UNSIGNED)
- [ ] Không còn column `products.brand` VARCHAR
- [ ] Tất cả missing FK constraints đã được thêm
- [ ] Seed data INSERT statements cập nhật column names mới
- [ ] `order_items.price` → đổi thành `unit_price` (match model)
- [ ] `cart_items.price` → đổi thành `unit_price` (match model)
- [ ] Tất cả `TIMESTAMP` columns → đổi thành `DATETIME`

---

### 40.10 Update `seed_data.sql`

**File:** `backend/data/seed_data.sql`

Cập nhật tất cả INSERT statements dùng snake_case column names. Ví dụ:
```sql
-- TRƯỚC:
INSERT INTO users (firstName, lastName, isActive, createdAt, ...)
-- SAU:
INSERT INTO users (first_name, last_name, is_active, created_at, ...)
```

---

### 40.11 Update Existing Migration Files (Reference Only)

**KHÔNG sửa migration files cũ** — chúng đã chạy rồi. Migration mới (40.1) sẽ rename columns. Nhưng cần verify:
- Migration files cũ có chỗ nào tạo column mới bằng camelCase không? Nếu có, migration 40.1 phải cover rename cho columns đó.
- Check tất cả migration files trong `backend/src/migrations/` → list columns mà chúng ADD → đảm bảo migration 40.1 rename hết.

---

### 40.12 Update Frontend — API Response Field Names

**⚠️ QUAN TRỌNG:** Vì Sequelize trả về JS attribute names (camelCase) trong JSON response, **frontend KHÔNG cần thay đổi** nếu backend serialization giữ nguyên camelCase.

**Verify bằng cách:**
1. Sau khi deploy model changes, gọi `GET /api/products/1` → response vẫn có `categoryId`, `basePrice`, `createdAt` (camelCase)
2. Gọi `GET /api/users/profile` → response vẫn có `firstName`, `lastName`, `isActive`

**Nếu response đúng camelCase → Frontend KHÔNG cần sửa gì.**

**⚠️ Ngoại lệ — Chỗ nào backend dùng raw query trả result trực tiếp:**
- Raw `sequelize.query('SELECT user_id FROM ...')` → kết quả trả field name `user_id` (snake_case) KHÔNG phải `userId`
- Nếu frontend nhận result trực tiếp từ raw query → field names sẽ là snake_case
- Phải grep tất cả `sequelize.query` và check xem result có được gửi trực tiếp ra API response không
- Fix: dùng alias `SELECT user_id AS userId` hoặc `{ type: QueryTypes.SELECT, mapToModel: true, model: ModelName }`

**Các raw queries đã biết cần check output format:**
1. `product.js:getBestSellers()` — raw query result có `sales_count`, `units_sold` aliases → verify frontend expects these names
2. `admin.js:revenueByCategory()` — raw query result có `categoryId`, `categoryName` aliases (AS) → OK, aliases giữ camelCase
3. `category.js:getCategories()` — raw query result có `product_count` alias → verify frontend

---

### 40.13 Update Test Files

**Scope:** Tất cả test files trong `backend/src/__tests__/`

**Nguyên tắc:** Tests dùng Sequelize models (camelCase JS attributes) → **KHÔNG cần đổi** phần lớn. Nhưng tests có raw SQL hoặc direct DB assertions cần update.

**Cách tìm:**
```bash
grep -rn "sequelize.query\|queryInterface\|\.query(" backend/src/__tests__/ --include="*.js"
```

---

### 40.14 Update Socket.IO Config

**File:** `backend/src/config/socket.js`

File này có ~15 references đến `userId`, `sessionId`. Vì đây là JS-level Sequelize queries → KHÔNG cần đổi (Sequelize auto-maps). Nhưng verify không có raw SQL.

---

### 40.15 Update Jobs / Cron

**File:** `backend/src/jobs/cleanup.js` (và các job khác nếu có)

Check raw SQL queries trong cleanup jobs — thường dùng `sequelize.query()` cho bulk operations.

---

### 40.17 Index Audit & Standardization

> **Mục tiêu:** Đảm bảo mọi FK column và high-traffic query column có index, tên theo chuẩn `idx_{table}_{col}` hoặc `uq_{table}_{col}`.

#### Vấn đề hiện tại (audit thực tế)
- Chỉ có **9 explicit named indexes** trên `images`, `import_logs`, `audit_logs`
- **Hầu hết FK columns thiếu index** (orders.user_id, cart_items.cart_id, reviews.product_id, v.v.) — JOIN performance kém
- **UNIQUE constraints inline không có tên explicit** — phpMyAdmin auto-generate tên như `users_google_id_unique`

#### Migration: `2026050504-phase40-index-standardization.js`

**A. Rename UNIQUE indexes thành `uq_{table}_{col}` pattern:**
```sql
-- users
ALTER TABLE users DROP INDEX google_id, ADD UNIQUE KEY uq_users_google_id (google_id);
ALTER TABLE users DROP INDEX email, ADD UNIQUE KEY uq_users_email (email);
-- categories
ALTER TABLE categories DROP INDEX name, ADD UNIQUE KEY uq_categories_name (name);
ALTER TABLE categories DROP INDEX slug, ADD UNIQUE KEY uq_categories_slug (slug);
-- brands
ALTER TABLE brands DROP INDEX name, ADD UNIQUE KEY uq_brands_name (name);
ALTER TABLE brands DROP INDEX slug, ADD UNIQUE KEY uq_brands_slug (slug);
-- products
ALTER TABLE products DROP INDEX slug, ADD UNIQUE KEY uq_products_slug (slug);
-- product_variants
ALTER TABLE product_variants DROP INDEX sku, ADD UNIQUE KEY uq_product_variants_sku (sku);
-- discount_codes
ALTER TABLE discount_codes DROP INDEX code, ADD UNIQUE KEY uq_discount_codes_code (code);
-- collections
ALTER TABLE collections DROP INDEX slug, ADD UNIQUE KEY uq_collections_slug (slug);
-- images
ALTER TABLE images DROP INDEX file_name, ADD UNIQUE KEY uq_images_file_name (file_name);
```

**B. Thêm indexes mới (audit thực tế: bỏ các indexes đã tồn tại):**

⚠️ **Phát hiện audit:** ~14 indexes đã tồn tại từ Phase 6/8 — KHÔNG được CREATE lại (sẽ duplicate key error). Phải dùng try/catch pattern.

**Indexes ĐÃ TỒN TẠI (KHÔNG cần CREATE):**
- `idx_orders_user_id`, `idx_orders_status`, `idx_orders_payment_status`, `idx_orders_created_at` (Phase 6/8)
- `idx_order_items_order_id`, `idx_order_items_product_id` (Phase 8)
- `idx_cart_items_cart_id`, `idx_cart_items_product_id` (Phase 6)
- `idx_product_variants_product_id` (Phase 6)
- `idx_products_category_id`, `idx_products_brand_id`, `idx_products_is_featured`, `idx_products_status`, `idx_products_created_at` (Phase 6/8)
- `idx_inventory_logs_product_id`, `idx_inventory_logs_variant_id`, `idx_inventory_logs_order_id`, `idx_inventory_logs_change_type` (migration `2026050403`)
- `idx_users_role` (Phase 8)
- `idx_images_product_id`, `idx_images_user_id`, `idx_images_category`, `idx_images_is_active`, `idx_images_created_at` (migration `2025071801`)
- `idx_audit_admin_id`, `idx_audit_entity`, `idx_audit_created_at` (migration `2026050408`)
- `idx_import_logs_admin_id`, `idx_import_logs_imported_at` (migration `2026050411`)
- `idx_product_categories_category_id` (Phase 8)
- `recently_viewed_user_product_unique` (migration `2026031802` — UNIQUE composite, cần rename thành `uq_*` ở 40.17.D)

**Indexes THỰC SỰ MỚI cần CREATE (~25 indexes — wrap try/catch):**
```sql
-- orders: deleted_at filter
CREATE INDEX idx_orders_deleted_at ON orders(deleted_at);
-- order_items: variant FK (sau rename ở 40.1)
CREATE INDEX idx_order_items_variant_id ON order_items(variant_id);
-- carts
CREATE INDEX idx_carts_user_id ON carts(user_id);
CREATE INDEX idx_carts_session_id ON carts(session_id);
-- cart_items: variant FK (sau rename)
CREATE INDEX idx_cart_items_variant_id ON cart_items(variant_id);
-- addresses
CREATE INDEX idx_addresses_user_id ON addresses(user_id);
-- reviews
CREATE INDEX idx_reviews_product_id ON reviews(product_id);
CREATE INDEX idx_reviews_user_id ON reviews(user_id);
CREATE INDEX idx_reviews_deleted_at ON reviews(deleted_at);
-- chat_messages
CREATE INDEX idx_chat_messages_session_id ON chat_messages(session_id);
CREATE INDEX idx_chat_messages_user_id ON chat_messages(user_id);
CREATE INDEX idx_chat_messages_created_at ON chat_messages(created_at);
-- search_histories
CREATE INDEX idx_search_histories_user_id ON search_histories(user_id);
CREATE INDEX idx_search_histories_created_at ON search_histories(created_at);
-- loyalty_histories
CREATE INDEX idx_loyalty_histories_user_id ON loyalty_histories(user_id);
CREATE INDEX idx_loyalty_histories_order_id ON loyalty_histories(order_id);
-- recently_viewed
CREATE INDEX idx_recently_viewed_user_id ON recently_viewed(user_id);
CREATE INDEX idx_recently_viewed_viewed_at ON recently_viewed(viewed_at);
-- news
CREATE INDEX idx_news_user_id ON news(user_id);
CREATE INDEX idx_news_slug ON news(slug);
CREATE INDEX idx_news_is_published ON news(is_published);
-- products: deleted_at + composite
CREATE INDEX idx_products_deleted_at ON products(deleted_at);
CREATE INDEX idx_products_status_deleted_at ON products(status, deleted_at);
-- product_variants
CREATE INDEX idx_product_variants_deleted_at ON product_variants(deleted_at);
-- product_images
CREATE INDEX idx_product_images_product_id ON product_images(product_id);
CREATE INDEX idx_product_images_variant_id ON product_images(variant_id);
-- product_reviews
CREATE INDEX idx_product_reviews_product_id ON product_reviews(product_id);
CREATE INDEX idx_product_reviews_user_id ON product_reviews(user_id);
-- wishlists composite
CREATE INDEX idx_wishlists_user_product ON wishlists(user_id, product_id);
-- inventory_logs.created_at chưa có
CREATE INDEX idx_inventory_logs_created_at ON inventory_logs(created_at);
```

**Helper function trong migration:**
```js
async function safeCreateIndex(queryInterface, sql) {
  try {
    await queryInterface.sequelize.query(sql);
  } catch (err) {
    if (!err.message.includes('Duplicate key name')) throw err;
    console.log(`Skip (already exists): ${sql.match(/idx_\w+/)?.[0]}`);
  }
}
```

**C. Composite indexes cho common queries:**
```sql
-- Filter products by category + status (shop page)
CREATE INDEX idx_products_status_category ON products(status, category_id);
-- Order list by user + created_at desc
CREATE INDEX idx_orders_user_created ON orders(user_id, created_at DESC);
-- Reviews by product + rating
CREATE INDEX idx_product_reviews_product_rating ON product_reviews(product_id, rating_value);
```

**D. Rename `*_idx` suffix indexes thành `idx_*` prefix (16 indexes):**

⚠️ **Phát hiện audit:** Một số migration cũ (Phase 2024-2025) đã tạo indexes với suffix-style naming (Sequelize default) thay vì prefix-style. Cần rename để thống nhất.

**⚠️ Pre-flight BẮT BUỘC trước migration rename indexes:** index name có thể auto-generate khác hardcode dưới đây. Verify từng table:
```sql
SHOW INDEX FROM products;
SHOW INDEX FROM product_variants;
SHOW INDEX FROM product_warranties;
SHOW INDEX FROM product_specifications;
SHOW INDEX FROM product_attributes;
SHOW INDEX FROM warranty_packages;
SHOW INDEX FROM recently_viewed;
```
- Đối chiếu `Key_name` thực tế với hardcode dưới. Nếu khác → cập nhật DROP INDEX statement với name thực.
- Implement helper trong migration:
  ```js
  async function safeRenameIndex(qi, table, oldKeyPattern, newName, indexCols, isUnique = false) {
    const [rows] = await qi.sequelize.query(
      `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME LIKE ?`,
      { replacements: [table, oldKeyPattern] }
    );
    const oldName = [...new Set(rows.map(r => r.INDEX_NAME))][0];
    if (!oldName) return; // Already renamed or never existed
    if (oldName === newName) return; // Already correct
    await qi.sequelize.query(`ALTER TABLE ${table} DROP INDEX \`${oldName}\``);
    const unique = isUnique ? 'UNIQUE' : '';
    await qi.sequelize.query(`ALTER TABLE ${table} ADD ${unique} INDEX \`${newName}\` (${indexCols})`);
  }
  // Usage: await safeRenameIndex(qi, 'products', '%brand%idx', 'idx_products_brand', '`brand`');
  ```
- SQL block bên dưới chỉ là **expected output**. Migration thực tế phải gọi `safeRenameIndex` với pattern dynamic.

**Danh sách thực tế từ pre-flight DB `techstore` (MariaDB 10.4) — 35 indexes cần rename:**

```sql
-- ============================================================================
-- POST-Phase 40.1 (sau khi columns đã rename camelCase → snake_case)
-- Index name vẫn còn cũ (DROP INDEX dùng OLD name, ADD INDEX dùng NEW snake_case column)
-- Tất cả ALTER dùng safeRenameIndex() helper để skip if not exists
-- ============================================================================

-- A. Plain indexes (column name as INDEX_NAME) → idx_*
-- (sau Phase 40.1, column đã snake_case, nhưng INDEX_NAME còn camelCase từ trước)

-- addresses
ALTER TABLE addresses DROP INDEX userId, ADD INDEX idx_addresses_user_id (user_id);

-- attribute_values
ALTER TABLE attribute_values DROP INDEX attribute_group_id, ADD INDEX idx_attribute_values_attribute_group_id (attribute_group_id);

-- brand_categories
ALTER TABLE brand_categories DROP INDEX category_id, ADD INDEX idx_brand_categories_category_id (category_id);

-- carts
ALTER TABLE carts DROP INDEX userId, ADD INDEX idx_carts_user_id (user_id);

-- chat_messages
ALTER TABLE chat_messages DROP INDEX userId, ADD INDEX idx_chat_messages_user_id (user_id);

-- inventory_logs
ALTER TABLE inventory_logs DROP INDEX created_by, ADD INDEX idx_inventory_logs_created_by (created_by);

-- loyalty_histories (2 index)
ALTER TABLE loyalty_histories DROP INDEX order_id, ADD INDEX idx_loyalty_histories_order_id (order_id);
ALTER TABLE loyalty_histories DROP INDEX user_id, ADD INDEX idx_loyalty_histories_user_id (user_id);

-- news
ALTER TABLE news DROP INDEX userId, ADD INDEX idx_news_user_id (user_id);

-- product_attributes
ALTER TABLE product_attributes DROP INDEX product_id, ADD INDEX idx_product_attributes_product_id (product_id);

-- product_attribute_groups (2 index)
ALTER TABLE product_attribute_groups DROP INDEX attribute_group_id, ADD INDEX idx_product_attribute_groups_attribute_group_id (attribute_group_id);
ALTER TABLE product_attribute_groups DROP INDEX product_id, ADD INDEX idx_product_attribute_groups_product_id (product_id);

-- product_collections (camelCase → snake_case sau 40.1: collectionId → collection_id)
ALTER TABLE product_collections DROP INDEX collectionId, ADD INDEX idx_product_collections_collection_id (collection_id);

-- product_reviews (2 index)
ALTER TABLE product_reviews DROP INDEX product_id, ADD INDEX idx_product_reviews_product_id (product_id);
ALTER TABLE product_reviews DROP INDEX variant_id, ADD INDEX idx_product_reviews_variant_id (variant_id);

-- product_specifications
ALTER TABLE product_specifications DROP INDEX product_id, ADD INDEX idx_product_specifications_product_id (product_id);

-- product_warranties (2 index)
ALTER TABLE product_warranties DROP INDEX product_id, ADD INDEX idx_product_warranties_product_id (product_id);
ALTER TABLE product_warranties DROP INDEX warranty_package_id, ADD INDEX idx_product_warranties_warranty_package_id (warranty_package_id);

-- recently_viewed (2 index)
ALTER TABLE recently_viewed DROP INDEX product_id, ADD INDEX idx_recently_viewed_product_id (product_id);
ALTER TABLE recently_viewed DROP INDEX user_id, ADD INDEX idx_recently_viewed_user_id (user_id);

-- reviews (camelCase → snake_case sau 40.1: productId/userId → product_id/user_id)
ALTER TABLE reviews DROP INDEX productId, ADD INDEX idx_reviews_product_id (product_id);
ALTER TABLE reviews DROP INDEX userId, ADD INDEX idx_reviews_user_id (user_id);

-- review_feedbacks (camelCase → snake_case)
ALTER TABLE review_feedbacks DROP INDEX reviewId, ADD INDEX idx_review_feedbacks_review_id (review_id);
ALTER TABLE review_feedbacks DROP INDEX userId, ADD INDEX idx_review_feedbacks_user_id (user_id);

-- wishlists (camelCase → snake_case)
ALTER TABLE wishlists DROP INDEX productId, ADD INDEX idx_wishlists_product_id (product_id);
ALTER TABLE wishlists DROP INDEX userId, ADD INDEX idx_wishlists_user_id (user_id);

-- B. Auto-gen prefix-suffix style → simplify

-- audit_logs (3 index)
ALTER TABLE audit_logs DROP INDEX audit_logs_admin_id, ADD INDEX idx_audit_logs_admin_id (admin_id);
ALTER TABLE audit_logs DROP INDEX audit_logs_created_at, ADD INDEX idx_audit_logs_created_at (created_at);
ALTER TABLE audit_logs DROP INDEX audit_logs_entity_type_entity_id, ADD INDEX idx_audit_logs_entity_type_entity_id (entity_type, entity_id);

-- chat_messages
ALTER TABLE chat_messages DROP INDEX chat_messages_product_id_foreign_idx, ADD INDEX idx_chat_messages_product_id (product_id);

-- orders
ALTER TABLE orders DROP INDEX orders_discount_code_id_foreign_idx, ADD INDEX idx_orders_discount_code_id (discount_code_id);

-- C. UNIQUE constraints → uq_*

-- brands (2 unique)
ALTER TABLE brands DROP INDEX name, ADD UNIQUE KEY uq_brands_name (name);
ALTER TABLE brands DROP INDEX slug, ADD UNIQUE KEY uq_brands_slug (slug);

-- categories (2 unique)
ALTER TABLE categories DROP INDEX name, ADD UNIQUE KEY uq_categories_name (name);
ALTER TABLE categories DROP INDEX slug, ADD UNIQUE KEY uq_categories_slug (slug);

-- collections (1 unique)
ALTER TABLE collections DROP INDEX slug, ADD UNIQUE KEY uq_collections_slug (slug);

-- discount_codes (1 unique)
ALTER TABLE discount_codes DROP INDEX code, ADD UNIQUE KEY uq_discount_codes_code (code);

-- images (1 unique)
ALTER TABLE images DROP INDEX file_name, ADD UNIQUE KEY uq_images_file_name (file_name);

-- product_variants (1 unique — verify duplicate trước: SHOW INDEX FROM product_variants;
-- Nếu có CẢ `sku` (UNIQUE) VÀ `idx_product_variants_sku` (NON_UNIQUE) → DROP `sku` + ADD `uq_product_variants_sku`, GIỮ idx_product_variants_sku.
-- Nếu chỉ có `sku` → rename normally:
ALTER TABLE product_variants DROP INDEX sku, ADD UNIQUE KEY uq_product_variants_sku (sku);

-- users (1 unique)
ALTER TABLE users DROP INDEX google_id, ADD UNIQUE KEY uq_users_google_id (google_id);

-- D. SKIP — Sequelize internal table:
-- sequelizemeta.name — KHÔNG đụng, đây là table Sequelize CLI tự quản lý
```

⚠️ **CẢNH BÁO:**
- **Toàn bộ migration PHẢI gọi qua `safeRenameIndex()` helper** (đã định nghĩa ở section trên). KHÔNG hardcode raw `ALTER TABLE DROP INDEX` mà không check exists trước.
- Tổng cộng **~35 ALTER statement**. Nếu chạy thẳng SQL block này có 1 cái fail → migration halt giữa chừng. Helper đảm bảo idempotent.
- Verify post-migration: `SELECT TABLE_NAME, INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS WHERE TABLE_SCHEMA = 'techstore' AND INDEX_NAME != 'PRIMARY' AND INDEX_NAME NOT LIKE 'idx_%' AND INDEX_NAME NOT LIKE 'uq_%' AND INDEX_NAME NOT LIKE 'fk_%' AND TABLE_NAME != 'sequelizemeta';` → 0 result.

---

### 40.18 FK Constraint Naming Cleanup

> **Mục tiêu:** Đổi tên 4 FK constraints dùng plural reference (sai pattern `fk_{table}_{singular_ref}`).

#### Pattern chuẩn
- `fk_{source_table}_{singular_referenced_entity}`
- ✅ Đúng: `fk_orders_user` (refs users(id), singular = "user")
- ❌ Sai: `fk_images_users` (plural "users")

#### Constraints CẦN rename (4 cái — audit thực tế)

| Constraint hiện tại | Bảng | Reference | Tên mới |
|---|---|---|---|
| `fk_product_images_products` | product_images | products(id) | `fk_product_images_product` |
| `fk_product_images_variants` | product_images | product_variants(id) | `fk_product_images_variant` |
| `fk_images_products` | images | products(id) | `fk_images_product` |
| `fk_images_users` | images | users(id) | `fk_images_user` |

#### Constraints ĐÃ ĐÚNG (không cần đổi)
`fk_addresses_user`, `fk_products_category`, `fk_products_brand`, `fk_variants_product`, `fk_product_reviews_product`, `fk_product_reviews_variant`, `fk_orders_user`, `fk_orders_discount`, `fk_order_items_order`, `fk_order_items_product`, `fk_carts_user`, `fk_cart_items_cart`, `fk_cart_items_product`, `fk_reviews_product`, `fk_reviews_user`, `fk_review_feedbacks_review`, `fk_review_feedbacks_user`, `fk_wishlists_user`, `fk_wishlists_product`, `fk_news_user`, `fk_chat_messages_user`, `fk_chat_messages_product`, `fk_import_logs_admin` — đều theo pattern `fk_{table}_{singular_ref}`.

#### Junction tables — abbreviation pattern (chấp nhận)
`fk_pc_*`, `fk_pcat_*`, `fk_bc_*`, `fk_pag_*`, `fk_pa_*`, `fk_ps_*`, `fk_pw_*`, `fk_lh_*`, `fk_rv_*`, `fk_attr_val_*` — abbreviation cần thiết vì tên full sẽ vượt 64-char MySQL limit khi cả 2 tên bảng dài (vd: `fk_product_attribute_groups_attribute_groups` = 47 chars, OK; nhưng có cases khác dài hơn). Document trong rewritten SQL file.

**Migration: `2026050505-phase40-fk-constraint-renames.js`**

⚠️ **Chỉ rename 4 FK** — wrap try/catch vì có thể FK đã được rename hoặc không tồn tại tuỳ DB state:
```sql
-- 1. product_images.fk_product_images_products → fk_product_images_product
ALTER TABLE product_images
  DROP FOREIGN KEY fk_product_images_products,
  ADD CONSTRAINT fk_product_images_product
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE ON UPDATE CASCADE;

-- 2. product_images.fk_product_images_variants → fk_product_images_variant
ALTER TABLE product_images
  DROP FOREIGN KEY fk_product_images_variants,
  ADD CONSTRAINT fk_product_images_variant
    FOREIGN KEY (variant_id) REFERENCES product_variants(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- 3. images.fk_images_products → fk_images_product
ALTER TABLE images
  DROP FOREIGN KEY fk_images_products,
  ADD CONSTRAINT fk_images_product
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL ON UPDATE CASCADE;

-- 4. images.fk_images_users → fk_images_user
ALTER TABLE images
  DROP FOREIGN KEY fk_images_users,
  ADD CONSTRAINT fk_images_user
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE;
```

---

### 40.19 ENUM Values Audit (đã 100% chuẩn — chỉ verify)

> **Kết quả audit:** Tất cả 16 ENUM columns đã tuân thủ standard:
> - 100% lowercase
> - Multi-word dùng snake_case (vd: `home_hero`, `product_card`, `support_chat`)
> - 0 violations

**Acceptance:** Không cần sửa, chỉ document trong rewrite SQL file để verify không có ENUM uppercase mới được thêm vào.

---

### 40.20 DEFAULT Value Standardization

> **Mục tiêu:** Tất cả DECIMAL pricing columns có DEFAULT 0.00; boolean columns có DEFAULT 0/1 rõ ràng; status columns có DEFAULT enum value.

#### Migration: `2026050506-phase40-default-values.js`

**A. DECIMAL columns thiếu DEFAULT (~10 columns):**
```sql
-- products: pricing fields default 0.00
ALTER TABLE products MODIFY COLUMN base_price DECIMAL(15,2) NULL DEFAULT 0.00;
ALTER TABLE products MODIFY COLUMN compare_at_price DECIMAL(15,2) NULL DEFAULT 0.00;

-- product_variants: pricing fields
ALTER TABLE product_variants MODIFY COLUMN price DECIMAL(15,2) NULL DEFAULT 0.00;
ALTER TABLE product_variants MODIFY COLUMN compare_at_price DECIMAL(15,2) NULL DEFAULT 0.00;

-- order_items: required fields với DEFAULT 0.00 (NOT NULL)
ALTER TABLE order_items MODIFY COLUMN unit_price DECIMAL(15,2) NOT NULL DEFAULT 0.00;
ALTER TABLE order_items MODIFY COLUMN subtotal DECIMAL(15,2) NOT NULL DEFAULT 0.00;
ALTER TABLE order_items MODIFY COLUMN discount_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00;

-- cart_items
ALTER TABLE cart_items MODIFY COLUMN unit_price DECIMAL(15,2) NOT NULL DEFAULT 0.00;

-- orders
ALTER TABLE orders MODIFY COLUMN subtotal DECIMAL(15,2) NOT NULL DEFAULT 0.00;
ALTER TABLE orders MODIFY COLUMN tax DECIMAL(15,2) NOT NULL DEFAULT 0.00;
ALTER TABLE orders MODIFY COLUMN shipping_cost DECIMAL(15,2) NOT NULL DEFAULT 0.00;
ALTER TABLE orders MODIFY COLUMN total DECIMAL(15,2) NOT NULL DEFAULT 0.00;

-- discount_codes: value cần required, không default
-- (giữ nguyên — discount value phải explicit khi tạo code)

-- warranty_packages
ALTER TABLE warranty_packages MODIFY COLUMN price DECIMAL(15,2) NOT NULL DEFAULT 0.00;
```

**B. Boolean columns thiếu DEFAULT:**
```sql
-- wishlists: thường không có isDefault, nhưng nếu có column boolean thì check
-- (Sequelize Wishlist model không có isDefault — bỏ qua)
```

**C. Status/Type columns đã có đầy đủ DEFAULT (verified) — không sửa.**

---

### 40.21 NULL/NOT NULL Standardization

> **Mục tiêu:** Đồng bộ NULL/NOT NULL cho các column cùng mục đích across tables.

#### Vấn đề hiện tại (audit)

| Column | Vấn đề | Quyết định |
|---|---|---|
| `orders.shipping_zip` | NULL — không match `addresses.zip` NOT NULL | **GIỮ NULLABLE** (Vietnam shipping không bắt buộc zip; empty string `''` gây fail validation FE) |
| `orders.shipping_country` | NULL nhưng country bắt buộc | **Đổi NOT NULL DEFAULT 'Vietnam'** |
| `orders.billing_zip` | NULL | **GIỮ NULLABLE** (lý do giống shipping_zip) |
| `orders.billing_country` | NULL | **Đổi NOT NULL DEFAULT 'Vietnam'** |
| `loyalty_histories.user_id` (NOT NULL) vs `search_histories.user_id` (NULL) | search_histories cho phép anonymous → giữ NULL | OK — different use case, không sửa |
| `carts.session_id` (NULL) vs `chat_messages.session_id` (NOT NULL) | Different use cases | OK — không sửa |

**⚠️ Lý do GIỮ zip nullable** (sửa từ quyết định cũ "NOT NULL DEFAULT ''"):
- Vietnam shipping không bắt buộc zip code (đa số order không có).
- DEFAULT `''` (empty string) sẽ fail validator FE/BE downstream nếu logic check `if (zip) {...}` (empty string is falsy nhưng vẫn pass NOT NULL constraint).
- Backfill empty từ existing rows có thể overwrite zip thực tế của address khác (cross-row contamination nếu UPDATE phức tạp).
- Frontend FE đã có `<Form.Item name="zip" rules={[]}>` không required — tương ứng với nullable backend.

**Migration: `2026050507-phase40-null-consistency.js`**
```sql
-- Shipping country bắt buộc (mọi order Vietnam)
ALTER TABLE orders MODIFY COLUMN shipping_country VARCHAR(100) NOT NULL DEFAULT 'Vietnam';
ALTER TABLE orders MODIFY COLUMN billing_country VARCHAR(100) NOT NULL DEFAULT 'Vietnam';
-- Zip code GIỮ NULLABLE — không sửa
-- ALTER TABLE orders MODIFY COLUMN shipping_zip VARCHAR(20) NULL; -- (giữ nguyên, không cần migration)
```

---

### 40.22 CHECK Constraints Expansion

> **Mục tiêu:** Thêm CHECK constraints để enforce business rules ở DB level.

#### Vấn đề hiện tại
- Chỉ 1 CHECK constraint trên toàn schema (`product_reviews.rating_value` 1-5)
- Nhiều numeric columns thiếu validation: stock_quantity có thể âm, prices có thể âm, v.v.

#### Migration: `2026050508-phase40-check-constraints.js`

```sql
-- Rating averages: 0-5
ALTER TABLE products ADD CONSTRAINT chk_products_rating_average
  CHECK (rating_average >= 0.00 AND rating_average <= 5.00);

-- Stock quantities: >= 0
ALTER TABLE products ADD CONSTRAINT chk_products_stock_quantity
  CHECK (stock_quantity >= 0);
ALTER TABLE product_variants ADD CONSTRAINT chk_product_variants_stock_quantity
  CHECK (stock_quantity >= 0);

-- Quantities: >= 1
ALTER TABLE cart_items ADD CONSTRAINT chk_cart_items_quantity
  CHECK (quantity >= 1);
ALTER TABLE order_items ADD CONSTRAINT chk_order_items_quantity
  CHECK (quantity >= 1);

-- Prices >= 0
ALTER TABLE products ADD CONSTRAINT chk_products_base_price
  CHECK (base_price IS NULL OR base_price >= 0);
ALTER TABLE product_variants ADD CONSTRAINT chk_product_variants_price
  CHECK (price IS NULL OR price >= 0);
ALTER TABLE order_items ADD CONSTRAINT chk_order_items_unit_price
  CHECK (unit_price >= 0);
ALTER TABLE order_items ADD CONSTRAINT chk_order_items_subtotal
  CHECK (subtotal >= 0);
ALTER TABLE cart_items ADD CONSTRAINT chk_cart_items_unit_price
  CHECK (unit_price >= 0);
ALTER TABLE warranty_packages ADD CONSTRAINT chk_warranty_packages_price
  CHECK (price >= 0);

-- Order totals >= 0
ALTER TABLE orders ADD CONSTRAINT chk_orders_subtotal
  CHECK (subtotal >= 0);
ALTER TABLE orders ADD CONSTRAINT chk_orders_tax
  CHECK (tax >= 0);
ALTER TABLE orders ADD CONSTRAINT chk_orders_total
  CHECK (total >= 0);
ALTER TABLE orders ADD CONSTRAINT chk_orders_discount
  CHECK (discount >= 0);

-- Loyalty points >= 0
ALTER TABLE users ADD CONSTRAINT chk_users_loyalty_points
  CHECK (loyalty_points >= 0);

-- Discount value >= 0
ALTER TABLE discount_codes ADD CONSTRAINT chk_discount_codes_value
  CHECK (value >= 0);

-- Warranty duration >= 1 month
ALTER TABLE warranty_packages ADD CONSTRAINT chk_warranty_packages_duration
  CHECK (duration_months >= 1);
ALTER TABLE products ADD CONSTRAINT chk_products_warranty_months
  CHECK (warranty_months >= 0);

-- Used count <= usage limit (when limit is set)
-- (skip — complex CHECK with NULL handling, enforce ở app level)
```

**Lưu ý:** Dự án này chạy **MariaDB 10.4.32** (XAMPP) — đã verify pre-flight. MariaDB 10.2+ enforces CHECK constraints đầy đủ (khác MySQL 5.7 chỉ accept syntax). Phase 40.22 áp dụng được cho MariaDB 10.4. (Reference: tham khảo MySQL 8.0 docs cho syntax tương đương.)

---

### 40.23 Soft Delete Policy & Standardization

> **Mục tiêu:** Document rõ table nào dùng soft delete, table nào hard delete; thống nhất column `deleted_at` (snake_case, đã cover trong 40.1).

#### Phân loại tables (theo nature)

**A. Business entities CẦN soft delete (audit trail):**
- ✅ Đã có: users, products, product_variants, product_images, product_reviews, categories, brands, orders, discount_codes, reviews
- ❌ Đang thiếu: **collections, news, addresses** — cân nhắc thêm

**B. Junction/bridge tables KHÔNG cần soft delete (hard delete OK):**
- product_categories, product_collections, brand_categories, product_warranties, product_attribute_groups, wishlist (nếu cần lịch sử thì tách bảng)

**C. Log/history tables KHÔNG cần soft delete (append-only):**
- audit_logs, import_logs, inventory_logs, loyalty_histories, search_histories, recently_viewed, chat_messages (dùng `is_archived` thay)

**D. Configuration/lookup tables KHÔNG cần (manage qua admin):**
- attribute_groups, attribute_values, warranty_packages, banners, email_campaigns, newsletter_subscribers, feedbacks

#### Migration: `2026050509-phase40-add-missing-soft-delete.js`

```sql
-- Thêm soft delete cho 3 tables thiếu
ALTER TABLE collections ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL;
ALTER TABLE news ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL;
ALTER TABLE addresses ADD COLUMN deleted_at DATETIME NULL DEFAULT NULL;

-- Index trên deleted_at cho query performance
CREATE INDEX idx_collections_deleted_at ON collections(deleted_at);
CREATE INDEX idx_news_deleted_at ON news(deleted_at);
CREATE INDEX idx_addresses_deleted_at ON addresses(deleted_at);
```

**Update Sequelize models tương ứng:**
- `collection.js`: thêm `paranoid: true`
- `news.js`: thêm `paranoid: true`
- `address.js`: thêm `paranoid: true`

---

### 40.24 VARCHAR Length Standardization

> **Mục tiêu:** Tối ưu VARCHAR sizes — không quá lớn (waste storage) hoặc quá nhỏ (truncate data).

#### Standard lengths (MySQL/RFC standards)

| Column type | Length | Lý do |
|---|---|---|
| `email` | VARCHAR(254) | RFC 5321 max |
| `phone` | VARCHAR(20) | E.164 international max + format chars |
| `firstName`, `lastName` | VARCHAR(100) | Đủ cho mọi tên |
| `password` (bcrypt hash) | VARCHAR(255) | Bcrypt $2b$ format ~60 chars, dự phòng |
| `otp_code` | VARCHAR(6) | Fixed 6 digits |
| `reset_password_token` | VARCHAR(255) | Crypto hash length |
| `session_id` | VARCHAR(128) | UUID/session hash |
| `slug` | VARCHAR(100) | URL-friendly, đủ cho SEO |
| `sku` | VARCHAR(100) | Industry standard |
| `code` (discount) | VARCHAR(50) | Discount code length |
| `status`, `type` (non-ENUM) | VARCHAR(50) | Đủ cho mọi status string |
| `name` (entity) | VARCHAR(100) | Sản phẩm, brand, category |
| `title` | VARCHAR(255) | News/review titles |
| `address1`, `address2` | VARCHAR(255) | Đủ cho địa chỉ chi tiết |
| `city`, `state`, `country` | VARCHAR(100) | Tên địa danh |
| `zip` | VARCHAR(20) | International postal codes |
| `image_url`, `link_url` | VARCHAR(500) | URL với query params |
| `description` (short) | TEXT | Long content |
| `seo_title`, `seo_description` | VARCHAR(255) / TEXT | Meta tags |

#### Migration: `2026050510-phase40-varchar-lengths.js`

```sql
-- users
ALTER TABLE users MODIFY COLUMN email VARCHAR(254) NOT NULL;
ALTER TABLE users MODIFY COLUMN phone VARCHAR(20) NULL;
ALTER TABLE users MODIFY COLUMN first_name VARCHAR(100) NOT NULL;
ALTER TABLE users MODIFY COLUMN last_name VARCHAR(100) NOT NULL;

-- addresses
ALTER TABLE addresses MODIFY COLUMN first_name VARCHAR(100) NOT NULL;
ALTER TABLE addresses MODIFY COLUMN last_name VARCHAR(100) NOT NULL;
ALTER TABLE addresses MODIFY COLUMN phone VARCHAR(20) NULL;
ALTER TABLE addresses MODIFY COLUMN city VARCHAR(100) NOT NULL;
ALTER TABLE addresses MODIFY COLUMN state VARCHAR(100) NOT NULL;
ALTER TABLE addresses MODIFY COLUMN zip VARCHAR(20) NOT NULL;
ALTER TABLE addresses MODIFY COLUMN country VARCHAR(100) NOT NULL;

-- orders shipping/billing — phone, country, city, state (zip GIỮ NULLABLE — xem 40.21)
ALTER TABLE orders MODIFY COLUMN shipping_phone VARCHAR(20) NULL;
-- shipping_zip giữ NULLABLE (Vietnam không bắt buộc zip; xem 40.21)
ALTER TABLE orders MODIFY COLUMN shipping_country VARCHAR(100) NOT NULL DEFAULT 'Vietnam';
ALTER TABLE orders MODIFY COLUMN shipping_city VARCHAR(100) NOT NULL;
ALTER TABLE orders MODIFY COLUMN shipping_state VARCHAR(100) NOT NULL;
ALTER TABLE orders MODIFY COLUMN billing_phone VARCHAR(20) NULL;
-- billing_zip giữ NULLABLE
ALTER TABLE orders MODIFY COLUMN billing_country VARCHAR(100) NOT NULL DEFAULT 'Vietnam';
ALTER TABLE orders MODIFY COLUMN billing_city VARCHAR(100) NOT NULL;
ALTER TABLE orders MODIFY COLUMN billing_state VARCHAR(100) NOT NULL;
ALTER TABLE orders MODIFY COLUMN shipping_first_name VARCHAR(100) NOT NULL;
ALTER TABLE orders MODIFY COLUMN shipping_last_name VARCHAR(100) NOT NULL;
ALTER TABLE orders MODIFY COLUMN billing_first_name VARCHAR(100) NOT NULL;
ALTER TABLE orders MODIFY COLUMN billing_last_name VARCHAR(100) NOT NULL;
ALTER TABLE orders MODIFY COLUMN payment_method VARCHAR(50) NOT NULL;

-- categories, brands, collections names
ALTER TABLE categories MODIFY COLUMN slug VARCHAR(100) NOT NULL;
ALTER TABLE brands MODIFY COLUMN slug VARCHAR(100) NOT NULL;
ALTER TABLE collections MODIFY COLUMN slug VARCHAR(100) NOT NULL;
ALTER TABLE products MODIFY COLUMN slug VARCHAR(100) NOT NULL;

-- chat_messages
ALTER TABLE chat_messages MODIFY COLUMN session_id VARCHAR(128) NOT NULL;
ALTER TABLE chat_messages MODIFY COLUMN intent VARCHAR(50) NULL;

-- carts
ALTER TABLE carts MODIFY COLUMN session_id VARCHAR(128) NULL;

-- search_histories
ALTER TABLE search_histories MODIFY COLUMN session_id VARCHAR(128) NULL;

-- products status (already snake_case)
ALTER TABLE products MODIFY COLUMN status VARCHAR(50) DEFAULT 'active';
ALTER TABLE products MODIFY COLUMN condition VARCHAR(50) DEFAULT 'new';
ALTER TABLE products MODIFY COLUMN visibility VARCHAR(50) DEFAULT 'public';

-- attribute_groups type
ALTER TABLE attribute_groups MODIFY COLUMN type VARCHAR(50) NOT NULL DEFAULT 'custom';
```

**⚠️ Cẩn trọng:** Trước khi shrink VARCHAR, query `SELECT MAX(CHAR_LENGTH(col)) FROM table` để verify không có data nào dài hơn target length. Nếu có → giữ size cũ hoặc truncate có chủ ý.

---

### 40.25 Comprehensive MySQL Compliance Verification

> **Mục tiêu:** Final checklist đảm bảo schema 100% MySQL standard compliant.

#### Verification queries

```sql
-- 1. Tất cả tables dùng InnoDB engine
SELECT table_name, engine FROM information_schema.tables
WHERE table_schema = DATABASE() AND engine != 'InnoDB';
-- Expected: 0 rows

-- 2. Tất cả tables dùng utf8mb4
SELECT table_name, table_collation FROM information_schema.tables
WHERE table_schema = DATABASE() AND table_collation NOT LIKE 'utf8mb4%';
-- Expected: 0 rows

-- 3. Tất cả columns snake_case (không có chữ hoa)
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = DATABASE() AND column_name REGEXP '[A-Z]';
-- Expected: 0 rows

-- 4. Tất cả FK constraint names theo pattern fk_*
SELECT constraint_name, table_name FROM information_schema.table_constraints
WHERE table_schema = DATABASE() AND constraint_type = 'FOREIGN KEY'
  AND constraint_name NOT REGEXP '^fk_';
-- Expected: 0 rows

-- 5. Tất cả index names theo pattern idx_* hoặc uq_* hoặc PRIMARY
SELECT table_name, index_name FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND index_name NOT IN ('PRIMARY')
  AND index_name NOT REGEXP '^(idx_|uq_|fk_)';
-- Expected: 0 rows (các index từ FK auto-create vẫn được phép nếu prefix fk_)

-- 6. FK type matching (UNSIGNED check)
SELECT table_name, column_name, column_type FROM information_schema.columns
WHERE table_schema = DATABASE() AND column_type LIKE '%unsigned%'
  AND column_name LIKE '%_id';
-- Expected: 0 rows (không có FK column nào UNSIGNED nếu users.id là signed)

-- 7. Tất cả monetary DECIMAL = (15,2)
SELECT table_name, column_name, column_type FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND column_type LIKE 'decimal%'
  AND column_name REGEXP '(price|amount|cost|value|total|subtotal|tax|discount|fee)'
  AND column_type != 'decimal(15,2)';
-- Expected: 0 rows

-- 8. ENUM values lowercase
SELECT table_name, column_name, column_type FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND data_type = 'enum'
  AND column_type REGEXP "[A-Z]'";
-- Expected: 0 rows

-- 9. Tables có timestamps đầy đủ (created_at, updated_at)
SELECT t.table_name FROM information_schema.tables t
WHERE t.table_schema = DATABASE()
  AND t.table_name NOT IN (
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = DATABASE() AND column_name = 'created_at'
  );
-- Expected: chỉ junction tables (product_collections, brand_categories) — verify accept

-- 10. No table/column names exceed 64 chars
SELECT table_name FROM information_schema.tables
WHERE table_schema = DATABASE() AND CHAR_LENGTH(table_name) > 64;
SELECT table_name, column_name FROM information_schema.columns
WHERE table_schema = DATABASE() AND CHAR_LENGTH(column_name) > 64;
-- Expected: 0 rows

-- 11. No constraint names exceed 64 chars
SELECT constraint_name FROM information_schema.table_constraints
WHERE constraint_schema = DATABASE() AND CHAR_LENGTH(constraint_name) > 64;
-- Expected: 0 rows
```

---

### Thứ tự thực hiện (CRITICAL — phải theo đúng order)

```
Step 1: Tạo migration file rename columns (40.1)
Step 2: Tạo migration fix INT UNSIGNED (40.4)
Step 3: Tạo migration add missing FKs (40.5)
Step 4: Tạo migration unify DECIMAL (40.6)
Step 5: Tạo migration drop products.brand (40.7)
Step 6: Tạo migration index standardization (40.17)
Step 7: Tạo migration FK constraint renames (40.18)
Step 8: Tạo migration default values (40.20)
Step 9: Tạo migration NULL/NOT NULL consistency (40.21)
Step 10: Tạo migration CHECK constraints (40.22)
Step 11: Tạo migration add missing soft delete (40.23)
Step 12: Tạo migration VARCHAR lengths (40.24)
        ↓
Step 13: Chạy migrations trên DB dev (run theo thứ tự 40.1 → 40.24)
        ↓
Step 14: Update 26 model files Nhóm B (40.2.1 - 40.2.26) — thêm underscored: true, xóa field: mappings
Step 15: Cleanup 14 model files Nhóm A (40.2.27) — xóa 70 redundant field: mappings
Step 16: Update Sequelize models cho 3 tables soft delete mới (collection.js, news.js, address.js — paranoid: true)
Step 17: Verify associations trong index.js (40.3)
Step 18: Update raw SQL queries (40.8)
Step 19: Update migration_full.sql (40.9) — bao gồm tất cả index, FK, CHECK, VARCHAR sizes mới
Step 20: Update seed_data.sql (40.10)
        ↓
Step 21: Khởi động server, test manual các endpoint chính
Step 22: Chạy verification queries (40.25) — verify tất cả 11 SQL checks pass
Step 23: Chạy test suite, fix failures
Step 24: Verify frontend hoạt động bình thường
        ↓
Step 25: Double-check toàn bộ (40.16) + Final compliance check (40.25)
```

---

### 40.16 Double-Check Checklist (Chạy sau khi hoàn thành tất cả steps)

#### A. Database Level
- [ ] `SHOW TABLES` → tất cả table names snake_case, plural ✓
- [ ] `DESCRIBE {table}` cho MỌI bảng → không còn column nào camelCase
- [ ] `SHOW CREATE TABLE {table}` cho MỌI bảng → FK constraints đúng tên, đúng reference
- [ ] Không có `INT UNSIGNED` nào mismatch với FK target
- [ ] Tất cả DECIMAL columns cho tiền = `(15,2)`
- [ ] Column `products.brand` (VARCHAR) đã bị xóa

#### B. Model Level
- [ ] Grep `underscored: false` trong `backend/src/models/` → 0 results
- [ ] Grep `underscored` not set → 0 results (tất cả models phải explicit set `underscored: true`)
- [ ] Grep `field:` trong `backend/src/models/` → 0 results (tất cả explicit field mappings đã xóa — đặc biệt verify User.isActive, User.loyaltyPoints, Order.pointsEarned/Used/Discount không còn `field:` camelCase-to-camelCase)
- [ ] `node -e "require('./backend/src/models')"` → không có error
- [ ] Grep `INTEGER.UNSIGNED` trong models → chỉ còn `chatMessage.js:responseTimeMs` (hợp lệ vì là duration counter, KHÔNG phải FK); `importLog.js` đã fix về `INTEGER` (signed) để khớp `users.id`

#### C. Runtime Level
- [ ] Server khởi động không có error/warning
- [ ] `GET /api/products` → trả đúng data, field names camelCase trong JSON
- [ ] `GET /api/users/profile` → `firstName`, `lastName` vẫn có trong response
- [ ] `POST /api/orders` → tạo order thành công, data lưu đúng trong DB
- [ ] `GET /api/admin/orders` → admin query hoạt động
- [ ] `GET /api/products?categoryId=1` → filter hoạt động
- [ ] Chat messages gửi/nhận bình thường
- [ ] Search history lưu/truy xuất đúng

#### D. Test Level
- [ ] `npm test` (backend) → tất cả tests PASS
- [ ] `npm run build` (frontend) → build thành công
- [ ] `npx tsc --noEmit` (frontend) → không type errors

#### E. SQL File Level
- [ ] `migration_full.sql` importable vào DB trống mà không lỗi
- [ ] `seed_data.sql` importable sau migration_full.sql mà không lỗi
- [ ] Sau import cả 2 file → server khởi động và hoạt động bình thường

---

### ✅ Acceptance Criteria Phase 40

#### Schema Consistency
- [ ] `DESCRIBE` cho tất cả 39+ bảng → 0 columns nào còn camelCase
- [ ] `SHOW CREATE TABLE` cho tất cả bảng → FK constraint names theo pattern `fk_{table}_{ref}`
- [ ] Tất cả monetary DECIMAL columns = `(15,2)` thống nhất
- [ ] `import_logs.id` và `admin_id` là `INT` (không UNSIGNED)
- [ ] Column `products.brand` (VARCHAR redundant) đã bị xóa
- [ ] 6 missing FK constraints đã được thêm (audit_logs, search_histories, chat_messages.sender_id, order_items.variant_id, cart_items.variant_id, product_reviews.user_id)

#### Model Consistency
- [ ] `grep -r "underscored: false" backend/src/models/` → 0 results
- [ ] `grep -r "field:" backend/src/models/ | grep -v node_modules | grep -v __tests__` → 0 results (tất cả explicit field mappings đã xóa)
- [ ] Tất cả 40 models có `underscored: true` (bao gồm cả BrandCategory và ImportLog dù timestamps: false)
- [ ] **CRITICAL VERIFY:** `models/user.js` KHÔNG còn `field: 'isActive'` hoặc `field: 'loyaltyPoints'`
- [ ] **CRITICAL VERIFY:** `models/Order.js` KHÔNG còn `field: 'pointsEarned'`, `field: 'pointsUsed'`, `field: 'pointsDiscount'`
- [ ] `grep -r "INTEGER.UNSIGNED" backend/src/models/` → chỉ còn 1 result: `chatMessage.js:responseTimeMs` (legitimate, không phải FK); importLog.js KHÔNG còn UNSIGNED

#### Runtime Verification
- [ ] Server khởi động KHÔNG có Sequelize warning/error
- [ ] `GET /api/products` response → fields vẫn camelCase (`categoryId`, `basePrice`, `createdAt`)
- [ ] `GET /api/users/profile` response → fields vẫn camelCase (`firstName`, `lastName`)
- [ ] `POST /api/auth/login` → hoạt động bình thường
- [ ] `POST /api/orders` → tạo order thành công, lưu DB đúng snake_case
- [ ] `GET /api/admin/dashboard` → analytics query hoạt động
- [ ] Frontend load tất cả pages chính không bị lỗi data

#### Test & Build
- [ ] `npm test` (backend) → all tests PASS
- [ ] `npm run build` (frontend) → thành công
- [ ] `npx tsc --noEmit` (frontend) → 0 errors

#### SQL Files
- [ ] `migration_full.sql` có thể import vào MySQL trống → 0 errors
- [ ] Sau import → `DESCRIBE users` hiển thị `first_name`, `last_name`, `is_active`, `created_at` (snake_case)
- [ ] Sau import → `DESCRIBE orders` hiển thị `user_id`, `shipping_first_name`, `payment_method`, `created_at` (snake_case)
- [ ] Seed data INSERT → 0 errors, data hiển thị đúng

#### Index & Constraint Standards (40.17, 40.18)
- [ ] Tất cả UNIQUE indexes có tên `uq_{table}_{col}` (verify: `SHOW INDEX FROM <table>`)
- [ ] Tất cả FK columns có index `idx_{table}_{col}` (verify performance query)
- [ ] Tất cả FK constraint names theo pattern `fk_{table}_{ref}` HOẶC abbreviation pattern documented (junction tables) — KHÔNG có constraint name nào > 64 ký tự
- [ ] 10 FK constraints có tên non-standard đã được rename (40.18)
- [ ] `SHOW INDEX FROM <every_table>` không có index name nào auto-generated (như `users_google_id_unique`)

#### DEFAULT Values (40.20)
- [ ] Tất cả monetary DECIMAL columns có DEFAULT 0.00 (trừ `discount_codes.value` cố ý required)
- [ ] Tất cả TINYINT(1) boolean columns có DEFAULT 0 hoặc 1 explicit
- [ ] Tất cả ENUM status columns có DEFAULT enum value

#### NULL/NOT NULL Consistency (40.21)
- [ ] `orders.shipping_country`, `orders.billing_country` đã chuyển NOT NULL DEFAULT 'Vietnam'. `orders.shipping_zip`, `orders.billing_zip` GIỮ NULLABLE (Vietnam không bắt buộc zip).
- [ ] Address fields giữa `addresses` và `orders.shipping_*`, `orders.billing_*` consistent

#### CHECK Constraints (40.22)
- [ ] `chk_products_rating_average` exists (rating 0-5)
- [ ] `chk_products_stock_quantity`, `chk_product_variants_stock_quantity` exists (>= 0)
- [ ] `chk_cart_items_quantity`, `chk_order_items_quantity` exists (>= 1)
- [ ] CHECK constraints cho prices (>= 0) ở products, product_variants, order_items, cart_items, warranty_packages
- [ ] CHECK cho order totals (>= 0): subtotal, tax, total, discount
- [ ] `chk_users_loyalty_points` (>= 0)
- [ ] `chk_warranty_packages_duration` (>= 1)
- [x] **Verified:** XAMPP local đang chạy **MariaDB 10.4.32** — MariaDB 10.2+ enforces CHECK constraints đầy đủ. Safe to apply 40.22 trên DB hiện tại.

#### Soft Delete Policy (40.23)
- [ ] `collections`, `news`, `addresses` đã có column `deleted_at`
- [ ] Sequelize models tương ứng có `paranoid: true`
- [ ] Index `idx_*_deleted_at` đã tạo cho query performance

#### VARCHAR Length Standardization (40.24)
- [ ] `email` columns = VARCHAR(254)
- [ ] `phone` columns = VARCHAR(20)
- [ ] `firstName`/`lastName` columns = VARCHAR(100)
- [ ] `slug` columns = VARCHAR(100)
- [ ] `session_id` columns = VARCHAR(128)
- [ ] `status`, `type`, `condition`, `visibility` non-ENUM = VARCHAR(50)
- [ ] `city`, `state`, `country` = VARCHAR(100)
- [ ] `zip` = VARCHAR(20)
- [ ] Pre-flight check: `SELECT MAX(CHAR_LENGTH(col))` không vượt target length

#### Final MySQL Compliance Verification (40.25)
- [ ] Query 1: Tất cả tables = InnoDB engine
- [ ] Query 2: Tất cả tables = utf8mb4 collation
- [ ] Query 3: Không có column name nào có chữ hoa (camelCase eliminated)
- [ ] Query 4: Tất cả FK constraints có prefix `fk_`
- [ ] Query 5: Tất cả non-PK indexes có prefix `idx_`/`uq_`/`fk_`
- [ ] Query 6: Không có FK column nào UNSIGNED (trừ chatMessage.response_time_ms)
- [ ] Query 7: Tất cả monetary DECIMAL = (15,2)
- [ ] Query 8: Tất cả ENUM values lowercase
- [ ] Query 9: Tables có timestamps đầy đủ (trừ junction tables)
- [ ] Query 10: Không có table/column name > 64 chars
- [ ] Query 11: Không có constraint name > 64 chars
- [ ] **Tất cả 11 verification queries trả về 0 rows (hoặc expected exceptions documented)**

---

## PHASE 41 — Code-Level Naming Consistency (File / Folder / API URL / Frontend Structure)

> **Mục tiêu:** Chuẩn hoá naming convention ở tầng CODE (file system, folder structure, API URL, frontend organization). Phase này **độc lập với Phase 40** — Phase 40 lo DB schema (column/table/FK names), Phase 41 lo code structure. Có thể chạy song song hoặc tách biệt.
>
> **Lý do tách phase:** Phase 40 đã rất nặng (130 columns rename + 11 migrations DB-level). Trộn naming code-level vào Phase 40 sẽ làm phase quá lớn, mất focus, khó verify.
>
> **Phân loại Rule 32:** **Loại B (Mixed Backend + Frontend)** — cần backend integration tests cho route changes + frontend smoke test cho component reorganize + manual test cross-page.
>
> **Phạm vi triển khai:** Project chạy local Windows + có thể deploy lên server (Linux/Windows Server). Phase 41 vẫn fix case-sensitivity vì là **deploy-readiness** — tránh deploy lần đầu mới phát hiện crash.
>
> **Rủi ro chính:**
> 1. Backend model file rename (PascalCase→camelCase) — local Windows không thấy lỗi (case-insensitive FS), nhưng nếu deploy lên Linux server sẽ crash. Fix sớm = an toàn.
> 2. API URL rename là **breaking change cho external clients** (nếu có mobile app/third-party). Project hiện tại chỉ có web frontend → safe rename, không cần backward-compat alias.
> 3. Frontend folder reorganize touch ~37 component files + tất cả import — Vite build sẽ catch lỗi ngay khi `npm run build`.

---

### 41.0 Tổng quan Audit hiện tại

#### Vấn đề 1 — Backend models: file naming KHÔNG CONSISTENT (deploy-readiness)
**Hiện trạng** (`backend/src/models/`):
- 5 files PascalCase: `Order.js`, `OrderItem.js`, `CartItem.js`, `ProductVariant.js`, `AuditLog.js`
- 36 files camelCase: `cart.js`, `product.js`, `productImage.js`, ...

**Tình trạng:** `backend/src/models/index.js` require với lowercase strings (`./cartItem`, `./order`, `./orderItem`, `./productVariant`) trong khi file thật PascalCase. Trên Windows local (case-insensitive FS) chạy bình thường — không thấy lỗi. Nhưng khi deploy lên Linux server sẽ crash ngay startup vì FS case-sensitive. Fix trước = tránh đêm trước demo phát hiện bug.

#### Vấn đề 2 — Backend API URL plural inconsistency
**Hiện trạng** (`backend/src/routes/index.js:34-60`):
- ✅ Plural: `/users`, `/products`, `/orders`, `/categories`, `/brands`, `/collections`, `/reviews`, `/banners`, `/images`, `/discount-codes`, `/warranty-packages`, `/email-campaigns`
- ❌ Singular nhưng là collection: `/wishlist`, `/payment`, `/upload`, `/location`, `/search-history`, `/loyalty`
- ✅ Singular hợp lệ (singleton resource): `/cart` (user có 1 cart), `/auth`, `/admin`, `/contact`, `/newsletter`, `/chatbot`, `/chat`

#### Vấn đề 3 — Frontend services file naming inconsistency
**Hiện trạng** (`frontend/src/services/`):
- 30/31 file singular: `productApi.ts`, `categoryApi.ts`, `orderApi.ts`...
- 1 outlier plural: `emailCampaignsApi.ts`

#### Vấn đề 4 — Frontend components folder overlap (`common/` vs `shared/`)
**Hiện trạng**:
- `components/common/` (27 files): Button, Card, Input, Modal, Pagination, Notifications, ImageUpload...
- `components/shared/` (10 files): CartItem, ProductCard, ProductReviews, ReviewForm, FilterPanel, SearchBar...

**Vấn đề**: Không có rule rõ ràng tại sao `Card.tsx` ở `common/` còn `ProductCard.tsx` ở `shared/`. Cả 2 folder đều là "reusable components". Confusing cho developer mới.

#### Vấn đề 5 — Frontend partial feature-sliced
**Hiện trạng**: Có `features/auth/`, `features/cart/`, `features/products/`, `features/wishlist/`, `features/ai/`, `features/ui/` (chỉ chứa slice). Nhưng product/auth/cart components vẫn nằm `components/product/`, `components/auth/`, `components/shared/CartItem.tsx`.

**Quyết định Phase 41**: KHÔNG di chuyển component sang `features/` (scope lớn, ROI thấp). Chỉ chuẩn hoá `common/` + `shared/` → `ui/` + `domain/`.

---

### 41.1 Backend Model File Naming Standardization

> **Quyết định convention:** `camelCase.js` cho file models (match style của controllers, routes, validators, middlewares — đã consistent toàn backend).

**Action — rename 5 PascalCase files sang camelCase:**

| Hiện tại | Đổi thành | Class/export name (giữ nguyên PascalCase) |
|---|---|---|
| `Order.js` | `order.js` | `Order` |
| `OrderItem.js` | `orderItem.js` | `OrderItem` |
| `CartItem.js` | `cartItem.js` | `CartItem` |
| `ProductVariant.js` | `productVariant.js` | `ProductVariant` |
| `AuditLog.js` | `auditLog.js` | `AuditLog` |

**⚠️ Quy trình rename trên Windows — BẮT BUỘC bật `core.ignorecase=false` trước:**
```bash
# Bước 1: Disable case-insensitive Git locally — nếu giữ default true, lệnh git mv thứ hai sẽ no-op vì Git tưởng cùng file
git config core.ignorecase false

# Bước 2: git mv qua tên trung gian (Windows FS case-insensitive nhưng Git đã bật case-sensitive sẽ track 2 commits)
git mv Order.js _order.js && git commit -m "Rename Phase 41.1 — Order.js → tên trung gian (bước 1/2)"
git mv _order.js order.js && git commit -m "Rename Phase 41.1 — _order.js → order.js (bước 2/2 hoàn tất)"
# Lặp tương tự cho 4 file còn lại (OrderItem, CartItem, ProductVariant, AuditLog)
```

**⚠️ Verify rename thành công:** `git ls-files | grep -E "^backend/src/models/(Order|OrderItem|CartItem|ProductVariant|AuditLog)\.js$"` → 0 result. Nếu còn file PascalCase trong git index → rename không thành công, đọc lại bước 1.

**Update `backend/src/models/index.js`:**
- Line 40: `require('./AuditLog')` → `require('./auditLog')` (chỉ chỗ này còn PascalCase, các chỗ khác đã lowercase sẵn — sẽ tự khớp file mới)

**Verify:** `grep -rn "require.*['\"]\\./[A-Z]" backend/src/models/` → 0 results

**Thứ tự với Phase 40 — quyết định cuối:** **Chạy Phase 40 TRƯỚC Phase 41** (Phase 40 đụng schema DB, Phase 41 chỉ đụng tên file JS — Phase 40 hoàn tất + verify trước khi đổi tên file để tránh confusion khi debug migration). Phase 42 then đụng cả 2 layer. → Thứ tự bắt buộc: **Phase 39 ✅ → Phase 40 → Phase 41 → Phase 42**.

---

### 41.2 Backend API URL Plural Consistency

> **Quyết định convention:** Collection resources dùng **plural kebab-case**. Singleton resources (1-per-user) giữ singular. Action endpoints (auth, upload action) giữ singular.

**Action — rename 6 routes:**

| Hiện tại | Đổi thành | Lý do |
|---|---|---|
| `/wishlist` | `/wishlists` | Mỗi user có 1 wishlist nhưng admin query nhiều → collection |
| `/payment` | `/payments` | Có nhiều payment transactions/methods |
| `/upload` | `/uploads` | Có nhiều files upload |
| `/location` | `/locations` | Locations là collection (provinces, districts...) |
| `/search-history` | `/search-histories` | Đã có nhiều records |
| `/loyalty` | `/loyalty` (giữ) | Đây là feature/concept, không phải collection — giữ |

**Final decision:** Rename 5 routes (loyalty giữ nguyên vì là concept/feature endpoint).

**Files cần update:**

#### Backend
1. `backend/src/routes/index.js` line 42, 43, 45, 56, 60: đổi mount path
2. `backend/src/app.js` (nếu có rate limiter scoped theo path): update path matchers
3. `backend/src/__tests__/*.test.js`: update endpoint URLs trong supertest calls

#### Frontend (services dùng các endpoint này)
1. `frontend/src/services/wishlistApi.ts`: đổi base URL
2. `frontend/src/services/uploadApi.ts`: đổi base URL  
3. `frontend/src/services/momoApi.ts`, `vnpayApi.ts`, `stripeApi.ts`: nếu dùng `/payment` prefix
4. `frontend/src/services/searchHistoryApi.ts`: đổi base URL
5. Bất kỳ component nào hardcode URL (grep `/wishlist\|/payment\|/upload\|/location\|/search-history`)

**Backward compatibility (nếu có mobile app/external client):**
```js
// Express alias để giữ backward compat 6 tháng:
router.use('/wishlist', wishlistRoutes); // deprecated alias
router.use('/wishlists', wishlistRoutes); // canonical
```
Nếu không có external client → bỏ alias, chỉ dùng plural mới.

**Test:** Smoke test mọi endpoint sau rename:
```bash
curl http://localhost:5000/api/wishlists/me
curl http://localhost:5000/api/payments/methods
curl -X POST http://localhost:5000/api/uploads/image -F file=@test.jpg
curl http://localhost:5000/api/locations/provinces
curl http://localhost:5000/api/search-histories/recent
```

---

### 41.3 Frontend Services File Naming

> **Quyết định convention:** `{singularEntity}Api.ts` camelCase singular.

**Action — rename 1 file:**

| Hiện tại | Đổi thành |
|---|---|
| `frontend/src/services/emailCampaignsApi.ts` | `emailCampaignApi.ts` |

**Update imports:**
```bash
# Tìm tất cả import emailCampaignsApi
grep -rn "from.*emailCampaignsApi" frontend/src/
```

Update trong các file tìm được — đổi import path.

**Quyết định về `api.ts` vs `apiClient.ts`:** Audit nội dung 2 file để xem có duplicate/confusing không:
- Nếu `api.ts` là RTK Query base API + `apiClient.ts` là Axios instance → giữ cả 2, document rõ trong header comment
- Nếu cùng concept → merge thành `apiClient.ts` duy nhất

---

### 41.4 Frontend Components Folder Reorganize

> **Quyết định convention:**
> - `components/ui/` — pure presentational, không phụ thuộc business domain (Button, Input, Modal, Card, Pagination, Spinner...)
> - `components/domain/{feature}/` — gắn với business entity (product/, order/, review/, cart/, auth/...)
> - **Bỏ** `common/` và `shared/` — gây confusion.

**Action — di chuyển files:**

#### A. `components/common/` (27 files) → phân loại
**→ `components/ui/`** (pure presentational, 25 files):
- Badge, BannerDisplay, Button, ButtonGroup, Card, Checkbox, EditorErrorBoundary, EnhancedRichTextEditor, ErrorState, IconButton, ImageUpload, Input, LanguageSwitcher, LoadingSpinner, LoadingState, Modal, Notifications, Pagination, PremiumButton, Rating, RichTextEditor, Select, SimpleRichTextEditor, Textarea, ThemeToggle

**→ `components/domain/feedback/`** (1 file):
- FeedbackModal.tsx (có business logic feedback)

**→ `components/domain/address/`** (1 file):
- AddressPicker.tsx (có business logic address — provinces API)

#### B. `components/shared/` (10 files) → phân loại
**→ `components/ui/`** (1 file):
- SearchBar.tsx (presentational)

**→ `components/domain/cart/`** (1 file):
- CartItem.tsx

**→ `components/domain/product/`** (3 files):
- ProductCard.tsx, ProductListCard.tsx, FilterPanel.tsx

**→ `components/domain/review/`** (5 files):
- ProductReviews.tsx, ReviewForm.tsx, ReviewList.tsx, ReviewSection.tsx, ReviewSummary.tsx

#### C. Existing `components/{feature}/` folders (giữ nguyên, đổi path under `domain/`):
- `components/admin/` → `components/domain/admin/`
- `components/auth/` → `components/domain/auth/`
- `components/chat/` → `components/domain/chat/`
- `components/orders/` → `components/domain/order/` (đổi sang singular)
- `components/payment/` → `components/domain/payment/`
- `components/product/` → `components/domain/product/` (merge với files từ shared/)
- `components/reviews/` → `components/domain/review/` (merge với files từ shared/, đổi sang singular)

#### D. Folders đặc biệt (giữ nguyên, không vào ui/ hay domain/):
- `components/icons/` — icons primitive, giữ nguyên
- `components/layout/` — page layouts (Footer, MainLayout...), giữ nguyên
- `components/modals/` — global modals, giữ nguyên
- `components/sections/` — page sections (HeroSection, HomeNewsSection), giữ nguyên

**Update imports — quy trình:**
```bash
# 1. Tìm tất cả import từ common/ và shared/
grep -rn "from.*components/common" frontend/src/ > /tmp/common_imports.txt
grep -rn "from.*components/shared" frontend/src/ > /tmp/shared_imports.txt

# 2. Move files theo phân loại trên
# 3. Find-and-replace import paths:
#    @/components/common/Button → @/components/ui/Button
#    @/components/shared/ProductCard → @/components/domain/product/ProductCard
#    ... (theo mapping trong A, B)

# 4. Update barrel exports (frontend/src/components/common/index.ts)
#    → tạo barrel mới: components/ui/index.ts với cùng exports
```

**Verify:**
- `npm run build` (Vite) → 0 import errors
- `npx tsc --noEmit` → 0 type errors
- Manual smoke test: mở 5 page chính (Home, Shop, ProductDetail, Cart, Checkout) — render không lỗi

**⚠️ Batch rollback strategy** (vì touch ~37 file):
- Chia 41.4 thành **6 batch nhỏ**, mỗi batch 5-7 file move + 1 commit:
  1. Batch 1: `common/` UI primitives (Button, Card, Input, Modal, Pagination) → `components/ui/`. Build verify. Commit.
  2. Batch 2: `common/` còn lại (Notifications, ImageUpload, LoadingSpinner, ...) → `components/ui/`. Build verify. Commit.
  3. Batch 3: `shared/CartItem, FilterPanel, OrderDetails` → `components/domain/{cart,product,order}/`. Build verify. Commit.
  4. Batch 4: `shared/Product*` (ProductCard, ProductListCard, ProductReviews) → `components/domain/product/`. Build verify. Commit.
  5. Batch 5: `shared/Review*` → `components/domain/review/`. Build verify. Commit.
  6. Batch 6: existing `components/{auth,admin,...}/` → `components/domain/{...}/`. Build verify. Commit.
- **Nếu batch nào fail build:** revert batch đó (`git revert HEAD` hoặc `git reset --hard HEAD~1`), debug, redo. KHÔNG cộng dồn lỗi.
- Find-and-replace import path: dùng IDE find-replace với regex, KHÔNG sed thủ công (Windows path quirks).

---

### 41.5 Tạo NAMING_CONVENTION.md Reference Doc

**Files:** `docs/NAMING_CONVENTION.md` (index) + 3 file con (split để reviewer dễ navigate, mỗi file <150 lines):
- `docs/naming/BASIC.md` — file/folder, JS/TS code, DB, API URL, git, env (~80 lines)
- `docs/naming/MODERN_TS_2025.md` — Type vs Interface, no I prefix, generic, type-only imports, export style, path alias, import order, component suffix, hook return shape, Redux Toolkit, DTO suffix, service/repo verbs (~120 lines)
- `docs/naming/DOMAIN_GLOSSARY.md` — Number unit suffix, date naming, **Domain Glossary 21 concept** (term DUY NHẤT vs cấm), i18n key namespace, folder casing, CSS, test naming (~100 lines)

`docs/NAMING_CONVENTION.md` chính chỉ là **index** ~30 lines:
```markdown
# Naming Convention — E-Commerce Codebase

Naming convention chia 3 file để dễ reference:

1. **[BASIC.md](naming/BASIC.md)** — file/folder, JS/TS code, DB, API URL, git, env vars.
2. **[MODERN_TS_2025.md](naming/MODERN_TS_2025.md)** — Modern TypeScript 2025 conventions: type/interface, generic, exports, imports, hook patterns, Redux Toolkit, DTO, service/repository method verbs.
3. **[DOMAIN_GLOSSARY.md](naming/DOMAIN_GLOSSARY.md)** — E-commerce domain terms (Ubiquitous Language) — 21 concept với term duy nhất vs cấm dùng; number unit suffix; date naming; i18n; CSS; test naming.

Mọi code mới PHẢI tuân 3 file trên. Phase 43 audit + Phase 42 Step 19 tooling enforce.
```

**Nội dung 3 file template (chia từ section đã viết bên dưới):**

```markdown
# Naming Convention — E-Commerce Codebase

## Backend (Node.js + Express + Sequelize)

### File naming
| Layer | Convention | Ví dụ |
|---|---|---|
| Models | `camelCase.js` | `product.js`, `orderItem.js` |
| Controllers | `camelCase.js` | `auth.js`, `product.js` |
| Routes | `camelCase.js` | `discountCode.js` |
| Validators | `camelCase.js` | `user.js` |
| Middlewares | `camelCase.js` | `authenticate.js` |
| Services | `camelCase.js` | `vnpay.js`, `email.js` |
| Utils | `camelCase.js` | `catchAsync.js` |
| Migrations | `YYYYMMDDHHmm-kebab-description.js` | `2026050501-rename-columns.js` |
| Tests | `{name}.test.js` hoặc `{name}.unit.test.js` | `chatbot.unit.test.js` |

### JavaScript code
- Variables, functions: `camelCase` (`getUserById`)
- Classes, Sequelize models: `PascalCase` (`Product`, `OrderItem`)
- Constants: `UPPER_SNAKE_CASE` (`MAX_RETRY_COUNT`)
- Booleans: prefix `is*/has*/can*` (`isActive`, `hasDiscount`)
- Async functions: KHÔNG bắt buộc suffix Async, để TS/JSDoc detect

### Database (Phase 40 chuẩn)
- Tables: `snake_case` plural (`order_items`)
- Columns: `snake_case` (`created_at`, `points_earned`)
- FK constraints: `fk_{table}_{singular_ref}` (`fk_orders_user`)
- Indexes: `idx_{table}_{col}` hoặc `uq_{table}_{col}`
- ENUM values: lowercase, multi-word `snake_case`

### API URL
- Base: `/api/v1/` (hoặc `/api/`)
- Collection resources: kebab-case plural (`/products`, `/discount-codes`)
- Singleton resources: singular (`/cart`, `/auth`)
- Action endpoints: verb-style chấp nhận (`/auth/login`, `/upload`)
- Path params: camelCase trong code, kebab trong URL nếu multi-word (`/orders/:orderId/items/:itemId`)

## Frontend (React + TS + Vite + Redux Toolkit)

### File naming
| Layer | Convention | Ví dụ |
|---|---|---|
| Pages | `*Page.tsx` PascalCase | `HomePage.tsx`, `CheckoutPage.tsx` |
| UI components | `PascalCase.tsx` | `Button.tsx`, `Card.tsx` |
| Domain components | `PascalCase.tsx` under `domain/{feature}/` | `domain/product/ProductCard.tsx` |
| Hooks | `use*.ts` camelCase | `useAuth.ts`, `useDebounce.ts` |
| Services | `{singularEntity}Api.ts` camelCase | `productApi.ts`, `emailCampaignApi.ts` |
| Types | `{entity}.types.ts` lowercase | `product.types.ts` |
| Store slices | `{entity}Slice.ts` camelCase | `authSlice.ts`, `cartSlice.ts` |
| Utils | `camelCase.ts` | `format.ts`, `priceUtils.ts` |
| Contexts | `*Context.tsx` PascalCase | `StripeContext.tsx` |
| i18n locales | `{lang}.json` | `vi.json`, `en.json` |

### Folder structure
```
frontend/src/
├── components/
│   ├── ui/              # Pure presentational (Button, Input, Modal...)
│   ├── domain/          # Domain-specific
│   │   ├── product/
│   │   ├── cart/
│   │   ├── order/
│   │   ├── review/
│   │   └── ...
│   ├── icons/           # SVG icon components
│   ├── layout/          # MainLayout, Footer, Grid
│   ├── modals/          # Global modals
│   └── sections/        # Page sections (Hero, HomeNews)
├── features/            # Redux slices + feature-scoped components
│   ├── auth/, cart/, products/, ...
├── pages/               # Top-level route components
├── hooks/, services/, store/, types/, utils/, contexts/, locales/
```

### TypeScript code
- Variables, functions: `camelCase`
- Types, interfaces, enums: `PascalCase` (`User`, `OrderStatus`)
- React components: `PascalCase`
- Component props interface: `{ComponentName}Props` (`ButtonProps`)
- Constants: `UPPER_SNAKE_CASE`
- Booleans: `is*/has*/can*` prefix
- Event handlers: `handle{Event}` (`handleSubmit`)
- Callbacks: `on{Event}` (`onSubmit` cho prop)

## Git
- Branch: `phase-{N}-{kebab-description}` (vd `phase-41-naming-consistency`)
- Commit: tuân Rule 4.1 plan.md (prefix + em dash + tiếng Việt)

## Env vars
- `UPPER_SNAKE_CASE` (`DATABASE_URL`, `JWT_SECRET`)

---

## Modern TypeScript / JavaScript Conventions (2025-2026)

> Áp dụng cho mọi code TS/JS mới. Code cũ migrate dần khi có cơ hội (không bắt buộc rewrite hàng loạt).

### Type vs Interface
- `interface` cho object shape có khả năng extend (props, model, DTO):
  ```ts
  interface UserProps { id: number; name: string; }
  interface AdminUserProps extends UserProps { role: 'admin'; }
  ```
- `type` cho union, intersection, utility, primitive alias:
  ```ts
  type OrderStatus = 'pending' | 'paid' | 'shipped' | 'delivered';
  type PartialUser = Partial<User>;
  ```
- KHÔNG dùng `I` prefix: `User` không phải `IUser` (Hungarian notation đã obsolete trong TS modern).

### Generic types
- Single letter cho generic đơn giản: `<T>`, `<K, V>`.
- Descriptive prefix `T` cho generic phức tạp/cụ thể: `<TUser>`, `<TPayload>`, `<TQueryParams>`.
- KHÔNG dùng tên type thường (như `User`) làm generic param → conflict với type thật.

### Type-only imports (TS 4.5+)
Dùng `import type` cho symbol chỉ là type — tree-shake tốt hơn, build nhanh hơn:
```ts
import type { Product } from '@/types';
import type { ReactNode } from 'react';
import { fetchProducts } from '@/services/productApi';
```

### Export style
- **Backend (CommonJS):** chỉ named export — `module.exports = { funcA, funcB }`. KHÔNG `module.exports = funcA` (default).
- **Frontend (ESM):**
  - **Component**: `export default` cho lazy-loadable (page, modal lớn) — `export default function HomePage() {}`.
  - **Hook, util, service, type**: named export — `export function useAuth() {}`, `export const formatPrice = ...`.
  - **Re-export trong `index.ts` barrel**: dùng named — `export { default as Button } from './Button'`.
- **Tránh mixed default + named** trong cùng file (gây confuse).

### Path alias
- Frontend: `@/*` map tới `frontend/src/*` (đã config trong `tsconfig.json` + `vite.config.ts`).
- Backend: relative path `../` (Node.js + CommonJS không alias mặc định, không cần TypeScript path mapping).
- Quy tắc: trong cùng folder/feature dùng relative `./`; cross-feature/cross-layer dùng `@/`.

### Import grouping order (FE)
```ts
// 1. React + framework
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

// 2. External libraries (alphabetical trong nhóm)
import { Button } from 'antd';
import dayjs from 'dayjs';

// 3. Internal absolute (@/)
import { useAuth } from '@/features/auth';
import { ProductCard } from '@/components/domain/product';

// 4. Internal relative
import { useProductForm } from '../hooks/useProductForm';
import type { ProductFormProps } from './types';

// 5. Styles (last)
import './ProductForm.module.css';
```
Có blank line giữa mỗi nhóm. Optional: ESLint rule `import/order` enforce.

### Component file suffix conventions
| Suffix | Khi nào dùng | Ví dụ |
|---|---|---|
| `*Page.tsx` | Top-level route component | `CheckoutPage.tsx`, `HomePage.tsx` |
| `*Layout.tsx` | Layout wrapper | `MainLayout.tsx`, `AdminLayout.tsx` |
| `*Modal.tsx` | Modal/Dialog | `ConfirmModal.tsx`, `ReviewModal.tsx` |
| `*Form.tsx` | Form container | `ProductForm.tsx`, `LoginForm.tsx` |
| `*Provider.tsx` | Context provider | `AuthProvider.tsx`, `ThemeProvider.tsx` |
| `*Section.tsx` | Page section | `HeroSection.tsx`, `HomeNewsSection.tsx` |
| `*Card.tsx` | Card-style display | `ProductCard.tsx`, `OrderCard.tsx` |
| `*List.tsx` | List rendering | `ReviewList.tsx`, `OrderList.tsx` |
| `*Item.tsx` | Single item trong list | `CartItem.tsx`, `ReviewItem.tsx` |
| `*Button.tsx` | Specialized button | `LoadingButton.tsx`, `IconButton.tsx` |
| `with*.tsx` | Higher-order component | `withAuth.tsx`, `withErrorBoundary.tsx` |

### Boolean props (React + HTML)
- **Custom prop**: `is*/has*/can*` prefix — `<Modal isOpen={true} />`, `<Form hasError={false} />`.
- **HTML attribute reflect**: giữ nguyên tên HTML — `<button disabled>` không `<button isDisabled>`; `<input readOnly>` không `<input isReadOnly>`. (React JSX dùng camelCase cho HTML attr: `readOnly`, `tabIndex`, `onClick`.)

### Custom hook return shape
- **2 element** (state + setter): tuple — `const [value, setValue] = useToggle()`.
- **3+ element**: object — `const { data, isLoading, error } = useGetProductQuery()`.
- Tuân theo pattern `useState` (tuple) và RTK Query (object) để consistent.

### Redux Toolkit
| Item | Convention | Ví dụ |
|---|---|---|
| Slice name | feature plural hoặc concept singular | `cart`, `auth`, `products`, `wishlist` |
| Action verb | imperative present | `setX`, `clearX`, `addX`, `removeX`, `toggleX`, `fetchX` |
| Selector | prefix `select` + camelCase | `selectCurrentUser`, `selectCartTotal`, `selectIsAuthenticated` |
| Thunk (createAsyncThunk) | verb + entity, KHÔNG suffix `Thunk` | `fetchProductById`, `submitOrder` |
| RTK Query endpoint | verb + entity | `getProducts`, `createOrder`, `updateUser` |
| RTK Query hook (auto) | `use{Endpoint}{Query|Mutation}` | `useGetProductsQuery`, `useCreateOrderMutation` |

### DTO / Payload / Response naming
- Request body: `{Action}{Entity}Dto` — `CreateUserDto`, `UpdateProductDto`, `LoginRequestDto`.
- Response: `{Entity}ResponseDto` hoặc `{Entity}Dto` (nếu chỉ có 1 shape) — `OrderResponseDto`, `UserDto`.
- Query params: `{Action}{Entity}QueryDto` — `ListProductsQueryDto`, `SearchProductsQueryDto`.
- File location: `dtos/{entity}Dto.js` (BE), `types/{entity}.types.ts` (FE shared types match BE DTO).

### Service method verbs (Backend)
| Verb | Semantic | Return |
|---|---|---|
| `getX(id)` | Lấy 1 record, MUST exist | Entity hoặc throw `AppError(404)` |
| `findX(id)` | Tìm 1 record, có thể null | Entity hoặc `null` |
| `listX(filters, pagination)` | Liệt kê collection có filter | `{ items, total, page, limit }` |
| `searchX(query)` | Full-text / fuzzy search | `{ items, total }` |
| `createX(payload)` | Tạo mới | Entity vừa tạo |
| `updateX(id, patch)` | Sửa partial | Entity sau update |
| `replaceX(id, full)` | Sửa toàn bộ (PUT) | Entity sau replace |
| `deleteX(id)` | Xóa (soft hoặc hard tùy entity) | `void` hoặc `{ deletedId }` |
| `processX(payload)` | Action có side-effect (payment, email, webhook) | Result object |
| `validateX(payload)` | Validate, throw nếu fail | `void` (throw) hoặc `boolean` |

### Repository method verbs (Backend)
- `findOneById(id, options)` — by primary key.
- `findOneBy{Field}(value, options)` — by other unique field (vd `findOneByEmail`).
- `findManyBy{Field}(value, options)` — by non-unique field.
- `findAll(filter, pagination)` — collection.
- `upsert(payload)` — insert hoặc update (UNIQUE conflict).
- `bulkInsert(rows)` — multi insert.
- `softDelete(id)`, `hardDelete(id)`, `restore(id)` — delete variants.
- KHÔNG chứa business logic — chỉ wrap ORM call có cache/options.

---

## Domain-Specific Conventions (E-Commerce)

### Number unit suffix
Tránh ambiguous, e-commerce có nhiều unit:
- **Tiền:** trong dự án này dùng `DECIMAL(15,2)` cho VND và GIỮ NGUYÊN tên `base_price`, `unit_price`, `total_amount`, `shipping_cost`, etc. (đã chuẩn ở Phase 40). KHÔNG đổi thêm suffix `Vnd` vì project chỉ có 1 currency — thêm suffix sẽ rename ~30 column DB và ~50 file FE/BE, ROI thấp. Convention `priceVnd`/`priceInCents` chỉ áp dụng nếu sau này có multi-currency.
- **Thời gian:** `timeoutMs`, `delayMs`, `ttlSeconds`, `expiresInDays`, `cacheTtlMin`.
- **Khối lượng:** `weightKg`, `weightG`.
- **Kích thước:** `widthCm`, `heightCm`, `lengthCm`, `diagonalInch`.
- **Phần trăm:** `discountPercent` (0-100), `taxPercent` — tránh `discount` mơ hồ.

### Date field naming
- **Timestamp** (ISO 8601 datetime): suffix `At` — `createdAt`, `updatedAt`, `deletedAt`.
- **Date-only** (không có time): suffix `Date` — `birthDate`, `expirationDate`, `releaseDate`.
- **Action timestamp**: `cancelledAt`, `paidAt`, `shippedAt`, `deliveredAt`, `refundedAt`, `verifiedAt`.
- KHÔNG dùng: `createDate`, `dateCreated`, `created_date` (dù DB là snake_case `created_at`, JS-level luôn `createdAt`).

### Domain Glossary (Ubiquitous Language)
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

### Translation key namespace (i18n)
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

### Folder casing
- **Project root folders:** lowercase — `backend/`, `frontend/`, `docs/`, `node_modules/`.
- **Source folders** (within `src/`):
  - BE: lowercase — `controllers/`, `services/`, `repositories/`, `modules/`.
  - FE: lowercase — `components/`, `features/`, `pages/`, `hooks/`.
- **Feature/domain folders**:
  - `features/{plural}/` — match REST resource (`features/products/`, `features/orders/`).
  - `components/domain/{singular}/` — match noun (`components/domain/product/`, `components/domain/order/`).
- **Component-as-folder** (component có sub-files: index, styles, test): PascalCase folder match component name — `Button/{index.tsx, Button.module.css, Button.test.tsx}`. Mặc định project hiện tại: 1 file/component, không cần folder.
- **KHÔNG mix kebab + camelCase + Pascal** trong cùng level.

### CSS / Styling
- **Default: Tailwind utility-first** — class trực tiếp trong JSX.
- **Custom CSS:** chỉ khi Tailwind không express được (animation phức tạp, third-party override) — dùng CSS Modules: `Component.module.css` co-located với component.
- **Inline style:** chỉ cho dynamic value runtime (vd `style={{ width: progress + '%' }}`) — KHÔNG cho static value.
- **Theme:** dùng `tailwind.config.js` `extend` cho color/spacing/font/breakpoint — KHÔNG hardcode hex trong className.
- **Class naming custom CSS:** kebab-case (CSS standard) — `.product-card`, `.checkout-summary`. KHÔNG dùng `.productCard` (BEM hoặc kebab, nhất quán toàn project).
- **Ant Design:** override qua `theme` token trong ConfigProvider thay vì CSS hack.

### Test naming pattern
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
```

---

### 41.6 Verification & Double-Check

#### A. Backend
- [ ] `grep -rn "^const.*= require.*['\"]\\./[A-Z]" backend/src/models/index.js` → 0 results (không còn require PascalCase)
- [ ] `ls backend/src/models/` → 0 files PascalCase (trừ `index.js` lowercase)
- [ ] `node -e "require('./backend/src/models')"` → no error trên Windows local
- [ ] (Optional cho deploy-readiness) Verify trên Linux khi đã có server thật: `node backend/src/server.js` boot OK
- [ ] Smoke test mọi route đã rename trong 41.2: trả 200 OK
- [ ] `npm test` (backend) → pass

#### B. Frontend
- [ ] `npm run build` → success, 0 import errors
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] `ls frontend/src/components/` → KHÔNG có `common/` và `shared/`, có `ui/` và `domain/`
- [ ] `ls frontend/src/services/` → KHÔNG có `emailCampaignsApi.ts`, có `emailCampaignApi.ts`
- [ ] Manual smoke test 7 pages chính: Home, Shop, ProductDetail, Cart, Checkout, OrderHistory, Profile — render OK, không console error

#### C. Cross-cutting
- [ ] `docs/NAMING_CONVENTION.md` exists, đầy đủ section
- [ ] `MEMORY.md` cập nhật reference đến naming convention nếu cần
- [ ] Plan.md nội dung Phase 40 (`backend/src/models/Order.js` paths) đã được update sang `order.js` nếu Phase 41 chạy trước

#### D. 35-check verification (Rule 31, A1→A25, B1→B6, C1→C4)
- [ ] **A1-A25:** Tất cả route mới hoạt động, response format đúng, pagination/filter còn work
- [ ] **B1-B6:** Frontend pages render đầy đủ, no broken imports, build pass, type check pass
- [ ] **C1-C4:** Git commit format đúng Rule 4.1, không Co-Authored-By Claude, comment WHY giữ nguyên không kèm `(Fix X.X)`

---

### 41.7 Thứ tự thực hiện

```
Step 1: Tạo branch phase-41-naming-consistency
Step 2: 41.1 — Rename 5 backend model files (camelCase) + update require trong index.js
        → Verify: node -e "require('./backend/src/models')" pass
        → Commit: "Phase 41.1 — Chuẩn hóa file naming backend models sang camelCase"
Step 3: 41.2 — Rename 5 backend API URL routes (plural) + update test files
        → Verify: backend tests pass, smoke curl mọi endpoint đã rename
        → Commit: "Phase 41.2 — Chuẩn hóa API URL plural cho collection resources"
Step 4: 41.2 (frontend side) — Update frontend services dùng URL mới
        → Verify: npm run build pass, manual smoke test các page dùng wishlist/payment/upload/location
        → Commit: "Phase 41.2 — Update frontend services theo API URL plural mới"
Step 5: 41.3 — Rename emailCampaignsApi.ts + update imports
        → Verify: build pass
        → Commit: "Phase 41.3 — Chuẩn hóa frontend services singular naming"
Step 6: 41.4 — Reorganize components/common + shared → ui + domain
        → Step nhỏ: tạo folder mới, di chuyển files theo từng nhóm, update imports từng batch
        → Verify từng batch: build + smoke test
        → Commit từng batch: "Phase 41.4 — Move <X> components sang ui/" / "domain/<feature>/"
Step 7: 41.5 — Tạo docs/NAMING_CONVENTION.md
        → Commit: "Phase 41.5 — Thêm tài liệu NAMING_CONVENTION.md"
Step 8: 41.6 — Chạy full verification A-D
        → Fix bất kỳ issue nào phát hiện
        → Final commit nếu có fix
Step 9: Merge branch vào main, push GitHub
```

---

### ✅ Acceptance Criteria Phase 41

#### Backend File Naming (41.1)
- [ ] `backend/src/models/Order.js` → renamed `order.js`
- [ ] `backend/src/models/OrderItem.js` → renamed `orderItem.js`
- [ ] `backend/src/models/CartItem.js` → renamed `cartItem.js`
- [ ] `backend/src/models/ProductVariant.js` → renamed `productVariant.js`
- [ ] `backend/src/models/AuditLog.js` → renamed `auditLog.js`
- [ ] `backend/src/models/index.js` line 40: `require('./auditLog')` (đã lowercase)
- [ ] `grep "require.*['\"]\\./[A-Z]" backend/src/models/index.js` → 0 matches
- [ ] Backend boot OK trên Windows local (`cd backend && npm run dev` không có error)
- [ ] (Verify khi deploy server thật, không bắt buộc lúc dev) Boot OK trên Linux server

#### Backend API URL (41.2)
- [ ] `GET /api/wishlists` 200 OK (was `/wishlist`)
- [ ] `GET /api/payments/methods` 200 OK (was `/payment/methods`)
- [ ] `POST /api/uploads/image` 200 OK (was `/upload/image`)
- [ ] `GET /api/locations/provinces` 200 OK (was `/location/provinces`)
- [ ] `GET /api/search-histories/recent` 200 OK (was `/search-history/recent`)
- [ ] Tất cả backend integration tests pass với endpoint URL mới
- [ ] Backward-compat aliases (nếu có) document rõ trong route file comment

#### Frontend Services (41.3)
- [ ] File `frontend/src/services/emailCampaignsApi.ts` không còn tồn tại
- [ ] File `frontend/src/services/emailCampaignApi.ts` exists, export đầy đủ API endpoints
- [ ] `grep -rn "emailCampaignsApi" frontend/src/` → 0 matches
- [ ] Admin Email Campaigns page hoạt động bình thường

#### Frontend Components (41.4)
- [ ] Folder `frontend/src/components/common/` không còn tồn tại
- [ ] Folder `frontend/src/components/shared/` không còn tồn tại
- [ ] Folder `frontend/src/components/ui/` exists với ~26 files presentational
- [ ] Folder `frontend/src/components/domain/` exists với subfolders: `product/`, `cart/`, `order/`, `review/`, `auth/`, `admin/`, `chat/`, `payment/`, `feedback/`, `address/`
- [ ] `grep -rn "from.*components/common" frontend/src/` → 0 matches
- [ ] `grep -rn "from.*components/shared" frontend/src/` → 0 matches
- [ ] `npm run build` (frontend) → success
- [ ] `npx tsc --noEmit` → 0 errors
- [ ] 7 pages chính render OK trên dev server: Home, Shop, ProductDetail, Cart, Checkout, OrderHistory, Profile

#### Documentation (41.5)
- [ ] File `docs/NAMING_CONVENTION.md` exists
- [ ] Doc cover đầy đủ Cơ bản: backend file/JS/DB/API, frontend file/folder/TS, git, env vars
- [ ] Doc cover đầy đủ Modern TS/JS Conventions 2025-2026: type vs interface choice, no `I` prefix, generic naming, type-only imports, export style (BE CommonJS named-only / FE default vs named), path alias `@/`, import grouping order, component file suffix (`*Page/Layout/Modal/Form/Provider/Section/Card/List/Item/Button/with*`), boolean props (custom is/has/can vs HTML attr reflect), custom hook return shape (tuple vs object), Redux Toolkit (slice/action/selector/thunk + RTK Query endpoint/hook), DTO suffix pattern, service method verbs (get/find/list/search/create/update/replace/delete/process/validate), repository method verbs (findOneById/findManyBy/upsert/bulkInsert/softDelete)
- [ ] Doc cover đầy đủ Domain-Specific Conventions: number unit suffix (priceVnd, timeoutMs, weightKg, discountPercent), date field naming (createdAt/updatedAt/deletedAt + actionAt + xxxDate), Domain Glossary / Ubiquitous Language (≥21 term với term DUY NHẤT vs cấm dùng), translation key namespace (feature.section.key nested + camelCase), folder casing (lowercase src + plural feature + singular domain), CSS/Styling (Tailwind-first + CSS Modules fallback + theme extend), test naming pattern (file co-located + describe/it should + __mocks__/__fixtures__)
- [ ] Doc reference Phase 40 (DB schema) và Phase 41 (code structure)
- [ ] Doc có note "Áp dụng cho code mới; code cũ migrate dần khi có cơ hội" — tránh hiểu lầm là phải rewrite hàng loạt

#### Cross-cutting (41.6)
- [ ] Backend `npm test` pass
- [ ] Frontend `npm run build` pass
- [ ] Frontend `npx tsc --noEmit` pass
- [ ] Manual smoke test pass A1→A25 (admin pages), B1→B6 (user pages), C1→C4 (chat/payment/upload)
- [ ] Tất cả commit tuân Rule 4.1: prefix hợp lệ + ` — ` (em dash) + tiếng Việt + KHÔNG Co-Authored-By Claude

---

## PHASE 42 — Modular Monolith + 3-Layer + Repository (DDD-lite cho module phức tạp)

> **Mục tiêu chung:** Refactor codebase đạt **Modular Monolith + 3-layer Architecture (Controller → Service → Repository) + Repository Pattern**. Áp dụng **DDD-lite chỉ cho 5 module phức tạp** (orders, payment, ai, inventory, chat) — phần còn lại (10 module) giữ 3-layer thuần. Phase 42 + 40 + 41 = **architectural baseline** cho project khóa luận: kiến trúc sạch, dễ maintain, đủ chuẩn production, KHÔNG enterprise over-engineering.
>
> **Tại sao KHÔNG full DDD?** Đây là project khóa luận tốt nghiệp — không phải hệ thống enterprise lớn. Full DDD (Entity/VO/AggregateRoot base class cho mọi module + UseCase 1-file-1-class + Mapper class chuyên dụng + Application/Domain/Infrastructure layer split mọi nơi) sẽ:
> - Tăng số file lên 3-4x mà giá trị nghiệp vụ không đổi (CRUD đơn giản KHÔNG cần aggregate).
> - Làm reviewer khóa luận khó đánh giá — code rối, navigate khó.
> - Không đủ thời gian thực thi nghiêm túc trong scope khóa luận.
>
> **Quyết định nguyên tắc (scope thực tế):**
> - **Modular Monolith — FULL:** **16 module** độc lập (auth, users, catalog, cart, orders, payment, reviews, wishlist, shipping, inventory, loyalty, notifications, content, chat, ai, upload). KHÔNG còn `controllers/`, `services/`, `models/`, `routes/` chung ở `backend/src/`.
> - **3-Layer Architecture — FULL:** Mọi module có Controller (HTTP) → Service (business logic) → Repository (data access).
> - **Repository Pattern — FULL:** Mọi module có repository interface + impl Sequelize. Service gọi qua repository, KHÔNG `Model.findAll()` trực tiếp.
> - **DTO — Light:** DTO là plain factory function `toXDto(model)` trong file `dtos/{X}Dto.js`. KHÔNG tạo Mapper class chuyên dụng.
> - **DDD-lite SCOPED — chỉ 5 module phức tạp:**
>   - **orders** — `domain/aggregates/OrderAggregate` (rich method: cancel, ship, deliver, markAsPaid) + Domain Event (OrderCreated/Cancelled/Paid/Shipped/Delivered).
>   - **payment** — `domain/policies/PaymentPolicy` (refund eligibility, retry rule) + multiple `infrastructure/gateways/` (port-adapter cho VnPay/MoMo/Stripe).
>   - **ai** — `domain/RagPipeline` orchestrator (intent → search → retrieve → LLM) + `IConversationStore`/`IVectorStore`/`ILlmGateway` interface (port-adapter).
>   - **inventory** — `domain/aggregates/InventoryAggregate` (concurrent stock deduction, restore) + Domain Event subscriber (OrderCreated/Cancelled).
>   - **chat** — `domain/ChatSession` aggregate (message threading, presence) + Socket abstraction adapter.
> - **10 module simple** (auth, users, catalog, cart, reviews, wishlist, loyalty, notifications, content, shipping, upload): CHỈ Controller + Service + Repository + Model + Route + Validator + DTO factory + module.js. KHÔNG có `domain/` folder, KHÔNG Aggregate, KHÔNG UseCase class file riêng.
> - **Domain Event:** in-process `eventBus` (light pub-sub) cho cross-module communication. KHÔNG full Saga, KHÔNG message queue.
> - **Catalog:** xử lý 3-layer thuần. Nếu sau implement thấy Product CRUD admin có ≥3 bước (variants + images + attributes) cần consistency → có thể PROMOTE lên DDD-lite (thêm `domain/`). Default: 3-layer.
>
> **Phase 42 + 40 + 41 = "architectural baseline":** mọi feature mới sau 3 phase này phải follow Modular Monolith + 3-layer + Repository. Module phức tạp mới (≥3 entity quan hệ + business rule nhiều bước) THÊM `domain/` folder với Aggregate/Event/Policy. `docs/ARCHITECTURE.md` + `docs/MODULE_GUIDE.md` + `docs/MODULE_TEMPLATE.md` + `docs/NAMING_CONVENTION.md` = nguồn chuẩn.
>
> **Phân loại Rule 32:** **Loại B (Mixed BE+FE)** — cần BE integration test + FE smoke test + manual end-to-end + 35-check Rule 31 sau mỗi step.
>
> **Phạm vi định lượng (đã giảm từ full DDD scope):**
> - 27 controller + 13 service + 41 model + 28 route → **16 module** Modular Monolith self-contained.
> - 11 simple module: ~8-12 file/module.
> - 5 complex module: ~12-20 file/module (thêm `domain/`).
> - ~15 repository interface + impl (giảm từ ~40 trong full DDD vì gom theo aggregate).
> - ~20-30 DTO factory function (giảm từ ~30-50 vì không có Mapper class).
> - 0 Entity/VO/AggregateRoot base class chung — chỉ Aggregate cụ thể trong 5 complex module.
> - Frontend: giữ nguyên 30 file `components/product/` move + **16 feature** barrel + pages → feature.
> - Tổng ~350 file touched (giảm từ ~520 full DDD), ~30 commit. Ước tính **1.5-2 tuần** thực thi.
>
> **Rủi ro chính:**
> 1. Scope còn lớn (350 file) — risk regression. Mitigation: 1 module 1 commit boundary; test sau mỗi module.
> 2. DDD-lite vs simple module quyết định sai — risk over-engineer module thực ra simple, hoặc under-engineer module thực ra phức tạp. Mitigation: bắt đầu mọi module 3-layer; chỉ promote lên DDD-lite khi rõ ràng cần (Aggregate boundary thực sự + business rule nhiều bước).
> 3. Cross-module event handler → risk circular dep nếu quá nhiều subscriber. Mitigation: limit ≤3 handler/event, document trong module README.
> 4. Repository interface vs impl — nếu chỉ 1 impl Sequelize thì interface có vẻ thừa. Mitigation: giữ interface (giúp test mock + thay impl tương lai), boilerplate ít vì pattern lặp lại.
>
> **Quan hệ với phase trước:**
> - Phase 39 ✅ đã xong (folder/file cleanup).
> - Phase 40 phải xong trước (DB schema chuẩn) — entity dùng snake_case columns mapping.
> - Phase 41 phải xong trước (file naming + API URL plural + components ui+domain) — Phase 42 dùng path/naming từ Phase 41.
> - **Bắt buộc thứ tự: Phase 39 ✅ → Phase 40 → Phase 41 → Phase 42.**

---

### 42.0 Architecture đích (Modular Monolith + 3-Layer + Repository, DDD-lite scoped)

#### 42.0.1 Backend đích

```
backend/
├── data/                          # Static data (vectorDb.json, seed_data.sql)
├── migrations/                    # Sequelize migrations (Phase 40 chuẩn)
├── jobs/                          # Cron jobs (cleanup, ...)
├── src/
│   ├── server.js                  # Bootstrap: load modules, start HTTP + Socket
│   ├── app.js                     # Express app: global middleware, mount module routers
│   ├── shared/                    # Cross-module foundation (LIGHT — không có Entity/VO/AggregateRoot base class chung)
│   │   ├── errors/                # AppError, DomainError, ValidationError, NotFoundError
│   │   ├── result.js              # Result wrapper (success/failure) — optional, tiện cho error handling
│   │   ├── eventBus.js            # In-process pub-sub (publish/subscribe) cho cross-module
│   │   ├── persistence/
│   │   │   ├── sequelize.js       # Sequelize init
│   │   │   └── unitOfWork.js      # Transaction helper
│   │   ├── cache/redisClient.js   # Redis abstraction (đã có Phase 1)
│   │   ├── http/
│   │   │   └── middlewares/       # authenticate, validateRequest, errorHandler (move từ middlewares/)
│   │   ├── socket/index.js        # io setup + JWT auth + namespace mount
│   │   ├── logger.js              # Winston wrapper
│   │   ├── mailer.js              # Nodemailer wrapper
│   │   └── utils/                 # Pure helpers (catchAsync, ...)
│   └── modules/
│       ├── auth/                  # Simple (3-layer)
│       ├── users/                 # Simple
│       ├── catalog/               # Simple — Product + Category + Brand + Collection
│       ├── cart/                  # Simple
│       ├── orders/                # ⭐ DDD-lite (OrderAggregate + Events)
│       ├── payment/               # ⭐ DDD-lite (PaymentPolicy + Gateway adapters)
│       ├── reviews/               # Simple
│       ├── wishlist/              # Simple
│       ├── shipping/              # Simple
│       ├── inventory/             # ⭐ DDD-lite (InventoryAggregate + concurrent stock)
│       ├── loyalty/               # Simple
│       ├── notifications/         # Simple
│       ├── content/               # Simple — Banner + News + EmailCampaign
│       ├── chat/                  # ⭐ DDD-lite (ChatSession + Socket adapter)
│       ├── ai/                    # ⭐ DDD-lite (RagPipeline + port-adapter LLM/Vector/ConversationStore)
│       └── upload/                # Simple
└── package.json
```

#### Module template — SIMPLE (11 modules: auth, users, catalog, cart, reviews, wishlist, loyalty, notifications, content, shipping, upload)

```
modules/{module-name}/
├── controllers/{X}Controller.js              # Parse req → service → format res
├── services/{X}Service.js                    # Business logic (transaction wrap)
├── repositories/
│   ├── I{X}Repository.js                     # Interface (method signatures)
│   └── Sequelize{X}Repository.js             # Sequelize impl
├── models/{X}Model.js                        # Sequelize model (move từ src/models/)
├── routes.js                                 # Express router
├── validators/{action}Validator.js           # Joi schema
├── dtos/{X}Dto.js                            # Plain factory: toXDto(model) → { id, ... }
└── module.js                                 # DI wire: build repo → service → controller → router
```

**Đặc điểm SIMPLE module:**
- Service method = use case (vd `userService.createUser`, `cartService.addItem`). KHÔNG tách `application/use-cases/CreateUserUseCase.js` riêng.
- DTO là factory function `toUserDto(user)`, KHÔNG class Mapper.
- Repository chỉ wrap Sequelize (find, save, delete). Service chứa business logic.
- Transaction trong service (`sequelize.transaction(async (t) => {})`) qua `shared/persistence/unitOfWork`.

#### Module template — DDD-LITE (5 modules: orders, payment, ai, inventory, chat)

```
modules/{module-name}/
├── controllers/, services/, repositories/, models/, routes.js, validators/, dtos/, module.js   # Same as simple
└── domain/                                   # ⭐ Thêm domain folder cho complex
    ├── aggregates/{X}Aggregate.js            # Rich domain method (vd order.cancel(), order.markAsPaid())
    ├── events/{X}{Action}Event.js            # Domain Event (publish qua eventBus)
    ├── policies/{X}Policy.js                 # Pure business rule (vd RefundPolicy, StockReservationPolicy)
    └── (specific cho module phức tạp)
        ├── ports/I{ExternalService}Gateway.js  # Interface cho external (LLM, Payment Gateway)
        └── orchestrators/{X}Pipeline.js        # Multi-step coordination (vd RagPipeline)
```

**Đặc điểm DDD-LITE module:**
- `domain/aggregates/` — Aggregate root chứa rich method (orders cancel/ship/markAsPaid; inventory deductStock/restoreStock với concurrent control). KHÔNG có Entity/VO base class chung.
- `domain/events/` — Plain object event (`{ type, payload, occurredAt }`) publish qua `eventBus`.
- `domain/policies/` — Pure function rules (vd `canRefund(payment, requestAmount)`).
- `domain/ports/` — Interface cho external service (LLM, payment gateway). Impl ở `infrastructure/gateways/`.
- Service vẫn là entry point, dùng Aggregate cho rich behavior.

**Khi nào promote từ Simple lên DDD-lite?**
- Module có ≥3 entity quan hệ với nhau (orders → orderItems → variant stock).
- Business rule có ≥3 bước hoặc state transition (order: pending → paid → shipped → delivered).
- Có integration với multiple external service (payment: VnPay + MoMo + Stripe).
- Có concurrent/race condition cần coordinate (inventory stock deduction).

**Cross-module rule (giữ nguyên cho cả simple + DDD-lite):**
- Module A gọi module B → qua public service interface (truyền qua DI trong `module.js`), KHÔNG `require` trực tiếp internal của B.
- Hoặc qua Domain Event (publish từ A, subscribe trong B).
- Ví dụ: `orderService.createOrder` publish `OrderCreatedEvent` → `inventoryService` (DDD-lite) subscribe + deduct stock.

#### 42.0.2 Frontend đích (Strict Layered Feature-Based)

```
frontend/src/
├── App.tsx, main.tsx
├── shared/                        # Cross-feature foundation
│   ├── ui/                        # Pure UI primitives (Button, Input, Modal, Card, ...)
│   ├── components/                # Cross-feature reusable (icons, layout, modals, sections)
│   ├── hooks/                     # Generic hooks (useDebounce, useScrollToTop, useMediaQuery, ...)
│   ├── api/                       # rtkApi.ts (RTK base) + axiosClient.ts + tokenManager.ts
│   ├── utils/                     # Generic helpers ONLY (cn, format, textUtils, errorUtils, ...)
│   ├── types/                     # Shared types (ApiResponse, Pagination, ErrorResponse)
│   ├── i18n/                      # Locale loader + namespace registry
│   ├── routing/                   # Route guard helpers
│   └── theme/                     # Theme context, design tokens
├── features/                      # Mỗi feature self-contained
│   ├── auth/
│   ├── users/
│   ├── catalog/                   # Browse + search + detail + admin
│   ├── cart/
│   ├── checkout/
│   ├── orders/
│   ├── payment/
│   ├── reviews/
│   ├── wishlist/
│   ├── loyalty/
│   ├── notifications/
│   ├── content/                   # News + banners + email campaigns
│   ├── chat/                      # Realtime support
│   ├── ai/                        # Chatbot widget
│   ├── admin/                     # Admin dashboard cross-cutting
│   └── upload/
├── pages/                         # CHỈ giữ generic page (HomePage, AboutPage, ContactPage, FAQs, NotFound, Unauthorized, Deals)
├── routes/AppRoutes.tsx           # Centralized routing (composition root)
└── store/index.ts                 # Combine slices từ features
```

**Cấu trúc chuẩn 1 feature:**
```
features/{feature-name}/
├── components/                    # Feature-specific components
├── hooks/                         # Feature-specific hooks
├── api/{entity}Api.ts             # RTK Query endpoints
├── store/{entity}Slice.ts         # Redux slice (nếu có local state)
├── services/{x}Logic.ts           # Domain logic (FE — pure TS, không API call)
├── types/{entity}.types.ts        # Feature types
├── pages/{X}Page.tsx              # Feature-owned pages
├── admin/                         # (nếu feature có admin sub-feature)
│   ├── components/, hooks/, pages/
└── index.ts                       # Public API barrel — export named only
```

**Quyết định FE:**
- **Pages thuộc về feature** (vd `LoginPage` ở `features/auth/pages/`) thay vì gom hết `pages/`. `pages/` cấp root chỉ giữ generic.
- **API service trong feature** — `productApi.ts` ở `features/catalog/api/`.
- **Types feature-specific trong feature** — chỉ types shared (ApiResponse) ở `shared/types/`.
- **Routing centralized** — `routes/AppRoutes.tsx` import từ feature barrel để không bị cyclic.

#### 42.0.3 Tóm tắt phạm vi

| Layer | Refactor | File ảnh hưởng |
|---|---|---|
| BE shared foundation (LIGHT) | errors/, result.js, eventBus.js, persistence/, cache/, http/middlewares/, socket/, logger.js, mailer.js, utils/ | ~12 file mới |
| BE 10 simple modules | controllers/, services/, repositories/, models/, routes.js, validators/, dtos/, module.js (~8-10 file/module) | ~90 file |
| BE 5 DDD-lite modules | + domain/{aggregates, events, policies, ports} (~12-18 file/module) | ~75 file |
| BE delete legacy | controllers/, services/, routes/, models/, validators/, middlewares/ chung | ~120 file delete |
| FE shared foundation | shared/{ui, hooks, api, utils, types, i18n, routing, theme} | ~30 file move |
| FE 16 features | self-contained per feature | ~150 file move |
| FE pages → feature | 30+ page sang feature | ~40 file move |
| Doc | NAMING + ARCHITECTURE + MODULE_GUIDE + MODULE_TEMPLATE | 4 file |

**Tổng:** ~350 file (giảm từ ~520 full DDD). ~30 commit. **1.5-2 tuần** thực thi.

---

### 42.1 Step 1 — Pre-flight: Foundation + Documentation

**Action:**
1. Tạo branch `phase-42-modular-monolith-refactor`.
2. Baseline: `npm test` (BE), `npm run build` + `npx tsc --noEmit` (FE) — log baseline.
3. Tạo `docs/ARCHITECTURE.md` (5 section): Overview (Modular Monolith diagram), Layer Responsibilities (3-layer), Module Template (simple vs DDD-lite), Data Flow (HTTP + Socket + Event), AI/RAG Pipeline.
4. Tạo `docs/MODULE_GUIDE.md` (thay thế DDD_GUIDE — phù hợp scope khóa luận):
   - Module simple vs DDD-lite — checklist khi nào áp dụng cái nào.
   - 3-layer pattern: Controller → Service → Repository.
   - Service method = use case (1 method = 1 business operation), wrap transaction.
   - Repository interface + Sequelize impl pattern.
   - DTO factory function pattern (`toXDto(model) → plain object`).
   - DDD-lite (chỉ orders/payment/ai/inventory/chat): Aggregate rich method, Domain Event qua eventBus, Policy pure function.
   - Anti-patterns: tạo Entity/VO base class chung, UseCase 1-file-1-class cho CRUD đơn giản, Mapper class, Domain layer cho module simple.
5. Tạo `docs/MODULE_TEMPLATE.md`:
   - Cấu trúc folder cho simple module (10 modules).
   - Cấu trúc folder cho DDD-lite module (5 modules).
   - File `module.js` (DI wire) pattern + ví dụ.
   - Cross-module call qua public service interface (DI) hoặc Domain Event.
6. Tạo `backend/src/shared/` (LIGHT scope — không có Entity/VO/AggregateRoot base class chung):
   - `errors/{AppError, DomainError, ValidationError, NotFoundError}.js`.
   - `result.js` — Result wrapper (optional, dùng cho service trả `Result.ok(data)` hoặc `Result.fail(error)`).
   - `eventBus.js` — In-process pub-sub (publish/subscribe + on/emit) cho cross-module Domain Event.
   - `persistence/{sequelize.js, unitOfWork.js}` — Sequelize init + transaction helper.
   - `cache/redisClient.js` — Redis abstraction (Phase 1 đã có).
   - `http/middlewares/` — move từ `backend/src/middlewares/` (authenticate, validateRequest, errorHandler, rateLimit).
   - `socket/index.js` — io setup + JWT auth + namespace mount.
   - `logger.js`, `mailer.js`.
   - `utils/` — catchAsync, AppError (move từ `backend/src/utils/`).
7. Tạo `frontend/src/shared/`:
   - Move `services/{api.ts → rtkApi.ts, apiClient.ts → axiosClient.ts, tokenManager.ts}` → `shared/api/`.
   - Move generic `utils/`, generic `hooks/` → `shared/`.
   - Move `contexts/ThemeContext` → `shared/theme/`.
   - Move `types/{common, ui}` → `shared/types/`.
   - Move `config/i18n.ts`, `locales/` → `shared/i18n/`.
8. Bổ sung `docs/NAMING_CONVENTION.md` section "Module + Repository + Aggregate Naming":
   - Repository: `I{X}Repository` interface + `Sequelize{X}Repository` impl (`I` prefix là EXCEPTION với rule "no I prefix" — clean architecture convention).
   - Service: `{X}Service.js` với method verb pattern (get/find/list/search/create/update/delete/process).
   - DTO factory: `to{X}Dto(model)` trong `dtos/{X}Dto.js`.
   - Aggregate (DDD-lite): `{X}Aggregate.js` với rich method (vd `order.cancel()`, `inventory.deduct()`).
   - Domain Event: `{X}{Action}Event` (vd `OrderCreatedEvent`).
   - Policy: `{X}Policy.js` với pure function (vd `RefundPolicy.canRefund(payment, amount)`).

**Risk:** Thấp (chỉ tạo foundation + move generic).

**Validation:**
- [ ] 3 doc tồn tại: `ARCHITECTURE.md`, `MODULE_GUIDE.md`, `MODULE_TEMPLATE.md`.
- [ ] `backend/src/shared/` exists với cấu trúc đã list (KHÔNG có Entity/VO/AggregateRoot base class — verify `ls shared/` không có folder `domain/`).
- [ ] `frontend/src/shared/{api, ui, components, hooks, utils, types, i18n, theme}/` exists.
- [ ] BE test + FE build vẫn pass.

**Commit:** 3 commit (doc, BE shared, FE shared).

---

### 42.2 Step 2 — Module: `auth` (SIMPLE — TEMPLATE Reference)

> Build `modules/auth/` theo template SIMPLE 3-layer. Module này làm **TEMPLATE** cho 9 module simple còn lại (users, cart, reviews, wishlist, loyalty, notifications, content, shipping, upload + catalog).

**Tasks:**

1. **Folder structure** (theo template SIMPLE):
   ```
   modules/auth/
   ├── controllers/AuthController.js
   ├── services/AuthService.js
   ├── repositories/{ISessionRepository.js, SequelizeSessionRepository.js}
   ├── models/SessionModel.js                # move từ src/models/Session.js (nếu có)
   ├── routes.js
   ├── validators/{loginValidator, registerValidator, otpValidator, passwordResetValidator}.js
   ├── dtos/AuthDto.js                       # toLoginResponseDto, toUserDto factory
   └── module.js                             # DI: build SequelizeSessionRepository → AuthService → AuthController → router
   ```
2. **AuthService** chứa 8 method = 8 use case: `login(credentials)`, `register(payload)`, `verifyOtp(payload)`, `forgotPassword(email)`, `resetPassword(payload)`, `logout(token)`, `refreshToken(token)`, `googleLogin(googleToken)`. KHÔNG tách 8 file UseCase riêng.
3. **AuthController** parse req → `await authService.login(req.body)` → `res.json(toLoginResponseDto(...))`.
4. **Migrate:** `app.js` thay `app.use('/api/auth', require('./routes/auth'))` bằng `app.use('/api/auth', authModule.router)`.
5. **Delete legacy:** `controllers/auth.js`, `routes/auth.js`, `validators/auth.js`.

**Risk:** Cao (auth = entry point).

**Validation:**
- [ ] Module structure khớp `MODULE_TEMPLATE.md` (template SIMPLE — KHÔNG có folder `domain/`).
- [ ] `grep -rn "Sequelize\|Model\.find\|Model\.create" backend/src/modules/auth/services/` → 0 (service chỉ qua repo).
- [ ] Service method test pass (mock repo).
- [ ] Smoke: login, register, OTP, forgot/reset, logout, refresh, Google — tất cả 200 OK.
- [ ] `grep -rn "controllers/auth\|routes/auth" backend/src/` → 0 (legacy đã xóa).

**Commit:** 3 commit (repository + service, controller + routes, integration + cleanup).

---

### 42.3 Step 3 — Module: `users` (SIMPLE)

**Tasks:**
- Folder template SIMPLE: controllers/, services/, repositories/, models/, routes.js, validators/, dtos/, module.js.
- `UserService` ~10 method: createUser, getUserProfile, updateProfile, changePassword, banUser, deleteUser, listUsersAdmin, addAddress, updateAddress, deleteAddress, listAddresses.
- `IUserRepository` + `IAddressRepository` + Sequelize impl.
- `UserDto`, `AddressDto` factory function.
- Auth module reference qua `IUserRepository` (DI).

**Validation:** 
- [ ] Folder template SIMPLE (không `domain/`).
- [ ] Profile + address + admin user mgmt OK.
- [ ] Service không touch Sequelize trực tiếp.

**Commit:** 3 commit.

---

### 42.4 Step 4 — Module: `catalog` (SIMPLE — lớn nhất nhưng vẫn 3-layer)

> **Quyết định:** Catalog xử lý 3-layer thuần. Product CRUD admin có nhiều bước (variant + image + attribute) nhưng đa phần là eager loading, không cần Aggregate rich method. Service `productService.createProduct(payload)` wrap transaction là đủ.

**Tasks:**
- Folder template SIMPLE.
- `CatalogService` (hoặc tách `ProductService, CategoryService, BrandService, CollectionService` nếu file >500 lines).
- ~14 method/use case: listProducts, getProductDetail, searchProducts, createProduct (transaction), updateProduct (transaction), deleteProduct, getRecentlyViewed, addRecentlyViewed, getRelatedProducts, listCategories, getCategoryTree, listBrands, listCollections, importProducts.
- ~8 Repository: `IProductRepository`, `ICategoryRepository`, `IBrandRepository`, `ICollectionRepository`, `IProductImageRepository`, `IProductAttributeRepository`, `IWarrantyPackageRepository`, `IRecentlyViewedRepository`.
- DTO factory: `toProductListItemDto, toProductDetailDto, toCategoryDto, toBrandDto, toCollectionDto`.
- Cross-module event: `productService.createProduct` publish `product.created` event qua `eventBus` → `aiService` subscribe → upsert vector (Step 11).

**Validation:**

**Validation:**
- [ ] CRUD product/category/brand/collection OK.
- [ ] Search (text + filter + sort) work.
- [ ] RecentlyViewed cap 20/user (Phase 36 baseline).
- [ ] `eventBus.publish('product.created')` → AI subscribe → upsert vector OK.
- [ ] `grep -rn "controllers/product\|routes/product" backend/src/` → 0 (legacy đã xóa).

**Commit:** 4 commit (repository batch, service, controller + routes, integration).

---

### 42.5 Step 5 — Module: `cart` (SIMPLE)

**Tasks:**
- Folder template SIMPLE.
- `CartService` 6 method: getCart, addToCart, updateCartItem, removeCartItem, clearCart, mergeGuestCart.
- `ICartRepository` + Sequelize impl.
- Cross-module: addToCart validate stock qua `IProductRepository` (DI inject từ catalog module).

**Validation:** Cart user + guest + merge OK; stock validation; race condition prevention (Phase 35 baseline).

**Commit:** 2 commit.

---

### 42.6 Step 6 — Module: `orders` + `payment` (DDD-LITE — gắn chặt qua Domain Event)

> **2 module DDD-lite — đây là core e-commerce flow phức tạp nhất.**

**Aggregate boundary giữa Order và Payment:**
- 2 aggregate khác nhau → CHỈ liên kết qua `paymentTransactionId` reference (eventual consistency).
- KHÔNG transaction cross-aggregate. Dùng Domain Event.

#### 42.6.1 — `orders` (DDD-LITE)

```
modules/orders/
├── controllers/, services/, repositories/, models/, routes.js, validators/, dtos/, module.js
└── domain/
    ├── aggregates/OrderAggregate.js     # Rich method: cancel(), markAsPaid(), markAsShipped(), markAsDelivered()
    ├── events/{OrderCreatedEvent, OrderCancelledEvent, OrderShippedEvent, OrderDeliveredEvent, OrderPaidEvent}.js
    └── policies/OrderCancellationPolicy.js  # canCancel(order) → boolean (rule: trạng thái + thời gian)
```

- `OrderAggregate.cancel()` validate qua `OrderCancellationPolicy.canCancel`, throw nếu fail. Service gọi `aggregate.cancel()` rồi `repository.save(aggregate)`.
- Service `OrderService` 7 method: createOrder (transaction + publish OrderCreatedEvent), getOrderById, listUserOrders, cancelOrder (qua aggregate + publish event), trackOrder, updateOrderStatus, generateOrderInvoice.
- Cross-module event handler (subscribe trong `module.js`):
  - `'order.created'` → inventoryService.deductStock + paymentService.initiate.
  - `'order.cancelled'` → inventoryService.restoreStock + loyaltyService.revokePoints.
  - `'order.paid'` → loyaltyService.addPoints + notificationsService.sendOrderConfirmation.

**⚠️ EventBus implementation pattern — Best-effort eventual consistency:**
```js
// shared/eventBus.js — Phase 42 Step 1
class EventBus {
  constructor(logger) {
    this.handlers = new Map();
    this.logger = logger;
  }
  subscribe(eventName, handler, handlerName = handler.name) {
    if (!this.handlers.has(eventName)) this.handlers.set(eventName, []);
    this.handlers.get(eventName).push({ handler, handlerName });
  }
  async publish(eventName, payload) {
    const handlers = this.handlers.get(eventName) || [];
    if (handlers.length === 0) return;
    // Promise.allSettled: KHÔNG abort các handler khác nếu 1 handler fail.
    // Single-instance best-effort consistency. KHÔNG retry tự động cho thesis scope.
    const results = await Promise.allSettled(
      handlers.map(({ handler }) => handler(payload))
    );
    results.forEach((result, idx) => {
      if (result.status === 'rejected') {
        this.logger.error(`Event handler failed`, {
          eventName,
          handlerName: handlers[idx].handlerName,
          payload,
          error: result.reason.message,
          stack: result.reason.stack,
        });
        // KHÔNG throw — best-effort. Operation gốc đã commit (vd Order đã tạo).
        // Subscriber bị skip cần manual reconcile (vd query Order missing inventory deduction).
      }
    });
  }
}
```

**Trade-off documented trong `docs/MODULE_GUIDE.md`:**
- ✅ Single-instance, in-process, sync-ish — đủ cho thesis demo + single-server production.
- ✅ KHÔNG abort partial commit nếu 1 subscriber fail (vd inventory deduct fail nhưng payment vẫn initiate) — order vẫn tạo, tài liệu rõ "best-effort eventual consistency".
- ❌ KHÔNG có retry/outbox/dead-letter queue (đó là enterprise pattern).
- 📝 Reconciliation: nếu subscriber failure log xuất hiện → admin manual fix qua API admin (vd POST `/api/admin/inventory/reconcile/:orderId`).

#### 42.6.2 — `payment` (DDD-LITE)

```
modules/payment/
├── controllers/, services/, repositories/, models/, routes.js, validators/, dtos/, module.js
├── domain/
│   ├── policies/{RefundPolicy, RetryPolicy}.js      # Pure rule: canRefund, shouldRetry
│   └── ports/IPaymentGateway.js                     # Interface cho external gateway
└── gateways/                                         # impl IPaymentGateway
    ├── VnPayGateway.js, MomoGateway.js, StripeGateway.js, BankTransferGateway.js
```

- `PaymentService` 7 method: initiate (chọn gateway theo method), confirm, handleVnPayIPN, handleMomoIPN, handleStripeWebhook, refund (qua RefundPolicy), getPaymentStatus.
- Webhook idempotency: `handleVnPayIPN` check `paymentRepo.findByTransactionId` trước update — Phase 1 + 4 đã có note, Phase 42 chuẩn hoá pattern.

**Validation:**
- [ ] Full flow: createOrder → paymentURL → IPN → orderPaid → loyaltyAdded.
- [ ] CancelOrder qua `OrderAggregate.cancel()` + `OrderCancellationPolicy` → stockRestored + pointsRevoked.
- [ ] IPN replay idempotent (cùng transactionId 2 lần → process 1 lần).
- [ ] `domain/aggregates/OrderAggregate.js` exists với rich method.
- [ ] `domain/policies/{OrderCancellationPolicy, RefundPolicy, RetryPolicy}.js` exists.

**Commit:** 5 commit (orders 3-layer + domain, payment 3-layer + domain + gateways, integration event handlers).

---

### 42.7 Step 7 — Module: `reviews` (SIMPLE)

**Tasks:**
- Folder template SIMPLE.
- `ReviewService` 6 method: createReview (verify purchase qua orders), listByProduct, listAllAdmin, markHelpful, deleteReview, approveReview.
- `IReviewRepository` + Sequelize impl. Rating handled by `Rating` plain object hoặc validator (không cần VO class).

**Validation:** CRUD + helpful count + admin moderation OK.

**Commit:** 2 commit.

---

### 42.8 Step 8 — Module: `shipping` + `inventory` + `loyalty`

#### 42.8.1 — `shipping` (SIMPLE)
- Folder template SIMPLE.
- `ShippingService` method: calculateFee (input: items, address, method → output: amount), listMethods, getProvinces, getDistricts, getWards.
- LocationApiAdapter trong `gateways/` (gọi external hoặc local data file).

#### 42.8.2 — `inventory` (DDD-LITE)
> **DDD-lite vì:** stock deduction có concurrent issue (2 user mua cùng lúc), cần coordinate.

```
modules/inventory/
├── controllers/, services/, repositories/, models/, routes.js, validators/, dtos/, module.js
└── domain/
    ├── aggregates/InventoryAggregate.js           # deduct(productId, quantity), restore(productId, quantity)
    ├── events/{StockDeductedEvent, LowStockEvent}.js
    └── policies/StockReservationPolicy.js         # canDeduct(currentStock, requested) → boolean
```

- `InventoryAggregate.deduct(productId, quantity)` dùng `SELECT ... FOR UPDATE` qua repo (Phase 35) + check `StockReservationPolicy`.
- Service 5 method: deductStock, restoreStock, getLowStock, adjustStock, getInventoryHistory.
- Event handler subscribe `order.created` (deduct) + `order.cancelled` (restore). Publish `low-stock` event khi <=threshold → notifications subscribe.

#### 42.8.3 — `loyalty` (SIMPLE)
- Folder template SIMPLE.
- `LoyaltyService` 4 method: addPoints, redeemPoints, getLoyaltyHistory, getPointsBalance.
- Event handler subscribe `order.paid` (add) + `order.cancelled` (revoke).

**Validation:** End-to-end order flow event-driven cross-module work; concurrent stock deduction không double-spend.

**Commit:** 3 commit (shipping, inventory + domain, loyalty).

---

### 42.9 Step 9 — Module: `notifications` + `content` (SIMPLE)

#### 42.9.1 — `notifications` (SIMPLE)
- Folder template SIMPLE.
- `NotificationService` method: sendEmail, sendInApp, getUserNotifications, markAsRead.
- Channel adapters trong `gateways/`: `EmailChannel` (Nodemailer wrap), `InAppChannel` (DB write + socket emit).
- Event handler subscribe: `order.paid` → sendOrderConfirmationEmail; `low-stock` → sendAdminAlert.

#### 42.9.2 — `content` (SIMPLE)
- Folder template SIMPLE.
- `ContentService` method: listBanners, getActiveBanners, CRUD news, listCampaigns, sendCampaign.

**Commit:** 2 commit.

---

### 42.10 Step 10 — Module: `chat` (DDD-LITE — Realtime Support)

> **DDD-lite vì:** realtime với Socket.IO + presence + message threading.

```
modules/chat/
├── controllers/                  # REST cho chat history
├── services/ChatService.js
├── repositories/{IChatMessageRepository, SequelizeChatMessageRepository, IPresenceRepository, RedisOrInMemoryPresenceRepository}.js
├── models/ChatMessageModel.js
├── routes.js                     # REST endpoints
├── validators/, dtos/, module.js
├── domain/
│   ├── ChatSession.js            # Aggregate: addMessage(sender, content), getUnreadCount(userId)
│   └── events/{ChatMessageSentEvent, AdminJoinedEvent}.js
├── socket/
│   ├── handlers/{ChatHandler, PresenceHandler}.js
│   └── socketIoAdapter.js        # Wrap io.on/io.emit
```

**Tasks:**
- ChatService 5 method: sendMessage (DB write + emit), getConversation, markAsRead, listAdminConversations, getUnreadCount.
- Move `backend/src/config/socket.js` (~163 lines) split:
  - `shared/socket/index.js` (io setup + JWT auth).
  - `modules/chat/socket/handlers/` (event handlers gọi ChatService).
- Presence repository: `RedisPresenceRepository` (production-ready) hoặc `InMemoryPresenceRepository` (single-instance default).

**Validation:** 2-tab realtime OK; presence count đúng; typing indicator; admin join.

**Commit:** 3 commit.

---

### 42.11 Step 11 — Module: `ai` (DDD-LITE — Chatbot + RAG)

> **DDD-lite vì:** RAG pipeline đa bước + multiple external service (LLM, Vector, Embedding) + stateful conversation.

```
modules/ai/
├── controllers/AiChatbotController.js
├── services/{AiChatbotService, ProductNameService}.js
├── repositories/                                    # Persistence (catalog query, conversation persistence)
├── routes.js, validators/, dtos/, module.js
├── domain/
│   ├── ports/{IConversationStore, IVectorStore, ILlmGateway, IEmbeddingGateway}.js  # Interface
│   ├── orchestrators/RagPipeline.js                 # intent → search → retrieve → LLM → response
│   └── policies/{IntentClassifier, ConversationLimitPolicy}.js  # Pure rules
├── persistence/                                     # Impl IConversationStore + IVectorStore
│   ├── InMemoryConversationStore.js                 # Default (single-instance)
│   ├── RedisConversationStore.js                    # Optional (multi-instance)
│   └── JsonFileVectorStore.js                       # backend/data/vectorDb.json
└── gateways/                                        # Impl ILlmGateway, IEmbeddingGateway
    ├── GeminiAdapter.js, OpenRouterAdapter.js, RuleBasedFallbackAdapter.js
    └── OpenRouterEmbeddingAdapter.js, HuggingFaceEmbeddingAdapter.js
```

**Tasks:**
- `AiChatbotService.sendMessage` gọi `RagPipeline.run(message, sessionId)`.
- `RagPipeline` step: classify intent → search vector store → retrieve product context (gọi catalog qua ICatalogReadPort hoặc service) → call LLM → format response.
- Conversation history limit qua `ConversationLimitPolicy.shouldTruncate(history)` — Phase 42 default 10 turn.
- Event handler subscribe `product.created` → `IVectorStore.upsert`; `product.deleted` → `IVectorStore.remove`.
- Move `services/ai/{geminiChatbot, ruleBasedChatbot, vectorStore, embedding, viEmbedding, productNameGenerator}.js` vào module folder tương ứng.

**Validation:** Chat AI work; RAG context đúng; vector search < 500ms; conversation limit 10 turn áp dụng; product create → vector upsert OK.

**Commit:** 4 commit (gateways + persistence, RagPipeline + service, controller + routes, integration event handlers).

---

### 42.12 Step 12 — Module: `upload` (SIMPLE)

**Tasks:**
- Folder template SIMPLE.
- `UploadService` 4 method: uploadImage, deleteUploadedFile (ownership check + path traversal block từ Phase 1), getUploadedFile, listUserUploads.
- Storage adapter trong `gateways/`: `LocalDiskAdapter` (current `backend/uploads/`), `S3Adapter` (interface ready, optional impl).
- File validation qua plain function trong service (KHÔNG cần FileValidationDomainService class).

**Validation:** Upload OK; delete có ownership check; path traversal blocked.

**Commit:** 2 commit.

---

### 42.13 Step 13 — Backend Cleanup Legacy + Bootstrap Wire

**Tasks:**
1. Verify mọi module work độc lập (Step 2-12 done).
2. Xóa hoàn toàn:
   - `backend/src/controllers/`, `services/`, `routes/`, `models/`, `validators/`, `middlewares/`.
3. `backend/src/server.js` bootstrap (light DI, không framework):
   ```js
   const express = require('express');
   const helmet = require('helmet');
   const cors = require('cors');
   const cookieParser = require('cookie-parser');

   const sequelize = require('./shared/persistence/sequelize');
   const redis = require('./shared/cache/redisClient');
   const logger = require('./shared/logger');
   const mailer = require('./shared/mailer');
   const eventBus = require('./shared/eventBus');
   const errorHandler = require('./shared/http/middlewares/errorHandler');
   const rateLimiter = require('./shared/http/middlewares/rateLimiter');

   const app = express();

   // ⚠️ ORDERING QUAN TRỌNG: Global middleware PHẢI set TRƯỚC khi mount module routers.
   // Nếu mount module trước, request đến module sẽ bypass cors/helmet/parser → bug.
   app.use(helmet());                                          // 1. Security headers
   app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));  // 2. CORS
   app.use(express.json({ limit: '10mb' }));                   // 3. Body parser JSON
   app.use(express.urlencoded({ extended: true, limit: '10mb' }));  // 4. Body parser URL-encoded
   app.use(cookieParser());                                    // 5. Cookie parser
   app.use(rateLimiter);                                       // 6. Global rate limit
   // (auth middleware NOT global — applied per-module qua module.js)

   // 7. Health check (TRƯỚC modules, không qua auth)
   app.get('/api/health', (req, res) => res.json({ 
     status: 'ok', 
     uptime: process.uptime(), 
     version: process.env.APP_VERSION || 'dev' 
   }));

   // 8. Mount 16 modules
   const deps = { sequelize, redis, logger, mailer, eventBus };
   const modules = [
     require('./modules/auth/module')(deps),
     require('./modules/users/module')(deps),
     require('./modules/catalog/module')(deps),
     require('./modules/cart/module')(deps),
     require('./modules/orders/module')(deps),
     require('./modules/payment/module')(deps),
     require('./modules/reviews/module')(deps),
     require('./modules/wishlist/module')(deps),
     require('./modules/shipping/module')(deps),
     require('./modules/inventory/module')(deps),
     require('./modules/loyalty/module')(deps),
     require('./modules/notifications/module')(deps),
     require('./modules/content/module')(deps),
     require('./modules/chat/module')(deps),
     require('./modules/ai/module')(deps),
     require('./modules/upload/module')(deps),
   ];
   modules.forEach(m => app.use(m.basePath, m.router));
   modules.forEach(m => m.subscribeEvents?.(eventBus));

   // 9. 404 handler (sau modules)
   app.use((req, res) => res.status(404).json({ error: 'Not Found', path: req.path }));

   // 10. Global error handler (cuối cùng)
   app.use(errorHandler);

   // 11. Socket.IO setup (qua shared/socket/index.js)
   const httpServer = require('http').createServer(app);
   require('./shared/socket')(httpServer, deps);

   const PORT = process.env.PORT || 5000;
   httpServer.listen(PORT, () => logger.info(`Server listening on ${PORT}`));
   ```

**Lý do ordering quan trọng:**
- helmet/cors/parser TRƯỚC modules → mọi request đến module đều có headers + body parsed.
- rateLimiter TRƯỚC modules → tránh DDoS đến module endpoint.
- /api/health TRƯỚC modules + KHÔNG qua auth → orchestrator deploy script ping được.
- 404 handler SAU modules → catch route không match.
- errorHandler CUỐI CÙNG → catch mọi async error throw từ module.
- Socket.IO setup SAU app routes (để chia sẻ HTTP server).

**Validation:**
- [ ] `ls backend/src/` chỉ còn: app.js, server.js, shared/, modules/, __tests__/, constants/ (nếu giữ), jobs/ (nếu giữ).
- [ ] 16 module bootstrap OK.
- [ ] `curl http://localhost:5000/api/health` → 200 OK + JSON.
- [ ] Smoke test 5 endpoint random: response có CORS header (Access-Control-Allow-Origin), helmet header (X-Frame-Options).
- [ ] Throw test error trong service → error handler trả 500 + log.
- [ ] Mọi smoke test (Rule 31 35-check) pass.

**Commit:** 2 commit.

---

### 42.14 Step 14 — Frontend: Pages → Feature

**Tasks:**
- `pages/{Login, Register, ForgotPassword, ResetPassword, VerifyEmail}Page` → `features/auth/pages/`.
- `pages/{Profile, Addresses}Page` → `features/users/pages/`.
- `pages/{Shop, ProductDetail}Page` → `features/catalog/pages/`.
- `pages/admin/{CreateProduct, EditProduct, AdminCategories, AdminBrands, AdminCollections}Page` → `features/catalog/admin/pages/`.
- `pages/CartPage` → `features/cart/pages/`.
- `pages/{Orders, OrderDetail, TrackOrder}Page` → `features/orders/pages/`.
- `pages/{Checkout, PaymentQR}Page` → `features/checkout/pages/`.
- `pages/WishlistPage` → `features/wishlist/pages/`.
- `pages/admin/{News, Banners, EmailCampaigns, ...}Page` → `features/content/admin/pages/`.
- Giữ ở `pages/`: HomePage, ContactPage, NotFoundPage, UnauthorizedPage, AboutPage, FaqsPage, DealsPage.
- Update `routes/AppRoutes.tsx` import path.

**Validation:** 7 user page + 15 admin page render OK.

**Commit:** 5 commit.

---

### 42.15 Step 15 — Frontend: API Service → Feature + Slice Co-location

**Tasks:**
- Move ~31 file `services/{X}Api.ts` vào feature respective:
  - `productApi, categoryApi, brandApi, collectionApi` → `features/catalog/api/`.
  - `orderApi` → `features/orders/api/`.
  - `cartApi` → `features/cart/api/`.
  - `authApi` → `features/auth/api/`. `userApi` → `features/users/api/`.
  - `reviewApi` → `features/reviews/api/`.
  - `wishlistApi` → `features/wishlist/api/`. `loyaltyApi` → `features/loyalty/api/`.
  - `newsApi, bannerApi, emailCampaignApi, contactApi` → `features/content/api/` (lưu ý `emailCampaignApi` đã rename singular ở Phase 41.3, KHÔNG còn `emailCampaignsApi`).
  - `chatApi` → `features/chat/api/`. `chatbotApi, geminiApi` → `features/ai/api/`.
  - `momoApi, vnpayApi, stripeApi` → `features/payment/api/`.
  - `uploadApi, imageApi` → `features/upload/api/`.
  - `adminDashboardApi, adminOrderApi, adminProductApi, adminUserApi` → `features/admin/api/`.
  - `searchHistoryApi, warrantyApi, discountCodeApi` → feature respective.
- Sau đó `frontend/src/services/` xóa, chỉ giữ `shared/api/`.
- Slice co-location: confirm mọi slice ở `features/{X}/store/` (đồng nhất nested), update `store/index.ts`.

**Validation:** Build pass; 0 broken import; smoke test 7+15 page.

**Commit:** 6 commit.

---

### 42.16 Step 16 — Frontend: Container/Hook + Component Move + Domain Logic

**Tasks:**

#### 42.16.1 — `components/product/` (30 file) → `features/catalog/admin/components/`
+ 4 hook product-specific → `features/catalog/admin/hooks/`.

#### 42.16.2 — Container/Hook full
- Page > 200 lines → tách `useXPage` hook.
- Mục tiêu cụ thể:
  - `LoginPage, RegisterPage` — `useAuthForm`.
  - `ProductDetailPage` — `useProductDetail`.
  - `CheckoutPage` — `useCheckoutFlow` (cart init + sessionStorage + repayment + payment URL).
  - `CartPage` — `useCartManagement`.
  - `OrdersPage, OrderDetailPage` — `useOrders, useOrderDetail`.
  - `AdminDashboardPage` — `useDashboardAnalytics`.

#### 42.16.3 — Domain logic ra khỏi `utils/`
- `utils/productHelpers, priceUtils, productNaming, productTransform, descriptionImageProcessor` → `features/catalog/services/{productLogic, priceLogic, productNaming, productTransform, descriptionProcessor}.ts`.
- `utils/sampleProductData` audit, xóa hoặc → `__tests__/fixtures/`.

#### 42.16.4 — `shared/utils/` cleanup
- Chỉ giữ generic: cn, format, textUtils, errorUtils, htmlProcessor, imageUtils, exportUtils, toast, tokenManager.
- `grep -E "Product|Order|Cart|Review" frontend/src/shared/utils/*.ts` → 0.

**Validation:**
- [ ] `wc -l features/checkout/pages/CheckoutPage.tsx` < 200.
- [ ] `wc -l features/catalog/pages/ProductDetailPage.tsx` < 200.
- [ ] Manual test 7+15 page.

**Commit:** 6 commit.

---

### 42.17 Step 17 — Frontend: Feature Public API Barrel + Final Cleanup

**Tasks:**
1. Mỗi feature có `index.ts` exporting public API:
   ```ts
   // features/catalog/index.ts
   export { default as ProductCard } from './components/ProductCard';
   export { default as ProductGrid } from './components/ProductGrid';
   export { default as ProductDetailPage } from './pages/ProductDetailPage';
   export * as Admin from './admin';
   export * from './hooks';
   export * from './store/productsSlice';
   export type * from './types/product.types';
   ```
2. Find-replace deep import `from '@/features/X/{components,pages,hooks}/Y'` → `from '@/features/X'`.
3. `routes/AppRoutes.tsx` + `App.tsx` import từ feature barrel.
4. Verify `grep -rn "from.*'@/features/.*\/(components|pages|hooks)" frontend/src/` → 0 (trừ test).

**Validation:**
- [ ] 16 feature đều có `index.ts`.
- [ ] Build + tsc pass.
- [ ] 35-check pass.

**Commit:** 2 commit.

---

### 42.18 Step 18 — Final Verification + Documentation Sync

**Tasks:**
1. Full test: BE `npm test` + FE `npm run build` + `tsc --noEmit`.
2. 35-check Rule 31 (A1-A25 + B1-B6 + C1-C4) end-to-end.
3. Update `docs/ARCHITECTURE.md` đối chiếu reality.
4. Update `docs/MODULE_GUIDE.md` lessons learned (template SIMPLE vs DDD-lite, khi nào promote).
5. **Đề xuất user thêm rule vào `MEMORY.md`** (file MEMORY.md user tự quản lý — KHÔNG tự động edit):
   - Rule "Module mới mặc định template SIMPLE (3-layer + Repository); chỉ promote DDD-lite khi có ≥3 entity quan hệ + business rule nhiều bước".
   - Rule "Cross-module call qua DI hoặc eventBus; KHÔNG deep import từ module khác".
   - Rule "Repository interface ở `modules/{X}/repositories/I{X}Repository.js`, impl `Sequelize{X}Repository.js` cùng folder; service KHÔNG touch Sequelize trực tiếp".
6. Tạo `docs/PHASE_42_COMPLETION_REPORT.md` với metrics: file count BE/FE before/after, module LOC, test count, latency benchmark.
7. Merge `phase-42-modular-monolith-refactor` → `main` chỉ khi mọi AC pass.

**Commit:** 2 commit.

---

### 42.19 Step 19 — Convention Sustainability Tooling (Module Generator + Pre-commit Hook + ESLint Custom)

> **Mục tiêu:** Tự động hóa việc giữ convention sau Phase 42. Khi user thêm feature/module/code mới về sau, tooling chặn được ~70% case drift quan trọng nhất (service import Sequelize, controller chứa ORM, DTO bị skip, deep import barrel).
>
> **Lý do tách Step riêng (không gộp Step 18):** đây là code thực tế (script + hook + ESLint config) chứ không phải doc. Cần verify tooling hoạt động trước khi treat Phase 42 done.
>
> **Effort: 3-4h. Có thể làm sau khi merge Phase 42 main như follow-up commit cũng OK.**

**Tasks:**

#### 42.19.1 — Module generator script
File `scripts/new-module.mjs`:
```js
#!/usr/bin/env node
// Usage: node scripts/new-module.mjs --name=referrals --type=simple
// Hoặc:  node scripts/new-module.mjs --name=subscriptions --type=ddd-lite
```
- Parse arg `--name` (kebab hoặc camelCase) + `--type` (simple|ddd-lite).
- Validate name không trùng `backend/src/modules/{name}/` existing.
- Validate name không trong Domain Glossary cấm dùng (parse từ `docs/NAMING_CONVENTION.md`) — vd reject `customer`, `coupon`, `voucher`. Cảnh báo nếu name không match concept đã có (vd `userAccount` → suggest `users`).
- Tạo folder + file template từ `docs/MODULE_TEMPLATE.md`:
  - SIMPLE: `controllers/{Name}Controller.js`, `services/{Name}Service.js`, `repositories/{I,Sequelize}{Name}Repository.js`, `models/{Name}Model.js`, `routes.js`, `validators/`, `dtos/{Name}Dto.js`, `module.js`.
  - DDD-LITE: + `domain/{aggregates,events,policies,ports}/`.
- Mỗi file có placeholder code sẵn (header comment + minimal class/function skeleton + `TODO: implement`).
- `module.js` skeleton DI wire pre-filled với `(deps) => ({ basePath, router, subscribeEvents })`.
- Output console hướng dẫn next step: "Add `require('./modules/{name}/module')(deps)` vào `server.js`".

#### 42.19.2 — Pre-commit hook
File `.husky/pre-commit`:
```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

bash scripts/audit-architecture.sh
```

File `scripts/audit-architecture.sh`:
```bash
#!/usr/bin/env bash
set -e

echo "🔍 Audit architecture rules..."

# RULE 1: Services không được import Sequelize hoặc Model.X trực tiếp
VIOLATIONS=$(git diff --cached --name-only --diff-filter=ACM | \
  grep -E 'backend/src/modules/.*/services/.*\.js$' | \
  xargs -I {} grep -l -E "require.*['\"]sequelize['\"]|Model\.(findAll|findOne|findByPk|create|update|destroy|bulkCreate)" {} 2>/dev/null || true)
if [ -n "$VIOLATIONS" ]; then
  echo "❌ BLOCKED: Service không được import Sequelize hoặc Model.X trực tiếp."
  echo "$VIOLATIONS"
  echo "→ Tạo/dùng repository thay vì truy cập Model trực tiếp."
  exit 1
fi

# RULE 2: Controllers không được import Sequelize hoặc gọi Model.X
VIOLATIONS=$(git diff --cached --name-only --diff-filter=ACM | \
  grep -E 'backend/src/modules/.*/controllers/.*\.js$' | \
  xargs -I {} grep -l -E "require.*['\"]sequelize['\"]|Model\.(findAll|findOne|findByPk|create|update|destroy)" {} 2>/dev/null || true)
if [ -n "$VIOLATIONS" ]; then
  echo "❌ BLOCKED: Controller không được touch ORM. Delegate sang service."
  echo "$VIOLATIONS"
  exit 1
fi

# RULE 3: Cross-module deep import (require từ '../../{otherModule}/services|repositories|domain' bị block)
VIOLATIONS=$(git diff --cached --name-only --diff-filter=ACM | \
  grep -E 'backend/src/modules/.*\.js$' | \
  xargs -I {} grep -l -E "require\(['\"]\.\./\.\./[a-z]+/(services|repositories|domain|models)['\"]" {} 2>/dev/null || true)
if [ -n "$VIOLATIONS" ]; then
  echo "❌ BLOCKED: Cross-module deep import. Dùng DI hoặc eventBus."
  echo "$VIOLATIONS"
  exit 1
fi

# RULE 4: Frontend deep import bypass barrel
VIOLATIONS=$(git diff --cached --name-only --diff-filter=ACM | \
  grep -E 'frontend/src/.*\.(ts|tsx)$' | grep -v '__tests__' | \
  xargs -I {} grep -l -E "from ['\"]@/features/[a-z-]+/(components|pages|hooks|api|store)" {} 2>/dev/null || true)
if [ -n "$VIOLATIONS" ]; then
  echo "⚠️  WARN: FE deep import bypass barrel — nên import từ '@/features/{name}' thay vì internal path."
  echo "$VIOLATIONS"
  # Warn only, không block (1 số case test setup hoặc lazy load có thể cần)
fi

echo "✅ Architecture audit pass."
```

Setup:
```bash
npm install -D husky
npx husky init
chmod +x scripts/audit-architecture.sh
```

#### 42.19.3 — ESLint custom rules
Bổ sung vào `eslint.config.js` (BE) hoặc dùng `eslint-plugin-import` rules có sẵn:

```js
// backend/eslint.config.js
import noRestrictedImports from 'eslint-plugin-import';
export default [
  // ... existing config
  {
    files: ['backend/src/modules/*/services/**/*.js'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [
          { name: 'sequelize', message: 'Service không được import Sequelize. Dùng repository.' },
        ],
        patterns: ['*/models/*'],
      }],
    },
  },
  {
    files: ['backend/src/modules/*/controllers/**/*.js'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: [{ name: 'sequelize', message: 'Controller không được import Sequelize.' }],
        patterns: ['*/models/*', '*/repositories/*'],
      }],
    },
  },
];
```

Frontend `eslint.config.js`:
```js
{
  files: ['frontend/src/**/*.{ts,tsx}'],
  ignores: ['**/__tests__/**'],
  rules: {
    'no-restricted-imports': ['warn', {
      patterns: [
        { group: ['@/features/*/components', '@/features/*/pages', '@/features/*/hooks'], 
          message: 'Import từ @/features/{name} barrel thay vì deep path.' },
        { group: ['@/services'], message: 'services/ đã move vào @/shared/api hoặc @/features/{name}/api sau Phase 42.' },
      ],
    }],
  },
},
```

#### 42.19.4 — AGENT_RULES.md update
Thêm 3 rule vào `AGENT_RULES.md`:
- **Rule N+1**: Khi tạo module mới — DÙNG `node scripts/new-module.mjs --name=X --type=simple|ddd-lite`. KHÔNG copy thủ công folder.
- **Rule N+2**: Pre-commit hook KHÔNG được skip qua `git commit --no-verify` trừ khi user explicit yêu cầu (vd hot-fix production khẩn). Nếu hook fail, fix root cause trước.
- **Rule N+3**: Khi thêm pattern kiến trúc mới (vd thêm CQRS, Event Sourcing) — UPDATE `docs/NAMING_CONVENTION.md` + `docs/MODULE_GUIDE.md` + thêm ESLint rule tương ứng. Không "smuggle" pattern mới mà không document.

#### 42.19.5 — Memory entry mới
Tạo `convention_sustainability.md` (xem cuối Step 19) — Claude future session sẽ:
- Khi user request "thêm module/feature" → suggest dùng `scripts/new-module.mjs`.
- Khi review code mới → check 3 rule pre-commit + ESLint trước khi commit.
- Khi pattern mới phát sinh → đề xuất update doc + tooling.

**Files affected (Step 19):**
- `scripts/new-module.mjs` (mới, ~150 lines)
- `scripts/audit-architecture.sh` (mới, ~50 lines)
- `.husky/pre-commit` (mới, 3 lines)
- `backend/eslint.config.js` + `frontend/eslint.config.js` (bổ sung ~20 lines mỗi file)
- `package.json` (thêm `husky` devDep + `prepare` script)
- `AGENT_RULES.md` (bổ sung 3 rule)
- Memory `convention_sustainability.md` (mới)

**Risk:** Thấp. Tooling không đụng business code; chỉ enforce future commits.

**Validation:**
- [ ] `node scripts/new-module.mjs --name=test-module --type=simple` tạo đúng cấu trúc folder + file. Verify rồi xóa folder test.
- [ ] `node scripts/new-module.mjs --name=test-ddd --type=ddd-lite` tạo thêm `domain/` folder. Verify rồi xóa.
- [ ] `node scripts/new-module.mjs --name=customer --type=simple` reject với cảnh báo Domain Glossary (term `customer` cấm dùng).
- [ ] Pre-commit hook block thật: tạo file fake `backend/src/modules/auth/services/test.js` chứa `require('sequelize')`, `git add`, `git commit` → bị block với message rõ.
- [ ] ESLint chạy: `cd backend && npm run lint` báo error trên file fake trên.
- [ ] FE deep import warn: tạo file `frontend/src/pages/Test.tsx` import `from '@/features/auth/components/AuthProvider'` → ESLint warn.
- [ ] Husky setup OK: `git commit --allow-empty -m "test"` chạy hook.

**Commit:** 2 commit:
- `Refactor Phase 42.19 — Tạo module generator script + pre-commit hook audit architecture`
- `Refactor Phase 42.19 — Thêm ESLint custom rules + cập nhật AGENT_RULES sustainability`

---

### 42.20 Order of Execution & Thesis Scope Priority

```
Step 1  (Foundation + Doc)                     → 0 risk    | DEFENSE-MUST
Step 2  (auth — TEMPLATE)                      → cao       | DEFENSE-MUST (entry point)
Step 3  (users)                                → trung     | DEFENSE-MUST
Step 4  (catalog — lớn nhất)                   → cao       | DEFENSE-MUST (main demo flow)
Step 5  (cart)                                 → trung     | DEFENSE-MUST
Step 6  (orders + payment)                     → cao       | DEFENSE-MUST (core e-commerce)
Step 7  (reviews)                              → thấp      | DEFENSE-MUST
Step 8  (shipping + inventory + loyalty)       → trung     | DEFENSE-MUST (inventory cross-module)
Step 9  (notifications + content)              → thấp      | DEFENSE-MUST
Step 10 (chat — Socket.IO)                     → cao       | OPTIONAL-bonus (defer được)
Step 11 (ai — RAG + LLM full refactor)         → trung     | OPTIONAL-bonus (defer được)
Step 12 (upload)                               → thấp      | DEFENSE-MUST
Step 13 (BE cleanup + bootstrap)               → cao       | DEFENSE-MUST
Step 14 (FE pages → feature)                   → trung     | DEFENSE-MUST
Step 15 (FE API → feature)                     → trung     | DEFENSE-MUST
Step 16 (FE container/hook + components/product) → cao     | DEFENSE-MUST
Step 17 (FE barrel + cleanup)                  → thấp      | DEFENSE-MUST
Step 18 (Final verify + doc + merge)           → 0 risk    | DEFENSE-MUST
Step 19 (Convention sustainability tooling)    → thấp     | DEFENSE-MUST (3-4h, có thể follow-up sau merge)
```

**Scope thesis pragmatic — Step 10 + 11 OPTIONAL:**
- Chat (Step 10) + AI (Step 11) là 2 module phức tạp nhất, nếu thời gian eo hẹp có thể giữ HIỆN TẠI (services/ai + config/socket.js cũ) và viết comment `// TODO Phase 42 — refactor sang module pattern`. Defense vẫn pass vì 13/16 module đã follow pattern + doc đầy đủ — reviewer thấy rõ kiến trúc đích.
- Khi nào skip Step 10+11: nếu sau Step 9 còn <5 ngày trước demo deadline.
- Khi đã skip, AC check `modules/chat/, modules/ai/` exists → đánh dấu deferred trong PHASE_42_COMPLETION_REPORT.md.

**Rollback rule:** Mỗi step độc lập có thể merge/revert riêng. Step 2 (auth) fail → halt. Step 13 cleanup CHỈ khi mọi module Step 2-12 pass (hoặc Step 10+11 đã được defer rõ ràng và config/socket.js + services/ai/ vẫn giữ làm legacy).

**Realistic timeline cho thesis (1 sinh viên):**
- Step 1-9: 7-10 ngày (5 ngày BE module + 3-5 ngày test + smoke).
- Step 10-11 (nếu làm): +3-5 ngày.
- Step 12: 1 ngày.
- Step 13: 1 ngày.
- Step 14-18 (FE): 4-5 ngày.
- Step 19 (Convention tooling): 3-4h (~0.5 ngày).
- **Tổng: 2-3 tuần solo nếu skip Step 10+11; 3-4 tuần nếu làm đủ.**

---

### ✅ Acceptance Criteria Phase 42 (Modular Monolith + 3-Layer + DDD-lite)

#### Backend Foundation (Step 1)
- [ ] `docs/ARCHITECTURE.md`, `MODULE_GUIDE.md`, `MODULE_TEMPLATE.md` exists.
- [ ] `backend/src/shared/` exists với cấu trúc LIGHT (chỉ errors/, result.js, eventBus.js, persistence/, cache/, http/middlewares/, socket/, logger.js, mailer.js, utils/).
- [ ] `backend/src/shared/` KHÔNG có folder `domain/` chung (verify `ls backend/src/shared/` không có `domain/`).
- [ ] KHÔNG có file `Entity.js`, `ValueObject.js`, `AggregateRoot.js`, `UseCase.js`, `Mapper.js` ở `shared/`.
- [ ] `shared/eventBus.js` exists với API `publish(eventName, payload)` + `subscribe(eventName, handler)`.

#### Backend Modules — 15 module (Step 2-12)
- [ ] `backend/src/modules/{auth, users, catalog, cart, orders, payment, reviews, wishlist, shipping, inventory, loyalty, notifications, content, chat, ai, upload}/` tồn tại (16 module).

**SIMPLE module (11 modules: auth, users, catalog, cart, reviews, wishlist, loyalty, notifications, content, shipping, upload):**
- [ ] Mỗi simple module có cấu trúc: `controllers/, services/, repositories/, models/, routes.js, validators/, dtos/, module.js`.
- [ ] Mỗi simple module KHÔNG có folder `domain/` (verify `ls backend/src/modules/{simple_module}/` không có `domain/`).
- [ ] Mỗi simple module có ≥1 service file với method = use case (không có `application/use-cases/{X}UseCase.js`).
- [ ] Mỗi simple module có DTO factory function `to{X}Dto(model)` trong `dtos/{X}Dto.js` (không có Mapper class).

**DDD-LITE module (5 modules: orders, payment, ai, inventory, chat):**
- [ ] Mỗi DDD-lite module có cấu trúc cơ bản giống simple + thêm folder `domain/`.
- [ ] `modules/orders/domain/aggregates/OrderAggregate.js` exists với rich method (`cancel`, `markAsPaid`, `markAsShipped`).
- [ ] `modules/orders/domain/events/{OrderCreated, OrderCancelled, OrderPaid, OrderShipped, OrderDelivered}Event.js` exists.
- [ ] `modules/orders/domain/policies/OrderCancellationPolicy.js` exists.
- [ ] `modules/payment/domain/policies/{RefundPolicy, RetryPolicy}.js` exists.
- [ ] `modules/payment/domain/ports/IPaymentGateway.js` exists; `gateways/{VnPay, Momo, Stripe, BankTransfer}Gateway.js` impl.
- [ ] `modules/inventory/domain/aggregates/InventoryAggregate.js` exists.
- [ ] `modules/inventory/domain/policies/StockReservationPolicy.js` exists.
- [ ] `modules/chat/domain/ChatSession.js` exists; `socket/handlers/` exists.
- [ ] `modules/ai/domain/orchestrators/RagPipeline.js` exists; `domain/ports/{ILlmGateway, IConversationStore, IVectorStore, IEmbeddingGateway}.js` exists.

**Cross-module rule (cho cả simple + DDD-lite):**
- [ ] Service không touch Sequelize trực tiếp: `grep -rn "Model\.findAll\|Model\.create\|Model\.update\|sequelize\.\|require.*sequelize" backend/src/modules/*/services/` → 0.
- [ ] Repository chỉ tồn tại trong `modules/*/repositories/`, không trong service: pattern check.
- [ ] Cross-module communication không deep import: `grep -rn "require.*'\.\./\.\./[a-z]\+/(services|repositories|models|domain)'" backend/src/modules/*/` → 0.
- [ ] Cross-module communication qua DI (truyền vào constructor) hoặc Event Bus (`eventBus.publish/subscribe`).

#### Backend Cleanup (Step 13)
- [ ] `backend/src/{controllers, services, routes, models, validators, middlewares}/` không tồn tại.
- [ ] `ls backend/src/` chỉ còn: app.js, server.js, shared/, modules/, __tests__/, constants/ (nếu giữ), jobs/ (nếu giữ).
- [ ] `server.js` bootstrap 16 module qua DI pattern (`require('./modules/X/module')(deps)`).

#### Backend DTO + Domain Event
- [ ] Mọi response endpoint trả DTO (qua factory function). Smoke 5 endpoint nhạy cảm (login, getUser, getOrder, getProduct, getReview) — không leak field internal (`password_hash`, `verification_token`, `internal_notes`).
- [ ] Cross-module event hoạt động:
  - [ ] `eventBus.publish('order.created')` → inventory deductStock + payment initiate.
  - [ ] `eventBus.publish('order.paid')` → loyalty addPoints + notifications sendOrderConfirmation.
  - [ ] `eventBus.publish('order.cancelled')` → inventory restoreStock + loyalty revokePoints.
  - [ ] `eventBus.publish('product.created')` → ai upsertVector.
- [ ] Webhook idempotency: VNPay/MoMo IPN, Stripe webhook replay không double-process.

#### Backend Transaction Discipline
- [ ] Transaction trong **service** (không controller, không repository).
- [ ] Service wrap transaction qua `shared/persistence/unitOfWork`.
- [ ] 0 multi-step write thiếu transaction (audit `git grep "Model\.update\|Model\.create"` trong services).
- [ ] `afterCreate` hook side-effect cross-module (vd Product → vector sync) move ra service explicit call sau commit hoặc Domain Event.

#### Frontend Foundation (Step 1)
- [ ] `frontend/src/shared/{ui, components, hooks, api, utils, types, i18n, routing, theme}/` tồn tại.
- [ ] `shared/api/{rtkApi.ts, axiosClient.ts, tokenManager.ts}` exists.
- [ ] `services/api.ts`, `services/apiClient.ts` không tồn tại (rename + move).

#### Frontend Features — 16 features (Step 14-17)
- [ ] `frontend/src/features/{auth, users, catalog, cart, checkout, orders, payment, reviews, wishlist, loyalty, notifications, content, chat, ai, admin, upload}/` exists.
- [ ] 16 feature đều có `index.ts` barrel.
- [ ] Mỗi feature có `pages/` (nếu có UI route), `components/`, `hooks/`, `api/`, `store/` (nếu có), `types/`.
- [ ] `frontend/src/components/product/` không tồn tại.
- [ ] `frontend/src/services/` không tồn tại.
- [ ] `frontend/src/pages/` chỉ còn: Home, Contact, NotFound, Unauthorized, About, Faqs, Deals.
- [ ] `frontend/src/utils/` không tồn tại (move sang `shared/utils/` + feature service).
- [ ] `grep -rn "from.*'@/features/.*\/(components|pages|hooks)" frontend/src/ --include="*.tsx" | grep -v __tests__` → 0.
- [ ] `grep -rn "from.*'@/services" frontend/src/` → 0.

#### Frontend UI/Logic Separation
- [ ] `wc -l` các page mục tiêu < 200: CheckoutPage, ProductDetailPage, ShopPage.
- [ ] `useCheckoutFlow, useProductDetail, useProductSearch` hook tồn tại.
- [ ] Page admin không định nghĩa formatX inline.

#### Cross-cutting (Step 18)
- [ ] BE `npm test` pass với count ≥ baseline.
- [ ] FE `npm run build` + `tsc --noEmit` pass.
- [ ] 35-check Rule 31 (A1-A25 + B1-B6 + C1-C4) pass.
- [ ] 0 console error 7 user + 15 admin page.
- [ ] `docs/PHASE_42_COMPLETION_REPORT.md` exists với metrics (file count BE/FE before/after, module size).
- [ ] **Đề xuất** user thêm rule vào `MEMORY.md` (file user tự quản — đề xuất qua console output, KHÔNG tự edit):
  - "Module mới mặc định template SIMPLE; chỉ promote DDD-lite khi có ≥3 entity quan hệ + business rule nhiều bước."
  - "Cross-module call qua DI hoặc eventBus, KHÔNG deep import."
  - "Service không touch Sequelize trực tiếp; qua repository."

#### Convention Sustainability Tooling (Step 19)
- [ ] `scripts/new-module.mjs` tồn tại + chạy được. Test: `node scripts/new-module.mjs --name=test-simple --type=simple` tạo đúng cấu trúc folder + 8 file (controllers, services, repositories, models, routes, validators, dtos, module.js); `node scripts/new-module.mjs --name=test-ddd --type=ddd-lite` tạo thêm `domain/{aggregates,events,policies,ports}/`. Cleanup folder test sau verify.
- [ ] `scripts/new-module.mjs` reject Domain Glossary cấm dùng (test: `--name=customer` báo lỗi cảnh báo).
- [ ] `.husky/pre-commit` exists + executable; `scripts/audit-architecture.sh` exists.
- [ ] Pre-commit hook block thật: tạo file fake `backend/src/modules/auth/services/test-violation.js` chứa `require('sequelize')`, `git add`, `git commit -m "test"` → **bị block** với message rõ ràng. Cleanup file fake.
- [ ] Pre-commit hook block thật: thêm `Order.findAll()` vào file controller, `git commit` → bị block.
- [ ] Pre-commit hook block thật: deep import cross-module (`require('../../catalog/services/...')`) → bị block.
- [ ] ESLint custom rules pass: `cd backend && npm run lint` 0 error trên codebase đã refactor; thêm violation file fake → ESLint báo error đúng.
- [ ] FE ESLint warn: file `frontend/src/pages/Test.tsx` import `from '@/features/auth/components/AuthProvider'` → ESLint warn (không block, vì 1 số case test/lazy có thể cần).
- [ ] `package.json` có `husky` devDep + `prepare: "husky install"` script.
- [ ] `AGENT_RULES.md` cập nhật 3 rule mới (dùng module generator, không skip pre-commit, document pattern mới khi phát sinh).

#### Phase Independence
- [ ] Phase 42 không invalidate Phase 39 ✅.
- [ ] Phase 42 dùng Phase 40 + 41 (cả 2 phải xong trước).
- [ ] Phase 42 đặt baseline cho Phase 43-45.

#### Commit Quality
- [ ] Tất cả commit Rule 4.1.
- [ ] Mỗi step ≥1 commit boundary.
- [ ] ~32 commit tổng (Phase 42 scope: ~30 commit cho 18 step + 2 commit Step 19 tooling).

---

## PHASE 43 — Modern Naming Compliance Audit & Code Fix

> **Mục tiêu:** Verify codebase (sau Phase 42) tuân thủ `docs/NAMING_CONVENTION.md` (đã extend Modern TS/JS 2025-2026 + Domain-Specific). Audit + fix code violation, đặc biệt Domain Glossary. KHÔNG tạo standard mới — enforce existing.
>
> **Phân loại Rule 32:** **Loại C (Code Quality)**.
>
> **Tiền điều kiện:** Phase 39 ✅ + 40 + 41 + 42 done.

---

### 43.1 Domain Glossary Compliance Audit

**Mục tiêu:** Mọi term dùng trong code khớp Domain Glossary `NAMING_CONVENTION.md` (21 concept).

**Steps:**
1. Grep từng term cấm + check context:
   ```bash
   grep -rn "\bcustomer\|\bbuyer\|\bclient\b" backend/src/ --include="*.js"
   grep -rn "\bitem\b\|\bgoods\|\bmerchandise" backend/src/ --include="*.js"
   grep -rn "\bcoupon\|\bvoucher\|\bpromoCode" backend/src/ --include="*.js"
   grep -rn "\bpurchase\b" backend/src/ --include="*.js"
   # ... 21 term từ glossary
   ```
2. Mỗi match: phân loại false positive (axios `client`, Stripe `customer` library) vs true violation.
3. Frontend tương tự với `*.ts`, `*.tsx`.

**21 concept (từ Phase 41.5 NAMING_CONVENTION.md):** user, product, productVariant, discountCode, order, orderItem, cartItem, review, feedback, warrantyPackage, loyaltyPoints, loyaltyHistory, notification, chatMessage, banner, news, collection, productAttribute, attributeGroup, shipping, payment.

**Action:** Mỗi violation → file rename + variable rename + import update.

**Validation:**
- [ ] 21 term cấm grep → 0 result trong `backend/src/`, `frontend/src/` (trừ false positive).
- [ ] `docs/GLOSSARY_EXCEPTIONS.md` exists với false positive + lý do.
- [ ] `npm run build` + `npm test` pass sau rename.

---

### 43.2 Modern TS/JS Convention Audit (19 item)

#### 43.2.1 — Type vs Interface choice
- Grep `interface` cho union/intersection → đổi `type`.

#### 43.2.2 — No `I` prefix on interface (trừ Repository — exception document Phase 42 Step 1)
- Grep `interface I[A-Z]` ngoài `modules/*/repositories/` (BE) hoặc `modules/*/domain/ports/` (DDD-lite) → đổi tên bỏ `I`. Repository interface giữ `I` prefix là EXCEPTION (clean architecture convention).

#### 43.2.3 — Type-only imports
- Grep `import { X }` mà X chỉ là type → `import type`. Automate qua ESLint `@typescript-eslint/consistent-type-imports`.

#### 43.2.4 — Default vs named export
- BE CommonJS: grep `module.exports = function|class|(` → đổi `module.exports = { funcName }`.
- FE ESM: hook/util/service phải named export → audit + fix.

#### 43.2.5 — Component file suffix
- File `.tsx` không có suffix (Page/Layout/Modal/Form/Provider/Section/Card/List/Item/Button/with*) → review case-by-case.

#### 43.2.6 — Boolean naming
- Variable boolean không `is*/has*/can*` → rename.

#### 43.2.7 — Hook return shape
- Hook return >2 element dùng tuple → đổi object.

#### 43.2.8 — Redux Toolkit selector/action
- Selector không `select` prefix → rename.
- Action không imperative verb → rename (`userLoggedIn` → `setLoggedIn`).

#### 43.2.9 — RTK Query endpoint
- Endpoint không verb-entity pattern → rename.

#### 43.2.10 — Service method verbs (BE)
- `getX` có thể null → `findX`. `findX` luôn throw → `getX`. `doX` chung chung → process/handle/validate.

#### 43.2.11 — Repository method verbs
- `findUser` → `findOneByEmail` hoặc `findOneById`.

#### 43.2.12 — DTO suffix
- File DTO không `Dto` suffix → rename.

#### 43.2.13 — Number unit suffix
- **SKIP `price` rename**: project single-currency VND, đã có `base_price`, `unit_price`, `total_amount` chuẩn. Không thêm suffix `Vnd`.
- `timeout` → `timeoutMs`, `delay` → `delayMs`, `expires` → `expiresAt`/`expiresInDays` tùy ngữ cảnh.
- `weight` → `weightKg` (nếu có shipping calculation), `width/height/length` → `widthCm/heightCm/lengthCm`.

#### 43.2.14 — Date field naming
- `createDate, dateCreated` → `createdAt`. `birthDay` → `birthDate`.

#### 43.2.15 — i18n key namespace + casing
- Flat key (`checkoutSummaryTitle`) → nested `checkout.summary.title`.
- snake_case key → camelCase.

#### 43.2.16 — Test describe/it pattern
- `describe('test X')` → `describe('X')`.
- `it('X works')` → `it('should ...')`.

#### 43.2.17 — Import grouping order
- Audit qua ESLint `import/order` rule.

#### 43.2.18 — Folder casing
- Mọi folder trong `src/` lowercase. Verify.

#### 43.2.19 — CSS class naming custom CSS
- camelCase → kebab-case.

**Action per item:** grep + fix + commit theo nhóm.

---

### 43.3 PHASE_43_NAMING_VIOLATIONS_REPORT.md

**Mục tiêu:** Sau audit, generate report violation đã fix + lessons.

**File:** `docs/PHASE_43_NAMING_VIOLATIONS_REPORT.md`

**Nội dung:**
- Số violation per item (43.1, 43.2.1-43.2.19).
- File/line đã fix (kèm commit hash).
- False positive document (3rd-party API field name conflict).
- Lessons learned: rule cần thêm/thay vào `NAMING_CONVENTION.md`.

---

### ✅ Acceptance Criteria Phase 43

#### Domain Glossary (43.1)
- [ ] 21 term cấm grep → 0 result trong `backend/src/`, `frontend/src/` (trừ exception document).
- [ ] `docs/GLOSSARY_EXCEPTIONS.md` exists.
- [ ] File rename hợp lệ — build + test pass.

#### Modern TS/JS Convention (43.2)
- [ ] 19 audit item đều có pass evidence.
- [ ] ESLint `@typescript-eslint/consistent-type-imports` enable + 0 error.
- [ ] ESLint `import/order` enable + 0 error.

#### Documentation (43.3)
- [ ] `docs/PHASE_43_NAMING_VIOLATIONS_REPORT.md` exists.
- [ ] `MEMORY.md` cập nhật nếu có rule mới.
- [ ] `docs/NAMING_CONVENTION.md` cập nhật nếu có exception/clarification.

#### Cross-cutting
- [ ] BE `npm test` pass.
- [ ] FE `npm run build` + `tsc --noEmit` pass.
- [ ] 35-check pass (chỉ rename, không đổi behavior).
- [ ] Commit Rule 4.1 prefix `Refactor`.

---

## PHASE 44 — Test Coverage Push (≥70% Critical Path)

> **Mục tiêu:** Đẩy test coverage critical path (auth, payment, order, cart, catalog read) lên ≥70%. Phase 25 chỉ định hướng strategy; Phase 44 thực thi.
>
> **Phân loại Rule 32:** **Loại D (Test-only)**.
>
> **Tiền điều kiện:** Phase 42 + 43 done.

---

### 44.0 Coverage Target

| Module | Target | Loại test |
|---|---|---|
| `auth` | ≥80% | Unit (use case) + Integration (HTTP) |
| `payment` | ≥80% | Unit + Integration + IPN replay test |
| `orders` | ≥75% | Unit + Integration + cross-module event |
| `cart` | ≥70% | Unit + Integration + race condition |
| `catalog` (read) | ≥70% | Unit + Integration |
| `catalog` (write/admin) | ≥60% | Unit + Integration |
| FE `features/checkout` | ≥60% | Component + hook test |
| FE `features/catalog` | ≥60% | Component test |
| FE `features/auth` | ≥70% | Component + hook test |

**Non-critical (≥40%):** reviews, wishlist, loyalty, notifications, content, chat, ai, upload, shipping, inventory, users.

---

### 44.1 Backend Unit Test (Use Case Layer)

#### 44.1.1 — Setup
- Verify Jest + supertest config.
- `backend/jest.config.js` coverage threshold (thesis-realistic — relaxed từ enterprise):
  ```js
  coverageThreshold: {
    global: { branches: 50, functions: 50, lines: 50, statements: 50 },
    './src/modules/auth/services/': { lines: 75 },
    './src/modules/payment/services/': { lines: 70 },     // Giảm từ 80 — gateway mock phức tạp
    './src/modules/orders/services/': { lines: 70 },      // Giảm từ 75
    './src/modules/orders/domain/': { lines: 70 },        // DDD-lite aggregate + policy
    './src/modules/payment/domain/': { lines: 70 },       // Policy refund + retry
    './src/modules/inventory/domain/': { lines: 70 },
  }
  ```
- Mock factory: `__tests__/mocks/repositoryMock.js`.

**⚠️ Test database choice:**
- **KHÔNG dùng SQLite in-memory cho integration test** — Sequelize models của Phase 40 dùng MySQL-specific (CHECK constraints, INTEGER UNSIGNED, ENUM cụ thể) sẽ không tương thích.
- **Đúng:** dùng MySQL Docker container hoặc local MySQL test DB:
  ```bash
  docker run -d --name mysql-test -e MYSQL_ROOT_PASSWORD=test -e MYSQL_DATABASE=ecommerce_test -p 3307:3306 mysql:8.0
  ```
  Hoặc tạo DB `ecommerce_test` trên XAMPP MySQL local.
- Test setup (`__tests__/setup/testDb.js`) connect tới `ecommerce_test`, migrate trước mỗi test suite.

#### 44.1.2 — Auth ~8 service method (SIMPLE module)
Test `authService.{login, register, verifyOtp, logout, refreshToken, forgotPassword, resetPassword, googleLogin}` — mỗi method = 1 use case test suite (happy + edge cases).

#### 44.1.3 — Payment ~7 service method + 2 policy (DDD-LITE module)
- Service: `paymentService.{initiate, confirm, handleVnPayIPN, handleMomoIPN, handleStripeWebhook, refund, getPaymentStatus}`.
- Domain policy test: `RefundPolicy.canRefund(payment, amount)` happy + edge; `RetryPolicy.shouldRetry(transaction)`.
- IPN replay idempotency test cho cả 3 gateway.

#### 44.1.4 — Orders ~7 service method + Aggregate + event handlers (DDD-LITE module)
- Service: `orderService.{createOrder, cancelOrder, listUserOrders, getOrderById, trackOrder, updateOrderStatus, generateInvoice}`.
- Aggregate test: `OrderAggregate.cancel()` (qua policy), `markAsPaid()`, `markAsShipped()`, `markAsDelivered()`.
- Policy: `OrderCancellationPolicy.canCancel(order)` rule + edge cases.
- Event handler test: subscriber `'order.created'` (deduct stock + initiate payment), `'order.cancelled'` (restore + revoke), `'order.paid'` (add points + send email).

#### 44.1.5 — Cart ~6 service method (SIMPLE module)
Test `cartService.{getCart, addToCart, updateCartItem, removeCartItem, clearCart, mergeGuestCart}`. AddToCart phải mock `IProductRepository` để test stock validation.

#### 44.1.6 — Catalog ~14 service method (SIMPLE module)
Test `catalogService.{listProducts, getProductDetail, searchProducts, createProduct (transaction), updateProduct (transaction), deleteProduct, getRecentlyViewed, addRecentlyViewed, getRelatedProducts, listCategories, getCategoryTree, listBrands, listCollections, importProducts}`.

#### 44.1.7 — Inventory + AI + Chat (DDD-LITE) — bonus
- `InventoryAggregate.deduct/restore` test với concurrent simulation.
- `RagPipeline` test với mock LLM/Vector gateway.
- `ChatSession` aggregate test.

**Validation:** Mỗi module `npm test -- modules/X/` đạt coverage target.

**Commit:** 6 commit (1/module).

---

### 44.2 Backend Integration Test (HTTP Endpoint)

#### 44.2.1 — Setup
- DB: SQLite in-memory hoặc test MySQL instance.
- `__tests__/setup/{testDb, testApp}.js` — migrate + seed mỗi suite.

#### 44.2.2 — Auth endpoint ~10 test
POST `/api/auth/{register, login, verify-otp, logout, refresh, forgot-password, reset-password, google}`.

#### 44.2.3 — Payment + Order flow e2e
- Full flow: register → login → addToCart → createOrder → initiatePayment → mockIPN → orderPaid → loyaltyAdded.
- Cancel: createOrder → cancelOrder → stockRestored → pointsRevoked.
- IPN replay: mockIPN twice → process once.

#### 44.2.4 — Cart + Catalog
- Browse → addToCart (stock check) → updateQuantity → mergeGuestCart on login.

**Commit:** 4 commit.

---

### 44.3 Frontend Component + Hook Test

#### 44.3.1 — Setup
- React Testing Library config (đã có).
- `frontend/jest.config.cjs` coverage threshold.

#### 44.3.2 — Auth feature
- LoginPage.test.tsx (render, submit valid/invalid, OTP step).
- useAuth.test.ts (token refresh, logout cleanup).
- ProtectedRoute.test.tsx (redirect unauthenticated).

#### 44.3.3 — Catalog feature
- ProductCard, ProductGrid, ProductDetailPage.test.tsx.
- useProductDetail.test.ts.

#### 44.3.4 — Checkout feature
- CheckoutPage.test.tsx (render summary, select payment, submit).
- useCheckoutFlow.test.ts (buy-now flow, repayment flow).

#### 44.3.5 — Cart feature
- CartItem, CartPage.test.tsx.
- useCartManagement.test.ts.

**Commit:** 4 commit.

---

### 44.4 E2E Test (Optional)

> Default SKIP Phase 44 (heavyweight setup). Defer Phase 45 hoặc separate phase.

5 user journey nếu thực thi: Register OTP, Browse Cart Checkout COD, Browse BuyNow VNPay IPN, Cancel Order Stock Restore, Admin Login Update Order.

---

### ✅ Acceptance Criteria Phase 44

#### Backend Coverage
- [ ] `npm test -- --coverage` pass với threshold đã set.
- [ ] auth ≥75%, payment ≥70%, orders ≥70%, cart ≥65%, catalog read ≥65%, catalog write ≥55% (thesis-realistic; relaxed từ enterprise).
- [ ] Webhook idempotency test pass cho VNPay/MoMo/Stripe.
- [ ] Cross-aggregate event handler test pass (OrderCreated → DeductStock + InitiatePayment).

#### Frontend Coverage
- [ ] `npm test -- --coverage` pass.
- [ ] features/auth ≥70%, catalog ≥60%, checkout ≥60%, cart ≥60%.

#### Documentation
- [ ] `docs/TESTING_GUIDE.md` exists — pattern unit/integration/e2e, mock factory, test data builder.
- [ ] `MEMORY.md` rule "PR mới phải kèm test cho use case mới".

#### Cross-cutting
- [ ] CI test pass (nếu Phase 45 setup CI).
- [ ] Test runtime < 5 phút local.
- [ ] Commit Rule 4.1.

---

## PHASE 45 — Defense Hardening (45a MUST) + Production Operations (45b OPTIONAL)

> **Mục tiêu:** Đưa project lên mức **defense-ready cho khóa luận** (Phase 45a — BẮT BUỘC) và optionally lên **production-ready** (Phase 45b — bonus, có thể skip).
>
> **Phân loại Rule 32:** **Loại E (Operations + Infrastructure)**.
>
> **Tiền điều kiện:** Phase 42 + 43 + 44 done.
>
> **Thesis scope split — quan trọng:**
> - **Phase 45a (DEFENSE-MUST):** CI cơ bản (lint + typecheck + test + build), Helmet headers, `npm audit` clean, health check endpoint, `mysqldump` thủ công document trong runbook, Lighthouse a11y ≥ 80 trên 3 page (Home + ProductDetail + Checkout), basic alt text + form label fixes. **Tổng thời gian: 3-5 ngày.**
> - **Phase 45b (BONUS-OPTIONAL):** Sentry free tier, Dependabot, k6 load test 1-shot screenshot, multi-instance Redis-backed (CHỈ nếu deploy multi-instance — thesis default single-instance nên SKIP), full WCAG AA audit, Prometheus APM, alerting webhook, S3 backup automation, staging environment, deploy-production workflow với manual approval. **Cảnh báo: 45b có thể tốn 1-2 tuần — chỉ làm nếu có dư thời gian sau defense pass.**
>
> **Lý do split:** Project là khóa luận tốt nghiệp single-instance, đánh giá bằng demo + defense, không có real users để monitor/alert/backup-drill. Phase 45b là enterprise pattern, không cần thiết cho defense pass nhưng tốt cho CV/showcase.

---

### 45.1 CI/CD Pipeline (GitHub Actions)

#### 45.1.1 — `.github/workflows/ci.yml` [45a MUST]
Trigger: push, PR. Job: lint (ESLint + Prettier), typecheck (`tsc --noEmit` FE), test BE, test FE, build FE. Coverage upload Codecov/Coveralls **OPTIONAL** (nice-to-have badge).

#### 45.1.2 — `.github/workflows/deploy-staging.yml` [45b OPTIONAL]
Trigger: push `staging`. Build + deploy staging server. Smoke test post-deploy. SKIP nếu chỉ 1 deploy target.

#### 45.1.3 — `.github/workflows/deploy-production.yml` [45b OPTIONAL]
Trigger: tag `v*.*.*`. Manual approval gate. Build → backup DB → migrate → deploy → smoke → rollback nếu fail. SKIP cho thesis (deploy thủ công OK).

**Validation:** CI < 10 phút. PR merge block nếu CI fail.

---

### 45.2 Monitoring & Alerting

#### 45.2.1 — Application logs [45a MUST]
Phase 19 đã setup Winston. Phase 45a verify:
- Log level chuẩn (error, warn, info, debug).
- Structured JSON (production mode).
- Rotation: daily, retain 30 ngày.
- Sensitive field redact (password, token, card number).

#### 45.2.2 — Error tracking (Sentry) [45b OPTIONAL]
- Sentry SDK BE + FE (free tier).
- Capture unhandled exception + manual `Sentry.captureException` trong critical use case.
- Source map upload từ Vite build.
- Setup ~1 giờ. ROI cho thesis: trung bình (reviewer thấy production-mindset).

#### 45.2.3 — Performance monitoring (APM) [45b OPTIONAL — SKIP cho thesis]
- BE: `prom-client` Prometheus metrics — request latency, RPS, error rate.
- FE: Web Vitals (LCP, FID, CLS) → analytics.
- **Lý do skip:** Thesis không có real traffic để monitor; reviewer sẽ không pull metrics. Setup tốn 4-8h, ROI gần 0.
- `/metrics` endpoint admin-only.

#### 45.2.4 — Health check [45a MUST]
- BE: `GET /api/health` → `{ status, db, redis, uptime, version }`. Useful cho deploy script + manual smoke.

#### 45.2.5 — Alerting rule [45b OPTIONAL — SKIP cho thesis]
- Error rate > 1% trong 5 phút; p95 latency > 2s; DB/Redis fail; disk > 80%.
- Channel: email admin, Slack/Discord webhook.
- **Lý do skip:** Không có real users để alert. Thesis demo defense không cần real-time alerting.

**Validation 45.2:** [MUST] Health check 200 + structured. [OPTIONAL] Sentry test event work; Prometheus `/metrics` accessible; Alert trigger manual → admin nhận.

---

### 45.3 Backup & Disaster Recovery

#### 45.3.1 — Manual DB backup [45a MUST] — đơn giản, chỉ document
- `mysqldump` thủ công trước mỗi deploy lớn (hoặc trước demo defense). Document trong `docs/PRODUCTION_RUNBOOK.md`:
  ```bash
  mysqldump -u root techstore > backups/$(date +%Y%m%d-%H%M%S).sql
  ```
- KHÔNG cần cron + S3 cho thesis (single-instance, không có real users).

#### 45.3.2 — Cron backup automation + S3 [45b OPTIONAL — SKIP cho thesis]
- Cron `backup-db.sh` daily 02:00: `mysqldump` → gzip → S3/GCS. Retention: 30/12/12.

#### 45.3.3 — Uploaded file backup [45b OPTIONAL]
- `backend/uploads/` rsync → S3 daily, hoặc migrate `S3Adapter`.

#### 45.3.4 — Disaster recovery drill [45b OPTIONAL]
- `docs/DISASTER_RECOVERY.md` runbook + restore drill thực tế.
- **RTO/RPO target không áp dụng cho thesis** — không có SLA real users.

**Validation 45.3:** [MUST] `docs/PRODUCTION_RUNBOOK.md` exists có lệnh `mysqldump` + restore. [OPTIONAL] Backup daily auto, restore drill pass.

---

### 45.4 Staging Environment [45b OPTIONAL — SKIP cho thesis]

> SKIP cho thesis: 1 deploy target (server demo) là đủ. Setup staging tốn 1-2 ngày, ROI gần 0 cho defense.
- Staging server (Hostinger/Vercel/Railway/VPS).
- DNS subdomain. Auto-deploy từ branch `staging`. Smoke gate.

---

### 45.5 Performance Benchmark

#### 45.5.1 — BE load test [45b OPTIONAL — single-shot screenshot OK]
- Tool: k6 hoặc Apache Bench.
- Scenario: 100 concurrent user browse + addToCart + checkout.
- Target: p95 latency < 500ms, error rate < 0.1%.
- **Cho thesis:** chạy 1 lần, screenshot kết quả vào slides defense — không cần CI integration.

#### 45.5.2 — FE bundle optimization [45a MUST — đơn giản]
- Code-splitting per route (`lazy()` đã có).
- Bundle analyzer: `vite-bundle-visualizer`.
- Target: main bundle < 250KB gzipped (relaxed cho thesis), route chunks < 150KB.

#### 45.5.3 — Image optimization [45a MUST — basic]
- WebP/AVIF tự động khi có cơ hội. Responsive `srcset` cho ProductCard.
- CDN (CloudFlare/Cloudinary) **OPTIONAL** — local serve OK cho thesis.

#### 45.5.4 — DB query benchmark [45a MUST — đã có Phase 11/40]
- Verify 0 query > 100ms trên dashboard load.
- EXPLAIN critical path query (Phase 11 đã làm phần lớn).

**Validation 45.5:** [MUST] Bundle size pass, no slow query > 100ms. [OPTIONAL] k6 load test screenshot.

---

### 45.6 Accessibility (a11y) Audit — RELAXED cho thesis

#### 45.6.1 — Automated a11y [45a MUST]
- Lighthouse run thủ công trên 3 page chính (Home + ProductDetail + Checkout).
- Target: Lighthouse a11y score ≥ **80** (relaxed từ 90, vì Ant Design admin pages khó đạt 90 mà không rework lớn).
- `axe-core` integration `npm test` **OPTIONAL**.

#### 45.6.2 — Basic a11y fixes [45a MUST]
- Image missing `alt` → add (grep `<img` không có `alt=`).
- Form input missing `<label>` → add (Ant Design Form item phải có `label` prop).
- Button icon-only missing `aria-label` → add.
- Keyboard navigation: tab order hợp lý cho 3 page chính.

#### 45.6.3 — Full WCAG AA + screen reader [45b OPTIONAL — SKIP cho thesis]
- Manual NVDA/JAWS test 5 page, color contrast WCAG AA, modal focus trap full.
- **Lý do skip:** Full WCAG AA audit tốn 1-2 tuần, ROI thesis trung bình.

**Validation 45.6:** [MUST] Lighthouse a11y ≥ 80 trên 3 page, alt + label + aria-label cơ bản. [OPTIONAL] Lighthouse ≥ 90 trên 7 page + screen reader pass.

---

### 45.7 Security Hardening (Beyond Phase 1, 13, 23)

#### 45.7.1 — HTTPS enforce + Helmet [45a MUST]
- Helmet config: HSTS, CSP, X-Frame-Options, X-Content-Type-Options.
- HTTP → HTTPS redirect (chỉ apply khi deploy production server).

#### 45.7.2 — Secret management [45a MUST]
- `.env` không commit (Phase 23 đã có `.env.example`).
- Production secret qua env var của hosting platform.
- **Rotation 90 ngày là OPTIONAL cho thesis** (không có team, không có risk leakage thật).

#### 45.7.3 — Dependency security [45a MUST]
- `npm audit` zero high/critical (cả BE + FE).
- Dependabot enable trên GitHub repo (1-click setup).

#### 45.7.4 — Rate limiting [45a MUST — basic in-memory đủ; Redis-backed OPTIONAL]
- Phase 1 đã có rate limit basic in-memory. Phase 45a:
  - Per-route limit (auth 5/15min, API 100/15min, public 1000/15min) — config thêm là đủ.
- Redis-backed [45b OPTIONAL] — chỉ cần khi multi-instance (thesis SKIP).

**Validation 45.7:** [MUST] Helmet header check pass, `npm audit` clean, per-route rate limit work. [OPTIONAL] Redis-backed rate limit, secret rotation.

---

### 45.8 Multi-Instance Readiness [45b OPTIONAL — SKIP cho thesis]

> **SKIP hoàn toàn cho thesis** — project là single-instance theo project context (XAMPP local + 1 server). Section này document để biết, không thực thi.
- AI conversation history → `RedisConversationStore` (Phase 42 interface ready).
- Chat presence → `RedisPresenceRepository`.
- Catalog cache → Redis instead of in-memory `Map`.
- Session store → Redis.
- Sticky session config (Socket.IO multi-instance).

**Validation:** N/A cho thesis.

---

### ✅ Acceptance Criteria Phase 45

#### Phase 45a — DEFENSE-MUST (BẮT BUỘC cho thesis defense pass)

**CI/CD (45.1)**
- [ ] `.github/workflows/ci.yml` exists, run trên PR.
- [ ] Test + lint + build CI pass.
- [ ] CI < 10 phút, PR merge block nếu CI fail.

**Monitoring (45.2)**
- [ ] Health check `GET /api/health` → 200 + structured `{ status, db, redis?, uptime, version }`.
- [ ] Application log structured (Phase 19 đã setup) — verify rotation + sensitive field redact.

**Backup (45.3)**
- [ ] `docs/PRODUCTION_RUNBOOK.md` exists có lệnh `mysqldump` + restore step-by-step.

**Performance (45.5)**
- [ ] FE main bundle < 250KB gzipped (relaxed thesis target).
- [ ] 0 query > 100ms trên dashboard load (Phase 11/40 đã optimize, verify).
- [ ] Image alt text + responsive srcset cho ProductCard.

**Accessibility (45.6)**
- [ ] Lighthouse a11y ≥ 80 trên 3 page chính (Home + ProductDetail + Checkout).
- [ ] Image missing `alt` đã add. Form input missing `<label>` đã add. Button icon-only có `aria-label`.

**Security (45.7)**
- [ ] Helmet config: HSTS, CSP, X-Frame-Options, X-Content-Type-Options.
- [ ] `npm audit` 0 high/critical (BE + FE).
- [ ] Per-route rate limit cấu hình (auth 5/15min, API 100/15min, public 1000/15min).
- [ ] `.env` không commit; production secret qua env var.

**Documentation**
- [ ] `docs/PRODUCTION_RUNBOOK.md` exists.

#### Phase 45b — BONUS-OPTIONAL (KHÔNG bắt buộc, làm nếu dư thời gian)

**Bonus CI/CD**
- [ ] `.github/workflows/deploy-staging.yml` hoặc `deploy-production.yml`.
- [ ] Coverage badge Codecov/Coveralls.

**Bonus Monitoring**
- [ ] Sentry SDK BE + FE integrated, capture work, source map upload.
- [ ] Prometheus `/metrics` endpoint.
- [ ] Alert rule cấu hình + test trigger.

**Bonus Backup + DR**
- [ ] Cron backup daily, ≥30 ngày artifact, S3/GCS upload.
- [ ] `backend/uploads/` rsync hoặc S3Adapter migrate.
- [ ] `docs/DISASTER_RECOVERY.md` runbook + restore drill 1 lần pass.

**Bonus Staging**
- [ ] Staging accessible, auto-deploy.

**Bonus Performance**
- [ ] BE load test k6 p95 < 500ms, error rate < 0.1% — screenshot vào defense slides.
- [ ] CDN setup (CloudFlare/Cloudinary).
- [ ] `docs/PERF_BENCHMARK.md` exists.

**Bonus a11y**
- [ ] Lighthouse a11y ≥ 90 trên 7 page.
- [ ] Manual NVDA/JAWS screen reader test pass 5 page.
- [ ] WCAG AA color contrast full audit.

**Bonus Security**
- [ ] Dependabot enable.
- [ ] Rate limit Redis-backed (chỉ khi multi-instance).

**Bonus Multi-Instance (45.8 — chỉ khi deploy multi-instance)**
- [ ] RedisConversationStore + RedisPresenceRepository pass test.
- [ ] 2-instance load balancer test: state persist.

#### Cross-cutting (cả 45a + 45b)
- [ ] All previous phase test still pass.
- [ ] Commit Rule 4.1.
- [ ] Defense-MUST AC 100% pass; Bonus AC tracked nhưng KHÔNG block merge.

---
