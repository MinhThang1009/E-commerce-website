// Phase 42.12 — Unit tests cho Payment domain layer (PaymentPolicy).
const PaymentPolicy = require('./policies/PaymentPolicy');

describe('Payment Domain', () => {
  describe('PaymentPolicy.canProcessPayment', () => {
    test('order null → false', () => {
      expect(PaymentPolicy.canProcessPayment(null, 'tx-1')).toBe(false);
    });

    test('paymentStatus=paid → false (idempotent)', () => {
      expect(PaymentPolicy.canProcessPayment(
        { paymentStatus: 'paid' }, 'tx-1'
      )).toBe(false);
    });

    test('cùng transactionId đã xử lý → false', () => {
      expect(PaymentPolicy.canProcessPayment(
        { paymentStatus: 'pending', paymentTransactionId: 'tx-1' }, 'tx-1'
      )).toBe(false);
    });

    test('order pending + transactionId mới → true', () => {
      expect(PaymentPolicy.canProcessPayment(
        { paymentStatus: 'pending', paymentTransactionId: null }, 'tx-1'
      )).toBe(true);
    });

    test('order failed + transactionId mới → true (retry)', () => {
      expect(PaymentPolicy.canProcessPayment(
        { paymentStatus: 'failed', paymentTransactionId: 'old' }, 'tx-2'
      )).toBe(true);
    });

    test('transactionId null → bỏ qua check ID, chỉ check paymentStatus', () => {
      expect(PaymentPolicy.canProcessPayment(
        { paymentStatus: 'pending', paymentTransactionId: 'something' }, null
      )).toBe(true);
    });
  });

  describe('PaymentPolicy.canRefund', () => {
    test('order null → not allowed', () => {
      const result = PaymentPolicy.canRefund(null);
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/Không tìm thấy đơn hàng/);
    });

    test('paymentStatus=refunded → not allowed (chặn double refund)', () => {
      const result = PaymentPolicy.canRefund({ paymentStatus: 'refunded' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/đã được hoàn tiền/);
    });

    test('paymentStatus=pending → not allowed', () => {
      const result = PaymentPolicy.canRefund({ paymentStatus: 'pending', paymentTransactionId: 'tx-1' });
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/đã thanh toán/);
    });

    test('không có paymentTransactionId → not allowed', () => {
      const result = PaymentPolicy.canRefund({ paymentStatus: 'paid', paymentTransactionId: null });
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/giao dịch thanh toán/);
    });

    test('provider=momo → not supported', () => {
      const result = PaymentPolicy.canRefund({
        paymentStatus: 'paid',
        paymentTransactionId: 'tx-1',
        paymentProvider: 'momo',
      });
      expect(result.allowed).toBe(false);
      expect(result.reason).toMatch(/momo/);
    });

    test('provider=vnpay + paid → allowed', () => {
      expect(PaymentPolicy.canRefund({
        paymentStatus: 'paid',
        paymentTransactionId: 'tx-1', paymentProvider: 'vnpay',
      })).toEqual({ allowed: true });
    });
  });

  describe('SUPPORTED_REFUND_PROVIDERS', () => {
    test('liệt kê vnpay', () => {
      expect(PaymentPolicy.SUPPORTED_REFUND_PROVIDERS).toEqual(
        expect.arrayContaining(['vnpay'])
      );
      expect(PaymentPolicy.SUPPORTED_REFUND_PROVIDERS).not.toContain('stripe');
    });
  });
});
