'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('chat_messages', 'metadata', {
      type: Sequelize.TEXT,
      allowNull: true,
      comment: 'JSON string: { products, suggestions } cho assistant messages — dùng cho demo sync',
    });
  },
  async down(queryInterface) {
    await queryInterface.removeColumn('chat_messages', 'metadata');
  },
};
