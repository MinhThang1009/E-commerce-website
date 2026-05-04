// Controller: REALTIME SUPPORT CHAT giữa user và admin/staff qua Socket.IO.
// KHÔNG phải AI chatbot — file đó là controllers/chatbot.js.
// Endpoint chính: GET /api/chat/history/:identifier, POST /api/chat/send

const { ChatMessage, User, sequelize } = require('../models');
const { AppError } = require('../middlewares/errorHandler');

// Lấy lịch sử trò chuyện theo session hoặc người dùng cụ thể
const getChatHistory = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    // req.user có thể là null với guest (optionalAuthenticate)
    const currentUserId = req.user?.id ?? null;
    const isAdmin = req.user?.role === 'admin';

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

    // Kiểm tra quyền truy cập — ngăn chặn enumeration session của người khác
    if (!isAdmin) {
      // Trả về 404 nếu không tìm thấy session thay vì [] — ngăn brute-force enumeration
      if (messages.length === 0) {
        throw new AppError('Không tìm thấy cuộc trò chuyện', 404);
      }
      // Guest: identifier phải là sessionId của chính họ (UUID đủ entropy để không đoán được)
      // User đăng nhập: identifier là userId của mình, hoặc ít nhất 1 message có userId của mình
      const isOwner = currentUserId
        ? String(currentUserId) === identifier ||
          messages.some((m) => m.userId === currentUserId)
        : messages.every((m) => m.sessionId === identifier && !m.userId);
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

// POST /api/chat — Gửi tin nhắn hỗ trợ (user/guest → admin)
// content đã được validate bởi sendMessageSchema (max 2000 ký tự) trước khi vào đây
const sendMessage = async (req, res, next) => {
  try {
    const { content, sessionId } = req.body;
    const userId = req.user?.id ?? null;

    // Yêu cầu định danh: phải có userId (đã đăng nhập) hoặc sessionId (guest)
    if (!userId && !sessionId) {
      throw new AppError('Cần cung cấp sessionId cho guest chat', 400);
    }

    const message = await ChatMessage.create({
      userId,
      sessionId: sessionId || null,
      content,
      isFromAdmin: false,
      isRead: false,
    });

    res.status(201).json({
      status: 'success',
      data: message,
    });
  } catch (error) {
    next(error);
  }
};

// Đánh dấu cuộc trò chuyện là đã đọc
const markAsRead = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    // req.user có thể là null với guest (optionalAuthenticate)
    const isAdmin = req.user?.role === 'admin';

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
  sendMessage,
};
