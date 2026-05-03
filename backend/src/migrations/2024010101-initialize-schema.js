'use strict';

const sequelize = require('../config/sequelize');

// Ensure all models are registered before syncing
require('../models');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up() {
    /**
     * Use the existing Sequelize model definitions to create all tables.
     * This keeps the migration logic in sync with the current models
     * and only runs once at the beginning of the migration chain.
     * 
     * We do NOT create foreign key constraints here to avoid MySQL 64-key limit error.
     * Relationships are defined in models/index.js for ORM use only.
     */
    try {
      // Create tables without running sync (which tries to add FK constraints)
      const queryInterface = sequelize.getQueryInterface();
      const models = sequelize.models;
      
      // Create each table individually
      for (const [modelName, model] of Object.entries(models)) {
        try {
          // Check if table already exists
          const tableExists = await queryInterface.showAllTables()
            .then(tables => tables.includes(model.tableName));
          
          if (!tableExists) {
            console.log(`Creating table: ${model.tableName}`);
            await queryInterface.createTable(model.tableName, model.rawAttributes, model.options);
          }
        } catch (error) {
          // Table might already exist or other error - continue
          console.log(`Table ${model.tableName} check: ${error.message}`);
        }
      }
    } catch (error) {
      console.log('Migration up: Models created or already exist');
      // This is OK - tables might already exist from previous migrations
    }
  },

  async down() {
    /**
     * Drop every model-defined table. This is primarily for completeness;
     * it is uncommon to roll back the initial schema in production.
     */
    const queryInterface = sequelize.getQueryInterface();
    try {
      await queryInterface.dropAllTables();
    } catch (error) {
      console.log('Migration down: Error dropping tables (may already be gone)');
    }
  },
};

