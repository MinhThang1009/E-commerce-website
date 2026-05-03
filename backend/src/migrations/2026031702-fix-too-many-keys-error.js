'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // This migration previously dropped all tables which was destructive.
    // The schema is now managed via migration_full.sql + rebuildDb.js.
    // This migration is intentionally a no-op.
  },

  async down(queryInterface) {
    // no-op
  },
};
