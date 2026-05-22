'use strict';

// Bảng review_feedbacks không có Sequelize model, không được dùng bởi bất kỳ service/controller nào.
module.exports = {
  async up(queryInterface) {
    await queryInterface.dropTable('review_feedbacks');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.createTable('review_feedbacks', {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true,
        allowNull: false,
      },
      review_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'product_reviews', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      is_helpful: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'),
      },
    });

    await queryInterface.addIndex('review_feedbacks', ['review_id'], {
      name: 'idx_review_feedbacks_review_id',
    });
    await queryInterface.addIndex('review_feedbacks', ['user_id'], {
      name: 'idx_review_feedbacks_user_id',
    });
    await queryInterface.addIndex('review_feedbacks', ['review_id', 'user_id'], {
      name: 'uq_review_feedbacks_review_user',
      unique: true,
    });
  },
};
