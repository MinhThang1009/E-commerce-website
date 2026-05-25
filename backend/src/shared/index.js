/**
 * @file index.js
 * @layer Shared
 * @module global
 * @description Cross-cutting infrastructure: index
 */
// Top-level barrel — convenience export cho file consumer chỉ cần vài thứ.
const errors = require('@shared/errors');
const eventBus = require('@shared/event-bus');
const sequelize = require('@config/sequelize');
const unitOfWork = require('@shared/persistence/unit-of-work');
const logger = require('@utils/logger');

module.exports = {
  ...errors,
  eventBus,
  sequelize,
  unitOfWork,
  logger,
};
