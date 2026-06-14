# Plan: Cải thiện Chương 3 — Phân tích và thiết kế hệ thống

> Dựa trên đánh giá cross-chapter (C2 + C3 + C4). Điểm hiện tại: 8.0/10. Mục tiêu: 8.5–9.0.
> File: `docs/chapters/c3/c3_chapter.tex` (900 dòng).

---

## Tổng quan vấn đề

| # | Vấn đề | Mức độ |
|---|---|---|
| 1 | C3 lẫn implementation detail (tên hàm/file) — trùng nặng với C4 | Cao |
| 2 | Thiếu UC specification chi tiết (chỉ có bảng liệt kê) | Cao |
| 3 | Dual-token mô tả đầy đủ 2 lần + nhắc lại 1 lần trong C3 | Trung bình |
| 4 | Bảng API endpoints quá chi tiết cho chương thiết kế | Trung bình |
| 5 | Tóm tắt chương dài (~10 dòng LaTeX / ~40 dòng render), gần copy nội dung chương | Trung bình |
| 6 | Bảng NFR dùng tên file làm "phương pháp đo" | Thấp |
| 7 | Citation ít (3 cite / 900 dòng) | Trung bình |
| 8 | Công thức Hybrid Search score fusion nằm ở C4 thay vì C3 | Thấp |
| 9 | Deployment diagram đã có (`diagrams/deployment/`) nhưng cần verify khớp code hiện tại | Thấp |

---

## Nhiệm vụ chi tiết

### NV-1: Tách rõ thiết kế vs cài đặt [ƯU TIÊN 1 — impact cao nhất]

**Phạm vi**: §3.6 (pipeline RAG), §3.5 (luồng xử lý), §3.2 (kiến trúc)

**Nguyên tắc**: C3 giữ WHAT + WHY (component-level). C4 giữ HOW (tên hàm, code pattern).

**Chi tiết từng section:**

#### §3.6.4 — Các bước trong pipeline RAG (dòng 836–854)

Hiện tại ~18 dòng LaTeX nhưng mỗi bước là 1 đoạn dài (render ~100+ dòng PDF), trùng nặng với C4 §4.3.3. Rút gọn mỗi bước từ đoạn dài xuống 1–2 câu design-level.

| Bước | C3 hiện tại (vấn đề) | C3 sửa thành |
|---|---|---|
| Bước 1 | "Hàm `validateMessage` trong `AIPolicy` kiểm tra..." | "Module chính sách AI kiểm tra tính hợp lệ: không rỗng, ≤500 ký tự, chứa ít nhất chữ/số. Vi phạm → kết thúc pipeline." |
| Bước 2 | "Hàm `expandAbbreviations` áp dụng 73 mẫu regex..." + "`classifyIntent` phân loại..." | "Bước chuẩn hóa áp dụng bảng ánh xạ 73 mẫu regex (dưới 1ms), sau đó phân loại câu hỏi vào 6 nhóm ý định." |
| Bước 3 | "`isPromptInjection` so khớp 15 mẫu..." + "`intent === 'off_topic'`" | "Kiểm tra tuần tự: phát hiện prompt injection (15 mẫu tấn công) rồi lọc câu hỏi ngoài phạm vi. Cả hai thoát sớm, không gọi LLM." |
| Bước 4 | "`Map<sessionId, {messages, lastAccess}>`" + "`_enrichQueryFromHistory`" | "Đọc lịch sử phiên từ bộ nhớ server, bổ sung tên sản phẩm từ lượt trước vào query nếu phát hiện đại từ thay thế." |
| Bước 5 | "`Promise.all`" + "`rewriteQuery` timeout 8s" + "`hybridSearch(query, 10)`" | "Chạy song song tìm kiếm Hybrid Search (topK=10, ngưỡng 0.45) và LLM rewrite query. Không có kết quả vượt ngưỡng → fallback topK=3, minScore=0, đánh dấu độ tin cậy thấp." |
| Bước 6 | "`Promise.race`" + "`buildAugmentedPrompt`" + "`parseLLMOutput` 4 mức khớp" + "`simpleKeywordMatch`" | "Xây dựng prompt tăng cường (sản phẩm + lịch sử + quy tắc) gửi LLM. Kết quả được đối chiếu với catalog thực qua 4 mức khớp giảm dần để loại hallucination. Timeout hoặc lỗi → dự phòng tìm kiếm thuần từ khóa." |
| Bước 7 | "`_evictStaleSessions`" + "`ChatMessage.bulkCreate`" + "`MAX_HISTORY_TURNS=10`" | "Cập nhật lịch sử phiên trong RAM và ghi database bất đồng bộ, không chặn phản hồi người dùng." |

