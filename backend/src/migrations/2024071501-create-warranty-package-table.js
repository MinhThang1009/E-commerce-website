'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableExists = await doesTableExist(queryInterface, 'warranty_packages');
    if (!tableExists) {
      await queryInterface.createTable('warranty_packages', {
        id: {
          type: Sequelize.UUID,
          defaultValue: Sequelize.UUIDV4,
          primaryKey: true,
        },
        name: {
          type: Sequelize.STRING,
          allowNull: false,
        },
        description: {
          type: Sequelize.TEXT,
          allowNull: true,
        },
        duration_months: {
          type: Sequelize.INTEGER,
          allowNull: false,
        },
        price: {
          type: Sequelize.DECIMAL(12, 2),
          allowNull: false,
          defaultValue: 0,
        },
        terms: {
          type: Sequelize.JSON,
        },
        coverage: {
          type: Sequelize.JSON,
        },
        is_active: {
          type: Sequelize.BOOLEAN,
          defaultValue: true,
        },
        sort_order: {
          type: Sequelize.INTEGER,
          defaultValue: 0,
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

    await addIndexIfMissing(queryInterface, 'warranty_packages', ['is_active']);
    await addIndexIfMissing(queryInterface, 'warranty_packages', ['sort_order']);
  },

  async down(queryInterface) {
    await dropTableIfExists(queryInterface, 'warranty_packages');
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

async function dropTableIfExists(queryInterface, table) {
  const exists = await doesTableExist(queryInterface, table);
  if (exists) await queryInterface.dropTable(table);
}

async function addIndexIfMissing(queryInterface, table, fields, options = {}) {
  const indexName = options.name || `${table}_${fields.join('_')}_idx`;
  try {
    const indexes = await queryInterface.showIndex(table);
    if (!indexes.some((i) => i.name === indexName)) {
      await queryInterface.addIndex(table, fields, { ...options, name: indexName });
    }
  } catch {
    // index already exists or table unavailable — skip
  }
}
