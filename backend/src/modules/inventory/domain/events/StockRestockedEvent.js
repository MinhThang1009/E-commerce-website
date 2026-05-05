// StockRestockedEvent — publish khi admin nhập hàng.
module.exports = function StockRestockedEvent({ productId, variantId, quantity, previousStock, newStock, adminId }) {
  return {
    type: 'inventory.restocked',
    payload: { productId, variantId, quantity, previousStock, newStock, adminId },
    occurredAt: new Date().toISOString(),
  };
};
