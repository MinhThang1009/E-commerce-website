/**
 * Export seed data từ DB → seed_data.sql
 * Dùng: npm run db:export-seed
 *
 * Dump theo thứ tự FK dependency:
 *   categories → brands → products → product_variants → product_images
 *   → product_categories → product_specifications
 * Output: backend/data/seed_data.sql (overwrite)
 */
require('dotenv').config();
// Bắt buộc trước khi require src/* — config/sequelize dùng alias @config
require('module-alias/register');
const path = require('path');
const fs = require('fs');
const sequelize = require('../src/config/sequelize');

const OUTPUT = path.join(__dirname, '../data/seed_data.sql');

// Thứ tự dump phải theo dependency FK — bảng phụ thuộc phải đứng sau bảng gốc
const TABLES = [
  'categories',
  'brands',
  'products',
  'product_variants',
  'product_images',
  'product_categories',
  'product_specifications',
];

function toMysqlDatetime(d) {
  const pad = n => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth()+1)}-${pad(d.getUTCDate())} ` +
         `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`;
}

function escapeValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'number') return String(val);
  if (val instanceof Date) return `'${toMysqlDatetime(val)}'`;
  // Chuỗi: escape dấu nháy đơn và backslash
  const s = String(val)
    .replace(/\\/g, '\\\\')
    .replace(/'/g, "\\'");
  return `'${s}'`;
}

function rowToInsertIgnore(table, columns, row) {
  const cols = columns.map(c => `\`${c}\``).join(', ');
  const vals = columns.map(c => escapeValue(row[c])).join(', ');
  // Dùng INSERT IGNORE để không crash khi chạy lại (duplicate PK/UNIQUE)
  return `INSERT IGNORE INTO \`${table}\` (${cols}) VALUES (${vals});`;
}

async function exportTable(table) {
  const [rows] = await sequelize.query(`SELECT * FROM \`${table}\``);
  if (rows.length === 0) return `-- (bảng ${table} trống)\n`;

  const columns = Object.keys(rows[0]);
  const lines = rows.map(row => rowToInsertIgnore(table, columns, row));
  return lines.join('\n') + '\n';
}

async function run() {
  try {
    await sequelize.authenticate();
    console.log('✅ Kết nối DB thành công');

    let output = '';
    output += `-- seed_data.sql — tự động tạo bởi exportSeed.js\n`;
    output += `-- Ngày: ${new Date().toISOString()}\n`;
    output += `-- KHÔNG EDIT TAY — dùng "npm run db:export-seed" để cập nhật\n\n`;
    output += `SET NAMES utf8mb4;\n`;
    output += `SET CHARACTER SET utf8mb4;\n`;
    output += `SET FOREIGN_KEY_CHECKS = 0;\n\n`;

    for (const table of TABLES) {
      console.log(`📦 Đang export bảng: ${table}...`);
      const block = await exportTable(table);
      const count = (block.match(/^INSERT/gm) || []).length;
      output += `-- ===== ${table.toUpperCase()} (${count} rows) =====\n`;
      output += block;
      output += '\n';
    }

    output += `SET FOREIGN_KEY_CHECKS = 1;\n`;

    fs.writeFileSync(OUTPUT, output, 'utf8');
    console.log(`\n✅ Đã ghi ${OUTPUT}`);

    const totalInserts = (output.match(/^INSERT/gm) || []).length;
    console.log(`   Tổng: ${totalInserts} INSERT IGNORE statements`);

    process.exit(0);
  } catch (err) {
    console.error('❌ Export thất bại:', err.message);
    process.exit(1);
  }
}

run();
