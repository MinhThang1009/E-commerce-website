/**
 * @file aiValidator.js
 * @layer Validator
 * @module ai
 * @description Validation schemas cho ai
 */
// AI request validators (Joi schemas)
const Joi = require('joi');

module.exports = {
  create: Joi.object({
    // TODO: validate fields
  }),
  update: Joi.object({
    // TODO: validate partial fields
  }),
};
