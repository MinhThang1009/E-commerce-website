/**
 * @file email.en.test.js
 * @description Covers dateLocale('en') branch (line 29) in email.js.
 */

process.env.NODE_ENV = 'test';
process.env.EMAIL_HOST = 'smtp.example.com';
process.env.EMAIL_USERNAME = 'test@example.com';
process.env.EMAIL_PASSWORD = 'pass';
process.env.EMAIL_FROM = 'no-reply@example.com';
process.env.EMAIL_FROM_NAME = 'TestStore';
process.env.FRONTEND_URL = 'https://test.example.com';

const mockSendMail = jest.fn().mockResolvedValue({ messageId: 'en-001' });
jest.mock('nodemailer', () => ({ createTransport: jest.fn(() => ({ sendMail: mockSendMail })) }));
jest.mock('@utils/logger', () => ({ info: jest.fn(), error: jest.fn(), warn: jest.fn() }));

const emailService = require('./email');

afterEach(() => jest.clearAllMocks());

const baseOrder = {
  orderNumber: 'ORD-001',
  orderDate: new Date('2024-01-01'),
  subtotal: 450000,
  shippingCost: 50000,
  total: 500000,
  items: [{ name: 'iPhone 15', quantity: 1, price: 450000, subtotal: 450000 }],
  shippingAddress: {
    name: 'John',
    address1: '123 Main',
    address2: null,
    city: 'HCM',
    state: 'HCM',
    zip: '700000',
    country: 'VN',
  },
  estimatedDelivery: null,
};

describe('email.js — dateLocale English branch (line 29)', () => {
  test('sendOrderConfirmationEmail với lang=en → dateLocale("en") → "en-US"', async () => {
    await emailService.sendOrderConfirmationEmail('user@test.com', baseOrder, 'en');
    expect(mockSendMail).toHaveBeenCalled();
  });
  test('sendOrderStatusUpdateEmail với lang=en', async () => {
    await emailService.sendOrderStatusUpdateEmail(
      'user@test.com',
      { orderNumber: 'ORD-002', orderDate: new Date(), status: 'delivered' },
      'en',
    );
    expect(mockSendMail).toHaveBeenCalled();
  });
  test('sendOrderCancellationEmail với lang=en', async () => {
    await emailService.sendOrderCancellationEmail(
      'user@test.com',
      { orderNumber: 'ORD-003', orderDate: new Date() },
      'en',
    );
    expect(mockSendMail).toHaveBeenCalled();
  });
});
