const crypto = require('crypto');
const { AppError } = require('../../../shared/errors');

// --- Inline từ OrderStatusPolicy (đã xóa domain layer Phase 1) ---
const STATUS = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
};
function _canCancel(status) {
  return status === STATUS.PENDING || status === STATUS.PROCESSING;
}
function _canRepay(status, paymentStatus) {
  return status === STATUS.PENDING || status === STATUS.CANCELLED || paymentStatus === 'failed';
}
function _canConfirmReceived(status) {
  return status === STATUS.SHIPPED || status === STATUS.PROCESSING || status === STATUS.DELIVERED;
}
function _buildTrackingSteps(status) {
  const progression = ['pending', 'processing', 'shipped', 'delivered'];
  const idx = progression.indexOf(status);
  return [
    { key: 'pending', label: 'Đã đặt hàng', completed: idx >= 0 && status !== STATUS.CANCELLED },
    { key: 'processing', label: 'Đang chuẩn bị', completed: idx >= 1 },
    { key: 'shipped', label: 'Đang giao', completed: idx >= 2 },
    { key: 'delivered', label: 'Đã nhận hàng', completed: idx >= 3 },
  ];
}
// --- Inline từ ShippingPolicy (đã xóa domain layer Phase 1) ---
function _calcShippingCost({ subtotal, totalWeightKg, freeThreshold, baseRate, weightRate }) {
  if (subtotal >= freeThreshold) return 0;
  let cost = baseRate;
  if (totalWeightKg > 2) cost += Math.ceil(totalWeightKg - 2) * weightRate;
  return cost;
}

// Orders Service — pure business logic; mọi data access qua repo.
class OrdersService {
  constructor({
    ordersRepository,
    emailGateway,
    eventBus,
    logger,
    constants, // POINTS_EARN_RATE, POINTS_VALUE, SHIPPING_*
  }) {
    this.repo = ordersRepository;
    this.emailGateway = emailGateway;
    this.eventBus = eventBus;
    this.logger = logger;
    this.constants = constants;
  }

  // ---------- Helpers ----------

