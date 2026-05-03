'use strict';

module.exports = {
  async up(queryInterface) {
    // ── products indexes ──────────────────────────────────────────────────────
    await queryInterface.addIndex('products', ['slug'], {
      name: 'idx_products_slug',
      unique: true,
    });
    await queryInterface.addIndex('products', ['status'], {
      name: 'idx_products_status',
    });
    await queryInterface.addIndex('products', ['category_id'], {
      name: 'idx_products_category_id',
    });

    // ── orders indexes ────────────────────────────────────────────────────────
    await queryInterface.addIndex('orders', ['userId'], {
      name: 'idx_orders_user_id',
    });
    await queryInterface.addIndex('orders', ['status'], {
      name: 'idx_orders_status',
    });
    await queryInterface.addIndex('orders', ['number'], {
      name: 'idx_orders_number',
      unique: true,
    });

    // ── cart_items indexes ────────────────────────────────────────────────────
    await queryInterface.addIndex('cart_items', ['cartId'], {
      name: 'idx_cart_items_cart_id',
    });
    await queryInterface.addIndex('cart_items', ['productId'], {
      name: 'idx_cart_items_product_id',
    });

    // ── product_variants indexes ──────────────────────────────────────────────
    await queryInterface.addIndex('product_variants', ['product_id'], {
      name: 'idx_product_variants_product_id',
    });
    await queryInterface.addIndex('product_variants', ['sku'], {
      name: 'idx_product_variants_sku',
      unique: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeIndex('product_variants', 'idx_product_variants_sku');
    await queryInterface.removeIndex('product_variants', 'idx_product_variants_product_id');
    await queryInterface.removeIndex('cart_items', 'idx_cart_items_product_id');
    await queryInterface.removeIndex('cart_items', 'idx_cart_items_cart_id');
    await queryInterface.removeIndex('orders', 'idx_orders_number');
    await queryInterface.removeIndex('orders', 'idx_orders_status');
    await queryInterface.removeIndex('orders', 'idx_orders_user_id');
    await queryInterface.removeIndex('products', 'idx_products_category_id');
    await queryInterface.removeIndex('products', 'idx_products_status');
    await queryInterface.removeIndex('products', 'idx_products_slug');
  },
};
