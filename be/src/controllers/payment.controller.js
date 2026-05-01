const stripeService = require('../services/payment/stripeService');
const momoService = require('../services/payment/momoService');
const vnpayService = require('../services/payment/vnpayService');
const { Order, User, OrderItem, Product, ProductVariant, Cart, CartItem } = require('../models');
const { AppError } = require('../middlewares/errorHandler');
const { Op } = require('sequelize');
const sequelize = require('../config/sequelize');

// Create payment intent
const createPaymentIntent = async (req, res, next) => {
  try {
    const { amount, currency = 'usd', orderId } = req.body;
    const userId = req.user.id;

    if (!amount || amount <= 0) {
      throw new AppError('Invalid amount', 400);
    }

    // Create payment intent with metadata
    console.log('Creating payment intent with metadata:', {
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

    console.log('Payment intent created:', {
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

// Confirm payment
const confirmPayment = async (req, res, next) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId) {
      throw new AppError('Payment intent ID is required', 400);
    }

    const paymentIntent =
      await stripeService.confirmPaymentIntent(paymentIntentId);

    console.log('Payment Intent Retrieved:', {
      id: paymentIntent.id,
      status: paymentIntent.status,
      metadata: paymentIntent.metadata,
    });

    // Update order payment status if orderId exists in metadata
    if (paymentIntent.metadata.orderId) {
      console.log('Updating order:', paymentIntent.metadata.orderId);
      console.log('Payment Intent Status:', paymentIntent.status);

      // First check if order exists
      const existingOrder = await Order.findByPk(
        paymentIntent.metadata.orderId
      );
      console.log(
        'Existing order found:',
        existingOrder
          ? {
              id: existingOrder.id,
              number: existingOrder.number,
              currentPaymentStatus: existingOrder.paymentStatus,
            }
          : 'Order not found'
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
        console.log('Order update result:', updateResult);

        // Verify the update
        const updatedOrder = await Order.findByPk(
          paymentIntent.metadata.orderId
        );
        console.log(
          'Order after update:',
          updatedOrder
            ? {
                id: updatedOrder.id,
                number: updatedOrder.number,
                status: updatedOrder.status, // Trạng thái đơn hàng
                paymentStatus: updatedOrder.paymentStatus, // Trạng thái thanh toán
                paymentTransactionId: updatedOrder.paymentTransactionId,
              }
            : 'Order not found after update'
        );
        
        // Now reduce inventory since payment is confirmed for Stripe
        if (updatedOrder) {
          const { OrderItem, Product, ProductVariant } = require('../models');
          
          // Get order items to reduce inventory
          const orderItems = await OrderItem.findAll({
            where: { orderId: updatedOrder.id }
          });

          for (const item of orderItems) {
            if (item.variantId) {
              // Reduce stock for product variant using decrement method
              await ProductVariant.decrement(
                { stockQuantity: item.quantity },
                { where: { id: item.variantId } }
              );
            } else {
              // Reduce stock for product using decrement method
              await Product.decrement(
                { stockQuantity: item.quantity },
                { where: { id: item.productId } }
              );
            }
          }
          
          console.log(`Inventory reduced for order ${updatedOrder.id} after Stripe payment confirmation`);
          
          // Clear the user's active cart
          await clearUserCart(updatedOrder.userId);
        }
      } else if (!existingOrder) {
        console.log('Order not found for ID:', paymentIntent.metadata.orderId);
      } else {
        console.log('Payment not succeeded, status:', paymentIntent.status);
      }
    } else {
      console.log('No orderId found in payment intent metadata');
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

// Create customer
const createCustomer = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Check if user already has a Stripe customer ID
    if (user.stripeCustomerId) {
      const customer = await stripeService.getCustomer(user.stripeCustomerId);
      return res.status(200).json({
        status: 'success',
        data: { customer },
      });
    }

    // Create new Stripe customer
    const customer = await stripeService.createCustomer({
      email: user.email,
      name: `${user.firstName} ${user.lastName}`,
      metadata: {
        userId: user.id,
      },
    });

    // Save Stripe customer ID to user
    await user.update({ stripeCustomerId: customer.id });

    res.status(201).json({
      status: 'success',
      data: { customer },
    });
  } catch (error) {
    next(error);
  }
};

// Get payment methods
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

// Create setup intent for saving payment methods
const createSetupIntent = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);

    if (!user) {
      throw new AppError('User not found', 404);
    }

    // Create customer if doesn't exist
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

// Handle Stripe webhooks
const handleWebhook = async (req, res, next) => {
  try {
    // For sandbox/development, temporarily skip webhook verification
    console.log('Webhook received in sandbox mode');
    return res.status(200).json({ received: true });

    // Uncomment below when you have real webhook secret
    // const signature = req.headers['stripe-signature'];
    // const payload = req.body;
    // const event = await stripeService.handleWebhook(payload, signature);

    // Handle different event types
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      case 'customer.created':
        console.log('Customer created:', event.data.object.id);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    res.status(200).json({ received: true });
  } catch (error) {
    next(error);
  }
};

// Helper function to handle successful payments
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
      
      // Now reduce inventory since payment is confirmed via Stripe webhook
      const { OrderItem, Product, ProductVariant } = require('../models');
      
      // Get order items to reduce inventory
      const orderItems = await OrderItem.findAll({
        where: { orderId: paymentIntent.metadata.orderId }
      });

      for (const item of orderItems) {
        if (item.variantId) {
          // Reduce stock for product variant using decrement method
          await ProductVariant.decrement(
            { stockQuantity: item.quantity },
            { where: { id: item.variantId } }
          );
        } else {
          // Reduce stock for product using decrement method
          await Product.decrement(
            { stockQuantity: item.quantity },
            { where: { id: item.productId } }
          );
        }
      }
      
      console.log(
        `Payment succeeded and inventory reduced for order: ${paymentIntent.metadata.orderId}`
      );

      // Clear the user's active cart
      const order = await Order.findByPk(paymentIntent.metadata.orderId);
      if (order) {
        await clearUserCart(order.userId);
      }
    }
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
};

// Helper function to handle failed payments
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
      console.log(
        `Payment failed for order: ${paymentIntent.metadata.orderId}`
      );
    }
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
};

