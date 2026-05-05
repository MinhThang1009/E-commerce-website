# Production Runbook — E-Commerce Backend

> Hướng dẫn vận hành thủ công cho project khóa luận. Single-instance deployment (XAMPP local hoặc 1 VPS Linux). Không có cron tự động — mọi backup/migrate/deploy do operator chạy thủ công trước demo defense.

---

## 1. Backup database trước thao tác lớn

**Trước mọi:** migrate mới, deploy lớn, demo defense.

```bash
# XAMPP local Windows:
"C:/xampp/mysql/bin/mysqldump.exe" -u root -h 127.0.0.1 \
  --routines --triggers --single-transaction techstore \
  > backups/$(date +%Y%m%d-%H%M%S).sql

# Linux server:
mysqldump -u root -p techstore --routines --triggers --single-transaction \
  > backups/$(date +%Y%m%d-%H%M%S).sql
```

**Verify backup file size > 200KB** (current schema ~245KB).

**Retention:** giữ 5 backup gần nhất + 1 backup pre-defense; xóa cái cũ thủ công.

---

## 2. Restore database từ backup

Khi DB hỏng hoặc cần rollback:

```bash
# Drop + recreate (XAMPP):
"C:/xampp/mysql/bin/mysql.exe" -u root -h 127.0.0.1 \
  -e "DROP DATABASE IF EXISTS techstore; CREATE DATABASE techstore CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"

# Restore:
"C:/xampp/mysql/bin/mysql.exe" -u root -h 127.0.0.1 techstore < backups/<filename>.sql

# Verify:
"C:/xampp/mysql/bin/mysql.exe" -u root -h 127.0.0.1 techstore \
  -e "SELECT COUNT(*) FROM products; SELECT COUNT(*) FROM users;"
```

---

## 3. Run migrations (Phase 40 chuẩn)

```bash
cd backend
npx sequelize-cli db:migrate
```

Migrations mới phải:
- Idempotent (re-run safe — check column/index/FK exists trước khi alter).
- Có pre-flight query trong header comment (verify data safe trước khi alter).
- Backup DB trước (xem section 1).

Rollback:
```bash
npx sequelize-cli db:migrate:undo                # rollback 1 migration
npx sequelize-cli db:migrate:undo:all            # rollback all (DANGER — chỉ dùng dev)
```

---

## 4. Deploy mới (single instance)

**Pre-deploy:**
1. Backup DB (section 1).
2. `git status` clean trên main.
3. CI pass (`.github/workflows/ci.yml` xanh trên branch).

**Deploy:**
```bash
git pull origin main
cd backend && npm ci && npx sequelize-cli db:migrate
cd ../frontend && npm ci && npm run build
# Restart BE process (PM2 / systemd / nodemon depending env)
pm2 restart ecommerce-backend  # hoặc tương đương
```

**Post-deploy smoke test:**
```bash
curl http://localhost:8888/api/health
# Expected: {"status":"success","message":"API is running",...}

# Test 5 public endpoints:
for path in /products /categories /brands /banners /products/best-sellers; do
  curl -s -o /dev/null -w "%{http_code} $path\n" "http://localhost:8888/api$path"
done
# Expected: tất cả 200
```

---

## 5. Health check + monitoring

**Health endpoint:** `GET /api/health` → 200 với JSON status.

**Logs:** `backend/logs/` (Winston rotation daily). Tail real-time:
```bash
tail -f backend/logs/combined.log
```

**Vector store:** Check log boot có dòng `✅ Vector store OK: 45 vectors / 45 sản phẩm active.` Nếu vector mismatch số products active → run sync:
```bash
cd backend && node scripts/syncProducts.js
```

---

## 6. Rollback deploy

Nếu deploy mới gặp lỗi production:

1. Restore DB (section 2) từ backup pre-deploy.
2. `git checkout <prev-commit-hash>` (tag hoặc commit ID trước deploy).
3. Re-build + restart như section 4.

---

## 7. Incident escalation (cho thesis demo)

Demo defense có sự cố:
- Server crash → restart ngay (`pm2 restart`).
- DB corrupt → restore backup pre-demo (section 2).
- Frontend không load → check Vite build artifact `frontend/dist/`, re-build nếu thiếu.
- Vector store lỗi → restart BE (server.js sẽ rebuild vector từ products); nếu vẫn fail, tạm thời disable AI chatbot trong UI, demo các feature khác.

**Backup demo plan:** 1 video screencast 5 phút demo full flow (register → browse → cart → checkout VNPay sandbox → admin xử lý order) để fallback nếu live demo fail.

---

## 8. Pre-defense checklist

- [ ] DB backup `backups/pre-defense-<date>.sql` exists.
- [ ] CI green trên main.
- [ ] BE smoke test 6 endpoints PASS (section 4).
- [ ] Frontend `npm run build` không error/warning.
- [ ] Lighthouse a11y score ≥ 80 trên Home + ProductDetail + Checkout (Phase 45.6).
- [ ] Demo accounts ready: admin (`admin@techstore.vn`), customer (`customer@techstore.vn`) — password trong seed_data.sql.
- [ ] Sandbox payment test cards/accounts: VNPay sandbox, MoMo test merchant, Stripe test cards.