#### §3.6.5 — Thiết kế Hybrid Search (dòng 856–865)

- **Giữ**: thuật toán tổng quan (dense + sparse + overlap boost 0.05), ngưỡng 0.45, trọng số name×3/text×1, 3 chế độ gọi
- **Bỏ**: `HybridVectorStore`, `UnifiedEmbeddingService`, chi tiết `task: retrieval.query`, tiền tố `passage:`/`query:` của từng provider
- **Thêm**: chuyển công thức score fusion (Equation 4.1 từ C4 dòng 102–109) vào đây (xem NV-8)

#### §3.6.6 — Session Memory (dòng 867–871)

- **Giữ**: quyết định dùng RAM thay DB, tham số (500 phiên, TTL 30 phút, LRU, 10 lượt), trade-off (mất khi restart, không scale horizontal)
- **Bỏ**: `ChatbotService`, `Map<sessionId, {messages, lastAccess}>`, `_evictStaleSessions()`

#### §3.6.7 — Embedding chain fallback (dòng 873–889)

- **Giữ**: chiến lược 3 provider, lý do chọn Jina v3 ưu tiên, tất cả 1024 chiều, kiểm tra dimension, graceful degradation
- **Bỏ**: `src/services/embedding/unified-embedding.js`, chi tiết API field `task` của Jina, instruction dài của e5-instruct

#### §3.5.1 — Luồng xác thực (dòng 657–699)

- **Bỏ**: `crypto.timingSafeEqual`, `beforeCreate hook`, `crypto.randomInt`, `bcrypt.compare`
- **Thay bằng**: "so sánh OTP bằng thuật toán constant-time chống timing attack", "hash mật khẩu với cost factor 12 qua hook tự động khi tạo tài khoản"

#### §3.5.2 — Luồng merge giỏ hàng (dòng 701–723)

- **Bỏ**: `useCartMerge`, `justLoggedIn`, `authStore`, `addToCart` vs `syncCart` (implementation detail)
- **Thay bằng**: mô tả ở mức luồng (client phát hiện đăng nhập → đồng bộ → cộng dồn → xóa local)

#### §3.5.3 — Luồng đặt hàng (dòng 725–769)

- **Bỏ**: `restoreVariantStock`/`restoreProductStock`, `_canProcessPayment`
- **Giữ**: mô tả luồng 3 giai đoạn, cơ chế SELECT FOR UPDATE, idempotency IPN (đây là thiết kế, OK)

#### §3.2.2 — Kiến trúc Modular Monolith (dòng 252–299)

- **Bỏ**: `Promise.allSettled` (chi tiết EventBus implementation)
- **Giữ**: DI, EventBus pub/sub, Shared Models, UnitOfWork — đây là design pattern, OK ở C3

**Phân biệt loại `\texttt{}` — giữ hay bỏ:**

| Loại | Ví dụ | Quyết định |
|---|---|---|
| Tên hàm/method JS | `validateMessage`, `expandAbbreviations`, `_canProcessPayment` | **Bỏ** |
| Tên file path | `chatbot-service.js`, `src/services/embedding/unified-embedding.js` | **Bỏ** |
| Entity/model name | `Product`, `CartItem`, `Order` | **Giữ** (thiết kế DB) |
| Event name | `order.cancelled` | **Giữ** (design contract EventBus) |
| SQL/HTTP concept | `SELECT FOR UPDATE`, `httpOnly`, `SameSite=Strict` | **Giữ** |
| Tên endpoint | `POST /api/orders`, `GET /api/cart` | **Giữ** |
| Config/constant thiết kế | `MAX_SESSIONS=500`, `MAX_HISTORY_TURNS=10` | **Giữ** (tham số thiết kế) |
| JS runtime API | `Promise.all`, `Promise.race`, `Promise.allSettled` | **Bỏ** |

**Verify**: sau khi sửa, grep `\\texttt{` trong C3 — mỗi `\texttt{}` còn lại phải thuộc loại "Giữ" ở bảng trên.

**Ước tính effort**: 2–3 giờ.

---

### NV-2: Bổ sung UC specification cho 3–5 UC trọng tâm [ƯU TIÊN 2]

**Vị trí**: sau bảng UC (dòng 114), trước §3.1.3 Yêu cầu phi chức năng.

**UC cần đặc tả** (chọn theo: ưu tiên Cao + cross-module + hội đồng hay hỏi):

