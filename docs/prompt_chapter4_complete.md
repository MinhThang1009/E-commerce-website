**Nhiệm vụ:** Bổ sung nội dung cho chương 4 (c4_chapter.tex). Với mỗi phần bổ sung, đọc cả file CLAUDE.md tương ứng VÀ mở file source code thực tế để đối chiếu, đảm bảo mô tả khớp 100% với code. Chỉ thêm nội dung mới vào vị trí chỉ định, không sửa đổi nội dung đã có.

---

### VỊ TRÍ INSERT CHÍNH XÁC

Cấu trúc chương 4 hiện tại:

```
4.1 Môi trường phát triển và triển khai (dòng 6)
4.2 Cài đặt các thành phần trọng tâm (dòng 48)
  4.2.1 Cài đặt Dependency Injection và khởi tạo module (dòng 51)
  4.2.2 Cài đặt UnitOfWork cho giao dịch đồng thời (dòng 71)
  4.2.3 Cài đặt tích hợp cổng thanh toán (dòng 100)
  ➡️ INSERT MỤC 1 TẠI ĐÂY (sau dòng 105, trước \section{Cài đặt chatbot AI})
4.3 Cài đặt chatbot AI: RAG Pipeline (dòng 106)
  4.3.1 Cài đặt UnifiedEmbeddingService (dòng 109)
  4.3.2 Cài đặt HybridVectorStore (dòng 131)
  4.3.3 Cài đặt RAG Pipeline và ChatbotService (dòng 144)
  4.3.4 Cài đặt session memory và catalog cache (dòng 159)
4.4 Cài đặt frontend (dòng 167)
  4.4.1 Floating chat widget (dòng 170)
  4.4.2 Quản lý state kết hợp TanStack Query và Zustand (dòng 176)
  ➡️ INSERT MỤC 2 TẠI ĐÂY (sau dòng 183 — sau đoạn invalidateQueries)
➡️ INSERT MỤC 3 TẠI ĐÂY (trước dòng 185 — trước \section{Kiểm thử hệ thống})
4.5 Kiểm thử hệ thống (dòng 185)
4.6 Đánh giá hiệu quả chatbot RAG (dòng 262)
4.7 Mô tả đóng góp của sinh viên (dòng 341)
4.8 Hướng dẫn triển khai (dòng 366)
4.9 Tóm tắt chương (dòng 381) ➡️ MỤC 4: VIẾT LẠI SECTION NÀY
```

---

### BỔ SUNG CHƯƠNG 4 (c4_chapter.tex)

**1. Thêm subsection "Cài đặt tác vụ định kỳ" — INSERT SAU DÒNG 105 (sau subsection "Cài đặt tích hợp cổng thanh toán", trước \section{Cài đặt chatbot AI: RAG Pipeline}):**

Nội dung cần viết: Hệ thống đăng ký hai cron job trong file cleanup.js sử dụng thư viện node-cron. Job chạy hàng ngày lúc 2 giờ sáng (cron expression: 0 2 * * *) thực hiện 8 tác vụ dọn dẹp theo thứ tự: xóa giỏ hàng bỏ dở quá 30 ngày, cắt bảng search_histories xuống tối đa 50 bản ghi mỗi người dùng (giữ mới nhất, xóa cũ nhất), xóa OTP hết hạn, xóa token reset mật khẩu hết hạn, vô hiệu hóa mã giảm giá đã qua ngày kết thúc, đánh dấu archived cho tin nhắn chat quá 90 ngày, xóa bản ghi recently_viewed quá 90 ngày, và xóa file tạm trong thư mục uploads/temp quá 24 giờ. Job chạy hàng tuần vào 3 giờ sáng Chủ nhật (cron expression: 0 3 * * 0) gọi imageService.cleanupOrphanedFiles() để xóa file ảnh trên ổ đĩa không còn bản ghi tương ứng trong database. Các tác vụ dọn dẹp sử dụng Promise.allSettled để một bước thất bại không ảnh hưởng các bước còn lại, lỗi chỉ được ghi log cảnh báo mà không làm crash ứng dụng.

