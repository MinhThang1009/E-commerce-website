'use strict';

/**
 * Frontend utility tests — Phase 25
 *
 * Chạy dưới dạng CommonJS (.cjs) để tránh xung đột với "type": "module"
 * và không cần TypeScript transformation.
 *
 * Kiểm tra logic nghiệp vụ frontend thuần: CSV escaping, tính giá, shipping.
 */

// ============================================================
// 1. CSV export logic (từ exportUtils.ts)
// ============================================================

describe('CSV export logic', () => {
  // Hàm escape CSV — đồng bộ với exportToCSV trong exportUtils.ts
  function escapeCsvValue(val) {
    const escaped = ('' + val).replace(/"/g, '\\"');
    return `"${escaped}"`;
  }

  test('Giá trị bình thường → bọc trong dấu nháy kép', () => {
    expect(escapeCsvValue('Hello World')).toBe('"Hello World"');
  });

  test('Giá trị chứa dấu phẩy → vẫn bọc đúng (không bị split)', () => {
    expect(escapeCsvValue('Apple, Samsung')).toBe('"Apple, Samsung"');
  });

  test('Giá trị chứa dấu nháy kép → escape đúng', () => {
    expect(escapeCsvValue('Say "hello"')).toBe('"Say \\"hello\\""');
  });

  test('Giá trị rỗng → chuỗi rỗng trong nháy kép', () => {
    expect(escapeCsvValue('')).toBe('""');
  });

  test('Giá trị số → chuyển string rồi bọc nháy kép', () => {
    expect(escapeCsvValue(123456)).toBe('"123456"');
  });

  test('Giá trị null → "null" bọc nháy kép', () => {
    expect(escapeCsvValue(null)).toBe('"null"');
  });
});

// ============================================================
// 2. Shipping cost calculation (từ order controller constants)
// ============================================================

describe('Tính phí vận chuyển', () => {
  const SHIPPING_FREE_THRESHOLD = 2000000;
  const SHIPPING_BASE_RATE = 30000;
  const SHIPPING_WEIGHT_RATE = 5000;
  const SHIPPING_WEIGHT_THRESHOLD = 2;

  function calculateShippingCost(subtotal, totalWeightKg) {
    if (subtotal >= SHIPPING_FREE_THRESHOLD) return 0;

    let cost = SHIPPING_BASE_RATE;

    if (totalWeightKg > SHIPPING_WEIGHT_THRESHOLD) {
      const extraKg = totalWeightKg - SHIPPING_WEIGHT_THRESHOLD;
      cost += Math.ceil(extraKg) * SHIPPING_WEIGHT_RATE;
    }

    return cost;
  }

  test('Đơn hàng đúng ngưỡng miễn phí (2,000,000) → phí ship = 0', () => {
    expect(calculateShippingCost(2000000, 0)).toBe(0);
  });

  test('Đơn hàng vượt ngưỡng miễn phí → phí ship = 0', () => {
    expect(calculateShippingCost(5000000, 3)).toBe(0);
  });

  test('Đơn hàng dưới ngưỡng, trọng lượng ≤ 2kg → phí ship cơ bản 30,000', () => {
    expect(calculateShippingCost(500000, 1)).toBe(30000);
    expect(calculateShippingCost(500000, 2)).toBe(30000);
  });

  test('Đơn hàng dưới ngưỡng, trọng lượng 3kg → phí ship cơ bản + 5,000 (1 kg thêm)', () => {
    expect(calculateShippingCost(500000, 3)).toBe(35000); // 30000 + 5000
  });

  test('Đơn hàng dưới ngưỡng, trọng lượng 4.5kg → phí ship cơ bản + 15,000 (3 kg thêm, làm tròn lên)', () => {
    expect(calculateShippingCost(500000, 4.5)).toBe(45000); // 30000 + ceil(2.5)*5000 = 30000+15000
  });
});

// ============================================================
// 3. Loyalty points calculation (từ constants)
// ============================================================

describe('Tính điểm tích lũy', () => {
  const POINTS_EARN_RATE = 100000; // 100,000 VND = 1 điểm
  const POINTS_VALUE = 1000;       // 1 điểm = 1,000 VND

  function calculateEarnedPoints(subtotal) {
    return Math.floor(subtotal / POINTS_EARN_RATE);
  }

  function calculatePointsDiscount(points) {
    return points * POINTS_VALUE;
  }

  test('Subtotal 100,000 → 1 điểm tích lũy', () => {
    expect(calculateEarnedPoints(100000)).toBe(1);
  });

  test('Subtotal 250,000 → 2 điểm (floor, không làm tròn lên)', () => {
    expect(calculateEarnedPoints(250000)).toBe(2);
  });

  test('Subtotal 1,500,000 → 15 điểm', () => {
    expect(calculateEarnedPoints(1500000)).toBe(15);
  });

  test('1 điểm = 1,000 VND giảm giá', () => {
    expect(calculatePointsDiscount(1)).toBe(1000);
  });

  test('10 điểm = 10,000 VND giảm giá', () => {
    expect(calculatePointsDiscount(10)).toBe(10000);
  });
});

// ============================================================
// 4. Cart total calculation
// ============================================================

describe('Tính tổng giỏ hàng', () => {
  function calcCartSubtotal(items) {
    return items.reduce((sum, item) => {
      const price = item.variantPrice || item.basePrice || 0;
      return sum + price * item.quantity;
    }, 0);
  }

  test('Giỏ rỗng → subtotal = 0', () => {
    expect(calcCartSubtotal([])).toBe(0);
  });

  test('1 sản phẩm, 2 cái → subtotal = price × 2', () => {
    const items = [{ basePrice: 500000, quantity: 2 }];
    expect(calcCartSubtotal(items)).toBe(1000000);
  });

  test('Sản phẩm có variant price ưu tiên hơn basePrice', () => {
    const items = [{ basePrice: 500000, variantPrice: 450000, quantity: 1 }];
    expect(calcCartSubtotal(items)).toBe(450000);
  });

  test('Nhiều sản phẩm → tổng cộng đúng', () => {
    const items = [
      { basePrice: 200000, quantity: 3 },
      { basePrice: 150000, quantity: 2 },
      { basePrice: 500000, quantity: 1 },
    ];
    expect(calcCartSubtotal(items)).toBe(600000 + 300000 + 500000);
  });
});
