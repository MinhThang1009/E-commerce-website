const stripeService = require('../services/payment/stripe');
const logger = require('../utils/logger');
const momoService = require('../services/payment/momo');
const vnpayService = require('../services/payment/vnpay');
const { Order, User, OrderItem, Product, ProductVariant, Cart, CartItem } = require('../models');
const { AppError } = require('../middlewares/errorHandler');
const { Op } = require('sequelize');
const sequelize = require('../config/sequelize');
const moment = require('moment');

// Tạo payment intent
const createPaymentIntent = async (req, res, next) => {
  try {
    const { amount, currency = 'usd', orderId } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
      throw new AppError('Số tiền không hợp lệ', 400);
    }

    // Tạo payment intent kèm metadata
    logger.info('Đang tạo payment intent kèm metadata:', {
      userId,
      orderId: orderId || '',
    });

    const paymentIntent = await stripeService.createPaymentIntent({
      amount,
      currency,
      metadata: {
        userId,
        orderId: orderId || '',
      },
    });

    logger.info('Đã tạo payment intent:', {
      id: paymentIntent.paymentIntentId,
      metadata: paymentIntent.metadata,
    });

    res.status(200).json({
      status: 'success',
      data: paymentIntent,
    });
  } catch (error) {
    next(error);
  }
};

// Xác nhận thanh toán
const confirmPayment = async (req, res, next) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      throw new AppError('Payment intent ID là bắt buộc', 400);
    }

    const paymentIntent =
      await stripeService.confirmPaymentIntent(paymentIntentId);

    logger.info('Đã lấy payment intent:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      metadata: paymentIntent.metadata,
    });

    // Cập nhật trạng thái thanh toán của đơn hàng nếu orderId có trong metadata
    if (paymentIntent.metadata.orderId) {
      logger.info('Đang cập nhật đơn hàng:', paymentIntent.metadata.orderId);
      logger.info('Trạng thái payment intent:', paymentIntent.status);

      // Kiểm tra đơn hàng có tồn tại không
      const existingOrder = await Order.findByPk(
        paymentIntent.metadata.orderId
      );
      logger.info(
        'Đơn hàng hiện có:',
        existingOrder
          ? {
              id: existingOrder.id,
              number: existingOrder.number,
              currentPaymentStatus: existingOrder.paymentStatus,
            }
          : 'Không tìm thấy đơn hàng'
      );

      if (existingOrder && paymentIntent.status === 'succeeded') {
        const updateResult = await Order.update(
          {
            status: 'processing', // Cập nhật trạng thái đơn hàng
            paymentStatus: 'paid', // Cập nhật trạng thái thanh toán
            paymentTransactionId: paymentIntent.id,
            paymentProvider: 'stripe',
            updatedAt: new Date(),
          },
          {
            where: { id: paymentIntent.metadata.orderId },
          }
        );
        logger.info('Kết quả cập nhật đơn hàng:', updateResult);

        // Xác minh kết quả cập nhật
        const updatedOrder = await Order.findByPk(
          paymentIntent.metadata.orderId
        );
        logger.info(
          'Đơn hàng sau khi cập nhật:',
          updatedOrder
            ? {
                id: updatedOrder.id,
                number: updatedOrder.number,
                status: updatedOrder.status, // Trạng thái đơn hàng
                paymentStatus: updatedOrder.paymentStatus, // Trạng thái thanh toán
                paymentTransactionId: updatedOrder.paymentTransactionId,
              }
            : 'Không tìm thấy đơn hàng sau khi cập nhật'
        );
        
        // Trừ tồn kho sau khi thanh toán Stripe được xác nhận
        if (updatedOrder) {
          const { OrderItem, Product, ProductVariant } = require('../models');

          // Lấy danh sách mặt hàng để trừ tồn kho
          const orderItems = await OrderItem.findAll({
            where: { orderId: updatedOrder.id }
          });

          for (const item of orderItems) {
            if (item.variantId) {
              // Trừ tồn kho theo biến thể sản phẩm
              await ProductVariant.decrement(
                { stockQuantity: item.quantity },
                { where: { id: item.variantId } }
              );
            } else {
              // Trừ tồn kho theo sản phẩm
              await Product.decrement(
                { stockQuantity: item.quantity },
                { where: { id: item.productId } }
              );
            }
          }

          logger.info(`Đã trừ tồn kho cho đơn hàng ${updatedOrder.id} sau khi xác nhận thanh toán Stripe`);

          // Xóa giỏ hàng đang hoạt động của người dùng
          await clearUserCart(updatedOrder.userId);
        }
      } else if (!existingOrder) {
        logger.info('Không tìm thấy đơn hàng với ID:', paymentIntent.metadata.orderId);
      } else {
        logger.info('Thanh toán chưa thành công, trạng thái:', paymentIntent.status);
      }
    } else {
      logger.info('Không tìm thấy orderId trong metadata của payment intent');
    }

    res.status(200).json({
      status: 'success',
      data: {
        paymentIntent: {
          id: paymentIntent.id,
          status: paymentIntent.status,
          amount:
            paymentIntent.currency === 'vnd'
              ? paymentIntent.amount
              : paymentIntent.amount / 100,
          currency: paymentIntent.currency,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

// Tạo customer
const createCustomer = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);

    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404);
    }

    // Kiểm tra người dùng đã có Stripe customer ID chưa
    if (user.stripeCustomerId) {
      const customer = await stripeService.getCustomer(user.stripeCustomerId);
      return res.status(200).json({
        status: 'success',
        data: { customer },
      });
    }

    // Tạo Stripe customer mới
    const customer = await stripeService.createCustomer({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      metadata: {
        userId: user.id,
      },
    });

    // Lưu Stripe customer ID vào user
    await user.update({ stripeCustomerId: customer.id });

    res.status(201).json({
      status: 'success',
      data: { customer },
    });
  } catch (error) {
    next(error);
  }
};

