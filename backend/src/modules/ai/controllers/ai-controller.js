/**
 * @file aiController.js
 * @layer Controller
 * @module ai
 * @description Xử lý HTTP request/response cho ai
 */
const { t } = require('@utils/i18n');

class AIController {
  constructor({ aiService, logger }) {
    this.aiService = aiService;
    this.logger = logger;
    // SSE: sessionId → Set<res> — broadcast pipeline steps tới terminal đang watch
    this.sseClients = new Map();
  }

  // Ghi 1 SSE event tới tất cả clients của session, tự dọn client đã ngắt
  _sseWrite(sessionId, payload) {
    const clients = this.sseClients.get(sessionId);
    if (!clients?.size) return;
    const chunk = `data: ${JSON.stringify(payload)}\n\n`;
    for (const res of clients) {
      try {
        res.write(chunk);
      } catch {
        clients.delete(res);
      }
    }
    if (clients.size === 0) this.sseClients.delete(sessionId);
  }

  // SSE endpoint: terminal kết nối và nhận pipeline events real-time
  subscribeEvents = (req, res) => {
    const { sessionId } = req.query;
    if (!sessionId) {
      res.status(400).end();
      return;
    }
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    // Vô hiệu hóa socket timeout — tránh Node.js đóng SSE connection sau 5s idle
    req.socket?.setTimeout(0);
    res.write('data: {"type":"connected"}\n\n');
    if (!this.sseClients.has(sessionId)) this.sseClients.set(sessionId, new Set());
    this.sseClients.get(sessionId).add(res);
    // Heartbeat 5s — dưới keepAliveTimeout mặc định của Node.js HTTP server
    const heartbeat = setInterval(() => {
      try {
        res.write(': heartbeat\n\n');
      } catch {
        clearInterval(heartbeat);
      }
    }, 5000);
    req.on('close', () => {
      clearInterval(heartbeat);
      this.sseClients.get(sessionId)?.delete(res);
      if (this.sseClients.get(sessionId)?.size === 0) this.sseClients.delete(sessionId);
    });
  };

  handleMessage = async (req, res) => {
    try {
      const { message, sessionId } = req.body;
      const userId = req.user?.id ?? null; // chỉ trust JWT, không nhận userId từ body
      const returnTrace = req.query?.trace === 'true';
      this.logger.info('Chatbot', { messageLength: message.length, userId, sessionId });
      // Báo terminal biết query mới bắt đầu (trước khi bước 1 chạy)
      this._sseWrite(sessionId, { type: 'start', query: message });
      const data = await this.aiService.handleMessage({
        message,
        userId,
        sessionId,
        enableTrace: true,
        onStep: (step, stepData) =>
          this._sseWrite(sessionId, { type: 'step', step, data: stepData }),
      });
      // Gửi kết quả cuối để terminal hiển thị section KẾT QUẢ
      this._sseWrite(sessionId, {
        type: 'done',
        data: {
          response: data.response,
          products: data.products,
          suggestions: data.suggestions,
          intent: data.intent,
        },
      });
      if (!returnTrace) delete data.trace;
      res.json({ status: 'success', data });
    } catch (err) {
      // Báo terminal biết pipeline kết thúc do lỗi (không có done event)
      this._sseWrite(req.body?.sessionId, {
        type: 'error',
        data: { message: err.statusCode ? err.message : 'ai.messageFailed' },
      });
      // 400 = expected user error (validation) → WARN; 5xx = unexpected → ERROR
      if (err.statusCode) {
        const level = err.statusCode < 500 ? 'warn' : 'error';
        this.logger[level]('Chatbot error:', { statusCode: err.statusCode, message: err.message });
        return res.status(err.statusCode).json({
          status: 'error',
          message: t(err.message, req.locale) ?? t('ai.messageFailed', req.locale),
        });
      }
      this.logger.error('Lỗi chatbot:', err);
      res.status(500).json({
        status: 'error',
        message: t('ai.messageFailed', req.locale),
        data: {
          response: t('ai.fallbackResponse', req.locale),
          suggestions: [
            t('ai.suggestionsHot', req.locale),
            t('ai.suggestionsDeals', req.locale),
            t('ai.suggestionsSupport', req.locale),
          ],
        },
      });
    }
  };

  streamMessage = async (req, res) => {
    const { message, sessionId } = req.body;
    const userId = req.user?.id ?? null;
    res.setHeader('Content-Type', 'application/x-ndjson');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('X-Accel-Buffering', 'no');
    const write = (type, step, data) => {
      try {
        res.write(JSON.stringify({ type, step, data }) + '\n');
      } catch {
        /* client ngắt kết nối */
      }
    };
    try {
      this.logger.info('Chatbot stream', { messageLength: message.length, userId, sessionId });
      const result = await this.aiService.handleMessage({
        message,
        userId,
        sessionId,
        enableTrace: true,
        onStep: (step, data) => write('step', step, data),
      });
      write('done', null, {
        response: result.response,
        products: result.products,
        suggestions: result.suggestions,
        intent: result.intent,
      });
    } catch (err) {
      write('error', null, { message: err.statusCode ? err.message : 'ai.messageFailed' });
    } finally {
      res.end();
    }
  };

  clearSession = async (req, res, next) => {
    try {
      const { sessionId } = req.body;
      // Idempotent: always clear (DB + Map). 404 chỉ dùng cho session không tồn tại thật sự,
      // không dùng cho Map miss sau restart (DB rows vẫn được xóa bất kể Map state).
      await this.aiService.clearSession(sessionId);
      res.json({ status: 'success', message: t('ai.sessionCleared', req.locale) });
    } catch (err) {
      next(err);
    }
  };

  registerSession = async (req, res, next) => {
    try {
      const { sessionId } = req.body;
      this.aiService.registerSession(sessionId);
      // Ghi file tạm để demo script --watch detect session UI ngay lập tức
      try {
        const path = require('path');
        require('fs').writeFileSync(
          path.join(__dirname, '..', '..', '..', '..', 'data', '.last-session-id'),
          sessionId,
          'utf8',
        );
      } catch {
        /* ignore — chỉ ảnh hưởng demo script */
      }
      res.json({ status: 'success' });
    } catch (err) {
      next(err);
    }
  };

  getSessionMessages = async (req, res, next) => {
    try {
      const { sessionId } = req.params;
      // userId scope: authenticated users chỉ thấy messages của session mình; guest (null) không filter
      const userId = req.user?.id ?? null;
      const messages = await this.aiService.getSessionMessages(sessionId, userId);
      res.json({ status: 'success', data: { sessionId, messages } });
    } catch (err) {
      next(err);
    }
  };

  addToCart = async (req, res, next) => {
    try {
      const { productId, variantId, quantity = 1, sessionId } = req.body;
      const data = await this.aiService.addToCart({
        productId,
        variantId,
        quantity,
        sessionId,
        userId: req.user.id,
      });
      res.json({ status: 'success', data });
    } catch (err) {
      next(err);
    }
  };
}

module.exports = AIController;