| UC | Lý do | Code cần đọc trước khi viết |
|---|---|---|
| UC-13: Đặt hàng + áp mã giảm giá | Luồng phức tạp nhất, cross-module | `orders-service.js` createOrder, `orders-controller.js`, FE checkout flow |
| UC-18: Chatbot tư vấn sản phẩm | Trọng tâm dự án | `chatbot-service.js` processMessage, `ai-controller.js`, `ai-policy.js` |
| UC-14: Thanh toán MoMo/VNPay/COD | Liên quan dịch vụ ngoài, idempotency | `payment-service.js`, MoMo/VNPay handler, `payment/routes.js` |
| UC-20: CRUD sản phẩm (staff) | Đại diện back-office, RBAC | `catalog/routes.js`, `admin/routes.js` (staff guard), `catalog-service.js` |
| UC-05: Đăng ký + xác thực OTP | Đại diện xác thực | `auth-service.js` register + verifyOTP, `auth/routes.js` |

**Điều kiện tiên quyết**: luồng chính/thay thế/ngoại lệ của mỗi UC phải được xác định từ code thực tế (route → controller → service), KHÔNG viết từ mô tả text C3 hay đoán.

**Template mỗi UC**:
```
\begin{table}[H]
  \caption{Đặc tả UC-13: Đặt hàng và áp mã giảm giá}
  \begin{tabular}{|l|p{10cm}|}
    Tác nhân & Customer \\
    Tiền điều kiện & Đã đăng nhập; giỏ hàng có ≥1 sản phẩm \\
    Luồng chính & 1. Nhấn "Thanh toán" → 2. Nhập địa chỉ giao hàng → ... \\
    Luồng thay thế & 4a. Mã giảm giá không hợp lệ → thông báo lỗi cụ thể \\
    Ngoại lệ & 5a. Sản phẩm hết hàng → rollback, thông báo SP cụ thể \\
    Hậu điều kiện & Đơn hàng status=pending, tồn kho đã trừ \\
  \end{tabular}
\end{table}
```

**Ước tính effort**: 1.5–2 giờ.

---

### NV-3: Giảm trùng dual-token trong C3 [ƯU TIÊN 3]

**Vấn đề**: chiến lược dual-token (access 7 ngày, refresh 30 ngày, httpOnly cookie) mô tả đầy đủ 2 lần + tham chiếu lại 1 lần:
- §3.1.3 NFR bảo mật (dòng 120) — mô tả đầy đủ lần 1
- §3.5.1 Luồng xác thực (dòng 659) — mô tả đầy đủ lần 2 + lý giải TTL 7 ngày
- §3.5.4 Token refresh (dòng 774) — nhắc lại "TTL access token 7 ngày" + mô tả token rotation

**Cách sửa**:
- **Giữ mô tả đầy đủ 1 lần** ở §3.5.1 (luồng xác thực — đúng ngữ cảnh nhất, có lý giải TTL)
- §3.1.3: rút gọn thành 1 câu NFR + tham chiếu "chi tiết xem mục~\ref{sec:c3_sequences}"
- §3.5.4: bỏ câu nhắc lại TTL, chỉ giữ phần token rotation (nội dung mới, không trùng)

**Ước tính effort**: 20 phút.

---

### NV-4: Gộp bảng API endpoints [ƯU TIÊN 4]

**Vấn đề**: Bảng 3.3 (dòng 327–438) chiếm ~110 dòng, liệt kê từng endpoint — quá chi tiết.

**Cách sửa** (KHÔNG chuyển phụ lục — bảng cần thiết cho liên kết với bảng RBAC):

Gộp endpoint **cùng Auth level** trong cùng nhóm thành 1 dòng. Nhóm có Auth khác nhau → giữ tách.

Ví dụ nhóm Cart (cùng Customer → gộp):
```
GET/POST/PUT/DELETE  /api/cart/*     Customer    CRUD giỏ hàng (5 endpoints)
```

Ví dụ nhóm Payment (3 Auth level khác nhau → KHÔNG gộp thành 1 dòng):
```
POST  /api/payments/{momo|vnpay}/create-url  Customer  Tạo URL thanh toán
POST/GET  /api/payments/{momo|vnpay}/ipn     Public    IPN callback (2 endpoints)
POST  /api/payments/refund                   Staff     Hoàn tiền VNPay
```

**Nguyên tắc**: Auth level là thông tin quan trọng nhất — KHÔNG được gộp mất. Chỉ gộp khi cùng Auth.

**Mục tiêu**: giảm từ ~35 dòng nội dung bảng xuống ~18–22 dòng, giữ đủ thông tin Auth level.

**Ước tính effort**: 30 phút.

---

### NV-5: Rút gọn tóm tắt chương [ƯU TIÊN 5]

