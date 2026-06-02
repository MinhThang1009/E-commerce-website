# Hướng dẫn CHI TIẾT — Hiểu bản chất từng node & từng bảng

> Tài liệu đào sâu, đi kèm [HUONG_DAN_THUYET_TRINH.md](HUONG_DAN_THUYET_TRINH.md) (bản script tổng quan).
> Nguồn sự thật: [`RAG_CHATBOT_PIPELINE.md`](../RAG_CHATBOT_PIPELINE.md) và [`PIPELINE_TRACE_EXAMPLES.md`](../PIPELINE_TRACE_EXAMPLES.md) trong project.
> Mỗi node/dòng bảng có 3 lớp: **Bản chất** (hiểu để nói được, không học vẹt) · **Câu hỏi xoáy** (hội đồng gài) · **Cách trả lời** (câu chốt).

---

## Cách dùng tài liệu này

1. Đọc **Phần A** trước — đó là khung tư duy: pipeline = 7 bước, mỗi bước giải quyết 1 vấn đề riêng. Hiểu *vấn đề* thì không cần học vẹt *giải pháp*.
2. **Phần B** giải thích từng bảng PNG bạn sẽ chiếu.
3. **Phần C** là 8 khái niệm lõi — nếu hiểu được 8 cái này, bạn trả lời được 80% câu hỏi xoáy.
4. Trước khi học từng node, nhớ **1 câu thần chú** trả lời được mọi câu "tại sao tách bước này ra": *"Mỗi bước chặn 1 loại lỗi sớm nhất có thể, để bước sau không phải gánh."*

---

# PHẦN A — RAG PIPELINE: BẢN CHẤT TỪNG NODE

> Pipeline 7 bước. Tư duy xuyên suốt: **rẻ trước, đắt sau**. Việc rẻ (regex, validate) làm trước để loại query xấu; việc đắt (embedding, LLM) chỉ chạy khi thật sự cần.

## Khung 7 bước — phải thuộc

| Bước | Tên | Giải quyết vấn đề gì | Chi phí |
|---|---|---|---|
| ① | Validate | Chặn input rác (rỗng, quá dài, không chữ/số) | Cực rẻ (~0ms) |
| ② | Normalize | User gõ tắt `ip17`, không dấu `gia` → máy không hiểu | Rẻ (regex) |
| ③ | Classify + Gate | Phân loại ý định + chặn injection/off-topic | Rẻ (regex <1ms) |
| ④ | Load Session | Lấy lịch sử để hiểu "cái đó", "nó" | Rẻ (đọc RAM) |
| ⑤ | Retrieve | Tìm sản phẩm liên quan (cái R trong RAG) | Trung bình (embedding + search) |
| ⑥ | Augment + Generate | Nhồi sản phẩm vào prompt → LLM sinh câu trả lời (A + G) | **Đắt nhất** (LLM 2-5s, tính tiền theo token) |
| ⑦ | Persist | Lưu lịch sử (RAM) + analytics (DB) | Rẻ, async |

**Câu hỏi xoáy kinh điển:** *"Tại sao phải chia 7 bước? Gộp lại cho gọn không được à?"*
→ Vì mỗi bước **chặn một loại lỗi tại điểm rẻ nhất**. Nếu không validate ở ① thì query rỗng vẫn chạy tới ⑥ tốn tiền LLM. Nếu không gate ở ③ thì câu "thời tiết hôm nay" cũng gọi LLM. Chia bước = chặn sớm = tiết kiệm tài nguyên + dễ test từng phần độc lập.

---

## ① VALIDATE — `validateMessage()`

**Bản chất:** 3 luật chặn input không xử lý được, **trước khi tốn bất kỳ tài nguyên nào**:
1. Không rỗng sau `trim()`.
2. ≤ 500 ký tự.
3. Có ít nhất 1 chữ/số (regex Unicode `/[\p{L}\p{N}]/u` — nhận cả tiếng Việt có dấu).
Fail → ném `AppError(400)` → HTTP 400, pipeline dừng hẳn.

**Tại sao giới hạn 500 ký tự?** Không phải tùy tiện — đây là **phòng DoS**: embedding và LLM tính phí theo token. Cho gửi 100.000 ký tự = ai đó spam là cháy quota/tiền.

**Tại sao regex phải có flag `u` (Unicode)?** Không có `u`, ký tự `ạ`, `ế` bị coi là "không phải chữ" → câu tiếng Việt thuần như "à ừ" có thể bị từ chối oan. `\p{L}` chỉ chạy được khi bật `u`.

**Câu hỏi xoáy:**
- *"500 ký tự lấy từ đâu? Sao không 1000?"* → Cân bằng: câu hỏi tư vấn thực tế hiếm khi >500 ký tự; đặt thấp để chặn lạm dụng. Là hằng số `MAX_MESSAGE_LENGTH`, chỉnh được.
- *"Validate ở backend, vậy frontend có validate không? Trùng lặp?"* → FE validate cho UX (báo lỗi nhanh), BE validate cho **bảo mật** (không tin client). Bắt buộc cả hai — client có thể bị bypass.
- *"`???!!!` bị chặn ở luật 3, nhưng `a???` thì sao?"* → Qua, vì có 1 chữ `a`. Luật 3 chỉ cần **tối thiểu 1** ký tự có nghĩa, không đòi toàn bộ.

---

## ② NORMALIZE — `expandAbbreviations()`

