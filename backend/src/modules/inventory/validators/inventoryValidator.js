/**
 * @file inventoryValidator.js
 * @layer Validator
 * @module inventory
 * @description Validation schemas cho inventory
 */
// Inventory request validators (Joi schemas)
const Joi = require('joi');

module.exports = {
  create: Joi.object({
    // TODO: validate fields
  }),
  update: Joi.object({
    // TODO: validate partial fields
  }),
};
