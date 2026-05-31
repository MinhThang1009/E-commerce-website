# PROMPT VIẾT BÁO CÁO KLTN — PHIÊN BẢN CUỐI CÙNG

---

## THÔNG TIN KLTN

- **Đề tài:** "Xây dựng website e-commerce tích hợp chatbot AI"
- **Sinh viên:** Ngô Văn Minh Thắng
- **Cán bộ hướng dẫn:** TS. Lê Thị Hợi
- **Trường:** Đại học Công nghệ (UET) — ĐHQG Hà Nội
- **Năm:** 2026
- **Core của dự án:** Chatbot AI được thiết kế theo kiến trúc RAG (Retrieval-Augmented Generation). Đây là phần trọng tâm của KLTN, cần được trình bày sâu và chi tiết xuyên suốt các chương (lý thuyết, thiết kế, cài đặt, đánh giá)

---

## BỐI CẢNH DỰ ÁN

Codebase được tài liệu hóa bằng hệ thống file Markdown:

- `README.md` — Tổng quan dự án, hướng dẫn cài đặt và chạy
- `STRUCTURE.md` — Cấu trúc tổng thể dự án (thư mục, module, quan hệ giữa các thành phần)
- `DIAGRAMS.md` — Các sơ đồ dạng Mermaid: kiến trúc hệ thống, luồng dữ liệu, ERD, sequence diagram, flowchart,...
- `TESTING_STRATEGY.md` — Chiến lược và phương pháp testing (unit test, integration test, e2e,...)
- `CLAUDE.md` (root) — Tổng quan kỹ thuật cấp cao của toàn bộ dự án
- **74 file `CLAUDE.md` con** nằm rải rác trong các thư mục con — mỗi file mô tả chi tiết module/component tương ứng

---

## NHIỆM VỤ — THỰC HIỆN TUẦN TỰ

### Bước 1 — Đọc hiểu toàn bộ codebase

Đọc tất cả 79 file `.md` (5 file gốc + 74 file con) để nắm đầy đủ: kiến trúc tổng thể, chức năng từng module, chiến lược testing, luồng dữ liệu, công nghệ sử dụng, và các quyết định thiết kế. Trong quá trình viết, nếu cần thông tin chi tiết về module/component nào thì phải đọc file code/config tương ứng trong codebase, tuyệt đối không suy đoán rồi viết.

### Bước 2 — Viết nội dung KLTN theo từng chương, lần lượt một

Viết nội dung cho các file `.tex` theo cấu trúc trong folder `KLTN_LaTeX`, tuân thủ đúng quy định trong file `Quy_Dinh_KLTN.docx`. Agent tự đọc codebase rồi tự quyết định mỗi chương cần chia thành bao nhiêu section chính, trong mỗi section chính chia thành bao nhiêu section con. Nội dung phải đầy đủ, chi tiết, không được viết sơ sài. Quy trình bắt buộc cho mỗi chương:

1. Viết nội dung chương
2. Render các sơ đồ Mermaid phù hợp thành ảnh và insert vào đúng section
3. Kiểm tra lại toàn bộ format (ảnh, bảng, cross-reference, mục lục) đúng quy định
4. Chỉ khi đã pass kiểm tra mới chuyển sang chương tiếp theo

---

## CẤU TRÚC CÁC FILE CẦN VIẾT

Tất cả đường dẫn file đều tính từ thư mục gốc `KLTN_LaTeX/`.

### Các phần phụ (viết luôn):

- `cover.tex` — Cập nhật: đề tài = "Xây dựng website e-commerce tích hợp chatbot AI", SV = "Ngô Văn Minh Thắng", CBHD = "TS. Lê Thị Hợi". Cập nhật cả 3 trang bìa (bìa Việt 1, bìa Việt 2, bìa Anh)
- `chapters/acknowledgement.tex` — Lời cảm ơn
- `chapters/assurance.tex` — Lời cam đoan (cập nhật tên SV = "Ngô Văn Minh Thắng", thông tin lớp)
- `chapters/abtract_vi.tex` — Tóm tắt tiếng Việt (bài toán, phương pháp, kết quả + 3-5 từ khóa)
- `chapters/abtract_en.tex` — Abstract tiếng Anh (tương ứng bản Việt + 3-5 keywords)
- `chapters/glossary.tex` — Danh mục từ viết tắt (cập nhật theo nội dung thực tế của dự án e-commerce + chatbot AI, xóa các entry mẫu về BiLSTM, Buffer Overflow)

