# Hướng dẫn thuyết trình & phản biện — Sơ đồ TechStore

> Mỗi sơ đồ có 3 phần: **① Nói gì** (script ngắn khi chiếu slide) · **② Tại sao** (lý do thiết kế — phần ăn điểm) · **③ Hội đồng hỏi gì + trả lời**.
> Trọng tâm bảo vệ: **RAG Chatbot**. Các sơ đồ khác là nền để dẫn tới chatbot.

---

## Nguyên tắc trình bày chung (đọc trước)

1. **1 slide = 1 thông điệp.** Chiếu sơ đồ → nói 1 câu "Slide này chứng minh điều gì" trước khi đi vào chi tiết.
2. **Không đọc lại nhãn trên hình.** Hội đồng đọc được. Nhiệm vụ của bạn là giải thích *quyết định thiết kế* đằng sau hình.
3. **Luôn nối về con số / trade-off.** "Chúng em chọn X *vì* Y, đánh đổi là Z." Câu này ăn điểm hơn mọi mô tả.
4. **Chốt mỗi sơ đồ bằng 1 câu.** Ví dụ: "Tóm lại, kiến trúc modular monolith cho phép phát triển độc lập 17 module mà vẫn deploy 1 lần."
5. **Khi bị hỏi điều không biết:** đừng bịa. Nói "Phần đó em chưa đo/chưa làm, hướng xử lý là…". Hội đồng trừ điểm bịa nặng hơn trừ điểm thiếu.
6. **Thứ tự chiếu đề xuất:** Yêu cầu (chức năng + NFR) → Use Case → Kiến trúc → RAG pipeline (tổng quan → chi tiết → sequence → đánh giá) → Checkout → Search → Testing.

---

# NHÓM 1 — YÊU CẦU HỆ THỐNG

## 1.1 `functional_req.png` — Yêu cầu chức năng

**① Nói gì**
"Hệ thống có 3 nhóm chức năng theo tác nhân: người dùng cuối, chatbot AI, và quản trị. Cột giữa được tô đậm vì **chatbot AI là trọng tâm** của đề tài — phần còn lại là nền tảng TMĐT chuẩn."

**② Tại sao**
- Chia theo **tác nhân** (actor) chứ không theo module → khớp với use case diagram, người đọc dễ map.
- Tách riêng cột chatbot để báo hiệu phạm vi đóng góp chính: tiếp nhận NLP Việt/Anh, hiểu viết tắt/sai chính tả, RAG retrieval, multi-turn context, từ chối off-topic.

**③ Hội đồng hỏi gì**
- *"Đâu là phần các em tự làm, đâu là phần chuẩn?"* → CRUD/giỏ hàng/thanh toán là nền tảng TMĐT; đóng góp riêng là **RAG chatbot + kiến trúc modular monolith + chiến lược test 5 tầng**.
- *"Sao chatbot thêm được sản phẩm vào giỏ qua chat?"* → Chatbot trả JSON có danh sách `productId`; frontend render card có nút "Thêm vào giỏ" gọi cart API như luồng thường.

---

## 1.2 `nfr_table.png` — Yêu cầu phi chức năng (NFR)

**① Nói gì**
"4 tiêu chí phi chức năng: hiệu năng, bảo mật, độ tin cậy, bảo trì. Mỗi tiêu chí gắn với 1 cơ chế cụ thể trong code chứ không nói chung chung."

**② Tại sao** (đây là slide dễ bị hỏi sâu — học kỹ từng số)
- **Hiệu năng:** CRUD <200ms; Hybrid Search <50ms (catalog <10k SP); chatbot 2–5s vì *phụ thuộc LLM bên ngoài*, nên có loading state.
- **Bảo mật:** JWT dual-token (access 15 phút), bcrypt cost 12, httpOnly cookie chống CSRF, rate-limit chatbot 20 req/60s, HMAC cho callback thanh toán.
- **Độ tin cậy:** giao dịch đặt hàng + trừ kho **ACID** (chống overselling); IPN **idempotent** (chống xử lý trùng); chatbot có fallback khi LLM chết.
- **Bảo trì:** modular monolith 17 module; embedding fallback qua 3 nhà cung cấp.

