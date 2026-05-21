'use strict';

module.exports = {
  // Chuẩn hóa schema Phase 8: composite PK, FK constraints, unique indexes,
  // và indexes còn thiếu cho các bảng core (orders, order_items, users, products)
  async up(queryInterface, Sequelize) {
    // ── 8.11 product_categories: chuyển từ auto-increment id → composite PK ──
    // Bước 1: Bỏ AUTO_INCREMENT trước khi xóa PK (MySQL yêu cầu thứ tự này)
    await queryInterface.sequelize.query(
      'ALTER TABLE `product_categories` MODIFY `id` INT NOT NULL',
    );
    // Bước 2: Xóa PK hiện tại (đang trên cột id)
    await queryInterface.sequelize.query('ALTER TABLE `product_categories` DROP PRIMARY KEY');
    // Bước 3: Xóa cột id
    await queryInterface.removeColumn('product_categories', 'id');
    // Bước 4: Đổi tên cột FK sang snake_case (chuẩn DB naming)
    await queryInterface.renameColumn('product_categories', 'productId', 'product_id');
    await queryInterface.renameColumn('product_categories', 'categoryId', 'category_id');
    // Bước 5: Thêm composite PK (product_id, category_id)
    await queryInterface.sequelize.query(
      'ALTER TABLE `product_categories` ADD PRIMARY KEY (`product_id`, `category_id`)',
    );
    // Bước 6: Thêm FK constraints với ON DELETE CASCADE
    await queryInterface.addConstraint('product_categories', {
      fields: ['product_id'],
      type: 'foreign key',
      name: 'fk_product_categories_products',
      references: { table: 'products', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
    await queryInterface.addConstraint('product_categories', {
      fields: ['category_id'],
      type: 'foreign key',
      name: 'fk_product_categories_categories',
      references: { table: 'categories', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
    // Bước 7: Index để tra cứu ngược (từ category → danh sách products)
    await queryInterface.addIndex('product_categories', ['category_id'], {
      name: 'idx_product_categories_category_id',
    });

    // ── 8.10 Đổi tên unique index về đúng convention uq_ ─────────────────
    await queryInterface.removeIndex('orders', 'idx_orders_number');
    await queryInterface.addIndex('orders', ['number'], {
      name: 'uq_orders_number',
      unique: true,
    });

    // ── 8.4 UNIQUE constraint trên users.email ────────────────────────────
    await queryInterface.addIndex('users', ['email'], {
      name: 'uq_users_email',
      unique: true,
    });

    // ── 8.9 FK: orders.userId → users.id (RESTRICT — không xóa user còn đơn hàng) ─
    await queryInterface.addConstraint('orders', {
      fields: ['userId'],
      type: 'foreign key',
      name: 'fk_orders_users',
      references: { table: 'users', field: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });

    // ── 8.9 FK: order_items.orderId → orders.id (CASCADE — xóa order thì xóa items) ─
    await queryInterface.addConstraint('order_items', {
      fields: ['orderId'],
      type: 'foreign key',
      name: 'fk_order_items_orders',
      references: { table: 'orders', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
    // ── 8.9 FK: order_items.productId → products.id (RESTRICT — giữ lịch sử đơn hàng) ─
    await queryInterface.addConstraint('order_items', {
      fields: ['productId'],
      type: 'foreign key',
      name: 'fk_order_items_products',
      references: { table: 'products', field: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });

    // ── 8.5 Indexes còn thiếu theo chuẩn e-commerce ──────────────────────
    await queryInterface.addIndex('products', ['brand_id'], {
      name: 'idx_products_brand_id',
    });
    await queryInterface.addIndex('products', ['is_featured'], {
      name: 'idx_products_is_featured',
    });
    await queryInterface.addIndex('products', ['created_at'], {
      name: 'idx_products_created_at',
    });
    await queryInterface.addIndex('orders', ['paymentStatus'], {
      name: 'idx_orders_payment_status',
    });
    await queryInterface.addIndex('orders', ['createdAt'], {
      name: 'idx_orders_created_at',
    });
    await queryInterface.addIndex('order_items', ['orderId'], {
      name: 'idx_order_items_order_id',
    });
    await queryInterface.addIndex('order_items', ['productId'], {
      name: 'idx_order_items_product_id',
    });
    await queryInterface.addIndex('users', ['role'], {
      name: 'idx_users_role',
    });
  },

  // Rollback Phase 8: xóa indexes/FKs mới, khôi phục tên index cũ,
  // và phục hồi product_categories về auto-increment id PK
  async down(queryInterface, Sequelize) {
    // Xóa indexes bổ sung (theo thứ tự ngược lại)
    await queryInterface.removeIndex('users', 'idx_users_role');
    await queryInterface.removeIndex('order_items', 'idx_order_items_product_id');
    await queryInterface.removeIndex('order_items', 'idx_order_items_order_id');
    await queryInterface.removeIndex('orders', 'idx_orders_created_at');
    await queryInterface.removeIndex('orders', 'idx_orders_payment_status');
    await queryInterface.removeIndex('products', 'idx_products_created_at');
    await queryInterface.removeIndex('products', 'idx_products_is_featured');
    await queryInterface.removeIndex('products', 'idx_products_brand_id');

    // Xóa FK constraints
    await queryInterface.removeConstraint('order_items', 'fk_order_items_products');
    await queryInterface.removeConstraint('order_items', 'fk_order_items_orders');
    await queryInterface.removeConstraint('orders', 'fk_orders_users');

    // Khôi phục tên index cũ idx_orders_number
    await queryInterface.removeIndex('orders', 'uq_orders_number');
    await queryInterface.addIndex('orders', ['number'], {
      name: 'idx_orders_number',
      unique: true,
    });

    // Xóa unique index trên users.email
    await queryInterface.removeIndex('users', 'uq_users_email');

    // Khôi phục product_categories với auto-increment id PK
    await queryInterface.removeIndex('product_categories', 'idx_product_categories_category_id');
    await queryInterface.removeConstraint('product_categories', 'fk_product_categories_categories');
    await queryInterface.removeConstraint('product_categories', 'fk_product_categories_products');
    await queryInterface.sequelize.query('ALTER TABLE `product_categories` DROP PRIMARY KEY');
    await queryInterface.renameColumn('product_categories', 'product_id', 'productId');
    await queryInterface.renameColumn('product_categories', 'category_id', 'categoryId');
    await queryInterface.addColumn('product_categories', 'id', {
      type: Sequelize.INTEGER,
      autoIncrement: true,
      primaryKey: true,
      allowNull: false,
      first: true,
    });
  },
};
