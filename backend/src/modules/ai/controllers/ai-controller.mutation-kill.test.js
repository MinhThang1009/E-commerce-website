/**
 * ai-controller.mutation-kill.test.js
 *
 * Bổ sung cho ai-controller.test.js — kill mutant bằng assert OUTCOME đầy đủ:
 *   - Validation message (LogicalOperator `||`, typeof check, block body)
 *   - 400 body: status + message dịch chuẩn
 *   - logger.info / logger.warn / logger.error nội dung + meta
 *   - Arg truyền cho aiService.handleMessage
 *   - 500 fallback body đầy đủ (message + response + 3 suggestions)
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

  // Guard !message đã bị xóa — Zod chatMessageSchema (route layer) chặn trước khi vào controller.
  // Test này verify controller forward thẳng vào service khi message hợp lệ.
  describe('controller không có manual validation guard (Zod ở route layer)', () => {
    it('message hợp lệ → gọi aiService.handleMessage, không có guard ở controller', async () => {
      aiService.handleMessage.mockResolvedValue({ response: 'ok', suggestions: [] });
      const req = { body: { message: 'Mua laptop', sessionId: 's' }, user: { id: 1 } };
      const res = makeRes();
      await controller.handleMessage(req, res, jest.fn());
      expect(aiService.handleMessage).toHaveBeenCalled();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // handleMessage — happy path: logger.info + arg service
  // ──────────────────────────────────────────────────────────────

  describe('happy path → log info + truyền đúng arg cho service', () => {
    it('gọi logger.info("Chatbot", meta) và aiService.handleMessage đúng arg', async () => {
      aiService.handleMessage.mockResolvedValue({ response: 'ok', suggestions: [] });
      const req = { body: { message: 'Mua laptop', sessionId: 'sess-9' }, user: { id: 9 } };
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
        enableTrace: true,
        onStep: expect.any(Function),
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

      expect(logger.warn).toHaveBeenCalledWith('Chatbot error:', {
        statusCode: 400,
        message: 'Tin nhắn quá dài',
      });
      expect(res.status).toHaveBeenCalledWith(400);
      // t('Tin nhắn quá dài') = null → fallback t('ai.messageFailed')
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }));
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
});
