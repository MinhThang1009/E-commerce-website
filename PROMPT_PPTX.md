# Prompt: Tạo slide thuyết trình từ codebase TechStore e-commerce website

---

## ⚠️ NGUYÊN TẮC BẤT BIẾN — ĐỌC TRƯỚC KHI LÀM BẤT CỨ ĐIỀU GÌ

> **Chưa chắc chắn về bất kỳ thông tin nào → PHẢI đọc lại file `.md` và file code liên quan để xác minh — KHÔNG được tự ý bịa đặt, suy đoán, hay tiếp tục mà không có căn cứ từ codebase thực tế.**

Nguyên tắc này áp dụng tuyệt đối cho mọi nội dung, mọi slide, mọi thời điểm trong quá trình làm việc — không có ngoại lệ.

---

## Thông tin khóa luận

| Trường | Nội dung |
|---|---|
| **Sinh viên thực hiện** | Ngô Văn Minh Thắng |
| **MSSV** | 20020155 |
| **Cán bộ hướng dẫn** | TS. Lê Thị Hợi |
| **Tên đề tài** | Xây dựng website thương mại điện tử thiết bị công nghệ tích hợp AI Chatbot hỗ trợ tư vấn sản phẩm |
| **File template** | `TEMPLATE_SLIDE.pptx` |
| **File output** | `20020155_NgoVanMinhThang_Slide.pptx` |

---

## Quy ước ngôn ngữ

- **Thuật ngữ kỹ thuật:** giữ nguyên tiếng Anh (ví dụ: Modular Monolith, RAG, Hybrid Search, Vector Store, Embedding, JWT, EventBus, DI, ORM...)
- **Toàn bộ nội dung còn lại:** viết bằng tiếng Việt có dấu đầy đủ, không viết tắt không dấu

---

## Tiêu chuẩn thiết kế — Tư duy và kỹ năng của người làm slide 10 năm kinh nghiệm

Sử dụng toàn bộ skills, tools và vision của một người làm slide PowerPoint chuyên nghiệp 10 năm kinh nghiệm. Mọi quyết định thiết kế phải có chủ đích, không làm qua loa.

### Visual hierarchy
- Tiêu đề slide phải đủ lớn, nổi bật, phân biệt rõ với body text
- Body text tối thiểu **18pt** — đảm bảo đọc được khi chiếu lên màn hình lớn
- Phân cấp rõ ràng: tiêu đề → subtitle → bullet chính → bullet phụ

### Mật độ nội dung
- **Tối đa 6–7 bullet points mỗi slide** — nếu nhiều hơn, tách sang slide mới
- Mỗi bullet tối đa **8–10 từ** — dùng keyword và cụm từ, không viết câu đầy đủ
- **Mỗi slide chỉ truyền tải một ý chính** — nếu có nhiều ý quan trọng ngang nhau, tách slide
- Số liệu nổi bật (5.487 test cases, coverage 99,7%, 17 modules...) phải được **highlight** bằng font lớn hơn, bold, hoặc màu nhấn

### Whitespace và căn chỉnh
- Padding đủ rộng — nội dung không được sát viền slide
- Tất cả elements căn theo grid nhất quán — không có gì lệch trục
- Khoảng cách giữa các elements đồng đều, không chỗ rộng chỗ hẹp

### Sơ đồ và hình ảnh
- Sơ đồ PNG phải đủ lớn để **đọc được tất cả các node và label** khi trình chiếu — không thu nhỏ quá mức
- Cân bằng giữa text và visual — không slide nào chỉ toàn chữ, không slide nào hình quá nhỏ không đọc được
- Ưu tiên bảng so sánh thay vì danh sách khi cần đối chiếu nhiều items

### Màu sắc và style
- Bám sát hoàn toàn color palette của template — không tự ý thêm màu mới
- Màu nhấn (accent) chỉ dùng cho thông tin quan trọng, không dùng tràn lan
- Contrast đủ cao giữa text và background — đảm bảo dễ đọc

