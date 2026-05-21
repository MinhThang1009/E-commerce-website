'use strict';

// Phase 40.1 — Rename columns from camelCase to snake_case (DB level)
// Total: 128 columns across 25 tables
// Idempotent: safeRenameColumn skips if column already renamed (rerun-safe)
//
// PRE-FLIGHT BẮT BUỘC trước khi chạy:
//   1. mysqldump backup DB (backups/phase40-pre-*.sql)
//   2. Chạy: mysql -u root techstore -e "SET GLOBAL foreign_key_checks=0;"
//   3. Chạy: npx sequelize-cli db:migrate
//   4. Chạy: mysql -u root techstore -e "SET GLOBAL foreign_key_checks=1;"
//
// POST-FLIGHT:
//   - Verify: SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = 'techstore' AND BINARY COLUMN_NAME REGEXP '[A-Z]'
//   - Expected: 0 (trừ stripe_customer_id, google_id đã snake_case từ trước)

const COLUMN_RENAMES = [
  // addresses (6)
  ['addresses', 'userId', 'user_id'],
  ['addresses', 'firstName', 'first_name'],
  ['addresses', 'lastName', 'last_name'],
  ['addresses', 'isDefault', 'is_default'],
  ['addresses', 'createdAt', 'created_at'],
  ['addresses', 'updatedAt', 'updated_at'],

  // attribute_groups (2)
  ['attribute_groups', 'createdAt', 'created_at'],
  ['attribute_groups', 'updatedAt', 'updated_at'],

  // attribute_values (2)
  ['attribute_values', 'createdAt', 'created_at'],
  ['attribute_values', 'updatedAt', 'updated_at'],

  // banners (2)
  ['banners', 'createdAt', 'created_at'],
  ['banners', 'updatedAt', 'updated_at'],

  // carts (4)
  ['carts', 'userId', 'user_id'],
  ['carts', 'sessionId', 'session_id'],
  ['carts', 'createdAt', 'created_at'],
  ['carts', 'updatedAt', 'updated_at'],

  // cart_items (5)
  ['cart_items', 'cartId', 'cart_id'],
  ['cart_items', 'productId', 'product_id'],
  ['cart_items', 'variantId', 'variant_id'],
  ['cart_items', 'createdAt', 'created_at'],
  ['cart_items', 'updatedAt', 'updated_at'],

  // chat_messages (7) — note: session_id orphan column được drop trước trong up()
  ['chat_messages', 'userId', 'user_id'],
  ['chat_messages', 'sessionId', 'session_id'],
  ['chat_messages', 'senderId', 'sender_id'],
  ['chat_messages', 'isFromAdmin', 'is_from_admin'],
  ['chat_messages', 'isRead', 'is_read'],
  ['chat_messages', 'createdAt', 'created_at'],
  ['chat_messages', 'updatedAt', 'updated_at'],

  // discount_codes (10 — including deletedAt added by 2026050412)
  ['discount_codes', 'minOrderAmount', 'min_order_amount'],
  ['discount_codes', 'maxDiscountAmount', 'max_discount_amount'],
  ['discount_codes', 'startDate', 'start_date'],
  ['discount_codes', 'endDate', 'end_date'],
  ['discount_codes', 'usageLimit', 'usage_limit'],
  ['discount_codes', 'usedCount', 'used_count'],
  ['discount_codes', 'isActive', 'is_active'],
  ['discount_codes', 'createdAt', 'created_at'],
  ['discount_codes', 'updatedAt', 'updated_at'],
  ['discount_codes', 'deletedAt', 'deleted_at'],

  // email_campaigns (2)
  ['email_campaigns', 'createdAt', 'created_at'],
  ['email_campaigns', 'updatedAt', 'updated_at'],

  // feedbacks (2)
  ['feedbacks', 'createdAt', 'created_at'],
  ['feedbacks', 'updatedAt', 'updated_at'],

  // news (5)
  ['news', 'viewCount', 'view_count'],
  ['news', 'isPublished', 'is_published'],
  ['news', 'userId', 'user_id'],
  ['news', 'createdAt', 'created_at'],
  ['news', 'updatedAt', 'updated_at'],

  // newsletter_subscribers (2)
  ['newsletter_subscribers', 'createdAt', 'created_at'],
  ['newsletter_subscribers', 'updatedAt', 'updated_at'],

  // orders (32)
  ['orders', 'userId', 'user_id'],
  ['orders', 'shippingFirstName', 'shipping_first_name'],
  ['orders', 'shippingLastName', 'shipping_last_name'],
  ['orders', 'shippingCompany', 'shipping_company'],
  ['orders', 'shippingAddress1', 'shipping_address1'],
  ['orders', 'shippingAddress2', 'shipping_address2'],
  ['orders', 'shippingCity', 'shipping_city'],
  ['orders', 'shippingState', 'shipping_state'],
  ['orders', 'shippingZip', 'shipping_zip'],
  ['orders', 'shippingCountry', 'shipping_country'],
  ['orders', 'shippingPhone', 'shipping_phone'],
  ['orders', 'billingFirstName', 'billing_first_name'],
  ['orders', 'billingLastName', 'billing_last_name'],
  ['orders', 'billingCompany', 'billing_company'],
  ['orders', 'billingAddress1', 'billing_address1'],
  ['orders', 'billingAddress2', 'billing_address2'],
  ['orders', 'billingCity', 'billing_city'],
  ['orders', 'billingState', 'billing_state'],
  ['orders', 'billingZip', 'billing_zip'],
  ['orders', 'billingCountry', 'billing_country'],
  ['orders', 'billingPhone', 'billing_phone'],
  ['orders', 'paymentMethod', 'payment_method'],
  ['orders', 'paymentStatus', 'payment_status'],
  ['orders', 'paymentTransactionId', 'payment_transaction_id'],
  ['orders', 'paymentProvider', 'payment_provider'],
  ['orders', 'shippingCost', 'shipping_cost'],
  ['orders', 'trackingNumber', 'tracking_number'],
  ['orders', 'shippingProvider', 'shipping_provider'],
  ['orders', 'estimatedDelivery', 'estimated_delivery'],
  ['orders', 'pointsEarned', 'points_earned'],
  ['orders', 'pointsUsed', 'points_used'],
  ['orders', 'pointsDiscount', 'points_discount'],
  ['orders', 'createdAt', 'created_at'],
  ['orders', 'updatedAt', 'updated_at'],
  ['orders', 'deletedAt', 'deleted_at'],

  // order_items (5)
  ['order_items', 'orderId', 'order_id'],
  ['order_items', 'productId', 'product_id'],
  ['order_items', 'variantId', 'variant_id'],
  ['order_items', 'createdAt', 'created_at'],
  ['order_items', 'updatedAt', 'updated_at'],

  // product_attributes (2)
  ['product_attributes', 'createdAt', 'created_at'],
  ['product_attributes', 'updatedAt', 'updated_at'],

  // product_attribute_groups (2)
  ['product_attribute_groups', 'createdAt', 'created_at'],
  ['product_attribute_groups', 'updatedAt', 'updated_at'],

  // product_categories (2)
  ['product_categories', 'createdAt', 'created_at'],
  ['product_categories', 'updatedAt', 'updated_at'],

  // product_collections (2)
  ['product_collections', 'productId', 'product_id'],
  ['product_collections', 'collectionId', 'collection_id'],

  // product_specifications (2)
  ['product_specifications', 'createdAt', 'created_at'],
  ['product_specifications', 'updatedAt', 'updated_at'],

  // product_warranties (2)
  ['product_warranties', 'createdAt', 'created_at'],
  ['product_warranties', 'updatedAt', 'updated_at'],

  // reviews (7)
  ['reviews', 'productId', 'product_id'],
  ['reviews', 'userId', 'user_id'],
  ['reviews', 'variantId', 'variant_id'],
  ['reviews', 'isVerified', 'is_verified'],
  ['reviews', 'createdAt', 'created_at'],
  ['reviews', 'updatedAt', 'updated_at'],
  ['reviews', 'deletedAt', 'deleted_at'],

  // review_feedbacks (5)
  ['review_feedbacks', 'reviewId', 'review_id'],
  ['review_feedbacks', 'userId', 'user_id'],
  ['review_feedbacks', 'isHelpful', 'is_helpful'],
  ['review_feedbacks', 'createdAt', 'created_at'],
  ['review_feedbacks', 'updatedAt', 'updated_at'],

  // users (12 — including deletedAt added by 2026050412)
  ['users', 'firstName', 'first_name'],
  ['users', 'lastName', 'last_name'],
  ['users', 'isEmailVerified', 'is_email_verified'],
  ['users', 'isActive', 'is_active'],
  ['users', 'otpCode', 'otp_code'],
  ['users', 'otpExpires', 'otp_expires'],
  ['users', 'resetPasswordToken', 'reset_password_token'],
  ['users', 'resetPasswordExpires', 'reset_password_expires'],
  ['users', 'loyaltyPoints', 'loyalty_points'],
  ['users', 'createdAt', 'created_at'],
  ['users', 'updatedAt', 'updated_at'],
  ['users', 'deletedAt', 'deleted_at'],

  // warranty_packages (2)
  ['warranty_packages', 'createdAt', 'created_at'],
  ['warranty_packages', 'updatedAt', 'updated_at'],

  // wishlists (4)
  ['wishlists', 'userId', 'user_id'],
  ['wishlists', 'productId', 'product_id'],
  ['wishlists', 'createdAt', 'created_at'],
  ['wishlists', 'updatedAt', 'updated_at'],
];

