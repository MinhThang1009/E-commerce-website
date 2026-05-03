const { ChatMessage, User, sequelize } = require('../models');
const { AppError } = require('../middlewares/errorHandler');

// Lấy lịch sử trò chuyện theo session hoặc người dùng cụ thể
const getChatHistory = async (req, res, next) => {
  try {
    const { identifier } = req.params; // Có thể là userId hoặc sessionId
    const currentUserId = req.user.id;
    const isAdmin = req.user.role === 'admin';

    // Lấy các tin nhắn có sessionId hoặc userId trùng với identifier
    const messages = await ChatMessage.findAll({
      where: {
        [sequelize.Sequelize.Op.or]: [
          { sessionId: identifier },
          { userId: identifier },
        ],
      },
      order: [['createdAt', 'ASC']],
    });

    // Kiểm tra quyền truy cập
    if (!isAdmin) {
      const isOwner = messages.every(m => !m.userId || m.userId === currentUserId);
      if (!isOwner) {
        throw new AppError('Không có quyền xem cuộc trò chuyện này', 403);
      }
    }

    // Cập nhật trạng thái đã đọc
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

// Lấy danh sách các phiên trò chuyện (dành cho Admin Dashboard)
const getAdminChatList = async (req, res, next) => {
  try {
    // Lấy các sessionId duy nhất, nhóm theo thời gian tin nhắn cuối cùng
    // Chỉ lấy support chat — loại trừ AI chatbot messages (message_type = 'ai_chatbot')
    const sessions = await ChatMessage.findAll({
      attributes: [
        'sessionId',
        'userId',
        [sequelize.fn('MAX', sequelize.col('createdAt')), 'lastMessageAt'],
      ],
      where: {
        [sequelize.Sequelize.Op.or]: [
          { messageType: 'support_chat' },
          { messageType: null },
        ],
      },
      group: ['sessionId', 'userId'],
      order: [[sequelize.literal('MAX(createdAt)'), 'DESC']],
    });

    // Bổ sung nội dung tin nhắn cuối cùng cho mỗi phiên
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

// Đánh dấu cuộc trò chuyện là đã đọc
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
      message: 'Đã đánh dấu cuộc trò chuyện là đã đọc',
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
