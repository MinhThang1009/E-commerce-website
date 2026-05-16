#!/usr/bin/env bash
# Kiểm tra mọi migration file có down() method để rollback
# Chạy: bash scripts/lint-migrations.sh

set -euo pipefail

ROOT="$(git rev-parse --show-toplevel)"
MIGRATIONS_DIR="$ROOT/backend/src/migrations"

if [ ! -d "$MIGRATIONS_DIR" ]; then
  echo "⚠️ Thư mục migrations không tồn tại: $MIGRATIONS_DIR"
  exit 0
fi

# Tìm migration files thiếu down() rollback method
MIGRATION_FILES=$(find "$MIGRATIONS_DIR" -maxdepth 1 -name "*.js" -type f 2>/dev/null)
if [ -z "$MIGRATION_FILES" ]; then
  echo "ℹ️ Không có migration files."
  exit 0
fi

MISSING=$(echo "$MIGRATION_FILES" | xargs grep -lL "async down\|exports\.down\|down:" 2>/dev/null || true)
if [ -n "$MISSING" ]; then
  echo "❌ Migrations thiếu down() rollback:"
  echo "$MISSING"
  echo ""
  echo "Mỗi migration cần có down() method để rollback khi cần."
  exit 1
fi

# Đếm tổng migrations
TOTAL=$(echo "$MIGRATION_FILES" | wc -l | tr -d ' ')
echo "✅ Tất cả $TOTAL migrations đều có rollback method"
