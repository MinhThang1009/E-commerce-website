const {
  Order,
  OrderItem,
  Cart,
  CartItem,
  Product,
  ProductVariant,
  User,
  ChatMessage,
  LoyaltyHistory,
  InventoryLog,
  sequelize,
  WarrantyPackage,
} = require('../models');
const { AppError } = require('../middlewares/errorHandler');
const logger = require('../utils/logger');
const crypto = require('crypto');
const emailService = require('../services/email');

// Import hằng số từ constants/index.js — không hardcode trong controller
const {
  POINTS_EARN_RATE,
  POINTS_VALUE,
  SHIPPING_FREE_THRESHOLD,
  SHIPPING_BASE_RATE,
  SHIPPING_WEIGHT_RATE,
} = require('../constants');
const SHIPPING_WEIGHT_THRESHOLD = 2; // Ngưỡng kg tính thêm phí

/**
 * Tính phí ship dựa trên tổng tiền hàng và tổng trọng lượng đơn hàng.
 * Backend tự tính — không nhận từ client để tránh bị manipulate.
 * @param {number} subtotal - Tổng tiền hàng (VND)
 * @param {number} totalWeightKg - Tổng trọng lượng (kg)
 * @returns {number} Phí ship (VND)
 */
function calculateShippingCost(subtotal, totalWeightKg) {
  // Miễn phí ship cho đơn hàng đủ ngưỡng
  if (subtotal >= SHIPPING_FREE_THRESHOLD) return 0;

  let cost = SHIPPING_BASE_RATE;

  // Tính thêm phí nếu tổng trọng lượng vượt ngưỡng
  if (totalWeightKg > SHIPPING_WEIGHT_THRESHOLD) {
    const extraKg = totalWeightKg - SHIPPING_WEIGHT_THRESHOLD;
    cost += Math.ceil(extraKg) * SHIPPING_WEIGHT_RATE;
  }

  return cost;
}

/**
 * Xóa giỏ hàng của user sau khi tạo đơn hàng / thanh toán thành công
 * @param {string} userId - ID của user cần xóa giỏ hàng
 */
async function clearUserCart(userId) {
  if (!userId) {
    logger.warn('clearUserCart: thiếu userId');
    return;
  }

  try {
    // Tìm tất cả giỏ hàng đang hoạt động của user
    const carts = await Cart.findAll({
      where: { userId, status: 'active' }
    });

    if (carts && carts.length > 0) {
      for (const cart of carts) {
        // Đánh dấu giỏ hàng là đã chuyển thành đơn hàng
        await cart.update({ status: 'converted' });

        // Xóa items trong giỏ để đảm bảo số lượng trả về 0
        await CartItem.destroy({
          where: { cartId: cart.id }
        });
        logger.info(`Đã xóa giỏ hàng ${cart.id} của user ${userId}`);
      }
    } else {
      logger.info(`Không tìm thấy giỏ hàng đang hoạt động của user ${userId}`);
    }
  } catch (error) {
    logger.error(`Lỗi xóa giỏ hàng của user ${userId}:`, error.message);
  }
}

