#!/usr/bin/env node
// Phase 42.19.1 — Module generator for Modular Monolith
//
// Usage:
//   node scripts/new-module.mjs --name=referrals --type=simple
//   node scripts/new-module.mjs --name=subscriptions --type=ddd-lite
//
// Tạo folder backend/src/modules/{name}/ với cấu trúc 3-layer (simple) hoặc thêm domain/ (ddd-lite).
// Reject nếu name trùng existing module hoặc trùng term cấm trong Domain Glossary.

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const MODULES_DIR = path.join(PROJECT_ROOT, 'backend/src/modules');
const GLOSSARY_FILE = path.join(PROJECT_ROOT, 'docs/naming/DOMAIN_GLOSSARY.md');

// Term cấm dùng theo Domain Glossary — fallback hardcoded nếu file không đọc được
const HARDCODED_FORBIDDEN = [
  'customer', 'buyer', 'client', 'account',
  'item', 'goods', 'merchandise',
  'coupon', 'promoCode', 'voucher', 'promo-code',
  'purchase', 'transaction',
  'lineItem', 'line-item', 'purchaseItem', 'purchase-item',
  'basketItem', 'basket-item',
  'rating',
  'guaranteePlan', 'guarantee-plan',
  'rewardPoints', 'reward-points', 'cashback',
  'pointsLog', 'points-log', 'rewardLog', 'reward-log',
  'alert',
  'slide', 'hero',
  'post', 'article', 'blog',
  'series', 'bundle', 'pack',
  'option', 'feature', 'spec',
  'attributeCategory', 'attributeType',
  'delivery',
  'checkout',
];

function parseArgs() {
  const args = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [k, v] = arg.slice(2).split('=');
      args[k] = v ?? true;
    }
  }
  return args;
}

function toCamel(s) {
  return s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}
function toPascal(s) {
  const c = toCamel(s);
  return c.charAt(0).toUpperCase() + c.slice(1);
}
function toKebab(s) {
  return s.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()).replace(/^-/, '');
}

