// Phase 42.15 — Unit tests cho AI domain (AiPolicy + RagPipeline).
const AiPolicy = require('../modules/ai/domain/policies/AiPolicy');
const RagPipeline = require('../modules/ai/domain/orchestrators/RagPipeline');

describe('AI Domain', () => {
  describe('AiPolicy.validateMessage', () => {
    test('rỗng → invalid', () => {
      expect(AiPolicy.validateMessage('').valid).toBe(false);
      expect(AiPolicy.validateMessage('   ').valid).toBe(false);
      expect(AiPolicy.validateMessage(null).valid).toBe(false);
    });

    test('ngắn hợp lệ → valid', () => {
      expect(AiPolicy.validateMessage('hello')).toEqual({ valid: true });
    });

    test('quá dài (>2000) → invalid', () => {
      const long = 'a'.repeat(2001);
      const result = AiPolicy.validateMessage(long);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/quá dài/);
    });

    test('exact 2000 ký tự → valid', () => {
      expect(AiPolicy.validateMessage('a'.repeat(2000))).toEqual({ valid: true });
    });
  });

  describe('RagPipeline', () => {
    test('throw nếu thiếu llmGateway', () => {
      expect(() => new RagPipeline({})).toThrow();
    });

    test('validation fail → 400', async () => {
      const llmGateway = { handleMessage: jest.fn() };
      const pipeline = new RagPipeline({ llmGateway });
      await expect(
        pipeline.run({ message: '' })
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(llmGateway.handleMessage).not.toHaveBeenCalled();
    });

    test('valid → delegate llmGateway.handleMessage', async () => {
      const llmGateway = { handleMessage: jest.fn().mockResolvedValue({ response: 'hi' }) };
      const pipeline = new RagPipeline({ llmGateway });
      const result = await pipeline.run({ message: 'hello', userId: 5, sessionId: 'X', context: {} });
      expect(llmGateway.handleMessage).toHaveBeenCalledWith('hello', 5, 'X', {});
      expect(result.response).toBe('hi');
    });
  });
});
