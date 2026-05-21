# Backend Docs — TechStore Backend

← Quay lại [`backend/CLAUDE.md`](../CLAUDE.md)

## Mục lục

- [1. Files](#1-files)
- [2. openapi.json](#2-openapijson)
- [3. Cách generate](#3-cách-generate)
- [4. Swagger UI](#4-swagger-ui)
- [5. Gotchas](#5-gotchas)

---

# 1. Files

```
docs/
└── openapi.json   ← OpenAPI 3.0 spec (auto-generated từ JSDoc @swagger comments)
```

---

# 2. openapi.json

Spec OpenAPI 3.0 được sinh từ JSDoc `@swagger` comments rải rác trong các file `routes.js` của mỗi module. Được cấu hình qua `src/config/swagger.js` (thư viện `swagger-jsdoc`).

- **Title:** E-commerce API Documentation
- **Version:** 1.0.0
- **~182 endpoints** trải qua 21 prefix route (`/api/auth`, `/api/products`, `/api/admin`, `/api/orders`, ...)

File này commit vào repo để:
- AI agents và frontend devs có thể xem API contract mà không cần khởi động server
- CI có thể diff spec khi có thay đổi route

---

# 3. Cách generate

```bash
# Từ thư mục backend/
npm run docs:openapi
# Output: docs/openapi.json
# Console: "Exported <N> paths to docs/openapi.json"
```

**Trigger generate khi:**
- Thêm route mới có JSDoc `@swagger` annotation
- Sửa request/response schema của endpoint hiện có
- Trước khi tag release

---

# 4. Swagger UI

Khi server dev đang chạy (`npm run dev`):

```
http://localhost:8888/api-docs       ← Swagger UI tương tác
http://localhost:8888/api-docs.json  ← Raw JSON spec
```

Swagger UI hỗ trợ "Try it out" — test endpoint trực tiếp từ browser. Để test endpoint cần auth:
1. Gọi `POST /api/auth/login` → copy `token` từ response
2. Click **Authorize** (nút khóa) → paste `Bearer <token>`
3. Tất cả requests tiếp theo sẽ tự inject header `Authorization`

---

# 5. Gotchas

- **Spec không tự cập nhật khi sửa code** — phải chạy `npm run docs:openapi` thủ công sau khi thêm/sửa `@swagger` annotations
- **Số lượng paths trong JSON thấp hơn thực tế** — `openapi.json` chỉ chứa các routes có JSDoc `@swagger`; nhiều routes nội bộ không được document
- **Không commit `openapi.json` từ production** — spec hiện tại cho dev, không expose thông tin security-sensitive
- **Liên quan:** [`src/config/CLAUDE.md`](../src/config/CLAUDE.md) — swagger config chi tiết