Đọc backend/src/jobs/CLAUDE.md VÀ mở file backend/src/jobs/cleanup.js để đối chiếu cron expression, thứ tự tác vụ, tên hàm chính xác.

**2. Thêm subsection "Cài đặt route guards và lazy loading" — INSERT SAU DÒNG 183 (sau đoạn code invalidateQueries trong subsection "Quản lý state", trước \section{Kiểm thử hệ thống}):**

Nội dung cần viết: Frontend TechStore triển khai ba loại route guard để kiểm soát quyền truy cập. ProtectedRoute kiểm tra trạng thái đăng nhập trong authStore, nếu chưa đăng nhập thì redirect về trang login kèm lưu lại trang đích trong location state để redirect trở lại sau khi đăng nhập thành công. AdminRoute kiểm tra thêm role phải là admin, nếu không thì redirect về trang unauthorized. PublicOnlyRoute ngược lại, redirect về trang chủ nếu người dùng đã đăng nhập, áp dụng cho các trang login và register để tránh truy cập lại khi đã có phiên.

Toàn bộ 13 feature pages đều được lazy load bằng React.lazy() kết hợp Suspense fallback hiển thị loading spinner toàn trang. Khi người dùng truy cập trang lần đầu, chỉ bundle JavaScript của feature đó được tải xuống, giảm đáng kể kích thước bundle ban đầu. Routes được khai báo tập trung trong file AppRoutes.tsx với path constants từ file paths.ts, tránh hardcode đường dẫn rải rác trong code.

Đọc frontend/src/routes/CLAUDE.md VÀ mở file frontend/src/routes/AppRoutes.tsx, frontend/src/routes/paths.ts, frontend/src/components/routing/ProtectedRoute.tsx, frontend/src/components/routing/AdminRoute.tsx, frontend/src/components/routing/PublicOnlyRoute.tsx để đối chiếu tên component, logic redirect, route paths chính xác.

**3. Thêm section "Kết quả demo giao diện" — INSERT NGAY TRƯỚC DÒNG 185 (trước \section{Kiểm thử hệ thống}). Section mới nằm giữa "Cài đặt frontend" và "Kiểm thử hệ thống":**

Đây là phần quan trọng vì hội đồng cần thấy sản phẩm chạy thực tế. Mỗi ảnh cần có đoạn văn mô tả ngắn gọn nội dung hiển thị và tính năng nổi bật trong ảnh. Xen kẽ ảnh với đoạn văn giải thích, KHÔNG đặt nhiều ảnh liên tiếp mà không có text ở giữa.

Insert các screenshot theo thứ tự sau, gộp thành các subsection theo nhóm chức năng:

**Subsection "Giao diện người dùng cuối":**

- figures/c4/screenshot_home.png — Trang chủ: mô tả hero banner, danh mục sản phẩm, thương hiệu marquee, sản phẩm nổi bật. Đọc frontend/src/pages/CLAUDE.md VÀ mở frontend/src/pages/HomePage.tsx để đối chiếu các section thực tế render trên trang.
- figures/c4/screenshot_shop.png — Trang danh sách sản phẩm: mô tả bộ lọc đa chiều (giá, hãng, danh mục), sắp xếp, phân trang. Đọc frontend/src/features/catalog/CLAUDE.md VÀ mở frontend/src/features/catalog/pages/ShopPage.tsx để đối chiếu filter fields, sort options chính xác.
- figures/c4/screenshot_product_detail.png — Trang chi tiết sản phẩm: mô tả ảnh sản phẩm, chọn biến thể, thông số kỹ thuật, đánh giá. Đọc frontend/src/features/catalog/CLAUDE.md VÀ mở frontend/src/features/catalog/pages/ProductDetailPage.tsx để đối chiếu.

**Subsection "Giỏ hàng, thanh toán và đơn hàng":**

