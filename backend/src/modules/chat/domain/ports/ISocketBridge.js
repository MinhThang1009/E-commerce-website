// ISocketBridge — port abstraction cho Socket.IO realtime delivery.
// Plan Phase 3 Sprint 10: chat module có Socket adapter.
// Service publish event qua socket bridge để emit tới rooms — không phụ thuộc
// io trực tiếp. Adapter (config/socket.js wrapper) implement port.

class ISocketBridge {
  emitToRoom(_room, _event, _payload) { throw new Error('not implemented'); }
  emitToAdmin(_event, _payload) { throw new Error('not implemented'); }
}

module.exports = ISocketBridge;
