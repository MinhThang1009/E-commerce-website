// Phase 42.1 — Unit tests cho shared/eventBus
// Pure in-process pub-sub, không phụ thuộc DB/network.

const { EventBus } = require('./event-bus');

describe('shared/event-bus', () => {
  let bus;

  beforeEach(() => {
    bus = new EventBus();
  });

  test('subscribe + publish gửi event đến đúng handler', async () => {
    const received = [];
    bus.subscribe('order.created', (e) => received.push(e));

    await bus.publish({
      type: 'order.created',
      payload: { orderId: 1 },
      occurredAt: '2026-05-05T00:00:00Z',
    });

    expect(received).toHaveLength(1);
    expect(received[0].payload.orderId).toBe(1);
  });

  test('handler khác eventType không được gọi', async () => {
    const a = jest.fn();
    const b = jest.fn();
    bus.subscribe('a', a);
    bus.subscribe('b', b);

    await bus.publish({ type: 'a', payload: {}, occurredAt: '' });

    expect(a).toHaveBeenCalledTimes(1);
    expect(b).not.toHaveBeenCalled();
  });

  test('multiple handler cùng eventType đều được gọi', async () => {
    const h1 = jest.fn();
    const h2 = jest.fn();
    bus.subscribe('test', h1);
    bus.subscribe('test', h2);

    await bus.publish({ type: 'test', payload: 1, occurredAt: '' });

    expect(h1).toHaveBeenCalled();
    expect(h2).toHaveBeenCalled();
  });

  test('unsubscribe ngừng nhận event', async () => {
    const handler = jest.fn();
    const unsub = bus.subscribe('x', handler);

    await bus.publish({ type: 'x', payload: 1, occurredAt: '' });
    expect(handler).toHaveBeenCalledTimes(1);

    unsub();
    await bus.publish({ type: 'x', payload: 2, occurredAt: '' });
    expect(handler).toHaveBeenCalledTimes(1); // không tăng
  });

  test('lỗi 1 handler không chặn handler khác (catch isolated)', async () => {
    const ok = jest.fn();
    bus.subscribe('e', () => { throw new Error('boom'); });
    bus.subscribe('e', ok);

    await expect(
      bus.publish({ type: 'e', payload: {}, occurredAt: '' })
    ).resolves.toBeUndefined();
    expect(ok).toHaveBeenCalled();
  });

  test('publish event không có handler — no-op, không throw', async () => {
    await expect(
      bus.publish({ type: 'nobody.cares', payload: {}, occurredAt: '' })
    ).resolves.toBeUndefined();
  });

  test('subscribe non-function throw', () => {
    expect(() => bus.subscribe('x', 'not-a-function')).toThrow(/function/);
  });

  test('publish event thiếu type throw', async () => {
    await expect(bus.publish({ payload: {} })).rejects.toThrow(/type/);
  });

  test('clear() xóa toàn bộ handler', async () => {
    const handler = jest.fn();
    bus.subscribe('y', handler);
    bus.clear();
    await bus.publish({ type: 'y', payload: 1, occurredAt: '' });
    expect(handler).not.toHaveBeenCalled();
  });

  test('subscribe handler thứ hai cho cùng eventType — không tạo lại Set (branch if-false line 19)', async () => {
    // First subscribe creates the Set (if-true path).
    // Second subscribe for same eventType hits !has() = false → skips Set creation.
    const h1 = jest.fn();
    const h2 = jest.fn();
    const h3 = jest.fn();
    bus.subscribe('same-event', h1);
    bus.subscribe('same-event', h2); // triggers false branch of if(!has)
    bus.subscribe('same-event', h3); // also false branch

    await bus.publish({ type: 'same-event', payload: 'ok', occurredAt: '' });

    // All three handlers must have been called — Set was not re-created
    expect(h1).toHaveBeenCalledTimes(1);
    expect(h2).toHaveBeenCalledTimes(1);
    expect(h3).toHaveBeenCalledTimes(1);
  });

  test('unsubscribe eventType chưa có handler — if(set) false branch (line 28)', () => {
    // unsubscribe gọi trực tiếp cho eventType chưa subscribe bất kỳ handler nào.
    // this.handlers.get('phantom') = undefined → if(set) = false → skip delete.
    // Không throw, không side-effect.
    expect(() => bus.unsubscribe('phantom-event', () => {})).not.toThrow();
    // Cũng không tạo entry nào trong map
    expect(bus.handlers.has('phantom-event')).toBe(false);
  });
});
