'use strict';

// Migration: Chuẩn hóa column types xuyên suốt các bảng MySQL
//
// PRE-FLIGHT (2026-05-16): đã verify MAX(LENGTH) cho mọi column
//   - name columns: products=113, order_items=NULL, collections=28,
//     warranty_packages=33, brands=13, categories=15 → tất cả < 200 → safe
//   - image_url: attribute_values=NULL(TEXT), product_images=148(varchar(1000)),
//     banners=38(varchar(512)) → varchar(512) safe
//   - news.slug: NULL (table rỗng) → varchar(100) safe
//   - chat_messages.session_id: max=36 → varchar(128) safe
//   - products.status: chỉ có 'active' → ENUM('active','inactive','draft','archived')
//
// Idempotent: skip nếu column đã đúng type

// ── Helper functions ────────────────────────────────────────────────────────

async function getColumnType(qi, table, column) {
  const [rows] = await qi.sequelize.query(
    `SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    { replacements: [table, column] }
  );
  return rows[0] ? rows[0].COLUMN_TYPE.toLowerCase() : null;
}

async function indexExists(qi, table, indexName) {
  const [rows] = await qi.sequelize.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
     LIMIT 1`,
    { replacements: [table, indexName] }
  );
  return rows.length > 0;
}

async function tableExists(qi, table) {
  const [rows] = await qi.sequelize.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     LIMIT 1`,
    { replacements: [table] }
  );
  return rows.length > 0;
}

// ── Nhóm 1: name columns → varchar(200) thống nhất ─────────────────────────
// products.name (255→200), order_items.name (255→200) giảm xuống
// collections.name (200 → giữ), warranty_packages.name (200 → giữ)
// brands.name (100→200), categories.name (100→200) tăng lên
const NAME_COLUMNS = [
  // [table, column, targetType, modifySQL, rollbackSQL]
  ['products',           'name', 'varchar(200)', 'VARCHAR(200) NOT NULL',  'VARCHAR(255) NOT NULL'],
  ['order_items',        'name', 'varchar(200)', 'VARCHAR(200) NOT NULL',  'VARCHAR(255) NOT NULL'],
  ['collections',        'name', 'varchar(200)', 'VARCHAR(200) NOT NULL',  'VARCHAR(200) NOT NULL'],  // giữ nguyên
  ['warranty_packages',  'name', 'varchar(200)', 'VARCHAR(200) NOT NULL',  'VARCHAR(200) NOT NULL'],  // giữ nguyên
  ['brands',             'name', 'varchar(200)', 'VARCHAR(200) NOT NULL',  'VARCHAR(100) NOT NULL'],
  ['categories',         'name', 'varchar(200)', 'VARCHAR(200) NOT NULL',  'VARCHAR(100) NOT NULL'],
];

// ── Nhóm 2: image_url columns → varchar(512) thống nhất ────────────────────
// attribute_values.image_url: TEXT → varchar(512)
// product_images.image_url: varchar(1000) → varchar(512)
// banners.image_url: đã varchar(512) → skip
const IMAGE_URL_COLUMNS = [
  ['attribute_values', 'image_url', 'varchar(512)', 'VARCHAR(512) NULL DEFAULT NULL', 'TEXT NULL DEFAULT NULL'],
  ['product_images',   'image_url', 'varchar(512)', 'VARCHAR(512) NOT NULL',          'VARCHAR(1000) NOT NULL'],
];

// ── Nhóm 3: slug columns → varchar(100) thống nhất ─────────────────────────
// news.slug: varchar(200) → varchar(100) (match products, brands, categories, collections)
const SLUG_COLUMNS = [
  ['news', 'slug', 'varchar(100)', 'VARCHAR(100) NOT NULL', 'VARCHAR(200) NOT NULL'],
];

// ── Nhóm 4: session_id → varchar(128) thống nhất ───────────────────────────
// chat_messages.session_id: varchar(50) → varchar(128) (match carts, search_histories)
const SESSION_COLUMNS = [
  ['chat_messages', 'session_id', 'varchar(128)', 'VARCHAR(128) NOT NULL', 'VARCHAR(50) NOT NULL'],
];

module.exports = {
  async up(queryInterface) {
    // ── Nhóm 1: name columns ───────────────────────────────────────────────
    console.log('── Nhóm 1: Chuẩn hóa name columns → varchar(200) ──');

    for (const [table, column, targetType, modifySQL] of NAME_COLUMNS) {
      if (!(await tableExists(queryInterface, table))) {
        console.log(`  SKIP: table "${table}" không tồn tại`);
        continue;
      }
      const currentType = await getColumnType(queryInterface, table, column);
      if (!currentType) {
        console.log(`  SKIP: column "${table}.${column}" không tồn tại`);
        continue;
      }
      if (currentType === targetType) {
        console.log(`  SKIP: ${table}.${column} đã là ${targetType}`);
        continue;
      }

      // brands.name và categories.name có UNIQUE index — MySQL xử lý tự động khi resize
      // Chỉ cần verify data không vượt target length
      const [lenRows] = await queryInterface.sequelize.query(
        `SELECT MAX(LENGTH(\`${column}\`)) as max_len FROM \`${table}\``
      );
      const maxLen = lenRows[0] ? lenRows[0].max_len : 0;
      if (maxLen && maxLen > 200) {
        console.log(`  ABORT: ${table}.${column} có data dài ${maxLen} chars > 200 — KHÔNG resize`);
        continue;
      }

      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${modifySQL}`
      );
      console.log(`  RESIZED: ${table}.${column} ${currentType} → ${targetType}`);
    }

    // ── Nhóm 2: image_url columns ─────────────────────────────────────────
    console.log('── Nhóm 2: Chuẩn hóa image_url columns → varchar(512) ──');

    for (const [table, column, targetType, modifySQL] of IMAGE_URL_COLUMNS) {
      if (!(await tableExists(queryInterface, table))) {
        console.log(`  SKIP: table "${table}" không tồn tại`);
        continue;
      }
      const currentType = await getColumnType(queryInterface, table, column);
      if (!currentType) {
        console.log(`  SKIP: column "${table}.${column}" không tồn tại`);
        continue;
      }
      if (currentType === targetType) {
        console.log(`  SKIP: ${table}.${column} đã là ${targetType}`);
        continue;
      }

      // Verify data không vượt 512 chars
      const [lenRows] = await queryInterface.sequelize.query(
        `SELECT MAX(LENGTH(\`${column}\`)) as max_len FROM \`${table}\``
      );
      const maxLen = lenRows[0] ? lenRows[0].max_len : 0;
      if (maxLen && maxLen > 512) {
        console.log(`  ABORT: ${table}.${column} có data dài ${maxLen} chars > 512 — KHÔNG resize`);
        continue;
      }

      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${modifySQL}`
      );
      console.log(`  RESIZED: ${table}.${column} ${currentType} → ${targetType}`);
    }

    // ── Nhóm 3: slug columns ──────────────────────────────────────────────
    console.log('── Nhóm 3: Chuẩn hóa news.slug → varchar(100) ──');

    for (const [table, column, targetType, modifySQL] of SLUG_COLUMNS) {
      if (!(await tableExists(queryInterface, table))) {
        console.log(`  SKIP: table "${table}" không tồn tại`);
        continue;
      }
      const currentType = await getColumnType(queryInterface, table, column);
      if (!currentType) {
        console.log(`  SKIP: column "${table}.${column}" không tồn tại`);
        continue;
      }
      if (currentType === targetType) {
        console.log(`  SKIP: ${table}.${column} đã là ${targetType}`);
        continue;
      }

      // Verify data không vượt 100 chars — news.slug có UNIQUE index uq_news_slug
      const [lenRows] = await queryInterface.sequelize.query(
        `SELECT MAX(LENGTH(\`${column}\`)) as max_len FROM \`${table}\``
      );
      const maxLen = lenRows[0] ? lenRows[0].max_len : 0;
      if (maxLen && maxLen > 100) {
        console.log(`  ABORT: ${table}.${column} có data dài ${maxLen} chars > 100 — KHÔNG resize`);
        continue;
      }

      // Drop UNIQUE index trước khi resize xuống, rồi recreate
      const uniqueIdxName = `uq_${table}_${column}`;
      const hasUniqueIdx = await indexExists(queryInterface, table, uniqueIdxName);
      if (hasUniqueIdx) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` DROP INDEX \`${uniqueIdxName}\``
        );
        console.log(`  DROPPED: ${uniqueIdxName} (trước khi resize)`);
      }

      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${modifySQL}`
      );
      console.log(`  RESIZED: ${table}.${column} ${currentType} → ${targetType}`);

      // Recreate UNIQUE index
      if (hasUniqueIdx) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` ADD UNIQUE KEY \`${uniqueIdxName}\` (\`${column}\`)`
        );
        console.log(`  RECREATED: ${uniqueIdxName}`);
      }
    }

    // ── Nhóm 4: session_id ────────────────────────────────────────────────
    console.log('── Nhóm 4: Chuẩn hóa chat_messages.session_id → varchar(128) ──');

    for (const [table, column, targetType, modifySQL] of SESSION_COLUMNS) {
      if (!(await tableExists(queryInterface, table))) {
        console.log(`  SKIP: table "${table}" không tồn tại`);
        continue;
      }
      const currentType = await getColumnType(queryInterface, table, column);
      if (!currentType) {
        console.log(`  SKIP: column "${table}.${column}" không tồn tại`);
        continue;
      }
      if (currentType === targetType) {
        console.log(`  SKIP: ${table}.${column} đã là ${targetType}`);
        continue;
      }

      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${modifySQL}`
      );
      console.log(`  RESIZED: ${table}.${column} ${currentType} → ${targetType}`);
    }

    // ── Nhóm 5: products.status varchar(20) → ENUM ───────────────────────
    console.log('── Nhóm 5: Chuẩn hóa products.status → ENUM ──');

    if (await tableExists(queryInterface, 'products')) {
      const statusType = await getColumnType(queryInterface, 'products', 'status');

      // Chỉ đổi nếu hiện tại là varchar, không phải enum
      if (statusType && !statusType.startsWith('enum')) {
        // Verify tất cả values hiện tại nằm trong enum target
        const [statusRows] = await queryInterface.sequelize.query(
          `SELECT DISTINCT status FROM products WHERE status IS NOT NULL`
        );
        const validEnumValues = ['active', 'inactive', 'draft', 'archived'];
        const currentValues = statusRows.map(r => r.status);
        const invalidValues = currentValues.filter(v => !validEnumValues.includes(v));

        if (invalidValues.length > 0) {
          console.log(`  ABORT: products.status có giá trị không hợp lệ: ${invalidValues.join(', ')} — KHÔNG đổi sang ENUM`);
        } else {
          // Drop index trước khi đổi type
          if (await indexExists(queryInterface, 'products', 'idx_products_status')) {
            await queryInterface.sequelize.query(
              `ALTER TABLE \`products\` DROP INDEX \`idx_products_status\``
            );
            console.log('  DROPPED: idx_products_status (trước khi đổi type)');
          }

          await queryInterface.sequelize.query(
            `ALTER TABLE \`products\` MODIFY COLUMN \`status\` ENUM('active','inactive','draft','archived') NULL DEFAULT 'active'`
          );
          console.log(`  CHANGED: products.status ${statusType} → enum('active','inactive','draft','archived')`);

          // Recreate index
          await queryInterface.sequelize.query(
            `ALTER TABLE \`products\` ADD INDEX \`idx_products_status\` (\`status\`)`
          );
          console.log('  RECREATED: idx_products_status');
        }
      } else {
        console.log(`  SKIP: products.status đã là enum`);
      }
    }

    console.log('── DONE: Chuẩn hóa column types hoàn thành ──');
  },

  async down(queryInterface) {
    // ── Rollback Nhóm 5: products.status ENUM → varchar(20) ──────────────
    if (await tableExists(queryInterface, 'products')) {
      const statusType = await getColumnType(queryInterface, 'products', 'status');
      if (statusType && statusType.startsWith('enum')) {
        if (await indexExists(queryInterface, 'products', 'idx_products_status')) {
          await queryInterface.sequelize.query(
            `ALTER TABLE \`products\` DROP INDEX \`idx_products_status\``
          );
        }
        await queryInterface.sequelize.query(
          `ALTER TABLE \`products\` MODIFY COLUMN \`status\` VARCHAR(20) NULL DEFAULT 'active'`
        );
        await queryInterface.sequelize.query(
          `ALTER TABLE \`products\` ADD INDEX \`idx_products_status\` (\`status\`)`
        );
        console.log('  ROLLBACK: products.status → varchar(20)');
      }
    }

    // ── Rollback Nhóm 4: session_id ──────────────────────────────────────
    for (const [table, column, , , rollbackSQL] of SESSION_COLUMNS) {
      if (!(await tableExists(queryInterface, table))) continue;
      const currentType = await getColumnType(queryInterface, table, column);
      if (!currentType) continue;
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${rollbackSQL}`
      );
      console.log(`  ROLLBACK: ${table}.${column} → ${rollbackSQL}`);
    }

    // ── Rollback Nhóm 3: slug ────────────────────────────────────────────
    for (const [table, column, , , rollbackSQL] of SLUG_COLUMNS) {
      if (!(await tableExists(queryInterface, table))) continue;
      const currentType = await getColumnType(queryInterface, table, column);
      if (!currentType) continue;

      const uniqueIdxName = `uq_${table}_${column}`;
      const hasUniqueIdx = await indexExists(queryInterface, table, uniqueIdxName);
      if (hasUniqueIdx) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` DROP INDEX \`${uniqueIdxName}\``
        );
      }
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${rollbackSQL}`
      );
      if (hasUniqueIdx) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` ADD UNIQUE KEY \`${uniqueIdxName}\` (\`${column}\`)`
        );
      }
      console.log(`  ROLLBACK: ${table}.${column} → ${rollbackSQL}`);
    }

    // ── Rollback Nhóm 2: image_url ──────────────────────────────────────
    for (const [table, column, , , rollbackSQL] of IMAGE_URL_COLUMNS) {
      if (!(await tableExists(queryInterface, table))) continue;
      const currentType = await getColumnType(queryInterface, table, column);
      if (!currentType) continue;
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${rollbackSQL}`
      );
      console.log(`  ROLLBACK: ${table}.${column} → ${rollbackSQL}`);
    }

    // ── Rollback Nhóm 1: name columns ───────────────────────────────────
    for (const [table, column, , , rollbackSQL] of NAME_COLUMNS) {
      if (!(await tableExists(queryInterface, table))) continue;
      const currentType = await getColumnType(queryInterface, table, column);
      if (!currentType) continue;
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${rollbackSQL}`
      );
      console.log(`  ROLLBACK: ${table}.${column} → ${rollbackSQL}`);
    }

    console.log('── DONE: Rollback hoàn thành ──');
  },
};