**Vấn đề**: §3.7 (dòng 891–900) gồm ~10 dòng LaTeX nhưng mỗi dòng là đoạn rất dài (render ~40 dòng PDF), gần như lặp lại toàn bộ nội dung chương.

**Cách sửa**: rút xuống 12–15 dòng. Chỉ giữ:
1. Kết quả phân tích chính (4 tác nhân, 28 UC, 19 NFR)
2. Quyết định kiến trúc cốt lõi (Modular Monolith, Feature-Based, Advanced RAG)
3. Câu chuyển tiếp sang C4

**Ước tính effort**: 20 phút.

---

### NV-6: Sửa bảng NFR — cột "Phương pháp đo" [ƯU TIÊN 6]

**Vấn đề**: cột "Phương pháp đo" ghi tên file (rate-limiter.js, chatbot-service.js...) thay vì phương pháp đo thực sự.

**Sửa cụ thể**:

| ID | Hiện tại | Sửa thành |
|---|---|---|
| NFR-04, 05 | `backend/.env` | Đánh giá cấu hình |
| NFR-06 | `models/user.js` | Đánh giá mã nguồn |
| NFR-07–10 | `rate-limiter.js` | Kiểm thử API (Supertest) |
| NFR-11 | `payment-service.js` | Kiểm thử tích hợp |
| NFR-12 | `auth-service.js` | Kiểm thử HTTP header |
| NFR-15 | `unified-embedding.js` | Kiểm thử unit (mock failure) |
| NFR-16, 17 | `chatbot-service.js` | Kiểm thử unit + đo thực tế |

**Ước tính effort**: 15 phút.

---

### NV-7: Bổ sung citation [ƯU TIÊN 7]

Thêm ~5–6 `\cite{}` vào C3, chủ yếu tái sử dụng entry đã có trong `references.bib` từ C2. Thêm mới 1–2 entry.

| Vị trí C3 | Nội dung | Citation |
|---|---|---|
| ~194 (biểu đồ UC) | Ký pháp biểu đồ UML | **Thêm mới**: OMG UML 2.5.1 (2017) |
| ~443 (RBAC) | Mô hình phân quyền RBAC, least privilege | **Thêm mới**: Sandhu et al. 1996 hoặc Ferraiolo & Kuhn 1992 |
| ~659 (JWT) | Chiến lược dual-token JWT | Tái dùng: `\cite{jones2015jwt}` (đã ở C2) |
| ~795 (RAG) | Kiến trúc Advanced RAG | Tái dùng: `\cite{gao2023retrieval}` + `\cite{lewis2020rag}` (đã ở C2) |
| ~863 (BM25) | BM25-inspired keyword search | Đã có: `\cite{robertson1994okapi}` — OK |
| ~120 (bcrypt) | Hash mật khẩu bcrypt cost 12 | Tái dùng: `\cite{provos1999bcrypt}` (đã ở C2) |
| ~659 (OWASP) | httpOnly cookie chống XSS | **Thêm mới**: OWASP Session Management Cheat Sheet |

**Hành động**: thêm 3 entry mới vào `references.bib` (OMG UML 2.5.1, Sandhu RBAC, OWASP), thêm ~7 `\cite{}` vào C3.

**Ước tính effort**: 30 phút.

---

### NV-8: Chuyển công thức Hybrid Search score fusion từ C4 sang C3 [ƯU TIÊN 8]

**Hiện tại**: Equation 4.1 nằm ở C4 dòng 102–109.

**Hành động**:
1. Copy equation vào C3 §3.6.5, đặt sau mô tả thuật toán Hybrid Search (sau dòng ~865)
2. Đặt label `\label{eq:hybrid_score}`
3. C4 §4.3.2: thay equation bằng câu tham chiếu: "Kết quả được hợp nhất theo công thức~(\ref{eq:hybrid_score}) ở Chương~3."

**Ước tính effort**: 15 phút.

---

### NV-9: Sửa ký pháp + verify nội dung deployment diagram [ƯU TIÊN 9]

**Thực trạng**: Dự án đã có deployment diagram PlantUML:
- Source: `diagrams/deployment/system-architecture.puml`
- Rendered: `diagrams/deployment/system_architecture.pdf` (copy tại `docs/figures/c3/system_architecture.pdf`)
- C3 §3.2.1 đã reference hình này (`\fitfig{figures/c3/system_architecture.pdf}`)

**Vấn đề ký pháp UML 2.5.1 (đã render + verify vs spec qua uml-diagrams.org):**

