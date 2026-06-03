// Unit tests cho ContentService — chỉ còn contact/feedback.
const ContentService = require('./content-service');

describe('ContentService', () => {
  let contentRepository;
  let emailGateway;
  let service;

  beforeEach(() => {
    contentRepository = {
      createFeedback: jest.fn(),
    };
    emailGateway = {
      sendAdminFeedbackNotification: jest.fn().mockResolvedValue(),
    };
    service = new ContentService({
      contentRepository,
      emailGateway,
      eventBus: { publish: jest.fn() },
      logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
      adminEmail: 'admin@test.com',
    });
  });

  describe('Feedback', () => {
    test('thiếu field → 400', async () => {
      await expect(
        service.sendFeedback({ payload: { name: 'A', email: 'a@b' } }),
      ).rejects.toMatchObject({ statusCode: 400 });
    });

    test('hợp lệ → tạo feedback + gửi admin notification', async () => {
      contentRepository.createFeedback.mockResolvedValue({ id: 1 });
      const result = await service.sendFeedback({
        payload: {
          name: 'A',
          email: 'a@b.c',
          subject: 's',
          content: 'c',
        },
      });
      expect(result.id).toBe(1);
      expect(contentRepository.createFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'A', status: 'pending' }),
      );
      expect(emailGateway.sendAdminFeedbackNotification).toHaveBeenCalledWith(
        'admin@test.com',
        expect.objectContaining({ name: 'A' }),
      );
    });

    test('không gọi admin notification khi adminEmail không được cấu hình', async () => {
      const svcNoAdmin = new ContentService({
        contentRepository,
        emailGateway,
        eventBus: { publish: jest.fn() },
        logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
        adminEmail: null,
      });
      contentRepository.createFeedback.mockResolvedValue({ id: 2 });
      await svcNoAdmin.sendFeedback({
        payload: { name: 'B', email: 'b@c.d', subject: 'sub', content: 'con' },
      });
      expect(emailGateway.sendAdminFeedbackNotification).not.toHaveBeenCalled();
    });

    test('sendFeedback kèm phone → lưu phone', async () => {
      contentRepository.createFeedback.mockResolvedValue({ id: 3 });
      await service.sendFeedback({
        payload: { name: 'C', email: 'c@d.e', phone: '0901234567', subject: 'sub', content: 'con' },
      });
      expect(contentRepository.createFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ phone: '0901234567' }),
      );
    });

    test('sendAdminFeedbackNotification thất bại → không throw (fire-and-forget catch)', async () => {
      contentRepository.createFeedback.mockResolvedValue({ id: 1 });
      emailGateway.sendAdminFeedbackNotification.mockRejectedValue(new Error('smtp error'));

      const result = await service.sendFeedback({
        payload: {
          name: 'Nguyễn',
          email: 'ng@test.com',
          phone: '0123',
          subject: 'Góp ý',
          content: 'Nội dung',
        },
      });

      expect(result).toBeDefined();
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(service.logger.error).toHaveBeenCalledWith(
        expect.stringContaining('email thông báo phản hồi'),
        expect.any(String),
      );
    });
  });

  // ── mutation-kill: từng field required riêng lẻ + message ──────
  describe('sendFeedback — validation từng field (mutation kill)', () => {
    const full = { name: 'A', email: 'a@b.c', subject: 's', content: 'c' };

    test.each([['name'], ['email'], ['subject'], ['content']])(
      'thiếu %s → throw content.requiredFieldsMissing 400',
      async (field) => {
        const payload = { ...full };
        delete payload[field];
        await expect(service.sendFeedback({ payload })).rejects.toThrow(
          'content.requiredFieldsMissing',
        );
        expect(contentRepository.createFeedback).not.toHaveBeenCalled();
      },
    );

    test('đủ 4 field bắt buộc → KHÔNG throw, tạo feedback', async () => {
      contentRepository.createFeedback.mockResolvedValue({ id: 9 });
      const result = await service.sendFeedback({ payload: full });
      expect(result.id).toBe(9);
      expect(contentRepository.createFeedback).toHaveBeenCalledTimes(1);
    });
  });
});
