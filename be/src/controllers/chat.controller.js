const { ChatMessage, User, sequelize } = require('../models');
const { AppError } = require('../middlewares/errorHandler');

// Get chat history for a specific session or user
const getChatHistory = async (req, res, next) => {
  try {
    const { identifier } = req.params; // Can be userId or sessionId
    const currentUserId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Fetch messages where sessionId is identifier OR userId is identifier
    const messages = await ChatMessage.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { sessionId: identifier },
          { userId: identifier },
        ],
      },
      order: [['createdAt', 'ASC']],
    });

    // Check permissions
    if (!isAdmin) {
      const isOwner = messages.every(m => !m.userId || m.userId === currentUserId);
      if (!isOwner) {
        throw new AppError('Không có quyền xem cuộc trò chuyện này', 403);
      }
    }

    // Update unread status
    if (isAdmin) {
      await ChatMessage.update(
        { isRead: true },
        {
          where: {
            [sequelize.Sequelize.Op.or]: [{ sessionId: identifier }, { userId: identifier }],
            isFromAdmin: false,
            isRead: false,
          },
        }
      );
    } else {
      await ChatMessage.update(
        { isRead: true },
        {
          where: {
            [sequelize.Sequelize.Op.or]: [{ sessionId: identifier }, { userId: identifier }],
            isFromAdmin: true,
            isRead: false,
          },
        }
      );
    }

    res.status(200).json({
      status: 'success',
      data: messages,
    });
  } catch (error) {
    next(error);
  }
};

// Get list of unique chat sessions (for Admin Dashboard)
const getAdminChatList = async (req, res, next) => {
  try {
    // fetch distinct sessionIds grouped by max createdAt
    const sessions = await ChatMessage.findAll({
      attributes: [
        'sessionId',
        'userId',
        [sequelize.fn('MAX', sequelize.col('created_at')), 'lastMessageAt'],
      ],
      group: ['sessionId', 'userId'],
      order: [[sequelize.literal('MAX(created_at)'), 'DESC']],
    });

    // For each item, append last active content
    const listWithDetails = await Promise.all(
      sessions.map(async (item) => {
        const lastMessage = await ChatMessage.findOne({
          where: { sessionId: item.sessionId || item.userId },
          order: [['createdAt', 'DESC']],
        });

        const unreadCount = await ChatMessage.count({
          where: { 
            [sequelize.Sequelize.Op.or]: [
              { sessionId: item.sessionId || item.userId },
              { userId: item.userId }
            ],
            isFromAdmin: false, 
            isRead: false 
          },
        });

        let chatUser = null;
        if (item.userId) {
          chatUser = await User.findByPk(item.userId, {
            attributes: ['id', 'firstName', 'lastName', 'email', 'avatar'],
          });
        }

        return {
          sessionId: item.sessionId || item.userId,
          userId: item.userId,
          user: chatUser,
          lastMessage: lastMessage ? lastMessage.content : '',
          lastMessageAt: item.getDataValue('lastMessageAt'),
          unreadCount,
        };
      })
    );

    res.status(200).json({
      status: 'success',
      data: listWithDetails,
    });
  } catch (error) {
    next(error);
  }
};

// Mark a conversation as read
const markAsRead = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    const isAdmin = req.user.role === 'admin';

    if (isAdmin) {
      await ChatMessage.update(
        { isRead: true },
        {
          where: {
            [sequelize.Sequelize.Op.or]: [{ sessionId: identifier }, { userId: identifier }],
            isFromAdmin: false,
            isRead: false,
          },
        }
      );
    } else {
      await ChatMessage.update(
        { isRead: true },
        {
          where: {
            [sequelize.Sequelize.Op.or]: [{ sessionId: identifier }, { userId: identifier }],
            isFromAdmin: true,
            isRead: false,
          },
        }
      );
    }

    res.status(200).json({
      status: 'success',
      message: 'Conversation marked as read',
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getChatHistory,
  getAdminChatList,
  markAsRead,
};