**③ Hội đồng hỏi gì**
- *"Vì sao access token chỉ 15 phút?"* → Giảm cửa sổ rủi ro nếu token lộ; có refresh token để không bắt đăng nhập lại.
- *"bcrypt cost 12 nghĩa là gì?"* → 2^12 vòng băm, ~250ms/lần hash — đủ chậm để chống brute-force, đủ nhanh cho UX. (Lưu ý: nếu hội đồng hỏi tại sao không Argon2 → trả lời "bcrypt đủ cho quy mô đồ án, Argon2id là hướng nâng cấp.")
- *"Chatbot 2–5s có chậm không?"* → Có loading + streaming cảm giác; phần lớn độ trễ nằm ở LLM bên ngoài, không tối ưu được ở phía mình. Đo được <50ms cho retrieval là phần mình kiểm soát.
- *"Overselling là gì, chống thế nào?"* → 2 người mua đơn vị tồn cuối cùng cùng lúc; chống bằng `SELECT ... FOR UPDATE` trong transaction (xem slide checkout).

---

# NHÓM 2 — USE CASE

> Có 4 biến thể: tổng hợp (`usecase_techstore`) + 3 bản tách (`uc_guest`, `uc_customer`, `uc_admin`). **Chiếu bản tổng hợp**, 3 bản tách để dự phòng khi hội đồng muốn xem sâu từng actor.

## 2.1 `usecase_techstore.png` — Use case tổng hợp

**① Nói gì**
"3 tác nhân: Khách vãng lai, Khách hàng, Quản trị viên. Mũi tên `Customer ▷ Guest` nghĩa là **khách hàng kế thừa toàn bộ quyền của khách vãng lai**. Hai quan hệ quan trọng: đặt hàng và viết đánh giá **include** đăng nhập; áp mã giảm giá **extend** đặt hàng."

**② Tại sao**
- **Kế thừa (generalization)** tránh vẽ lại 7 use case của Guest cho Customer → sơ đồ gọn, đúng chuẩn UML.
- **include** = bắt buộc luôn xảy ra (đặt hàng *phải* đăng nhập). **extend** = tùy chọn (áp mã giảm giá *có thể* xảy ra khi đặt hàng). Phân biệt đúng 2 cái này là điểm UML.
- Chatbot nằm ở Guest → ai cũng dùng được, không cần đăng nhập (khớp tiền điều kiện ở đặc tả chatbot).

**③ Hội đồng hỏi gì**
- *"Phân biệt include và extend?"* → include: hành vi *bắt buộc* được gọi ra (đăng nhập khi đặt hàng). extend: hành vi *tùy chọn* chèn vào điểm mở rộng (áp mã giảm giá). **Câu này gần như chắc chắn bị hỏi — học thuộc.**
- *"Guest thêm giỏ hàng được, vậy giỏ lưu ở đâu?"* → Guest lưu giỏ phía client/session; khi đăng nhập thì **merge** vào giỏ của user (xem cart module).
- *"Sao 'manager' không có trong actor?"* → Hệ thống chỉ còn 2 role `customer`/`admin`; role manager đã bỏ.

## 2.2 `uc_guest` / `uc_customer` / `uc_admin` (bản tách)
- Dùng khi hội đồng nói "cho xem rõ quyền của admin". Admin có 6 nhóm: SP/danh mục/thương hiệu, đơn hàng, người dùng, dashboard, mã giảm giá/tồn kho, chatbot analytics.
- `uc_customer` thể hiện mũi tên kế thừa Guest rõ nhất — dùng nếu bị hỏi về generalization.

---

# NHÓM 3 — KIẾN TRÚC

## 3.1 `architecture_techstore.png` — Kiến trúc hệ thống (bản chính)

**① Nói gì**
"Đây là kiến trúc tổng thể. Frontend React gọi API Express. Backend là **modular monolith 17 module**. Phần khoanh xanh đậm là **module AI**: tách 2 giai đoạn Retrieve và Generate. Dữ liệu nằm ở 2 nơi: MySQL cho dữ liệu nghiệp vụ, và **vector store** (file JSON 1024 chiều) cho tìm kiếm ngữ nghĩa. Các dịch vụ ngoài: LLM, embedding provider, MoMo/VNPay, Google OAuth."