### Phần khai báo sử dụng AI (bắt buộc theo quy định):

Thêm mục "Tuyên bố về sự hỗ trợ của AI" vào báo cáo với nội dung: Sinh viên có sử dụng Claude AI để hỗ trợ cấu trúc câu văn trong báo cáo, sinh ra các test case để debug, và hỗ trợ dọn dẹp dead-code. Mọi nội dung cốt lõi, tư duy thiết kế hệ thống và logic nghiệp vụ đều do sinh viên thực hiện.

### Các chương chính (4 chương + Kết luận):

**`chapters/c1/c1_introduction.tex` — Chương 1: Đặt vấn đề**

Viết lại hoàn toàn cho đề tài e-commerce + chatbot AI (xóa nội dung mẫu về SCA). Chương này cần trình bày:
- Bối cảnh và lý do chọn đề tài: bài toán KLTN giải quyết là gì, trong bối cảnh thực tiễn như thế nào, vì sao đề tài quan trọng và có ý nghĩa
- Mô tả bài toán: phát biểu rõ ràng bài toán, gồm đầu vào, đầu ra, phạm vi và các giả định (nếu có)
- Mục tiêu và phạm vi nghiên cứu của KLTN
- Cấu trúc KLTN (giới thiệu nội dung từng chương)

**`chapters/c2/c2_chapter.tex` — Chương 2: Cơ sở lý thuyết**

Vì đây là KLTN xây dựng hệ thống, có thể đổi tiêu đề thành "Nền tảng và công nghệ sử dụng". Agent tự đọc codebase để xác định cần trình bày những kiến thức nền tảng nào, chia thành bao nhiêu section. Lưu ý chatbot AI theo kiến trúc RAG là core của dự án, cần được trình bày lý thuyết đầy đủ và sâu trong chương này.

Lưu ý bắt buộc (từ template):
- Cần tham chiếu tài liệu tham khảo ĐÚNG và ĐỦ. Thiếu tham chiếu coi như sao chép
- KHÔNG chép lại nội dung từ tài liệu tham khảo, phải diễn đạt lại phù hợp với bài toán và phạm vi KLTN

**`chapters/c3/c3_chapter.tex` — Chương 3: Phân tích và thiết kế hệ thống**

Tiêu đề: "Phân tích và thiết kế hệ thống". Agent tự đọc codebase để xác định cần trình bày những phần thiết kế nào, chia thành bao nhiêu section. Đặc biệt cần thiết kế chi tiết pipeline RAG của chatbot AI vì đây là core của dự án.

Lưu ý bắt buộc (từ template):
- KHÔNG đưa bảng biểu/hình ảnh không liên quan vào KLTN
- Tiêu đề Bảng đặt TRÊN bảng, tiêu đề Hình đặt DƯỚI hình
- Toàn bộ hình ảnh, bảng biểu phải được tham chiếu và giải thích rõ ràng. KHÔNG chấp nhận các mục chỉ có hình/bảng mà không có giải thích/mô tả/thảo luận
- KHÔNG viết theo dạng gạch đầu dòng

**`chapters/c4/c4_chapter.tex` — Chương 4: Cài đặt, kiểm thử và triển khai hệ thống**

Agent tự đọc codebase và TESTING_STRATEGY.md để xác định cần trình bày những phần cài đặt và kiểm thử nào, chia thành bao nhiêu section. Đặc biệt cần đánh giá chi tiết hiệu quả của chatbot AI (RAG pipeline) vì đây là core của dự án. Phần "Mô tả tường minh đóng góp của sinh viên": đọc commit history trong codebase để xác định phần SV tự cài đặt vs phần reuse (thư viện/framework có sẵn), phân tách rõ ràng 2 phần này.