// Helper: kiểm tra column tồn tại với case-sensitive name
async function columnExists(queryInterface, table, columnName) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND BINARY COLUMN_NAME = ?`,
    { replacements: [table, columnName] },
  );
  return rows.length > 0;
}

// Helper: lấy full column definition để preserve attributes khi rename
async function getColumnDefinition(queryInterface, table, columnName) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA, COLUMN_COMMENT
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE()
       AND TABLE_NAME = ?
       AND BINARY COLUMN_NAME = ?`,
    { replacements: [table, columnName] },
  );
  return rows[0] || null;
}

// Build CHANGE COLUMN clause preserving COLUMN_TYPE, NULL/NOT NULL, DEFAULT, EXTRA
//
// MariaDB INFORMATION_SCHEMA.COLUMN_DEFAULT format quirks:
//   - JS null              → column không có DEFAULT clause
//   - string 'NULL'        → column có DEFAULT NULL (literal NULL)
//   - 'current_timestamp()' / 'json_array()' → expression, KHÔNG quote
//   - "'value'"            → string literal đã có quote sẵn
//   - '123'                → numeric, KHÔNG quote
//   - 'value' (plain text) → string literal cần quote
function buildColumnDefSql(col) {
  const nullable = col.IS_NULLABLE === 'YES' ? 'NULL' : 'NOT NULL';

  let defaultClause = '';
  if (col.COLUMN_DEFAULT === null || col.COLUMN_DEFAULT === undefined) {
    // JS null → no DEFAULT clause; thêm DEFAULT NULL nếu nullable cho rõ ràng
    if (col.IS_NULLABLE === 'YES') {
      defaultClause = ' DEFAULT NULL';
    }
  } else if (col.COLUMN_DEFAULT === 'NULL') {
    // Literal string 'NULL' từ MariaDB INFO_SCHEMA → DEFAULT NULL (no quotes)
    defaultClause = ' DEFAULT NULL';
  } else if (
    /\(\s*\)$/.test(col.COLUMN_DEFAULT) ||
    /^(current_timestamp|CURRENT_TIMESTAMP)/i.test(col.COLUMN_DEFAULT)
  ) {
    // Function call expression: current_timestamp(), json_array(), uuid(), v.v.
    defaultClause = ` DEFAULT ${col.COLUMN_DEFAULT}`;
  } else if (col.COLUMN_DEFAULT.startsWith("'") && col.COLUMN_DEFAULT.endsWith("'")) {
    // Đã có quote sẵn (vd "'active'") → emit AS-IS
    defaultClause = ` DEFAULT ${col.COLUMN_DEFAULT}`;
  } else if (/^-?\d+(\.\d+)?$/.test(col.COLUMN_DEFAULT)) {
    // Numeric → AS-IS
    defaultClause = ` DEFAULT ${col.COLUMN_DEFAULT}`;
  } else {
    // Plain string text → quote
    defaultClause = ` DEFAULT '${col.COLUMN_DEFAULT.replace(/'/g, "''")}'`;
  }

  // EXTRA: AUTO_INCREMENT, on update CURRENT_TIMESTAMP, etc.
  const extraClause = col.EXTRA ? ` ${col.EXTRA}` : '';

  // COMMENT
  const commentClause = col.COLUMN_COMMENT
    ? ` COMMENT '${col.COLUMN_COMMENT.replace(/'/g, "''")}'`
    : '';

  return `${col.COLUMN_TYPE} ${nullable}${defaultClause}${extraClause}${commentClause}`;
}

