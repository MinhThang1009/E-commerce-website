// Wishlist DTO — service đã build product shape rồi, DTO là pass-through.
function toWishlistProductDto(product) {
  if (!product) return null;
  return product;
}

module.exports = { toWishlistProductDto };
