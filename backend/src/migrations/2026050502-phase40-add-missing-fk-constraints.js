'use strict';

// Phase 40.5 — ADD 6 missing FK constraints
// Idempotent: skip nếu constraint cùng tên đã tồn tại; drop auto-generated tên cũ nếu có
//
// PRE-FLIGHT đã verify (2026-05-05):
//   - 0 orphan rows trên cả 6 cột FK (admin_id, user_id x3, sender_id, variant_id x2)
//   - Column types khớp int(11) FK ↔ int(11) PK
//   - 6 constraint name fk_* chưa tồn tại
//
// 6 FK thêm:
//   1. audit_logs.admin_id      → users(id)            ON DELETE RESTRICT  (audit phải giữ, user xóa cấm)
//   2. search_histories.user_id → users(id)            ON DELETE SET NULL  (giữ history khi user xóa)
//   3. chat_messages.sender_id  → users(id)            ON DELETE SET NULL  (giữ tin, ẩn người gửi)
//   4. order_items.variant_id   → product_variants(id) ON DELETE SET NULL  (giữ order khi variant xóa)
//   5. cart_items.variant_id    → product_variants(id) ON DELETE SET NULL  (giữ cart khi variant xóa)
//   6. product_reviews.user_id  → users(id)            ON DELETE CASCADE   (xóa user → xóa review)

const FK_DEFINITIONS = [
  {
    table: 'audit_logs',
    name: 'fk_audit_logs_user',
    column: 'admin_id',
    refTable: 'users',
    refColumn: 'id',
    onDelete: 'RESTRICT',
    onUpdate: 'CASCADE',
  },
  {
    table: 'search_histories',
    name: 'fk_search_histories_user',
    column: 'user_id',
    refTable: 'users',
    refColumn: 'id',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  },
  {
    table: 'chat_messages',
    name: 'fk_chat_messages_sender',
    column: 'sender_id',
    refTable: 'users',
    refColumn: 'id',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  },
  {
    table: 'order_items',
    name: 'fk_order_items_variant',
    column: 'variant_id',
    refTable: 'product_variants',
    refColumn: 'id',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  },
  {
    table: 'cart_items',
    name: 'fk_cart_items_variant',
    column: 'variant_id',
    refTable: 'product_variants',
    refColumn: 'id',
    onDelete: 'SET NULL',
    onUpdate: 'CASCADE',
  },
  {
    table: 'product_reviews',
    name: 'fk_product_reviews_user',
    column: 'user_id',
    refTable: 'users',
    refColumn: 'id',
    onDelete: 'CASCADE',
    onUpdate: 'CASCADE',
  },
];

async function constraintExists(queryInterface, table, constraintName) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    { replacements: [table, constraintName] },
  );
  return rows.length > 0;
}

async function findExistingFkOnColumn(queryInterface, table, column) {
  const [rows] = await queryInterface.sequelize.query(
    `SELECT k.CONSTRAINT_NAME
     FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE k
     JOIN INFORMATION_SCHEMA.TABLE_CONSTRAINTS c
       ON c.CONSTRAINT_SCHEMA = k.CONSTRAINT_SCHEMA
      AND c.CONSTRAINT_NAME = k.CONSTRAINT_NAME
      AND c.TABLE_NAME = k.TABLE_NAME
     WHERE k.TABLE_SCHEMA = DATABASE() AND k.TABLE_NAME = ? AND k.COLUMN_NAME = ? AND c.CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    { replacements: [table, column] },
  );
  return rows.map((r) => r.CONSTRAINT_NAME);
}

module.exports = {
  async up(queryInterface) {
    for (const fk of FK_DEFINITIONS) {
      if (await constraintExists(queryInterface, fk.table, fk.name)) {
        // Idempotent — đã add với đúng tên, skip
        continue;
      }

      // Drop bất kỳ FK auto-generated nào (tên cũ) trên cùng column trước khi add tên chuẩn
      const existingFks = await findExistingFkOnColumn(queryInterface, fk.table, fk.column);
      for (const oldName of existingFks) {
        if (oldName !== fk.name) {
          await queryInterface.sequelize.query(
            `ALTER TABLE \`${fk.table}\` DROP FOREIGN KEY \`${oldName}\``,
          );
        }
      }

      await queryInterface.sequelize.query(
        `ALTER TABLE \`${fk.table}\` ADD CONSTRAINT \`${fk.name}\`
         FOREIGN KEY (\`${fk.column}\`) REFERENCES \`${fk.refTable}\`(\`${fk.refColumn}\`)
         ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`,
      );
    }
  },

  async down(queryInterface) {
    for (const fk of FK_DEFINITIONS) {
      if (await constraintExists(queryInterface, fk.table, fk.name)) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${fk.table}\` DROP FOREIGN KEY \`${fk.name}\``,
        );
      }
    }
  },
};