// Helper function to clear user cart after successful payment
const clearUserCart = async (userId) => {
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
};

// Create refund
const createRefund = async (req, res, next) => {
  try {
    const { orderId, amount, reason } = req.body;

    if (!orderId) {
      throw new AppError('Order ID is required', 400);
    }

    const order = await Order.findByPk(orderId);
    if (!order) {
      throw new AppError('Order not found', 404);
    }

    if (!order.paymentTransactionId) {
      throw new AppError('No payment transaction found for this order', 400);
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

    // Update order payment status
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

// Verify SePay webhook using API key authentication
const verifySePayApiKey = (req) => {
  // SePay sends API key in Authorization header as "Authorization": "Apikey API_KEY_CUA_BAN"
  const authHeader = req.headers.authorization;
  
  if (!authHeader) {
    console.error('No Authorization header provided in SePay webhook');
    return false;
  }
  
  // Check if the header starts with "Apikey "
  if (!authHeader.startsWith('Apikey ')) {
    console.error('Invalid Authorization header format in SePay webhook');
    return false;
  }
  
  // Extract the API key from the header
  const providedApiKey = authHeader.substring(7).trim(); // Remove "Apikey " prefix
  const expectedApiKey = process.env.SEPAY_API_KEY;
  
  if (!expectedApiKey) {
    console.warn('SePay API key not configured in environment variables');
    // In development, you might want to allow the webhook without API key verification
    return process.env.NODE_ENV === 'development' || process.env.NODE_ENV === 'test';
  }
  
  // Compare the provided API key with the expected one
  // Use constant-time comparison to prevent timing attacks
  const expectedLength = expectedApiKey.length;
  const providedLength = providedApiKey.length;
  let mismatch = expectedLength !== providedLength;
  
  for (let i = 0; i < Math.max(expectedLength, providedLength); i++) {
    const expectedChar = expectedApiKey.charCodeAt(i) || 0;
    const providedChar = providedApiKey.charCodeAt(i) || 0;
    mismatch |= expectedChar ^ providedChar;
  }
  
  if (mismatch !== 0) {
    console.error('Invalid SePay API key provided');
    return false;
  }
  
  return true;
};

// Handle SePay webhook
const handleSePayWebhook = async (req, res, next) => {
  try {
    // Verify the webhook source using API key authentication
    if (!verifySePayApiKey(req)) {
      console.error('Invalid SePay API key');
      return res.status(401).json({ error: 'Unauthorized webhook request' });
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

    console.log('SePay webhook received:', { id, transferAmount, content, transferType });

    // Validate required fields
    if (!id || !transferType || !transferAmount || !transactionDate) {
      console.log('Missing required fields in SePay webhook');
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Validate data types
    if (typeof id !== 'number' && typeof id !== 'string') {
      console.log('Invalid transaction ID type in SePay webhook');
      return res.status(400).json({ error: 'Invalid transaction ID type' });
    }
    
    if (typeof transferAmount !== 'number' || typeof transferType !== 'string') {
      console.log('Invalid data types in SePay webhook');
      return res.status(400).json({ error: 'Invalid data types' });
    }

    // Validate transfer amount is positive
    if (transferAmount <= 0) {
      console.log('Invalid transfer amount:', transferAmount);
      return res.status(400).json({ error: 'Transfer amount must be positive' });
    }

    // Validate transfer type
    if (!['in', 'out'].includes(transferType)) {
      console.log('Invalid transfer type:', transferType);
      return res.status(400).json({ error: 'Invalid transfer type' });
    }

    // Only process incoming transactions (money coming in)
    if (transferType !== 'in') {
      console.log('Ignoring outgoing transaction');
      return res.status(200).json({ received: true, message: 'Outgoing transaction ignored' });
    }

    // Validate transaction date format
    const parsedTransactionDate = new Date(transactionDate);
    if (isNaN(parsedTransactionDate.getTime())) {
      console.log('Invalid transaction date format:', transactionDate);
      return res.status(400).json({ error: 'Invalid transaction date format' });
    }

    // Extract order ID from content or code (you can customize this based on your format)
    // For example, if the content contains order number like "Order #ORD-12345 for payment"
    // or if the code contains the order ID
    let orderId = null;
    
    // Try to extract order ID from content
    if (content) {
      // Look for order ID in the content (adjust the pattern according to your format)
      // This regex looks for patterns like:
      // - ORD-12345, ORDER-12345
      // - ORD12345, ORDER12345 (without hyphen - like your example ORD251100012)
      // - order_123, order123
      // - SEPAY followed by number like SEPAY2845 (where 2845 might be order ID)
      // - Any 6+ digit number that might be an order ID
      const patterns = [
        /ORD[-_]?(\d+)/i,                 // Matches ORD12345 or ORD-12345 or ORD_12345
        /ORDER[-_]?(\d+)/i,               // Matches ORDER12345 or ORDER-12345 or ORDER_12345
        /ORD[-_]?\w+/i,                   // Matches full order numbers like ORD251100012
        /ORDER[-_]?\w+/i,                 // Matches full order numbers like ORDERXXXXXXXX
        /order[-_\s]?(\d+)/i,             // Matches order_123, order-123, order123
        /SEPAY(\d+)/i,                    // Matches SEPAY2845 pattern (from your example)
        /SEPAY[-_\s]?(\d+)/i,             // Matches SEPAY_2845, SEPAY-2845, SEPAY 2845
        /\b(\d{6,})\b/                   // Matches any 6+ digit number
      ];
      
      for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) {
          // Use the full match for order number patterns like ORD251100012, or captured group for others
          // This will match the entire ORD251100012 string if it fits the ORD[-_]?\w+ pattern
          orderId = match[0];
          if (orderId) {
            orderId = orderId.trim();
            break; // Found a match, stop looking
          }
        }
      }
    }
    
    // Also try to extract from code if not found in content
    if (!orderId && code) {
      const codePatterns = [
        /ORD[-_]?(\d+)/i,                 // Matches ORD12345 or ORD-12345 or ORD_12345
        /ORDER[-_]?(\d+)/i,               // Matches ORDER12345 or ORDER-12345 or ORDER_12345
        /ORD[-_]?\w+/i,                   // Matches full order numbers like ORD251100012
        /ORDER[-_]?\w+/i,                 // Matches full order numbers like ORDERXXXXXXXX
        /order[-_\s]?(\d+)/i,             // Matches order_123, order-123, order123
        /SEPAY(\d+)/i,                    // Matches SEPAY2845 pattern (from your example)
        /SEPAY[-_\s]?(\d+)/i,             // Matches SEPAY_2845, SEPAY-2845, SEPAY 2845
        /\b(\d{6,})\b/                   // Matches any 6+ digit number
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

    // If we still can't find an order ID, use the referenceCode
    if (!orderId && referenceCode) {
      const refPatterns = [
        /ORD[-_]?(\d+)/i,                 // Matches ORD12345 or ORD-12345 or ORD_12345
        /ORDER[-_]?(\d+)/i,               // Matches ORDER12345 or ORDER-12345 or ORDER_12345
        /ORD[-_]?\w+/i,                   // Matches full order numbers like ORD251100012
        /ORDER[-_]?\w+/i,                 // Matches full order numbers like ORDERXXXXXXXX
        /order[-_\s]?(\d+)/i,             // Matches order_123, order-123, order123
        /SEPAY(\d+)/i,                    // Matches SEPAY2845 pattern (from your example)
        /SEPAY[-_\s]?(\d+)/i,             // Matches SEPAY_2845, SEPAY-2845, SEPAY 2845
        /\b(\d{6,})\b/                   // Matches any 6+ digit number
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
      console.log('No order ID found in webhook data');
      return res.status(200).json({ 
        received: true, 
        message: 'No order ID found in transaction, processed successfully' 
      });
    }

    console.log('Looking for order with ID:', orderId);

    // Find the order in the database
    let order = null;
    
    // Try multiple ways to find the order
    try {
      // First, try to find by exact order number (like ORD-12345, which is stored in the 'number' field)
      order = await Order.findOne({ 
        where: { 
          number: orderId 
        } 
      });
      
      // If not found, try variations of the order number format
      // This handles cases where the stored format has hyphens but the webhook doesn't (or vice versa)
      if (!order) {
        // Try to find with hyphens (e.g., if webhook has "ORD251100012" but DB has "ORD-2511-00012")
        // Insert hyphens at likely positions: after "ORD" and before last 4 digits
        if (orderId.startsWith('ORD') && orderId.length > 7) {
          const formattedOrderId = `${orderId.substring(0, 3)}-${orderId.substring(3, 7)}-${orderId.substring(7)}`;
          order = await Order.findOne({ 
            where: { 
              number: formattedOrderId 
            } 
          });
        }
      }
      
      // If still not found, try the reverse: if webhook has hyphens, remove them for DB lookup
      if (!order && orderId.includes('-')) {
        const unformattedOrderId = orderId.replace(/-/g, '');
        order = await Order.findOne({ 
          where: { 
            number: unformattedOrderId 
          } 
        });
        
        // Also try pattern-based hyphen insertion in reverse
        if (!order) {
          const formattedOrderId = `${unformattedOrderId.substring(0, 3)}-${unformattedOrderId.substring(3, 7)}-${unformattedOrderId.substring(7)}`;
          order = await Order.findOne({ 
            where: { 
              number: formattedOrderId 
            } 
          });
        }
      }
      
      // If still not found, try looking for a numeric ID match in the 'number' field
      // Some systems use numeric order numbers like "12345"
      if (!order) {
        const numericPart = parseInt(orderId.replace(/\D/g, ''));
        if (!isNaN(numericPart)) {
          // Try matching against the number field if it contains the numeric part
          order = await Order.findOne({ 
            where: { 
              number: { [Op.like]: `%${numericPart}%` } 
            } 
          });
        }
      }
      
      // If we still haven't found it, try a more comprehensive search
      if (!order) {
        // Try partial matching with the original order ID
        order = await Order.findOne({ 
          where: { 
            [Op.or]: [
              { number: { [Op.like]: `%${orderId}%` } },  // Partial match in order number
            ]
          }
        });
      }
    } catch (error) {
      console.error('Database error finding order:', error);
      return res.status(500).json({ error: 'Error processing order' });
    }

    if (!order) {
      console.log('Order not found:', orderId);
      return res.status(200).json({ 
        received: true, 
        message: `Order with ID ${orderId} not found, processed successfully` 
      });
    }

    // Verify that the transfer amount matches the order total
    // Note: In the Order model, the total field is called 'total' (not 'totalAmount')
    const orderTotal = parseFloat(order.total); // Get the 'total' field from the Order model
    const transferAmountInVND = transferAmount; // SePay transfers amount in VND
    
    console.log('Comparing amounts:', {
      orderNumber: order.number,
      orderTotal: orderTotal,
      transferAmount: transferAmount,
      isMatch: Math.abs(orderTotal - transferAmount) < 0.01 // Using small tolerance for floating point comparison
    });

    // Check if amount matches (allowing for small differences due to rounding)
    if (Math.abs(orderTotal - transferAmount) > 0.01) {
      console.log(`Amount mismatch: Order total ${orderTotal} vs Transfer amount ${transferAmount}`);
      
      // You might want to still acknowledge the webhook but log the mismatch
      // or you might want to return an error to indicate the issue
      return res.status(200).json({ 
        received: true, 
        message: 'Amount mismatch detected, processed successfully' 
      });
    }

    // Prevent duplicate processing - check if this transaction ID already processed
    if (order.paymentTransactionId && order.paymentTransactionId === id.toString()) {
      console.log('Duplicate webhook received for transaction ID:', id);
      return res.status(200).json({ 
        received: true, 
        message: 'Webhook already processed' 
      });
    }

    // Update the order status to paid and processing if not already processed
    if (order.paymentStatus === 'pending' || order.paymentStatus === 'unpaid') {
      const updateResult = await Order.update(
        {
          status: 'processing',        // Update order status to processing
          paymentStatus: 'paid',       // Update payment status to paid
          paymentTransactionId: id.toString(), // Store SePay transaction ID
          paymentProvider: 'sepay',    // Mark the payment provider
          // Note: The Order model doesn't have a paymentDate field, so we'll just update the timestamp
          updatedAt: new Date(),
        },
        {
          where: { id: order.id },
        }
      );

      // Now reduce inventory since payment is confirmed
      // Get order items to reduce inventory
      const orderItems = await OrderItem.findAll({
        where: { orderId: order.id }
      });

      for (const item of orderItems) {
        if (item.variantId) {
          // Reduce stock for product variant using decrement method
          await ProductVariant.decrement(
            { stockQuantity: item.quantity },
            { where: { id: item.variantId } }
          );
        } else {
          // Reduce stock for product using decrement method
          await Product.decrement(
            { stockQuantity: item.quantity },
            { where: { id: item.productId } }
          );
        }
      }

      console.log('Order updated successfully:', {
        orderId: order.id,
        orderNumber: order.number,
        paymentStatus: 'paid',
        status: 'processing',
        transactionId: id,
        paymentDate: parsedTransactionDate
      });

      // Clear the user's active cart
      await clearUserCart(order.userId);

      // Optionally, you might want to emit an event or send a notification here
      // For example, send email notification to customer about successful payment
      // await emailService.sendPaymentConfirmation(order.userId, order.id);
      
    } else {
      console.log('Order already processed:', {
        orderId: order.id,
        orderNumber: order.number,
        currentPaymentStatus: order.paymentStatus,
        currentOrderStatus: order.status
      });
      return res.status(200).json({ 
        received: true, 
        message: 'Order already processed, webhook acknowledged' 
      });
    }

    res.status(200).json({ 
      received: true, 
      message: 'SePay webhook processed successfully',
      orderId: order.id,
      orderNumber: order.number,
      transactionId: id
    });

  } catch (error) {
    console.error('Error processing SePay webhook:', error);
    next(error);
  }
};


// Create MoMo Payment URL
const createMomoUrl = async (req, res, next) => {
  try {
    const { orderId } = req.body;
    
    const order = await Order.findByPk(orderId);
    if (!order) {
      throw new AppError('Không tìm thấy đơn hàng', 404);
    }

    const result = await momoService.createPaymentUrl({
      orderId: order.number, // Use order number for MoMo
      amount: order.total,
      orderInfo: `Thanh toán đơn hàng ${order.number}`,
      extraData: `orderId=${order.id}`, // Pass internal UUID in extraData
    });

    res.status(200).json({
      status: 'success',
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

// Handle MoMo Return (GET)
const momoReturn = async (req, res, next) => {
  try {
    const { resultCode, extraData } = req.query;
    
    // Extract internal order ID from extraData
    const orderIdMatch = extraData.match(/orderId=([^&]+)/);
    const orderId = orderIdMatch ? orderIdMatch[1] : null;

    if (resultCode == 0) {
      if (orderId) {
        const order = await Order.findByPk(orderId);
        if (order && order.paymentStatus !== 'paid') {
          await order.update({
            status: 'processing',
            paymentStatus: 'paid',
            paymentProvider: 'momo',
            updatedAt: new Date(),
          });

          // Reduce inventory
          const orderItems = await OrderItem.findAll({ where: { orderId: order.id } });
          for (const item of orderItems) {
            if (item.variantId) {
              await ProductVariant.decrement({ stockQuantity: item.quantity }, { where: { id: item.variantId } });
            } else {
              await Product.decrement({ stockQuantity: item.quantity }, { where: { id: item.productId } });
            }
          }
          
          await clearUserCart(order.userId);
        }
      }
      return res.redirect(`${process.env.FRONTEND_URL}/orders?payment=success`);
    } else {
      return res.redirect(`${process.env.FRONTEND_URL}/orders?payment=failed`);
    }
  } catch (error) {
    console.error('MoMo return error:', error);
    return res.redirect(`${process.env.FRONTEND_URL}/orders?payment=error`);
  }
};

// Handle MoMo IPN (POST)
const momoIPN = async (req, res, next) => {
  try {
    console.log('MoMo IPN received:', req.body);
    const isValid = momoService.verifySignature(req.body);
    
    if (!isValid) {
      return res.status(400).json({ message: 'Invalid signature' });
    }

    const { resultCode, extraData, transId } = req.body;
    const orderIdMatch = extraData.match(/orderId=([^&]+)/);
    const orderId = orderIdMatch ? orderIdMatch[1] : null;

    if (resultCode == 0 && orderId) {
      const order = await Order.findByPk(orderId);
      if (order && order.paymentStatus !== 'paid') {
        await order.update({
          status: 'processing',
          paymentStatus: 'paid',
          paymentTransactionId: transId,
          paymentProvider: 'momo',
          updatedAt: new Date(),
        });

        // Reduce inventory
        const orderItems = await OrderItem.findAll({ where: { orderId: order.id } });
        for (const item of orderItems) {
          if (item.variantId) {
            await ProductVariant.decrement({ stockQuantity: item.quantity }, { where: { id: item.variantId } });
          } else {
            await Product.decrement({ stockQuantity: item.quantity }, { where: { id: item.productId } });
          }
        }
        
        await clearUserCart(order.userId);
      }
    }

    res.status(204).send();
  } catch (error) {
    console.error('MoMo IPN error:', error);
    res.status(500).json({ message: error.message });
  }
};


// IPN if needed can be added similar to vnpayReturn but using server-to-server POST

// Create VNPay Payment URL
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

// Handle VNPay Return (GET)
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
        await order.update({
          status: 'processing',
          paymentStatus: 'paid',
          paymentProvider: 'vnpay',
          paymentTransactionId: vnp_Params['vnp_TransactionNo'],
          updatedAt: new Date(),
        });

        // Reduce inventory
        const orderItems = await OrderItem.findAll({ where: { orderId: order.id } });
        for (const item of orderItems) {
          if (item.variantId) {
            await ProductVariant.decrement({ stockQuantity: item.quantity }, { where: { id: item.variantId } });
          } else {
            await Product.decrement({ stockQuantity: item.quantity }, { where: { id: item.productId } });
          }
        }
        
        await clearUserCart(order.userId);
      }
      return res.redirect(`${process.env.FRONTEND_URL}/orders?payment=success&order=${orderNumber}`);
    } else {
      return res.redirect(`${process.env.FRONTEND_URL}/orders?payment=failed&code=${responseCode}`);
    }
  } catch (error) {
    console.error('VNPay return error:', error);
    next(error);
  }
};

// Handle VNPay IPN (GET)
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
      await order.update({
        status: 'processing',
        paymentStatus: 'paid',
        paymentProvider: 'vnpay',
        paymentTransactionId: vnp_Params['vnp_TransactionNo'],
        updatedAt: new Date(),
      });

      // Reduce inventory
      const orderItems = await OrderItem.findAll({ where: { orderId: order.id } });
      for (const item of orderItems) {
        if (item.variantId) {
          await ProductVariant.decrement({ stockQuantity: item.quantity }, { where: { id: item.variantId } });
        } else {
          await Product.decrement({ stockQuantity: item.quantity }, { where: { id: item.productId } });
        }
      }
      
      await clearUserCart(order.userId);
      return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
    } else {
      // payment failed
      await order.update({
        paymentStatus: 'failed',
        updatedAt: new Date(),
      });
      return res.status(200).json({ RspCode: '00', Message: 'Confirm Success' });
    }
  } catch (error) {
    console.error('VNPay IPN error:', error);
    return res.status(200).json({ RspCode: '99', Message: 'Unknow error' });
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
