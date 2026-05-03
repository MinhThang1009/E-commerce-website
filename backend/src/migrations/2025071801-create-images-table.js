'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    const tableExists = await doesTableExist(queryInterface, 'images');
    if (!tableExists) {
      await queryInterface.createTable('images', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
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
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'products', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        user_id: {
          type: Sequelize.UUID,
          allowNull: true,
          references: { model: 'users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'CASCADE',
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
          allowNull: false,
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
    }

    await addIndexIfMissing(queryInterface, 'images', ['product_id'], { name: 'idx_images_product_id' });
    await addIndexIfMissing(queryInterface, 'images', ['user_id'], { name: 'idx_images_user_id' });
    await addIndexIfMissing(queryInterface, 'images', ['category'], { name: 'idx_images_category' });
    await addIndexIfMissing(queryInterface, 'images', ['is_active'], { name: 'idx_images_is_active' });
    await addIndexIfMissing(queryInterface, 'images', ['created_at'], { name: 'idx_images_created_at' });
    await addIndexIfMissing(queryInterface, 'images', ['file_name'], { name: 'idx_images_file_name', unique: true });
  },

  down: async (queryInterface) => {
    await queryInterface.dropTable('images');
  },
};

async function doesTableExist(queryInterface, table) {
  try {
    await queryInterface.describeTable(table);
    return true;
  } catch {
    return false;
  }
}

async function addIndexIfMissing(queryInterface, table, fields, options = {}) {
  const indexName = options.name || `${table}_${fields.join('_')}_idx`;
  try {
    const indexes = await queryInterface.showIndex(table);
    if (!indexes.some((i) => i.name === indexName)) {
      await queryInterface.addIndex(table, fields, { ...options, name: indexName });
    }
  } catch {
    // skip if index already exists or table unavailable
  }
}