**Bản chất:** Người Việt gõ tắt và gõ không dấu. `ip17pm` → `iPhone 17 Pro Max`, `gia bao nhieu` → `giá bao nhiêu`, `smartphone` → `điện thoại`. Đây là bước **chuẩn hóa để cả vector search lẫn keyword match hiểu được**. ~50+ pattern, 3 nhóm: brand/chip, EN→VI, không dấu→có dấu.

**Tại sao quan trọng sống còn với nhánh LLM-DOWN?** Keyword match so khớp **chữ-với-chữ** với tên sản phẩm trong DB. Tên DB là "iPhone 17 Pro" — nếu không expand "ip17" thì *không match được gì*. (Nhánh LLM-UP đỡ phụ thuộc hơn vì LLM tự hiểu, nhưng vẫn cần để embedding chính xác.)

**Chi tiết tinh tế — `pm` có 2 pattern:**
- `\bpm\b` (đứng riêng): `ip16 pm` → Pro Max.
- `(?<=\d)pm` (dính sau số): `ip17pm` → `iPhone 17 Pro Max`.
Hai pattern để bắt cả "gõ cách" lẫn "gõ liền".

**Flag `giu`:** `g`=thay tất cả (không chỉ lần đầu), `i`=không phân biệt hoa thường, `u`=Unicode đúng word-boundary cho tiếng Việt.

**Câu hỏi xoáy:**
- *"Sao không để LLM tự hiểu viết tắt, cần gì expand thủ công?"* → (1) Nhánh fallback **không có LLM**, vẫn phải hiểu `ip17`. (2) Expand giúp **embedding/vector** chính xác hơn — LLM hiểu nhưng vector của chuỗi "ip17" thì xa vector "iPhone 17". (3) Rẻ và xác định (deterministic), không tốn token.
- *"Maintain 50 pattern bằng tay có scale không?"* → Hạn chế thật, thừa nhận. Đây là trade-off: pattern phủ các viết tắt phổ biến của ngành (điện thoại/laptop). Hướng mở rộng: học từ search log, hoặc model sửa chính tả. Nhưng với phạm vi đồ án, regex là đủ và minh bạch.
- *"`op` → OPPO, vậy chữ tiếng Việt 'họp' có bị phá thành 'hOPPO'?"* → Không, vì có `\b` (word boundary) + flag `u` + negative lookbehind phòng các từ ghép dính liền. Đây chính là lý do flag `u` bắt buộc.

---

## ③ CLASSIFY & GATE — `classifyIntent()` + `isPromptInjection()`

Đây là bước **nhiều câu hỏi xoáy nhất** sau ⑥. Học rất kỹ.

### ③a `classifyIntent` — phân 6 intent theo THỨ TỰ ƯU TIÊN

**Bản chất:** Match theo thứ tự, **trúng cái đầu return ngay**:
1. `off_topic` (thời tiết, bóng đá, phim…) → 2. `order_inquiry` (đơn, ship) → 3. `policy` (bảo hành, đổi trả) → 4. `pricing` (giá, bao nhiêu) → 5. `product_search` (brand, tư vấn, so sánh) → 6. `general` (mặc định).

