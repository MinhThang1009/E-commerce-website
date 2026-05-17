/**
 * Phase 46.4 — Schema Drift Integration Test
 *
 * Boots Sequelize + connects DB + iterate all models.
 * Verify mỗi model attribute (rawAttributes) tồn tại trong DB.
 * Verify paranoid models có deleted_at trong DB.
 *
 * Skipped nếu DB không available (CI mặc định) — chỉ chạy local + integration CI.
 *
 * Mỗi loại drift catch ngay → tránh runtime 500 trên customer endpoint.
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

let sequelize;
let models;
let dbAvailable = false;

beforeAll(async () => {
  try {
    sequelize = require('../config/sequelize');
    await sequelize.authenticate();
    models = require('../models');
    dbAvailable = true;
  } catch (err) {
    /* istanbul ignore next */
    console.warn('[schemaDrift] DB không available — skip integration test:', err.message);
    /* istanbul ignore next */
    dbAvailable = false;
  }
}, 30000);

afterAll(async () => {
  if (sequelize) await sequelize.close();
});

async function getDbColumns(tableName) {
  const [rows] = await sequelize.query(
    `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    { replacements: [tableName] },
  );
  return new Set(rows.map((r) => r.COLUMN_NAME));
}

describe('Phase 46.4 — Schema drift integration check', () => {
  test('DB phải available để chạy test (skip nếu không)', () => {
    if (!dbAvailable) {
      /* istanbul ignore next */
      console.warn('Skipping schema drift test — DB không available.');
      /* istanbul ignore next */
      return;
    }
    expect(dbAvailable).toBe(true);
  });

  test('Mỗi model attribute (rawAttributes) phải tồn tại trong DB column', async () => {
    if (!dbAvailable) return;

    const drifts = [];
    const modelInstances = Object.values(models).filter((m) => m && m.tableName && m.rawAttributes);

    for (const model of modelInstances) {
      const dbCols = await getDbColumns(model.tableName);
      for (const [attrName, attr] of Object.entries(model.rawAttributes)) {
        const dbColName = attr.field || attrName;
        if (!dbCols.has(dbColName)) {
          drifts.push(`${model.name}.${attrName} → ${model.tableName}.${dbColName}`);
        }
      }
    }

    expect(drifts).toEqual([]);
  }, 30000);

  test('Paranoid models phải có deleted_at trong DB', async () => {
    if (!dbAvailable) return;

    const drifts = [];
    const modelInstances = Object.values(models).filter(
      (m) => m && m.tableName && m.options && m.options.paranoid,
    );

    for (const model of modelInstances) {
      const dbCols = await getDbColumns(model.tableName);
      if (!dbCols.has('deleted_at')) {
        drifts.push(`${model.name} (${model.tableName})`);
      }
    }

    expect(drifts).toEqual([]);
  }, 30000);
});
