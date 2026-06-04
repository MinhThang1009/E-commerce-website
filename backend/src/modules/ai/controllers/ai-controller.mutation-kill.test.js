/**
 * ai-controller.mutation-kill.test.js
 *
 * Bổ sung cho ai-controller.test.js — kill mutant bằng assert OUTCOME đầy đủ:
 *   - Validation message (LogicalOperator `||`, typeof check, block body)
 *   - 400 body: status + message dịch chuẩn
 *   - logger.info / logger.warn / logger.error nội dung + meta
 *   - Arg truyền cho aiService.handleMessage
 *   - 500 fallback body đầy đủ (message + response + 3 suggestions)
 *   - trackAnalytics success message
 *
 * Dùng `t()` thật (không mock) → assert giá trị dịch vi chính xác.
 */

const AIController = require('./ai-controller');

function makeRes() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function makeLogger() {
  return { info: jest.fn(), error: jest.fn(), warn: jest.fn() };
}

function makeService() {
  return {
    handleMessage: jest.fn(),
    getRecommendations: jest.fn(),
    trackAnalytics: jest.fn(),
    addToCart: jest.fn(),
  };
}

describe('AIController — mutation kill', () => {
  let controller;
  let aiService;
  let logger;

  beforeEach(() => {
    aiService = makeService();
    logger = makeLogger();
    controller = new AIController({ aiService, logger });
  });

  // ──────────────────────────────────────────────────────────────
  // handleMessage — validation guard `if (!message || typeof !== 'string')`
  // ──────────────────────────────────────────────────────────────

  describe('validation message không hợp lệ → 400, không gọi service', () => {
    it('message rỗng "" → 400 với body lỗi chuẩn', async () => {
      const req = { body: { message: '', userId: 1, sessionId: 's' } };
      const res = makeRes();
      await controller.handleMessage(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Tin nhắn không hợp lệ',
      });
      expect(aiService.handleMessage).not.toHaveBeenCalled();
    });

    it('message là số (truthy nhưng không phải string) → 400 (kill `||`→`&&` + typeof)', async () => {
      const req = { body: { message: 123, userId: 1, sessionId: 's' } };
      const res = makeRes();
      await controller.handleMessage(req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Tin nhắn không hợp lệ',
      });
      expect(aiService.handleMessage).not.toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // handleMessage — happy path: logger.info + arg service
  // ──────────────────────────────────────────────────────────────

  describe('happy path → log info + truyền đúng arg cho service', () => {
    it('gọi logger.info("Chatbot", meta) và aiService.handleMessage đúng arg', async () => {
      aiService.handleMessage.mockResolvedValue({ response: 'ok', suggestions: [] });
      const req = { body: { message: 'Mua laptop', userId: 9, sessionId: 'sess-9' } };
      const res = makeRes();
      await controller.handleMessage(req, res, jest.fn());

      expect(logger.info).toHaveBeenCalledWith('Chatbot', {
        messageLength: 'Mua laptop'.length,
        userId: 9,
        sessionId: 'sess-9',
      });
      expect(aiService.handleMessage).toHaveBeenCalledWith({
        message: 'Mua laptop',
        userId: 9,
        sessionId: 'sess-9',
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // handleMessage — 400 từ service: logger.warn meta
  // ──────────────────────────────────────────────────────────────

  describe('service throw 400 → logger.warn kèm err.message', () => {
    it('warn meta chứa message của lỗi', async () => {
      const err = new Error('Tin nhắn quá dài');
      err.statusCode = 400;
      aiService.handleMessage.mockRejectedValue(err);
      const req = { body: { message: 'câu hỏi hợp lệ', userId: 1, sessionId: 's' } };
      const res = makeRes();
      await controller.handleMessage(req, res, jest.fn());

      expect(logger.warn).toHaveBeenCalledWith('Chatbot input không hợp lệ:', {
        message: 'Tin nhắn quá dài',
      });
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ status: 'error', message: 'Tin nhắn quá dài' });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // handleMessage — 500 fallback: logger.error + body đầy đủ
  // ──────────────────────────────────────────────────────────────

  describe('service throw lỗi generic → 500 fallback đầy đủ', () => {
    it('logger.error("Lỗi chatbot:", err) + body có response + 3 suggestions dịch chuẩn', async () => {
      const err = new Error('DB down');
      aiService.handleMessage.mockRejectedValue(err);
      const req = { body: { message: 'Xin chào', userId: 1, sessionId: 's' } };
      const res = makeRes();
      await controller.handleMessage(req, res, jest.fn());

      expect(logger.error).toHaveBeenCalledWith('Lỗi chatbot:', err);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        status: 'error',
        message: 'Xử lý tin nhắn thất bại',
        data: {
          response: 'Xin lỗi, tôi đang gặp một chút vấn đề. Vui lòng thử lại sau ít phút nhé!',
          suggestions: ['Xem sản phẩm hot', 'Tìm khuyến mãi', 'Liên hệ hỗ trợ'],
        },
      });
    });
  });

  // ──────────────────────────────────────────────────────────────
  // trackAnalytics — success message dịch chuẩn
  // ──────────────────────────────────────────────────────────────

  describe('trackAnalytics success message', () => {
    it('trả message "Ghi nhận dữ liệu phân tích thành công"', async () => {
      aiService.trackAnalytics.mockResolvedValue();
      const req = { body: { event: 'view', userId: 1, sessionId: 's' } };
      const res = makeRes();
      await controller.trackAnalytics(req, res, jest.fn());

      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        message: 'Ghi nhận dữ liệu phân tích thành công',
      });
    });
  });
});