**`chapters/conclusion.tex` — Kết luận & Hướng phát triển**

- Tổng kết bài toán, giải pháp, và các kết quả đạt được
- Hạn chế của hệ thống
- Hướng mở rộng trong tương lai

### Tài liệu tham khảo:

- `references.bib` — Tự tìm và thêm các references phù hợp (sách, bài báo khoa học, tài liệu kỹ thuật, documentation chính thức,...). Mỗi tham chiếu trong bài viết phải có entry tương ứng trong file này

---

## QUY TẮC VỀ SƠ ĐỒ VÀ HÌNH ẢNH

- Đọc file `DIAGRAMS.md`, chọn lọc và render tất cả các sơ đồ Mermaid phù hợp với từng section đang viết thành file `.png` hoặc `.jpg`
- **Không insert sai vị trí:** Sơ đồ kiến trúc vào phần kiến trúc, ERD vào phần thiết kế CSDL, sequence diagram vào phần mô tả luồng xử lý,...
- **Kiểm tra trước khi render:** Nếu phát hiện sơ đồ Mermaid có lỗi (mất chữ, sai node, sai relationship, syntax không hợp lệ,...) thì chủ động sửa luôn để ảnh xuất ra chính xác
- **Tuân thủ quy chuẩn Mermaid cho từng loại sơ đồ:**
  - Flowchart: đúng hình dạng node (hình chữ nhật cho process, hình thoi cho decision, hình bo tròn cho start/end,...), mũi tên có nhãn rõ ràng
  - Sequence diagram: đúng quy ước lifeline, activation bar, message type (sync/async/return)
  - ERD: đúng ký hiệu quan hệ (1-1, 1-n, n-n), attribute types
  - Class diagram: đúng ký hiệu visibility (+, -, #), relationship (inheritance, composition, aggregation)
  - State diagram: đúng trạng thái bắt đầu/kết thúc, transition labels
- **Bộ màu chuẩn:** Sử dụng bộ màu mặc định chuẩn của Mermaid cho từng loại sơ đồ, không tự ý đổi màu. Đảm bảo màu sắc nhất quán, dễ đọc khi in đen trắng
- **Resolution:** Render ảnh ở độ phân giải tối thiểu 300 DPI để không bị mờ khi in
- **Kích thước:** Phải fit với trang, không vượt `\textwidth`, không quá nhỏ đến mức khó đọc
- **Vị trí caption:** Tiêu đề Hình (caption) đặt DƯỚI hình
- **Label:** Mọi hình ảnh, sơ đồ đều bắt buộc có `\caption{}` (chú thích tiếng Việt) và `\label{}` để cross-reference
- Toàn bộ hình ảnh phải được tham chiếu (`\ref{}`) và giải thích rõ ràng trong văn bản. KHÔNG chấp nhận hình ảnh đứng một mình mà không có mô tả/thảo luận đi kèm

---

## QUY TẮC VỀ BẢNG

- Bảng phải fit trong trang, không tràn lề
- **Vị trí caption:** Tiêu đề Bảng (caption) đặt TRÊN bảng
- Mọi bảng đều phải có `\caption{}` và `\label{}`
- Sử dụng `\ref{}` để tham chiếu bảng từ trong văn bản
- Toàn bộ bảng biểu phải được giải thích rõ ràng. KHÔNG chấp nhận bảng đứng một mình mà không có mô tả/thảo luận đi kèm
- KHÔNG đưa bảng biểu không liên quan vào KLTN

---

## QUY TẮC VỀ NGÔN NGỮ VÀ VĂN PHONG

- **Ngôn ngữ chính:** Tiếng Việt có dấu, xen kẽ thuật ngữ tiếng Anh khi cần thiết (ví dụ: "kiến trúc RAG (Retrieval-Augmented Generation)", "framework React", "ngôn ngữ TypeScript")
- **Dễ hiểu:** Ai đọc cũng phải hiểu được nội dung đang viết, không dùng thuật ngữ phức tạp khó hiểu khi có thể diễn đạt đơn giản hơn
- **Văn phong formal:** Giống sinh viên viết khóa luận tốt nghiệp, nghiêm túc nhưng rõ ràng
- **Viết thành đoạn văn mạch lạc:** KHÔNG viết theo dạng gạch đầu dòng (bullet points) trong nội dung chương, để đảm bảo rõ ràng và liền mạch trong giải thích và lập luận
- **Không dùng dấu gạch ngang dài (emdash "—")** để giải thích; dùng cách diễn đạt tự nhiên trong câu
- **Bám sát codebase:** Nội dung phải phản ánh đúng thực tế dự án, không bịa đặt

---

## QUY TẮC VỀ CHỐNG ĐẠO VĂN

- Tỷ lệ trùng lặp KHÔNG được vượt quá 20% (trừ tài liệu tham khảo và định nghĩa kinh điển)
- Vượt quá 20% sẽ bị yêu cầu viết lại hoặc nhận điểm 0
- KHÔNG chép lại nguyên văn nội dung từ bất kỳ nguồn nào (sách, bài báo, website, AI)
- Phải diễn đạt lại bằng lời của mình, phù hợp với bài toán và phạm vi KLTN
- Mọi nội dung tham khảo phải có citation (`\cite{}`) tương ứng. Thiếu tham chiếu coi như sao chép

---

## QUY TẮC LATEX (từ Quy định KLTN)

- Giữ nguyên template và style gốc, không thay đổi file `.sty` hay font
- Công thức toán, code snippet phải đúng chuẩn LaTeX
- Tài liệu tham khảo sử dụng BibTeX (`references.bib`)
- Tất cả section, hình ảnh, bảng phải được link đúng vào mục lục (Table of Contents, List of Figures, List of Tables) thông qua `\label{}` và `\ref{}`
- File `thesis.tex` gọi các chương theo thứ tự: c1 → c2 → c3 → c4 → conclusion. Không cần sửa file `thesis.tex` (phần `introduction.tex` giữ nguyên bị comment)
- Ảnh lưu vào thư mục `figures/` (có thể tạo thư mục con như `figures/c2/`, `figures/c3/`, `figures/c4/`)
- Output cuối cùng: các file `.tex` hoàn chỉnh + file ảnh sơ đồ trong `figures/` + `references.bib`, sẵn sàng compile thành PDF

---

## QUY TẮC LATEX CỤ THỂ — PHÒNG TRÁNH LỖI THƯỜNG GẶP (TIẾT KIỆM TOKEN)

Template sử dụng A4 với margin: left=3cm, right=2cm, top=2.5cm, bottom=3cm → chiều rộng nội dung (textwidth) khoảng 15.5cm. Tuân thủ đúng các mẫu code dưới đây để không phải sửa lại.

### Hình ảnh — Mẫu chuẩn:
```latex
\begin{figure}[H]
  \centering
  \includegraphics[width=0.85\textwidth]{figures/c3/ten_hinh.png}
  \caption{Chú thích tiếng Việt mô tả hình}
  \label{fig:ten_hinh}
\end{figure}
```
Quy tắc:
- LUÔN dùng `\centering` để căn giữa
- LUÔN dùng `[H]` (từ package float) để hình nằm đúng vị trí trong văn bản
- Width mặc định: `width=0.85\textwidth` cho hình vừa phải. Hình phức tạp nhiều chi tiết nhỏ (ERD, class diagram): dùng `width=\textwidth`. Hình đơn giản ít chi tiết: dùng `width=0.6\textwidth` đến `width=0.7\textwidth`
- TUYỆT ĐỐI KHÔNG dùng đơn vị cố định như `width=400pt` hay `width=15cm` vì dễ tràn lề
- Caption đặt DƯỚI hình (sau `\includegraphics`)
- Tham chiếu trong văn bản: `Hình~\ref{fig:ten_hinh}`

### Bảng — Mẫu chuẩn:
```latex
\begin{table}[H]
  \centering
  \caption{Chú thích tiếng Việt mô tả bảng}
  \label{tab:ten_bang}
  \begin{tabular}{|l|p{5cm}|p{6cm}|}
    \hline
    \textbf{Cột 1} & \textbf{Cột 2} & \textbf{Cột 3} \\
    \hline
    Dữ liệu & Dữ liệu & Dữ liệu \\
    \hline
  \end{tabular}
\end{table}
```
Quy tắc:
- LUÔN dùng `\centering` để căn giữa
- LUÔN dùng `[H]` để bảng nằm đúng vị trí
- Caption đặt TRÊN bảng (trước `\begin{tabular}`)
- Bảng rộng: dùng `p{Xcm}` thay vì `l` hoặc `c` để tự động xuống dòng, tránh tràn lề. Tổng chiều rộng các cột KHÔNG được vượt 15.5cm (textwidth)
- Bảng quá rộng: dùng `\resizebox{\textwidth}{!}{...}` hoặc `\footnotesize` để thu nhỏ, hoặc xoay ngang bằng `\begin{landscape}...\end{landscape}`
- Tham chiếu trong văn bản: `Bảng~\ref{tab:ten_bang}`

### Sơ đồ Mermaid — Render:
- Render ở kích thước đủ lớn (width ≥ 2000px) để đảm bảo ≥ 300 DPI khi hiển thị ở `0.85\textwidth`
- Nền trắng, text đen, font rõ ràng
- Kiểm tra sau khi render: mở file ảnh xem có bị cắt chữ, mất node, text chồng nhau không. Nếu có thì sửa Mermaid source rồi render lại

### Quy ước đặt tên label:
- Hình: `\label{fig:ten_hinh}` (ví dụ: `fig:system_architecture`, `fig:erd_diagram`)
- Bảng: `\label{tab:ten_bang}` (ví dụ: `tab:tech_stack`, `tab:test_results`)
- Chương: `\label{chap:ten_chuong}` (ví dụ: `chap:c1_introduction`)
- Section: `\label{sec:ten_section}` (ví dụ: `sec:rag_pipeline`)

### Các lỗi thường gặp cần tránh:

**Hình ảnh:**
- ❌ `\includegraphics[width=400pt]` → tràn lề. ✅ Dùng `width=0.85\textwidth`
- ❌ Hình/bảng không có `\centering` → lệch trái. ✅ Luôn dùng `\centering`
- ❌ Hình/bảng không có `[H]` → trôi sang trang khác. ✅ Luôn dùng `[H]`
- ❌ Caption hình đặt trên → sai quy định. ✅ Caption hình đặt DƯỚI
- ❌ Đường dẫn ảnh có dấu cách hoặc ký tự đặc biệt → lỗi compile. ✅ Dùng snake_case, không dấu
- ❌ Trỏ đến file ảnh chưa tồn tại → lỗi compile. ✅ Render ảnh TRƯỚC, confirm file tồn tại trong `figures/` rồi mới `\includegraphics`
- ❌ Dùng file SVG trực tiếp → LaTeX không support. ✅ Chỉ dùng `.png` hoặc `.jpg`
- ❌ Quá nhiều hình liên tiếp → hình bị đẩy dồn cuối chương. ✅ Xen kẽ hình với đoạn văn giải thích, dùng `[H]` cho mọi figure

**Bảng:**
- ❌ Bảng dùng toàn `l` hoặc `c` với nội dung dài → tràn lề. ✅ Dùng `p{Xcm}`
- ❌ Caption bảng đặt dưới → sai quy định. ✅ Caption bảng đặt TRÊN
- ❌ Bảng dài quá 1 trang bị cắt. ✅ Dùng `longtable` cho bảng dài, hoặc chia thành nhiều bảng nhỏ
- ❌ Merge cell sai cú pháp. ✅ Dùng `\multirow{số_dòng}{*}{nội_dung}` và `\multicolumn{số_cột}{|c|}{nội_dung}`
- ❌ Bảng không có đường kẻ rõ ràng. ✅ Dùng `\hline` hoặc `\toprule`, `\midrule`, `\bottomrule` (từ package booktabs đã có trong template)

**Text và Font:**
- ❌ Dùng ký tự đặc biệt không escape (`_`, `%`, `&`, `#`, `$`, `~`, `^`) → lỗi compile. ✅ Escape: `\_`, `\%`, `\&`, `\#`, `\$`, `\textasciitilde`, `\textasciicircum`
- ❌ URL dài tràn lề. ✅ Dùng `\url{...}` (package url đã có trong template) hoặc `\href{url}{text_hiển_thị}` để tự xuống dòng
- ❌ Code snippet viết bằng text thường. ✅ Dùng `\lstinputlisting` hoặc `\begin{lstlisting}...\end{lstlisting}` (package listings đã có trong template)
- ❌ Dấu ngoặc kép kiểu `"text"` → hiển thị sai trong LaTeX. ✅ Dùng `` ``text'' `` (2 backtick mở + 2 single quote đóng)
- ❌ Tiếng Việt bị lỗi encoding. ✅ Template đã có `\usepackage[utf8]{vietnam}`, đảm bảo file `.tex` lưu encoding UTF-8
- ❌ `Hình \ref{fig:x}` → số có thể bị xuống dòng tách khỏi chữ "Hình". ✅ Dùng dấu `~` (non-breaking space): `Hình~\ref{fig:x}`, `Bảng~\ref{tab:x}`, `Chương~\ref{chap:x}`, tương tự cho `\cite`: `~\cite{key}`
- ❌ Footnote trong caption → lỗi compile. ✅ Dùng `\protect\footnote{...}` bên trong caption

**Cross-reference và Bibliography:**
- ❌ `\ref{}` trỏ đến label không tồn tại → hiển thị "??". ✅ Kiểm tra mọi `\ref{}` đều có `\label{}` tương ứng
- ❌ `\cite{}` key không khớp với entry trong `references.bib` → hiển thị "?". ✅ Mỗi khi viết `\cite{key}`, phải đảm bảo `key` tồn tại trong `references.bib`
- ❌ Entry trong `.bib` thiếu trường bắt buộc (author, title, year). ✅ Mỗi bib entry phải có đủ: author, title, year, và các trường cần thiết theo loại (article: journal; inproceedings: booktitle; book: publisher)
- ❌ Compile 1 lần không resolve được ref/cite. ✅ Cần compile: `pdflatex` → `bibtex` → `pdflatex` → `pdflatex` (4 lần)

**Cấu trúc:**
- ❌ Page break cắt giữa hình và caption. ✅ Dùng `[H]` và đặt figure gần text tham chiếu
- ❌ Dòng mồ côi (orphan/widow): 1-2 dòng cuối đoạn bị đẩy sang trang mới. ✅ Thêm `\widowpenalty=10000` và `\clubpenalty=10000` nếu cần

### Các lỗi Mermaid phổ biến cần tránh:

**Syntax chung:**
- ❌ Node text chứa ký tự đặc biệt (ngoặc tròn, ngoặc vuông, dấu hai chấm, dấu ngoặc kép) không escape → render crash. ✅ Bọc node text trong dấu ngoặc kép: `A["Text có (ngoặc) và: hai chấm"]`
- ❌ Node ID có dấu cách → parse lỗi. ✅ Dùng camelCase hoặc snake_case cho ID: `userService` không `user service`
- ❌ Arrow syntax sai. ✅ Flowchart: `-->` (có mũi tên), `---` (không mũi tên), `-->|label|` (có nhãn). Sequence: `->>` (async), `-->>` (async return)
- ❌ Subgraph không đóng `end` → toàn bộ diagram lỗi. ✅ Mỗi `subgraph` phải có `end` tương ứng, kiểm tra đếm số `subgraph` = số `end`
- ❌ Thiếu khai báo direction → layout mặc định có thể không đẹp. ✅ Luôn khai báo direction ở dòng đầu: `graph TD` (top-down), `graph LR` (left-right)
- ❌ Text tiếng Việt có dấu trong node → một số renderer hiển thị sai font. ✅ Kiểm tra sau render, nếu lỗi thì dùng tiếng Anh hoặc tiếng Việt không dấu cho node, giải thích tiếng Việt trong caption LaTeX

**ERD:**
- ❌ Relationship cardinality sai ký hiệu → quan hệ sai. ✅ Đúng cú pháp: `||--o{` (one-to-many), `||--||` (one-to-one), `}o--o{` (many-to-many). Đọc từ trái sang phải
- ❌ Attribute type chứa ký tự đặc biệt → parse lỗi. ✅ Dùng text đơn giản: `string`, `int`, `boolean`, `datetime`, không dùng `varchar(255)` hay `TEXT NOT NULL`
- ❌ Entity name trùng keyword Mermaid (`graph`, `end`, `subgraph`,...). ✅ Tránh đặt tên entity trùng keyword, thêm prefix nếu cần: `tbl_order` thay vì `order`

**Sequence diagram:**
- ❌ Participant name có dấu cách không bọc quotes → parse lỗi. ✅ Dùng `participant "Chat Service" as CS` hoặc participant không dấu cách
- ❌ Activate/deactivate không match → render sai lifeline. ✅ Mỗi `activate X` phải có `deactivate X` tương ứng, hoặc dùng `+`/`-`: `X->>+Y: request` và `Y-->>-X: response`
- ❌ Loop/alt/opt block không đóng `end`. ✅ Mỗi `loop`/`alt`/`opt` phải có `end`, kiểm tra đếm

**Flowchart:**
- ❌ Node shape syntax sai. ✅ Đúng: `[text]` hình chữ nhật, `(text)` bo tròn, `{text}` hình thoi (decision), `[(text)]` hình trụ (database), `[[text]]` subroutine, `([text])` stadium/start-end
- ❌ Link text quá dài → chồng lên node. ✅ Giữ label ngắn (< 20 ký tự), nếu dài thì dùng line break: `-->|"Dòng 1\nDòng 2"|`

**Class diagram:**
- ❌ Relationship arrow sai. ✅ Đúng: `--|>` inheritance, `--*` composition, `--o` aggregation, `-->` association, `..>` dependency
- ❌ Generic type chứa `< >` bị parse lỗi. ✅ Dùng `~` thay `< >`: `List~String~` thay vì `List<String>`

**Render output:**
- ❌ Text bị cắt khi diagram quá rộng. ✅ Chia diagram phức tạp thành nhiều diagram nhỏ hơn, hoặc dùng direction LR cho diagram dọc, TD cho diagram ngang
- ❌ Nền trong suốt → in ra giấy bị mất nội dung. ✅ Luôn render với nền trắng (`-b white` hoặc `--backgroundColor white`)
- ❌ Resolution quá thấp cho diagram phức tạp nhiều node. ✅ Tăng width render (≥ 2500px) cho diagram > 15 node, ≥ 3000px cho diagram > 25 node

---

## YÊU CẦU VỀ TOOLS VÀ SKILLS

Agent phải sử dụng tối đa mọi tools và skills có sẵn trong môi trường để đảm bảo chất lượng output:

- **Vẽ sơ đồ:** Sử dụng Mermaid CLI, hoặc bất kỳ tool nào có sẵn (mmdc, mermaid-cli, puppeteer,...) để render sơ đồ thành ảnh PNG chất lượng cao. Nếu Mermaid CLI không khả dụng, tìm và cài đặt tool thay thế hoặc dùng API online
- **Viết file LaTeX:** Tạo và ghi trực tiếp các file `.tex` vào đúng đường dẫn trong folder `KLTN_LaTeX/`. Không chỉ output nội dung text mà phải tạo file thực tế
- **Kiểm tra:** Sau khi viết xong mỗi chương, thử compile bằng `pdflatex` (nếu có) để phát hiện lỗi syntax sớm. Nếu không compile được, đọc log lỗi và sửa ngay
- **Tìm references:** Sử dụng web search hoặc bất kỳ tool tìm kiếm nào có sẵn để tìm references học thuật phù hợp, sau đó tạo entry BibTeX chuẩn trong `references.bib`
- **Đọc code:** Sử dụng các lệnh đọc file (cat, head, grep,...) để đọc source code khi cần thông tin chi tiết, không đoán mò

---

## QUY TRÌNH LÀM VIỆC (BẮT BUỘC)

```
Với mỗi chương:
  1. Đọc lại các file .md và code liên quan đến nội dung chương đó
  2. Viết nội dung .tex
  3. Chọn và render sơ đồ Mermaid phù hợp (kiểm tra + sửa lỗi nếu có) → insert vào đúng section
  4. Kiểm tra:
     - [ ] Ảnh: caption DƯỚI hình + label + `\centering` + `[H]` + width dùng `\textwidth` + resolution ≥ 300 DPI?
     - [ ] Bảng: caption TRÊN bảng + label + `\centering` + `[H]` + không tràn lề (dùng `p{Xcm}`)?
     - [ ] Mọi hình/bảng đều được tham chiếu (`\ref{}`) và giải thích trong văn bản?
     - [ ] Không có hình/bảng đứng một mình mà không có mô tả đi kèm?
     - [ ] Mọi `\ref{}` đều có `\label{}` tương ứng (không có "??")?
     - [ ] Mọi `\cite{}` đều có entry tương ứng trong `references.bib` (không có "?")?
     - [ ] File ảnh tồn tại đúng path trong `figures/`, format `.png` hoặc `.jpg`?
     - [ ] Ký tự đặc biệt đã escape (`\_`, `\%`, `\&`, `\#`)?
     - [ ] URL dùng `\url{}` hoặc `\href{}{}`?
     - [ ] Code snippet dùng `lstlisting`?
     - [ ] Mục lục, List of Figures, List of Tables link đúng?
     - [ ] Sơ đồ đúng quy chuẩn Mermaid (hình dạng node, bộ màu chuẩn, ký hiệu quan hệ)?
     - [ ] Văn phong: không bullet point, không emdash, formal, dễ hiểu, tiếng Việt có dấu?
     - [ ] Nội dung bám sát codebase, không bịa?
     - [ ] Nội dung viết original, có citation đầy đủ, tỷ lệ trùng lặp thấp?
     - [ ] Tuân thủ đúng format trong Quy_Dinh_KLTN.docx?
     - [ ] Đường dẫn file đúng (chapters/c1/, chapters/c2/, ...)?
  5. Pass hết → chuyển sang chương tiếp theo
```

---

## LƯU Ý QUAN TRỌNG

- Agent đang sử dụng: **Claude Cowork**
- Mọi quy định về format bài viết phải tuân thủ đúng theo file `Quy_Dinh_KLTN.docx` và hướng dẫn chi tiết trong từng file `.tex` của template
- Khi cần thông tin chi tiết, phải đọc file code/config tương ứng, không được đoán mò
- Sơ đồ Mermaid cần kiểm tra và sửa lỗi trước khi render, đảm bảo đúng quy chuẩn vẽ và bộ màu chuẩn của từng loại sơ đồ
- Phần đóng góp của SV ở Chương 4: đọc commit history trong codebase để xác định, phân tách rõ phần tự cài đặt vs phần reuse
- Mỗi chương phải được kiểm tra format trước khi chuyển sang chương tiếp
- Bắt buộc có mục "Tuyên bố về sự hỗ trợ của AI" trong báo cáo
- Folder `chapters/c5/` là nội dung mẫu KLTN khác, bỏ qua hoàn toàn
- File `chapters/introduction.tex` giữ nguyên bị comment trong `thesis.tex`, nội dung Mở đầu được gộp vào Chương 1 (`c1/c1_introduction.tex`)
