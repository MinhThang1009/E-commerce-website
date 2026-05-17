/**
 * @file wishlistValidator.js
 * @layer Validator
 * @module wishlist
 * @description Validation schemas cho wishlist
 */
// Wishlist request validators (Joi schemas)
const Joi = require('joi');

module.exports = {
  create: Joi.object({
    // TODO: validate fields
  }),
  update: Joi.object({
    // TODO: validate partial fields
  }),
};
