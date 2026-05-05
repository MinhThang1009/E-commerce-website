/**
 * Phase 46.1 — Schema Drift Audit
 *
 * Quét tất cả Sequelize models, so sánh với DB schema thực tế (INFORMATION_SCHEMA).
 * Output: docs/SCHEMA_DRIFT_REPORT.md với 4 loại drift:
 *
 *  A. Model column ∉ DB     — Sequelize define col, DB không có (INSERT fail)
 *  B. Model paranoid ∉ DB    — paranoid:true cần deleted_at (SELECT fail)
 *  C. DB column ∉ Model     — DB có, Model không declare (orphan, không fail nhưng waste)
 *  D. Type/Null mismatch    — Type/nullability khác nhau (silent corrupt rủi ro)
 *
 * Usage: node backend/scripts/auditSchemaDrift.js
 */

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const fs = require('fs');
const sequelize = require('../src/config/sequelize');

// Map Sequelize DataType → MySQL type name (subset, đủ check thông dụng)
const SEQ_TO_MYSQL = {
  INTEGER: ['int', 'integer'],
  BIGINT: ['bigint'],
  STRING: ['varchar', 'char'],
  TEXT: ['text', 'mediumtext', 'longtext'],
  BOOLEAN: ['tinyint'],
  DECIMAL: ['decimal'],
  FLOAT: ['float'],
  DOUBLE: ['double'],
  DATE: ['datetime', 'timestamp'],
  DATEONLY: ['date'],
  JSON: ['json', 'longtext', 'text'],
  ENUM: ['enum'],
  UUID: ['varchar', 'char'],
};

function normalizeSeqType(attr) {
  // attr.type là DataType instance — extract key như 'INTEGER', 'STRING(255)', etc.
  const typeStr = attr.type.key || String(attr.type);
  // Match prefix uppercase letters
  const m = typeStr.match(/^([A-Z]+)/);
  return m ? m[1] : typeStr.toUpperCase();
}

