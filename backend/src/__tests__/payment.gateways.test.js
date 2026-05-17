/**
 * payment.gateways.test.js
 *
 * Tests cho payment gateway adapters:
 *   - src/modules/payment/infrastructure/VnPayGateway.js
 *   - src/modules/payment/infrastructure/MomoGateway.js
 *
 * Strategy: khởi tạo gateway với mock service, gọi từng method và kiểm tra
 * delegate đúng sang service tương ứng.
 */

process.env.NODE_ENV = 'test';

const VnPayGateway = require('../modules/payment/infrastructure/VnPayGateway');
const MomoGateway = require('../modules/payment/infrastructure/MomoGateway');

// ════════════════════════════════════════════════════════════════════════════
// VnPayGateway
// ════════════════════════════════════════════════════════════════════════════

describe('VnPayGateway', () => {
  let vnpayService;
  let gateway;

  beforeEach(() => {
    vnpayService = {
      createPaymentUrl: jest.fn().mockResolvedValue('https://vnpay.vn/pay?token=abc'),
      verifyReturnUrl: jest.fn().mockReturnValue({ isValid: true, responseCode: '00' }),
      refund: jest.fn().mockResolvedValue({ transactionId: 'refund-123', status: 'success' }),
    };
    gateway = new VnPayGateway({ vnpayService });
  });

  describe('createPaymentUrl', () => {
    it('delegate sang vnpayService.createPaymentUrl với cùng input', async () => {
      const input = { orderId: 42, amount: 150000, returnUrl: 'https://shop.com/return' };
      const result = await gateway.createPaymentUrl(input);

      expect(vnpayService.createPaymentUrl).toHaveBeenCalledWith(input);
      expect(result).toBe('https://vnpay.vn/pay?token=abc');
    });

    it('trả về kết quả từ vnpayService.createPaymentUrl', async () => {
      vnpayService.createPaymentUrl.mockResolvedValue('https://vnpay.vn/pay?token=xyz');
      const result = await gateway.createPaymentUrl({ orderId: 1 });
      expect(result).toBe('https://vnpay.vn/pay?token=xyz');
    });
  });

  describe('verifyReturnUrl', () => {
    it('delegate sang vnpayService.verifyReturnUrl với cùng params', () => {
      const params = { vnp_ResponseCode: '00', vnp_TxnRef: 'ORD-001' };
      const result = gateway.verifyReturnUrl(params);

      expect(vnpayService.verifyReturnUrl).toHaveBeenCalledWith(params);
      expect(result).toEqual({ isValid: true, responseCode: '00' });
    });

    it('trả về kết quả xác minh thất bại khi service báo lỗi', () => {
      vnpayService.verifyReturnUrl.mockReturnValue({ isValid: false, responseCode: '99' });
      const result = gateway.verifyReturnUrl({ vnp_ResponseCode: '99' });
      expect(result.isValid).toBe(false);
    });
  });

  describe('refund', () => {
    it('delegate sang vnpayService.refund với cùng input', async () => {
      const input = { orderId: 10, amount: 50000, transactionId: 'txn-001' };
      const result = await gateway.refund(input);

      expect(vnpayService.refund).toHaveBeenCalledWith(input);
      expect(result).toEqual({ transactionId: 'refund-123', status: 'success' });
    });

    it('propagate rejection từ vnpayService.refund', async () => {
      vnpayService.refund.mockRejectedValue(new Error('Refund failed'));
      await expect(gateway.refund({ orderId: 10 })).rejects.toThrow('Refund failed');
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// MomoGateway
// ════════════════════════════════════════════════════════════════════════════

describe('MomoGateway', () => {
  let momoService;
  let gateway;

  beforeEach(() => {
    momoService = {
      createPaymentUrl: jest.fn().mockResolvedValue('https://momo.vn/pay?token=momo123'),
      verifySignature: jest.fn().mockReturnValue(true),
    };
    gateway = new MomoGateway({ momoService });
  });

  describe('createPaymentUrl', () => {
    it('delegate sang momoService.createPaymentUrl với cùng input', async () => {
      const input = { orderId: 7, amount: 200000 };
      const result = await gateway.createPaymentUrl(input);

      expect(momoService.createPaymentUrl).toHaveBeenCalledWith(input);
      expect(result).toBe('https://momo.vn/pay?token=momo123');
    });

    it('trả về kết quả từ momoService.createPaymentUrl', async () => {
      momoService.createPaymentUrl.mockResolvedValue('https://momo.vn/pay?token=new');
      const result = await gateway.createPaymentUrl({ orderId: 8 });
      expect(result).toBe('https://momo.vn/pay?token=new');
    });

    it('propagate rejection từ momoService.createPaymentUrl', async () => {
      momoService.createPaymentUrl.mockRejectedValue(new Error('MoMo API error'));
      await expect(gateway.createPaymentUrl({ orderId: 9 })).rejects.toThrow('MoMo API error');
    });
  });

  describe('verifySignature', () => {
    it('delegate sang momoService.verifySignature với cùng payload', () => {
      const payload = { orderId: '7', signature: 'abc123' };
      const result = gateway.verifySignature(payload);

      expect(momoService.verifySignature).toHaveBeenCalledWith(payload);
      expect(result).toBe(true);
    });

    it('trả về false khi signature không hợp lệ', () => {
      momoService.verifySignature.mockReturnValue(false);
      const result = gateway.verifySignature({ orderId: '7', signature: 'wrong' });
      expect(result).toBe(false);
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// IPaymentGateway — abstract base class
// ════════════════════════════════════════════════════════════════════════════

describe('IPaymentGateway — các method chưa implement đều throw', () => {
  const IPaymentGateway = require('../modules/payment/domain/ports/IPaymentGateway');

  let base;

  beforeEach(() => {
    base = new IPaymentGateway();
  });

  it('createPaymentUrl ném lỗi "not implemented"', async () => {
    await expect(base.createPaymentUrl({})).rejects.toThrow('not implemented by this gateway');
  });

  it('verifySignature ném lỗi "not implemented"', () => {
    expect(() => base.verifySignature({})).toThrow('not implemented by this gateway');
  });

  it('verifyReturnUrl ném lỗi "not implemented"', () => {
    expect(() => base.verifyReturnUrl({})).toThrow('not implemented by this gateway');
  });

  it('refund ném lỗi "not implemented"', async () => {
    await expect(base.refund({})).rejects.toThrow('not implemented by this gateway');
  });
});
