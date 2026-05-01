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
  sequelize,
  WarrantyPackage,
} = require('../models');
const { AppError } = require('../middlewares/errorHandler');
const emailService = require('../services/email/emailService');

// Loyalty configuration
const POINTS_EARN_RATE = 100000; // 1 point per 100,000 VND spent
const POINTS_VALUE = 1000; // 1 point = 1,000 VND discount

/**
 * Helper function to clear user cart after successful order creation/payment
 * @param {string} userId - ID of the user whose cart should be cleared
 */
async function clearUserCart(userId) {
  if (!userId) {
    console.warn('clearUserCart: userId is missing');
    return;
  }

  try {
    // Find all active carts for this user just in case
    const carts = await Cart.findAll({
      where: { userId, status: 'active' }
    });

    if (carts && carts.length > 0) {
      for (const cart of carts) {
        // Mark as converted (turned into an order)
        await cart.update({ status: 'converted' });

        // Also destroy items to be double sure count returns 0
        await CartItem.destroy({
          where: { cartId: cart.id }
        });
        console.log(`[SUCCESS] Cart ${cart.id} cleared for user ${userId}`);
      }
    } else {
      console.log(`[INFO] No active cart found to clear for user ${userId}`);
    }
  } catch (error) {
    console.error(`[ERROR] Error clearing cart for user ${userId}:`, error.message);
  }
}

