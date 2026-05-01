'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // 1. Add loyaltyPoints to users table
    await queryInterface.addColumn('users', 'loyaltyPoints', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    });

    // 2. Add columns to orders table
    await queryInterface.addColumn('orders', 'pointsEarned', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    });
    await queryInterface.addColumn('orders', 'pointsUsed', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    });
    await queryInterface.addColumn('orders', 'pointsDiscount', {
      type: Sequelize.DECIMAL(19, 2),
      defaultValue: 0,
    });

    // 3. Create loyalty_histories table
    await queryInterface.createTable('loyalty_histories', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      order_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: {
          model: 'orders',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      points: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      type: {
        type: Sequelize.ENUM('earn', 'spend', 'refund', 'adjustment'),
        allowNull: false,
      },
      description: {
        type: Sequelize.STRING,
        allowNull: true,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // 4. Create recently_viewed table
    await queryInterface.createTable('recently_viewed', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      product_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'products',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      viewed_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.NOW,
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
      },
    });

    // Add unique constraint to recently_viewed to simplify updates
    await queryInterface.addIndex('recently_viewed', ['user_id', 'product_id'], {
      unique: true,
      name: 'recently_viewed_user_product_unique'
    });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.dropTable('recently_viewed');
    await queryInterface.dropTable('loyalty_histories');
    await queryInterface.removeColumn('orders', 'pointsDiscount');
    await queryInterface.removeColumn('orders', 'pointsUsed');
    await queryInterface.removeColumn('orders', 'pointsEarned');
    await queryInterface.removeColumn('users', 'loyaltyPoints');
  },
};
