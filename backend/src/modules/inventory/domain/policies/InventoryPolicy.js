// InventoryPolicy — pure rules cho stock changes.
//
//   - canDeduct: stockQuantity >= requiredQty
//   - validateRestockQuantity: positive integer
function canDeduct(stockQuantity, requiredQty) {
  return Number(stockQuantity) >= Number(requiredQty);
}

function validateRestockQuantity(quantity) {
  const qty = parseInt(quantity, 10);
  if (!qty || qty <= 0) {
    return { valid: false, reason: 'Số lượng nhập phải là số nguyên dương' };
  }
  return { valid: true, quantity: qty };
}

module.exports = { canDeduct, validateRestockQuantity };