| # | Hiện tại | Đánh giá vs UML 2.5.1 | Cách sửa |
|---|---|---|---|
| 1 | `cloud` cho "Dịch vụ Ngoài" | `cloud` **không có trong UML spec** — chỉ là PlantUML convenience | Đổi thành `node "Dịch vụ Ngoài"` (node là notation chuẩn cho mọi deployment target) |
| 2 | `artifact` cho mọi thứ bên trong node | **Chấp nhận được** — trong deployment diagram, `artifact` là element deploy lên node. Component xuất hiện gián tiếp qua manifestation. Dùng artifact cho software element bên trong node là đúng ngữ cảnh | **Giữ nguyên** |
| 3 | Communication path ghi label text thường | **Đúng chuẩn** — UML 2.5 cho phép label text thường trên communication path (ví dụ "TCP/IP", "Gigabit Ethernet"). Stereotype `<<>>` không bắt buộc | **Giữ nguyên** |

→ Chỉ cần sửa **1 điểm**: `cloud` → `node`.

**Nguồn tham chiếu ký pháp**: [UML deployment diagrams — uml-diagrams.org](https://www.uml-diagrams.org/deployment-diagrams.html) (secondary source, bám sát OMG UML 2.5.1 spec).

**Vấn đề nội dung (cần verify vs code):**

| # | Trong sơ đồ | Cần kiểm tra |
|---|---|---|
| 1 | "Node.js 20" | `package.json` engines — project dùng Node.js 22 |
| 2 | "62 migrations" | Đếm file thực tế trong `backend/src/migrations/` |
| 3 | "25 model" | Đếm model thực tế trong `backend/src/models/index.js` |
| 4 | Danh sách middleware | So với `app.js` middleware chain thực tế |
| 5 | Danh sách dịch vụ ngoài | So với `.env.example` — có thiếu/thừa service nào không |

**Hành động**:
1. Audit nội dung vs code — đọc `server.js`, `app.js`, `.env.example`, `package.json`, `vite.config.*`
2. Sửa ký pháp 3 điểm trên trong `.puml`
3. Sửa nội dung sai lệch (nếu có)
4. Re-render PNG + PDF (quy trình: puml→png trực tiếp, puml→svg→pdf qua Inkscape)
5. Copy PDF mới vào `docs/figures/c3/system_architecture.pdf`

**Chuẩn ký pháp**: UML 2.5.1 (OMG, 2017). Cần thêm entry `references.bib` (đã ghi ở NV-7).

**Ước tính effort**: 45 phút – 1 giờ (sửa `cloud`→`node` + verify nội dung + re-render + copy PDF).

---

## Thứ tự thực hiện

```
NV-1 (tách design/impl)     ← làm đầu, impact cao nhất
  → NV-8 (chuyển equation)  ← làm cùng NV-1 khi đang sửa §3.6
  → NV-3 (giảm trùng dual-token)
NV-6 (sửa bảng NFR)         ← nhanh, 15 phút
NV-7 (bổ sung citation)     ← nhanh, 30 phút
NV-4 (gộp bảng API)         ← 30 phút
NV-5 (rút gọn tóm tắt)     ← 20 phút
NV-2 (UC specification)     ← effort lớn, làm sau khi các sửa nhỏ xong
NV-9 (deployment diagram)   ← sửa ký pháp + verify nội dung
```

---

## Tổng effort ước tính

| Nhóm | Effort | Ghi chú |
|---|---|---|
| NV-1 + NV-8 + NV-3 | 2.5–3.5 giờ | Lõi — sửa ranh giới C3/C4 |
| NV-6 + NV-7 + NV-4 + NV-5 | 1–1.5 giờ | Sửa nhỏ, impact tích lũy |
| NV-2 | 1.5–2 giờ | UC specification |
| NV-9 | 0.75–1 giờ | Sửa `cloud`→`node` + verify nội dung vs code + re-render |
| **Tổng** | **5.75–8 giờ** | NV-9 bắt buộc |

---

## Verify sau khi sửa

- [ ] Grep `\\texttt{` trong C3 — không còn tên hàm JS (chỉ còn tên concept/endpoint)
- [ ] Grep nội dung trùng C3↔C4 (dual-token, session memory, embedding fallback) — mỗi chủ đề mô tả đầy đủ đúng 1 lần
- [ ] Equation Hybrid Search có ở C3, C4 tham chiếu
- [ ] Bảng NFR cột "Phương pháp đo" không còn tên file
- [ ] ≥6 `\cite{}` mới trong C3 (bao gồm OMG UML 2.5.1)
- [ ] 3–5 UC có specification đầy đủ
- [ ] Tóm tắt chương ≤15 dòng
- [ ] Build LaTeX thành công, không lỗi reference
