'use strict';
/**
 * Gap 11: Cleanup orphaned DB structures.
 * 1. Drop `images` table (legacy, 0 rows — replaced by `product_images`)
 * 2. Fix `chat_messages.message_type` ENUM — remove dead 'support_chat' value
 */
module.exports = {
  async up(queryInterface) {
    // 1. Drop images table (0 rows confirmed, model/index.js still references it
    //    for legacy FK — drop sau khi verify no data)
    try {
      const [rows] = await queryInterface.sequelize.query('SELECT COUNT(*) AS c FROM `images`');
      if (rows[0].c > 0) {
        console.log(`  SKIP: images table has ${rows[0].c} rows — manual review needed`);
      } else {
        // Remove FK references trước khi drop
        await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 0');
        await queryInterface.sequelize.query('DROP TABLE IF EXISTS `images`');
        await queryInterface.sequelize.query('SET FOREIGN_KEY_CHECKS = 1');
        console.log('  DROPPED: images table (0 rows, replaced by product_images)');
      }
    } catch (err) {
      console.warn('  WARN dropping images:', err.message);
    }

    // 2. Fix chat_messages.message_type ENUM — remove 'support_chat'
    // MySQL không có DROP VALUE cho ENUM — phải MODIFY COLUMN
    try {
      const [[col]] = await queryInterface.sequelize.query(
        `SELECT column_type FROM information_schema.columns
         WHERE table_schema = DATABASE() AND table_name = 'chat_messages' AND column_name = 'message_type'`
      );
      if (col && col.column_type.includes('support_chat')) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`chat_messages\`
           MODIFY COLUMN \`message_type\` ENUM('ai_chatbot') NOT NULL DEFAULT 'ai_chatbot'`
        );
        console.log("  FIXED: chat_messages.message_type — removed dead 'support_chat' ENUM value");
      } else {
        console.log('  SKIP: chat_messages.message_type already clean');
      }
    } catch (err) {
      console.warn('  WARN fixing message_type enum:', err.message);
    }
  },

  async down(queryInterface, Sequelize) {
    // Restore message_type enum (data recovery not possible for dropped table)
    await queryInterface.sequelize.query(
      `ALTER TABLE \`chat_messages\`
       MODIFY COLUMN \`message_type\` ENUM('ai_chatbot', 'support_chat') NOT NULL DEFAULT 'ai_chatbot'`
    ).catch(() => {});
  },
};