### Kiểm tra tổng thể cuối cùng
Sau khi hoàn thành tất cả slides, thực hiện **một lượt review toàn bộ deck** trước khi lưu file output:
- Nhất quán về font, màu, kích thước giữa tất cả slides
- Không có slide nào bị tràn nội dung, lệch layout, hoặc hình bị vỡ
- Slide numbering đúng và liên tục
- Không còn sót nội dung của đề tài cũ (JobFinder)

---

## Mục tiêu

Đọc kỹ toàn bộ context của project TechStore, tham khảo 2 file slide mẫu, sau đó chỉnh sửa trực tiếp vào file `TEMPLATE_SLIDE.pptx`:

- **Giữ nguyên hoàn toàn:** thiết kế, font chữ, màu sắc, phong cách trình bày của template gốc
- **Thay toàn bộ nội dung:** bằng nội dung thực tế của project TechStore (website e-commerce tích hợp chatbot AI) — tất cả đều phải có căn cứ từ codebase và file `.md`
- **Cấu trúc linh hoạt:** có thể thêm slide mới, mục cha, mục con nếu nội dung TechStore cần — không bị giới hạn bởi số lượng slide hay cấu trúc hiện có của template
- **Kiểm tra từng slide** đạt yêu cầu trước khi chuyển sang slide tiếp theo

---

## Bước 1 — Đọc toàn bộ context của project

Đọc kỹ toàn bộ nội dung của **7 file** sau ở thư mục root của project:

1. `CLAUDE.md`
2. `README.md`
3. `STRUCTURE.md`
4. `TESTING_STRATEGY.md`
5. `PIPELINE_TRACE_EXAMPLES.md`
6. `RAG_CHATBOT_PIPELINE.md`
7. `DIAGRAMS.md`

> **Lưu ý quan trọng:**
> - Tất cả 7 file đều phải đọc kỹ, không được bỏ qua hoặc đọc lướt bất kỳ file nào.
> - Các file trên chứa liên kết đến các file `CLAUDE.md` con — hãy đọc kỹ toàn bộ các file `CLAUDE.md` con đó luôn, vì chúng chứa nội dung và đường dẫn đến các **file code thực tế** cần đọc thêm.
> - **Không chỉ đọc `.md` — phải đọc cả file code liên quan** khi chưa chắc chắn về một chi tiết kỹ thuật (ví dụ: cách hoạt động của Hybrid Search, Vector Store, Embedding chain, seed data, pipeline RAG...). Đọc file code là bắt buộc khi `.md` chưa đủ để xác nhận.
> - `DIAGRAMS.md` là nguồn sơ đồ authoritative — tất cả sơ đồ đã có sẵn Mermaid code chuẩn, verified trực tiếp từ source code thực tế. Khi cần sơ đồ cho slide, ưu tiên lấy từ file này trước, không tự vẽ lại.
> - `RAG_CHATBOT_PIPELINE.md` + `DIAGRAMS.md` chứa toàn bộ pipeline RAG 7 bước (43 nodes, 53 edge cases). Khi làm slide về AI chatbot, bám sát 100% 2 file này.
> - `PIPELINE_TRACE_EXAMPLES.md` chứa 22 path trace + 43 node reference chi tiết — dùng để minh hoạ cụ thể pipeline chatbot trong slide.
> - `TESTING_STRATEGY.md` chứa chiến lược kiểm thử 5 tầng (259 suites, 5.487 test cases). Các slide về kiểm thử phải bám sát file này và đọc thêm file code test tương ứng nếu cần.

Sau khi đọc xong, **tóm tắt lại** những điểm chính đã hiểu về project (mục đích, kiến trúc, các thành phần chính, pipeline, sơ đồ...) và **chờ xác nhận** trước khi chuyển sang Bước 2.

---

## Bước 2 — Đọc kỹ 2 file slide mẫu tham khảo

Đọc kỹ 2 file slide mẫu sau để nắm được:

