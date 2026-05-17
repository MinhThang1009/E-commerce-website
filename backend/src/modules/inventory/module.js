/**
 * @file module.js
 * @layer Module
 * @module inventory
 * @description Entry point inventory module — khởi tạo dependencies và đăng ký routes
 */
const InventoryController = require('./controllers/inventoryController');
const InventoryService = require('./services/inventoryService');
const SequelizeInventoryRepository = require('./repositories/SequelizeInventoryRepository');
const buildRoutes = require('./routes');

// Inventory module — DDD-lite. Subscribe OrderCancelledEvent từ orders module
// để log audit (orders module đã restore stock inline trong cancelOrder).
module.exports = ({
  Product, ProductVariant, InventoryLog, User,
  sequelize,
  eventBus, logger,
}) => {
  if (!Product) throw new Error('inventory module: Product model bắt buộc');
  if (!ProductVariant) throw new Error('inventory module: ProductVariant model bắt buộc');
  if (!InventoryLog) throw new Error('inventory module: InventoryLog model bắt buộc');

  const inventoryRepository = new SequelizeInventoryRepository({
    Product, ProductVariant, InventoryLog, User,
  });
  const inventoryService = new InventoryService({ inventoryRepository, sequelize, eventBus, logger });
  const inventoryController = new InventoryController({ inventoryService });
  const router = buildRoutes({ inventoryController });

  return {
    basePath: '/inventory',
    router,
    subscribeEvents() {
      // Subscribe OrderCancelledEvent — audit log only (stock đã restore trong
      // orders.cancelOrder inline). Tương lai có thể đổi sang event-driven
      // restoration khi orders module bỏ inline restore.
      eventBus.subscribe('order.cancelled', async (event) => {
        try {
          for (const item of event.payload.items) {
            await inventoryRepository.createInventoryLog({
              productId: item.productId,
              variantId: item.variantId || null,
              changeType: 'cancellation',
              changeAmount: item.quantity,
              previousStock: 0, // Audit-only — actual values logged in orders flow
              newStock: 0,
              note: `Đơn hàng hủy ${event.payload.orderNumber}`,
              orderId: event.payload.orderId,
            });
          }
        } catch (err) {
          logger.warn('[inventory] Lỗi log OrderCancelledEvent:', err.message);
        }
      });
    },
  };
};
