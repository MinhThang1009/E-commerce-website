'use strict';

// Phase 40.18 — Rename 39 FK constraints theo pattern fk_* (consistent với migration_full.sql v3.0)
// Idempotent: skip nếu FK mới đã tồn tại; skip nếu FK cũ đã không còn
//
// PRE-FLIGHT đã verify (2026-05-05):
//   - 39 FKs có tên auto-gen (`*_ibfk_*`) hoặc legacy (`*_foreign_idx`)
//   - Cả 39 đều có ON DELETE / ON UPDATE rules đã đúng — chỉ cần rename, không thay đổi semantics

// Mỗi entry: [table, oldName, newName, column, refTable, refColumn, onDelete, onUpdate]
const FK_RENAMES = [
  ['addresses',                'addresses_ibfk_1',                          'fk_addresses_user',          'user_id',            'users',             'id', 'CASCADE',  'CASCADE'],
  ['attribute_values',         'attribute_values_ibfk_1',                   'fk_attr_val_group',          'attribute_group_id', 'attribute_groups',  'id', 'CASCADE',  'CASCADE'],
  ['brand_categories',         'brand_categories_ibfk_1',                   'fk_bc_brand',                'brand_id',           'brands',            'id', 'CASCADE',  'CASCADE'],
  ['brand_categories',         'brand_categories_ibfk_2',                   'fk_bc_category',             'category_id',        'categories',        'id', 'CASCADE',  'CASCADE'],
  ['carts',                    'carts_ibfk_1',                              'fk_carts_user',              'user_id',            'users',             'id', 'SET NULL', 'CASCADE'],
  ['cart_items',               'cart_items_ibfk_1',                         'fk_cart_items_cart',         'cart_id',            'carts',             'id', 'CASCADE',  'CASCADE'],
  ['cart_items',               'cart_items_ibfk_2',                         'fk_cart_items_product',      'product_id',         'products',          'id', 'CASCADE',  'CASCADE'],
  ['chat_messages',            'chat_messages_ibfk_1',                      'fk_chat_messages_user',      'user_id',            'users',             'id', 'SET NULL', 'CASCADE'],
  ['chat_messages',            'chat_messages_product_id_foreign_idx',      'fk_chat_messages_product',   'product_id',         'products',          'id', 'SET NULL', 'CASCADE'],
  ['import_logs',              'import_logs_ibfk_1',                        'fk_import_logs_admin',       'admin_id',           'users',             'id', 'RESTRICT', 'CASCADE'],
  ['inventory_logs',           'inventory_logs_ibfk_1',                     'fk_inventory_logs_product',  'product_id',         'products',          'id', 'CASCADE',  'CASCADE'],
  ['inventory_logs',           'inventory_logs_ibfk_2',                     'fk_inventory_logs_variant',  'variant_id',         'product_variants',  'id', 'SET NULL', 'CASCADE'],
  ['inventory_logs',           'inventory_logs_ibfk_3',                     'fk_inventory_logs_order',    'order_id',           'orders',            'id', 'SET NULL', 'CASCADE'],
  ['inventory_logs',           'inventory_logs_ibfk_4',                     'fk_inventory_logs_user',     'created_by',         'users',             'id', 'SET NULL', 'CASCADE'],
  ['loyalty_histories',        'loyalty_histories_ibfk_1',                  'fk_lh_user',                 'user_id',            'users',             'id', 'CASCADE',  'CASCADE'],
  ['loyalty_histories',        'loyalty_histories_ibfk_2',                  'fk_lh_order',                'order_id',           'orders',            'id', 'SET NULL', 'CASCADE'],
  ['news',                     'news_ibfk_1',                               'fk_news_user',               'user_id',            'users',             'id', 'SET NULL', 'CASCADE'],
  ['orders',                   'orders_discount_code_id_foreign_idx',       'fk_orders_discount',         'discount_code_id',   'discount_codes',    'id', 'SET NULL', 'CASCADE'],
  ['products',                 'products_ibfk_1',                           'fk_products_category',       'category_id',        'categories',        'id', 'SET NULL', 'CASCADE'],
  ['products',                 'products_ibfk_2',                           'fk_products_brand',          'brand_id',           'brands',            'id', 'SET NULL', 'CASCADE'],
  ['product_attributes',       'product_attributes_ibfk_1',                 'fk_pa_product',              'product_id',         'products',          'id', 'CASCADE',  'CASCADE'],
  ['product_attribute_groups', 'product_attribute_groups_ibfk_1',           'fk_pag_product',             'product_id',         'products',          'id', 'CASCADE',  'CASCADE'],
  ['product_attribute_groups', 'product_attribute_groups_ibfk_2',           'fk_pag_group',               'attribute_group_id', 'attribute_groups',  'id', 'CASCADE',  'CASCADE'],
  ['product_collections',      'product_collections_ibfk_1',                'fk_pc_product',              'product_id',         'products',          'id', 'CASCADE',  'CASCADE'],
  ['product_collections',      'product_collections_ibfk_2',                'fk_pc_collection',           'collection_id',      'collections',       'id', 'CASCADE',  'CASCADE'],
  ['product_reviews',          'product_reviews_ibfk_1',                    'fk_product_reviews_product', 'product_id',         'products',          'id', 'CASCADE',  'CASCADE'],
  ['product_reviews',          'product_reviews_ibfk_2',                    'fk_product_reviews_variant', 'variant_id',         'product_variants',  'id', 'SET NULL', 'CASCADE'],
  ['product_specifications',   'product_specifications_ibfk_1',             'fk_ps_product',              'product_id',         'products',          'id', 'CASCADE',  'CASCADE'],
  ['product_variants',         'product_variants_ibfk_1',                   'fk_variants_product',        'product_id',         'products',          'id', 'CASCADE',  'CASCADE'],
  ['product_warranties',       'product_warranties_ibfk_1',                 'fk_pw_product',              'product_id',         'products',          'id', 'CASCADE',  'CASCADE'],
  ['product_warranties',       'product_warranties_ibfk_2',                 'fk_pw_warranty',             'warranty_package_id', 'warranty_packages','id', 'CASCADE',  'CASCADE'],
  ['recently_viewed',          'recently_viewed_ibfk_1',                    'fk_rv_user',                 'user_id',            'users',             'id', 'CASCADE',  'CASCADE'],
  ['recently_viewed',          'recently_viewed_ibfk_2',                    'fk_rv_product',              'product_id',         'products',          'id', 'CASCADE',  'CASCADE'],
  ['reviews',                  'reviews_ibfk_1',                            'fk_reviews_product',         'product_id',         'products',          'id', 'CASCADE',  'CASCADE'],
  ['reviews',                  'reviews_ibfk_2',                            'fk_reviews_user',            'user_id',            'users',             'id', 'CASCADE',  'CASCADE'],
  ['review_feedbacks',         'review_feedbacks_ibfk_1',                   'fk_review_feedbacks_review', 'review_id',          'reviews',           'id', 'CASCADE',  'CASCADE'],
  ['review_feedbacks',         'review_feedbacks_ibfk_2',                   'fk_review_feedbacks_user',   'user_id',            'users',             'id', 'CASCADE',  'CASCADE'],
  ['wishlists',                'wishlists_ibfk_1',                          'fk_wishlists_user',          'user_id',            'users',             'id', 'CASCADE',  'CASCADE'],
  ['wishlists',                'wishlists_ibfk_2',                          'fk_wishlists_product',       'product_id',         'products',          'id', 'CASCADE',  'CASCADE'],
];

