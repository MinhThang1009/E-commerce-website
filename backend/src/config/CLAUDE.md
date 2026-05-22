# Config — Application Configuration

> Cấu hình kết nối database và Swagger. Import qua alias `@config`.

← Quay lại [`backend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. sequelize.js](#1-sequelizejs)
- [2. database.js](#2-databasejs)
- [3. swagger.js](#3-swaggerjs)

---

## 1. sequelize.js

Singleton Sequelize instance. **Dùng bởi tất cả models và DI wiring trong `app.js`.**

```js
const sequelize = require('@config/sequelize');
```

Đọc config từ `database.js` theo `NODE_ENV`. Options quan trọng:

- `freezeTableName: true` — tắt Sequelize auto-pluralize, tránh lỗi MySQL "Too many keys"
- `logging: false` — không log SQL queries ra console
- `timestamps: true`, `underscored: true` — tất cả models dùng snake_case columns
- `pool` (production): max 5, min 0, acquire 30s, idle 10s

---

## 2. database.js

Sequelize CLI config (development / test / production). Dùng bởi migrations (`npx sequelize-cli`) và `sequelize.js`.

**Env vars:**

- `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_HOST`, `DB_PORT`
- `DB_NAME_TEST` — database riêng cho test suite (default: `'ecommerce_test'`)
- `DB_SSL=true` — production only, bật SSL connection (`rejectUnauthorized: false`)

**Cố định mọi environment:** timezone `+07:00`, charset `utf8mb4`, collate `utf8mb4_unicode_ci`.

---

## 3. swagger.js

OpenAPI 3.0 spec generator. Scan JSDoc từ routes và models, tạo `swaggerSpec` object.

**Mount trong app.js:**

- `/api-docs` — Swagger UI (swagger-ui-express)
- `/api-docs.json` — Raw JSON spec (nếu expose)

**Scan paths:**

- `src/modules/**/routes.js`
- `src/routes/*.js`
- `src/models/*.js`

**Env vars:** `API_URL` (server URL), `PORT` (default `8888`)
