'use strict';

// Phase 40.17 — Index audit + standardization
// Idempotent: skip nếu index mới đã tồn tại; skip nếu index cũ không còn
//
// Scope (sau audit thực tế):
//   1. Rename 9 UNIQUE indexes → pattern `uq_<table>_<col>`
//   2. Drop 1 duplicate UNIQUE (product_variants có 2 unique trên cột sku)
//   3. Rename 3 audit_logs indexes → pattern `idx_audit_logs_*`
//   4. ADD 2 indexes mới: idx_orders_deleted_at, idx_carts_session_id
//
// FK auto-creates index khi ADD CONSTRAINT — không cần ADD `idx_*` riêng cho FK columns.
// (vd `fk_addresses_user` IS the index on user_id; JOIN dùng nó.)

const UNIQUE_RENAMES = [
  // [table, oldName, newName, column]
  ['brands', 'name', 'uq_brands_name', 'name'],
  ['brands', 'slug', 'uq_brands_slug', 'slug'],
  ['categories', 'name', 'uq_categories_name', 'name'],
  ['categories', 'slug', 'uq_categories_slug', 'slug'],
  ['collections', 'slug', 'uq_collections_slug', 'slug'],
  ['discount_codes', 'code', 'uq_discount_codes_code', 'code'],
  ['images', 'file_name', 'uq_images_file_name', 'file_name'],
  ['users', 'google_id', 'uq_users_google_id', 'google_id'],
  ['products', 'idx_products_slug', 'uq_products_slug', 'slug'],
];

const AUDIT_INDEX_RENAMES = [
  // [table, oldName, newName, columnsCsv]
  ['audit_logs', 'audit_logs_admin_id', 'idx_audit_logs_admin_id', 'admin_id'],
  ['audit_logs', 'audit_logs_created_at', 'idx_audit_logs_created_at', 'created_at'],
  [
    'audit_logs',
    'audit_logs_entity_type_entity_id',
    'idx_audit_logs_entity',
    'entity_type, entity_id',
  ],
];

// Indexes mới (không phải FK auto-gen)
const NEW_INDEXES = [
  // [table, indexName, columnsCsv, isUnique]
  ['orders', 'idx_orders_deleted_at', 'deleted_at', false],
  ['carts', 'idx_carts_session_id', 'session_id', false],
];

async function indexExists(qi, table, indexName) {
  const [rows] = await qi.sequelize.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
     LIMIT 1`,
    { replacements: [table, indexName] },
  );
  return rows.length > 0;
}

module.exports = {
  async up(queryInterface) {
    // 1. Rename UNIQUE indexes
    for (const [table, oldName, newName, column] of UNIQUE_RENAMES) {
      const newExists = await indexExists(queryInterface, table, newName);
      if (newExists) continue;
      const oldExists = await indexExists(queryInterface, table, oldName);
      if (oldExists) {
        await queryInterface.sequelize.query(`ALTER TABLE \`${table}\` DROP INDEX \`${oldName}\``);
      }
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` ADD UNIQUE KEY \`${newName}\` (\`${column}\`)`,
      );
    }

    // 2. Drop duplicate UNIQUE on product_variants.sku (giữ idx_product_variants_sku → rename uq)
    {
      const dupExists = await indexExists(queryInterface, 'product_variants', 'sku');
      const namedExists = await indexExists(
        queryInterface,
        'product_variants',
        'idx_product_variants_sku',
      );
      const finalExists = await indexExists(
        queryInterface,
        'product_variants',
        'uq_product_variants_sku',
      );
      if (!finalExists) {
        // Drop unnamed duplicate first
        if (dupExists && namedExists) {
          await queryInterface.sequelize.query(
            `ALTER TABLE \`product_variants\` DROP INDEX \`sku\``,
          );
        }
        // Rename idx_* → uq_*
        if (namedExists) {
          await queryInterface.sequelize.query(
            `ALTER TABLE \`product_variants\` DROP INDEX \`idx_product_variants_sku\``,
          );
        }
        await queryInterface.sequelize.query(
          `ALTER TABLE \`product_variants\` ADD UNIQUE KEY \`uq_product_variants_sku\` (\`sku\`)`,
        );
      } else if (dupExists) {
        // final đã có nhưng dup unnamed vẫn còn → drop
        await queryInterface.sequelize.query(`ALTER TABLE \`product_variants\` DROP INDEX \`sku\``);
      }
    }

    // 3. Rename audit_logs indexes
    for (const [table, oldName, newName, cols] of AUDIT_INDEX_RENAMES) {
      const newExists = await indexExists(queryInterface, table, newName);
      if (newExists) continue;
      const oldExists = await indexExists(queryInterface, table, oldName);
      if (oldExists) {
        await queryInterface.sequelize.query(`ALTER TABLE \`${table}\` DROP INDEX \`${oldName}\``);
      }
      // cols có thể là multi-column: 'entity_type, entity_id'
      const colList = cols
        .split(',')
        .map((c) => `\`${c.trim()}\``)
        .join(', ');
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` ADD INDEX \`${newName}\` (${colList})`,
      );
    }

    // 4. Add new indexes
    for (const [table, indexName, cols, isUnique] of NEW_INDEXES) {
      const exists = await indexExists(queryInterface, table, indexName);
      if (exists) continue;
      const colList = cols
        .split(',')
        .map((c) => `\`${c.trim()}\``)
        .join(', ');
      const keyword = isUnique ? 'UNIQUE KEY' : 'INDEX';
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` ADD ${keyword} \`${indexName}\` (${colList})`,
      );
    }
  },

  async down(queryInterface) {
    // Reverse order
    for (const [table, indexName] of NEW_INDEXES) {
      const exists = await indexExists(queryInterface, table, indexName);
      if (exists) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` DROP INDEX \`${indexName}\``,
        );
      }
    }
    for (const [table, oldName, newName, cols] of AUDIT_INDEX_RENAMES) {
      const newExists = await indexExists(queryInterface, table, newName);
      if (!newExists) continue;
      await queryInterface.sequelize.query(`ALTER TABLE \`${table}\` DROP INDEX \`${newName}\``);
      const colList = cols
        .split(',')
        .map((c) => `\`${c.trim()}\``)
        .join(', ');
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` ADD INDEX \`${oldName}\` (${colList})`,
      );
    }
    {
      // Rollback product_variants.sku — chỉ rename uq → idx_*, không re-add dup
      const finalExists = await indexExists(
        queryInterface,
        'product_variants',
        'uq_product_variants_sku',
      );
      if (finalExists) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`product_variants\` DROP INDEX \`uq_product_variants_sku\``,
        );
        await queryInterface.sequelize.query(
          `ALTER TABLE \`product_variants\` ADD UNIQUE KEY \`idx_product_variants_sku\` (\`sku\`)`,
        );
      }
    }
    for (const [table, oldName, newName, column] of UNIQUE_RENAMES) {
      const newExists = await indexExists(queryInterface, table, newName);
      if (!newExists) continue;
      await queryInterface.sequelize.query(`ALTER TABLE \`${table}\` DROP INDEX \`${newName}\``);
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` ADD UNIQUE KEY \`${oldName}\` (\`${column}\`)`,
      );
    }
  },
};
