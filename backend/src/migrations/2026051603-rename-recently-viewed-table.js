'use strict';

// Migration: Đổi tên bảng recently_viewed → recently_viewed_products
// Tên cũ mơ hồ (viewed cái gì?), tên mới rõ ý nghĩa hơn.
//
// Cần drop FK constraints và indexes trước khi rename,
// sau đó recreate với tên mới.

async function tableExists(qi, table) {
  const [rows] = await qi.sequelize.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     LIMIT 1`,
    { replacements: [table] },
  );
  return rows.length > 0;
}

async function fkExists(qi, table, constraintName) {
  const [rows] = await qi.sequelize.query(
    `SELECT CONSTRAINT_NAME FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND CONSTRAINT_NAME = ?
       AND CONSTRAINT_TYPE = 'FOREIGN KEY'
     LIMIT 1`,
    { replacements: [table, constraintName] },
  );
  return rows.length > 0;
}

async function indexExists(qi, table, indexName) {
  const [rows] = await qi.sequelize.query(
    `SELECT INDEX_NAME FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND INDEX_NAME = ?
     LIMIT 1`,
    { replacements: [table, indexName] },
  );
  return rows.length > 0;
}

module.exports = {
  async up(queryInterface) {
    // Idempotent: nếu đã rename rồi thì skip
    if (await tableExists(queryInterface, 'recently_viewed_products')) {
      console.log('  SKIP: recently_viewed_products đã tồn tại');
      return;
    }

    if (!(await tableExists(queryInterface, 'recently_viewed'))) {
      console.log('  SKIP: recently_viewed không tồn tại');
      return;
    }

    // Bước 1: Drop FK constraints trên bảng cũ
    const fkNames = ['fk_rv_user', 'fk_rv_product'];
    for (const fk of fkNames) {
      if (await fkExists(queryInterface, 'recently_viewed', fk)) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`recently_viewed\` DROP FOREIGN KEY \`${fk}\``,
        );
        console.log(`  DROPPED FK: ${fk}`);
      }
    }

    // Bước 2: Drop indexes (UNIQUE và regular)
    const indexNames = ['recently_viewed_user_product_unique', 'idx_rv_user_product'];
    for (const idx of indexNames) {
      if (await indexExists(queryInterface, 'recently_viewed', idx)) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`recently_viewed\` DROP INDEX \`${idx}\``,
        );
        console.log(`  DROPPED INDEX: ${idx}`);
      }
    }

    // Bước 3: Rename table
    await queryInterface.renameTable('recently_viewed', 'recently_viewed_products');
    console.log('  RENAMED: recently_viewed → recently_viewed_products');

    // Bước 4: Recreate FK constraints trên bảng mới
    await queryInterface.sequelize.query(
      `ALTER TABLE \`recently_viewed_products\`
       ADD CONSTRAINT \`fk_rvp_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE \`recently_viewed_products\`
       ADD CONSTRAINT \`fk_rvp_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    console.log('  RECREATED FKs: fk_rvp_user, fk_rvp_product');

    // Bước 5: Recreate index
    await queryInterface.sequelize.query(
      `ALTER TABLE \`recently_viewed_products\` ADD INDEX \`idx_rvp_user_product\` (\`user_id\`, \`product_id\`)`,
    );
    console.log('  RECREATED INDEX: idx_rvp_user_product');
  },

  async down(queryInterface) {
    // Rollback: đổi tên ngược lại
    if (!(await tableExists(queryInterface, 'recently_viewed_products'))) {
      console.log('  SKIP: recently_viewed_products không tồn tại');
      return;
    }

    // Drop FK trên bảng mới
    const fkNames = ['fk_rvp_user', 'fk_rvp_product'];
    for (const fk of fkNames) {
      if (await fkExists(queryInterface, 'recently_viewed_products', fk)) {
        await queryInterface.sequelize.query(
          `ALTER TABLE \`recently_viewed_products\` DROP FOREIGN KEY \`${fk}\``,
        );
      }
    }

    // Drop index
    if (await indexExists(queryInterface, 'recently_viewed_products', 'idx_rvp_user_product')) {
      await queryInterface.sequelize.query(
        `ALTER TABLE \`recently_viewed_products\` DROP INDEX \`idx_rvp_user_product\``,
      );
    }

    // Rename ngược
    await queryInterface.renameTable('recently_viewed_products', 'recently_viewed');
    console.log('  RENAMED: recently_viewed_products → recently_viewed');

    // Recreate FK cũ
    await queryInterface.sequelize.query(
      `ALTER TABLE \`recently_viewed\`
       ADD CONSTRAINT \`fk_rv_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );
    await queryInterface.sequelize.query(
      `ALTER TABLE \`recently_viewed\`
       ADD CONSTRAINT \`fk_rv_product\` FOREIGN KEY (\`product_id\`) REFERENCES \`products\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE`,
    );

    // Recreate index
    await queryInterface.sequelize.query(
      `ALTER TABLE \`recently_viewed\` ADD INDEX \`idx_rv_user_product\` (\`user_id\`, \`product_id\`)`,
    );
  },
};
