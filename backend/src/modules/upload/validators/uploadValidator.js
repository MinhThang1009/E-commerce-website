/**
 * @file uploadValidator.js
 * @layer Validator
 * @module upload
 * @description Validation schemas cho upload
 */
// Upload request validators (Joi schemas)
const Joi = require('joi');

module.exports = {
  create: Joi.object({
    // TODO: validate fields
  }),
  update: Joi.object({
    // TODO: validate partial fields
  }),
};
