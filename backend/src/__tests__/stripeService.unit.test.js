/**
 * Phase 44 — Unit tests cho StripeService (services/payment/stripe.js)
 * Mục tiêu: cover logic riêng của service (amount conversion, error wrap, signature verify)
 * KHÔNG hit HTTP layer (đó là integration test trong payment.phase25.test.js).
 */

// Set env trước khi require service (Stripe init dùng STRIPE_SECRET_KEY)
process.env.STRIPE_SECRET_KEY = 'sk_test_unit_test_dummy_key';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy';

// Mock logger để không spam stdout
jest.mock('../utils/logger', () => ({
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

// Mock stripe SDK — return controllable factory
const mockStripeSdk = {
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
  customers: {
    create: jest.fn(),
    retrieve: jest.fn(),
  },
  refunds: {
    create: jest.fn(),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
  paymentMethods: {
    list: jest.fn(),
  },
  setupIntents: {
    create: jest.fn(),
  },
};

jest.mock('stripe', () => jest.fn(() => mockStripeSdk));

const stripeService = require('../services/payment/stripe');
const { AppError } = require('../middlewares/errorHandler');

beforeEach(() => {
  // Reset mock call history giữa các test (clearMocks: true trong jest.config nhưng explicit để rõ)
  Object.values(mockStripeSdk).forEach((group) => {
    Object.values(group).forEach((fn) => {
      if (typeof fn === 'function' && fn.mockReset) fn.mockReset();
    });
  });
});

describe('StripeService.createPaymentIntent', () => {
  test('USD: nhân 100 chuyển dollar → cent', async () => {
    mockStripeSdk.paymentIntents.create.mockResolvedValue({
      id: 'pi_test_123',
      client_secret: 'pi_test_123_secret',
    });

    const result = await stripeService.createPaymentIntent({
      amount: 12.34,
      currency: 'usd',
    });

    expect(mockStripeSdk.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 1234, // 12.34 * 100 = 1234 cent
        currency: 'usd',
      })
    );
    expect(result).toEqual({
      clientSecret: 'pi_test_123_secret',
      paymentIntentId: 'pi_test_123',
    });
  });

  test('VND: KHÔNG nhân 100 (Stripe VND nguyên đồng)', async () => {
    mockStripeSdk.paymentIntents.create.mockResolvedValue({
      id: 'pi_vnd_456',
      client_secret: 'secret_456',
    });

    await stripeService.createPaymentIntent({
      amount: 100000,
      currency: 'vnd',
    });

    expect(mockStripeSdk.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({
        amount: 100000, // VND giữ nguyên không * 100
        currency: 'vnd',
      })
    );
  });

  test('default currency = usd khi không truyền', async () => {
    mockStripeSdk.paymentIntents.create.mockResolvedValue({
      id: 'pi_x',
      client_secret: 'sec_x',
    });

    await stripeService.createPaymentIntent({ amount: 5 });

    expect(mockStripeSdk.paymentIntents.create).toHaveBeenCalledWith(
      expect.objectContaining({ currency: 'usd', amount: 500 })
    );
  });

  test('Stripe error → wrap thành AppError 500', async () => {
    mockStripeSdk.paymentIntents.create.mockRejectedValue(
      new Error('Card declined')
    );

    await expect(
      stripeService.createPaymentIntent({ amount: 10, currency: 'usd' })
    ).rejects.toMatchObject({
      message: expect.stringContaining('Card declined'),
      statusCode: 500,
    });
  });
});

describe('StripeService.createRefund', () => {
  test('Có amount → nhân 100 chuyển cent', async () => {
    mockStripeSdk.refunds.create.mockResolvedValue({
      id: 're_test_1',
      status: 'succeeded',
    });

    await stripeService.createRefund({
      paymentIntentId: 'pi_x',
      amount: 25.5,
      reason: 'duplicate',
    });

    expect(mockStripeSdk.refunds.create).toHaveBeenCalledWith({
      payment_intent: 'pi_x',
      reason: 'duplicate',
      amount: 2550, // 25.5 * 100 = 2550 cent
    });
  });

  test('Không truyền amount → full refund (không có field amount)', async () => {
    mockStripeSdk.refunds.create.mockResolvedValue({
      id: 're_full',
      status: 'succeeded',
    });

    await stripeService.createRefund({
      paymentIntentId: 'pi_y',
    });

    const call = mockStripeSdk.refunds.create.mock.calls[0][0];
    expect(call.payment_intent).toBe('pi_y');
    expect(call).not.toHaveProperty('amount');
    expect(call.reason).toBe('requested_by_customer'); // default reason
  });

  test('Stripe error → wrap thành AppError 500', async () => {
    mockStripeSdk.refunds.create.mockRejectedValue(new Error('No such PI'));

    await expect(
      stripeService.createRefund({ paymentIntentId: 'pi_bad' })
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe('StripeService.handleWebhook', () => {
  test('Signature hợp lệ → return event object', async () => {
    const mockEvent = { id: 'evt_1', type: 'payment_intent.succeeded' };
    mockStripeSdk.webhooks.constructEvent.mockReturnValue(mockEvent);

    const result = await stripeService.handleWebhook(
      'raw_payload',
      'sig_header'
    );

    expect(mockStripeSdk.webhooks.constructEvent).toHaveBeenCalledWith(
      'raw_payload',
      'sig_header',
      'whsec_test_dummy'
    );
    expect(result).toEqual(mockEvent);
  });

  test('Signature invalid → AppError 400', async () => {
    mockStripeSdk.webhooks.constructEvent.mockImplementation(() => {
      throw new Error('Invalid signature');
    });

    await expect(
      stripeService.handleWebhook('payload', 'bad_sig')
    ).rejects.toMatchObject({
      message: 'Invalid webhook signature',
      statusCode: 400,
    });
  });
});

describe('StripeService.createCustomer', () => {
  test('Pass email + name + metadata vào Stripe', async () => {
    mockStripeSdk.customers.create.mockResolvedValue({
      id: 'cus_1',
      email: 'a@b.com',
    });

    await stripeService.createCustomer({
      email: 'a@b.com',
      name: 'Test User',
      metadata: { userId: '42' },
    });

    expect(mockStripeSdk.customers.create).toHaveBeenCalledWith({
      email: 'a@b.com',
      name: 'Test User',
      metadata: { userId: '42' },
    });
  });

  test('Stripe error → wrap thành AppError', async () => {
    mockStripeSdk.customers.create.mockRejectedValue(new Error('Email exists'));

    await expect(
      stripeService.createCustomer({ email: 'x@y.com', name: 'X' })
    ).rejects.toBeInstanceOf(AppError);
  });
});

describe('StripeService.createSetupIntent', () => {
  test('Pass customer_id + filter card type', async () => {
    mockStripeSdk.setupIntents.create.mockResolvedValue({
      id: 'seti_1',
      client_secret: 'seti_secret',
    });

    const result = await stripeService.createSetupIntent('cus_42');

    expect(mockStripeSdk.setupIntents.create).toHaveBeenCalledWith({
      customer: 'cus_42',
      payment_method_types: ['card'],
    });
    expect(result).toEqual({
      clientSecret: 'seti_secret',
      setupIntentId: 'seti_1',
    });
  });
});