// Tạo đơn hàng từ giỏ hàng
const createOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const userId = req.user.id;
    const {
      shippingFirstName,
      shippingLastName,
      shippingCompany,
      shippingAddress1,
      shippingAddress2,
      shippingCity,
      shippingState,
      shippingZip,
      shippingCountry,
      shippingPhone,
      billingFirstName,
      billingLastName,
      billingCompany,
      billingAddress1,
      billingAddress2,
      billingCity,
      billingState,
      billingZip,
      billingCountry,
      billingPhone,
      paymentMethod,
      notes,
      discountCode,
      items: providedItems, // Hỗ trợ mua ngay không qua giỏ hàng
      pointsToUse = 0,
      // shippingCost từ client bị bỏ qua — backend tự tính để tránh bị manipulate
    } = req.body;

    let itemsToProcess = [];

    if (providedItems && providedItems.length > 0) {
      // Trường hợp mua ngay hoặc cung cấp items trực tiếp
      for (const item of providedItems) {
        const product = await Product.findByPk(item.productId, {
          attributes: ['id', 'name', 'slug', 'basePrice', 'status'],
          include: [{ association: 'defaultVariant', attributes: ['id', 'stockQuantity'] }]
        });

        if (!product) {
          throw new AppError(`Không tìm thấy sản phẩm ID: ${item.productId}`, 404);
        }

        let variant = null;
        if (item.variantId) {
          variant = await ProductVariant.findByPk(item.variantId, {
            attributes: ['id', ['variant_name', 'name'], 'price', 'stockQuantity', 'sku']
          });
          if (!variant) {
            throw new AppError(`Không tìm thấy biến thể ID: ${item.variantId}`, 404);
          }
        }

        itemsToProcess.push({
          productId: product.id,
          variantId: variant ? variant.id : null,
          quantity: item.quantity,
          Product: product,
          ProductVariant: variant,
          warrantyPackageIds: item.warrantyPackageIds || []
        });
      }
    } else {
      // Lấy từ giỏ hàng hiện tại (mặc định)
      const { sessionId: cookieSessionId } = req.cookies;

      // 1. Lấy hoặc tạo giỏ hàng của user
      let [cart] = await Cart.findOrCreate({
        where: { userId, status: 'active' },
        defaults: { userId },
        transaction,
      });

      // 2. Gộp giỏ hàng khách nếu có session ID
      if (cookieSessionId) {
        const guestCart = await Cart.findOne({
          where: {
            sessionId: cookieSessionId,
            status: 'active',
            userId: null,
          },
          include: [{ model: CartItem, as: 'items' }],
          transaction,
        });

        if (guestCart && guestCart.items && guestCart.items.length > 0) {
          logger.info(`[ĐƠN HÀNG] Gộp giỏ khách ${guestCart.id} vào giỏ hàng ${cart.id} của user ${userId}`);
          for (const guestItem of guestCart.items) {
            const existingItem = await CartItem.findOne({
              where: {
                cartId: cart.id,
                productId: guestItem.productId,
                variantId: guestItem.variantId,
              },
              transaction,
            });

            if (existingItem) {
              await existingItem.update(
                { quantity: existingItem.quantity + guestItem.quantity },
                { transaction }
              );
              await guestItem.destroy({ transaction });
            } else {
              await guestItem.update({ cartId: cart.id }, { transaction });
            }
          }
          await guestCart.update({ status: 'merged' }, { transaction });
          
          // Tải lại giỏ hàng sau khi gộp
          cart = await Cart.findByPk(cart.id, {
            include: [
              {
                association: 'items',
                include: [
                  {
                    model: Product,
                    attributes: ['id', 'name', 'slug', 'basePrice', 'status'],
                    include: [{ association: 'defaultVariant', attributes: ['id', 'stockQuantity'] }]
                  },
                  {
                    model: ProductVariant,
                    attributes: ['id', ['variant_name', 'name'], 'price', 'stockQuantity', 'sku'],
                  },
                ],
              },
            ],
            transaction,
          });
        } else {
          // Không có giỏ khách, tải giỏ hàng user trực tiếp
          cart = await Cart.findByPk(cart.id, {
            include: [
              {
                association: 'items',
                include: [
                  {
                    model: Product,
                    attributes: ['id', 'name', 'slug', 'basePrice', 'status'],
                    include: [{ association: 'defaultVariant', attributes: ['id', 'stockQuantity'] }]
                  },
                  {
                    model: ProductVariant,
                    attributes: ['id', ['variant_name', 'name'], 'price', 'stockQuantity', 'sku'],
                  },
                ],
              },
            ],
            transaction,
          });
        }
      } else {
        // Không có session ID, tải giỏ hàng user trực tiếp
        cart = await Cart.findByPk(cart.id, {
          include: [
            {
              association: 'items',
              include: [
                {
                  model: Product,
                  attributes: ['id', 'name', 'slug', 'basePrice', 'status'],
                  include: [{ association: 'defaultVariant', attributes: ['id', 'stockQuantity'] }]
                },
                {
                  model: ProductVariant,
                  attributes: ['id', ['variant_name', 'name'], 'price', 'stockQuantity', 'sku'],
                },
              ],
            },
          ],
          transaction,
        });
      }

      if (!cart) {
        throw new AppError(`Không tìm thấy giỏ hàng cho người dùng ID: ${userId}`, 400);
      }
      if (cart.items.length === 0) {
        throw new AppError(`Giỏ hàng của người dùng ID: ${userId} hiện đang trống`, 400);
      }
      itemsToProcess = cart.items;
    }

    // Kiểm tra tồn kho và tính tổng tiền
    let subtotal = 0;
    let totalWeightKg = 0; // Tổng trọng lượng để tính phí ship
    const tax = 0; // Chưa áp dụng thuế
    let discount = 0; // Áp dụng mã giảm giá
    let totalWarrantyCost = 0;
    // Thu thập dữ liệu inventory log — tạo sau khi có orderId
    const pendingInventoryLogs = [];

    for (const item of itemsToProcess) {
      const product = item.Product;

      // Kiểm tra sản phẩm còn kinh doanh không
      if (product.status !== 'active') {
        throw new AppError(`Sản phẩm "${product.name}" hiện không kinh doanh`, 400);
      }

      // Kiểm tra và trừ tồn kho với FOR UPDATE lock (ngăn oversell concurrent)
      if (item.variantId) {
        const lockedVariant = await ProductVariant.findByPk(item.variantId, {
          lock: transaction.LOCK.UPDATE,
          transaction,
        });
        if (!lockedVariant || lockedVariant.stockQuantity < item.quantity) {
          throw new AppError(
            `Sản phẩm "${product.name}" chỉ còn ${lockedVariant ? lockedVariant.stockQuantity : 0} sản phẩm`,
            400
          );
        }
        const prevStock = lockedVariant.stockQuantity;
        await lockedVariant.decrement('stockQuantity', { by: item.quantity, transaction });
        // Lưu để tạo log sau khi có orderId
        pendingInventoryLogs.push({
          productId: item.productId,
          variantId: item.variantId,
          changeType: 'sale',
          changeAmount: -item.quantity,
          previousStock: prevStock,
          newStock: prevStock - item.quantity,
        });
      } else {
        const lockedProduct = await Product.findByPk(item.productId, {
          lock: transaction.LOCK.UPDATE,
          transaction,
        });
        if (!lockedProduct || lockedProduct.stockQuantity < item.quantity) {
          throw new AppError(
            `Sản phẩm "${product.name}" chỉ còn ${lockedProduct ? lockedProduct.stockQuantity : 0} sản phẩm`,
            400
          );
        }
        const prevStock = lockedProduct.stockQuantity;
        await lockedProduct.decrement('stockQuantity', { by: item.quantity, transaction });
        // Lưu để tạo log sau khi có orderId
        pendingInventoryLogs.push({
          productId: item.productId,
          variantId: null,
          changeType: 'sale',
          changeAmount: -item.quantity,
          previousStock: prevStock,
          newStock: prevStock - item.quantity,
        });
      }

      // Tính giá sản phẩm
      const variant = item.ProductVariant;
      const price = variant ? variant.price : product.basePrice;
      subtotal += price * item.quantity;

      // Tích lũy trọng lượng — dùng weight của variant nếu có, không thì bỏ qua (0)
      const itemWeight = parseFloat(variant?.weight) || 0;
      totalWeightKg += itemWeight * item.quantity;

      // Tính phí bảo hành nếu có
      if (item.warrantyPackageIds && item.warrantyPackageIds.length > 0) {
        const packages = await WarrantyPackage.findAll({
          where: { id: item.warrantyPackageIds, isActive: true },
          transaction,
        });
        
        const itemWarrantyFee = packages.reduce((sum, pkg) => sum + parseFloat(pkg.price), 0);
        item.warrantyFee = itemWarrantyFee;
        item.warrantyPackages = packages; // Dùng khi tạo order item
        totalWarrantyCost += itemWarrantyFee * item.quantity;
      } else {
        item.warrantyFee = 0;
      }
    }

    // Tính giảm giá từ mã khuyến mãi
    let discountCodeId = null;
    if (discountCode) {
      const { DiscountCode } = require('../models');
      const codeData = await DiscountCode.findOne({
        where: { code: discountCode, isActive: true },
        transaction,
      });

      if (!codeData) {
        throw new AppError('Mã giảm giá không hợp lệ hoặc đã hết hạn', 400);
      }

      const now = new Date();
      if (codeData.startDate && now < new Date(codeData.startDate)) {
        throw new AppError('Mã giảm giá chưa đến thời gian áp dụng', 400);
      }
      if (codeData.endDate && now > new Date(codeData.endDate)) {
        throw new AppError('Mã giảm giá đã hết hạn', 400);
      }
      if (codeData.usageLimit !== null && codeData.usedCount >= codeData.usageLimit) {
        throw new AppError('Mã giảm giá đã đạt giới hạn lượt sử dụng', 400);
      }
      if (subtotal < parseFloat(codeData.minOrderAmount)) {
        throw new AppError(`Đơn hàng phải tối thiểu ${codeData.minOrderAmount} để sử dụng mã này`, 400);
      }

      if (codeData.type === 'percent') {
        discount = (subtotal * parseFloat(codeData.value)) / 100;
        if (codeData.maxDiscountAmount && discount > parseFloat(codeData.maxDiscountAmount)) {
          discount = parseFloat(codeData.maxDiscountAmount);
        }
      } else {
        discount = parseFloat(codeData.value);
      }

      if (discount > subtotal) {
        discount = subtotal;
      }
      discountCodeId = codeData.id;

      // Tăng usedCount ngay cho thanh toán thủ công (COD, chuyển khoản, trả góp).
      // Với online payment (stripe, vnpay, momo, sepay), tăng sau khi payment xác nhận
      // để tránh discount code bị "dùng" mà đơn hàng chưa được thanh toán.
      const manualMethods = ['cod', 'bank_transfer', 'installment'];
      if (manualMethods.includes(paymentMethod)) {
        await codeData.increment('usedCount', { transaction });
      }
    }

    // Tính giảm giá từ điểm tích lũy
    let pointsDiscount = 0;
    const pointsToUseInt = parseInt(pointsToUse) || 0;
    if (pointsToUseInt > 0) {
      const user = await User.findByPk(userId, { transaction });
      if (user.loyaltyPoints < pointsToUseInt) {
        throw new AppError('Bạn không đủ điểm tích lũy', 400);
      }
      pointsDiscount = pointsToUseInt * POINTS_VALUE;
      if (pointsDiscount > subtotal - discount) {
        pointsDiscount = subtotal - discount;
        // Điều chỉnh nếu giảm giá vượt quá số tiền còn lại
      }
    }

    // Tính phí ship — backend tự tính để tránh client manipulate
    const shippingCost = calculateShippingCost(subtotal, totalWeightKg);

    // Tính tổng tiền
    const total = subtotal + tax + shippingCost + totalWarrantyCost - discount - pointsDiscount;

    // Tạo mã đơn hàng
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
    const orderNumber = `ORD-${year}${month}-${Date.now()}-${rand}`;

    // Hủy đơn pending cũ — mỗi tài khoản chỉ có 1 đơn pending tại một thời điểm
    await Order.update(
      { status: 'cancelled' },
      {
        where: {
          userId,
          status: 'pending',
        },
        transaction,
      }
    );

    // Trừ điểm tích lũy nếu user dùng điểm
    if (pointsToUseInt > 0) {
      const user = await User.findByPk(userId, { transaction });
      await user.update({
        loyaltyPoints: user.loyaltyPoints - pointsToUseInt
      }, { transaction });

      // Ghi lịch sử sử dụng điểm
      await LoyaltyHistory.create({
        userId,
        points: -pointsToUseInt,
        type: 'spend',
        description: `Sử dụng điểm cho đơn hàng ${orderNumber}`
      }, { transaction });
    }

    // Tạo đơn hàng
    const order = await Order.create(
      {
        number: orderNumber,
        userId,
        shippingFirstName,
        shippingLastName,
        shippingCompany,
        shippingAddress1,
        shippingAddress2,
        shippingCity,
        shippingState,
        shippingZip,
        shippingCountry,
        shippingPhone,
        billingFirstName,
        billingLastName,
        billingCompany,
        billingAddress1,
        billingAddress2,
        billingCity,
        billingState,
        billingZip,
        billingCountry,
        billingPhone,
        paymentMethod,
        paymentStatus: 'pending',
        subtotal,
        tax,
        shippingCost,
        discount,
        discountCodeId,
        total,
        warrantyCost: totalWarrantyCost,
        pointsUsed: pointsToUseInt,
        pointsDiscount,
        notes,
      },
      { transaction }
    );

    // Tạo các mục đơn hàng
    const orderItems = [];
    for (const item of itemsToProcess) {
      const product = item.Product;
      const variant = item.ProductVariant;
      const price = variant ? variant.price : product.basePrice;
      const subtotal = price * item.quantity;

      const orderItem = await OrderItem.create(
        {
          orderId: order.id,
          productId: product.id,
          variantId: variant ? variant.id : null,
          name: product.name,
          sku: variant ? variant.sku : product.sku,
          unitPrice: price,
          quantity: item.quantity,
          subtotal,
          image: product.thumbnail,
          attributes: {
            ...(variant ? { variant: variant.name } : {}),
            warrantyPackages: item.warrantyPackages ? item.warrantyPackages.map(pkg => ({
              id: pkg.id,
              name: pkg.name,
              price: pkg.price
            })) : []
          },
          warrantyPackageIds: item.warrantyPackageIds || null,
        },
        { transaction }
      );

      orderItems.push(orderItem);

      // Tồn kho KHÔNG bị trừ ở đây — đã trừ trong vòng lặp kiểm tra tồn kho phía trên
    }

    // Tạo inventory log cho tất cả items sau khi có orderId
    if (pendingInventoryLogs.length > 0) {
      await InventoryLog.bulkCreate(
        pendingInventoryLogs.map(log => ({ ...log, orderId: order.id })),
        { transaction }
      );
    }

    // Với thanh toán online (vnpay, momo, stripe): giỏ hàng chưa xóa ở đây,
    // chỉ xóa sau khi webhook thanh toán xác nhận thành công —
    // để user giữ lại giỏ nếu hủy hoặc thất bại và thử lại.
    // Với COD và thanh toán thủ công: xóa giỏ ngay.
    const manualPaymentMethods = ['cod', 'bank_transfer', 'installment'];
    if (manualPaymentMethods.includes(paymentMethod)) {
      await clearUserCart(userId);
      logger.info(`Đã xóa giỏ hàng của user ${userId} vì phương thức thanh toán là ${paymentMethod}`);
    }

    // Cập nhật orderId cho lịch sử loyalty vừa tạo
    if (pointsToUseInt > 0) {
      await LoyaltyHistory.update(
        { orderId: order.id },
        { where: { userId, type: 'spend', description: `Sử dụng điểm cho đơn hàng ${orderNumber}` }, transaction }
      );
    }

    // Xác nhận transaction
    await transaction.commit();

    // Gửi email xác nhận đơn hàng (bất đồng bộ)
    // Lưu ý: cũng được gửi khi xác nhận thanh toán, nhưng hữu ích để thông báo trạng thái pending.
    emailService.sendOrderConfirmationEmail(req.user.email, {
      orderNumber: order.number,
      orderDate: order.createdAt,
      total: order.total,
      items: orderItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.unitPrice,
        subtotal: item.subtotal,
      })),
      shippingAddress: {
        name: `${order.shippingFirstName} ${order.shippingLastName}`,
        address1: order.shippingAddress1,
        address2: order.shippingAddress2,
        city: order.shippingCity,
        state: order.shippingState,
        zip: order.shippingZip,
        country: order.shippingCountry,
      },
    }).catch(err => logger.error('Lỗi gửi email xác nhận đơn hàng:', err));

    res.status(201).json({
      status: 'success',
      data: {
        order: {
          id: order.id,
          number: order.number,
          status: order.status,
          total: order.total,
          createdAt: order.createdAt,
        },
      },
    });
  } catch (error) {
    logger.error('[LỖI] Tạo đơn hàng thất bại:', error);
    if (transaction) await transaction.rollback();
    next(error);
  }
};