// Create order from cart
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
      shippingCost: clientShippingCost = 0,
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

      // 1. Get or create user cart
      let [cart] = await Cart.findOrCreate({
        where: { userId, status: 'active' },
        defaults: { userId },
        transaction,
      });

      // 2. Merge guest cart if session ID exists
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
          console.log(`[ORDER] Merging guest cart ${guestCart.id} into user cart ${cart.id} for user ${userId}`);
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
          
          // Re-fetch user cart to get updated items
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
          // If no guest cart, just fetch the user cart properly with items
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
        // No session ID, just fetch user cart with items
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

    // Check stock and calculate totals
    let subtotal = 0;
    const tax = 0; // Calculate tax if needed
    const shippingCost = parseFloat(clientShippingCost) || 0; // Receive from client or calculate
    let discount = 0; // Apply discount if needed
    let totalWarrantyCost = 0;

    for (const item of itemsToProcess) {
      const product = item.Product;
      const variant = item.ProductVariant;

      // Check if product is active
      if (product.status !== 'active' && product.status !== 'Đang kinh doanh') {
        throw new AppError(`Sản phẩm "${product.name}" hiện không kinh doanh`, 400);
      }

      // Check stock quantity
      if (variant) {
        if (variant.stockQuantity < item.quantity) {
          throw new AppError(
            `Biến thể "${variant.name}" của sản phẩm "${product.name}" chỉ còn ${variant.stockQuantity} sản phẩm`,
            400
          );
        }
      } else {
        const stock = product.defaultVariant ? product.defaultVariant.stockQuantity : 0;
        if (stock < item.quantity) {
          throw new AppError(
            `Sản phẩm "${product.name}" chỉ còn ${stock} sản phẩm`,
            400
          );
        }
      }

      // Calculate item price
      const price = variant ? variant.price : product.basePrice;
      subtotal += price * item.quantity;

      // Calculate warranty cost if any
      if (item.warrantyPackageIds && item.warrantyPackageIds.length > 0) {
        const packages = await WarrantyPackage.findAll({
          where: { id: item.warrantyPackageIds, isActive: true },
          transaction,
        });
        
        const itemWarrantyFee = packages.reduce((sum, pkg) => sum + parseFloat(pkg.price), 0);
        item.warrantyFee = itemWarrantyFee;
        item.warrantyPackages = packages; // For later use in attributes
        totalWarrantyCost += itemWarrantyFee * item.quantity;
      } else {
        item.warrantyFee = 0;
      }
    }

    // Calculate Discount
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

      // Tăng lượt sử dụng
      await codeData.update({ usedCount: codeData.usedCount + 1 }, { transaction });
    }

    // Calculate Point Discount
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
        // Adjust points used if discount exceeds subtotal
        // This is a safety check
      }
    }

    // Calculate total
    const total = subtotal + tax + shippingCost + totalWarrantyCost - discount - pointsDiscount;

    // Generate order number
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const count = await Order.count();
    const orderNumber = `ORD-${year}${month}-${(count + 1).toString().padStart(5, '0')}`;

    // Cancel any existing pending orders for this user (Ensure ONLY ONE pending order per account)
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

    // Update User Loyalty Points if used
    if (pointsToUseInt > 0) {
      const user = await User.findByPk(userId, { transaction });
      await user.update({
        loyaltyPoints: user.loyaltyPoints - pointsToUseInt
      }, { transaction });

      // Record loyalty history
      await LoyaltyHistory.create({
        userId,
        points: -pointsToUseInt,
        type: 'spend',
        description: `Sử dụng điểm cho đơn hàng ${orderNumber}`
      }, { transaction });
    }

    // Create order
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

    // Create order items
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
          price,
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

      // NOTE: Stock is NOT reduced here anymore. 
      // Stock will be reduced only AFTER successful payment in the payment webhook
      // This prevents inventory issues when customers don't complete payment
    }

    // NOTE: CartItems are NOT cleared here anymore for ONLINE payments (vnpay, momo, stripe).
    // They will be cleared ONLY AFTER successful payment in the payment webhook (confirmPayment / momoReturn).
    // This allows the user to retain their cart items if they cancel/fail the payment window and try again.

    // BUT we SHOULD clear for COD and other manual methods that don't have a payment webhook.
    const manualPaymentMethods = ['cod', 'bank_transfer', 'installment'];
    if (manualPaymentMethods.includes(paymentMethod)) {
      await clearUserCart(userId);
      console.log(`[SUCCESS] Cart cleared for user ${userId} because payment method is ${paymentMethod}`);
    }

    // Update LoyaltyHistory with orderId now that we have it
    if (pointsToUseInt > 0) {
      await LoyaltyHistory.update(
        { orderId: order.id },
        { where: { userId, type: 'spend', description: `Sử dụng điểm cho đơn hàng ${orderNumber}` }, transaction }
      );
    }

    // Commit the transaction
    await transaction.commit();

    // Send order confirmation email (async)
    // Note: This is optional here as it's triggered during payment confirmation too,
    // but useful for 'pending' status awareness.
    emailService.sendOrderConfirmationEmail(req.user.email, {
      orderNumber: order.number,
      orderDate: order.createdAt,
      total: order.total,
      items: orderItems.map((item) => ({
        name: item.name,
        quantity: item.quantity,
        price: item.price,
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
    }).catch(err => console.error('Error sending order confirmation email:', err));

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
    console.error('[ERROR] createOrder fail:', error);
    try {
      const fs = require('fs');
      const path = require('path');
      const errorLogPath = path.join(__dirname, '../../error_checkout.log');
      fs.appendFileSync(errorLogPath, `[${new Date().toISOString()}] Checkout Error: ${error.message}\nStack: ${error.stack}\n\n`);
    } catch (logError) {
      console.error('Failed to write to error log file:', logError);
    }
    if (transaction) await transaction.rollback();
    next(error);
  }
};

// Get user orders
const getUserOrders = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const { page = 1, limit = 10 } = req.query;

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
      data: {
        total: count,
        pages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        orders,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Get order by ID
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

// Get order by number
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

// Cancel order
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

    // Check if order can be cancelled
    if (order.status !== 'pending' && order.status !== 'processing') {
      throw new AppError('Không thể hủy đơn hàng này', 400);
    }

    // Update order status
    await order.update(
      {
        status: 'cancelled',
      },
      { transaction }
    );

    // Restore stock
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

    // 1. Refund loyalty points if used during purchase
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

    // 2. Deduct earned points if the order was already delivered (pointsEarned > 0)
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

    // Send cancellation email
    await emailService.sendOrderCancellationEmail(req.user.email, {
      orderNumber: order.number,
      orderDate: order.createdAt,
    });

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

// Admin: Get all orders
const getAllOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 10, status } = req.query;

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
      data: {
        total: count,
        pages: Math.ceil(count / limit),
        currentPage: parseInt(page),
        orders,
      },
    });
  } catch (error) {
    next(error);
  }
};

// Admin: Update order status
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

    // Update order status
    const previousStatus = order.status;
    const updateData = { status };

    // Automatically set payment status to paid if COD order is delivered
    if (status === 'delivered' && order.paymentMethod === 'cod') {
      updateData.paymentStatus = 'paid';
    }

    await order.update(updateData);

    // Award loyalty points if status changed to delivered
    if (status === 'delivered' && previousStatus !== 'delivered') {
      const pointsEarned = Math.floor(parseFloat(order.total) / POINTS_EARN_RATE);
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

          // Update order's record of points earned
          await order.update({ pointsEarned });
        }
      }
    }

    // Send status update email
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
    const origin = req.get('origin') || 'http://localhost:5175';

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

    // Automatically set payment status to paid if COD order
    if (order.paymentMethod === 'cod') {
      updateData.paymentStatus = 'paid';
    }

    await order.update(updateData);
    await order.reload();

    let earnedPointsTotal = order.pointsEarned || 0;
    let newPointsAwarded = 0;

    // Award loyalty points if they haven't been awarded yet (0 means not processed)
    if (earnedPointsTotal === 0) {
      const orderTotal = parseFloat(order.total);
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
        // Mark as processed even if 0 points
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
  clearUserCart, // Export for use in payment controller if needed
};
