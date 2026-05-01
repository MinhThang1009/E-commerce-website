const { ChatMessage, User } = require('../models');
const logger = require('../utils/logger');

// Store online users/sessions
const onlineUsers = new Set();

module.exports = (io) => {
  io.on('connection', (socket) => {
    logger.info(`🔌 Socket connected: ${socket.id}`);
    let currentRoom = null;
    let currentId = null;

    // User joins a personal room and/or session room
    socket.on('join', (data) => {
      const { userId, sessionId } = typeof data === 'string' ? { userId: data } : data;
      const identifier = sessionId || userId;
      
      if (userId) {
        socket.join(userId);
        logger.info(`👤 User joined user room: ${userId}`);
      }
      if (sessionId) {
        socket.join(sessionId);
        logger.info(`🆔 User joined session room: ${sessionId}`);
      }

      if (identifier) {
        currentId = identifier;
        currentRoom = identifier;
        onlineUsers.add(identifier);
        // Notify others about online status
        io.emit('userStatusChanged', { id: identifier, status: 'online' });
      }
    });

    // Admin joins the dashboard
    socket.on('adminJoin', () => {
      socket.join('admin-room');
      currentId = 'admin'; // Specific marker for admin
      onlineUsers.add('admin');
      io.emit('userStatusChanged', { id: 'admin', status: 'online' });
      logger.info('🛡️ Admin joined admin-room');
    });

    // Provide list of online users to requester
    socket.on('getOnlineUsers', () => {
      socket.emit('onlineUsersList', Array.from(onlineUsers));
    });

    // Typing indicators
    socket.on('typing', (data) => {
      const { targetId } = data; // Room to send to
      if (targetId) {
        socket.to(targetId).emit('userTyping', { id: currentId });
      } else if (currentRoom) {
        // Fallback to current room if target not specified
        socket.to(currentRoom).emit('userTyping', { id: currentId });
      }
      // If user typing, admin should also see it in general
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

    // Listen to messages
    socket.on('sendMessage', async (data) => {
      try {
        const { userId, senderId, content, isFromAdmin, sessionId } = data;

        if ((!userId && !sessionId) || !senderId || !content) {
          return socket.emit('error', { message: 'Missing fields' });
        }

        // Save to Database
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
        logger.error('Socket sendMessage error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('disconnect', () => {
      if (currentId) {
        onlineUsers.delete(currentId);
        io.emit('userStatusChanged', { id: currentId, status: 'offline' });
      }
      logger.info(`🔌 Socket disconnected: ${socket.id}`);
    });
  });
};
