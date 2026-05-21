# Routes — Legacy Routes (index.js)

> Gần như rỗng. Tất cả feature routes đã migrate sang `src/modules/*/routes.js` trong `app.js`.

← Quay lại [`backend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Còn lại](#1-còn-lại)
  - [GET /api/health](#get-apihealth)
- [2. Khi cần thêm route mới](#2-khi-cần-thêm-route-mới)

---

## 1. Còn lại

### GET /api/health

Health check endpoint — dùng bởi deploy scripts và uptime monitoring.

Response:

```json
{
  "status": "success",
  "db": "ok",
  "redis": "ok | memory_fallback | not_configured | error",
  "uptime": 3600,
  "version": "1.0.0",
  "timestamp": "2026-05-20T..."
}
```

- 200 nếu DB `ok`, 503 nếu DB lỗi
- Redis status: `ok` / `memory_fallback` / `not_configured` / `error`
- Bỏ qua trong Morgan logs (`skip: req.url === '/api/health'`)

---

## 2. Khi cần thêm route mới

**KHÔNG thêm vào file này.** Dùng module generator:

```bash
node scripts/new-module.mjs --name=<name> --type=simple
```
