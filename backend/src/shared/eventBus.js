/**
 * @file eventBus.js
 * @layer Shared
 * @module global
 * @description Cross-cutting infrastructure: eventBus
 */
const logger = require('./logger');

// In-process pub-sub cho cross-module communication (vd
// orders.OrderCreated → inventory subscribe deduct stock).
// Không dùng external broker (RabbitMQ/Kafka) cho thesis scope —
// single-instance deploy nên in-process đủ. Nếu sau này scale horizontal
// sẽ thay implementation này bằng adapter Redis Pub/Sub mà API không đổi.
class EventBus {
  constructor() {
    this.handlers = new Map();
  }

  // subscribe(eventType, handler) → unsubscribe function
  // Handler có thể async; lỗi handler KHÔNG chặn handler khác (catch isolated).
  subscribe(eventType, handler) {
    if (typeof handler !== 'function') {
      throw new Error('eventBus.subscribe: handler phải là function');
    }
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType).add(handler);
    return () => this.unsubscribe(eventType, handler);
  }

  unsubscribe(eventType, handler) {
    const set = this.handlers.get(eventType);
    if (set) set.delete(handler);
  }

  // publish(event) — event object phải có { type, payload, occurredAt }
  // (xem shared/eventBus phần Domain Event factory bên trong DDD-lite modules).
  // Trả Promise<void> resolve khi tất cả handler complete (Promise.allSettled
  // để 1 handler fail không huỷ handler khác).
  async publish(event) {
    if (!event || typeof event.type !== 'string') {
      throw new Error('eventBus.publish: event.type bắt buộc');
    }
    const set = this.handlers.get(event.type);
    if (!set || set.size === 0) return;

    const promises = [];
    for (const handler of set) {
      promises.push(
        Promise.resolve()
          .then(() => handler(event))
          .catch((err) => {
            logger.error(`[eventBus] Handler lỗi cho event "${event.type}":`, err);
          })
      );
    }
    await Promise.allSettled(promises);
  }

  // Utility cho test isolation
  clear() {
    this.handlers.clear();
  }
}

// Singleton — 1 instance duy nhất shared toàn app
const eventBus = new EventBus();

module.exports = eventBus;
module.exports.EventBus = EventBus;