async function loadForbiddenTerms() {
  try {
    const content = await fs.readFile(GLOSSARY_FILE, 'utf8');
    const terms = new Set(HARDCODED_FORBIDDEN);
    // Parse "| Concept | Term DUY NHẤT dùng | KHÔNG dùng |" table
    const tableLines = content.split('\n').filter((l) => l.startsWith('|') && !l.includes('---'));
    for (const line of tableLines) {
      const cols = line.split('|').map((c) => c.trim());
      // cols[3] = "KHÔNG dùng" — extract terms in backticks
      if (cols[3]) {
        const matches = cols[3].matchAll(/`([^`]+)`/g);
        for (const m of matches) {
          terms.add(m[1].trim());
          terms.add(toKebab(m[1].trim()));
        }
      }
    }
    return terms;
  } catch {
    return new Set(HARDCODED_FORBIDDEN);
  }
}

function fileTemplate(moduleName, type) {
  const Pascal = toPascal(moduleName);
  const camel = toCamel(moduleName);
  const kebab = toKebab(moduleName);

  const files = {
    [`controllers/${camel}Controller.js`]: `// ${Pascal} Controller — parse req → call service → format res
class ${Pascal}Controller {
  constructor({ ${camel}Service }) {
    this.${camel}Service = ${camel}Service;
  }

  // TODO: implement handlers
}

module.exports = ${Pascal}Controller;
`,

    [`services/${camel}Service.js`]: `// ${Pascal} Service — business logic. KHÔNG import Sequelize trực tiếp; gọi qua repository.
class ${Pascal}Service {
  constructor({ ${camel}Repository, eventBus }) {
    this.${camel}Repository = ${camel}Repository;
    this.eventBus = eventBus;
  }

  // TODO: implement use cases
}

module.exports = ${Pascal}Service;
`,

    [`repositories/I${Pascal}Repository.js`]: `// I${Pascal}Repository — interface (method signatures cho ${camel} data access)
// Service chỉ phụ thuộc vào interface này, không phụ thuộc Sequelize impl.

class I${Pascal}Repository {
  async findOneById(_id) { throw new Error('not implemented'); }
  async findAll(_filter) { throw new Error('not implemented'); }
  async create(_payload) { throw new Error('not implemented'); }
  async update(_id, _patch) { throw new Error('not implemented'); }
  async delete(_id) { throw new Error('not implemented'); }
}

module.exports = I${Pascal}Repository;
`,

    [`repositories/Sequelize${Pascal}Repository.js`]: `// Sequelize impl của I${Pascal}Repository
const I${Pascal}Repository = require('./I${Pascal}Repository');

class Sequelize${Pascal}Repository extends I${Pascal}Repository {
  constructor({ ${Pascal}Model }) {
    super();
    this.Model = ${Pascal}Model;
  }

  async findOneById(id) { return this.Model.findByPk(id); }
  async findAll(filter = {}) { return this.Model.findAll({ where: filter }); }
  async create(payload) { return this.Model.create(payload); }
  async update(id, patch) {
    const row = await this.findOneById(id);
    if (!row) return null;
    return row.update(patch);
  }
  async delete(id) {
    const row = await this.findOneById(id);
    if (!row) return null;
    await row.destroy();
    return { deletedId: id };
  }
}

module.exports = Sequelize${Pascal}Repository;
`,

    [`models/${Pascal}Model.js`]: `// ${Pascal} Sequelize model — schema definition
const { DataTypes } = require('sequelize');

module.exports = (sequelize) => {
  const ${Pascal} = sequelize.define('${Pascal}', {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },
    // TODO: add fields
  }, {
    tableName: '${kebab}s',
    timestamps: true,
    underscored: true,
  });
  return ${Pascal};
};
`,

    'routes.js': `// ${Pascal} module routes
const express = require('express');

module.exports = ({ ${camel}Controller }) => {
  const router = express.Router();
  // TODO: define routes — vd router.get('/', (req, res) => ${camel}Controller.list(req, res));
  return router;
};
`,

    [`validators/${camel}Validator.js`]: `// ${Pascal} request validators (Joi schemas)
const Joi = require('joi');

module.exports = {
  create: Joi.object({
    // TODO: validate fields
  }),
  update: Joi.object({
    // TODO: validate partial fields
  }),
};
`,

    [`dtos/${camel}Dto.js`]: `// ${Pascal} DTO factory — pure function, không class.
// Service trả về model → controller mapper qua to${Pascal}Dto trước response.

function to${Pascal}Dto(model) {
  if (!model) return null;
  const json = typeof model.toJSON === 'function' ? model.toJSON() : model;
  return {
    id: json.id,
    // TODO: pick fields
  };
}

module.exports = { to${Pascal}Dto };
`,

    'module.js': `// ${Pascal} module — DI wire repo → service → controller → router
const ${Pascal}Controller = require('./controllers/${camel}Controller');
const ${Pascal}Service = require('./services/${camel}Service');
const Sequelize${Pascal}Repository = require('./repositories/Sequelize${Pascal}Repository');
const ${Pascal}ModelFactory = require('./models/${Pascal}Model');
const buildRoutes = require('./routes');

module.exports = ({ sequelize, eventBus }) => {
  const ${Pascal}Model = ${Pascal}ModelFactory(sequelize);
  const ${camel}Repository = new Sequelize${Pascal}Repository({ ${Pascal}Model });
  const ${camel}Service = new ${Pascal}Service({ ${camel}Repository, eventBus });
  const ${camel}Controller = new ${Pascal}Controller({ ${camel}Service });
  const router = buildRoutes({ ${camel}Controller });

  return {
    basePath: '/${kebab}s',
    router,
    subscribeEvents() {
      // TODO: register eventBus subscribers nếu có
    },
  };
};
`,
  };

  if (type === 'ddd-lite') {
    files[`domain/aggregates/${Pascal}Aggregate.js`] = `// ${Pascal}Aggregate — rich domain model (state transitions, invariants)
class ${Pascal}Aggregate {
  constructor(state) {
    this.state = state;
  }

  // TODO: implement domain methods (vd ${camel}.cancel(), ${camel}.markAsX())
  // Mỗi method phải enforce invariant + return new state hoặc throw DomainError.

  toJSON() { return { ...this.state }; }
}

module.exports = ${Pascal}Aggregate;
`;

    files[`domain/events/${Pascal}CreatedEvent.js`] = `// ${Pascal} domain event — publish qua eventBus
module.exports = function ${Pascal}CreatedEvent(payload) {
  return {
    type: '${camel}.created',
    payload,
    occurredAt: new Date().toISOString(),
  };
};
`;

    files[`domain/policies/${Pascal}Policy.js`] = `// ${Pascal}Policy — pure business rules (no side effects)
module.exports = {
  // TODO: implement policy functions
  // Vd canCancel(${camel}State) { return ${camel}State.status === 'pending'; }
};
`;
  }

  return files;
}

async function main() {
  const args = parseArgs();
  const name = args.name;
  const type = args.type || 'simple';

  if (!name) {
    console.error('❌ Missing --name=<module-name>');
    console.error('Usage: node scripts/new-module.mjs --name=referrals --type=simple');
    process.exit(1);
  }
  if (!['simple', 'ddd-lite'].includes(type)) {
    console.error(`❌ Invalid --type=${type}. Must be "simple" hoặc "ddd-lite".`);
    process.exit(1);
  }

  // Validate name format (kebab-case lowercase + hyphens only)
  if (!/^[a-z][a-z0-9-]*$/.test(name)) {
    console.error(`❌ Invalid name "${name}". Phải là kebab-case lowercase (vd: referrals, sub-modules).`);
    process.exit(1);
  }

  // Check forbidden Domain Glossary terms
  const forbidden = await loadForbiddenTerms();
  if (forbidden.has(name) || forbidden.has(toCamel(name))) {
    console.error(`❌ Tên "${name}" trong Domain Glossary cấm dùng (xem docs/naming/DOMAIN_GLOSSARY.md).`);
    console.error('   Hãy dùng term được approve thay thế (vd users thay vì customers, discountCodes thay vì coupons).');
    process.exit(1);
  }

  // Check existing module
  const moduleDir = path.join(MODULES_DIR, name);
  try {
    await fs.access(moduleDir);
    console.error(`❌ Module "${name}" đã tồn tại tại ${moduleDir}.`);
    process.exit(1);
  } catch {
    // Good — doesn't exist
  }

  // Create folder + files
  console.log(`📦 Tạo module "${name}" (${type}) tại ${moduleDir}...`);
  await fs.mkdir(moduleDir, { recursive: true });

  const files = fileTemplate(name, type);
  for (const [relPath, content] of Object.entries(files)) {
    const fullPath = path.join(moduleDir, relPath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content, 'utf8');
    console.log(`   ✓ ${relPath}`);
  }

  console.log('');
  console.log(`✅ Module "${name}" tạo thành công.`);
  console.log('');
  console.log('Next step:');
  console.log(`  1. Mở backend/src/server.js, thêm:`);
  console.log(`     const ${toCamel(name)}Module = require('./modules/${name}/module')({ sequelize, eventBus });`);
  console.log(`     app.use('/api' + ${toCamel(name)}Module.basePath, ${toCamel(name)}Module.router);`);
  console.log(`     ${toCamel(name)}Module.subscribeEvents();`);
  console.log(`  2. Implement các TODO trong files vừa tạo.`);
  console.log(`  3. Viết integration test theo Rule 30 (API endpoint test).`);
}

main().catch((err) => {
  console.error('❌ Lỗi:', err.message);
  process.exit(1);
});