- figures/c4/screenshot_cart.png — Giỏ hàng: mô tả danh sách sản phẩm, thay đổi số lượng, áp mã giảm giá, tổng tiền. Đọc frontend/src/features/cart/CLAUDE.md VÀ mở frontend/src/features/cart/pages/CartPage.tsx và frontend/src/features/cart/components/CartItem.tsx để đối chiếu.
- figures/c4/screenshot_checkout.png — Trang checkout: mô tả chọn địa chỉ giao hàng, chọn phương thức thanh toán (COD, VNPay, MoMo), xác nhận đơn hàng. Đọc frontend/src/features/checkout/CLAUDE.md VÀ mở frontend/src/features/checkout/pages/CheckoutPage.tsx để đối chiếu payment methods, address form fields chính xác.
- figures/c4/screenshot_orders.png — Trang đơn hàng: mô tả danh sách đơn hàng với trạng thái (pending, processing, shipped, delivered, cancelled), nút hủy đơn, nút thanh toán lại, nút xác nhận nhận hàng, phân trang. Đọc frontend/src/features/orders/CLAUDE.md VÀ mở frontend/src/features/orders/pages/OrdersPage.tsx và frontend/src/features/orders/components/OrderDetails.tsx để đối chiếu action buttons, status display chính xác.

**Subsection "Chatbot AI tư vấn sản phẩm":**

- figures/c4/screenshot_chatbot.png — Chat widget floating: mô tả giao diện chat cố định góc dưới phải, cuộc hội thoại mẫu hỏi tư vấn sản phẩm, card sản phẩm gợi ý kèm ảnh, giá và nút thêm giỏ hàng trực tiếp từ chat. Đọc frontend/src/features/ai/CLAUDE.md VÀ mở frontend/src/features/ai/components/ChatWidgetPortal.tsx, frontend/src/features/ai/components/ChatMessages.tsx để đối chiếu cấu trúc widget, cách render product cards.
- figures/c4/screenshot_chatbot_abbrev.png — Chatbot xử lý viết tắt: mô tả người dùng gõ viết tắt (ví dụ "ip15 pm bnh") và chatbot hiểu đúng thành "iPhone 15 Pro Max bao nhiêu", trả kết quả chính xác. Giải thích cơ chế expandAbbreviations xử lý 12 mẫu viết tắt phổ biến. Đọc backend/src/modules/ai/services/core/CLAUDE.md VÀ mở backend/src/modules/ai/services/core/ai-policy.js để đối chiếu ABBREV_MAP, regex patterns, số lượng mẫu chính xác.
- figures/c4/screenshot_chatbot_offtopic.png — Chatbot từ chối câu hỏi ngoài phạm vi: mô tả người dùng hỏi câu không liên quan (ví dụ hỏi thời tiết) và chatbot từ chối lịch sự, hướng dẫn về chủ đề sản phẩm. Giải thích cơ chế isOffTopic dùng regex pattern thuần, không gọi LLM nên phản hồi gần như tức thì. Đọc backend/src/modules/ai/services/core/CLAUDE.md VÀ mở backend/src/modules/ai/services/core/ai-policy.js để đối chiếu isOffTopic regex patterns, danh sách chủ đề bị từ chối chính xác.

**Subsection "Giao diện quản trị":**

