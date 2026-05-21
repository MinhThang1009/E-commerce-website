# Jobs — Scheduled Maintenance Tasks

> 1 file duy nhất: `cleanup.js`. Auto-register khi `require('@jobs/cleanup')` trong `app.js`.

← Quay lại [`backend/CLAUDE.md`](../../CLAUDE.md)

## Mục lục

- [1. Cron schedule](#1-cron-schedule)
- [2. Daily cleanup — thứ tự thực hiện](#2-daily-cleanup--thứ-tự-thực-hiện)
- [3. Weekly cleanup](#3-weekly-cleanup)
- [4. Key patterns](#4-key-patterns)

---

## 1. Cron schedule

| Job            | Cron        | Thời điểm        |
| -------------- | ----------- | ---------------- |
| Daily cleanup  | `0 2 * * *` | 2:00 AM mỗi ngày |
| Weekly cleanup | `0 3 * * 0` | 3:00 AM Chủ nhật |

Dùng thư viện `node-cron`.

---

## 2. Daily cleanup — thứ tự thực hiện

1. Xóa abandoned carts > 30 ngày
2. Trim `search_histories` xuống ≤50 records/user (FIFO — xóa cũ nhất)
3. Xóa expired OTPs
4. Xóa expired reset password tokens
5. Deactivate `discount_codes` đã qua `endDate`
6. Archive `chat_messages` > 90 ngày (`isArchived = true`)
7. Xóa `recently_viewed_products` > 90 ngày
8. Xóa temp upload files > 24h (`uploads/temp/`)

---

## 3. Weekly cleanup

Gọi `imageService.cleanupOrphanedFiles()` — xóa upload files không còn reference trong DB.

---

## 4. Key patterns

- **Lazy-require** models trong function body → tránh circular dependency lúc startup
- **`Promise.allSettled`** cho parallel steps — 1 bước fail không block bước khác
- **Lỗi log `.warn()`**, không throw — không crash app
- **Không disable** cron jobs trừ khi có lý do rõ ràng

**Gọi thủ công khi cần (debug/test):**

```js
const { runDailyCleanup, runWeeklyCleanup } = require('@jobs/cleanup');
await runDailyCleanup();
await runWeeklyCleanup();
```
