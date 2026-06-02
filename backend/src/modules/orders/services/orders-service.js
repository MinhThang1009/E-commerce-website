/**
 * @file ordersService.js
 * @layer Service
 * @module orders
 * @description Business logic layer cho orders
 * @depends-on sequelize-orders-repository, emailGateway (adapter), eventBus, logger, constants
 * @see module.js (DI wiring), routes.js (endpoints), CLAUDE.md (overview)
 * @see sequelize-orders-repository.js (DB queries), orders-controller.js (HTTP layer)
 */
const crypto = require('crypto');
const { AppError } = require('@shared/errors');

// Các trạng thái hợp lệ và quy tắc chuyển trạng thái đơn hàng
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
  // delivered là trạng thái SAU KHI xác nhận — không cho confirm lại
  return status === STATUS.SHIPPED || status === STATUS.PROCESSING;
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
// Orders Service — pure business logic; mọi data access qua repo.
class OrdersService {
  constructor({ ordersRepository, emailGateway, eventBus, logger, constants }) {
    this.repo = ordersRepository;
    this.emailGateway = emailGateway;
    this.eventBus = eventBus;
    this.logger = logger;
    this.constants = constants;
  }

  // ---------- Helpers ----------

  _generateOrderNumber() {
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = crypto.randomInt(1000, 9999);
    return `ORD-${date}-${rand}`;
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
      shippingCost: shippingCostFromFE,
      items: providedItems,
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

      // Validate stock + lock + tính subtotal
      let subtotal = 0;
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
      }

