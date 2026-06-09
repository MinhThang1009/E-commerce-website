process.env.NODE_ENV = 'test';

jest.mock('@utils/logger', () => ({
  info: jest.fn(),
  debug: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
}));
jest.mock('@modules/admin/repositories/sequelize-admin-repository', () => {
  const { Op, Sequelize } = require('sequelize');
  return {
    getSequelize: () => ({ query: jest.fn() }),
    getOp: () => Op,
    getSequelizeFns: () => Sequelize,
    getModels: () => ({
      Product: {},
      ProductImage: {},
      ProductVariant: {},
      User: { __m: 'User' },
      Order: {},
      ChatMessage: {},
    }),
    aggregateOrders: jest.fn(),
    aggregateOrderItems: jest.fn(),
    aggregateUsers: jest.fn(),
    findProductsList: jest.fn(),
    countChatMessages: jest.fn(),
    aggregateChatMessagesAdv: jest.fn(),
    findOneChatMessage: jest.fn(),
  };
});

const repo = require('../repositories/sequelize-admin-repository');
const service = require('./admin-analytics-service');

function invoke(handler, req) {
  return new Promise((resolve) => {
    const headers = {};
    const res = {
      statusCode: undefined,
      payload: undefined,
      body: undefined,
      headers,
      status(c) {
        this.statusCode = c;
        return this;
      },
      json(b) {
        this.payload = b;
        resolve({ res: this });
        return this;
      },
      send(b) {
        this.body = b;
        resolve({ res: this });
        return this;
      },
      setHeader(k, v) {
        headers[k] = v;
      },
    };
    handler(req, res, (err) => resolve({ err }));
  });
}

describe('AdminAnalyticsService — branch coverage', () => {
  beforeEach(() => jest.clearAllMocks());

  test('exportReport: User null → customer/email empty, paymentMethod null', async () => {
    repo.aggregateOrders.mockResolvedValue([
      {
        toJSON: () => ({
          id: 1,
          number: null,
          status: 'pending',
          paymentStatus: 'pending',
          paymentMethod: null,
          total: 100000,
          createdAt: '2026-01-01T00:00:00Z',
          User: null,
        }),
      },
    ]);
    const { res } = await invoke(service.exportReport, { query: { type: 'orders' } });
    expect(res.body).toContain('""');
    expect(res.statusCode).toBe(200);
  });
});