**② Tại sao** (slide kiến trúc — ăn điểm nếu nói được trade-off)
- **Modular monolith chứ không microservices:** quy mô đồ án + 1 team nhỏ → microservices thừa phức tạp (network, devops, distributed transaction). Monolith deploy 1 lần, debug dễ, nhưng vẫn **module hóa** để ranh giới rõ → sau này tách service được. *Đây là câu trả lời "tại sao" quan trọng nhất của slide này.*
- **Vector store là file JSON, không dùng Pinecone/pgvector:** catalog <10k sản phẩm → cosine in-memory <50ms, đủ nhanh, không cần hạ tầng vector DB riêng. Trade-off: không scale tới triệu vector, nhưng đúng nhu cầu.
- **Embedding provider chain (Jina v3 → HuggingFace fallback):** nếu provider chính chết vẫn embed được → tăng tính sẵn sàng.
- **Mũi tên nét đứt "LLM lỗi → keyword fallback":** thể hiện graceful degradation ngay trên kiến trúc.

**③ Hội đồng hỏi gì**
- *"Sao không dùng microservices?"* → (trả lời trade-off ở trên). **Gần như chắc bị hỏi.**
- *"Vector store để file JSON, restart có mất không? Concurrent write?"* → Load vào RAM khi khởi động; ghi lại file khi sản phẩm thay đổi (Product hooks). Quy mô đồ án không có ghi đồng thời cao. Hướng nâng cấp: pgvector/Qdrant.
- *"1024 chiều là gì?"* → Mỗi sản phẩm/câu hỏi được mã hóa thành vector 1024 số; so khớp bằng cosine similarity.
- *"Vector tự động cập nhật khi thêm sản phẩm không?"* → Có. Product hook `afterCreate/Update/Destroy` tự upsert vào vector store; có cơ chế tự rebuild khi lệch >5%.
- *"17 module giao tiếp với nhau thế nào?"* → Qua service interface + EventBus (pub/sub) cho event như `order.cancelled`; không deep-import chéo module (có pre-commit hook chặn).

## 3.2 `architecture.mmd` (bản đơn giản)
- Bản rút gọn dùng cho slide mở đầu hoặc khi máy chiếu nhỏ. Cùng thông điệp, ít node hơn. Nêu thêm: 12 Full DI + 5 Singleton, Cron daily 2AM + weekly 3AM.

---

# NHÓM 4 — RAG CHATBOT (TRỌNG TÂM)

> Trình tự đề xuất: **tổng quan 9 node → chi tiết pipeline → sequence → bảng node → bảng đánh giá → đặc tả use case**. Đây là phần chiếm nhiều thời gian Q&A nhất.

## 4.1 `rag_pipeline_overview.png` — Pipeline 9 bước (tổng quan)

**① Nói gì**
"Pipeline RAG 9 bước. Bước ③ Guardrails là cổng chặn: nếu phát hiện prompt injection hoặc câu hỏi off-topic thì trả response chặn sẵn, **không tốn LLM**. Nếu qua được thì đi tiếp ④→⑨. Ba bước lõi RAG là ⑤ Retrieve, ⑥ Augment, ⑦ Generate."

**② Tại sao**
- **Guardrails đặt SỚM (bước ③, trước retrieval/LLM):** chặn injection/off-topic trước khi tốn tài nguyên đắt (embedding + LLM). Bảo mật theo OWASP LLM01.
- **Tách Retrieve/Augment/Generate** đúng định nghĩa RAG kinh điển: lấy ngữ cảnh → nhồi vào prompt → sinh câu trả lời.
- **Mọi nhánh đều đi qua ⑧ Persist:** kể cả response bị chặn cũng được ghi lại → phục vụ analytics.

**③ Hội đồng hỏi gì**
- *"RAG là gì, sao không hỏi thẳng LLM?"* → LLM không biết sản phẩm trong shop. RAG **truy xuất sản phẩm thật từ vector store** rồi đưa vào prompt → LLM trả lời dựa trên dữ liệu thật, chống bịa (hallucination).
- *"Off-topic phát hiện bằng gì?"* → Phân loại intent; nếu `intent == off_topic` thì chặn. Không gọi LLM.

## 4.2 `rag_pipeline.mmd` — Pipeline chi tiết

**① Nói gì**
"Đây là bản chi tiết hơn. `_preprocessMessage` gồm validate → mở rộng viết tắt (50+ pattern) → phân loại intent + check injection (15 loại). Có 2 guard. Phần Retrieve chạy **song song** rewrite query (LLM) và hybrid search. Bước generate dùng `Promise.race` giữa LLM và một timer ngân sách — nếu LLM quá lâu thì rớt sang keyword fallback."