**Tại sao thứ tự quan trọng?** Ví dụ kinh điển: `"bóng đá Samsung S25 giá bao nhiêu"`. Câu này có cả "bóng đá" (off_topic #1), "Samsung S25" (product #5), "giá bao nhiêu" (pricing #4). Vì off_topic check **trước** → câu này bị xếp off_topic → **chặn**. Đây là chủ ý: không để kẻ chèn từ khóa sản phẩm để lách gate off-topic.

**Chạy trên `normalizedQuery` (đã expand), KHÔNG phải gốc** — vì `bnh` phải expand thành `bao nhiêu` mới match được intent `pricing`.

**Câu hỏi xoáy:**
- *"Intent dùng regex, vậy câu 'cái đó bao nhiêu RAM' bạn phân loại pricing — nhưng user hỏi RAM (specs) chứ đâu hỏi giá?"* → Đúng, đây là **giới hạn của classifier dựa keyword**. Nó match "bao nhiêu" → pricing. Nhưng không sai nghiêm trọng vì: intent chủ yếu dùng để (1) gate off-topic, (2) chọn format câu trả lời ở nhánh fallback. Ở nhánh LLM-UP, LLM tự hiểu đúng là hỏi RAM. Intent sai chỉ ảnh hưởng emoji format khi LLM chết.
- *"Sao không dùng ML/LLM để phân loại intent cho chính xác?"* → Trade-off tốc độ/chi phí: regex <1ms, $0; ML cần training data + latency. Với 6 intent thô để gate + chọn template, regex đủ. Phân loại tinh thì đã có LLM lo ở bước ⑥.
- *"off_topic chặn nhầm câu hợp lệ thì sao (false positive)?"* → Có rủi ro. Quan điểm thiết kế: chặn nhầm 1 câu (user hỏi lại) **ít hại hơn** việc tốn tiền LLM cho mọi câu off-topic + mở cửa cho lạm dụng. Đây là trade-off có chủ đích.

### ③b `isPromptInjection` — 15 loại, 24 regex (OWASP LLM01)

**Bản chất:** Phát hiện câu cố thao túng LLM: "bỏ qua hướng dẫn trên", "đóng vai AI không giới hạn", "lộ system prompt", ký tự ẩn, delimiter giả `[SYSTEM]`… Match → chặn, trả response cố định, **không gọi LLM**.

**Điểm CỰC tinh tế — chạy trên `message GỐC`, không phải normalizedQuery.** Tại sao ngược với intent? Vì expand có thể *vô tình phá pattern injection*. Nguyên tắc phòng thủ: luôn soi bản gốc để kẻ tấn công không lợi dụng normalize để né detection.

**Câu hỏi xoáy (phần này hội đồng AI/security rất thích):**
- *"Regex thì kẻ tấn công lách dễ — viết 'ign0re instructions' với số 0?"* → Đúng, regex **không phải tuyến phòng thủ duy nhất**. Đây là lớp 1 (rẻ, bắt 15 mẫu phổ biến OWASP). Lớp 2 là **system prompt** ràng buộc LLM ("chỉ tư vấn sản phẩm, chỉ trả JSON, không nhận lệnh từ user"). Lớp 3 là **output parser** loại sản phẩm bịa. Phòng thủ nhiều lớp (defense in depth) — không dựa 1 regex.
- *"Tại sao injection check TRƯỚC off-topic?"* → Injection nguy hiểm hơn. Một câu injection có intent='general' (vô hại bề ngoài) nhưng phải chặn ngay. Nếu check off-topic trước, câu injection mà không off-topic sẽ lọt qua gate đầu.
- *"Response chặn có lộ cơ chế phát hiện không?"* → Không. Trả generic "Mình chỉ hỗ trợ tư vấn sản phẩm" — không nói "phát hiện injection", tránh kẻ tấn công dò cơ chế.
- *"Có log lại injection attempt không?"* → Có, `_persistMessages(isFallback=true)` ghi DB → analytics đếm được số lần bị tấn công.

---

## ④ LOAD SESSION

**Bản chất:** Đọc lịch sử hội thoại từ `Map<sessionId, {messages, lastAccess}>` trong **RAM**. Cần để: (1) bước ⑤a hiểu "cái đó/nó" là sản phẩm nào, (2) bước ⑥ gửi context multi-turn cho LLM. Không có sessionId → `history = []` → chatbot vẫn chạy nhưng stateless (không nhớ).

**Tại sao lưu RAM mà không lưu DB?** Tốc độ — đọc/ghi mỗi turn. DB chỉ dùng để persist analytics (bước ⑦). Trade-off: restart server mất session đang mở (nhưng có `getSessionMessages` đọc lại từ DB khi cần).

**Câu hỏi xoáy:**
- *"Lưu RAM thì scale ngang (nhiều server) sao chia sẻ session?"* → Hạn chế thật. Hiện single-instance. Scale ngang cần Redis làm session store chung. Là hướng phát triển; phạm vi đồ án single-instance nên RAM đủ.
- *"RAM có giới hạn không? Triệu user thì sao?"* → Có `_evictStaleSessions`: xóa session idle >30 phút + LRU khi >500 session. RAM bị chặn trần, không phình vô hạn.
- *"Giữ tối đa 10 turns, tại sao 10?"* → Cân bằng context vs token. Nhiều history = LLM hiểu hơn nhưng tốn token + đắt. 10 turns (20 message) đủ cho hội thoại tư vấn điển hình.

---

## ⑤ RETRIEVE — chữ "R" trong RAG (phần lõi nhất)

Gồm ⑤a (enrich đại từ) và ⑤b (search). Đây là nơi "tìm đúng sản phẩm" — sai ở đây thì LLM dù giỏi cũng trả lời sai.

### ⑤a `_enrichQueryFromHistory` — giải quyết đại từ

**Bản chất:** Vector search **không hiểu đại từ**. "cái đó có bao nhiêu RAM?" — vector của câu này không gần sản phẩm nào cả. Giải pháp: phát hiện đại từ (cái đó/này/kia, nó, so sánh, cả hai, 2 cái) → lấy tên sản phẩm gần nhất từ assistant message trước → **append vào cuối query**. "cái đó có bao nhiêu RAM?" → "cái đó có bao nhiêu RAM? **iPhone 17**".

**Tại sao append vào cuối chứ không thay thế?** Giữ nguyên ý định gốc ("RAM") + thêm ngữ cảnh (iPhone 17) → vector cân cả hai.

**Câu hỏi xoáy:**
- *"Nếu lịch sử có nhiều sản phẩm, lấy cái nào?"* → Lấy sản phẩm đầu tiên trong 1-2 assistant message gần nhất (gần nhất = liên quan nhất). Với "so sánh 2 cái" thì lấy 2.
- *"User hỏi 'cái đó' nhưng turn trước bot trả off-topic, không có sản phẩm?"* → Không có tên SP để append → query giữ nguyên → search như thường (có thể kết quả kém, nhưng không crash).

### ⑤b `_retrieveProducts` — strip negation → song song rewrite ∥ search → fallback

Đây là node phức tạp nhất bước ⑤. 4 ý:

**(1) Strip negation trước khi search.** Embedding không hiểu phủ định: vector("không muốn iPhone") **gần** vector("iPhone") — vì cùng chứa "iPhone". Nếu để nguyên, search "không muốn iPhone" lại trả ra iPhone (ngược ý). Nên strip mệnh đề phủ định khỏi query *dùng cho retrieval*. (Lưu ý: chỉ strip cho retrieval; `finalQuery` vẫn giữ negation để bước ⑥ lọc.)

**(2) `Promise.all`: rewrite (LLM) ∥ hybridSearch — chạy SONG SONG.**

**Tại sao song song chứ không tuần tự (rewrite xong rồi search)?** Giảm latency. Rewrite mất ~3s, search ~1s. Tuần tự = 4s; song song = 3s (max của hai). Cái giá: nếu rewrite thành công và khác query gốc, ta phải search **lần 2** với query đã rewrite → tốn 1 search thừa. Nhưng search rẻ (<50ms), đổi lấy việc không bao giờ phí thời gian chờ — đáng.

**(3) Nếu rewrite ≠ gốc → search lần 2, kết quả lần 2 thay thế lần 1** (trừ khi lần 2 rỗng thì giữ lần 1). Rewrite giống gốc → bỏ qua lần 2.

**(4) Fallback:** nếu 0 sản phẩm đạt ngưỡng cosine 0.45 → hạ ngưỡng xuống **0**, lấy top 3, gắn cờ `lowConfidence=true`. Mục đích: thà đưa LLM 3 ứng viên yếu + cờ cảnh báo, còn hơn đưa rỗng khiến LLM **bịa**.

**Khi LLM DOWN:** `rewriteQuery` không có provider → dùng `fuzzyExpandQuery()` (sửa typo bằng so khớp prefix + edit-distance với catalog) thay thế.

**Câu hỏi xoáy (rất hay bị hỏi):**
- *"Tại sao ngưỡng 0.45? Đo đạc hay đoán?"* → Là `DEFAULT_MIN_SCORE`, ngưỡng cosine để coi là "đủ liên quan". Tinh chỉnh theo quan sát trên catalog thật. Thừa nhận: chưa tối ưu bằng grid-search có nhãn — là hướng cải thiện. Quá cao → bỏ sót; quá thấp → nhiễu.
- *"Fallback lấy top 3 score thấp, chẳng phải là đưa rác cho LLM?"* → Có cờ `lowConfidence=true`. Prompt builder thêm `⚠️[low confidence]` → LLM đọc cờ này, hiểu "mấy SP này không chắc liên quan" → trả "shop chưa có" thay vì bịa giá. Cờ là chìa khóa chống hallucination — xem [Path 10].
- *"Search 2 lần lãng phí không?"* → Search lần 1 (song song với rewrite) đóng vai bảo hiểm: nếu rewrite fail/timeout, ta vẫn có kết quả. Chỉ "thừa" khi rewrite thành công — nhưng search rẻ nên đổi lấy latency thấp là hời.

### Hybrid Scoring — cách xếp hạng sản phẩm (CỐT LÕI, học kỹ)

**Bản chất:** Mỗi sản phẩm chấm điểm bằng **2 phương pháp độc lập**:
- **Semantic (cosine):** query → vector 1024 chiều → so với vector sản phẩm → điểm 0-1. Bắt được "ý nghĩa" ("laptop sinh viên" gần "laptop mỏng nhẹ giá rẻ" dù không trùng chữ).
- **Keyword (kiểu BM25):** tách từ → match tên sản phẩm (×3 trọng số) + mô tả (×1). Bắt được "đúng tên model" (iPhone 17 Pro).

**Cách gộp — KHÔNG lấy max, mà:**
- SP trong kết quả vector: `score = cosine + 0.05` nếu **cũng** có trong kết quả keyword (overlap boost — 2 phương pháp cùng chỉ ra = đáng tin hơn).
- SP chỉ có ở keyword (không ở vector): `score = minScore + (keywordScore/maxKeyword) × 0.15`, gắn `lowConfidence`.
- Gộp 2 danh sách, sort giảm dần, lấy top N.

**Tại sao cần CẢ hai?** Cosine giỏi hiểu ý nhưng dở khớp tên chính xác (số model). Keyword giỏi khớp tên nhưng không hiểu ý. Hybrid = lấy điểm mạnh của cả hai. Ví dụ thật: "iPhone 17 Pro" được cosine 0.7067 + overlap 0.05 = 0.7567; còn "Xiaomi Redmi Note 15 Pro" chỉ match keyword "Pro" → score 0.4667 + cờ lowConfidence.

**Câu hỏi xoáy:**
- *"Trọng số tên ×3 lấy đâu ra?"* → Heuristic: tên sản phẩm mang tín hiệu mạnh hơn mô tả. User gõ "iPhone" thì khớp ở tên quan trọng hơn khớp trong đoạn mô tả dài. Chưa tối ưu bằng học máy — heuristic hợp lý.
- *"+0.05 overlap boost, con số này có cơ sở?"* → Là tinh chỉnh thủ công để SP được cả 2 phương pháp tìm ra nhỉnh hơn SP chỉ 1 phương pháp tìm ra. Nhỏ để không lật ngược thứ hạng cosine, đủ để phá thế hòa.
- *"BM25 thật hay 'kiểu BM25'?"* → "BM25-inspired" — dùng ý tưởng term frequency + trọng số trường, không phải công thức BM25 đầy đủ (không có IDF/độ dài tài liệu chuẩn hóa). Trung thực gọi là "inspired".

---

## ⑥ AUGMENT & GENERATE — chữ "A" và "G" (đắt nhất, nhiều câu hỏi nhất)

**Điểm kiến trúc quan trọng nhất phải nói được:** toàn bộ ⑥ bọc trong `Promise.race(augmentAndGenerate, budgetTimer)`. Nếu LLM (cộng dồn xoay vòng provider) vượt ngân sách `LLM_TOTAL_TIMEOUT_MS` → bỏ cuộc, trả keyword fallback. **User không bao giờ phải chờ treo.** Đây là xương sống của "graceful degradation".

Rẽ tại `N6-check`: `providers.length === 0` → **LLM DOWN** (keyword). Ngược lại → **LLM UP** (RAG đầy đủ).

### ⑥a AUGMENT (nhồi context vào prompt) — 4 node con

1. **`_getCatalogData`:** load danh sách brand + category từ DB (cache 5 phút). Để LLM biết shop bán gì → không recommend "Google Pixel" khi shop không bán.
2. **`_sanitizeMessage`:** làm sạch input user trước khi ghép vào prompt — `"`→`'` (tránh phá format), gộp newline, cắt 500 ký tự.
3. **`buildAugmentedPrompt`:** nhồi `danh sách SP + thông tin shop + câu hỏi + quy tắc + format JSON output` thành 1 prompt. **Đây chính là chữ "A" trong RAG.**
4. **Build `messages[]`:** `[system prompt, ...history, {user: augmented prompt}]`.

**Tại sao bước Augment là linh hồn của RAG?** Không có nó, LLM trả lời bằng kiến thức huấn luyện chung → **bịa tên/giá sản phẩm**. Augment đưa **dữ liệu thật của shop** vào prompt → LLM chỉ nói về sản phẩm có thật.

**Câu hỏi xoáy:**
- *"Sanitize để chống prompt injection à?"* → Một phần, nhưng injection đã chặn ở ③. Sanitize ở đây chủ yếu **chống phá format** (dấu ngoặc kép phá JSON template) + tiết kiệm token. Là làm sạch kỹ thuật, không phải tuyến bảo mật chính.
- *"Catalog cache 5 phút, lỡ admin thêm SP mới thì sao?"* → Trong 5 phút LLM chưa biết brand mới — chấp nhận được vì brand/category đổi rất chậm. Trade-off: giảm tải DB (không query mỗi request) đổi lấy độ trễ cập nhật 5 phút.

### ⑥b GENERATE (gọi LLM + parse) — chữ "G"

5. **LLM HTTP POST:** `temp=0.3, max_tokens=800, response_format=json_object`. **Provider rotation** theo HTTP status:
   - **Retry** (`continue` sang provider khác): 429 (rate limit), 402 (hết quota), 500/503 (server lỗi), network error → lỗi *tạm thời*.
   - **Dừng** (`break`): 400 (request sai), 401 (key sai) → lỗi *cố định*, thử lại cũng vậy.
6. **`parseLLMOutput`:** `JSON.parse` → match từng tên SP trong `matchedProducts` với danh sách retrieve ở ⑤ → **loại SP nào LLM bịa** (không có trong retrieved = hallucination). Thêm `extractProductsFromText` quét phần văn bản: nếu LLM nhắc tên SP trong câu trả lời nhưng quên bỏ vào JSON → bổ sung.
7. Nếu **mọi provider fail** → `simpleKeywordMatch` (dùng products đã retrieve ở ⑤, không search lại).

**Tại sao temp=0.3 thấp?** Nhiệt độ = độ ngẫu nhiên/sáng tạo. Tư vấn bán hàng cần **chính xác, ổn định, ít bịa**, không cần sáng tạo. 0.3 = gần như xác định, bám dữ liệu.

**Tại sao `response_format=json_object`?** Ép LLM trả JSON đúng cấu trúc `{response, matchedProducts, suggestions, intent}` → code parse được, frontend render card được. Không ép → LLM trả văn xuôi tự do, parse vỡ.

**Câu hỏi xoáy (TRỌNG TÂM — chuẩn bị thật kỹ):**
- *"Chống hallucination (LLM bịa) thế nào?"* → **3 lớp**: (1) Augment chỉ đưa SP có thật + quy tắc "chỉ recommend SP trong list". (2) temp thấp 0.3. (3) `parseLLMOutput` đối chiếu lại từng tên SP với danh sách retrieved, **loại cái nào không có thật**. Đây là câu gần như chắc chắn bị hỏi.
- *"LLM vẫn bịa giá tiền trong câu văn thì sao?"* → Prompt đưa giá thật; quy tắc cấm bịa. Phần text khó kiểm soát tuyệt đối — thừa nhận. Nhưng SP hiển thị (card) lấy giá từ DB qua `matchedProducts`, không lấy từ text LLM → giá hiển thị luôn đúng.
- *"Provider rotation — sao phân biệt retry với break?"* → Lỗi tạm thời (429/503/network) thì provider khác có thể OK → thử tiếp. Lỗi cố định (400 format sai/401 key sai) thì provider nào cũng lỗi y vậy → dừng, khỏi phí thời gian.
- *"max_tokens=800 có cắt cụt câu trả lời không?"* → Đủ cho tư vấn 2-3 sản phẩm + giải thích. Đặt trần để chặn chi phí + chặn LLM lan man. Trade-off có chủ đích.
- *"extractProductsFromText để làm gì, thừa không?"* → Không thừa. LLM đôi khi nhắc "bạn nên xem thêm Samsung S25" trong văn bản nhưng quên đưa vào JSON `matchedProducts`. Node này quét text, bổ sung SP đó (nếu có thật) → user thấy đầy đủ card.

### Nhánh LLM DOWN — `simpleKeywordMatch` (8 bước)

**Bản chất:** Khi không có LLM, đây là **Information Retrieval thuần** (không phải RAG — không có Generate). 8 bước: tokenize+scoring → version filter → brand coherence → negation filter → price filter → category prefix → sort+dedup → intent-aware format (💰📋🔍🌟).

**Phải nói đúng:** nhánh này **không phải RAG**, mà là **degraded mode**. Trong luận văn framing là *"RAG with graceful degradation"* — trung thực, không gọi là "pure RAG".

**Vài node con đáng chú ý:**
- **Version filter:** trích số model ("S25" → 25), lọc SP không chứa số đó. *Hạn chế: chỉ nhìn SỐ, không phân biệt A25 với S25* → bù bằng scoring (S25 đúng được +10 ở tên, xếp trên A25).
- **Brand coherence:** nếu brand trong query (vd "iPhone") không xuất hiện trong kết quả sau lọc → trả "chưa có" thay vì recommend nhầm Samsung. Xem ví dụ "iPhone 25" → notFound.
- **Negation filter:** chỉ nhận **pattern cứng** ("không muốn/thích/dùng", "tránh", "avoid"). "không **cần** iPhone" hay "chán Samsung" → KHÔNG lọc được (không khớp pattern). Đây là điểm yếu trung thực của fallback.
- **Intent-aware format:** detect intent từ **10 từ đầu** (tránh nhiễu bởi history đã append ở ⑤a).

**Câu hỏi xoáy:**
- *"Fallback có phải RAG không?"* → Không. Là IR thuần (retrieve + template), thiếu Generate. Gọi đúng tên là "graceful degradation mode".
- *"Negation 'không cần iPhone' không lọc được — đó là bug?"* → Là **giới hạn thiết kế** của fallback, không phải bug. Fallback dùng pattern cứng để nhanh và xác định. "không cần" mơ hồ (không hẳn loại trừ). Ở nhánh LLM-UP, LLM hiểu đúng. Fallback chỉ cần "đủ tốt" khi LLM chết.
- *"Tại sao detect intent từ 10 từ đầu mà không cả câu?"* → Vì ⑤a đã append tên SP từ history vào cuối query. Nếu detect intent trên cả câu, history cũ có thể làm lệch intent. 10 từ đầu = ý định gốc của user.

---

## ⑦ PERSIST

**Bản chất:** 2 việc, đều không ảnh hưởng response đã trả:
- **7a Session (RAM):** ghi turn mới vào Map, cắt giữ 10 turns, gọi `_evictStaleSessions` (xóa idle >30 phút + LRU >500 session).
- **7b DB (analytics):** `ChatMessage.bulkCreate([user, assistant])` — **fire-and-forget**: `.catch()` chỉ log, không throw. DB lỗi → user vẫn có câu trả lời.

**Tại sao fire-and-forget?** Analytics là "nice to have". Nếu để lỗi ghi DB làm hỏng response thì đánh đổi sai: hy sinh trải nghiệm chính (trả lời) vì việc phụ (thống kê). Ưu tiên UX.

**Câu hỏi xoáy:**
- *"Fire-and-forget, lỡ mất dữ liệu analytics thì sao?"* → Chấp nhận mất một phần analytics khi DB trục trặc — đúng ưu tiên. Câu trả lời cho user quan trọng hơn dòng log thống kê.
- *"Evict LRU là gì?"* → Least Recently Used: khi >500 session, xóa session lâu chưa dùng nhất trước. Giữ RAM có trần.
- *"Response bị chặn (injection/off-topic) có persist không?"* → Có, với cờ `isFallback=true` → analytics đếm được số lần bị tấn công/hỏi ngoài phạm vi.

---

## Bảng so sánh LLM UP vs LLM DOWN (phải thuộc — hội đồng hay hỏi)

| Khía cạnh | LLM UP (RAG đủ) | LLM DOWN (fallback) |
|---|---|---|
| Bước ①-⑤ | **Giống hệt** | **Giống hệt** |
| Sinh câu trả lời | LLM, văn tự nhiên | Template + emoji 💰📋🔍🌟 |
| Sort theo giá | ✅ | ❌ |
| Brand lạ (Google, Huawei) | ✅ nhận ra | ❌ chỉ brand trong DB |
| Đa tiêu chí ("nhẹ + pin lâu + <20tr") | ✅ hiểu | ❌ chỉ match keyword |
| So sánh chi tiết | ✅ bảng so sánh | ❌ chỉ liệt kê |
| Slang ("25 củ") | ✅ | ❌ |
| Negation ngầm | ✅ | ⚠️ chỉ pattern cứng |

**Câu chốt:** "Bước tiền xử lý và retrieval giống hệt nhau ở cả 2 chế độ — chỉ khác ở bước sinh câu trả lời. Nghĩa là dù LLM chết, chatbot vẫn **tìm đúng sản phẩm**, chỉ là trình bày kém tự nhiên hơn. Đó là graceful degradation."

---

# PHẦN B — GIẢI THÍCH TỪNG BẢNG (PNG)

## B.1 `functional_req.png` — Yêu cầu chức năng (3 cột)

| Cột | Nội dung | Câu hỏi xoáy | Trả lời |
|---|---|---|---|
| Người dùng cuối | Duyệt/lọc/tìm, giỏ, đăng nhập OTP, đặt hàng, thanh toán MoMo/VNPay, theo dõi đơn, đánh giá, chatbot | "OTP gửi qua đâu? Hết hạn bao lâu?" | Email (Nodemailer); OTP có TTL (hằng số OTP), chống brute-force bằng rate-limit |
| **Chatbot AI** (trọng tâm) | NLP Việt+Anh, hiểu viết tắt/sai chính tả, vector retrieval, sinh phản hồi + gợi ý, multi-turn, thêm giỏ qua chat, từ chối off-topic | "Thêm giỏ qua chat hoạt động sao?" | Chatbot trả JSON có productId → FE render card có nút thêm giỏ → gọi cart API thường |
| Quản trị | CRUD SP + biến thể (xóa mềm), tồn kho (chống race), đơn hàng, user, doanh thu | "Xóa mềm là gì? Sao không xóa hẳn?" | `deletedAt` thay vì DELETE — giữ lịch sử đơn hàng tham chiếu SP cũ, khôi phục được |

**Câu hỏi xoáy chung:** *"Đâu là đóng góp riêng, đâu là chuẩn?"* → Cột giữa (chatbot) + kiến trúc + test là đóng góp; cột trái/phải là nền tảng TMĐT chuẩn.

## B.2 `nfr_table.png` — Yêu cầu phi chức năng (4 dòng)

| Dòng | Con số phải nhớ | Câu hỏi xoáy | Trả lời |
|---|---|---|---|
| Hiệu năng | CRUD <200ms (<100 user đồng thời); Hybrid Search <50ms (<10k SP); Chatbot 2-5s | "Sao chatbot chậm 2-5s?" | Phần lớn độ trễ ở LLM bên ngoài (không kiểm soát được); phần mình kiểm soát (retrieval) <50ms. Có loading state. |
| Bảo mật | JWT access 15 phút, bcrypt cost 12, httpOnly cookie, rate-limit chatbot 20/60s, HMAC callback | "bcrypt cost 12 nghĩa là?" | 2¹² vòng hash (~250ms) — đủ chậm chống brute-force, đủ nhanh cho UX |
| Độ tin cậy | Đặt hàng + trừ kho ACID; IPN idempotent; chatbot fallback | "ACID đảm bảo điều gì cụ thể?" | Trừ kho + tạo đơn trong **1 transaction** — hoặc cả hai thành công, hoặc rollback cả hai. Chống trừ kho mà đơn không tạo. |
| Bảo trì | Modular monolith 17 module; embedding fallback 3 provider | "Modular monolith bảo trì tốt ở chỗ nào?" | Ranh giới module rõ → sửa/test độc lập; pre-commit hook chặn import chéo |

**Câu hỏi xoáy nặng nhất:** *"Các con số (200ms, 50ms, 2-5s) đo thực hay ước lượng?"* → Trả lời trung thực theo thực tế nhóm. Nếu đo bằng tay/Postman thì nói vậy; nếu là target thiết kế thì nói "mục tiêu thiết kế, kiểm bằng quan sát thủ công, chưa load test có công cụ chuyên dụng (k6/JMeter)". **Đừng nói đã benchmark nếu chưa.**

## B.3 `node_table.png` — Bảng 9 node RAG

Bảng này = bản rút gọn của PHẦN A. Mỗi node đã giải thích bản chất ở trên. Khi chiếu, chỉ cần:
- Chỉ vào màu: ⑤ xanh = Retrieve, ⑥ vàng = Augment, ⑦ lục = Generate, đỏ = Blocked.
- Đọc ghi chú dưới cùng: *"nhánh fallback bỏ qua ⑥⑦ → RAG with graceful degradation"* — đây là câu ăn điểm.

**Câu hỏi xoáy:** *"9 node này map sang R-A-G thế nào?"* → ①-④ = Preprocessing, ⑤ = **R**etrieve, ⑥ = **A**ugment + **G**enerate, ⑦ = Post-process. Nhánh chặn (③) và fallback (⑥ keyword) là 2 đường tắt.

## B.4 `rag_eval_table.png` — Bảng 4.4 Đánh giá (5 nhóm kịch bản)

| Nhóm | Kết quả | Bản chất "tại sao kết quả vậy" |
|---|---|---|
| Tìm kiếm ngữ nghĩa ("SV cần laptop nhẹ <20tr") | Tốt | Hybrid search (cosine) hiểu mô tả đa tiêu chí |
| Tên model ("iPhone 17 giá?") | Tốt | Keyword + version extraction khớp đúng đời máy |
| Viết tắt/sai chính tả ("ip17pm") | Tốt | `expandAbbreviations` chuẩn hóa trước search |
| So sánh ("iPhone 17 Pro vs S25 Ultra") | **Khá** | Cần LLM để sinh bảng so sánh; LLM chết → chỉ liệt kê |
| Ngoài phạm vi ("thời tiết") | Tốt | Off-topic gate chặn nhanh, không tốn LLM |

**Thang điểm:** Tốt = pass cả LLM UP và DOWN; Khá = chỉ đầy đủ khi LLM UP.

**Câu hỏi xoáy (CỰC QUAN TRỌNG):**
- *"Đây là đánh giá định tính. Có số liệu định lượng (precision/recall/accuracy) không?"* → **Thừa nhận thẳng:** hiện đánh giá theo kịch bản pass/fail trên 53 edge case + 22 path trace, **chưa** có golden test set gắn nhãn để tính precision/recall. Hướng phát triển: xây test set → đo Recall@K cho retrieval, đo tỉ lệ hallucination. *Chuẩn bị câu này — gần như chắc bị hỏi và là điểm yếu lớn nhất của phần đánh giá.*
- *"53 edge case test thủ công hay tự động?"* → Có script `test-edge-cases.py` chạy qua API. **Nói đúng thực tế nhóm đã làm.**
- *"Sao chỉ 5 nhóm? Mẫu nhỏ vậy đại diện được không?"* → 5 nhóm là **phân loại**, mỗi nhóm gồm nhiều edge case (tổng 53). Bao phủ các dạng query thực tế chính. Thừa nhận mẫu còn nhỏ so với chuẩn nghiên cứu.

## B.5 Bảng Testing (`testing_tables.png` / pyramid / coverage)

| Bảng | Nội dung | Câu hỏi xoáy | Trả lời |
|---|---|---|---|
| 5 tầng | Unit 3.745 / Integration 184 / API 700 / E2E 100 / FE 758 = **5.487 test** | "Sao Unit nhiều, E2E ít?" | Kim tự tháp: unit nhanh/rẻ chạy mỗi commit; E2E chậm/giòn chỉ chạy luồng chính |
| Môi trường | Unit dùng mock; Integration/API/E2E dùng MySQL thật (port 9996-9998) | "Mock làm test mất giá trị?" | Unit mock để cô lập logic; 3 tầng trên dùng DB thật để bù |
| Coverage | stmt 99.98%, branch 99.81%, func 99.91%, line 100% (threshold 99.7%) | "100% line = không bug?" | **KHÔNG.** Coverage đo dòng *được chạy*, không đảm bảo đúng logic mọi input. Điều kiện cần, không đủ. |

**Câu hỏi xoáy nặng:** *"CI có chạy hết 5.487 test không?"* → Không. CI chỉ chạy **Unit + FE** (vì CI không có MySQL service). Integration/API/E2E chạy **local**. Trung thực điều này — đừng nói CI chạy tất cả.

---

# PHẦN C — 8 KHÁI NIỆM LÕI (hiểu 8 cái này = trả lời 80% câu xoáy)

### C1. Graceful degradation (suy giảm có kiểm soát)
Hệ thống **không sập khi 1 thành phần chết** — chuyển sang chế độ kém hơn nhưng vẫn chạy. Ở đây: LLM chết → keyword fallback. Cơ chế: `Promise.race(LLM, budgetTimer)`. Câu chốt: "Chatbot luôn trả lời được, kể cả khi LLM down."

### C2. RAG vs IR
**RAG** = Retrieve + Augment + **Generate** (có LLM sinh văn). **IR** (Information Retrieval) = chỉ retrieve + template, không Generate. Nhánh fallback của ta là IR, không phải RAG → gọi đúng là "RAG with graceful degradation".

### C3. Hallucination & cách chặn
LLM "bịa" thông tin không có thật. Chặn 3 lớp: (1) chỉ đưa SP thật vào prompt + cấm bịa, (2) temp thấp 0.3, (3) parser đối chiếu loại SP không có trong retrieved.

### C4. Defense in depth (phòng thủ nhiều lớp) — cho injection
Không dựa 1 cơ chế. Lớp 1: regex 15 mẫu (③). Lớp 2: system prompt ràng buộc LLM. Lớp 3: output parser. Một lớp thủng còn lớp khác.

### C5. Chặn sớm — rẻ trước đắt sau
Validate/normalize/gate (rẻ, regex) chạy trước retrieval/LLM (đắt). Query xấu bị loại ở điểm rẻ nhất → không tốn tiền LLM.

### C6. Idempotency (cho IPN thanh toán)
Một thao tác lặp nhiều lần cho **cùng kết quả**. Cổng thanh toán có thể gọi IPN nhiều lần → phải kiểm tra "đã xử lý chưa", tránh tăng usedCount/trừ kho 2 lần.

### C7. ACID + SELECT FOR UPDATE (cho checkout)
Trừ kho + tạo đơn trong **1 transaction** (ACID — toàn bộ hoặc không gì). `SELECT FOR UPDATE` khóa dòng tồn kho → 2 đơn không trừ cùng lúc → **chống overselling**.

### C8. Fire-and-forget
Tác vụ phụ (ghi analytics) chạy bất đồng bộ, lỗi không ảnh hưởng luồng chính. Đánh đổi: ưu tiên trải nghiệm chính (trả lời) hơn việc phụ (thống kê).

---

## Chiến thuật phòng thủ chung khi bị hỏi xoáy

1. **Câu "tại sao không dùng X hiện đại hơn?"** (microservices, vector DB, ML intent…) → Luôn trả: "X mạnh hơn nhưng thừa cho **quy mô đồ án + team nhỏ**. Chọn giải pháp đơn giản đủ dùng, có ranh giới để nâng cấp lên X sau. Đây là kỹ thuật ra quyết định, không phải không biết X."
2. **Câu "con số này đo thật không?"** → Nói đúng cách đo. Chưa đo → "mục tiêu thiết kế, chưa benchmark công cụ chuyên dụng". **Không bịa benchmark.**
3. **Câu "điểm yếu là gì?"** → Có sẵn danh sách: đánh giá chatbot định tính chưa định lượng; vector store file JSON chưa scale; session RAM chưa scale ngang; negation fallback chỉ pattern cứng. **Nêu được điểm yếu = trưởng thành kỹ thuật, ăn điểm.**
4. **Bị dồn vào thế bí** → "Đây là hướng em chưa xử lý hết; cách tiếp cận sẽ là…". Không vòng vo, không bịa.
