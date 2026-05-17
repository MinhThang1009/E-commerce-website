/**
 * @file index.js
 * @layer Shared
 * @module global
 * @description Cross-cutting infrastructure: index
 */
// Top-level barrel — convenience export cho file consumer chỉ cần vài thứ.
// Phần lớn module nên import trực tiếp subpath (vd `shared/persistence/sequelize`)
// để tree-shake friendly với ESM tương lai.
const errors = require('./errors');
const eventBus = require('./eventBus');
const Result = require('./result');
const sequelize = require('./persistence/sequelize');
const unitOfWork = require('./persistence/unitOfWork');
const logger = require('./logger');

module.exports = {
  ...errors,
  eventBus,
  Result,
  sequelize,
  unitOfWork,
  logger,
};