- figures/c4/screenshot_admin_dashboard.png — Admin dashboard: mô tả thống kê doanh thu, biểu đồ, số liệu tổng quan (tổng đơn hàng, tổng doanh thu, tổng người dùng, tổng sản phẩm). Đọc frontend/src/features/admin/CLAUDE.md VÀ mở frontend/src/features/admin/pages/DashboardPage.tsx để đối chiếu metrics, chart components chính xác.
- figures/c4/screenshot_admin_products.png — Admin quản lý sản phẩm: mô tả bảng danh sách sản phẩm với cột tên, giá, tồn kho, trạng thái, nút thêm/sửa/xóa, phân trang. Đọc frontend/src/features/admin/CLAUDE.md VÀ mở frontend/src/features/admin/pages/catalog/ProductsPage.tsx để đối chiếu table columns, action buttons chính xác.
- figures/c4/screenshot_admin_categories.png — Admin quản lý danh mục: mô tả bảng danh sách danh mục với cột hình ảnh, tên danh mục (kèm slug), mô tả, danh mục cha (badge "Danh mục gốc" cho root categories), trạng thái (Hoạt động), thứ tự sắp xếp, nút thêm danh mục/làm mới/sửa/xóa, phân trang (10/trang). Đọc frontend/src/features/admin/CLAUDE.md VÀ mở frontend/src/features/admin/pages/catalog/CategoriesPage.tsx để đối chiếu table columns, action buttons chính xác.
- figures/c4/screenshot_admin_brands.png — Admin quản lý thương hiệu: mô tả bảng danh sách thương hiệu với cột logo, tên thương hiệu (kèm slug), website, trạng thái (Hoạt động), nút thêm thương hiệu/làm mới/sửa/xóa. Đọc frontend/src/features/admin/CLAUDE.md VÀ mở frontend/src/features/admin/pages/catalog/BrandsPage.tsx để đối chiếu table columns, action buttons chính xác.
- figures/c4/screenshot_admin_orders.png — Admin quản lý đơn hàng: mô tả bảng đơn hàng với cột mã đơn (format #ORD-YYYYMMDD-XXXX kèm số sản phẩm), khách hàng (tên + email), ngày đặt, tổng tiền, trạng thái đơn hàng (badge "Chờ xử lý"), trạng thái thanh toán (badge "Thanh toán khi nhận"), bộ lọc tìm kiếm theo mã đơn và dropdown lọc theo trạng thái, nút xem chi tiết/sửa. Đọc frontend/src/features/admin/CLAUDE.md VÀ mở frontend/src/features/admin/pages/orders/OrdersPage.tsx để đối chiếu table columns, filter options, action buttons chính xác.
- figures/c4/screenshot_admin_users.png — Admin quản lý người dùng: mô tả 4 card thống kê phía trên (Tổng người dùng, Quản trị viên, Khách hàng, Đã xác minh email), bộ lọc tìm kiếm theo tên/email/SĐT kết hợp dropdown lọc vai trò/sắp xếp ngày tạo, bảng danh sách với cột avatar + tên + email + SĐT, vai trò (badge Quản trị viên/Khách hàng), trạng thái (badge Hoạt động + Email đã xác minh), ngày đăng ký, nút xem/sửa/xóa, phân trang. Đọc frontend/src/features/admin/CLAUDE.md VÀ mở frontend/src/features/admin/pages/users/UsersPage.tsx để đối chiếu stats cards, filter options, table columns chính xác.
- figures/c4/screenshot_admin_discounts.png — Admin quản lý mã giảm giá: mô tả bảng mã giảm giá với cột mã (highlight xanh, ví dụ SUMMER2026), loại (phần trăm 10.00%), đơn tối thiểu, thời hạn (Từ/Đến, hỗ trợ "Vô thời hạn"), số lần sử dụng/giới hạn (ví dụ "1 / ∞"), trạng thái (badge Hoạt động), nút tạo mã mới/sửa/xóa, tìm kiếm theo mã hoặc mô tả, phân trang. Đọc frontend/src/features/admin/CLAUDE.md VÀ mở frontend/src/features/admin/pages/discount-codes/DiscountCodesPage.tsx để đối chiếu table columns, action buttons chính xác.
- figures/c4/screenshot_admin_inventory.png — Admin quản lý kho hàng: mô tả bảng tồn kho với cột sản phẩm, SKU (hiển thị số biến thể), tồn kho tổng, trạng thái (badge Còn hàng/Hết hàng), có thể expand (+/-) xem chi tiết từng biến thể với SKU riêng (ví dụ SAM-GW8C-46-WHI), tồn kho riêng và trạng thái riêng, nút chỉnh sửa tồn kho từng biến thể, tìm kiếm sản phẩm. Đọc frontend/src/features/admin/CLAUDE.md VÀ mở frontend/src/features/admin/pages/inventory/InventoryPage.tsx để đối chiếu expandable rows, table columns, action buttons chính xác.

Mỗi figure dùng [H], \centering, width=\textwidth hoặc width=0.85\textwidth tùy ảnh. Caption tiếng Việt mô tả ngắn gọn nội dung ảnh. Mọi figure phải có \label{} và được \ref{} trong đoạn văn mô tả phía trên hoặc dưới.

**4. Viết lại section "Tóm tắt chương" (dòng 381) để phản ánh nội dung mới bổ sung:**

Section tóm tắt hiện tại bị cắt dở và chưa nhắc đến các phần mới. Viết lại toàn bộ section tóm tắt, bao gồm đề cập: cài đặt tác vụ định kỳ (cron jobs dọn dẹp), route guards và lazy loading, kết quả demo giao diện 17 màn hình (người dùng cuối, giỏ hàng/thanh toán/đơn hàng, chatbot AI, quản trị), bên cạnh các nội dung đã có (DI, UnitOfWork, cổng thanh toán, RAG pipeline, kiểm thử 5 tầng, đóng góp sinh viên, triển khai).

---

### ẢNH CẦN CHUẨN BỊ CHO CHƯƠNG 4

Bạn cần chụp 17 screenshot từ ứng dụng đang chạy thật (agent không tự tạo screenshot được):

1. figures/c4/screenshot_home.png — Trang chủ
2. figures/c4/screenshot_shop.png — Trang danh sách sản phẩm (có filter đang mở)
3. figures/c4/screenshot_product_detail.png — Trang chi tiết sản phẩm
4. figures/c4/screenshot_cart.png — Giỏ hàng có sản phẩm
5. figures/c4/screenshot_checkout.png — Trang checkout
6. figures/c4/screenshot_orders.png — Trang đơn hàng của khách (có ít nhất 1 đơn hiển thị trạng thái)
7. figures/c4/screenshot_chatbot.png — Chat widget đang mở với cuộc hội thoại tư vấn sản phẩm, có card sản phẩm gợi ý
8. figures/c4/screenshot_chatbot_abbrev.png — Chat widget với cuộc hội thoại dùng viết tắt (gõ "ip15 pm bnh" hoặc tương tự)
9. figures/c4/screenshot_chatbot_offtopic.png — Chat widget với câu hỏi ngoài phạm vi (hỏi thời tiết) bị từ chối lịch sự
10. figures/c4/screenshot_admin_dashboard.png — Admin dashboard
11. figures/c4/screenshot_admin_products.png — Admin quản lý sản phẩm
12. figures/c4/screenshot_admin_categories.png — Admin quản lý danh mục
13. figures/c4/screenshot_admin_brands.png — Admin quản lý thương hiệu
14. figures/c4/screenshot_admin_orders.png — Admin quản lý đơn hàng
15. figures/c4/screenshot_admin_users.png — Admin quản lý người dùng
16. figures/c4/screenshot_admin_discounts.png — Admin quản lý mã giảm giá
17. figures/c4/screenshot_admin_inventory.png — Admin quản lý kho hàng

Chụp xong upload kèm khi gửi prompt cho agent. Agent sẽ insert vào đúng vị trí với caption và label phù hợp.

---

### QUY TẮC VIẾT (nhắc lại)

- Văn phong formal, viết thành đoạn văn mạch lạc, KHÔNG dùng bullet points trong nội dung chương
- Không dùng emdash (—) để giải thích
- Caption hình đặt DƯỚI hình, caption bảng đặt TRÊN bảng
- Mọi hình/bảng phải có \label{} và được \ref{} trong text
- Dùng [H] cho figure, \centering, width phù hợp
- Mọi claim kỹ thuật phải đọc cả CLAUDE.md VÀ file source code tương ứng để đối chiếu, không đoán
- Escape ký tự đặc biệt LaTeX (\_, \%, \&, \#)
- Thêm \cite{} cho references mới nếu cần, và tạo entry trong references.bib
- Nội dung mới phải hòa nhập tự nhiên với nội dung đã có, không tạo cảm giác chắp vá
- Xen kẽ hình với đoạn văn giải thích, dùng [H] cho mọi figure, KHÔNG đặt nhiều hình liên tiếp
- Khi mô tả screenshot, đọc kỹ ảnh được upload VÀ đối chiếu với code. Nếu ảnh hiển thị khác với code (ví dụ ảnh có cột mà code không render, hoặc ngược lại), ưu tiên mô tả đúng những gì ảnh thực tế hiển thị, vì ảnh là sản phẩm chạy thật. Không mô tả tính năng không xuất hiện trong ảnh, không bịa chi tiết không có trong ảnh.
