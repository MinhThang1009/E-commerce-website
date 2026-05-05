const ChatController = require('./controllers/chatController');
const ChatService = require('./services/chatService');
const SequelizeChatRepository = require('./repositories/SequelizeChatRepository');
const buildRoutes = require('./routes');

// Chat module — DDD-lite. Socket adapter để emit realtime tới rooms;
// service phụ thuộc ISocketBridge port (truyền null nếu test/CLI).
module.exports = ({
  ChatMessage, User,
  io, // optional Socket.IO server instance (cấp sau khi server.listen)
  eventBus, logger,
}) => {
  if (!ChatMessage) throw new Error('chat module: ChatMessage model bắt buộc');

  const chatRepository = new SequelizeChatRepository({ ChatMessage, User });

  // Adapter: Socket.IO → ISocketBridge port. Nếu io chưa setup (boot time),
  // emit thành no-op nhưng method tồn tại — tránh service crash.
  const socketBridge = {
    emitToRoom(room, event, payload) {
      if (io && room) io.to(room).emit(event, payload);
    },
    emitToAdmin(event, payload) {
      if (io) io.to('admin-room').emit(event, payload);
    },
  };

  const chatService = new ChatService({
    chatRepository, socketBridge, eventBus, logger,
  });
  const chatController = new ChatController({ chatService });
  const router = buildRoutes({ chatController });

  return {
    basePath: '/chat',
    router,
    subscribeEvents() {},
    // Allow late binding của Socket.IO instance (sau khi server.listen)
    bindSocketIO(ioInstance) {
      // Replace adapter's io reference (closure rebinding)
      socketBridge.emitToRoom = (room, event, payload) => {
        if (ioInstance && room) ioInstance.to(room).emit(event, payload);
      };
      socketBridge.emitToAdmin = (event, payload) => {
        if (ioInstance) ioInstance.to('admin-room').emit(event, payload);
      };
    },
  };
};
