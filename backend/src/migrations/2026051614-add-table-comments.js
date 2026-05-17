'use strict';
/**
 * Thêm COMMENT cho 41 bảng — cải thiện documentation schema.
 * Naming-convention audit item: "Table comments = 0".
 */

const TABLE_COMMENTS = [
  ['users',                 'Người dùng hệ thống (customer, admin, manager)'],
  ['addresses',             'Địa chỉ giao hàng của người dùng'],
  ['categories',            'Danh mục sản phẩm (đa cấp)'],
  ['brands',                'Thương hiệu sản phẩm'],
  ['collections',           'Bộ sưu tập / nhóm sản phẩm tùy chỉnh'],
  ['products',              'Sản phẩm — hỗ trợ i18n (name_vi/name_en), soft-delete'],
  ['product_categories',    'Quan hệ nhiều-nhiều: sản phẩm ↔ danh mục'],
  ['product_variants',      'Biến thể sản phẩm (màu sắc, dung lượng, v.v.)'],
  ['product_images',        'Hình ảnh sản phẩm'],
  ['product_attributes',    'Thuộc tính sản phẩm (tên nhóm + giá trị)'],
  ['product_specifications','Thông số kỹ thuật sản phẩm'],
  ['product_collections',   'Quan hệ nhiều-nhiều: sản phẩm ↔ bộ sưu tập'],
  ['reviews',               'Đánh giá sản phẩm của người dùng'],
  ['review_feedbacks',      'Phản hồi (helpful/unhelpful) cho từng đánh giá'],
  ['carts',                 'Giỏ hàng (guest cart dùng session_id)'],
  ['cart_items',            'Sản phẩm trong giỏ hàng'],
  ['orders',                'Đơn hàng — trạng thái đầy đủ từ pending → delivered'],
  ['order_items',           'Chi tiết sản phẩm trong đơn hàng'],
  ['wishlists',             'Danh sách yêu thích của người dùng'],
  ['recently_viewed_products', 'Sản phẩm đã xem gần đây (personalization)'],
  ['search_histories',      'Lịch sử tìm kiếm (dùng cho gợi ý AI)'],
  ['loyalty_histories',     'Lịch sử tích/tiêu điểm loyalty'],
  ['warranty_packages',     'Gói bảo hành mở rộng'],
  ['discount_codes',        'Mã giảm giá (percentage hoặc fixed)'],
  ['inventory_logs',        'Nhật ký nhập/xuất kho'],
  ['audit_logs',            'Nhật ký hành động admin (immutable)'],
  ['images',                'Bảng ảnh legacy — đang migrate sang product_images'],
  ['banners',               'Banner quảng cáo trang chủ — hỗ trợ i18n (title_vi/title_en)'],
  ['news',                  'Bài tin tức / blog — hỗ trợ i18n (title_vi/title_en)'],
  ['newsletter_subscribers','Đăng ký nhận newsletter'],
  ['feedbacks',             'Phản hồi liên hệ từ khách hàng'],
  ['email_campaigns',       'Chiến dịch email marketing'],
  ['chat_messages',         'Tin nhắn AI chatbot (messageType=ai_chatbot)'],
  ['import_logs',           'Nhật ký import sản phẩm hàng loạt'],
  ['attribute_groups',      'Nhóm thuộc tính sản phẩm (CPU, RAM, Màu sắc...)'],
  ['attribute_values',      'Giá trị cụ thể của từng nhóm thuộc tính'],
  ['brand_categories',      'Quan hệ nhiều-nhiều: thương hiệu ↔ danh mục'],
  ['product_warranties',    'Thông tin bảo hành chi tiết của từng sản phẩm'],
  ['collections',           'Bộ sưu tập — đã xử lý ở trên (duplicate skip)'],
];

module.exports = {
  async up(queryInterface) {
    const seen = new Set();
    for (const [table, comment] of TABLE_COMMENTS) {
      if (seen.has(table)) continue;
      seen.add(table);
      try {
        // Lấy CREATE TABLE để biết ENGINE và CHARSET hiện tại
        const [[row]] = await queryInterface.sequelize.query(
          `SHOW CREATE TABLE \`${table}\``
        );
        const createSql = row['Create Table'] || '';
        const engineMatch = createSql.match(/ENGINE=(\w+)/i);
        const charsetMatch = createSql.match(/DEFAULT CHARSET=(\w+)/i);
        const engine  = engineMatch  ? engineMatch[1]  : 'InnoDB';
        const charset = charsetMatch ? charsetMatch[1] : 'utf8mb4';

        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` COMMENT = '${comment.replace(/'/g, "\\'")}' ENGINE=${engine} DEFAULT CHARSET=${charset}`
        );
        process.stdout.write(`  ✓ ${table}\n`);
      } catch (err) {
        if (err.message.includes("doesn't exist")) {
          process.stdout.write(`  SKIP (not found): ${table}\n`);
        } else {
          console.warn(`  WARN ${table}: ${err.message}`);
        }
      }
    }
  },

  async down(queryInterface) {
    const seen = new Set();
    for (const [table] of TABLE_COMMENTS) {
      if (seen.has(table)) continue;
      seen.add(table);
      try {
        const [[row]] = await queryInterface.sequelize.query(`SHOW CREATE TABLE \`${table}\``);
        const createSql = row['Create Table'] || '';
        const engineMatch  = createSql.match(/ENGINE=(\w+)/i);
        const charsetMatch = createSql.match(/DEFAULT CHARSET=(\w+)/i);
        const engine  = engineMatch  ? engineMatch[1]  : 'InnoDB';
        const charset = charsetMatch ? charsetMatch[1] : 'utf8mb4';
        await queryInterface.sequelize.query(
          `ALTER TABLE \`${table}\` COMMENT = '' ENGINE=${engine} DEFAULT CHARSET=${charset}`
        );
      } catch { /* ignore */ }
    }
  },
};
