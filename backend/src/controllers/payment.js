const logger = require('../utils/logger');
const momoService = require('../services/payment/momo');
const vnpayService = require('../services/payment/vnpay');
const emailService = require('../services/email');
const { Order, User, OrderItem, Product, ProductVariant, Cart, CartItem, DiscountCode } = require('../models');
const { AppError } = require('../middlewares/errorHandler');
const { Op } = require('sequelize');
const sequelize = require('../config/sequelize');
const moment = require('moment');

// Tải toàn bộ dữ liệu đơn hàng và gửi email xác nhận — không block flow thanh toán nếu email thất bại
const sendOrderConfirmationEmailSafe = async (orderId) => {
  try {
    const order = await Order.findByPk(orderId, {
      include: [
        {
          model: OrderItem,
          as: 'items',
          attributes: ['name', 'quantity', 'unitPrice', 'subtotal'],
        },
        {
          model: User,
          attributes: ['email'],
        },
      ],
    });

    if (!order || !order.User) return;

    const items = (order.items || []).map((item) => ({
      name: item.name,
      quantity: item.quantity,
      price: parseFloat(item.unitPrice),
      subtotal: parseFloat(item.subtotal),
    }));

    await emailService.sendOrderConfirmationEmail(order.User.email, {
      orderNumber: order.number,
      orderDate: order.createdAt,
      subtotal: parseFloat(order.subtotal),
      shippingCost: parseFloat(order.shippingCost),
      total: parseFloat(order.total),
      items,
      shippingAddress: {
        name: `${order.shippingFirstName} ${order.shippingLastName}`,
        address1: order.shippingAddress1,
        address2: order.shippingAddress2,
        city: order.shippingCity,
        state: order.shippingState,
        zip: order.shippingZip,
        country: order.shippingCountry,
      },
      estimatedDelivery: order.estimatedDelivery,
    });
  } catch (err) {
    logger.error(`[Payment] Gửi email xác nhận đơn hàng ${orderId} thất bại: ${err.message}`);
  }
};

/**
 * Tăng usedCount của discount code khi thanh toán thành công.
 * Dùng chung cho tất cả payment methods (vnpay, momo, sepay).
 * Idempotent — order.discountCodeId null thì không làm gì.
 */
async function incrementDiscountCodeUsage(orderId, transactionInstance) {
  const options = transactionInstance ? { transaction: transactionInstance } : {};
  const order = await Order.findByPk(orderId, {
    attributes: ['id', 'discountCodeId'],
    ...options,
  });
  if (!order || !order.discountCodeId) return;
  await DiscountCode.increment('usedCount', {
    where: { id: order.discountCodeId },
    ...options,
  });
}

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
    if (order.paymentProvider === 'vnpay') {
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

      // Đã loại bỏ fuzzy LIKE matching — chỉ exact match + format variants ở trên.
      // LIKE '%...%' có thể match nhầm order khác, gây risk payment hijacking.
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
      // Stock đã trừ tại order creation — chỉ cập nhật trạng thái
      await Order.update(
        {
          status: 'processing',
          paymentStatus: 'paid',
          paymentTransactionId: id.toString(),
          paymentProvider: 'sepay',
          updatedAt: new Date(),
        },
        { where: { id: order.id } }
      );

      logger.info('Đã cập nhật đơn hàng thành công:', {
        orderId: order.id,
        orderNumber: order.number,
        paymentStatus: 'paid',
        status: 'processing',
        transactionId: id,
        paymentDate: parsedTransactionDate
      });

      // Tăng usedCount của discount code sau khi SePay xác nhận thanh toán
      await incrementDiscountCodeUsage(order.id);

      // Xóa giỏ hàng đang hoạt động của user (ngoài transaction — không rollback nếu xóa thất bại)
      await clearUserCart(order.userId);
      // Gửi email xác nhận đơn hàng — không block webhook response nếu email thất bại
      await sendOrderConfirmationEmailSafe(order.id);

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
          // Stock đã trừ tại order creation — chỉ cập nhật trạng thái
          await order.update({
            status: 'processing',
            paymentStatus: 'paid',
            paymentProvider: 'momo',
            updatedAt: new Date(),
          });
          // Tăng usedCount của discount code sau khi MoMo xác nhận thanh toán
          await incrementDiscountCodeUsage(order.id);
          await clearUserCart(order.userId);
          // Gửi email xác nhận đơn hàng — không block redirect nếu email thất bại
          await sendOrderConfirmationEmailSafe(order.id);
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
    logger.info('Đã nhận MoMo IPN:', { resultCode: req.body.resultCode, orderId: req.body.orderId, transId: req.body.transId });
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
        // Stock đã trừ tại order creation — chỉ cập nhật trạng thái
        await order.update({
          status: 'processing',
          paymentStatus: 'paid',
          paymentTransactionId: transId,
          paymentProvider: 'momo',
          updatedAt: new Date(),
        });
        await clearUserCart(order.userId);
        // Gửi email xác nhận đơn hàng — không block IPN response nếu email thất bại
        await sendOrderConfirmationEmailSafe(order.id);
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
        // Stock đã trừ tại order creation — chỉ cập nhật trạng thái
        await order.update({
          status: 'processing',
          paymentStatus: 'paid',
          paymentProvider: 'vnpay',
          paymentTransactionId: vnp_Params['vnp_TransactionNo'],
          updatedAt: new Date(),
        });
        // Tăng usedCount của discount code sau khi VNPay return xác nhận
        await incrementDiscountCodeUsage(order.id);
        await clearUserCart(order.userId);
        // Gửi email xác nhận đơn hàng — không block redirect nếu email thất bại
        await sendOrderConfirmationEmailSafe(order.id);
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
      // Stock đã trừ tại order creation — chỉ cập nhật trạng thái
      await order.update({
        status: 'processing',
        paymentStatus: 'paid',
        paymentProvider: 'vnpay',
        paymentTransactionId: vnp_Params['vnp_TransactionNo'],
        updatedAt: new Date(),
      });
      // Tăng usedCount của discount code sau khi VNPay IPN xác nhận
      await incrementDiscountCodeUsage(order.id);
      await clearUserCart(order.userId);
      // Gửi email xác nhận đơn hàng — không block IPN response nếu email thất bại
      await sendOrderConfirmationEmailSafe(order.id);
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
  createRefund,
  handleSePayWebhook,
  createMomoUrl,
  momoReturn,
  momoIPN,
  createVNPayUrl,
  vnpayReturn,
  vnpayIPN,
};