  _generateOrderNumber() {
    const date = new Date();
    const year = date.getFullYear().toString().substr(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const rand = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `ORD-${year}${month}-${Date.now()}-${rand}`;
  }

  _calculateShipping(subtotal, totalWeightKg) {
    return _calcShippingCost({
      subtotal,
      totalWeightKg,
      freeThreshold: this.constants.SHIPPING_FREE_THRESHOLD,
      baseRate: this.constants.SHIPPING_BASE_RATE,
      weightRate: this.constants.SHIPPING_WEIGHT_RATE,
    });
  }

  // ---------- Use cases ----------

  // Tạo đơn hàng từ giỏ hàng hoặc items provided. SELECT FOR UPDATE chống
  // oversell concurrent (Rule 12).
  async createOrder({ user, body, sessionIdCookie }) {
    const userId = user.id;
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
      items: providedItems,
      pointsToUse = 0,
    } = body;

    let createdOrder;
    let orderItemsForEmail;

    await this.repo.runInTransaction(async (transaction) => {
      let itemsToProcess = [];

      if (providedItems && providedItems.length > 0) {
        // Buy-now flow: load Product/Variant data
        for (const item of providedItems) {
          const product = await this.repo.findProductWithDefaultVariant(item.productId);
          if (!product) {
            throw new AppError('orders.productNotFound', 404, { id: item.productId });
          }
          let variant = null;
          if (item.variantId) {
            variant = await this.repo.findVariantBasic(item.variantId);
            if (!variant) {
              throw new AppError('orders.variantNotFound', 404, { id: item.variantId });
            }
          }
          itemsToProcess.push({
            productId: product.id,
            variantId: variant ? variant.id : null,
            quantity: item.quantity,
            Product: product,
            ProductVariant: variant,
            warrantyPackageIds: item.warrantyPackageIds || [],
          });
        }
      } else {
        // Cart flow: load + merge guest cart
        let cart = await this.repo.findOrCreateActiveCart(userId, { transaction });

        if (sessionIdCookie) {
          const guestCart = await this.repo.findActiveCartBySessionId(sessionIdCookie, {
            transaction,
          });
          if (guestCart && guestCart.items && guestCart.items.length > 0) {
            this.logger.info(
              `[ĐƠN HÀNG] Gộp giỏ khách ${guestCart.id} vào giỏ ${cart.id} của user ${userId}`,
            );
            for (const guestItem of guestCart.items) {
              const existing = await this.repo.findCartItemMatching(
                {
                  cartId: cart.id,
                  productId: guestItem.productId,
                  variantId: guestItem.variantId,
                },
                { transaction },
              );

              if (existing) {
                existing.quantity = existing.quantity + guestItem.quantity;
                await this.repo.saveCartItem(existing, { transaction });
                await this.repo.deleteCartItem(guestItem, { transaction });
              } else {
                guestItem.cartId = cart.id;
                await this.repo.saveCartItem(guestItem, { transaction });
              }
            }
            guestCart.status = 'merged';
            await this.repo.saveCart(guestCart, { transaction });
          }
        }

        cart = await this.repo.findCartByPkWithItemsDetails(cart.id, { transaction });
        if (!cart) {
          throw new AppError('orders.cartNotFound', 400, { id: userId });
        }
        if (cart.items.length === 0) {
          throw new AppError('orders.cartEmpty', 400, { id: userId });
        }
        itemsToProcess = cart.items;
      }

      // Validate stock + lock + tính subtotal/weight/warranty
      let subtotal = 0;
      let totalWeightKg = 0;
      let totalWarrantyCost = 0;
      const pendingInventoryLogs = [];

      for (const item of itemsToProcess) {
        const product = item.Product;

        if (product.status !== 'active') {
          throw new AppError('orders.productInactive', 400, { name: product.name });
        }

        if (item.variantId) {
          const lockedVariant = await this.repo.lockVariant(item.variantId, transaction);
          if (!lockedVariant || lockedVariant.stockQuantity < item.quantity) {
            throw new AppError('orders.stockInsufficient', 400, {
              name: product.name,
              available: lockedVariant ? lockedVariant.stockQuantity : 0,
            });
          }
          const prev = lockedVariant.stockQuantity;
          await this.repo.decrementVariantStock(lockedVariant, item.quantity, { transaction });
          pendingInventoryLogs.push({
            productId: item.productId,
            variantId: item.variantId,
            changeType: 'sale',
            changeAmount: -item.quantity,
            previousStock: prev,
            newStock: prev - item.quantity,
          });
        } else {
          const lockedProduct = await this.repo.lockProduct(item.productId, transaction);
          if (!lockedProduct || lockedProduct.stockQuantity < item.quantity) {
            throw new AppError('orders.stockInsufficient', 400, {
              name: product.name,
              available: lockedProduct ? lockedProduct.stockQuantity : 0,
            });
          }
          const prev = lockedProduct.stockQuantity;
          await this.repo.decrementProductStock(lockedProduct, item.quantity, { transaction });
          pendingInventoryLogs.push({
            productId: item.productId,
            variantId: null,
            changeType: 'sale',
            changeAmount: -item.quantity,
            previousStock: prev,
            newStock: prev - item.quantity,
          });
        }

        const variant = item.ProductVariant;
        const price = variant ? variant.price : product.basePrice;
        subtotal += price * item.quantity;

        const itemWeight = parseFloat(variant?.weight) || 0;
        totalWeightKg += itemWeight * item.quantity;

        if (item.warrantyPackageIds && item.warrantyPackageIds.length > 0) {
          const packages = await this.repo.findActiveWarrantyPackagesByIds(
            item.warrantyPackageIds,
            { transaction },
          );
          const itemWarrantyFee = packages.reduce((sum, pkg) => sum + parseFloat(pkg.price), 0);
          item.warrantyFee = itemWarrantyFee;
          item.warrantyPackages = packages;
          totalWarrantyCost += itemWarrantyFee * item.quantity;
        } else {
          item.warrantyFee = 0;
        }
      }

      // Discount code
      let discount = 0;
      let discountCodeId = null;
      if (discountCode) {
        const codeData = await this.repo.findActiveDiscountCode(discountCode, { transaction });
        if (!codeData) throw new AppError('orders.couponInvalid', 400);

        const now = new Date();
        if (codeData.startDate && now < new Date(codeData.startDate)) {
          throw new AppError('orders.couponNotStarted', 400);
        }
        if (codeData.endDate && now > new Date(codeData.endDate)) {
          throw new AppError('orders.couponExpired', 400);
        }
        if (codeData.usageLimit !== null && codeData.usedCount >= codeData.usageLimit) {
          throw new AppError('orders.couponLimitReached', 400);
        }
        if (subtotal < parseFloat(codeData.minOrderAmount)) {
          throw new AppError('orders.couponMinOrderNotMet', 400, {
            amount: codeData.minOrderAmount,
          });
        }

        if (codeData.type === 'percent') {
          discount = (subtotal * parseFloat(codeData.value)) / 100;
          if (codeData.maxDiscountAmount && discount > parseFloat(codeData.maxDiscountAmount)) {
            discount = parseFloat(codeData.maxDiscountAmount);
          }
        } else {
          discount = parseFloat(codeData.value);
        }
        if (discount > subtotal) discount = subtotal;
        discountCodeId = codeData.id;

        // Manual payment → tăng usedCount ngay; online payment đợi webhook xác nhận
        const manualMethods = ['cod', 'bank_transfer', 'installment'];
        if (manualMethods.includes(paymentMethod)) {
          await this.repo.incrementDiscountCodeUsage(codeData, { transaction });
        }
      }

      // Loyalty points
      const pointsToUseInt = parseInt(pointsToUse, 10) || 0;
      let pointsDiscount = 0;
      if (pointsToUseInt > 0) {
        const u = await this.repo.findUserById(userId, { transaction });
        if (u.loyaltyPoints < pointsToUseInt) {
          throw new AppError('orders.insufficientPoints', 400);
        }
        pointsDiscount = pointsToUseInt * this.constants.POINTS_VALUE;
        if (pointsDiscount > subtotal - discount) {
          pointsDiscount = subtotal - discount;
        }
      }

      const shippingCost = this._calculateShipping(subtotal, totalWeightKg);
      const tax = 0;
      const total = subtotal + tax + shippingCost + totalWarrantyCost - discount - pointsDiscount;
      const orderNumber = this._generateOrderNumber();

      // Cancel pending orders cũ (1 user / 1 pending tại một thời điểm)
      await this.repo.cancelPendingOrdersByUser(userId, { transaction });

      // Trừ điểm + ghi history
      if (pointsToUseInt > 0) {
        const u = await this.repo.findUserById(userId, { transaction });
        await this.repo.updateUserPoints(u, u.loyaltyPoints - pointsToUseInt, { transaction });
        await this.repo.createLoyaltyHistory(
          {
            userId,
            points: -pointsToUseInt,
            type: 'spend',
            description: `Sử dụng điểm cho đơn hàng ${orderNumber}`,
          },
          { transaction },
        );
      }

      // Create order
      const order = await this.repo.createOrder(
        {
          number: orderNumber,
          userId,
          shippingFirstName,
          shippingLastName,
          shippingCompany,
          shippingAddress1,
          shippingAddress2,
          shippingCity,
          shippingState: shippingState || '',
          shippingZip,
          shippingCountry,
          shippingPhone,
          billingFirstName,
          billingLastName,
          billingCompany,
          billingAddress1,
          billingAddress2,
          billingCity,
          billingState: billingState || '',
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
        { transaction },
      );

      // Create order items
      const orderItems = [];
      for (const item of itemsToProcess) {
        const product = item.Product;
        const variant = item.ProductVariant;
        const price = variant ? variant.price : product.basePrice;
        const itemSubtotal = price * item.quantity;

        const orderItem = await this.repo.createOrderItem(
          {
            orderId: order.id,
            productId: product.id,
            variantId: variant ? variant.id : null,
            name: product.name,
            sku: variant ? variant.sku : null,
            unitPrice: price,
            quantity: item.quantity,
            subtotal: itemSubtotal,
            image: product.thumbnail,
            attributes: {
              ...(variant ? { variant: variant.name } : {}),
              warrantyPackages: item.warrantyPackages
                ? item.warrantyPackages.map((pkg) => ({
                    id: pkg.id,
                    name: pkg.name,
                    price: pkg.price,
                  }))
                : [],
            },
            warrantyPackageIds: item.warrantyPackageIds || null,
          },
          { transaction },
        );

        orderItems.push(orderItem);
      }

      // Inventory logs
      /* istanbul ignore else */
      if (pendingInventoryLogs.length > 0) {
        await this.repo.createInventoryLogs(
          pendingInventoryLogs.map((log) => ({ ...log, orderId: order.id })),
          { transaction },
        );
      }

      // Manual payment → clear cart ngay; online payment đợi webhook
      const manualPaymentMethods = ['cod', 'bank_transfer', 'installment'];
      if (manualPaymentMethods.includes(paymentMethod)) {
        await this._clearUserCartInTransaction(userId, transaction);
      }

      // Update orderId cho loyalty history
      if (pointsToUseInt > 0) {
        await this.repo.updateLoyaltyHistoryOrderId(
          { userId, type: 'spend', description: `Sử dụng điểm cho đơn hàng ${orderNumber}` },
          order.id,
          { transaction },
        );
      }

      createdOrder = order;
      orderItemsForEmail = orderItems;
    });

    await this.eventBus.publish({
      type: 'order.created',
      payload: {
        orderId: createdOrder.id,
        orderNumber: createdOrder.number,
        userId: createdOrder.userId,
        total: createdOrder.total,
        items: orderItemsForEmail.map((i) => ({ productId: i.productId, quantity: i.quantity })),
      },
      occurredAt: new Date().toISOString(),
    });

    // Fire-and-forget email
    this.emailGateway
      .sendOrderConfirmationEmail(user.email, {
        orderNumber: createdOrder.number,
        orderDate: createdOrder.createdAt,
        total: createdOrder.total,
        items: orderItemsForEmail.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          price: item.unitPrice,
          subtotal: item.subtotal,
        })),
        shippingAddress: {
          name: `${createdOrder.shippingFirstName} ${createdOrder.shippingLastName}`,
          address1: createdOrder.shippingAddress1,
          address2: createdOrder.shippingAddress2,
          city: createdOrder.shippingCity,
          state: createdOrder.shippingState,
          zip: createdOrder.shippingZip,
          country: createdOrder.shippingCountry,
        },
      })
      .catch((err) => this.logger.error('Lỗi gửi email xác nhận đơn hàng:', err));

    return {
      id: createdOrder.id,
      number: createdOrder.number,
      status: createdOrder.status,
      total: createdOrder.total,
      createdAt: createdOrder.createdAt,
    };
  }

  // Internal helper — clear cart trong cùng transaction.
  async _clearUserCartInTransaction(userId, transaction) {
    if (!userId) return;
    try {
      const carts = await this.repo.findActiveCartsByUser(userId);
      for (const cart of carts) {
        cart.status = 'converted';
        await this.repo.saveCart(cart, { transaction });
        await this.repo.clearCartItems(cart.id);
      }
    } catch (err) {
      this.logger.error(`Lỗi xóa giỏ hàng của user ${userId}:`, err.message);
    }
  }

  async getUserOrders({ userId, page = 1, limit = 20 }) {
    const pageLimit = Math.min(parseInt(limit, 10) || 20, 100);
    const offset = (parseInt(page, 10) - 1) * pageLimit;
    const { count, rows } = await this.repo.findUserOrdersWithItems(userId, {
      limit: pageLimit,
      offset,
    });
    return {
      data: rows,
      total: count,
      page: parseInt(page, 10),
      limit: pageLimit,
    };
  }

  async getOrderById({ id, userId, role }) {
    const order = await this.repo.findOrderByPkWithItemsAndUser(id);
    if (!order) throw new AppError('orders.notFound', 404);
    if (order.userId !== userId && role !== 'admin') {
      throw new AppError('orders.accessDenied', 403);
    }
    return order;
  }

  async getOrderByNumber({ number, userId }) {
    const order = await this.repo.findOrderByNumberAndUserId(number, userId);
    if (!order) throw new AppError('orders.notFound', 404);
    return order;
  }

  async cancelOrder({ id, userId, userEmail }) {
    let cancelledOrder;

    await this.repo.runInTransaction(async (transaction) => {
      const order = await this.repo.findOrderForCancel(id, userId);
      if (!order) throw new AppError('orders.notFound', 404);

      if (!_canCancel(order.status)) {
        throw new AppError('Không thể hủy đơn hàng này', 422);
      }
      order.status = STATUS.CANCELLED;
      await this.repo.saveOrder(order, { transaction });

      // Restore stock
      for (const item of order.items) {
        if (item.variantId) {
          await this.repo.restoreVariantStock(item.ProductVariant, item.quantity, { transaction });
        } else {
          await this.repo.restoreProductStock(item.Product, item.quantity, { transaction });
        }
      }

      // Refund loyalty points used
      if (order.pointsUsed > 0) {
        const user = await this.repo.findUserById(userId, { transaction });
        await this.repo.updateUserPoints(user, user.loyaltyPoints + order.pointsUsed, {
          transaction,
        });
        await this.repo.createLoyaltyHistory(
          {
            userId,
            orderId: order.id,
            points: order.pointsUsed,
            type: 'refund',
            description: `Hoàn điểm cho đơn hàng bị hủy ${order.number}`,
          },
          { transaction },
        );
      }

      // Revoke earned points if any
      if (order.pointsEarned > 0) {
        const user = await this.repo.findUserById(userId, { transaction });
        await this.repo.updateUserPoints(
          user,
          Math.max(0, user.loyaltyPoints - order.pointsEarned),
          { transaction },
        );
        await this.repo.createLoyaltyHistory(
          {
            userId,
            orderId: order.id,
            points: -order.pointsEarned,
            type: 'refund',
            description: `Thu hồi điểm tích lũy do hủy/trả đơn hàng ${order.number}`,
          },
          { transaction },
        );
      }

      cancelledOrder = order;
    });

    // inventory/module.js subscribe 'order.cancelled' để tạo audit log
    await this.eventBus.publish({
      type: 'order.cancelled',
      payload: {
        orderId: cancelledOrder.id,
        orderNumber: cancelledOrder.number,
        userId: cancelledOrder.userId,
        items: cancelledOrder.items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          quantity: i.quantity,
        })),
      },
      occurredAt: new Date().toISOString(),
    });

    if (userEmail) {
      this.emailGateway
        .sendOrderCancellationEmail(userEmail, {
          orderNumber: cancelledOrder.number,
          orderDate: cancelledOrder.createdAt,
        })
        .catch((err) => this.logger.error('Lỗi gửi email hủy đơn:', err));
    }

    return {
      id: cancelledOrder.id,
      number: cancelledOrder.number,
      status: STATUS.CANCELLED,
    };
  }

  async getAllOrders({ page = 1, limit = 20, status }) {
    const pageLimit = Math.min(parseInt(limit, 10) || 20, 100);
    const offset = (parseInt(page, 10) - 1) * pageLimit;
    const where = {};
    if (status) where.status = status;

    const { count, rows } = await this.repo.findAllOrdersWithUser({
      where,
      limit: pageLimit,
      offset,
    });
    return {
      data: rows,
      total: count,
      page: parseInt(page, 10),
      limit: pageLimit,
    };
  }

  async updateOrderStatus({ id, status }) {
    const order = await this.repo.findOrderByPkWithItemsAndUser(id);
    if (!order) throw new AppError('orders.notFound', 404);

    const previousStatus = order.status;
    order.status = status;

    // COD delivered → tự động paid
    if (status === STATUS.DELIVERED && order.paymentMethod === 'cod') {
      order.paymentStatus = 'paid';
    }

    await this.repo.saveOrder(order);

    // Trao loyalty points khi delivered (nếu chưa trao)
    if (status === STATUS.DELIVERED && previousStatus !== STATUS.DELIVERED) {
      const pointsEarned = Math.floor(parseFloat(order.subtotal) / this.constants.POINTS_EARN_RATE);
      if (pointsEarned > 0) {
        const user = await this.repo.findUserById(order.userId);
        if (user) {
          await this.repo.updateUserPoints(user, user.loyaltyPoints + pointsEarned);
          await this.repo.createLoyaltyHistory({
            userId: order.userId,
            orderId: order.id,
            points: pointsEarned,
            type: 'earn',
            description: `Tích điểm từ đơn hàng ${order.number}`,
          });
          order.pointsEarned = pointsEarned;
          await this.repo.saveOrder(order);
        }
      }

      await this.eventBus.publish({
        type: 'order.delivered',
        payload: {
          orderId: order.id,
          orderNumber: order.number,
          userId: order.userId,
          total: order.total,
          subtotal: order.subtotal,
        },
        occurredAt: new Date().toISOString(),
      });
    }

    // Email status update
    if (order.user?.email) {
      this.emailGateway
        .sendOrderStatusUpdateEmail(order.user.email, {
          orderNumber: order.number,
          orderDate: order.createdAt,
          status,
        })
        .catch((err) => this.logger.error('Lỗi gửi email cập nhật trạng thái:', err));
    }

    return {
      id: order.id,
      number: order.number,
      status: order.status,
    };
  }

  async repayOrder({ id, userId, originUrl }) {
    const order = await this.repo.findOrderByIdAndUserId(id, userId);
    if (!order) throw new AppError('orders.notFound', 404);

    if (!_canRepay(order.status, order.paymentStatus)) {
      throw new AppError('Đơn hàng này không thể thanh toán lại', 422);
    }
    order.status = STATUS.PENDING;
    order.paymentStatus = 'pending';
    await this.repo.saveOrder(order);

    const paymentUrl = `${originUrl}/checkout?repayOrder=${order.id}&amount=${order.total}`;
    return {
      id: order.id,
      number: order.number,
      status: order.status,
      paymentStatus: order.paymentStatus,
      total: order.total,
      paymentUrl,
    };
  }

  async confirmReceived({ id, userId }) {
    const order = await this.repo.findOrderByIdAndUserId(id, userId);
    if (!order) throw new AppError('orders.notFound', 404);

    // Idempotent: đã delivered + đã trao điểm → không xử lý lại
    const alreadyProcessed = order.status === STATUS.DELIVERED && (order.pointsEarned || 0) !== 0;
    if (!alreadyProcessed && !_canConfirmReceived(order.status)) {
      throw new AppError(
        'Chỉ có thể xác nhận đơn hàng khi đang giao, đang xử lý hoặc đã giao hàng',
        422,
      );
    }
    if (!alreadyProcessed) {
      order.status = STATUS.DELIVERED;
      if (order.paymentMethod === 'cod') order.paymentStatus = 'paid';
    }
    await this.repo.saveOrder(order);
    await order.reload();

    if (alreadyProcessed) {
      return {
        message: 'orders.alreadyConfirmed',
        data: order,
        pointsEarned: 0,
      };
    }

    let earnedPointsTotal = order.pointsEarned || 0;
    let newPointsAwarded = 0;

    if ((order.pointsEarned || 0) === 0) {
      const orderTotal = parseFloat(order.subtotal);
      newPointsAwarded = Math.floor(orderTotal / this.constants.POINTS_EARN_RATE);

      if (newPointsAwarded > 0) {
        const user = await this.repo.findUserById(userId);
        if (user) {
          await this.repo.updateUserPoints(user, user.loyaltyPoints + newPointsAwarded);
          await this.repo.createLoyaltyHistory({
            userId,
            orderId: order.id,
            points: newPointsAwarded,
            type: 'earn',
            description: `Tích điểm từ đơn hàng ${order.number} (Người dùng xác nhận)`,
          });
          earnedPointsTotal = newPointsAwarded;
          order.pointsEarned = earnedPointsTotal;
          await this.repo.saveOrder(order);
        }
      } else if (orderTotal > 0) {
        // Đánh dấu đã xử lý dù không đủ điểm
        earnedPointsTotal = -1;
        order.pointsEarned = -1;
        await this.repo.saveOrder(order);
      }
    }

    await this.eventBus.publish({
      type: 'order.delivered',
      payload: {
        orderId: order.id,
        orderNumber: order.number,
        userId: order.userId,
        total: order.total,
        subtotal: order.subtotal,
      },
      occurredAt: new Date().toISOString(),
    });

    return {
      message: 'orders.deliveryConfirmed',
      pointsEarned: newPointsAwarded > 0 ? newPointsAwarded : 0,
      data: {
        id: order.id,
        number: order.number,
        status: STATUS.DELIVERED,
        pointsEarned: earnedPointsTotal,
      },
    };
  }

  async trackOrder({ orderNumber, email }) {
    if (!orderNumber || !email) {
      throw new AppError('orders.provideOrderAndEmail', 400);
    }
    const order = await this.repo.findOrderByNumberWithUserEmail(orderNumber);
    if (!order || order.User?.email?.toLowerCase() !== email.toLowerCase()) {
      throw new AppError('orders.orderNotFoundWithInfo', 404);
    }

    const steps = _buildTrackingSteps(order.status);
    return {
      orderNumber: order.number,
      currentStatus: order.status,
      steps,
      isCancelled: order.status === STATUS.CANCELLED,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  estimateShipping({ subtotal, weight }) {
    const sub = parseFloat(subtotal) || 0;
    const w = parseFloat(weight) || 0;
    return {
      shippingCost: this._calculateShipping(sub, w),
      freeShippingThreshold: this.constants.SHIPPING_FREE_THRESHOLD,
    };
  }
}

module.exports = OrdersService;
