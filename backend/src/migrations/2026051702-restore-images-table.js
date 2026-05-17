'use strict';

// Restore bảng images bị DROP nhầm bởi migration 2026051615.
// Bảng images (file management) khác với product_images (catalog URL) —
// hai bảng phục vụ mục đích khác nhau, không thể thay thế nhau.
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableExists = await queryInterface.describeTable('images').then(() => true).catch(() => false);
    if (tableExists) {
      console.log('  SKIP: images table already exists');
      return;
    }

    await queryInterface.createTable('images', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      original_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      file_name: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      file_path: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      file_size: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      mime_type: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      width: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      height: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      category: {
        type: Sequelize.ENUM('product', 'thumbnail', 'user', 'review'),
        allowNull: false,
        defaultValue: 'product',
      },
      product_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'products', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.NOW,
      },
    });

    await queryInterface.addIndex('images', ['product_id'], { name: 'idx_images_product_id' });
    await queryInterface.addIndex('images', ['user_id'],    { name: 'idx_images_user_id' });
    await queryInterface.addIndex('images', ['category'],   { name: 'idx_images_category' });
    await queryInterface.addIndex('images', ['is_active'],  { name: 'idx_images_is_active' });

    console.log('  CREATED: images table restored');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('images');
  },
};
