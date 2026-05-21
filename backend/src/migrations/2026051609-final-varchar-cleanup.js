'use strict';

module.exports = {
  async up(queryInterface) {
    const safe = async (sql) => {
      try {
        await queryInterface.sequelize.query(sql);
      } catch (e) {
        console.log('  SKIP:', e.original?.sqlMessage || e.message);
      }
    };

    // varchar(255) → varchar(200) cho product/variant name fields
    await safe('ALTER TABLE product_variants MODIFY COLUMN variant_name VARCHAR(200)');
    await safe('ALTER TABLE product_variants MODIFY COLUMN display_name VARCHAR(200)');
    await safe('ALTER TABLE products MODIFY COLUMN base_name VARCHAR(200)');
    await safe('ALTER TABLE products MODIFY COLUMN model VARCHAR(200)');

    // varchar(255) → varchar(200) cho legacy image fields
    await safe('ALTER TABLE images MODIFY COLUMN original_name VARCHAR(200)');
    await safe('ALTER TABLE images MODIFY COLUMN file_name VARCHAR(200)');

    // Drop ghost column stripe_customer_id (documented in backlog Gap 11)
    await safe('ALTER TABLE users DROP COLUMN stripe_customer_id');

    // Chuẩn hóa name columns varchar(100) → varchar(200) cho consistency
    const tables100 = [
      'addresses',
      'attribute_groups',
      'attribute_values',
      'feedbacks',
      'product_attributes',
      'product_specifications',
    ];
    for (const t of tables100) {
      await safe(`ALTER TABLE ${t} MODIFY COLUMN name VARCHAR(200) NOT NULL`);
    }

    console.log('  Done: varchar cleanup + stripe drop + name standardization');
  },

  async down(queryInterface) {
    const safe = async (sql) => {
      try {
        await queryInterface.sequelize.query(sql);
      } catch (e) {
        console.log('  SKIP:', e.original?.sqlMessage || e.message);
      }
    };

    await safe('ALTER TABLE product_variants MODIFY COLUMN variant_name VARCHAR(255)');
    await safe('ALTER TABLE product_variants MODIFY COLUMN display_name VARCHAR(255)');
    await safe('ALTER TABLE products MODIFY COLUMN base_name VARCHAR(255)');
    await safe('ALTER TABLE products MODIFY COLUMN model VARCHAR(255)');
    await safe('ALTER TABLE images MODIFY COLUMN original_name VARCHAR(255)');
    await safe('ALTER TABLE images MODIFY COLUMN file_name VARCHAR(255)');
    await safe('ALTER TABLE users ADD COLUMN stripe_customer_id VARCHAR(255) AFTER loyalty_points');

    const tables100 = [
      'addresses',
      'attribute_groups',
      'attribute_values',
      'feedbacks',
      'product_attributes',
      'product_specifications',
    ];
    for (const t of tables100) {
      await safe(`ALTER TABLE ${t} MODIFY COLUMN name VARCHAR(100) NOT NULL`);
    }
  },
};
