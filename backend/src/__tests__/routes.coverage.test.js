/**
 * routes.coverage.test.js
 *
 * Tests cho các Express router files tại 0% coverage:
 *   - src/modules/payment/routes.js
 *   - src/modules/reviews/routes.js
 *   - src/modules/users/routes.js
 *   - src/modules/wishlist/routes.js
 *   - src/modules/inventory/routes.js
 *
 * Strategy: require mỗi router factory (hoặc module), kiểm tra router được
 * tạo ra là một Express Router hợp lệ và stack chứa đúng số route đã đăng ký.
 */

process.env.NODE_ENV = 'test';

// ════════════════════════════════════════════════════════════════════════════
// src/modules/payment/routes.js
// ════════════════════════════════════════════════════════════════════════════

describe('payment/routes.js — factory tạo Express router hợp lệ', () => {
  let buildRoutes;

  beforeAll(() => {
    buildRoutes = require('../modules/payment/routes');
  });

  function makePaymentController() {
    return {
      handleSePayWebhook: jest.fn(),
      momoReturn: jest.fn(),
      momoIPN: jest.fn(),
      vnpayReturn: jest.fn(),
      vnpayIPN: jest.fn(),
      createMomoUrl: jest.fn(),
      createVNPayUrl: jest.fn(),
      createRefund: jest.fn(),
    };
  }

  it('trả về router khi được gọi với paymentController hợp lệ', () => {
    const router = buildRoutes({ paymentController: makePaymentController() });
    expect(router).toBeDefined();
    // Express Router có thuộc tính stack chứa các layer đã đăng ký
    expect(router.stack).toBeDefined();
    expect(Array.isArray(router.stack)).toBe(true);
  });

  it('router có ít nhất 8 route được đăng ký (public + auth + admin)', () => {
    const router = buildRoutes({ paymentController: makePaymentController() });
    // payment/routes.js đăng ký 8 route: sepay-webhook, momo/return, momo/ipn,
    // vnpay/return, vnpay/ipn, momo/create-url, vnpay/create-url, refund
    expect(router.stack.length).toBeGreaterThanOrEqual(8);
  });

  it('router là một function (Express middleware)', () => {
    const router = buildRoutes({ paymentController: makePaymentController() });
    expect(typeof router).toBe('function');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// src/modules/reviews/routes.js
// ════════════════════════════════════════════════════════════════════════════

describe('reviews/routes.js — factory tạo Express router hợp lệ', () => {
  let buildRoutes;

  beforeAll(() => {
    buildRoutes = require('../modules/reviews/routes');
  });

  function makeReviewsController() {
    return {
      getProductReviews: jest.fn(),
      getUserReviews: jest.fn(),
      createReview: jest.fn(),
      updateReview: jest.fn(),
      deleteReview: jest.fn(),
      markReviewHelpful: jest.fn(),
      getAllReviews: jest.fn(),
      verifyReview: jest.fn(),
    };
  }

  it('trả về router khi được gọi với reviewsController hợp lệ', () => {
    const router = buildRoutes({ reviewsController: makeReviewsController() });
    expect(router).toBeDefined();
    expect(router.stack).toBeDefined();
    expect(Array.isArray(router.stack)).toBe(true);
  });

  it('router có ít nhất 7 layer đã đăng ký (public + user + admin)', () => {
    const router = buildRoutes({ reviewsController: makeReviewsController() });
    // reviews/routes.js: GET /product/:productId, use /user, GET /user,
    // POST /, PUT /:id, DELETE /:id, PUT /:id/helpful, GET /admin/all, PATCH /admin/:id/verify
    expect(router.stack.length).toBeGreaterThanOrEqual(7);
  });

  it('router là một function (Express middleware)', () => {
    const router = buildRoutes({ reviewsController: makeReviewsController() });
    expect(typeof router).toBe('function');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// src/modules/users/routes.js
// ════════════════════════════════════════════════════════════════════════════

describe('users/routes.js — factory tạo Express router hợp lệ', () => {
  let buildRoutes;

  beforeAll(() => {
    buildRoutes = require('../modules/users/routes');
  });

  function makeUsersController() {
    return {
      updateProfile: jest.fn(),
      changePassword: jest.fn(),
      getAddresses: jest.fn(),
      addAddress: jest.fn(),
      updateAddress: jest.fn(),
      deleteAddress: jest.fn(),
      setDefaultAddress: jest.fn(),
    };
  }

  it('trả về router khi được gọi với usersController hợp lệ', () => {
    const router = buildRoutes({ usersController: makeUsersController() });
    expect(router).toBeDefined();
    expect(router.stack).toBeDefined();
    expect(Array.isArray(router.stack)).toBe(true);
  });

  it('router có ít nhất 8 layer đã đăng ký (middleware authenticate + 7 routes)', () => {
    const router = buildRoutes({ usersController: makeUsersController() });
    // users/routes.js: use(authenticate) + PUT /profile, POST /change-password,
    // GET /addresses, POST /addresses, PUT /addresses/:id,
    // DELETE /addresses/:id, PATCH /addresses/:id/default
    expect(router.stack.length).toBeGreaterThanOrEqual(8);
  });

  it('router là một function (Express middleware)', () => {
    const router = buildRoutes({ usersController: makeUsersController() });
    expect(typeof router).toBe('function');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// src/modules/wishlist/routes.js
// ════════════════════════════════════════════════════════════════════════════

describe('wishlist/routes.js — factory tạo Express router hợp lệ', () => {
  let buildRoutes;

  beforeAll(() => {
    buildRoutes = require('../modules/wishlist/routes');
  });

  function makeWishlistController() {
    return {
      getWishlist: jest.fn(),
      addToWishlist: jest.fn(),
      checkWishlist: jest.fn(),
      removeFromWishlist: jest.fn(),
      clearWishlist: jest.fn(),
    };
  }

  it('trả về router khi được gọi với wishlistController hợp lệ', () => {
    const router = buildRoutes({ wishlistController: makeWishlistController() });
    expect(router).toBeDefined();
    expect(router.stack).toBeDefined();
    expect(Array.isArray(router.stack)).toBe(true);
  });

  it('router có ít nhất 6 layer đã đăng ký (authenticate + 5 routes)', () => {
    const router = buildRoutes({ wishlistController: makeWishlistController() });
    // wishlist/routes.js: use(authenticate) + GET /, POST /,
    // GET /check/:productId, DELETE /:productId, DELETE /
    expect(router.stack.length).toBeGreaterThanOrEqual(6);
  });

  it('router là một function (Express middleware)', () => {
    const router = buildRoutes({ wishlistController: makeWishlistController() });
    expect(typeof router).toBe('function');
  });
});

// ════════════════════════════════════════════════════════════════════════════
// src/modules/inventory/routes.js
// ════════════════════════════════════════════════════════════════════════════

describe('inventory/routes.js — factory tạo Express router hợp lệ', () => {
  let buildRoutes;

  beforeAll(() => {
    buildRoutes = require('../modules/inventory/routes');
  });

  function makeInventoryController() {
    return {
      restockProduct: jest.fn(),
      getInventoryLogs: jest.fn(),
    };
  }

  it('trả về router khi được gọi với inventoryController hợp lệ', () => {
    const router = buildRoutes({ inventoryController: makeInventoryController() });
    expect(router).toBeDefined();
    expect(router.stack).toBeDefined();
    expect(Array.isArray(router.stack)).toBe(true);
  });

  it('router có ít nhất 4 layer đã đăng ký (authenticate + authorize + 2 routes)', () => {
    const router = buildRoutes({ inventoryController: makeInventoryController() });
    // inventory/routes.js: use(authenticate), use(authorize('admin')),
    // POST /products/:productId/restock, GET /logs
    expect(router.stack.length).toBeGreaterThanOrEqual(4);
  });

  it('router là một function (Express middleware)', () => {
    const router = buildRoutes({ inventoryController: makeInventoryController() });
    expect(typeof router).toBe('function');
  });
});
