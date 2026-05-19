#!/usr/bin/env bash
# Phase 42.19.2 — Pre-commit architecture audit
# Block commits violating Modular Monolith + 3-layer + Repository pattern.
set -e

CHANGED=$(git diff --cached --name-only --diff-filter=ACM)
[ -z "$CHANGED" ] && exit 0

echo "🔍 Audit architecture rules..."

# Helper: list files matching pattern from staged changes
filter_staged() {
  echo "$CHANGED" | grep -E "$1" || true
}

# RULE 1: Services không được import Sequelize hoặc Model.X trực tiếp
SERVICES=$(filter_staged 'backend/src/modules/.*/services/[^.]*\.js$' | grep -v '\.test\.js$' || true)
if [ -n "$SERVICES" ]; then
  VIOLATIONS=$(echo "$SERVICES" | xargs -I {} grep -l -E "require[[:space:]]*\([[:space:]]*['\"]sequelize['\"]|Model\.(findAll|findOne|findByPk|create|update|destroy|bulkCreate)" {} 2>/dev/null || true)
  if [ -n "$VIOLATIONS" ]; then
    echo "❌ BLOCKED: Service không được import Sequelize hoặc Model.X trực tiếp."
    echo "$VIOLATIONS"
    echo "→ Tạo/dùng repository thay vì truy cập Model trực tiếp."
    exit 1
  fi
fi

# RULE 2: Controllers không được import Sequelize hoặc gọi Model.X (exclude test files)
CONTROLLERS=$(filter_staged 'backend/src/modules/.*/controllers/[^.]*\.js$' | grep -v '\.test\.js$' || true)
if [ -n "$CONTROLLERS" ]; then
  VIOLATIONS=$(echo "$CONTROLLERS" | xargs -I {} grep -l -E "require[[:space:]]*\([[:space:]]*['\"]sequelize['\"]|Model\.(findAll|findOne|findByPk|create|update|destroy)" {} 2>/dev/null || true)
  if [ -n "$VIOLATIONS" ]; then
    echo "❌ BLOCKED: Controller không được touch ORM. Delegate sang service."
    echo "$VIOLATIONS"
    exit 1
  fi
fi

# RULE 3: Cross-module deep import (require từ '../../{otherModule}/services|repositories|domain' bị block)
MODULES_FILES=$(filter_staged 'backend/src/modules/.*\.js$')
if [ -n "$MODULES_FILES" ]; then
  VIOLATIONS=$(echo "$MODULES_FILES" | xargs -I {} grep -l -E "require\([[:space:]]*['\"]\.\./\.\./[a-z][a-z0-9-]*/(services|repositories|domain|models)" {} 2>/dev/null || true)
  if [ -n "$VIOLATIONS" ]; then
    echo "❌ BLOCKED: Cross-module deep import. Dùng DI hoặc eventBus thay vì require thẳng module khác."
    echo "$VIOLATIONS"
    exit 1
  fi
fi

# RULE 4: Frontend deep import bypass barrel (warn only)
FE_FILES=$(filter_staged 'frontend/src/.*\.(ts|tsx)$' | grep -v '__tests__' || true)
if [ -n "$FE_FILES" ]; then
  VIOLATIONS=$(echo "$FE_FILES" | xargs -I {} grep -l -E "from[[:space:]]+['\"]@/features/[a-z][a-z0-9-]*/(components|pages|hooks|api|store)" {} 2>/dev/null || true)
  if [ -n "$VIOLATIONS" ]; then
    echo "⚠️  WARN: FE deep import bypass barrel — nên import từ '@/features/{name}' thay vì internal path."
    echo "$VIOLATIONS"
    # Warn only, không block (1 số case test setup hoặc lazy load có thể cần)
  fi
fi

echo "✅ Architecture audit pass."
