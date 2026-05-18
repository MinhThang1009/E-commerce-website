/**
 * @file cartDto.js
 * @layer DTO
 * @module cart
 * @description Data transfer objects cho cart
 */
// Cart DTO — service đã build cấu trúc {id, items, totalItems, subtotal} trong
// _buildCartResponse, nên DTO chủ yếu là pass-through. Để chỗ này cho future
// transformation (vd hide internal fields).

function toCartDto(data) {
  if (!data) return null;
  return data;
}

module.exports = { toCartDto };
