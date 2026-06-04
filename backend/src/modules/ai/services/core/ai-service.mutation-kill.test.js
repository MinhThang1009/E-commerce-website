/**
 * ai-service.mutation-kill.test.js
 *
 * Bổ sung cho ai-service.test.js — kill mutant trong addToCart:
 *   - reduce stock-sum: `s + (v.stockQuantity || 0)` (ArithmeticOperator, `|| 0`)
 *   - guard `(totalStock <= 0 && product.stockQuantity <= 0)` (ConditionalExpression)
 *   - analytics metadata `{ quantity, source: 'chatbot' }` (ObjectLiteral, StringLiteral)
 *
 * Mấu chốt: chỉ có variant còn hàng (product.stockQuantity = 0) → tổng stock PHẢI > 0
 * mới không throw. Mutant biến tổng thành 0/âm → throw → khác outcome.
 */

const AIService = require('./ai-service');

function makeRepo() {
  return {
    findActiveDeals: jest.fn(),
    findFeaturedProducts: jest.fn(),
    createAnalyticsEvent: jest.fn().mockResolvedValue({ id: 1 }),
    findProductForCart: jest.fn(),
    addToCart: jest.fn().mockResolvedValue({ id: 20 }),
  };
}

describe('AIService.addToCart — mutation kill', () => {
  let repo;
  let service;

  beforeEach(() => {
    repo = makeRepo();
    service = new AIService({
      aiRepository: repo,
      chatbotService: { handleMessage: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn() },
    });
  });

  it('chỉ variant còn hàng (product.stockQuantity=0) → tổng stock>0 → KHÔNG throw, thêm giỏ thành công', async () => {
    // Tổng stock = 5+3 = 8 (>0). product.stockQuantity=0.
    // Mutant `+`→`-` (tổng=-8), `||0`→`&&0` / false (tổng=0): kết hợp stockQuantity=0
    // → (tổng<=0 && 0<=0) = true → throw. Bản gốc tổng=8 → không throw.
    repo.findProductForCart.mockResolvedValue({
      id: 5,
      status: 'active',
      stockQuantity: 0,
      variants: [{ stockQuantity: 5 }, { stockQuantity: 3 }],
    });

    const result = await service.addToCart({
      productId: 5,
      variantId: null,
      quantity: 2,
      sessionId: 'sess',
      userId: 3,
    });

    expect(result).toMatchObject({ id: 20 });
    expect(repo.addToCart).toHaveBeenCalledWith({
      userId: 3,
      productId: 5,
      variantId: null,
      quantity: 2,
    });
  });

  it('analytics event ghi đúng metadata { quantity, source: "chatbot" }', async () => {
    repo.findProductForCart.mockResolvedValue({
      id: 5,
      status: 'active',
      stockQuantity: 0,
      variants: [{ stockQuantity: 5 }],
    });

    await service.addToCart({
      productId: 5,
      variantId: 7,
      quantity: 4,
      sessionId: 'sess-1',
      userId: 9,
    });

    expect(repo.createAnalyticsEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'product_added_to_cart',
        userId: 9,
        sessionId: 'sess-1',
        productId: 5,
        metadata: { quantity: 4, source: 'chatbot' },
        timestamp: expect.any(Date),
      }),
    );
  });

  it('product active, không variants, chỉ product.stockQuantity>0 → KHÔNG throw (kill guard true)', async () => {
    // totalStock=0 nhưng product.stockQuantity=10 → (0<=0 && 10<=0)=false → không throw.
    // Mutant ConditionalExpression `true` ở guard nội → luôn throw.
    repo.findProductForCart.mockResolvedValue({
      id: 8,
      status: 'active',
      stockQuantity: 10,
      variants: [],
    });

    const result = await service.addToCart({
      productId: 8,
      variantId: null,
      quantity: 1,
      sessionId: 's',
      userId: 1,
    });
    expect(result).toMatchObject({ id: 20 });
  });
});
