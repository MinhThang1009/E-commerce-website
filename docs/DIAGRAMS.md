# Sơ đồ Hệ thống — TechStore E-commerce

Tất cả diagram dùng [Mermaid](https://mermaid.js.org/) — render trực tiếp trên GitHub.

## Mục lục

1. [Use Case Diagram](#1-use-case-diagram)
2. [Sequence: Đăng ký & Xác thực Email](#2-sequence-đăng-ký--xác-thực-email)
3. [Sequence: Đăng nhập & Refresh Token](#3-sequence-đăng-nhập--refresh-token)
4. [Sequence: Đặt hàng & Thanh toán VNPay](#4-sequence-đặt-hàng--thanh-toán-vnpay)
5. [Sequence: AI Chatbot — RAG Pipeline](#5-sequence-ai-chatbot--rag-pipeline)
6. [Flowchart: Giỏ hàng Guest → Login → Merge](#6-flowchart-giỏ-hàng-guest--login--merge)
7. [Sequence: Đánh giá Sản phẩm](#7-sequence-đánh-giá-sản-phẩm)
8. [Sequence: Tích & Đổi Điểm Loyalty](#8-sequence-tích--đổi-điểm-loyalty)
9. [Flowchart: Checkout Đầy Đủ](#9-flowchart-checkout-đầy-đủ)
10. [Sequence: Admin Quản lý Sản phẩm](#10-sequence-admin-quản-lý-sản-phẩm)
11. [Entity Relationship Diagram — Simplified](#11-entity-relationship-diagram--simplified)
12. [Entity Relationship Diagram — 35 Models](#12-entity-relationship-diagram--35-models)

---

## 1. Use Case Diagram

```mermaid
flowchart TB
    Guest(["Khách vãng lai\n(Guest)"])
    Customer(["Khách hàng\n(Customer)"])
    Admin(["Quản trị viên\n(Admin)"])

    subgraph UC_GUEST["Use cases — Khách vãng lai"]
        G1[Xem danh sách sản phẩm]
        G2[Tìm kiếm sản phẩm]
        G3[Lọc sản phẩm]
        G4[Xem chi tiết sản phẩm]
        G5[Thêm vào giỏ hàng\nguest cart]
        G6[Chat với AI Chatbot]
        G7[Đăng ký tài khoản]
        G8[Đăng nhập]
    end

    subgraph UC_CUSTOMER["Use cases — Khách hàng (mở rộng từ Guest)"]
        C1[Mua hàng & Đặt đơn]
        C2[Thanh toán\nCOD / VNPay / MoMo]
        C3[Theo dõi trạng thái đơn hàng]
        C4[Đánh giá sản phẩm]
        C5[Quản lý danh sách yêu thích]
        C6[Tích điểm thành viên]
        C7[Đổi điểm thành viên]
        C8[Quản lý hồ sơ & địa chỉ]
        C9[Chọn gói bảo hành]
    end

    subgraph UC_ADMIN["Use cases — Quản trị viên"]
        A1[Quản lý sản phẩm & biến thể]
        A2[Quản lý đơn hàng]
        A3[Quản lý người dùng]
        A4[Quản lý nội dung\nbanner / tin tức]
        A5[Xem thống kê doanh thu]
        A6[Quản lý khuyến mãi\nmã giảm giá]
        A7[Quản lý tồn kho]
        A8[Quản lý gói bảo hành]
        A9[Xem Audit log]
    end

    Guest --> UC_GUEST
    Customer -->|kế thừa| UC_GUEST
    Customer --> UC_CUSTOMER
    Admin --> UC_ADMIN
```

---

## 2. Sequence: Đăng ký & Xác thực Email

```mermaid
sequenceDiagram
    actor User as Người dùng
    participant FE as Frontend (React)
    participant API as Backend API
    participant DB as MySQL DB
    participant Mail as Email Service

    User->>FE: Nhập thông tin đăng ký (tên, email, mật khẩu)
    FE->>API: POST /api/auth/register
    API->>API: Validate dữ liệu đầu vào (Zod schema)
    API->>DB: Kiểm tra email đã tồn tại chưa
    DB-->>API: Kết quả

    alt Email đã tồn tại
        API-->>FE: 409 Conflict
        FE-->>User: "Email đã được sử dụng"
    else Email hợp lệ
        API->>API: Hash password (argon2)
        API->>DB: Tạo user (isEmailVerified=false)
        API->>API: Sinh OTP 6 số (TTL 10 phút)
        API->>DB: Lưu OTP
        API->>Mail: Gửi email chứa mã OTP (async)
        Mail-->>User: Email OTP
        API-->>FE: 201 Created
        FE-->>User: "Nhập mã OTP từ email"
    end

    User->>FE: Nhập mã OTP 6 số
    FE->>API: POST /api/auth/verify-otp
    API->>DB: Lấy OTP theo email
    API->>API: So sánh timing-safe (tránh timing attack)

    alt OTP hết hạn hoặc sai
        API-->>FE: 400 Bad Request
        FE-->>User: "Mã OTP không hợp lệ hoặc đã hết hạn"
    else OTP đúng
        API->>DB: Cập nhật isEmailVerified=true
        API->>DB: Xóa OTP
        API-->>FE: 200 OK + accessToken + refreshToken
        FE-->>User: Đăng nhập thành công
    end
```

---

## 3. Sequence: Đăng nhập & Refresh Token

```mermaid
sequenceDiagram
    actor User as Người dùng
    participant FE as Frontend
    participant API as Backend API
    participant Redis as Redis / Blacklist
    participant DB as MySQL DB

    User->>FE: Nhập email + mật khẩu
    FE->>API: POST /api/auth/login

    API->>DB: Tìm user theo email
    DB-->>API: User record

    alt User không tồn tại
        API-->>FE: 401 Unauthorized
    else Tài khoản bị vô hiệu hóa
        API-->>FE: 403 Forbidden
    else Email chưa xác thực
        API-->>FE: 403 "Vui lòng xác thực email"
    else Mật khẩu sai
        API-->>FE: 401 Unauthorized
    else Đăng nhập thành công
        API->>API: Sinh accessToken (JWT 15m) và refreshToken (family ID pattern)
        API->>DB: Lưu refreshToken + familyId
        API-->>FE: 200 OK + accessToken (refreshToken trong httpOnly cookie)
        FE-->>User: Đăng nhập thành công
    end

    Note over FE,API: --- Khi accessToken hết hạn ---

    FE->>API: POST /api/auth/refresh-token (gửi refreshToken từ cookie)
    API->>DB: Tìm refreshToken theo value
    DB-->>API: Record

    alt Token không tồn tại hoặc bị blacklist
        Note over API: Phát hiện reuse attack
        API->>DB: Thu hồi toàn bộ family (invalidate tất cả token cùng familyId)
        API-->>FE: 401 "Phiên đăng nhập không hợp lệ"
        FE-->>User: Yêu cầu đăng nhập lại
    else Token hợp lệ
        API->>DB: Blacklist refreshToken cũ
        API->>API: Sinh accessToken mới và refreshToken mới (rotate)
        API->>DB: Lưu refreshToken mới
        API-->>FE: 200 OK + accessToken mới (refreshToken mới trong cookie)
    end

    Note over FE,API: --- Đăng xuất ---

    FE->>API: POST /api/auth/logout
    API->>Redis: Blacklist accessToken theo jti
    API->>DB: Thu hồi refreshToken family
    API-->>FE: 200 OK + clear cookie
    FE-->>User: Đăng xuất thành công
```

---

## 4. Sequence: Đặt hàng & Thanh toán VNPay

```mermaid
sequenceDiagram
    actor Customer as Khách hàng
    participant FE as Frontend
    participant API as Backend API
    participant DB as MySQL DB
    participant VNPay as VNPay Gateway

    Customer->>FE: Xác nhận đặt hàng (địa chỉ, phương thức, mã giảm giá)
    FE->>API: POST /api/orders

    API->>DB: SELECT FOR UPDATE product_variants (lock stock tránh race condition)
    DB-->>API: Thông tin tồn kho

    alt Không đủ hàng
        API->>DB: Rollback, giải phóng lock
        API-->>FE: 422 "Sản phẩm không đủ tồn kho"
        FE-->>Customer: Thông báo hết hàng
    else Đủ hàng
        API->>DB: Trừ stock tạm thời (lock)
        API->>API: Tính giá: subtotal + phí ship + warranty + discount + loyalty
        API->>DB: Tạo Order + OrderItems
        API->>DB: Ghi nhận discount code đã dùng (nếu có)
        API->>DB: Tạo LoyaltyHistory (điểm tích lũy)

        alt Phương thức COD
            API->>DB: Cập nhật paymentStatus='pending' orderStatus='pending'
            API-->>FE: 201 Created + orderId
            FE-->>Customer: Đặt hàng thành công (COD)
        else Phương thức VNPay
            API->>API: Tạo VNPay payment URL (HMAC-SHA512 signature)
            API-->>FE: 201 Created + vnpayUrl
            FE->>Customer: Redirect đến VNPay
        end
    end

    Note over Customer,VNPay: --- Thanh toán trên cổng VNPay ---

    Customer->>VNPay: Nhập thông tin thanh toán
    VNPay-->>Customer: Xác nhận giao dịch

    VNPay->>API: IPN Webhook POST /api/payments/vnpay/ipn
    API->>API: Verify HMAC-SHA512 signature
    API->>DB: Kiểm tra idempotency (paymentTransactionId đã xử lý chưa)

    alt Signature sai hoặc đã xử lý
        API-->>VNPay: Phản hồi lỗi
    else Giao dịch hợp lệ, chưa xử lý
        API->>DB: Cập nhật paymentStatus='paid' orderStatus='processing'
        API->>DB: Xóa cart items của đơn hàng
        API->>API: Publish event payment.succeeded (event-bus)
        API-->>VNPay: 200 OK (confirm nhận IPN)
        API->>Customer: Gửi email xác nhận đơn hàng (async)
    end

    FE->>API: GET /api/orders/:id (polling hoặc redirect)
    API-->>FE: Order detail + paymentStatus
    FE-->>Customer: Hiển thị kết quả đơn hàng
```

---

## 5. Sequence: AI Chatbot — RAG Pipeline

```mermaid
sequenceDiagram
    actor User as Người dùng
    participant CW as ChatWidget (Frontend)
    participant API as Backend AI API
    participant RAG as RAG Pipeline
    participant VS as Vector Store
    participant LLM as LLM Provider (cấu hình qua .env)

    User->>CW: Nhập câu hỏi
    CW->>API: POST /api/chatbot/message {message, sessionId}
    Note over API: chatbotLimiter: 20 req/60s

    API->>RAG: Xử lý input
    RAG->>RAG: 1. Validate (độ dài, nội dung)
    RAG->>RAG: 2. Normalize (expand viết tắt: ip→iPhone, ss→Samsung)
    RAG->>RAG: 3. Off-topic check (rule-based regex, 0 API call)

    alt Intent: off_topic / greeting / general
        RAG->>LLM: Gửi message trực tiếp (skip retrieval)
        LLM-->>RAG: Response
        RAG-->>API: Response text
    else Intent: product_search / pricing / policy
        RAG->>RAG: Kiểm tra Redis cache (TTL 5 phút, shared)

        alt Cache hit
            RAG-->>API: Trả cached response
        else Cache miss — bắt đầu retrieval
            par Bước 4 - Tìm kiếm song song
                RAG->>LLM: Rewrite query (max_tokens:80, temp:0, timeout 8s)
            and
                RAG->>VS: Hybrid search BM25 + cosine similarity (topK=10, minScore=0.45)
                VS-->>RAG: Kết quả ban đầu
            end

            LLM-->>RAG: Query đã rewrite

            alt Rewritten query khác normalized query
                RAG->>VS: Bước 5 - Hybrid search với rewritten query
                VS-->>RAG: Kết quả mới
                RAG->>RAG: So sánh 2 tập kết quả, chọn tốt hơn
            end

            alt Số kết quả < threshold
                RAG->>VS: Fallback - hạ threshold, lấy top-3
                VS-->>RAG: Kết quả fallback
            end

            RAG->>RAG: Bước 6 - Augment context (retrieved products + chat history)
            RAG->>LLM: Bước 7 - Generate (temp:0.3, max_tokens:800, json_object)
            LLM-->>RAG: Response + product suggestions

            RAG->>RAG: Bước 8 - Parse response, fuzzy match products
            RAG->>RAG: Lưu vào Redis cache
            RAG-->>API: Response + product links
        end
    end

    API->>API: Cập nhật chat history (in-memory Map, TTL 30 phút, max 10 turns)
    API->>API: Persist to DB (async)
    API-->>CW: { response, products[], suggestions[], intent }
    CW-->>User: Hiển thị phản hồi + product cards
```

---

## 6. Flowchart: Giỏ hàng Guest → Login → Merge

```mermaid
flowchart TD
    A([Khách vãng lai truy cập]) --> B{Đã đăng nhập?}

    B -- Chưa --> C[Thêm sản phẩm vào giỏ\nguest cart - sessionId cookie]
    C --> D[Tiếp tục mua sắm]
    D --> E{Muốn đặt hàng?}

    E -- Chưa --> C
    E -- Có --> F[Nhấn Đăng nhập / Đăng ký]

    F --> G[Đăng nhập thành công\nBackend nhận userId + sessionId]
    G --> H[API: Tìm guest cart theo sessionId\nvà user cart theo userId]

    H --> I{Guest cart có items?}

    I -- Không --> J[Dùng user cart hiện có]
    I -- Có --> K{User cart có items trùng\ncùng productId + variantId?}

    K -- Không --> L[Chuyển toàn bộ guest items\nvào user cart]
    K -- Có --> M[Cộng dồn quantity\ncho items trùng]
    M --> N[Chuyển items không trùng\nvào user cart]
    N --> O[Đánh dấu guest cart\nstatus='merged']
    L --> O

    O --> P[Sync check tồn kho thực tế]
    J --> P

    P --> Q{Đủ hàng?}
    Q -- Không --> R[Cập nhật quantity theo tồn kho\nthông báo cho user]
    Q -- Có --> S

    R --> S[Hiển thị cart đã merge cho user đăng nhập]
    B -- Rồi --> S

    S --> T{Tiến hành checkout?}
    T -- Có --> U([Trang Checkout])
    T -- Không --> V[Tiếp tục mua sắm]
```

---

## 7. Sequence: Đánh giá Sản phẩm

```mermaid
sequenceDiagram
    actor Customer as Khách hàng
    participant FE as Frontend
    participant API as Backend API (reviews)
    participant DB as MySQL DB

    Customer->>FE: Mở trang chi tiết sản phẩm, nhấn "Viết đánh giá"
    FE->>API: GET /api/reviews/check-purchased {productId}
    API->>DB: Kiểm tra orders của user có chứa productId và status='delivered'

    alt Chưa mua sản phẩm này
        DB-->>API: Không có đơn hàng phù hợp
        API-->>FE: 403 Forbidden
        FE-->>Customer: "Chỉ khách hàng đã mua mới có thể đánh giá"
    else Đã mua sản phẩm
        DB-->>API: orderId hợp lệ
        API-->>FE: 200 OK — cho phép đánh giá
        FE-->>Customer: Hiển thị form đánh giá (sao + nhận xét)

        Customer->>FE: Chọn số sao (1-5), nhập nhận xét, nhấn Gửi
        FE->>API: POST /api/reviews {productId, orderId, rating, comment}
        API->>DB: Kiểm tra user đã đánh giá cùng productId + orderId chưa

        alt Đã đánh giá trước đó
            DB-->>API: Review tồn tại
            API-->>FE: 409 Conflict
            FE-->>Customer: "Bạn đã đánh giá sản phẩm này"
        else Chưa đánh giá
            API->>DB: INSERT review (userId, productId, orderId, rating, comment)
            API->>DB: Tính lại avg_rating — UPDATE products SET avg_rating, review_count
            DB-->>API: Thành công
            API-->>FE: 201 Created + review object
            FE-->>Customer: Hiển thị đánh giá vừa gửi
        end
    end
```

---

## 8. Sequence: Tích & Đổi Điểm Loyalty

```mermaid
sequenceDiagram
    actor Customer as Khách hàng
    participant FE as Frontend
    participant API as Backend API (loyalty)
    participant DB as MySQL DB

    Note over Customer,DB: --- Luồng Tích Điểm (sau đặt hàng thành công) ---

    API->>DB: Lấy thông tin đơn hàng (total, userId)
    API->>API: Tính điểm tích lũy (total / POINTS_EARN_RATE, 100k VND = 1 điểm)
    API->>DB: UPDATE users SET loyalty_points = loyalty_points + points
    API->>DB: INSERT loyalty_histories (userId, orderId, type='earn', points)
    API->>API: Kiểm tra ngưỡng hạng thành viên (Bronze/Silver/Gold/Platinum)
    API->>DB: UPDATE users SET loyalty_tier nếu đủ điều kiện lên hạng
    DB-->>API: Cập nhật thành công

    Note over Customer,DB: --- Luồng Đổi Điểm (tại trang Checkout) ---

    Customer->>FE: Tích chọn "Dùng điểm tích lũy", nhập số điểm muốn đổi
    FE->>API: POST /api/loyalty/redeem {points}
    API->>DB: Lấy loyalty_points hiện tại của user
    DB-->>API: Số điểm hiện có

    alt Không đủ điểm
        API-->>FE: 422 "Số điểm không đủ"
        FE-->>Customer: Thông báo lỗi
    else Đủ điểm
        API->>API: Tính giá trị quy đổi (1 điểm = POINTS_VALUE VND)
        API-->>FE: 200 OK + discount_amount
        FE-->>Customer: Hiển thị số tiền được giảm

        Customer->>FE: Xác nhận đặt hàng với điểm đã chọn
        FE->>API: POST /api/orders {..., loyaltyPointsUsed}
        API->>DB: Validate lại điểm (tránh race condition)
        API->>DB: UPDATE users SET loyalty_points = loyalty_points - pointsUsed
        API->>DB: INSERT loyalty_histories (type='spend', points=-pointsUsed)
        DB-->>API: Thành công
        API-->>FE: 201 Created + orderId
        FE-->>Customer: Đặt hàng thành công (hiển thị điểm đã dùng)
    end
```

---

## 9. Flowchart: Checkout Đầy Đủ

```mermaid
flowchart TD
    A([Giỏ hàng]) --> B[Xem lại sản phẩm và số lượng]
    B --> C[Chọn địa chỉ giao hàng]
    C --> D{Đã có địa chỉ?}

    D -- Chưa --> E[Thêm địa chỉ mới]
    E --> F[Lưu địa chỉ]
    F --> G
    D -- Rồi --> G[Chọn gói bảo hành cho từng sản phẩm - tùy chọn]

    G --> H[Nhập mã giảm giá - tùy chọn]
    H --> I{Có nhập mã?}

    I -- Có --> J[Validate mã giảm giá\nAPI /discount-codes/apply]
    J --> K{Mã hợp lệ?}
    K -- Không --> L[Hiển thị lỗi, cho phép nhập lại]
    L --> H
    K -- Có --> M[Áp dụng discount_amount]
    I -- Không --> M

    M --> N[Sử dụng điểm Loyalty - tùy chọn]
    N --> O{Muốn dùng điểm?}

    O -- Có --> P[Nhập số điểm muốn đổi\nValidate: đủ điểm?]
    P --> Q{Đủ điểm?}
    Q -- Không --> R[Thông báo lỗi, cho phép thay đổi]
    R --> P
    Q -- Có --> S[Tính giảm giá từ điểm]
    O -- Không --> S

    S --> T[Hiển thị tóm tắt đơn hàng\nsubtotal + ship + warranty - discount - loyalty]
    T --> U[Chọn phương thức thanh toán]
    U --> V{Phương thức?}

    V -- COD --> W[POST /api/orders paymentMethod=cod]
    W --> X[Order pending]
    X --> AA([Xác nhận đơn COD])

    V -- Chuyển khoản --> AB[POST /api/orders paymentMethod=bank_transfer]
    AB --> AC[Order pending_payment]
    AC --> AE([Chờ admin xác nhận])

    V -- VNPay --> AF[POST /api/orders paymentMethod=vnpay]
    AF --> AG[Tạo VNPay URL - HMAC-SHA512]
    AG --> AH[Redirect cổng VNPay]
    AH --> AI{Thanh toán thành công?}
    AI -- Không --> AJ([Đơn hàng bị hủy])
    AI -- Có --> AK[VNPay IPN webhook\nVerify signature]
    AK --> AL[paymentStatus=paid]
    AL --> AM([Xác nhận đơn VNPay])

    V -- MoMo --> AO[POST /api/orders paymentMethod=momo]
    AO --> AP[Tạo MoMo URL]
    AP --> AQ[Redirect cổng MoMo]
    AQ --> AR{Thanh toán thành công?}
    AR -- Không --> AS([Đơn hàng bị hủy])
    AR -- Có --> AT[MoMo IPN webhook\nVerify chữ ký]
    AT --> AU[paymentStatus=paid]
    AU --> AW([Xác nhận đơn MoMo])
```

---

## 10. Sequence: Admin Quản lý Sản phẩm

```mermaid
sequenceDiagram
    actor Admin
    participant FE as Frontend (AdminProductsPage)
    participant API as Backend API (/api/admin/products)
    participant DB as MySQL DB

    Admin->>FE: Truy cập /admin/products
    FE->>API: GET /api/admin/products?page=1&limit=20
    API->>DB: SELECT products + variants + images
    DB-->>API: Danh sách sản phẩm
    API-->>FE: { data, pagination }
    FE-->>Admin: Hiển thị danh sách

    Admin->>FE: Điền form tạo sản phẩm mới
    FE->>API: POST /api/admin/products
    Note over API: Validate Zod schema (tên, giá, danh mục, biến thể)
    API->>DB: BEGIN TRANSACTION
    DB-->>API: OK
    API->>DB: INSERT INTO products
    API->>DB: INSERT INTO product_variants (nhiều biến thể)
    API->>DB: INSERT INTO product_images
    API->>DB: COMMIT
    DB-->>API: Product ID mới
    Note over API: Hook afterCreate: sync vector store AI (async, không block)
    API-->>FE: { product, message: "Tạo thành công" }
    FE-->>Admin: Thông báo thành công

    Admin->>FE: Upload ảnh sản phẩm
    FE->>API: POST /api/uploads/product/multiple (multipart/form-data)
    API->>DB: Lưu thông tin file vào product_images
    DB-->>API: OK
    API-->>FE: { urls: [...] }
    FE-->>Admin: Preview ảnh đã upload

    Admin->>FE: Nhập số lượng restock
    FE->>API: POST /api/admin/products/:id/restock
    API->>DB: UPDATE product_variants SET stock = stock + quantity
    API->>DB: INSERT INTO inventory_logs (type: restock)
    DB-->>API: OK
    API-->>FE: { message: "Đã cập nhật tồn kho" }
    FE-->>Admin: Xác nhận restock thành công
```

---

## 11. Entity Relationship Diagram — Simplified

```mermaid
erDiagram
    users {
        int id PK
        string email UK
        string password
        string full_name
        string role
        boolean is_email_verified
        boolean is_active
        string loyalty_tier
        int loyalty_points
        datetime deleted_at
    }

    products {
        int id PK
        string name
        string slug UK
        text description
        int brand_id FK
        boolean is_active
        datetime deleted_at
    }

    product_variants {
        int id PK
        int product_id FK
        string sku UK
        decimal price
        decimal original_price
        int stock
        string color
        string storage
        boolean is_active
    }

    product_images {
        int id PK
        int product_id FK
        int variant_id FK
        string url
        boolean is_primary
        int sort_order
    }

    categories {
        int id PK
        string name
        string slug UK
        int parent_id FK
        boolean is_active
    }

    product_categories {
        int product_id FK
        int category_id FK
    }

    brands {
        int id PK
        string name
        string slug UK
        string logo_url
    }

    collections {
        int id PK
        string name
        string slug UK
        boolean is_active
    }

    product_collections {
        int product_id FK
        int collection_id FK
    }

    carts {
        int id PK
        int user_id FK
        string session_id
        string status
    }

    cart_items {
        int id PK
        int cart_id FK
        int product_id FK
        int variant_id FK
        int quantity
    }

    orders {
        int id PK
        int user_id FK
        int address_id FK
        int discount_code_id FK
        string status
        string payment_method
        string payment_status
        decimal subtotal
        decimal shipping_fee
        decimal discount_amount
        decimal warranty_fee
        decimal total
        datetime deleted_at
    }

    order_items {
        int id PK
        int order_id FK
        int product_id FK
        int variant_id FK
        int quantity
        decimal unit_price
        int warranty_package_id FK
    }

    addresses {
        int id PK
        int user_id FK
        string full_name
        string phone
        string province
        string district
        string ward
        string detail
        boolean is_default
    }

    reviews {
        int id PK
        int user_id FK
        int product_id FK
        int order_id FK
        int rating
        text comment
        datetime deleted_at
    }

    wishlists {
        int id PK
        int user_id FK
        int product_id FK
    }

    discount_codes {
        int id PK
        string code UK
        string type
        decimal value
        decimal min_order_value
        int max_uses
        int used_count
        datetime expires_at
        boolean is_active
    }

    warranty_packages {
        int id PK
        string name
        int duration_months
        decimal price
        boolean is_active
    }

    product_warranties {
        int product_id FK
        int warranty_package_id FK
    }

    loyalty_histories {
        int id PK
        int user_id FK
        int order_id FK
        string type
        int points
        string description
    }

    inventory_logs {
        int id PK
        int variant_id FK
        int user_id FK
        string action
        int quantity_change
        int quantity_before
        int quantity_after
    }

    audit_logs {
        int id PK
        int admin_id FK
        string action
        string entity_type
        int entity_id
        json changes
        string ip_address
    }

    %% Relationships
    users ||--o{ orders : "đặt"
    users ||--o{ reviews : "viết"
    users ||--o{ wishlists : "lưu"
    users ||--o{ loyalty_histories : "tích lũy"
    users ||--o{ carts : "có"
    users ||--o{ addresses : "có"
    users ||--o{ audit_logs : "thực hiện"

    products ||--o{ product_variants : "có"
    products ||--o{ product_images : "có"
    products ||--o{ product_categories : "thuộc"
    products ||--o{ product_collections : "thuộc"
    products ||--o{ reviews : "nhận"
    products ||--o{ wishlists : "được lưu"
    products ||--o{ product_warranties : "áp dụng"

    product_variants ||--o{ cart_items : "trong"
    product_variants ||--o{ order_items : "trong"
    product_variants ||--o{ inventory_logs : "theo dõi"

    categories ||--o{ product_categories : "chứa"
    categories ||--o| categories : "danh mục cha"

    brands ||--o{ products : "sản xuất"

    collections ||--o{ product_collections : "chứa"

    carts ||--o{ cart_items : "có"

    orders ||--o{ order_items : "gồm"
    orders ||--o| addresses : "giao tới"
    orders ||--o| discount_codes : "dùng"
    orders ||--o{ loyalty_histories : "tạo"

    warranty_packages ||--o{ product_warranties : "áp dụng"
    warranty_packages ||--o{ order_items : "chọn"

    discount_codes ||--o{ orders : "được dùng trong"
```

---

## 12. Entity Relationship Diagram — 35 Models

```mermaid
erDiagram
    users {
        int id PK
        string email UK
        string password_hash
        string role
        string loyalty_tier
        int loyalty_points
        datetime deleted_at
    }
    addresses {
        int id PK
        int user_id FK
        string full_name
        string phone
        string province
        string district
        string ward
        string address_line
        bool is_default
    }
    categories {
        int id PK
        int parent_id FK
        string name
        string slug UK
        datetime deleted_at
    }
    brands {
        int id PK
        string name
        string slug UK
        datetime deleted_at
    }
    collections {
        int id PK
        string name
        string slug UK
        datetime deleted_at
    }
    products {
        int id PK
        int category_id FK
        int brand_id FK
        string name
        string slug UK
        decimal price
        decimal sale_price
        bool is_active
        datetime deleted_at
    }
    product_variants {
        int id PK
        int product_id FK
        string sku UK
        string color
        string storage
        int stock
        decimal price
        datetime deleted_at
    }
    product_images {
        int id PK
        int product_id FK
        int variant_id FK
        string url
        bool is_primary
        datetime deleted_at
    }
    product_categories {
        int product_id FK
        int category_id FK
    }
    product_collections {
        int product_id FK
        int collection_id FK
    }
    attribute_groups {
        int id PK
        int product_id FK
        string name
    }
    attribute_values {
        int id PK
        int group_id FK
        string name
        string value
    }
    product_attribute_groups {
        int product_id FK
        int group_id FK
    }
    orders {
        int id PK
        int user_id FK
        string order_number UK
        string status
        decimal total_amount
        string payment_method
        string payment_status
        datetime deleted_at
    }
    order_items {
        int id PK
        int order_id FK
        int product_id FK
        int variant_id FK
        int quantity
        decimal unit_price
    }
    carts {
        int id PK
        int user_id FK
        string session_id
    }
    cart_items {
        int id PK
        int cart_id FK
        int variant_id FK
        int quantity
    }
    discount_codes {
        int id PK
        string code UK
        string type
        decimal value
        int usage_limit
        int used_count
        datetime expires_at
        datetime deleted_at
    }
    reviews {
        int id PK
        int user_id FK
        int product_id FK
        int order_id FK
        int rating
        text content
        bool is_verified
        datetime deleted_at
    }
    review_feedbacks {
        int id PK
        int review_id FK
        int user_id FK
        bool is_helpful
    }
    wishlists {
        int id PK
        int user_id FK
        int product_id FK
    }
    warranty_packages {
        int id PK
        string name
        int duration_months
        decimal price
    }
    product_warranties {
        int id PK
        int product_id FK
        int package_id FK
    }
    loyalty_histories {
        int id PK
        int user_id FK
        int points
        string type
        string description
    }
    recently_viewed {
        int id PK
        int user_id FK
        int product_id FK
        datetime viewed_at
    }
    chat_messages {
        int id PK
        int user_id FK
        string session_id
        string role
        text content
    }
    search_histories {
        int id PK
        int user_id FK
        string keyword
        int results_count
    }
    inventory_logs {
        int id PK
        int variant_id FK
        int changed_by FK
        string type
        int quantity_before
        int quantity_after
        string note
    }
    audit_logs {
        int id PK
        int admin_id FK
        string action
        string resource
        int resource_id
        json changes
    }
    import_logs {
        int id PK
        int admin_id FK
        string file_name
        int total_rows
        int success_rows
        int failed_rows
    }
    news {
        int id PK
        int author_id FK
        string title
        string slug UK
        text content
        bool is_published
        datetime deleted_at
    }
    banners {
        int id PK
        string title
        string image_url
        string link_url
        int position
        bool is_active
        datetime deleted_at
    }
    email_campaigns {
        int id PK
        int created_by FK
        string subject
        text content
        string status
        datetime sent_at
    }
    newsletter_subscribers {
        int id PK
        string email UK
        bool is_active
    }
    feedbacks {
        int id PK
        int user_id FK
        string type
        text content
        string status
    }

    users ||--o{ addresses : "có"
    users ||--o{ orders : "đặt"
    users ||--o{ reviews : "viết"
    users ||--o{ wishlists : "lưu"
    users ||--o{ loyalty_histories : "tích điểm"
    users ||--o{ recently_viewed : "xem gần đây"
    users ||--o{ chat_messages : "chat"
    users ||--o{ search_histories : "tìm kiếm"
    users ||--o{ carts : "có giỏ"
    users ||--o{ audit_logs : "ghi nhật ký"

    products ||--o{ product_variants : "có biến thể"
    products ||--o{ product_images : "có ảnh"
    products }o--o{ categories : "thuộc (product_categories)"
    products }o--o{ collections : "thuộc (product_collections)"
    products ||--o{ reviews : "nhận đánh giá"
    products ||--o{ wishlists : "được lưu"
    products ||--o{ recently_viewed : "được xem"
    products ||--o{ product_warranties : "có gói bảo hành"
    products }o--o{ attribute_groups : "có thuộc tính (product_attribute_groups)"
    products ||--o{ order_items : "trong đơn"

    brands ||--o{ products : "sở hữu"
    categories ||--o{ categories : "danh mục con"

    attribute_groups ||--o{ attribute_values : "có giá trị"

    orders ||--o{ order_items : "chứa"
    orders ||--o{ reviews : "cho phép review"

    product_variants ||--o{ order_items : "trong đơn hàng"
    product_variants ||--o{ cart_items : "trong giỏ"
    product_variants ||--o{ inventory_logs : "theo dõi tồn kho"
    product_variants ||--o{ product_images : "có ảnh riêng"

    carts ||--o{ cart_items : "chứa"

    reviews ||--o{ review_feedbacks : "nhận phản hồi"

    warranty_packages ||--o{ product_warranties : "áp dụng cho"

    email_campaigns ||--o{ newsletter_subscribers : "gửi đến"
```
