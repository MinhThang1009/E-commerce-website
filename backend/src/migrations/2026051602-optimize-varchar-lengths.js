'use strict';

// Migration: Tối ưu varchar(255) mặc định → kích thước phù hợp với data thực tế
//
// PRE-FLIGHT (2026-05-16): đã verify MAX(LENGTH) cho mọi column < target
//   - users.phone MAX=10, feedbacks.phone MAX=null → varchar(20) safe
//   - chat_messages.session_id MAX=36 → varchar(50) safe
//   - orders.number MAX=null → varchar(50) safe (cần drop/recreate UNIQUE index)
//   - products.sku MAX=null → varchar(100) safe (match product_variants.sku)
//   - URL columns MAX < 50 → varchar(512) safe (headroom cho URL dài)
//
// Idempotent: skip nếu column đã đúng type

// ── Helper functions ────────────────────────────────────────────────────────

async function getColumnType(qi, table, column) {
  const [rows] = await qi.sequelize.query(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    { replacements: [table, column] },
  );
  return rows[0] ? rows[0].COLUMN_TYPE.toLowerCase() : null;
}

async function indexExists(qi, table, indexName) {
  const [rows] = await qi.sequelize.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
     LIMIT 1`,
    { replacements: [table, indexName] },
  );
  return rows.length > 0;
}

async function tableExists(qi, table) {
  const [rows] = await qi.sequelize.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     LIMIT 1`,
    { replacements: [table] },
  );
  return rows.length > 0;
}

// ── Column definitions ──────────────────────────────────────────────────────
// Format: [table, column, targetType, fullModifySQL]
// fullModifySQL để tránh bug default check của queryInterface.changeColumn

