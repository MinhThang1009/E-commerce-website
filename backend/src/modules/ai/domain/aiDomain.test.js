// Phase 42.15 — Unit tests cho AI domain (AIPolicy + RAGPipeline).
const AIPolicy = require('../domain/policies/AIPolicy');
const RAGPipeline = require('../domain/orchestrators/RAGPipeline');

describe('AI Domain', () => {
  describe('AIPolicy.validateMessage', () => {
    test('rỗng → invalid', () => {
      expect(AIPolicy.validateMessage('').valid).toBe(false);
      expect(AIPolicy.validateMessage('   ').valid).toBe(false);
      expect(AIPolicy.validateMessage(null).valid).toBe(false);
    });

    test('ngắn hợp lệ → valid', () => {
      expect(AIPolicy.validateMessage('hello')).toEqual({ valid: true });
    });

    test('quá dài (>2000) → invalid', () => {
      const long = 'a'.repeat(2001);
      const result = AIPolicy.validateMessage(long);
      expect(result.valid).toBe(false);
      expect(result.reason).toMatch(/quá dài/);
    });

    test('exact 2000 ký tự → valid', () => {
      expect(AIPolicy.validateMessage('a'.repeat(2000))).toEqual({ valid: true });
    });
  });

  describe('RAGPipeline', () => {
    test('throw nếu thiếu llmGateway', () => {
      expect(() => new RAGPipeline({})).toThrow();
    });

    test('validation fail → 400', async () => {
      const llmGateway = { handleMessage: jest.fn() };
      const pipeline = new RAGPipeline({ llmGateway });
      await expect(
        pipeline.run({ message: '' })
      ).rejects.toMatchObject({ statusCode: 400 });
      expect(llmGateway.handleMessage).not.toHaveBeenCalled();
    });

    test('valid → delegate llmGateway.handleMessage', async () => {
      const llmGateway = { handleMessage: jest.fn().mockResolvedValue({ response: 'hi' }) };
      const pipeline = new RAGPipeline({ llmGateway });
      const result = await pipeline.run({ message: 'hello', userId: 5, sessionId: 'X', context: {} });
      expect(llmGateway.handleMessage).toHaveBeenCalledWith('hello', 5, 'X', { normalizedQuery: 'hello', preClassifiedIntent: 'general' });
      expect(result.response).toBe('hi');
    });
  });
});
