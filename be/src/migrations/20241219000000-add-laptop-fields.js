'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    // Add new fields to products table
    await addColumnIfMissing(queryInterface, 'products', 'brand', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, 'products', 'model', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, 'products', 'condition', {
      type: Sequelize.ENUM('new', 'like-new', 'used', 'refurbished'),
      defaultValue: 'new',
    });

    await addColumnIfMissing(queryInterface, 'products', 'warranty_months', {
      type: Sequelize.INTEGER,
      defaultValue: 12,
    });

    await addColumnIfMissing(queryInterface, 'products', 'specifications', {
      type: Sequelize.JSON,
    });

    // Add new fields to product_variants table
    await addColumnIfMissing(queryInterface, 'product_variants', 'display_name', {
      type: Sequelize.STRING,
      allowNull: true,
    });

    await addColumnIfMissing(queryInterface, 'product_variants', 'sort_order', {
      type: Sequelize.INTEGER,
      defaultValue: 0,
    });

    await addColumnIfMissing(queryInterface, 'product_variants', 'is_default', {
      type: Sequelize.BOOLEAN,
      defaultValue: false,
    });

    await addColumnIfMissing(queryInterface, 'product_variants', 'is_available', {
      type: Sequelize.BOOLEAN,
      defaultValue: true,
    });

    // Create warranty_packages table
    await createTableIfMissing(queryInterface, 'warranty_packages', {
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
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Create product_warranties junction table
    await createTableIfMissing(queryInterface, 'product_warranties', {
      id: {
        type: Sequelize.UUID,
        defaultValue: Sequelize.UUIDV4,
        primaryKey: true,
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
      warranty_package_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: {
          model: 'warranty_packages',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      is_default: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
      },
    });

    // Add indexes
    await addIndexIfMissing(queryInterface, 'products', ['brand']);
    await addIndexIfMissing(queryInterface, 'products', ['model']);
    await addIndexIfMissing(queryInterface, 'products', ['condition']);
    await addIndexIfMissing(queryInterface, 'product_variants', ['is_default']);
    await addIndexIfMissing(queryInterface, 'product_variants', ['is_available']);
    await addIndexIfMissing(queryInterface, 'product_warranties', ['product_id']);
    await addIndexIfMissing(queryInterface, 'product_warranties', [
      'warranty_package_id',
    ]);
  },

  down: async (queryInterface, Sequelize) => {
    // Remove indexes
    await removeIndexIfExists(queryInterface, 'products', ['brand']);
    await removeIndexIfExists(queryInterface, 'products', ['model']);
    await removeIndexIfExists(queryInterface, 'products', ['condition']);
    await removeIndexIfExists(queryInterface, 'product_variants', ['is_default']);
    await removeIndexIfExists(queryInterface, 'product_variants', ['is_available']);
    await removeIndexIfExists(queryInterface, 'product_warranties', ['product_id']);
    await removeIndexIfExists(queryInterface, 'product_warranties', [
      'warranty_package_id',
    ]);

    // Drop tables
    await dropTableIfExists(queryInterface, 'product_warranties');
    await dropTableIfExists(queryInterface, 'warranty_packages');

    // Remove columns from product_variants
    await removeColumnIfExists(queryInterface, 'product_variants', 'display_name');
    await removeColumnIfExists(queryInterface, 'product_variants', 'sort_order');
    await removeColumnIfExists(queryInterface, 'product_variants', 'is_default');
    await removeColumnIfExists(queryInterface, 'product_variants', 'is_available');

    // Remove columns from products
    await removeColumnIfExists(queryInterface, 'products', 'brand');
    await removeColumnIfExists(queryInterface, 'products', 'model');
    await removeColumnIfExists(queryInterface, 'products', 'condition');
    await removeColumnIfExists(queryInterface, 'products', 'warranty_months');
    await removeColumnIfExists(queryInterface, 'products', 'specifications');
  },
};

async function addColumnIfMissing(queryInterface, table, column, definition) {
  const tableDefinition = await queryInterface.describeTable(table);
  if (!tableDefinition[column]) {
    await queryInterface.addColumn(table, column, definition);
  }
}

async function removeColumnIfExists(queryInterface, table, column) {
  const tableDefinition = await queryInterface.describeTable(table);
  if (tableDefinition[column]) {
    await queryInterface.removeColumn(table, column);
  }
}

async function createTableIfMissing(queryInterface, table, definition) {
  const tableExists = await doesTableExist(queryInterface, table);
  if (!tableExists) {
    await queryInterface.createTable(table, definition);
  }
}

async function dropTableIfExists(queryInterface, table) {
  const tableExists = await doesTableExist(queryInterface, table);
  if (tableExists) {
    await queryInterface.dropTable(table);
  }
}

async function addIndexIfMissing(queryInterface, table, fields) {
  const indexName = buildIndexName(table, fields);
  const hasIndex = await doesIndexExist(queryInterface, table, indexName);
  if (!hasIndex) {
    await queryInterface.addIndex(table, fields, { name: indexName });
  }
}

async function removeIndexIfExists(queryInterface, table, fields) {
  const indexName = buildIndexName(table, fields);
  const hasIndex = await doesIndexExist(queryInterface, table, indexName);
  if (hasIndex) {
    await queryInterface.removeIndex(table, indexName);
  }
}

async function doesTableExist(queryInterface, table) {
  try {
    await queryInterface.describeTable(table);
    return true;
  } catch (err) {
    return false;
  }
}

async function doesIndexExist(queryInterface, table, indexName) {
  try {
    const indexes = await queryInterface.showIndex(table);
    return indexes.some((index) => index.name === indexName);
  } catch (err) {
    return false;
  }
}

function buildIndexName(table, fields) {
  return `${table}_${fields.join('_')}_idx`;
}
