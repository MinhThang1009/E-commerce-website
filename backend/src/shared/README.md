# shared/ — Cross-module foundation (Phase 42.1)

Module cross-cutting concerns dùng chung cho mọi `modules/*`. KHÔNG có business logic, KHÔNG phụ thuộc vào module cụ thể.

## Cấu trúc

```
shared/
├── errors/              # AppError, DomainError, ValidationError, NotFoundError
├── result.js            # Result wrapper (success/failure)
├── eventBus.js          # In-process pub-sub
├── persistence/
│   ├── sequelize.js     # Sequelize instance (re-export config/sequelize)
│   └── unitOfWork.js    # Transaction helper
├── cache/redisClient.js  # Redis client (re-export config/redis)
├── http/middlewares/    # authenticate, errorHandler, validateRequest, ...
├── socket/index.js      # Socket.IO setup (re-export config/socket)
├── logger.js            # Winston wrapper (re-export utils/logger)
├── mailer.js            # Nodemailer wrapper (re-export services/email)
└── utils/catchAsync.js  # Async error wrapper (re-export utils/catchAsync)
```

## Quy tắc

1. **Mọi module mới phải import từ `shared/`** thay vì path cũ. Ví dụ:
   - `require('../../shared/persistence/sequelize')` ✅
   - `require('../../config/sequelize')` ❌ (deprecated, sẽ xóa Phase 5)
2. **Re-export pattern:** Hầu hết file `shared/` re-export từ vị trí hiện tại để bảo toàn singleton (sequelize connection pool, redis client, rate-limiter stores). Phase 5 cleanup sẽ flip ngược — code thật vào `shared/`, xóa file cũ.
3. **File mới (errors/, eventBus, result, unitOfWork)** viết implementation đầy đủ ngay tại `shared/` (không có path cũ nào để re-export).
4. **Không thêm business logic** vào `shared/`. Email templates, payment gateways, AI prompts — đều thuộc `modules/*`.