      // Discount code
      let discount = 0;
      let discountCodeId = null;
      if (discountCode) {
        // Khóa hàng mã giảm giá (SELECT FOR UPDATE) để check usedCount + increment nguyên tử,
        // tránh vượt usageLimit khi nhiều đơn dùng cùng mã đồng thời
        const codeData = await this.repo.findActiveDiscountCode(discountCode, {
          transaction,
          lock: transaction.LOCK.UPDATE,
        });
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

      // shippingCost: FE tính theo km. Server ENFORCE phần biết được: đủ ngưỡng miễn phí → 0,
      // và clamp >= 0 (không cho phí âm). Lưu ý: phí theo km khi CHƯA đủ ngưỡng vẫn tin FE
      // (server không tính khoảng cách) — giới hạn đã biết, chấp nhận.
      let shippingCost = typeof shippingCostFromFE === 'number' ? shippingCostFromFE : 0;
      if (subtotal >= this.constants.SHIPPING_FREE_THRESHOLD) shippingCost = 0;
      if (shippingCost < 0) shippingCost = 0;
      const tax = 0;
      const total = subtotal + tax + shippingCost - discount;
      const orderNumber = this._generateOrderNumber();

      // Cancel pending orders cũ (1 user / 1 pending tại một thời điểm)
      await this.repo.cancelPendingOrdersByUser(userId, { transaction });

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
            },
          },
          { transaction },
        );

        orderItems.push(orderItem);
      }

      // Inventory logs
      await this.repo.createInventoryLogs(
        pendingInventoryLogs.map((log) => ({ ...log, orderId: order.id })),
        { transaction },
      );

      // Manual payment → clear cart ngay; online payment đợi webhook
      const manualPaymentMethods = ['cod', 'bank_transfer', 'installment'];
      if (manualPaymentMethods.includes(paymentMethod)) {
        await this._clearUserCartInTransaction(userId, transaction);
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
        await this.repo.clearCartItems(cart.id, { transaction });
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
    // Transform productImages → images[] và thumbnail cho FE
    const data = rows.map((row) => {
      const o = row.toJSON ? row.toJSON() : { ...row };
      if (o.items) {
        o.items = o.items.map((item) => {
          // Map unitPrice → price để FE dùng được
          if (item.unitPrice !== undefined && item.price === undefined) {
            item.price = parseFloat(item.unitPrice) || 0;
          }
          if (item.Product?.productImages) {
            item.Product.thumbnail =
              item.Product.productImages.find((img) => img.isThumbnail)?.imageUrl ||
              item.Product.productImages[0]?.imageUrl ||
              null;
            item.Product.images = item.Product.productImages.map((img) => img.imageUrl);
            delete item.Product.productImages;
          }
          return item;
        });
      }
      return o;
    });
    return {
      data,
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
    // Map productImages → thumbnail + images (giống getUserOrders)
    const o = order.toJSON ? order.toJSON() : { ...order };
    if (o.items) {
      /* istanbul ignore next */
      o.items = o.items.map((item) => {
        if (item.Product?.productImages) {
          item.Product.thumbnail =
            item.Product.productImages.find((img) => img.isThumbnail)?.imageUrl ||
            item.Product.productImages[0]?.imageUrl ||
            null;
          item.Product.images = item.Product.productImages.map((img) => img.imageUrl);
          delete item.Product.productImages;
        }
        return item;
      });
    }
    return o;
  }

  async getOrderByNumber({ number, userId }) {
    const order = await this.repo.findOrderByNumberAndUserId(number, userId);
    if (!order) throw new AppError('orders.notFound', 404);
    return order;
  }

  async cancelOrder({ id, userId, userEmail }) {
    let cancelledOrder;

    await this.repo.runInTransaction(async (transaction) => {
      const order = await this.repo.findOrderForCancel(id, userId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
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

      cancelledOrder = order;
    });

    // inventory/module.js subscribe 'order.cancelled' để ghi InventoryLog
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
    let updatedOrder;

    await this.repo.runInTransaction(async (transaction) => {
      // Khóa hàng Order để hoàn kho an toàn (tránh double-restore race với cancelOrder của user)
      const order = await this.repo.findOrderByPkWithItemsAndUser(id, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      if (!order) throw new AppError('orders.notFound', 404);

      const previousStatus = order.status;
      order.status = status;

      // COD delivered → tự động paid
      if (status === STATUS.DELIVERED && order.paymentMethod === 'cod') {
        order.paymentStatus = 'paid';
      }

      // Hủy đơn CHƯA giao (pending/processing) → hoàn kho. shipped/delivered: hàng đã đi,
      // KHÔNG hoàn. Bỏ qua nếu trạng thái cũ đã cancelled (tránh hoàn kho 2 lần).
      if (
        status === STATUS.CANCELLED &&
        (previousStatus === STATUS.PENDING || previousStatus === STATUS.PROCESSING)
      ) {
        for (const item of order.items) {
          if (item.variantId) {
            await this.repo.restoreVariantStock(item.ProductVariant, item.quantity, {
              transaction,
            });
          } else {
            await this.repo.restoreProductStock(item.Product, item.quantity, { transaction });
          }
        }
      }

      await this.repo.saveOrder(order, { transaction });
      updatedOrder = order;
    });

    // Email status update (ngoài transaction, fire-and-forget)
    if (updatedOrder.user?.email) {
      this.emailGateway
        .sendOrderStatusUpdateEmail(updatedOrder.user.email, {
          orderNumber: updatedOrder.number,
          orderDate: updatedOrder.createdAt,
          status: updatedOrder.status,
        })
        .catch((err) => this.logger.error('Lỗi gửi email cập nhật trạng thái:', err));
    }

    return {
      id: updatedOrder.id,
      number: updatedOrder.number,
      status: updatedOrder.status,
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

    if (!_canConfirmReceived(order.status)) {
      throw new AppError('Chỉ có thể xác nhận đơn hàng khi đang giao hoặc đang xử lý', 422);
    }
    order.status = STATUS.DELIVERED;
    if (order.paymentMethod === 'cod') order.paymentStatus = 'paid';
    await this.repo.saveOrder(order);
    await order.reload();

    return {
      message: 'orders.deliveryConfirmed',
      data: {
        id: order.id,
        number: order.number,
        status: STATUS.DELIVERED,
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

  estimateShipping({ subtotal }) {
    // Phí ship hiển thị trên FE theo khoảng cách km — endpoint này chỉ trả ngưỡng miễn phí
    const sub = parseFloat(subtotal) || 0;
    return {
      shippingCost: sub >= this.constants.SHIPPING_FREE_THRESHOLD ? 0 : null,
      freeShippingThreshold: this.constants.SHIPPING_FREE_THRESHOLD,
    };
  }
}

module.exports = OrdersService;