// Lấy danh sách đơn hàng của user
const getUserOrders = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);

    const { count, rows: orders } = await Order.findAndCountAll({
      where: { userId },
      include: [
        {
          association: 'items',
          include: [
            {
              model: Product,
              attributes: ['id', 'name', 'basePrice', 'slug'],
              include: [
                {
                  association: 'productImages',
                  attributes: ['id', 'imageUrl', 'isThumbnail']
                }
              ]
            },
            {
              model: ProductVariant,
              attributes: ['id', ['variant_name', 'name'], 'sku', 'price'],
            },
          ],
        },
      ],
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']],
    });

    res.status(200).json({
      status: 'success',
      data: orders,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    next(error);
  }
};

// Lấy chi tiết đơn hàng theo ID
const getOrderById = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const role = req.user.role;

    const order = await Order.findByPk(id, {
      include: [
        {
          model: User,
          attributes: ['id', 'firstName', 'lastName', 'email', 'phone'],
        },
        {
          association: 'items',
          include: [
            {
              model: Product,
              attributes: ['id', 'name', 'slug'],
              include: [
                {
                  association: 'productImages',
                  attributes: ['id', 'imageUrl', 'isThumbnail']
                }
              ]
            },
            {
              model: ProductVariant,
              attributes: ['id', ['variant_name', 'name'], 'sku', 'price'],
            },
          ],
        },
      ],
    });

    if (!order) {
      throw new AppError('Không tìm thấy đơn hàng', 404);
    }

    if (order.userId !== userId && role !== 'admin') {
      throw new AppError('Bạn không có quyền truy cập đơn hàng này', 403);
    }

    res.status(200).json({
      status: 'success',
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// Lấy đơn hàng theo mã đơn
const getOrderByNumber = async (req, res, next) => {
  try {
    const { number } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({
      where: { number, userId },
      include: [
        {
          association: 'items',
          include: [
            {
              model: Product,
              attributes: ['id', 'name', 'slug'],
              include: [
                {
                  association: 'productImages',
                  attributes: ['id', 'imageUrl', 'isThumbnail']
                }
              ]
            },
            {
              model: ProductVariant,
              attributes: ['id', ['variant_name', 'name'], 'sku', 'price'],
            },
          ],
        },
      ],
    });

    if (!order) {
      throw new AppError('Không tìm thấy đơn hàng', 404);
    }

    res.status(200).json({
      status: 'success',
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

// Hủy đơn hàng
const cancelOrder = async (req, res, next) => {
  const transaction = await sequelize.transaction();

  try {
    const { id } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({
      where: { id, userId },
      include: [
        {
          association: 'items',
          include: [
            {
              model: Product,
            },
            {
              model: ProductVariant,
            },
          ],
        },
      ],
    });

    if (!order) {
      throw new AppError('Không tìm thấy đơn hàng', 404);
    }

    // Kiểm tra đơn hàng có thể hủy không
    if (order.status !== 'pending' && order.status !== 'processing') {
      throw new AppError('Không thể hủy đơn hàng này', 400);
    }

    // Cập nhật trạng thái đơn hàng
    await order.update(
      {
        status: 'cancelled',
      },
      { transaction }
    );

    // Hoàn tồn kho
    for (const item of order.items) {
      if (item.variantId) {
        const variant = item.ProductVariant;
        await variant.update(
          {
            stockQuantity: variant.stockQuantity + item.quantity,
          },
          { transaction }
        );
      } else {
        const product = item.Product;
        await product.update(
          {
            stockQuantity: product.stockQuantity + item.quantity,
          },
          { transaction }
        );
      }
    }

    // 1. Hoàn điểm tích lũy nếu đã dùng khi đặt hàng
    if (order.pointsUsed > 0) {
      const user = await User.findByPk(userId, { transaction });
      await user.update({
        loyaltyPoints: user.loyaltyPoints + order.pointsUsed
      }, { transaction });

      await LoyaltyHistory.create({
        userId,
        orderId: order.id,
        points: order.pointsUsed,
        type: 'refund',
        description: `Hoàn điểm cho đơn hàng bị hủy ${order.number}`
      }, { transaction });
    }

    // 2. Thu hồi điểm đã trao nếu đơn đã được giao trước đó
    if (order.pointsEarned > 0) {
      const user = await User.findByPk(userId, { transaction });
      await user.update({
        loyaltyPoints: Math.max(0, user.loyaltyPoints - order.pointsEarned)
      }, { transaction });

      await LoyaltyHistory.create({
        userId,
        orderId: order.id,
        points: -order.pointsEarned,
        type: 'refund',
        description: `Thu hồi điểm tích lũy do hủy/trả đơn hàng ${order.number}`
      }, { transaction });
    }

    await transaction.commit();

    // Gửi email thông báo hủy đơn (bất đồng bộ — không block response, không rollback nếu lỗi)
    emailService.sendOrderCancellationEmail(req.user.email, {
      orderNumber: order.number,
      orderDate: order.createdAt,
    }).catch(err => logger.error('Lỗi gửi email hủy đơn:', err));

    res.status(200).json({
      status: 'success',
      message: 'Đơn hàng đã được hủy',
      data: {
        id: order.id,
        number: order.number,
        status: 'cancelled',
      },
    });
  } catch (error) {
    await transaction.rollback();
    next(error);
  }
};

// Admin: Lấy tất cả đơn hàng
const getAllOrders = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const { status } = req.query;

    const whereConditions = {};
    if (status) {
      whereConditions.status = status;
    }

    const { count, rows: orders } = await Order.findAndCountAll({
      where: whereConditions,
      limit: parseInt(limit),
      offset: (parseInt(page) - 1) * parseInt(limit),
      order: [['createdAt', 'DESC']],
      include: [
        {
          association: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
      ],
    });

    res.status(200).json({
      status: 'success',
      data: orders,
      total: count,
      page: parseInt(page),
      limit: parseInt(limit),
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Cập nhật trạng thái đơn hàng
const updateOrderStatus = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const order = await Order.findByPk(id, {
      include: [
        {
          association: 'user',
          attributes: ['id', 'firstName', 'lastName', 'email'],
        },
      ],
    });

    if (!order) {
      throw new AppError('Không tìm thấy đơn hàng', 404);
    }

    // Cập nhật trạng thái đơn hàng
    const previousStatus = order.status;
    const updateData = { status };

    // Tự động đánh dấu đã thanh toán khi đơn COD được giao thành công
    if (status === 'delivered' && order.paymentMethod === 'cod') {
      updateData.paymentStatus = 'paid';
    }

    await order.update(updateData);

    // Trao điểm tích lũy khi trạng thái chuyển sang đã giao
    if (status === 'delivered' && previousStatus !== 'delivered') {
      const pointsEarned = Math.floor(parseFloat(order.subtotal) / POINTS_EARN_RATE);
      if (pointsEarned > 0) {
        const user = await User.findByPk(order.userId);
        if (user) {
          await user.update({
            loyaltyPoints: user.loyaltyPoints + pointsEarned
          });

          await LoyaltyHistory.create({
            userId: order.userId,
            orderId: order.id,
            points: pointsEarned,
            type: 'earn',
            description: `Tích điểm từ đơn hàng ${order.number}`
          });

          // Lưu số điểm đã trao vào đơn hàng
          await order.update({ pointsEarned });
        }
      }
    }

    // Gửi email thông báo cập nhật trạng thái
    await emailService.sendOrderStatusUpdateEmail(order.user.email, {
      orderNumber: order.number,
      orderDate: order.createdAt,
      status,
    });

    res.status(200).json({
      status: 'success',
      message: 'Cập nhật trạng thái đơn hàng thành công',
      data: {
        id: order.id,
        number: order.number,
        status: order.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Thanh toán lại đơn hàng
 */
const repayOrder = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Tìm đơn hàng
    const order = await Order.findOne({
      where: { id, userId },
    });

    if (!order) {
      throw new AppError('Không tìm thấy đơn hàng', 404);
    }

    // Kiểm tra trạng thái đơn hàng
    if (
      order.status !== 'pending' &&
      order.status !== 'cancelled' &&
      order.paymentStatus !== 'failed'
    ) {
      throw new AppError('Đơn hàng này không thể thanh toán lại', 400);
    }

    // Cập nhật trạng thái đơn hàng
    await order.update({
      status: 'pending',
      paymentStatus: 'pending',
    });

    // Lấy origin từ request header để tạo URL thanh toán động
    const origin = req.get('origin') || process.env.FRONTEND_URL;

    // Tạo URL thanh toán giả lập
    // Trong thực tế, bạn sẽ tích hợp với cổng thanh toán thực tế ở đây
    const paymentUrl = `${origin}/checkout?repayOrder=${order.id}&amount=${order.total}`;

    res.status(200).json({
      status: 'success',
      message: 'Đơn hàng đã được cập nhật để thanh toán lại',
      data: {
        id: order.id,
        number: order.number,
        status: order.status,
        paymentStatus: order.paymentStatus,
        total: order.total,
        paymentUrl: paymentUrl, // Thêm URL thanh toán vào response
      },
    });
  } catch (error) {
    next(error);
  }
};

const confirmReceived = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const order = await Order.findOne({
      where: { id, userId },
    });

    if (!order) {
      throw new AppError('Không tìm thấy đơn hàng', 404);
    }

    if (order.status === 'delivered' && order.pointsEarned !== 0) {
      return res.status(200).json({
        status: 'success',
        message: 'Đơn hàng đã được xác nhận và tích điểm trước đó',
        data: order
      });
    }

    if (order.status !== 'shipped' && order.status !== 'processing' && order.status !== 'delivered') {
      throw new AppError('Chỉ có thể xác nhận đơn hàng khi đang giao, đang xử lý hoặc đã giao hàng', 400);
    }

    const previousStatus = order.status;
    const updateData = { status: 'delivered' };

    // Tự động đánh dấu đã thanh toán nếu là COD
    if (order.paymentMethod === 'cod') {
      updateData.paymentStatus = 'paid';
    }

    await order.update(updateData);
    await order.reload();

    let earnedPointsTotal = order.pointsEarned || 0;
    let newPointsAwarded = 0;

    // Trao điểm tích lũy nếu chưa được trao (pointsEarned = 0 nghĩa là chưa xử lý)
    if (earnedPointsTotal === 0) {
      const orderTotal = parseFloat(order.subtotal);
      newPointsAwarded = Math.floor(orderTotal / POINTS_EARN_RATE);

      if (newPointsAwarded > 0) {
        const user = await User.findByPk(userId);
        if (user) {
          await user.update({
            loyaltyPoints: user.loyaltyPoints + newPointsAwarded
          });

          await LoyaltyHistory.create({
            userId,
            orderId: order.id,
            points: newPointsAwarded,
            type: 'earn',
            description: `Tích điểm từ đơn hàng ${order.number} (Người dùng xác nhận)`
          });

          earnedPointsTotal = newPointsAwarded;
          await order.update({ pointsEarned: earnedPointsTotal });
        }
      } else if (orderTotal > 0) {
        // Đánh dấu đã xử lý dù không đủ điểm
        earnedPointsTotal = -1;
        await order.update({ pointsEarned: -1 });
      }
    }

    res.status(200).json({
      status: 'success',
      message: 'Xác nhận đã nhận hàng thành công',
      pointsEarned: newPointsAwarded > 0 ? newPointsAwarded : 0,
      data: {
        id: order.id,
        number: order.number,
        status: 'delivered',
        pointsEarned: earnedPointsTotal
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/orders/track?orderNumber=X&email=Y — Tra cứu công khai, không cần đăng nhập
const trackOrder = async (req, res, next) => {
  try {
    const { orderNumber, email } = req.query;

    if (!orderNumber || !email) {
      return res.status(400).json({ status: 'error', message: 'Vui lòng cung cấp mã đơn hàng và email' });
    }

    const order = await Order.findOne({
      where: { number: orderNumber },
      include: [{ model: User, attributes: ['email'] }],
    });

    // Kiểm tra email khớp để tránh liệt kê đơn hàng của người khác
    if (!order || order.User?.email?.toLowerCase() !== email.toLowerCase()) {
      return res.status(404).json({ status: 'error', message: 'Không tìm thấy đơn hàng với thông tin đã cung cấp' });
    }

    // Map trạng thái đơn hàng sang danh sách các bước stepper
    const STATUS_ORDER = ['pending', 'processing', 'shipped', 'delivered'];
    const currentIndex = STATUS_ORDER.indexOf(order.status);

    const steps = [
      { key: 'pending',    label: 'Đã đặt hàng',          completed: currentIndex >= 0 && order.status !== 'cancelled' },
      { key: 'processing', label: 'Đang chuẩn bị',         completed: currentIndex >= 1 },
      { key: 'shipped',    label: 'Đang giao',              completed: currentIndex >= 2 },
      { key: 'delivered',  label: 'Đã nhận hàng',           completed: currentIndex >= 3 },
    ];

    res.status(200).json({
      status: 'success',
      data: {
        orderNumber: order.number,
        currentStatus: order.status,
        steps,
        isCancelled: order.status === 'cancelled',
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

// GET /api/orders/shipping-estimate — Trả phí ship ước tính để frontend hiển thị trước khi tạo đơn
const estimateShipping = (req, res) => {
  const subtotal = parseFloat(req.query.subtotal) || 0;
  const weight = parseFloat(req.query.weight) || 0;
  const shippingCost = calculateShippingCost(subtotal, weight);
  res.status(200).json({ data: { shippingCost, freeShippingThreshold: SHIPPING_FREE_THRESHOLD } });
};

module.exports = {
  createOrder,
  getUserOrders,
  getOrderById,
  getOrderByNumber,
  cancelOrder,
  getAllOrders,
  updateOrderStatus,
  repayOrder,
  confirmReceived,
  estimateShipping,
  trackOrder,
  clearUserCart, // Dùng trong payment controller
};
