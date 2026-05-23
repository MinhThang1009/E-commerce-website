// Unit tests cho ContentController — chỉ còn contact/feedback.
const ContentController = require('./content-controller');

function makeRes() {
  const res = {
    _status: 200,
    _body: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(body) {
      this._body = body;
      return this;
    },
  };
  return res;
}

function makeReq(overrides = {}) {
  return {
    params: {},
    query: {},
    body: {},
    user: undefined,
    ...overrides,
  };
}

let contentService;
let controller;

beforeEach(() => {
  contentService = {
    sendFeedback: jest.fn(),
  };
  controller = new ContentController({ contentService });
});

describe('ContentController — Feedback', () => {
  describe('sendFeedback', () => {
    it('trả 201 với message cảm ơn và data feedback', async () => {
      const feedbackRecord = { id: 1, name: 'Nguyễn Văn A', message: 'Sản phẩm tốt' };
      contentService.sendFeedback.mockResolvedValue(feedbackRecord);

      const req = makeReq({
        body: { name: 'Nguyễn Văn A', email: 'a@test.com', message: 'Sản phẩm tốt' },
      });
      const res = makeRes();
      const next = jest.fn();

      await controller.sendFeedback(req, res, next);

      expect(contentService.sendFeedback).toHaveBeenCalledWith({ payload: req.body });
      expect(res._status).toBe(201);
      expect(res._body.status).toBe('success');
      expect(res._body.message).toContain('Cảm ơn');
      expect(res._body.data).toEqual(feedbackRecord);
      expect(next).not.toHaveBeenCalled();
    });

    it('gọi next(err) khi service ném lỗi', async () => {
      contentService.sendFeedback.mockRejectedValue(new Error('lưu thất bại'));

      const next = jest.fn();
      await controller.sendFeedback(makeReq({ body: {} }), makeRes(), next);

      expect(next).toHaveBeenCalled();
    });
  });
});