- Cấu trúc và bố cục tổng thể của bài slide
- Số lượng slide và cách phân chia các mục
- Cách trình bày nội dung văn bản trong từng slide
- Cách sử dụng hình ảnh và sơ đồ minh họa trong từng mục
- Font chữ, cỡ chữ, màu sắc, căn chỉnh cần giữ nguyên

**Hai file mẫu:**

- `22026503_ThanVietAnh_Slide.pptx`
- `22021202_VuVanHuy_Slide.pptx`

> **Lưu ý:** `TEMPLATE_SLIDE.pptx` có cùng thiết kế và bố cục với `22021202_VuVanHuy_Slide.pptx`. Toàn bộ nội dung hiện tại trong template là của đề tài JobFinder (tìm việc làm) — **không liên quan đến TechStore**. Nhiệm vụ là thay thế toàn bộ nội dung đó bằng nội dung TechStore, giữ nguyên thiết kế.
>
> **Thứ tự ưu tiên giữa 2 file mẫu:**
> - `22021202_VuVanHuy_Slide.pptx` = **PRIMARY** — đây chính là template gốc, ưu tiên tuyệt đối về thiết kế, font, màu sắc, layout
> - `22026503_ThanVietAnh_Slide.pptx` = **SECONDARY** — chỉ tham khảo thêm về cách phân chia nội dung, cách trình bày từng mục; không áp dụng thiết kế của file này
> - Khi 2 file có cách trình bày khác nhau cho cùng một loại nội dung → ưu tiên theo VuVanHuy

Sau khi đọc xong, **tóm tắt lại** cấu trúc, số lượng slide, các mục chính và chuẩn trình bày rút ra từ 2 file mẫu, sau đó **chờ xác nhận** trước khi chuyển sang Bước 3.

---

## Bước 3 — Chỉnh sửa trực tiếp vào file template

Sau khi đã được xác nhận ở Bước 1 và Bước 2, tiến hành **edit trực tiếp vào file `TEMPLATE_SLIDE.pptx`**.

### Thông tin cố định điền vào Slide 1

| Trường | Giá trị |
|---|---|
| Sinh viên thực hiện | Ngô Văn Minh Thắng |
| Mã sinh viên | 20020155 |
| Cán bộ hướng dẫn | TS. Lê Thị Hợi |
| Tên đề tài | Xây dựng website thương mại điện tử thiết bị công nghệ tích hợp AI Chatbot hỗ trợ tư vấn sản phẩm |

### Quy trình làm việc theo từng slide

Với **mỗi slide**, thực hiện theo thứ tự sau:

1. Đọc nội dung hiện có trong slide đó (của đề tài cũ JobFinder)
2. Xác định nội dung TechStore tương ứng — nếu chưa chắc, đọc lại file `.md` và file code liên quan trước khi tiếp tục
3. Giữ nguyên thiết kế, font, màu — thay toàn bộ nội dung
4. Nếu nội dung TechStore phong phú hơn hoặc cần trình bày chi tiết hơn → **tự thêm slide mới, mục cha, mục con** theo đúng phong cách thiết kế của template, không cần hỏi lại
5. Nếu một mục trong template không có nội dung TechStore tương ứng → hỏi lại trước khi xử lý (xem phần Xử lý ngoại lệ)
6. Kiểm tra lại slide vừa hoàn thành — đảm bảo đạt đủ các tiêu chí bên dưới
7. **Báo cáo kết quả của slide đó** rồi mới chuyển sang slide tiếp theo

> **Tuyệt đối không xử lý nhiều slide cùng lúc — phải hoàn thành và kiểm tra từng slide trước khi tiếp tục.**

---

### Quy chuẩn render sơ đồ (Mermaid CLI → PNG)

Tất cả sơ đồ trong slide đều phải được render thành ảnh `.png` bằng Mermaid CLI rồi chèn vào đúng vị trí trong slide.

