'use strict';

// Phase 40.24 — VARCHAR length standardization (RFC/MySQL standards)
// Idempotent: skip nếu column đã đúng type
//
// PRE-FLIGHT đã verify (2026-05-05):
//   - MAX(CHAR_LENGTH) cho mọi column < target length → safe to shrink, không truncate

// Format: [table, column, type, nullClause, defaultExpr]
// nullClause: 'NULL' | 'NOT NULL'
// defaultExpr: null | string (vd "'Vietnam'", "0", "'active'")
const COLUMNS = [
  // users
  ['users', 'email', 'VARCHAR(254)', 'NOT NULL', null],
  ['users', 'phone', 'VARCHAR(20)', 'NULL', null],
  ['users', 'first_name', 'VARCHAR(100)', 'NOT NULL', null],
  ['users', 'last_name', 'VARCHAR(100)', 'NOT NULL', null],

  // addresses
  ['addresses', 'first_name', 'VARCHAR(100)', 'NOT NULL', null],
  ['addresses', 'last_name', 'VARCHAR(100)', 'NOT NULL', null],
  ['addresses', 'phone', 'VARCHAR(20)', 'NULL', null],
  ['addresses', 'city', 'VARCHAR(100)', 'NOT NULL', null],
  ['addresses', 'state', 'VARCHAR(100)', 'NOT NULL', null],
  ['addresses', 'zip', 'VARCHAR(20)', 'NOT NULL', null],
  ['addresses', 'country', 'VARCHAR(100)', 'NOT NULL', null],

  // orders shipping/billing
  ['orders', 'shipping_phone', 'VARCHAR(20)', 'NULL', null],
  ['orders', 'shipping_country', 'VARCHAR(100)', 'NOT NULL', "'Vietnam'"],
  ['orders', 'shipping_city', 'VARCHAR(100)', 'NOT NULL', null],
  ['orders', 'shipping_state', 'VARCHAR(100)', 'NOT NULL', null],
  ['orders', 'billing_phone', 'VARCHAR(20)', 'NULL', null],
  ['orders', 'billing_country', 'VARCHAR(100)', 'NOT NULL', "'Vietnam'"],
  ['orders', 'billing_city', 'VARCHAR(100)', 'NOT NULL', null],
  ['orders', 'billing_state', 'VARCHAR(100)', 'NOT NULL', null],
  ['orders', 'shipping_first_name', 'VARCHAR(100)', 'NOT NULL', null],
  ['orders', 'shipping_last_name', 'VARCHAR(100)', 'NOT NULL', null],
  ['orders', 'billing_first_name', 'VARCHAR(100)', 'NOT NULL', null],
  ['orders', 'billing_last_name', 'VARCHAR(100)', 'NOT NULL', null],
  ['orders', 'payment_method', 'VARCHAR(50)', 'NOT NULL', null],

  // slug shorten
  ['categories', 'slug', 'VARCHAR(100)', 'NOT NULL', null],
  ['brands', 'slug', 'VARCHAR(100)', 'NOT NULL', null],
  ['collections', 'slug', 'VARCHAR(100)', 'NOT NULL', null],
  ['products', 'slug', 'VARCHAR(100)', 'NOT NULL', null],

  // chat_messages
  ['chat_messages', 'session_id', 'VARCHAR(128)', 'NOT NULL', null],
  ['chat_messages', 'intent', 'VARCHAR(50)', 'NULL', null],

  // carts + search_histories
  ['carts', 'session_id', 'VARCHAR(128)', 'NULL', null],
  ['search_histories', 'session_id', 'VARCHAR(128)', 'NULL', null],

  // products status / condition / visibility
  ['products', 'status', 'VARCHAR(50)', 'NULL', "'active'"],
  ['products', 'condition', 'VARCHAR(50)', 'NULL', "'new'"],
  ['products', 'visibility', 'VARCHAR(50)', 'NULL', "'public'"],

  // attribute_groups
  ['attribute_groups', 'type', 'VARCHAR(50)', 'NOT NULL', "'custom'"],
];

async function getColumnState(qi, table, column) {
  const [rows] = await qi.sequelize.query(
    `SELECT COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    { replacements: [table, column] },
  );
  return rows[0] || null;
}

function isAlreadyMatching(state, type, nullClause, defaultExpr) {
  if (!state) return false;
  const wantNullable = nullClause === 'NULL';
  const isNullable = state.IS_NULLABLE === 'YES';
  if (wantNullable !== isNullable) return false;
  if (state.COLUMN_TYPE.toLowerCase() !== type.toLowerCase()) return false;
  // Default check
  const actualDefault = state.COLUMN_DEFAULT;
  let wantDefault = defaultExpr;
  if (wantDefault && wantDefault.startsWith("'") && wantDefault.endsWith("'")) {
    wantDefault = wantDefault.slice(1, -1);
  }
  if (actualDefault === null && wantDefault === null) return true;
  if (actualDefault === wantDefault) return true;
  return false;
}

module.exports = {
  async up(queryInterface) {
    for (const [table, column, type, nullClause, defaultExpr] of COLUMNS) {
      const state = await getColumnState(queryInterface, table, column);
      if (!state) continue;
      if (isAlreadyMatching(state, type, nullClause, defaultExpr)) continue;
      const defaultClause = defaultExpr
        ? ` DEFAULT ${defaultExpr}`
        : nullClause === 'NULL'
          ? ' DEFAULT NULL'
          : '';
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` MODIFY COLUMN \`${column}\` ${type} ${nullClause}${defaultClause}`,
      );
    }
  },

  async down() {
    // Down migration không revert (giữ pháp lý kích thước hợp lý — không có lý do nào cần grow lại VARCHAR(255))
    // Nếu thực sự cần rollback, restore từ backups/phase40-pre-varchar-*.sql
  },
};
