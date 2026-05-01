'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableDefinition = await queryInterface.describeTable(
      'product_attributes'
    );

    if (!tableDefinition.type) {
      await queryInterface.addColumn('product_attributes', 'type', {
        type: Sequelize.ENUM('color', 'size', 'material', 'custom'),
        allowNull: false,
        defaultValue: 'custom',
      });
    }

    if (!tableDefinition.required) {
      await queryInterface.addColumn('product_attributes', 'required', {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
      });
    }

    if (!tableDefinition.sort_order) {
      await queryInterface.addColumn('product_attributes', 'sort_order', {
        type: Sequelize.INTEGER,
        defaultValue: 0,
      });
    }

    if (
      tableDefinition.values &&
      normalizeType(tableDefinition.values.type) !== 'JSON'
    ) {
      await queryInterface.changeColumn('product_attributes', 'values', {
        type: Sequelize.JSON,
        allowNull: false,
      });
    }

    await addIndexIfMissing(queryInterface, 'product_attributes', ['type']);
    await addIndexIfMissing(queryInterface, 'product_attributes', ['required']);
    await addIndexIfMissing(queryInterface, 'product_attributes', ['sort_order']);
  },

  async down(queryInterface, Sequelize) {
    const tableDefinition = await queryInterface.describeTable(
      'product_attributes'
    );

    if (tableDefinition.type) {
      await queryInterface.removeColumn('product_attributes', 'type');
      try {
        await queryInterface.sequelize.query(
          'DROP TYPE IF EXISTS "enum_product_attributes_type";'
        );
      } catch (err) {}
    }

    if (tableDefinition.required) {
      await queryInterface.removeColumn('product_attributes', 'required');
    }

    if (tableDefinition.sort_order) {
      await queryInterface.removeColumn('product_attributes', 'sort_order');
    }

    await removeIndexIfExists(queryInterface, 'product_attributes', ['type']);
    await removeIndexIfExists(
      queryInterface,
      'product_attributes',
      ['required']
    );
    await removeIndexIfExists(
      queryInterface,
      'product_attributes',
      ['sort_order']
    );

    if (
      tableDefinition.values &&
      normalizeType(tableDefinition.values.type) === 'JSON'
    ) {
      await queryInterface.changeColumn('product_attributes', 'values', {
        type: Sequelize.TEXT,
        allowNull: false,
      });
    }
  },
};

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

function normalizeType(type) {
  if (!type) return '';
  return type.toString().toUpperCase();
}
