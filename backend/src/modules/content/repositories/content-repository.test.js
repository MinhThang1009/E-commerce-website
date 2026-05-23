// Tests cho SequelizeContentRepository — mock toàn bộ Sequelize models.
// Chỉ kiểm tra hành vi của repository: câu query nào được gọi, với args gì.
const SequelizeContentRepository = require('./sequelize-content-repository');

function makeFeedbackModel() {
  return { create: jest.fn() };
}

function makeRepo(overrides = {}) {
  return new SequelizeContentRepository({
    Feedback: overrides.Feedback || makeFeedbackModel(),
  });
}

describe('SequelizeContentRepository', () => {
  describe('createFeedback', () => {
    test('gọi Feedback.create với payload đúng', async () => {
      const Feedback = makeFeedbackModel();
      const newFeedback = { id: 1, name: 'A', status: 'pending' };
      Feedback.create.mockResolvedValue(newFeedback);
      const repo = makeRepo({ Feedback });

      const result = await repo.createFeedback({
        name: 'A',
        email: 'a@b',
        subject: 's',
        content: 'c',
        status: 'pending',
      });

      expect(Feedback.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'A', status: 'pending' }),
      );
      expect(result).toBe(newFeedback);
    });
  });
});
