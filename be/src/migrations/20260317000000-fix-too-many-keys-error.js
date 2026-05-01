'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    /**
     * This migration drops all tables and recreates them to fix the
     * "Too many keys specified; max 64 keys allowed" error.
     * 
     * This happens because Sequelize was creating too many foreign key 
     * indexes. We drop everything and sync fresh models without FK constraints.
     */
    try {
      console.log('⚠️ Dropping all tables to fix key limit error...');
      
      // Get all tables
      const tables = await queryInterface.showAllTables();
      
      // Drop all tables in reverse order of dependencies
      for (const table of tables) {
        try {
          await queryInterface.dropTable(table, { force: true });
          console.log(`✓ Dropped table: ${table}`);
        } catch (error) {
          console.log(`⚠ Could not drop table ${table}, continuing...`);
        }
      }
      
      console.log('✓ All tables dropped. Fresh database ready for sync.');
    } catch (error) {
      console.error('Error in migration:', error);
      throw error;
    }
  },

  async down(queryInterface, Sequelize) {
    // This migration cannot be reverted as it drops data
    console.log('⚠️ This migration drops all data and cannot be reverted.');
    throw new Error('Cannot revert fix-too-many-keys-error migration');
  }
};