**Ưu tiên lấy sơ đồ từ `DIAGRAMS.md`:**
- File này đã có sẵn toàn bộ sơ đồ hệ thống ở dạng Mermaid code chuẩn, verified trực tiếp từ source code thực tế
- Bao gồm: Use Case diagrams, Sequence diagrams, ERD, System Architecture, RAG Pipeline Flow, State diagrams, Component diagrams
- Khi slide cần sơ đồ, tìm trong `DIAGRAMS.md` trước — chỉ tự tạo mới nếu không có sơ đồ phù hợp

**Nếu cần tạo sơ đồ mới — chọn đúng loại:**
- `flowchart` cho luồng xử lý
- `sequenceDiagram` cho tương tác giữa các thành phần
- `erDiagram` cho cơ sở dữ liệu
- `stateDiagram-v2` cho trạng thái
- Không được dùng sai loại sơ đồ so với bản chất nội dung
- Cú pháp phải hợp lệ và render được bằng Mermaid CLI
- Phải thể hiện đầy đủ tất cả node, sub-node, logic flow chính xác theo codebase — không sai thứ tự, không sai logic

> **Lưu ý đặc biệt — Pipeline RAG Chatbot:** Toàn bộ pipeline 7 bước (43 nodes) đã được định nghĩa đầy đủ trong `RAG_CHATBOT_PIPELINE.md` và `DIAGRAMS.md`. Khi làm slide về RAG chatbot, phải bám sát 100% 2 file này — không được tự ý thêm bớt bất kỳ node, sub-node hay luồng xử lý nào. `PIPELINE_TRACE_EXAMPLES.md` chứa 22 path trace cụ thể dùng để minh hoạ chi tiết.

**Quy cách render PNG bằng Mermaid CLI:**

**Bước 1 — Verify cú pháp trước khi render:**
```bash
mmdc -i diagram.mmd -o /dev/null 2>&1
```
Chạy lệnh trên để kiểm tra cú pháp. Nếu có lỗi → sửa cú pháp trước, không render khi chưa pass. Không được chèn ảnh bị lỗi hoặc ảnh trống vào slide.

**Bước 2 — Render chính thức:**
```bash
mmdc -i diagram.mmd -o diagram.png --width 2400 --backgroundColor white
```

