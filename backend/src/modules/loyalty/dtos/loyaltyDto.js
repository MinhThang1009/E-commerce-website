/**
 * @file loyaltyDto.js
 * @layer DTO
 * @module loyalty
 * @description Data transfer objects cho loyalty
 */
// Loyalty DTO factory — pure function, không class.
// Service trả về model → controller mapper qua toLoyaltyDto trước response.

function toLoyaltyDto(model) {
  if (!model) return null;
  const json = typeof model.toJSON === 'function' ? model.toJSON() : model;
  return {
    id: json.id,
    // TODO: pick fields
  };
}

module.exports = { toLoyaltyDto };