**② Tại sao** (các quyết định kỹ thuật đắt giá — học kỹ)
- **`Promise.all` cho rewrite ∥ search:** chạy song song để không cộng dồn độ trễ.
- **`Promise.race` với budget timer:** đặt trần thời gian; LLM chậm/chết → fallback keyword match, đảm bảo *luôn có câu trả lời*. Đây là **graceful degradation** — điểm nhấn lớn.
- **expandAbbreviations:** người Việt gõ "ip17pm", "ko", "đt" → chuẩn hóa trước khi search → tăng recall.
- **Fallback topK=3 khi 0 kết quả:** hạ ngưỡng để vẫn gợi ý được gì đó thay vì trả rỗng.

**③ Hội đồng hỏi gì**
- *"Vì sao cần rewrite query?"* → Câu hỏi multi-turn dùng đại từ ("nó", "cái đó") hoặc thiếu ngữ cảnh; LLM rewrite thành query đầy đủ → search chính xác hơn. Có enrichQueryFromHistory bổ sung ngữ cảnh từ lịch sử.
- *"LLM chết thì chatbot trả gì?"* → keyword fallback: match tên (+10đ) + mô tả (+5đ), sort, lấy top sản phẩm. Vẫn trả được danh sách, chỉ thiếu câu văn tự nhiên.
- *"15 loại injection là gì?"* → Các pattern như "bỏ qua hướng dẫn trên", "đóng vai", lộ system prompt… match bằng regex theo OWASP LLM01.

## 4.3 `seq_chatbot.mmd` — Sequence diagram

**① Nói gì**
"Sơ đồ tuần tự thể hiện luồng theo thời gian giữa các thành phần: ChatWidget → API → AIPolicy → VectorStore → Embedding → LLM → DB. Khối `alt` là rẽ nhánh (hợp lệ/không, injection/off-topic/pass), khối `par` là **chạy song song** rewrite và hybrid search."

**② Tại sao**
- Sequence diagram bổ sung cho flowchart: flowchart cho thấy *logic*, sequence cho thấy *ai gọi ai theo thời gian* + tham số cụ thể (topK=10, timeout 8s, temp=0.3, max_tokens=800).
- Thể hiện rõ `persistMessages` là **async** (fire-and-forget) → không chặn response trả về user.

**③ Hội đồng hỏi gì**
- *"par nghĩa là gì?"* → Parallel — 2 lời gọi chạy đồng thời, chờ cả hai xong (Promise.all).
- *"temp=0.3 sao thấp vậy?"* → Nhiệt độ thấp → câu trả lời ổn định, ít bịa, bám sát dữ liệu sản phẩm. Tư vấn bán hàng cần chính xác chứ không cần sáng tạo.
- *"Cosine + keyword cộng điểm thế nào?"* → Hybrid: cosine cho ngữ nghĩa, keyword cho khớp tên chính xác (name×3, text×1), có boost +0.05 khi trùng → cân bằng "hiểu ý" và "đúng tên model".

## 4.4 `node_table.png` — Bảng mô tả 9 node

**① Nói gì**
"Bảng tra cứu nhanh chức năng từng node, tô màu khớp sơ đồ: ⑤ xanh Retrieve, ⑥ vàng Augment, ⑦ lục Generate, đỏ là nhánh bị chặn. Ghi chú dưới cùng là điểm cốt lõi: nhánh fallback bỏ qua ⑥⑦ → **RAG with graceful degradation**."

**② Tại sao** — slide này để hội đồng đối chiếu khi hỏi "node X làm gì". Không cần thuyết trình lâu, chỉ cần biết để chỉ vào khi bị hỏi.

**③ Hội đồng hỏi gì**
- *"Persist là fire-and-forget, lỡ ghi DB lỗi thì sao?"* → User vẫn nhận được câu trả lời (đã trả trước); lỗi ghi chỉ ảnh hưởng analytics, log lại để xử lý sau. Đây là đánh đổi có chủ đích: UX > analytics.

## 4.5 `rag_eval_table.png` — Bảng 4.4 Kết quả đánh giá