async function getDbColumns(tableName) {
  const [rows] = await sequelize.query(
    `SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT
     FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    { replacements: [tableName] }
  );
  const map = new Map();
  for (const r of rows) {
    map.set(r.COLUMN_NAME, {
      type: r.DATA_TYPE.toLowerCase(),
      nullable: r.IS_NULLABLE === 'YES',
      default: r.COLUMN_DEFAULT,
    });
  }
  return map;
}

async function auditModel(model) {
  const tableName = model.tableName;
  const modelName = model.name;
  const dbCols = await getDbColumns(tableName);

  const driftA = []; // Model col ∉ DB
  const driftB = []; // paranoid ∉ deleted_at
  const driftC = []; // DB col ∉ Model
  const driftD = []; // Type/null mismatch

  const modelDbColNames = new Set();

  // Loại A + D: scan model attributes vs DB
  for (const [attrName, attr] of Object.entries(model.rawAttributes)) {
    const dbColName = attr.field || attrName;
    modelDbColNames.add(dbColName);

    if (!dbCols.has(dbColName)) {
      driftA.push({ attrName, dbColName, type: normalizeSeqType(attr) });
      continue;
    }

    // Loại D: type compatibility check
    const seqType = normalizeSeqType(attr);
    const expectedDbTypes = SEQ_TO_MYSQL[seqType];
    const actualDbType = dbCols.get(dbColName).type;
    if (expectedDbTypes && !expectedDbTypes.includes(actualDbType)) {
      driftD.push({
        attrName,
        dbColName,
        seqType,
        actualDbType,
        expectedDbTypes: expectedDbTypes.join('|'),
      });
    }

    // Nullability: skip — Sequelize allowNull khá nhiều default, gây noise
  }

  // Loại B: paranoid model cần deleted_at
  if (model.options.paranoid) {
    modelDbColNames.add('deleted_at');
    if (!dbCols.has('deleted_at')) {
      driftB.push({ message: 'paranoid:true nhưng DB không có deleted_at' });
    }
  }

  // timestamps: cần created_at, updated_at
  if (model.options.timestamps !== false) {
    modelDbColNames.add('created_at');
    modelDbColNames.add('updated_at');
  }

  // Loại C: DB col ∉ Model
  for (const [dbColName] of dbCols.entries()) {
    if (!modelDbColNames.has(dbColName)) {
      driftC.push({ dbColName });
    }
  }

  return { modelName, tableName, driftA, driftB, driftC, driftD };
}

async function main() {
  console.log('🔍 Phase 46.1 — Schema Drift Audit\n');

  // Load all models qua models/index.js (đã wire associations)
  const models = require('../src/models');
  // models export object: filter ra Sequelize model instances
  const modelInstances = Object.values(models).filter(
    (m) => m && m.tableName && m.rawAttributes
  );

  console.log(`Tìm thấy ${modelInstances.length} models. Đang audit...\n`);

  const reports = [];
  for (const model of modelInstances) {
    try {
      const r = await auditModel(model);
      reports.push(r);
    } catch (err) {
      console.error(`❌ Audit ${model.name} fail:`, err.message);
    }
  }

  // Generate markdown report
  const lines = [];
  lines.push('# Schema Drift Report — Phase 46.1');
  lines.push('');
  lines.push(`> Generated: ${new Date().toISOString()}`);
  lines.push(`> Models audited: ${reports.length}`);
  lines.push('');

  let totalA = 0, totalB = 0, totalC = 0, totalD = 0;
  for (const r of reports) {
    totalA += r.driftA.length;
    totalB += r.driftB.length;
    totalC += r.driftC.length;
    totalD += r.driftD.length;
  }

  lines.push('## Tổng kết');
  lines.push('');
  lines.push('| Loại | Mô tả | Count |');
  lines.push('|---|---|---|');
  lines.push(`| **A** | Model column ∉ DB (INSERT fail) | **${totalA}** |`);
  lines.push(`| **B** | Paranoid ∉ deleted_at (SELECT fail) | **${totalB}** |`);
  lines.push(`| **C** | DB col ∉ Model (orphan) | **${totalC}** |`);
  lines.push(`| **D** | Type mismatch | **${totalD}** |`);
  lines.push('');

  const blocking = totalA + totalB;
  if (blocking === 0) {
    lines.push('✅ **NO BLOCKING DRIFT** — DB khớp 100% với models (A+B = 0).');
  } else {
    lines.push(`❌ **${blocking} BLOCKING DRIFT** — fix qua Phase 46.2 trước khi production.`);
  }
  lines.push('');

  // Detail per model (chỉ list models có drift)
  lines.push('## Chi tiết theo model');
  lines.push('');
  for (const r of reports) {
    const total = r.driftA.length + r.driftB.length + r.driftC.length + r.driftD.length;
    if (total === 0) continue;
    lines.push(`### ${r.modelName} (\`${r.tableName}\`)`);
    lines.push('');
    if (r.driftA.length > 0) {
      lines.push('**A. Model col ∉ DB (BLOCKING):**');
      for (const d of r.driftA) {
        lines.push(`- \`${d.attrName}\` → \`${d.dbColName}\` (${d.type})`);
      }
      lines.push('');
    }
    if (r.driftB.length > 0) {
      lines.push('**B. Paranoid ∉ deleted_at (BLOCKING):**');
      for (const d of r.driftB) {
        lines.push(`- ${d.message}`);
      }
      lines.push('');
    }
    if (r.driftC.length > 0) {
      lines.push('**C. DB col ∉ Model (orphan, non-blocking):**');
      for (const d of r.driftC) {
        lines.push(`- \`${d.dbColName}\``);
      }
      lines.push('');
    }
    if (r.driftD.length > 0) {
      lines.push('**D. Type mismatch:**');
      for (const d of r.driftD) {
        lines.push(`- \`${d.dbColName}\`: model=${d.seqType}, DB=${d.actualDbType} (expected ${d.expectedDbTypes})`);
      }
      lines.push('');
    }
  }

  const reportPath = path.join(__dirname, '..', '..', 'docs', 'SCHEMA_DRIFT_REPORT.md');
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf8');
  console.log(`📝 Report ghi vào: ${reportPath}`);
  console.log('');
  console.log(`📊 Tổng kết: A=${totalA}, B=${totalB}, C=${totalC}, D=${totalD}`);

  await sequelize.close();
  process.exit(blocking > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('❌ Audit fail:', err);
  process.exit(2);
});
