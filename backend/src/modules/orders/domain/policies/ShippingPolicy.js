// ShippingPolicy — pure business rule tính phí ship.
// Tách khỏi service để test dễ + tái sử dụng cho estimateShipping endpoint.
//
// Quy tắc:
//   - Đơn ≥ FREE_THRESHOLD → free ship
//   - Phí cơ bản BASE_RATE
//   - Vượt WEIGHT_THRESHOLD kg → tính thêm WEIGHT_RATE × Math.ceil(extraKg)

const WEIGHT_THRESHOLD = 2;

function calculateShippingCost({ subtotal, totalWeightKg, freeThreshold, baseRate, weightRate }) {
  if (subtotal >= freeThreshold) return 0;

  let cost = baseRate;
  if (totalWeightKg > WEIGHT_THRESHOLD) {
    const extraKg = totalWeightKg - WEIGHT_THRESHOLD;
    cost += Math.ceil(extraKg) * weightRate;
  }
  return cost;
}

module.exports = {
  calculateShippingCost,
  WEIGHT_THRESHOLD,
};