// Idempotent rename via raw SQL CHANGE COLUMN — preserves DEFAULT current_timestamp() correctly
// (Sequelize's renameColumn helper bị bug với MariaDB datetime DEFAULT)
async function safeRenameColumn(queryInterface, table, oldName, newName) {
  const oldExists = await columnExists(queryInterface, table, oldName);
  if (!oldExists) {
    // Column đã rename hoặc chưa từng tồn tại — skip
    return false;
  }
  const newExists = await columnExists(queryInterface, table, newName);
  if (newExists) {
    throw new Error(
      `Cả 2 column "${oldName}" và "${newName}" đều tồn tại trong "${table}". ` +
        `Đây là duplicate orphan. Drop column orphan trước khi rerun migration.`,
    );
  }

  const colDef = await getColumnDefinition(queryInterface, table, oldName);
  if (!colDef) {
    return false; // Column không tồn tại (race condition hiếm)
  }

  const colDefSql = buildColumnDefSql(colDef);
  const sql = `ALTER TABLE \`${table}\` CHANGE COLUMN \`${oldName}\` \`${newName}\` ${colDefSql}`;
  await queryInterface.sequelize.query(sql);
  return true;
}

module.exports = {
  async up(queryInterface) {
    const log = (msg) => console.log(`[Phase 40.1] ${msg}`);

    // ── Pre-step 0: Lưu sql_mode hiện tại + set permissive ──
    // MariaDB strict mode reject DEFAULT expression như `json_array()` khi CHANGE COLUMN
    // (vd cart_items.warranty_package_ids). Set sql_mode='' để allow.
    const [origMode] = await queryInterface.sequelize.query('SELECT @@SESSION.sql_mode AS m');
    const originalSqlMode = origMode[0].m;
    log(`Original sql_mode: ${originalSqlMode}`);
    log("Setting sql_mode='' permissive cho migration");
    await queryInterface.sequelize.query("SET SESSION sql_mode = ''");
    await queryInterface.sequelize.query('SET SESSION foreign_key_checks = 0');

    // ── Pre-step 1: drop orphan duplicate columns (chat_messages.session_id) ──
    // session_id là orphan empty (không có migration tạo, table empty)
    // Drop để rename sessionId → session_id không conflict.
    const chatMsgHasOrphan =
      (await columnExists(queryInterface, 'chat_messages', 'sessionId')) &&
      (await columnExists(queryInterface, 'chat_messages', 'session_id'));
    if (chatMsgHasOrphan) {
      log(
        'Dropping orphan column chat_messages.session_id (empty, sẽ được tạo lại từ rename sessionId)',
      );
      await queryInterface.removeColumn('chat_messages', 'session_id');
    }

    // ── Main rename loop ──
    log(`Bắt đầu rename ${COLUMN_RENAMES.length} columns camelCase → snake_case...`);
    let renamed = 0;
    let skipped = 0;
    try {
      for (const [table, oldName, newName] of COLUMN_RENAMES) {
        const didRename = await safeRenameColumn(queryInterface, table, oldName, newName);
        if (didRename) {
          renamed++;
        } else {
          skipped++;
        }
      }
    } finally {
      // Restore sql_mode + foreign_key_checks dù success hay fail
      await queryInterface.sequelize.query(
        `SET SESSION sql_mode = '${originalSqlMode.replace(/'/g, "''")}'`,
      );
      await queryInterface.sequelize.query('SET SESSION foreign_key_checks = 1');
      log(`sql_mode restored to: ${originalSqlMode}`);
    }
    log(
      `Hoàn tất: ${renamed} renamed, ${skipped} skipped (đã rename trước đó hoặc không tồn tại).`,
    );
  },

  async down(queryInterface) {
    const log = (msg) => console.log(`[Phase 40.1 ROLLBACK] ${msg}`);

    // Same permissive sql_mode để rollback an toàn
    const [origMode] = await queryInterface.sequelize.query('SELECT @@SESSION.sql_mode AS m');
    const originalSqlMode = origMode[0].m;
    await queryInterface.sequelize.query("SET SESSION sql_mode = ''");
    await queryInterface.sequelize.query('SET SESSION foreign_key_checks = 0');

    log(`Bắt đầu rollback ${COLUMN_RENAMES.length} columns snake_case → camelCase...`);
    let reverted = 0;
    let skipped = 0;
    try {
      // Reverse order để rollback an toàn (mặc dù column rename không phụ thuộc thứ tự)
      for (const [table, oldName, newName] of [...COLUMN_RENAMES].reverse()) {
        // Đảo: rename newName (snake_case) → oldName (camelCase)
        const didRevert = await safeRenameColumn(queryInterface, table, newName, oldName);
        if (didRevert) {
          reverted++;
        } else {
          skipped++;
        }
      }
    } finally {
      await queryInterface.sequelize.query(
        `SET SESSION sql_mode = '${originalSqlMode.replace(/'/g, "''")}'`,
      );
      await queryInterface.sequelize.query('SET SESSION foreign_key_checks = 1');
    }
    log(`Rollback hoàn tất: ${reverted} reverted, ${skipped} skipped.`);
  },
};