// Lấy danh sách phương thức thanh toán
const getPaymentMethods = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);

    if (!user || !user.stripeCustomerId) {
      return res.status(200).json({
        status: 'success',
        data: { paymentMethods: [] },
      });
    }

    const paymentMethods = await stripeService.getPaymentMethods(
      user.stripeCustomerId
    );

    res.status(200).json({
      status: 'success',
      data: { paymentMethods },
    });
  } catch (error) {
    next(error);
  }
};

// Tạo setup intent để lưu phương thức thanh toán
const createSetupIntent = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);

    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404);
    }

    // Tạo customer nếu chưa tồn tại
    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await stripeService.createCustomer({
        email: user.email,
        name: `${user.firstName} ${user.lastName}`,
        metadata: { userId: user.id },
      });
      customerId = customer.id;
      await user.update({ stripeCustomerId: customerId });
    }

    const setupIntent = await stripeService.createSetupIntent(customerId);

    res.status(200).json({
      status: 'success',
      data: setupIntent,
    });
  } catch (error) {
    next(error);
  }
};

// Xử lý Stripe webhook
const handleWebhook = async (req, res, next) => {
  try {
    // Sandbox mode: chưa có STRIPE_WEBHOOK_SECRET thì bỏ qua xác thực
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      logger.info('Webhook nhận trong chế độ sandbox (không có STRIPE_WEBHOOK_SECRET)');
      return res.status(200).json({ received: true });
    }

    const signature = req.headers['stripe-signature'];
    const payload = req.body;
    const event = await stripeService.handleWebhook(payload, signature);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      case 'customer.created':
        logger.info('Đã tạo customer:', event.data.object.id);
        break;
      default:
        logger.info(`Loại sự kiện chưa được xử lý: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
};

// Hàm xử lý khi thanh toán thành công
const handlePaymentSucceeded = async (paymentIntent) => {
  try {
    if (paymentIntent.metadata.orderId) {
      await Order.update(
        {
          status: 'processing', // Cập nhật trạng thái đơn hàng
          paymentStatus: 'paid', // Cập nhật trạng thái thanh toán
          paymentTransactionId: paymentIntent.id,
          paymentProvider: 'stripe',
        },
        {
          where: { id: paymentIntent.metadata.orderId },
        }
      );
      
      // Trừ tồn kho sau khi thanh toán được xác nhận qua Stripe webhook
      const { OrderItem, Product, ProductVariant } = require('../models');

      // Lấy danh sách mặt hàng để trừ tồn kho
      const orderItems = await OrderItem.findAll({
        where: { orderId: paymentIntent.metadata.orderId }
      });

      for (const item of orderItems) {
        if (item.variantId) {
          // Trừ tồn kho theo biến thể sản phẩm
          await ProductVariant.decrement(
            { stockQuantity: item.quantity },
            { where: { id: item.variantId } }
          );
        } else {
          // Trừ tồn kho theo sản phẩm
          await Product.decrement(
            { stockQuantity: item.quantity },
            { where: { id: item.productId } }
          );
        }
      }

      logger.info(
        `Thanh toán thành công và đã trừ tồn kho cho đơn hàng: ${paymentIntent.metadata.orderId}`
      );

      // Xóa giỏ hàng đang hoạt động của người dùng
      const order = await Order.findByPk(paymentIntent.metadata.orderId);
      if (order) {
        await clearUserCart(order.userId);
      }
    }
  } catch (error) {
    logger.error('Lỗi xử lý thanh toán thành công:', error);
  }
};

// Hàm xử lý khi thanh toán thất bại
const handlePaymentFailed = async (paymentIntent) => {
  try {
    if (paymentIntent.metadata.orderId) {
      await Order.update(
        {
          paymentStatus: 'failed',
          paymentTransactionId: paymentIntent.id,
          paymentProvider: 'stripe',
        },
        {
          where: { id: paymentIntent.metadata.orderId },
        }
      );
      logger.info(
        `Thanh toán thất bại cho đơn hàng: ${paymentIntent.metadata.orderId}`
      );
    }
  } catch (error) {
    logger.error('Lỗi xử lý thanh toán thất bại:', error);
  }
};

// Hàm xóa giỏ hàng của người dùng sau khi thanh toán thành công
const clearUserCart = async (userId) => {
  if (!userId) {
    logger.warn('clearUserCart: thiếu userId');
    return;
  }
  
  try {
    // Tìm tất cả giỏ hàng đang hoạt động của người dùng để đảm bảo
    const carts = await Cart.findAll({
      where: { userId, status: 'active' }
    });

    if (carts && carts.length > 0) {
      for (const cart of carts) {
        await cart.update({ status: 'converted' });
        // Xóa luôn các item để đảm bảo count trả về 0
        await CartItem.destroy({
          where: { cartId: cart.id }
        });
        logger.info(`[SUCCESS] Đã xóa giỏ hàng ${cart.id} của người dùng ${userId}`);
      }
    } else {
      logger.info(`[INFO] Không tìm thấy giỏ hàng đang hoạt động để xóa cho người dùng ${userId}`);
    }
  } catch (error) {
    logger.error(`[ERROR] Lỗi xóa giỏ hàng cho người dùng ${userId}:`, error.message);
  }
};

// Tạo hoàn tiền
const createRefund = async (req, res, next) => {
  try {
    const { orderId, amount, reason } = req.body;

    if (!orderId) {
      throw new AppError('Order ID là bắt buộc', 400);
    }

    const order = await Order.findByPk(orderId);
    if (!order) {
      throw new AppError('Không tìm thấy đơn hàng', 404);
    }

    if (!order.paymentTransactionId) {
      throw new AppError('Không tìm thấy giao dịch thanh toán cho đơn hàng này', 400);
    }

    let refund;
    if (order.paymentProvider === 'stripe') {
      refund = await stripeService.createRefund({
        paymentIntentId: order.paymentTransactionId,
        amount,
        reason,
      });
    } else if (order.paymentProvider === 'vnpay') {
      const ipAddr =
        req.headers['x-forwarded-for'] ||
        req.connection.remoteAddress ||
        req.socket.remoteAddress ||
        req.connection.socket.remoteAddress;

      refund = await vnpayService.refund({
        orderId: order.number,
        amount: amount || order.total,
        transDate: moment(order.updatedAt).format('YYYYMMDDHHmmss'),
        ipAddr,
      });
    } else {
      throw new AppError(
        `Hoàn tiền chưa được hỗ trợ cho ${order.paymentProvider}`,
        400
      );
    }

    // Cập nhật trạng thái thanh toán của đơn hàng sau khi hoàn tiền
    await order.update({
      paymentStatus: 'refunded',
    });

    res.status(200).json({
      status: 'success',
      data: { refund },
    });
  } catch (error) {
    next(error);
  }
};

// Xác thực SePay webhook bằng API key
const verifySePayApiKey = (req) => {
  // SePay gửi API key trong header Authorization dạng: "Authorization": "Apikey API_KEY_CUA_BAN"
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    logger.error('Không có Authorization header trong SePay webhook');
    return false;
  }
  
  // Kiểm tra header có bắt đầu bằng "Apikey " không
  if (!authHeader.startsWith('Apikey ')) {
    logger.error('Định dạng Authorization header không hợp lệ trong SePay webhook');
    return false;
  }
  
  // Trích xuất API key từ header
  const providedApiKey = authHeader.substring(7).trim(); // Bỏ tiền tố "Apikey "
  const expectedApiKey = process.env.SEPAY_API_KEY;
  
  if (!expectedApiKey) {
    logger.warn('SePay API key chưa được cấu hình trong environment variables');
    // Trong môi trường development, có thể cho phép webhook không cần xác thực API key
    return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  }
  
  // So sánh API key được cung cấp với API key kỳ vọng
  // Dùng so sánh constant-time để chống timing attack
  const expectedLength = expectedApiKey.length;
  const providedLength = providedApiKey.length;
  let mismatch = expectedLength !== providedLength;
  
  for (let i = 0; i < Math.max(expectedLength, providedLength); i++) {
    const expectedChar = expectedApiKey.charCodeAt(i) || 0;
    const providedChar = providedApiKey.charCodeAt(i) || 0;
    mismatch |= expectedChar ^ providedChar;
  }
  
  if (mismatch !== 0) {
    logger.error('API key SePay không hợp lệ');
    return false;
  }
  
  return true;
};

// Xử lý SePay webhook
const handleSePayWebhook = async (req, res, next) => {
  try {
    // Xác thực nguồn webhook bằng API key
    if (!verifySePayApiKey(req)) {
      logger.error('API key SePay không hợp lệ');
      return res.status(401).json({ error: 'Yêu cầu webhook không được xác thực' });
    }

    const {
      id,
      gateway,
      transactionDate,
      accountNumber,
      code,
      content,
      transferType,
      transferAmount,
      accumulated,
      subAccount,
      referenceCode,
      description
    } = req.body;

    logger.info('Đã nhận SePay webhook:', { id, transferAmount, content, transferType });

    // Kiểm tra các trường bắt buộc
    if (!id || !transferType || !transferAmount || !transactionDate) {
      logger.info('Thiếu các trường bắt buộc trong SePay webhook');
      return res.status(400).json({ error: 'Thiếu các trường bắt buộc' });
    }

    // Kiểm tra kiểu dữ liệu
    if (typeof id !== 'number' && typeof id !== 'string') {
      logger.info('Kiểu dữ liệu transaction ID không hợp lệ trong SePay webhook');
      return res.status(400).json({ error: 'Kiểu dữ liệu transaction ID không hợp lệ' });
    }

    if (typeof transferAmount !== 'number' || typeof transferType !== 'string') {
      logger.info('Kiểu dữ liệu không hợp lệ trong SePay webhook');
      return res.status(400).json({ error: 'Kiểu dữ liệu không hợp lệ' });
    }

    // Kiểm tra số tiền chuyển phải dương
    if (transferAmount <= 0) {
      logger.info('Số tiền chuyển không hợp lệ:', transferAmount);
      return res.status(400).json({ error: 'Số tiền chuyển phải là số dương' });
    }

    // Kiểm tra loại giao dịch
    if (!['in', 'out'].includes(transferType)) {
      logger.info('Loại giao dịch không hợp lệ:', transferType);
      return res.status(400).json({ error: 'Loại giao dịch không hợp lệ' });
    }

    // Chỉ xử lý giao dịch tiền vào
    if (transferType !== 'in') {
      logger.info('Bỏ qua giao dịch tiền ra');
      return res.status(200).json({ received: true, message: 'Bỏ qua giao dịch tiền ra' });
    }

    // Kiểm tra định dạng ngày giao dịch
    const parsedTransactionDate = new Date(transactionDate);
    if (isNaN(parsedTransactionDate.getTime())) {
      logger.info('Định dạng ngày giao dịch không hợp lệ:', transactionDate);
      return res.status(400).json({ error: 'Định dạng ngày giao dịch không hợp lệ' });
    }

    // Trích xuất order ID từ content hoặc code (có thể tùy chỉnh theo định dạng thực tế)
    // Ví dụ: content chứa mã đơn như "Order #ORD-12345 for payment"
    // hoặc code chứa order ID
    let orderId = null;

    // Thử trích xuất order ID từ content
    if (content) {
      // Tìm order ID trong content (điều chỉnh pattern theo định dạng thực tế)
      // Regex tìm các dạng:
      // - ORD-12345, ORDER-12345
      // - ORD12345, ORDER12345 (không có dấu gạch - ví dụ ORD251100012)
      // - order_123, order123
      // - SEPAY theo sau là số như SEPAY2845 (2845 có thể là order ID)
      // - Bất kỳ số nào có 6+ chữ số
      const patterns = [
        /ORD[-_]?(\d+)/i,                 // Khớp ORD12345 hoặc ORD-12345 hoặc ORD_12345
        /ORDER[-_]?(\d+)/i,               // Khớp ORDER12345 hoặc ORDER-12345 hoặc ORDER_12345
        /ORD[-_]?\w+/i,                   // Khớp mã đơn đầy đủ như ORD251100012
        /ORDER[-_]?\w+/i,                 // Khớp mã đơn đầy đủ như ORDERXXXXXXXX
        /order[-_\s]?(\d+)/i,             // Khớp order_123, order-123, order123
        /SEPAY(\d+)/i,                    // Khớp dạng SEPAY2845
        /SEPAY[-_\s]?(\d+)/i,             // Khớp SEPAY_2845, SEPAY-2845, SEPAY 2845
        /\b(\d{6,})\b/                   // Khớp bất kỳ số nào có 6+ chữ số
      ];

      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
          // Dùng toàn bộ match cho pattern như ORD251100012, hoặc captured group cho các pattern khác
          orderId = match[0];
          if (orderId) {
            orderId = orderId.trim();
            break; // Tìm thấy, dừng tìm kiếm
          }
        }
      }
    }

    // Thử trích xuất từ code nếu không tìm thấy trong content
    if (!orderId && code) {
      const codePatterns = [
        /ORD[-_]?(\d+)/i,                 // Khớp ORD12345 hoặc ORD-12345 hoặc ORD_12345
        /ORDER[-_]?(\d+)/i,               // Khớp ORDER12345 hoặc ORDER-12345 hoặc ORDER_12345
        /ORD[-_]?\w+/i,                   // Khớp mã đơn đầy đủ như ORD251100012
        /ORDER[-_]?\w+/i,                 // Khớp mã đơn đầy đủ như ORDERXXXXXXXX
        /order[-_\s]?(\d+)/i,             // Khớp order_123, order-123, order123
        /SEPAY(\d+)/i,                    // Khớp dạng SEPAY2845
        /SEPAY[-_\s]?(\d+)/i,             // Khớp SEPAY_2845, SEPAY-2845, SEPAY 2845
        /\b(\d{6,})\b/                   // Khớp bất kỳ số nào có 6+ chữ số
      ];
      
      for (const pattern of codePatterns) {
        const match = code.match(pattern);
        if (match) {
          orderId = match[0];
          if (orderId) {
            orderId = orderId.trim();
            break;
          }
        }
      }
    }

    // Nếu vẫn không tìm thấy order ID, thử dùng referenceCode
    if (!orderId && referenceCode) {
      const refPatterns = [
        /ORD[-_]?(\d+)/i,                 // Khớp ORD12345 hoặc ORD-12345 hoặc ORD_12345
        /ORDER[-_]?(\d+)/i,               // Khớp ORDER12345 hoặc ORDER-12345 hoặc ORDER_12345
        /ORD[-_]?\w+/i,                   // Khớp mã đơn đầy đủ như ORD251100012
        /ORDER[-_]?\w+/i,                 // Khớp mã đơn đầy đủ như ORDERXXXXXXXX
        /order[-_\s]?(\d+)/i,             // Khớp order_123, order-123, order123
        /SEPAY(\d+)/i,                    // Khớp dạng SEPAY2845
        /SEPAY[-_\s]?(\d+)/i,             // Khớp SEPAY_2845, SEPAY-2845, SEPAY 2845
        /\b(\d{6,})\b/                   // Khớp bất kỳ số nào có 6+ chữ số
      ];
      
      for (const pattern of refPatterns) {
        const match = referenceCode.match(pattern);
        if (match) {
          orderId = match[0];
          if (orderId) {
            orderId = orderId.trim();
            break;
          }
        }
      }
    }

    if (!orderId) {
      logger.info('Không tìm thấy order ID trong dữ liệu webhook');
      return res.status(200).json({
        received: true,
        message: 'Không tìm thấy order ID trong giao dịch, đã xử lý thành công'
      });
    }

    logger.info('Đang tìm đơn hàng với ID:', orderId);

    // Tìm đơn hàng trong database
    let order = null;
    
    // Thử nhiều cách để tìm đơn hàng
    try {
      // Thử tìm theo mã đơn hàng chính xác (ví dụ ORD-12345, lưu trong trường 'number')
      order = await Order.findOne({
        where: {
          number: orderId
        }
      });

      // Nếu không tìm thấy, thử các biến thể khác của định dạng mã đơn
      // Xử lý trường hợp DB lưu có dấu gạch nhưng webhook không có (hoặc ngược lại)
      if (!order) {
        // Thử thêm dấu gạch (ví dụ: webhook có "ORD251100012" nhưng DB có "ORD-2511-00012")
        // Chèn dấu gạch tại các vị trí phổ biến: sau "ORD" và trước 4 chữ số cuối
        if (orderId.startsWith('ORD') && orderId.length > 7) {
          const formattedOrderId = `${orderId.substring(0, 3)}-${orderId.substring(3, 7)}-${orderId.substring(7)}`;
          order = await Order.findOne({
            where: {
              number: formattedOrderId
            }
          });
        }
      }

      // Nếu vẫn không tìm thấy, thử theo chiều ngược lại: bỏ dấu gạch ra để tìm trong DB
      if (!order && orderId.includes('-')) {
        const unformattedOrderId = orderId.replace(/-/g, '');
        order = await Order.findOne({
          where: {
            number: unformattedOrderId
          }
        });

        // Thử thêm dấu gạch theo pattern ngược lại
        if (!order) {
          const formattedOrderId = `${unformattedOrderId.substring(0, 3)}-${unformattedOrderId.substring(3, 7)}-${unformattedOrderId.substring(7)}`;
          order = await Order.findOne({
            where: {
              number: formattedOrderId
            }
          });
        }
      }

      // Nếu vẫn không tìm thấy, thử khớp theo phần số trong trường 'number'
      // Một số hệ thống dùng mã đơn thuần số như "12345"
      if (!order) {
        const numericPart = parseInt(orderId.replace(/\D/g, ''));
        if (!isNaN(numericPart)) {
          // Thử khớp trong trường number nếu chứa phần số
          order = await Order.findOne({
            where: {
              number: { [Op.like]: `%${numericPart}%` }
            }
          });
        }
      }

      // Nếu vẫn chưa tìm thấy, thử tìm kiếm mở rộng hơn
      if (!order) {
        // Thử khớp một phần với order ID gốc
        order = await Order.findOne({
          where: {
            [Op.or]: [
              { number: { [Op.like]: `%${orderId}%` } },  // Khớp một phần trong mã đơn
            ]
          }
        });
      }
    } catch (error) {
      logger.error('Lỗi database khi tìm đơn hàng:', error);
      return res.status(500).json({ error: 'Lỗi xử lý đơn hàng' });
    }

    if (!order) {
      logger.info('Không tìm thấy đơn hàng:', orderId);
      return res.status(200).json({
        received: true,
        message: `Không tìm thấy đơn hàng với ID ${orderId}, đã xử lý thành công`
      });
    }

    // Kiểm tra số tiền chuyển có khớp với tổng đơn hàng không
    // Lưu ý: trong model Order, trường tổng tiền tên là 'total' (không phải 'totalAmount')
    const orderTotal = parseFloat(order.total); // Lấy trường 'total' từ model Order
    const transferAmountInVND = transferAmount; // SePay chuyển tiền theo đơn vị VND

    logger.info('So sánh số tiền:', {
      orderNumber: order.number,
      orderTotal: orderTotal,
      transferAmount: transferAmount,
      isMatch: Math.abs(orderTotal - transferAmount) < 0.01 // Dùng sai số nhỏ để so sánh số thực
    });

    // Kiểm tra số tiền có khớp không (cho phép sai số nhỏ do làm tròn)
    if (Math.abs(orderTotal - transferAmount) > 0.01) {
      logger.info(`Số tiền không khớp: tổng đơn ${orderTotal} vs số tiền chuyển ${transferAmount}`);

      // Vẫn acknowledge webhook nhưng ghi log sự không khớp
      return res.status(200).json({
        received: true,
        message: 'Phát hiện số tiền không khớp, đã xử lý thành công'
      });
    }

    // Ngăn xử lý trùng lặp — kiểm tra transaction ID đã được xử lý chưa
    if (order.paymentTransactionId && order.paymentTransactionId === id.toString()) {
      logger.info('Nhận webhook trùng lặp cho transaction ID:', id);
      return res.status(200).json({
        received: true,
        message: 'Webhook đã được xử lý trước đó'
      });
    }

    // Cập nhật trạng thái đơn hàng thành paid và processing nếu chưa xử lý
    if (order.paymentStatus === 'pending' || order.paymentStatus === 'unpaid') {
      const t = await sequelize.transaction();
      try {
        await Order.update(
          {
            status: 'processing',
            paymentStatus: 'paid',
            paymentTransactionId: id.toString(),
            paymentProvider: 'sepay',
            updatedAt: new Date(),
          },
          { where: { id: order.id }, transaction: t }
        );

        const orderItems = await OrderItem.findAll({
          where: { orderId: order.id },
          transaction: t,
        });

        for (const item of orderItems) {
          if (item.variantId) {
            await ProductVariant.decrement(
              { stockQuantity: item.quantity },
              { where: { id: item.variantId }, transaction: t }
            );
          } else {
            await Product.decrement(
              { stockQuantity: item.quantity },
              { where: { id: item.productId }, transaction: t }
            );
          }
        }

        await t.commit();
      } catch (txError) {
        await t.rollback();
        throw txError;
      }

      logger.info('Đã cập nhật đơn hàng thành công:', {
        orderId: order.id,
        orderNumber: order.number,
        paymentStatus: 'paid',
        status: 'processing',
        transactionId: id,
        paymentDate: parsedTransactionDate
      });

      // Xóa giỏ hàng đang hoạt động của user (ngoài transaction — không rollback nếu xóa thất bại)
      await clearUserCart(order.userId);

      // Tùy chọn: có thể emit event hoặc gửi thông báo tại đây
      // Ví dụ: gửi email xác nhận thanh toán thành công cho khách hàng
      // await emailService.sendPaymentConfirmation(order.userId, order.id);
      
    } else {
      logger.info('Đơn hàng đã được xử lý trước đó:', {
        orderId: order.id,
        orderNumber: order.number,
        currentPaymentStatus: order.paymentStatus,
        currentOrderStatus: order.status
      });
      return res.status(200).json({
        received: true,
        message: 'Đơn hàng đã được xử lý, webhook đã ghi nhận'
      });
    }

    res.status(200).json({
      received: true,
      message: 'SePay webhook đã được xử lý thành công',
      orderId: order.id,
      orderNumber: order.number,
      transactionId: id
    });

  } catch (error) {
    logger.error('Lỗi xử lý SePay webhook:', error);
    next(error);
  }
};


// Tạo URL thanh toán MoMo
const createMomoUrl = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    
    const order = await Order.findByPk(orderId);
    if (!order) {
      throw new AppError('Không tìm thấy đơn hàng', 404);
    }

    const result = await momoService.createPaymentUrl({
      orderId: order.number, // Dùng mã đơn hàng cho MoMo
      amount: order.total,
      orderInfo: `Thanh toán đơn hàng ${order.number}`,
      extraData: `orderId=${order.id}`, // Truyền UUID nội bộ vào extraData
    });

    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Xử lý MoMo Return (GET)
const momoReturn = async (req, res, next) => {
  try {
    const { resultCode, extraData } = req.query;
    
    // Trích xuất order ID nội bộ từ extraData
    const orderIdMatch = extraData.match(/orderId=([^&]+)/);
    const orderId = orderIdMatch ? orderIdMatch[1] : null;

    if (resultCode == 0) {
      if (orderId) {
        const order = await Order.findByPk(orderId);
        if (order && order.paymentStatus !== 'paid') {
          const t = await sequelize.transaction();
          try {
            await order.update({
              status: 'processing',
              paymentStatus: 'paid',
              paymentProvider: 'momo',
              updatedAt: new Date(),
            }, { transaction: t });

            const orderItems = await OrderItem.findAll({ where: { orderId: order.id }, transaction: t });
            for (const item of orderItems) {
              if (item.variantId) {
                await ProductVariant.decrement({ stockQuantity: item.quantity }, { where: { id: item.variantId }, transaction: t });
              } else {
                await Product.decrement({ stockQuantity: item.quantity }, { where: { id: item.productId }, transaction: t });
              }
            }
            await t.commit();
          } catch (txError) {
            await t.rollback();
            throw txError;
          }

          await clearUserCart(order.userId);
        }
      }
      return res.redirect(`${process.env.FRONTEND_URL}/orders?payment=success`);
    } else {
      return res.redirect(`${process.env.FRONTEND_URL}/orders?payment=failed`);
    }
  } catch (error) {
    logger.error('Lỗi MoMo return:', error);
    return res.redirect(`${process.env.FRONTEND_URL}/orders?payment=error`);
  }
};

// Xử lý MoMo IPN (POST)
const momoIPN = async (req, res, next) => {
  try {
    logger.info('Đã nhận MoMo IPN:', req.body);
    const isValid = momoService.verifySignature(req.body);
    
    if (!isValid) {
      return res.status(400).json({ message: 'Chữ ký không hợp lệ' });
    }

    const { resultCode, extraData, transId } = req.body;
    const orderIdMatch = extraData.match(/orderId=([^&]+)/);
    const orderId = orderIdMatch ? orderIdMatch[1] : null;

    if (resultCode == 0 && orderId) {
      const order = await Order.findByPk(orderId);
      if (order && order.paymentStatus !== 'paid') {
        const t = await sequelize.transaction();
        try {
          await order.update({
            status: 'processing',
            paymentStatus: 'paid',
            paymentTransactionId: transId,
            paymentProvider: 'momo',
            updatedAt: new Date(),
          }, { transaction: t });

          const orderItems = await OrderItem.findAll({ where: { orderId: order.id }, transaction: t });
          for (const item of orderItems) {
            if (item.variantId) {
              await ProductVariant.decrement({ stockQuantity: item.quantity }, { where: { id: item.variantId }, transaction: t });
            } else {
              await Product.decrement({ stockQuantity: item.quantity }, { where: { id: item.productId }, transaction: t });
            }
          }
          await t.commit();
        } catch (txError) {
          await t.rollback();
          throw txError;
        }

        await clearUserCart(order.userId);
      }
    }

    res.status(204).send();
  } catch (error) {
    logger.error('Lỗi MoMo IPN:', error);
    res.status(500).json({ message: error.message });
  }
};


// IPN nếu cần có thể thêm tương tự vnpayReturn nhưng dùng POST server-to-server

// Tạo URL thanh toán VNPay
const createVNPayUrl = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    const ipAddr = req.headers['x-forwarded-for'] ||
      req.connection.remoteAddress ||
      req.socket.remoteAddress ||
      req.connection.socket.remoteAddress;

    const order = await Order.findByPk(orderId);
    if (!order) {
      throw new AppError('Không tìm thấy đơn hàng', 404);
    }

    const payUrl = vnpayService.createPaymentUrl({
      orderId: order.number,
      amount: order.total,
      ipAddr,
      orderInfo: `Thanh toan don hang ${order.number}`,
    });

    res.status(200).json({
      status: 'success',
      data: payUrl,
    });
  } catch (error) {
    next(error);
  }
};

// Xử lý VNPay Return (GET)
const vnpayReturn = async (req, res, next) => {
  try {
    const vnp_Params = req.query;
    const isValid = vnpayService.verifyReturnUrl(vnp_Params);

    if (!isValid) {
      return res.redirect(`${process.env.FRONTEND_URL}/orders?payment=checksum-failed`);
    }

    const orderNumber = vnp_Params['vnp_TxnRef'];
    const responseCode = vnp_Params['vnp_ResponseCode'];

    if (responseCode === '00') {
      const order = await Order.findOne({ where: { number: orderNumber } });
      if (order && order.paymentStatus !== 'paid') {
        const t = await sequelize.transaction();
        try {
          await order.update({
            status: 'processing',
            paymentStatus: 'paid',
            paymentProvider: 'vnpay',
            paymentTransactionId: vnp_Params['vnp_TransactionNo'],
            updatedAt: new Date(),
          }, { transaction: t });

          const orderItems = await OrderItem.findAll({ where: { orderId: order.id }, transaction: t });
          for (const item of orderItems) {
            if (item.variantId) {
              await ProductVariant.decrement({ stockQuantity: item.quantity }, { where: { id: item.variantId }, transaction: t });
            } else {
              await Product.decrement({ stockQuantity: item.quantity }, { where: { id: item.productId }, transaction: t });
            }
          }
          await t.commit();
        } catch (txError) {
          await t.rollback();
          throw txError;
        }

        await clearUserCart(order.userId);
      }
      return res.redirect(`${process.env.FRONTEND_URL}/orders?payment=success&order=${orderNumber}`);
    } else {
      return res.redirect(`${process.env.FRONTEND_URL}/orders?payment=failed&code=${responseCode}`);
    }
  } catch (error) {
    logger.error('Lỗi VNPay return:', error);
    next(error);
  }
};

// Xử lý VNPay IPN (GET)
const vnpayIPN = async (req, res, next) => {
  try {
    const vnp_Params = req.query;
    const isValid = vnpayService.verifyReturnUrl(vnp_Params);

    if (!isValid) {
      return res.status(200).json({ RspCode: '97', Message: 'Checksum failed' });
    }

    const orderNumber = vnp_Params['vnp_TxnRef'];
    const responseCode = vnp_Params['vnp_ResponseCode'];
    const amount = parseInt(vnp_Params['vnp_Amount']) / 100;

    const order = await Order.findOne({ where: { number: orderNumber } });

    if (!order) {
      return res.status(200).json({ RspCode: '01', Message: 'Order not found' });
    }

    if (Math.abs(order.total - amount) > 0.01) {
      return res.status(200).json({ RspCode: '04', Message: 'Invalid amount' });
    }

    if (order.paymentStatus === 'paid') {
      return res.status(200).json({ RspCode: '02', Message: 'Order already confirmed' });
    }

    if (responseCode === '00') {
      const t = await sequelize.transaction();
      try {
        await order.update({
          status: 'processing',
          paymentStatus: 'paid',
          paymentProvider: 'vnpay',
          paymentTransactionId: vnp_Params['vnp_TransactionNo'],
          updatedAt: new Date(),
        }, { transaction: t });

        const orderItems = await OrderItem.findAll({ where: { orderId: order.id }, transaction: t });
        for (const item of orderItems) {
          if (item.variantId) {
            await ProductVariant.decrement({ stockQuantity: item.quantity }, { where: { id: item.variantId }, transaction: t });
          } else {
            await Product.decrement({ stockQuantity: item.quantity }, { where: { id: item.productId }, transaction: t });
          }
        }
        await t.commit();
      } catch (txError) {
        await t.rollback();
        throw txError;
      }

      await clearUserCart(order.userId);
      return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
    } else {
      // Thanh toán thất bại
      await order.update({
        paymentStatus: 'failed',
        updatedAt: new Date(),
      });
      return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
    }
  } catch (error) {
    logger.error('Lỗi VNPay IPN:', error);
    return res.status(200).json({ RspCode: '99', Message: 'Lỗi không xác định' });
  }
};

module.exports = {
  createPaymentIntent,
  confirmPayment,
  createCustomer,
  getPaymentMethods,
  createSetupIntent,
  handleWebhook,
  createRefund,
  handleSePayWebhook,
  createMomoUrl,
  momoReturn,
  momoIPN,
  createVNPayUrl,
  vnpayReturn,
  vnpayIPN,
};