**① Nói gì**
"Đánh giá chatbot trên 5 nhóm kịch bản, tổng hợp từ 53 edge case và 22 path trace. 4 nhóm đạt **Tốt** (pass cả khi LLM sống và chết), riêng nhóm **so sánh** chỉ đạt **Khá** vì khi LLM chết, fallback keyword chỉ liệt kê được chứ không so sánh được."

**② Tại sao** (slide kết quả — hội đồng rất thích hỏi)
- **Thang đánh giá trung thực:** phân biệt "Tốt" (PASS cả 2 trạng thái LLM) và "Khá" (chỉ PASS khi LLM up) → cho thấy nhóm hiểu giới hạn của hệ thống chứ không tô hồng. **Sự trung thực này ăn điểm.**
- Các nhóm: tìm kiếm ngữ nghĩa, tên model cụ thể, viết tắt/sai chính tả, so sánh, ngoài phạm vi — bao phủ các kiểu câu hỏi thực tế.

**③ Hội đồng hỏi gì**
- *"Đánh giá định tính hay định lượng? Có đo accuracy/precision không?"* → Hiện là đánh giá **theo kịch bản pass/fail** trên 53 edge case. Đây là điểm yếu cần thừa nhận thẳng: chưa có bộ test set gắn nhãn để tính precision/recall định lượng. Hướng phát triển: xây golden set + đo Recall@K cho retrieval. **Chuẩn bị sẵn câu này — gần như chắc bị hỏi.**
- *"Sao nhóm so sánh chỉ Khá?"* → Khi LLM up thì so sánh tốt; khi LLM down, fallback chỉ liệt kê 2 sản phẩm chứ không sinh được phân tích đối chiếu. Trung thực báo Khá.
- *"53 edge case test thủ công hay tự động?"* → (trả lời đúng thực tế của nhóm — nếu thủ công thì nói thủ công, đừng nói tự động).

## 4.6 `usecase_chatbot_spec.png` — Đặc tả use case chatbot

**① Nói gì**
"Đặc tả chi tiết ca dùng 'Trò chuyện với chatbot': tiền điều kiện không cần đăng nhập; luồng chính 3 bước phía user / 4 bước phía hệ thống; luồng thay thế là off-topic/injection bị từ chối lịch sự không gọi LLM."

**② Tại sao** — đây là bản "đặc tả use case" theo chuẩn tài liệu phân tích thiết kế (tiền điều kiện, luồng chính, luồng thay thế), nối use case diagram với pipeline kỹ thuật.

**③ Hội đồng hỏi gì**
- *"Không đăng nhập mà chat được, có sợ spam không?"* → Có rate-limit 20 req/60s + guardrails. Đủ chống spam cơ bản.

---

# NHÓM 5 — LUỒNG ĐẶT HÀNG & THANH TOÁN

## 5.1 `checkout_flow.mmd` — Checkout + Payment + Order States

**① Nói gì**
"Luồng đặt hàng. Từ giỏ → validate tồn kho bằng `SELECT FOR UPDATE` → tạo đơn trong **transaction**. Chia 2 nhánh thanh toán: **thủ công** (COD/chuyển khoản/trả góp) tăng usedCount mã giảm giá và clear giỏ ngay trong transaction; **online** (MoMo/VNPay) thì KHÔNG clear giỏ, KHÔNG tăng usedCount cho tới khi **IPN callback** xác minh chữ ký HMAC thành công. Đơn hàng có 5 trạng thái: pending → processing → shipped → delivered, và nhánh cancelled khôi phục tồn kho."

**② Tại sao** (slide nghiệp vụ phức tạp nhất — học rất kỹ)
- **SELECT FOR UPDATE trong transaction:** khóa dòng tồn kho → 2 đơn không trừ cùng lúc → **chống overselling**. Đây là lý do "độ tin cậy ACID" ở NFR.
- **Online chưa clear giỏ / chưa tăng usedCount:** vì thanh toán *chưa chắc thành công*. Nếu clear ngay mà user không trả tiền → mất giỏ + tốn lượt mã. Chỉ commit các tác dụng phụ này khi IPN xác nhận đã trả tiền.
- **IPN verify HMAC:** callback từ cổng thanh toán phải ký HMAC (MoMo SHA256, VNPay SHA512) → chống giả mạo "đã thanh toán".
- **Idempotency IPN:** cổng có thể gọi callback nhiều lần → phải chống xử lý trùng (không tăng usedCount 2 lần).
- **Cancelled khôi phục tồn kho:** trả lại số đã trừ qua EventBus `order.cancelled` → inventory ghi log.

