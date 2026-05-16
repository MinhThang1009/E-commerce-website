#!/bin/bash
set -e

PHASE20="7f9798a"
PHASE21="63e24a1"
PHASE22="9983b70"
BASE=$(git rev-parse HEAD~3)

# Stash unstaged changes
git stash push --include-untracked -m "temp-fix-msg" 2>/dev/null || true

# Tạo branch tạm từ base
git checkout -b temp-rewrite-msg "$BASE"

# --- Phase 20 ---
git cherry-pick "$PHASE20"
git commit --amend -m "Hoàn thành Phase 20 — i18n & Localization Consistency

1. Sửa USD switch bug: DashboardCharts.tsx và DashboardPage.tsx bỏ currency = 'USD', luôn dùng VND
2. Đồng nhất locale 12 files: .toLocaleString() và Intl.NumberFormat('vi-VN') → getLocale()
3. Đồng nhất date format: OrdersPage/ReviewList/PaymentQRPage/ChatMessage vi-VN → getLocale()
4. Đánh dấu [x] 3 Acceptance Criteria Phase 20 trong plan.md"

# --- Phase 21 ---
git cherry-pick "$PHASE21"
git commit --amend -m "Hoàn thành Phase 21 — SEO Standards for E-Commerce

1. Meta Tags: thêm Helmet vào ProductDetailPage/CategoryPage/ShopPage, og:title/description/image/type, canonical
2. JSON-LD: @type Product với offers.price/priceCurrency VND, aggregateRating chỉ khi reviewCount >= 1
3. URL Slug: xác nhận 45 slugs ASCII, backend model product.js dùng slugify strict:true
4. robots.txt: block /admin và /api, khai báo sitemap; thêm i18n keys shop.seo.title/description"

# --- Phase 22 (đã đúng format, chỉ cherry-pick) ---
git cherry-pick "$PHASE22"

# Di chuyển main sang branch mới
git branch -f main HEAD
git checkout main
git branch -d temp-rewrite-msg

# Restore stash
git stash pop 2>/dev/null || true

echo "Done. New log:"
git log --oneline -5
