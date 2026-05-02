const { ChatMessage, User } = require('../models');
const logger = require('../utils/logger');

// Lưu trữ danh sách người dùng/phiên đang trực tuyến
const onlineUsers = new Set();

module.exports = (io) => {
  io.on('connection', (socket) => {
    logger.info(`🔌 Socket đã kết nối: ${socket.id}`);
    let currentRoom = null;
    let currentId = null;

    // Người dùng tham gia phòng cá nhân và/hoặc phòng theo phiên
    socket.on('join', (data) => {
      const { userId, sessionId } = typeof data === 'string' ? { userId: data } : data;
      const identifier = sessionId || userId;
      
      if (userId) {
        socket.join(userId);
        logger.info(`👤 Người dùng tham gia phòng user: ${userId}`);
      }
      if (sessionId) {
        socket.join(sessionId);
        logger.info(`🆔 Người dùng tham gia phòng phiên: ${sessionId}`);
      }

      if (identifier) {
        currentId = identifier;
        currentRoom = identifier;
        onlineUsers.add(identifier);
        // Thông báo trạng thái trực tuyến cho các client khác
        io.emit('userStatusChanged', { id: identifier, status: 'online' });
      }
    });

    // Admin tham gia dashboard
    socket.on('adminJoin', () => {
      socket.join('admin-room');
      currentId = 'admin'; // Định danh đặc biệt cho admin
      onlineUsers.add('admin');
      io.emit('userStatusChanged', { id: 'admin', status: 'online' });
      logger.info('🛡️ Admin đã tham gia admin-room');
    });

    // Cung cấp danh sách người dùng trực tuyến cho bên yêu cầu
    socket.on('getOnlineUsers', () => {
      socket.emit('onlineUsersList', Array.from(onlineUsers));
    });

    // Chỉ báo đang nhập
    socket.on('typing', (data) => {
      const { targetId } = data; // Phòng cần gửi đến
      if (targetId) {
        socket.to(targetId).emit('userTyping', { id: currentId });
      } else if (currentRoom) {
        // Dự phòng: gửi vào phòng hiện tại nếu không chỉ định target
        socket.to(currentRoom).emit('userTyping', { id: currentId });
      }
      // Nếu người dùng đang nhập, admin cũng cần nhìn thấy
      if (currentId !== 'admin') {
        socket.to('admin-room').emit('userTyping', { id: currentId });
      }
    });

    socket.on('stopTyping', (data) => {
      const { targetId } = data;
      if (targetId) {
        socket.to(targetId).emit('userStopTyping', { id: currentId });
      } else if (currentRoom) {
        socket.to(currentRoom).emit('userStopTyping', { id: currentId });
      }
      if (currentId !== 'admin') {
        socket.to('admin-room').emit('userStopTyping', { id: currentId });
      }
    });

    // Lắng nghe tin nhắn mới
    socket.on('sendMessage', async (data) => {
      try {
        const { userId, senderId, content, isFromAdmin, sessionId } = data;

        if ((!userId && !sessionId) || !senderId || !content) {
          return socket.emit('error', { message: 'Thiếu trường bắt buộc' });
        }

        // Lưu vào database
        const message = await ChatMessage.create({
          userId: userId || null,
          sessionId: sessionId || userId,
          senderId,
          content,
          isFromAdmin: !!isFromAdmin,
          isRead: false,
        });

        const targetRoom = sessionId || userId;
        io.to(targetRoom).emit('messageRecieved', message);
        io.to('admin-room').emit('messageRecieved', message);

        if (!isFromAdmin) {
          io.to('admin-room').emit('newChatAlert', {
            userId,
            sessionId: sessionId || userId,
            content,
            createdAt: message.createdAt,
          });
        }
      } catch (error) {
        logger.error('Lỗi socket sendMessage:', error);
        socket.emit('error', { message: 'Gửi tin nhắn thất bại' });
      }
    });

    socket.on('disconnect', () => {
      if (currentId) {
        onlineUsers.delete(currentId);
        io.emit('userStatusChanged', { id: currentId, status: 'offline' });
      }
      logger.info(`🔌 Socket đã ngắt kết nối: ${socket.id}`);
    });
  });
};
