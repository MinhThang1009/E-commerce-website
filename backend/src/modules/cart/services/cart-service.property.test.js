/**
 * @file cart-service.property.test.js
 * @layer Test (property-based)
 * @description Property test cho getCart/_buildCartResponse — kiểm INVARIANT tiền giỏ hàng
 *   với HÀNG NGÀN giỏ random (fast-check), bắt outcome người-viết-test-không-nghĩ-tới.
 *   Map invariants.ecommerce.md:
 *     INV-MON-1 (cart): subtotal = Σ(unitPrice × quantity); totalItems = Σ(quantity).
 *   Oracle độc lập = công thức cộng dồn thuần, so với subtotal RAW do service tính.
 */
const fc = require('fast-check');

const CartService = require('./cart-service');

// 1 cart item dùng nhánh ProductVariant.price (bỏ qua transform Product cho gọn).
const makeItem = (price, quantity) => ({
  quantity,
  toJSON: () => ({ quantity, ProductVariant: { price } }),
});

function makeService(items) {
  const cartRepository = {
    findOrCreateActiveCartBySessionId: jest.fn().mockResolvedValue({ id: 1 }),
    findCartItemsWithDetails: jest.fn().mockResolvedValue(items),
  };
  const logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };
  return new CartService({ cartRepository, eventBus: { publish: jest.fn() }, logger });
}

describe('CartService.getCart — property invariants (INV-MON-1)', () => {
  it('subtotal = Σ(price × quantity) và totalItems = Σ(quantity) với mọi giỏ random', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.array(
          fc.record({
            // Giá nguyên (VND) → tổng số nguyên chính xác, tránh sai số float
            price: fc.integer({ min: 0, max: 50_000_000 }),
            quantity: fc.integer({ min: 1, max: 99 }),
          }),
          { maxLength: 20 },
        ),
        async (rows) => {
          const items = rows.map((r) => makeItem(r.price, r.quantity));
          const service = makeService(items);
          const { data } = await service.getCart({ user: null, cookieSessionId: 'sess-prop' });

          // Oracle độc lập: cộng dồn thuần
          const expectedSubtotal = rows.reduce((sum, r) => sum + r.price * r.quantity, 0);
          const expectedItems = rows.reduce((sum, r) => sum + r.quantity, 0);

          expect(data.subtotal).toBe(expectedSubtotal);
          expect(data.totalItems).toBe(expectedItems);
        },
      ),
      { numRuns: 300 },
    );
  });

  it('giỏ rỗng → subtotal = 0 và totalItems = 0', async () => {
    const service = makeService([]);
    const { data } = await service.getCart({ user: null, cookieSessionId: 'sess-empty' });
    expect(data.subtotal).toBe(0);
    expect(data.totalItems).toBe(0);
  });
});