**③ Hội đồng hỏi gì** (slide bị hỏi nhiều nhất sau chatbot)
- *"Overselling chống thế nào?"* → SELECT FOR UPDATE khóa dòng tồn kho trong transaction (giải thích như trên). **Chắc chắn bị hỏi.**
- *"Tại sao online không clear giỏ ngay?"* → Vì chưa chắc trả tiền; chỉ clear khi IPN xác nhận. Tránh mất giỏ của user khi thanh toán dở dang.
- *"IPN là gì? Khác return URL?"* → IPN (Instant Payment Notification) là callback **server-to-server** từ cổng thanh toán, đáng tin hơn return URL (chạy trên browser user, có thể bị đóng/giả). Cập nhật trạng thái dựa trên IPN.
- *"HMAC để làm gì?"* → Xác minh callback thật sự từ cổng thanh toán chứ không phải kẻ giả mạo gọi vào để đánh dấu đơn "đã trả".
- *"Lỡ IPN gọi 2 lần thì sao?"* → Idempotent: kiểm tra trạng thái trước khi cập nhật, đã paid thì bỏ qua → không tăng usedCount trùng.
- *"Hủy đơn rồi tồn kho có trả lại không?"* → Có, qua event `order.cancelled` → inventory cộng lại + ghi inventory_log.

---

# NHÓM 6 — TÌM KIẾM & DANH MỤC

## 6.1 `search_flow.mmd` — Catalog & Search

**① Nói gì**
"Module catalog có **3 mount point**: /products, /categories, /brands. Người dùng lọc đa chiều (giá, hãng, danh mục, thuộc tính) rồi sort. Điểm đáng chú ý là **sort theo giá**: dùng `COALESCE(MIN(variant.price), base_price)` chứ không sort thẳng theo base_price. Mỗi lần search được lưu vào lịch sử (dedup theo user)."

**② Tại sao**
- **COALESCE(MIN(variant.price), base_price):** một sản phẩm có nhiều biến thể giá khác nhau (ví dụ iPhone 128GB vs 256GB). Sort phải theo **giá thấp nhất trong các biến thể**; nếu sản phẩm không có biến thể thì mới lấy base_price. Sort thẳng base_price sẽ sai thứ tự hiển thị. *Đây là gotcha kỹ thuật đáng nói.*
- **3 mount point** chứ không gộp: products/categories/brands là 3 tài nguyên REST khác nhau nhưng cùng 1 module logic.

**③ Hội đồng hỏi gì**
- *"Sao sort giá phức tạp vậy?"* → (giải thích COALESCE ở trên — biến thể).
- *"Search này dùng vector hay SQL?"* → Đây là search/filter **catalog thường (SQL)** cho trang shop. Vector search là phần riêng của **chatbot**. Hai cái khác nhau — đừng nhầm. (Hội đồng hay gài câu này.)
- *"Lịch sử tìm kiếm để làm gì?"* → Gợi ý lại + phục vụ phân tích hành vi; dedup theo user tránh trùng.

---

# NHÓM 7 — KIỂM THỬ

## 7.1 `testing_pyramid.png` / `testing.mmd` — Tháp test

**① Nói gì**
"Chiến lược test 5 tầng theo mô hình kim tự tháp: đáy là **Unit (3.745 test)** chạy nhanh ~20s với mock; lên trên là Integration, API HTTP, E2E dùng MySQL thật; và FE Component test. Tổng **259 suite / 5.487 test**."

**② Tại sao**
- **Hình tháp:** nhiều unit test (nhanh, rẻ, chạy mọi commit) ở đáy; ít E2E (chậm, đắt) ở đỉnh → cân bằng tốc độ và độ tin cậy. Đúng best practice.
- **Tầng dưới mock, tầng trên DB thật:** unit test cô lập logic; integration/API/E2E kiểm tra tích hợp thật với MySQL.
- **CI chỉ chạy Unit + FE** (không chạy Integration/API/E2E) vì CI không có MySQL service → nói rõ điều này nếu bị hỏi.