async function constraintExists(qi, table, name) {
  const [rows] = await qi.sequelize.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ? AND CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    { replacements: [table, name] }
  );
  return rows.length > 0;
}

module.exports = {
  async up(queryInterface) {
    for (const [table, oldName, newName, col, refTable, refCol, onDel, onUpd] of FK_RENAMES) {
      const newExists = await constraintExists(queryInterface, table, newName);
      if (newExists) {
        // Idempotent — đã rename, skip
        continue;
      }
      const oldExists = await constraintExists(queryInterface, table, oldName);
      if (oldExists) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${oldName}\``
        );
      }
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${newName}\`
         FOREIGN KEY (\`${col}\`) REFERENCES \`${refTable}\`(\`${refCol}\`)
         ON DELETE ${onDel} ON UPDATE ${onUpd}`
      );
    }
  },

  async down(queryInterface) {
    for (const [table, oldName, newName, col, refTable, refCol, onDel, onUpd] of FK_RENAMES) {
      const newExists = await constraintExists(queryInterface, table, newName);
      if (newExists) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` DROP FOREIGN KEY \`${newName}\``
        );
      }
      const oldExists = await constraintExists(queryInterface, table, oldName);
      if (!oldExists) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` ADD CONSTRAINT \`${oldName}\`
           FOREIGN KEY (\`${col}\`) REFERENCES \`${refTable}\`(\`${refCol}\`)
           ON DELETE ${onDel} ON UPDATE ${onUpd}`
        );
      }
    }
  },
};