- **Format:** PNG (không dùng SVG — PNG tương thích tốt hơn với PowerPoint)
- **Width:** `2400px` — đảm bảo sắc nét khi chèn vào slide 16:9 (slide thường ~1280px, render 2400px = gần 2x, không bị mờ)
- **Background:** `white` (#ffffff) — nền trắng, không trong suốt, hiển thị rõ trên mọi màu nền slide
- **Không chỉ định `-H` (height)** — để Mermaid CLI tự tính chiều cao phù hợp với nội dung sơ đồ, tránh bị cắt

**Xử lý sơ đồ dài — tách nhiều phần:**
- Nếu sơ đồ quá lớn để hiển thị trọn vẹn trong một slide, tách thành nhiều phần và render thành nhiều file PNG riêng biệt, chèn vào các slide liên tiếp
- Mỗi phần phải có tiêu đề rõ ràng thể hiện đây là phần mấy của sơ đồ nào (ví dụ: "RAG Pipeline — Phần 1/3: Preprocessing")
- **Tuyệt đối không được:** bỏ sót node, bỏ sót sub-node, sai logic flow, hoặc sai thứ tự node khi tách

**Thay thế slides ảnh UI bằng sơ đồ PNG:**
- Template gốc có các slides hiển thị ảnh chụp màn hình giao diện (UI screenshots)
- Thay thế các slides này bằng sơ đồ Mermaid CLI render thành PNG, thể hiện luồng người dùng, kiến trúc giao diện, hoặc sequence diagram tương ứng
- Ưu tiên các sơ đồ đã có sẵn trong `DIAGRAMS.md` (Sequence diagrams, Use Case diagrams...)

---

### Lưu ý đặc biệt — Slides về kiểm thử

Template gốc có slides về "Tiêu chí chấm điểm Recall@K / Judge Score / Benchmark dataset" của đề tài JobFinder — **không áp dụng cho TechStore**.

Thay thế bằng nội dung chiến lược kiểm thử 5 tầng của TechStore:
- **Bắt buộc đọc `TESTING_STRATEGY.md`** và các file code test liên quan trước khi làm các slides này
- Trình bày đầy đủ: 5 tầng (Unit → Integration → API HTTP → E2E → Component), số lượng test cases, coverage thresholds, CI/CD pipeline
- Nếu chưa chắc về bất kỳ số liệu hay chi tiết nào → đọc lại file code test tương ứng, không được tự ý điền

---

### Quy chuẩn bố cục từng slide

- Giữ nguyên phong cách thiết kế gốc: font chữ, cỡ chữ, màu sắc, style trình bày
- Khi thêm slide mới hoặc mục mới, áp dụng đúng phong cách thiết kế của template — không tự ý dùng layout hoặc màu sắc khác
- Chữ, nội dung và hình ảnh trong mỗi slide phải **vừa khít trong vùng hiển thị** — không được tràn ra ngoài, bị cắt xén hoặc lệch
- Kiểm tra kỹ từng thành phần: text box, hình ảnh, sơ đồ PNG, bảng biểu đều phải nằm đúng vị trí và không đè lên nhau
- Nếu nội dung quá dài so với không gian slide → **tách sang slide mới** theo đúng phong cách template, không được để tràn

---

### Tiêu chí kiểm tra từng slide

- [ ] Nội dung bám sát 100% codebase thực tế của TechStore — không có thông tin bịa đặt hoặc suy đoán
- [ ] Phong cách thiết kế (font, màu, style) nhất quán với template gốc — kể cả slide mới được thêm vào
- [ ] Chữ, nội dung, hình ảnh và sơ đồ không bị tràn, bị cắt hoặc lệch trong slide
- [ ] Sơ đồ (nếu có): lấy từ `DIAGRAMS.md` hoặc tạo mới đúng loại, đúng cú pháp Mermaid CLI, đầy đủ node/sub-node, đúng logic flow và thứ tự — render thành PNG (width=2400, background=white)
- [ ] Sơ đồ dài đã được tách đúng cách — không bỏ sót node, không sai logic khi tách
- [ ] Thuật ngữ kỹ thuật giữ tiếng Anh, toàn bộ nội dung còn lại viết tiếng Việt có dấu
- [ ] Không còn bất kỳ nội dung nào của đề tài cũ (JobFinder) còn sót lại trong slide

---

### Xử lý các trường hợp ngoại lệ

- Nếu **chưa chắc chắn** về bất kỳ thông tin nào → **đọc lại file `.md` và file code liên quan trước**, nếu vẫn chưa rõ thì **hỏi lại ngay** — tuyệt đối không tự ý điền hoặc tiếp tục.
- Nếu **nội dung TechStore phong phú hơn template** và cần thêm slide/mục để trình bày đầy đủ → **tự thêm vào**, không cần hỏi lại, áp dụng đúng phong cách thiết kế của template.
- Nếu **một mục của template không có nội dung TechStore tương ứng** → **hỏi lại** để xác nhận thay bằng nội dung gì hoặc bỏ đi.
- Nếu **không tìm thấy thông tin** sau khi đã đọc file `.md` và file code liên quan → **báo cáo rõ** slide đó thiếu thông tin gì và hỏi hướng giải quyết.

---

## Bước 4 — Lưu file output và báo cáo kết quả

Sau khi đã chỉnh sửa xong toàn bộ, lưu file với tên **`20020155_NgoVanMinhThang_Slide.pptx`** và báo cáo tổng kết bao gồm:

- Danh sách các slide đã hoàn thành và nội dung thay đổi chính
- Các slide hoặc mục đã hỏi lại và kết quả xử lý
- Các vấn đề còn tồn đọng (nếu có) cần xem xét thêm