**③ Hội đồng hỏi gì**
- *"Vì sao nhiều unit, ít E2E?"* → Unit nhanh/rẻ, chạy mỗi commit; E2E chậm/giòn, chỉ chạy luồng quan trọng. (Nguyên tắc kim tự tháp.)
- *"Mock có làm test thiếu giá trị không?"* → Unit mock để cô lập logic; nhưng có thêm 3 tầng dùng **DB thật** (integration/API/E2E) để bù → không chỉ dựa vào mock.

## 7.2 `testing_coverage.png` / `testing_baseline.png` / bảng coverage

**① Nói gì**
"Độ phủ unit test: statements 99,98%, branches 99,81%, functions 99,91%, lines 100% — vượt threshold 99,7%. Threshold được set cao và enforce trong cấu hình jest."

**② Tại sao**
- Coverage cao + threshold enforce → mỗi PR không được làm tụt coverage → chống hồi quy (regression).

**③ Hội đồng hỏi gì**
- *"Coverage 100% line có nghĩa code không bug?"* → Không. Coverage đo *dòng được chạy qua*, không đảm bảo đúng logic mọi đầu vào. Nó là điều kiện cần, không đủ. **Trả lời trung thực câu này ăn điểm** — đừng khẳng định 100% coverage = không lỗi.
- *"Số test có chạy thật không?"* → Có, runtime ghi rõ từng tầng (~20s unit…); demo được nếu hội đồng yêu cầu.

---

# PHỤ LỤC — 10 câu hội đồng hay hỏi xuyên suốt (chuẩn bị sẵn)

1. **"Đóng góp chính của đề tài là gì?"** → RAG chatbot tư vấn (retrieval + graceful degradation + guardrails) trên nền TMĐT modular monolith, kèm chiến lược test 5 tầng.
2. **"Phần nào tự làm, phần nào dùng thư viện?"** → Logic nghiệp vụ + pipeline RAG + kiến trúc tự làm; LLM/embedding/cổng thanh toán là dịch vụ ngoài tích hợp vào.
3. **"RAG khác gọi thẳng ChatGPT thế nào?"** → RAG đưa sản phẩm thật của shop vào prompt → trả lời theo dữ liệu thật, chống bịa.
4. **"Chống bịa (hallucination) thế nào?"** → Chỉ cho LLM trả lời dựa trên sản phẩm đã retrieve, prompt cấm bịa, temp thấp 0.3, parse + verify output.
5. **"Hệ thống chịu tải bao nhiêu?"** → Thiết kế cho <100 user đồng thời (quy mô đồ án); chưa load test quy mô lớn — thừa nhận thẳng, nêu hướng (cache, scale ngang).
6. **"Bảo mật chatbot (prompt injection)?"** → Guardrails OWASP LLM01, 15 loại, chặn trước retrieval/LLM.
7. **"Tại sao monolith không microservices?"** → Quy mô + team nhỏ; module hóa sẵn để tách sau.
8. **"Điểm yếu / hạn chế của hệ thống?"** → Chuẩn bị trước: chưa đo chatbot định lượng (precision/recall), vector store file JSON chưa scale lớn, chưa load test. **Nêu được hạn chế = trưởng thành kỹ thuật, ăn điểm.**
9. **"Hướng phát triển?"** → Golden test set cho chatbot, chuyển vector DB chuyên dụng, streaming response, đa ngôn ngữ rộng hơn.
10. **"Demo được không?"** → Luôn chuẩn bị 1 kịch bản demo chatbot chạy được + 1 kịch bản LLM-down để show fallback (rất ấn tượng với hội đồng).

---

## Checklist trước khi lên bảo vệ

- [ ] Học thuộc 3 cặp khái niệm dễ bị hỏi: **include vs extend**, **vector search (chatbot) vs SQL filter (shop)**, **IPN vs return URL**.
- [ ] Học thuộc cơ chế **chống overselling** (SELECT FOR UPDATE) và **graceful degradation** (Promise.race + keyword fallback) — 2 điểm nhấn kỹ thuật.
- [ ] Chuẩn bị thẳng thắn phần **hạn chế** (đánh giá định tính, chưa load test).
- [ ] Demo sẵn 2 kịch bản chatbot: thành công + LLM-down fallback.
- [ ] Phân vai 3 người: ai nói kiến trúc/yêu cầu, ai nói RAG, ai nói checkout/test — mỗi người chủ phần mình để trả lời sâu.
