'use strict';

// Phase 38: chuẩn hóa tên FK constraint cho product_images và images
// Hai bảng này chưa có FK constraint tên chuẩn (fk_):
//   - product_images: model không khai báo references: → chưa có FK constraints
//   - images: model khai báo references: → MySQL tự sinh tên ibfk_
// Fix: xóa tất cả FK constraint hiện có, tạo lại với tên theo chuẩn fk_{table}_{ref}

module.exports = {
  async up(queryInterface) {
    // Helper: lấy tất cả FK constraint names của bảng
    const getFKConstraints = async (tableName) => {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT CONSTRAINT_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = :tableName
           AND REFERENCED_TABLE_NAME IS NOT NULL`,
        { replacements: { tableName } }
      );
      return rows.map((r) => r.CONSTRAINT_NAME);
    };

    // ── product_images: thêm FK constraints với tên chuẩn ──────────────────
    const piConstraints = await getFKConstraints('product_images');
    for (const name of piConstraints) {
      try {
        await queryInterface.removeConstraint('product_images', name);
      } catch {
        // Bỏ qua nếu constraint không tồn tại trong engine
      }
    }
    await queryInterface.addConstraint('product_images', {
      fields: ['product_id'],
      type: 'foreign key',
      name: 'fk_product_images_products',
      references: { table: 'products', field: 'id' },
      onDelete: 'CASCADE',
      onUpdate: 'CASCADE',
    });
    await queryInterface.addConstraint('product_images', {
      fields: ['variant_id'],
      type: 'foreign key',
      name: 'fk_product_images_variants',
      references: { table: 'product_variants', field: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });

    // ── images: xóa ibfk_ auto-generated, tạo lại với tên chuẩn ────────────
    const imgConstraints = await getFKConstraints('images');
    for (const name of imgConstraints) {
      try {
        await queryInterface.removeConstraint('images', name);
      } catch {
        // Bỏ qua nếu constraint không tồn tại
      }
    }
    await queryInterface.addConstraint('images', {
      fields: ['product_id'],
      type: 'foreign key',
      name: 'fk_images_products',
      references: { table: 'products', field: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
    await queryInterface.addConstraint('images', {
      fields: ['user_id'],
      type: 'foreign key',
      name: 'fk_images_users',
      references: { table: 'users', field: 'id' },
      onDelete: 'SET NULL',
      onUpdate: 'CASCADE',
    });
  },

  async down(queryInterface) {
    // Rollback: xóa các FK constraints đã thêm
    const names = [
      ['product_images', 'fk_product_images_products'],
      ['product_images', 'fk_product_images_variants'],
      ['images', 'fk_images_products'],
      ['images', 'fk_images_users'],
    ];
    for (const [table, name] of names) {
      try {
        await queryInterface.removeConstraint(table, name);
      } catch {
        // Bỏ qua nếu đã xóa hoặc không tồn tại
      }
    }
  },
};
