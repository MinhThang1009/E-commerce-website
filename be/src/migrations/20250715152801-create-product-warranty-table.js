'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableExists = await doesTableExist(queryInterface, 'product_warranties');
    if (!tableExists) {
      await queryInterface.createTable('product_warranties', {
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
          defaultValue: Sequelize.NOW,
        },
        updated_at: {
          type: Sequelize.DATE,
          allowNull: false,
          defaultValue: Sequelize.NOW,
        },
      });
    }

    await addIndexIfMissing(queryInterface, 'product_warranties', ['product_id']);
    await addIndexIfMissing(queryInterface, 'product_warranties', [
      'warranty_package_id',
    ]);
    await addIndexIfMissing(queryInterface, 'product_warranties', ['is_default']);
    await addIndexIfMissing(
      queryInterface,
      'product_warranties',
      ['product_id', 'warranty_package_id'],
      { unique: true, name: 'unique_product_warranty' }
    );
  },

  async down(queryInterface) {
    await removeIndexIfExists(queryInterface, 'product_warranties', [
      'product_id',
    ]);
    await removeIndexIfExists(queryInterface, 'product_warranties', [
      'warranty_package_id',
    ]);
    await removeIndexIfExists(queryInterface, 'product_warranties', [
      'is_default',
    ]);
    await removeIndexIfExists(
      queryInterface,
      'product_warranties',
      ['product_id', 'warranty_package_id'],
      { name: 'unique_product_warranty' }
    );
    await dropTableIfExists(queryInterface, 'product_warranties');
  },
};

async function doesTableExist(queryInterface, table) {
  try {
    await queryInterface.describeTable(table);
    return true;
  } catch (error) {
    return false;
  }
}

async function addIndexIfMissing(queryInterface, table, fields, options = {}) {
  const indexName = options.name || buildIndexName(table, fields);
  const hasIndex = await doesIndexExist(queryInterface, table, indexName);
  if (!hasIndex) {
    await queryInterface.addIndex(table, fields, {
      ...options,
      name: indexName,
    });
  }
}

async function removeIndexIfExists(queryInterface, table, fields, options = {}) {
  const indexName = options.name || buildIndexName(table, fields);
  const hasIndex = await doesIndexExist(queryInterface, table, indexName);
  if (hasIndex) {
    await queryInterface.removeIndex(table, indexName);
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

async function dropTableIfExists(queryInterface, table) {
  const exists = await doesTableExist(queryInterface, table);
  if (exists) {
    await queryInterface.dropTable(table);
  }
}

function buildIndexName(table, fields) {
  return `${table}_${fields.join('_')}_idx`;
}