const SIMPLE_COLUMNS = [
  // --- Phone columns: varchar(20) ---
  ['users', 'phone', 'varchar(20)', 'VARCHAR(20) NULL DEFAULT NULL'],
  ['feedbacks', 'phone', 'varchar(20)', 'VARCHAR(20) NULL DEFAULT NULL'],
  ['addresses', 'phone', 'varchar(20)', 'VARCHAR(20) NULL DEFAULT NULL'],

  // --- Name columns: varchar(100) ---
  ['users', 'first_name', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['users', 'last_name', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['addresses', 'first_name', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['addresses', 'last_name', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['addresses', 'name', 'varchar(100)', 'VARCHAR(100) NULL DEFAULT NULL'],

  // --- Email columns: varchar(254) (RFC 5321) ---
  ['users', 'email', 'varchar(254)', 'VARCHAR(254) NOT NULL'],
  ['feedbacks', 'email', 'varchar(254)', 'VARCHAR(254) NOT NULL'],
  ['newsletter_subscribers', 'email', 'varchar(254)', 'VARCHAR(254) NOT NULL'],

  // --- Address location columns: varchar(100) ---
  ['addresses', 'city', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['addresses', 'state', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['addresses', 'country', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['addresses', 'zip', 'varchar(20)', 'VARCHAR(20) NOT NULL'],
  ['addresses', 'company', 'varchar(200)', 'VARCHAR(200) NULL DEFAULT NULL'],
  ['addresses', 'address1', 'varchar(500)', 'VARCHAR(500) NOT NULL'],
  ['addresses', 'address2', 'varchar(500)', 'VARCHAR(500) NULL DEFAULT NULL'],

  // --- Orders: shipping/billing ---
  ['orders', 'shipping_first_name', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['orders', 'shipping_last_name', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['orders', 'shipping_phone', 'varchar(20)', 'VARCHAR(20) NULL DEFAULT NULL'],
  ['orders', 'shipping_city', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['orders', 'shipping_state', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['orders', 'shipping_country', 'varchar(100)', 'VARCHAR(100) NULL DEFAULT NULL'],
  ['orders', 'shipping_zip', 'varchar(20)', 'VARCHAR(20) NULL DEFAULT NULL'],
  ['orders', 'shipping_company', 'varchar(200)', 'VARCHAR(200) NULL DEFAULT NULL'],
  ['orders', 'shipping_address1', 'varchar(500)', 'VARCHAR(500) NOT NULL'],
  ['orders', 'shipping_address2', 'varchar(500)', 'VARCHAR(500) NULL DEFAULT NULL'],
  ['orders', 'shipping_provider', 'varchar(100)', 'VARCHAR(100) NULL DEFAULT NULL'],
  ['orders', 'billing_first_name', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['orders', 'billing_last_name', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['orders', 'billing_phone', 'varchar(20)', 'VARCHAR(20) NULL DEFAULT NULL'],
  ['orders', 'billing_city', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['orders', 'billing_state', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['orders', 'billing_country', 'varchar(100)', 'VARCHAR(100) NULL DEFAULT NULL'],
  ['orders', 'billing_zip', 'varchar(20)', 'VARCHAR(20) NULL DEFAULT NULL'],
  ['orders', 'billing_company', 'varchar(200)', 'VARCHAR(200) NULL DEFAULT NULL'],
  ['orders', 'billing_address1', 'varchar(500)', 'VARCHAR(500) NOT NULL'],
  ['orders', 'billing_address2', 'varchar(500)', 'VARCHAR(500) NULL DEFAULT NULL'],
  ['orders', 'payment_method', 'varchar(50)', 'VARCHAR(50) NOT NULL'],
  ['orders', 'payment_provider', 'varchar(100)', 'VARCHAR(100) NULL DEFAULT NULL'],
  ['orders', 'payment_transaction_id', 'varchar(200)', 'VARCHAR(200) NULL DEFAULT NULL'],
  ['orders', 'tracking_number', 'varchar(100)', 'VARCHAR(100) NULL DEFAULT NULL'],

  // --- Products ---
  ['products', 'sku', 'varchar(100)', 'VARCHAR(100) NULL DEFAULT NULL'],
  ['products', 'name', 'varchar(255)', null], // Giữ varchar(255) — tên sản phẩm có thể dài
  ['products', 'slug', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['products', 'status', 'varchar(20)', "VARCHAR(20) NULL DEFAULT 'active'"],
  ['products', 'condition', 'varchar(20)', "VARCHAR(20) NULL DEFAULT 'new'"],
  ['products', 'visibility', 'varchar(20)', "VARCHAR(20) NULL DEFAULT 'public'"],

  // --- Chat messages ---
  ['chat_messages', 'session_id', 'varchar(50)', 'VARCHAR(50) NOT NULL'],

  // --- Search histories ---
  ['search_histories', 'session_id', 'varchar(128)', 'VARCHAR(128) NULL DEFAULT NULL'],
  ['search_histories', 'keyword', 'varchar(200)', 'VARCHAR(200) NOT NULL'],

  // --- Carts ---
  ['carts', 'session_id', 'varchar(128)', 'VARCHAR(128) NULL DEFAULT NULL'],

  // --- Discount codes ---
  // discount_codes.code: đã varchar(50) — skip

  // --- Attribute groups ---
  ['attribute_groups', 'type', 'varchar(50)', "VARCHAR(50) NOT NULL DEFAULT 'custom'"],
  ['attribute_groups', 'name', 'varchar(100)', 'VARCHAR(100) NOT NULL'],

  // --- Attribute values ---
  ['attribute_values', 'name', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['attribute_values', 'value', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['attribute_values', 'name_template', 'varchar(200)', 'VARCHAR(200) NULL DEFAULT NULL'],
  ['attribute_values', 'color_code', 'varchar(20)', 'VARCHAR(20) NULL DEFAULT NULL'],

  // --- Other short strings ---
  ['feedbacks', 'name', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['feedbacks', 'subject', 'varchar(200)', 'VARCHAR(200) NOT NULL'],
  ['collections', 'name', 'varchar(200)', 'VARCHAR(200) NOT NULL'],
  ['collections', 'slug', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['brands', 'slug', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['categories', 'slug', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['banners', 'title', 'varchar(200)', 'VARCHAR(200) NOT NULL'],
  ['news', 'title', 'varchar(200)', 'VARCHAR(200) NOT NULL'],
  ['news', 'slug', 'varchar(200)', 'VARCHAR(200) NOT NULL'],
  ['news', 'category', 'varchar(100)', 'VARCHAR(100) NULL DEFAULT NULL'],
  ['news', 'tags', 'varchar(500)', 'VARCHAR(500) NULL DEFAULT NULL'],
  ['email_campaigns', 'subject', 'varchar(200)', 'VARCHAR(200) NOT NULL'],
  ['discount_codes', 'description', 'varchar(500)', 'VARCHAR(500) NULL DEFAULT NULL'],
  ['loyalty_histories', 'description', 'varchar(500)', 'VARCHAR(500) NULL DEFAULT NULL'],
  ['import_logs', 'filename', 'varchar(200)', 'VARCHAR(200) NOT NULL'],
  ['warranty_packages', 'name', 'varchar(200)', 'VARCHAR(200) NOT NULL'],
  ['reviews', 'title', 'varchar(200)', 'VARCHAR(200) NULL DEFAULT NULL'],
  ['product_attributes', 'name', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['product_specifications', 'name', 'varchar(100)', 'VARCHAR(100) NOT NULL'],
  ['product_specifications', 'category', 'varchar(100)', 'VARCHAR(100) NULL DEFAULT NULL'],
  ['product_variants', 'variant_name', 'varchar(255)', null], // Giữ — tên variant có thể dài
  ['product_variants', 'display_name', 'varchar(255)', null], // Giữ
  ['order_items', 'name', 'varchar(255)', null], // Giữ — snapshot tên sản phẩm
  ['order_items', 'sku', 'varchar(100)', 'VARCHAR(100) NULL DEFAULT NULL'],

  // --- URL columns → varchar(512) cho headroom ---
  ['users', 'avatar', 'varchar(512)', 'VARCHAR(512) NULL DEFAULT NULL'],
  ['banners', 'image_url', 'varchar(512)', 'VARCHAR(512) NOT NULL'],
  ['banners', 'link_url', 'varchar(512)', 'VARCHAR(512) NULL DEFAULT NULL'],
  ['collections', 'thumbnail', 'varchar(512)', 'VARCHAR(512) NULL DEFAULT NULL'],
  ['news', 'thumbnail', 'varchar(512)', 'VARCHAR(512) NULL DEFAULT NULL'],
  ['chat_messages', 'attachment_url', 'varchar(512)', 'VARCHAR(512) NULL DEFAULT NULL'],
  ['order_items', 'image', 'varchar(512)', 'VARCHAR(512) NULL DEFAULT NULL'],

  // --- Tokens / hashes: varchar(500) cho JWT-like strings ---
  ['users', 'password', 'varchar(500)', 'VARCHAR(500) NULL DEFAULT NULL'],
  ['users', 'google_id', 'varchar(100)', 'VARCHAR(100) NULL DEFAULT NULL'],
  ['users', 'reset_password_token', 'varchar(500)', 'VARCHAR(500) NULL DEFAULT NULL'],

  // --- Legacy images table ---
  // images.file_name, images.original_name: giữ varchar(255) — file name có thể dài
];

module.exports = {
  async up(queryInterface) {
    // ── Bước 1: Resize orders.number (có UNIQUE index cần drop/recreate) ────
    if (await tableExists(queryInterface, 'orders')) {
      const numType = await getColumnType(queryInterface, 'orders', 'number');
      if (numType && numType !== 'varchar(50)') {
        // Drop UNIQUE index trước khi resize
        if (await indexExists(queryInterface, 'orders', 'uq_orders_number')) {
          await queryInterface.sequelize.query(
            'ALTER TABLE `orders` DROP INDEX `uq_orders_number`',
          );
          console.log('  DROPPED: uq_orders_number (trước khi resize)');
        }
        await queryInterface.sequelize.query(
          'ALTER TABLE `orders` MODIFY COLUMN `number` VARCHAR(50) NOT NULL',
        );
        console.log('  RESIZED: orders.number → varchar(50)');
        // Recreate UNIQUE index
        await queryInterface.sequelize.query(
          'ALTER TABLE `orders` ADD UNIQUE KEY `uq_orders_number` (`number`)',
        );
        console.log('  RECREATED: uq_orders_number');
      }
    }

    // ── Bước 2: Resize tất cả columns đơn giản (không có index trên column) ─
    for (const [table, column, targetType, modifySQL] of SIMPLE_COLUMNS) {
      // Skip entry mà giữ nguyên (targetType null hoặc modifySQL null)
      if (!modifySQL) continue;

      if (!(await tableExists(queryInterface, table))) {
        console.log(`  SKIP: table "${table}" không tồn tại`);
        continue;
      }

      const currentType = await getColumnType(queryInterface, table, column);
      if (!currentType) {
        console.log(`  SKIP: column "${table}.${column}" không tồn tại`);
        continue;
      }

      // Đã đúng type → skip
      if (currentType === targetType) {
        continue;
      }

      try {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${modifySQL}`,
        );
        console.log(`  RESIZED: ${table}.${column} → ${targetType}`);
      } catch (err) {
        // Data quá dài cho target type → log warning, không fail migration
        console.error(`  ERROR: ${table}.${column} → ${targetType}: ${err.message}`);
      }
    }

    console.log('  DONE: varchar optimization hoàn thành');
  },

  async down(queryInterface) {
    // Rollback: khôi phục về varchar(255) cho tất cả columns đã resize
    // Chỉ rollback columns đã thực sự thay đổi (không phải những cái giữ nguyên)

    // Rollback orders.number
    if (await tableExists(queryInterface, 'orders')) {
      if (await indexExists(queryInterface, 'orders', 'uq_orders_number')) {
        await queryInterface.sequelize.query('ALTER TABLE `orders` DROP INDEX `uq_orders_number`');
      }
      await queryInterface.sequelize.query(
        'ALTER TABLE `orders` MODIFY COLUMN `number` VARCHAR(255) NOT NULL',
      );
      await queryInterface.sequelize.query(
        'ALTER TABLE `orders` ADD UNIQUE KEY `uq_orders_number` (`number`)',
      );
    }

    // Rollback simple columns
    for (const [table, column, _targetType, modifySQL] of SIMPLE_COLUMNS) {
      if (!modifySQL) continue;
      if (!(await tableExists(queryInterface, table))) continue;
      const currentType = await getColumnType(queryInterface, table, column);
      if (!currentType) continue;

      // Khôi phục về varchar(255) với cùng NULL/NOT NULL
      const isNullable = modifySQL.includes('NULL DEFAULT') || modifySQL.includes('NULL');
      const nullClause = isNullable ? 'NULL DEFAULT NULL' : 'NOT NULL';
      try {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` VARCHAR(255) ${nullClause}`,
        );
      } catch (err) {
        console.error(`  ROLLBACK ERROR: ${table}.${column}: ${err.message}`);
      }
    }
  },
};
