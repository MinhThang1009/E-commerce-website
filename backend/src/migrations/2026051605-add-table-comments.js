'use strict';

// Migration: Thêm COMMENT cho tất cả tables (trừ SequelizeMeta)
// Giúp document schema trực tiếp trong DB — DBA và developer đều đọc được.
// Idempotent: ALTER TABLE ... COMMENT ghi đè comment cũ nếu đã có.

const TABLE_COMMENTS = [
  ['addresses',              'Địa chỉ giao hàng và thanh toán của người dùng'],
  ['attribute_groups',       'Nhóm thuộc tính sản phẩm (màu sắc, dung lượng, RAM...)'],
  ['attribute_values',       'Giá trị cụ thể trong nhóm thuộc tính (đỏ, xanh, 128GB...)'],
  ['audit_logs',             'Nhật ký thao tác quản trị (audit trail)'],
  ['banners',                'Banner quảng cáo hiển thị trên trang chủ và các vị trí khác'],
  ['brand_categories',       'Bảng trung gian liên kết thương hiệu với danh mục'],
  ['brands',                 'Thương hiệu sản phẩm (Apple, Samsung, Dell...)'],
  ['cart_items',             'Sản phẩm trong giỏ hàng, liên kết với variant cụ thể'],
  ['carts',                  'Giỏ hàng của người dùng hoặc session khách'],
  ['categories',             'Danh mục sản phẩm dạng phân cấp (parentId tự tham chiếu)'],
  ['chat_messages',          'Tin nhắn chatbot AI và hỗ trợ khách hàng'],
  ['collections',            'Bộ sưu tập sản phẩm theo chủ đề (sale, mùa hè...)'],
  ['discount_codes',         'Mã giảm giá áp dụng cho đơn hàng'],
  ['email_campaigns',        'Chiến dịch email marketing gửi tới subscribers'],
  ['feedbacks',              'Phản hồi từ khách hàng qua form liên hệ'],
  ['images',                 'Kho ảnh upload chung, dùng cho nhiều entity'],
  ['import_logs',            'Lịch sử import sản phẩm hàng loạt từ CSV/Excel'],
  ['inventory_logs',         'Lịch sử thay đổi tồn kho (nhập, xuất, điều chỉnh)'],
  ['loyalty_histories',      'Lịch sử tích/tiêu điểm thưởng của người dùng'],
  ['news',                   'Bài viết tin tức, blog, hướng dẫn sử dụng'],
  ['newsletter_subscribers', 'Danh sách email đăng ký nhận bản tin'],
  ['order_items',            'Chi tiết sản phẩm trong đơn hàng (variant, giá, số lượng)'],
  ['orders',                 'Đơn hàng của người dùng, bao gồm thông tin thanh toán và vận chuyển'],
  ['product_attribute_groups','Bảng trung gian gán nhóm thuộc tính cho sản phẩm'],
  ['product_attributes',     'Thuộc tính sản phẩm dạng key-value (legacy, dùng attribute_groups mới)'],
  ['product_categories',     'Bảng trung gian liên kết sản phẩm với nhiều danh mục'],
  ['product_collections',    'Bảng trung gian liên kết sản phẩm với bộ sưu tập'],
  ['product_images',         'Ảnh sản phẩm, hỗ trợ thumbnail và thứ tự hiển thị'],
  ['product_specifications', 'Thông số kỹ thuật chi tiết của sản phẩm'],
  ['product_variants',       'Biến thể sản phẩm (màu + dung lượng) với giá và tồn kho riêng'],
  ['product_warranties',     'Gói bảo hành gắn với sản phẩm cụ thể'],
  ['products',               'Sản phẩm chính — thông tin cơ bản, SEO, trạng thái'],
  ['recently_viewed_products','Sản phẩm đã xem gần đây của người dùng'],
  ['review_feedbacks',       'Phản hồi hữu ích/không hữu ích cho đánh giá sản phẩm'],
  ['reviews',                'Đánh giá và xếp hạng sản phẩm từ người dùng'],
  ['search_histories',       'Lịch sử tìm kiếm của người dùng'],
  ['warranty_packages',      'Gói bảo hành mở rộng có thể mua thêm'],
  ['wishlists',              'Danh sách sản phẩm yêu thích của người dùng'],
  ['users',                  'Tài khoản người dùng — thông tin cá nhân, xác thực, phân quyền'],
];

async function tableExists(qi, table) {
  const [rows] = await qi.sequelize.query(
    `SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
     LIMIT 1`,
    { replacements: [table] }
  );
  return rows.length > 0;
}

module.exports = {
  async up(queryInterface) {
    for (const [table, comment] of TABLE_COMMENTS) {
      if (!(await tableExists(queryInterface, table))) {
        console.log(`  SKIP: table "${table}" does not exist`);
        continue;
      }
      // Escape single quotes trong comment
      const escaped = comment.replace(/'/g, "''");
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` COMMENT = '${escaped}'`
      );
      console.log(`  COMMENT: ${table}`);
    }
  },

  async down(queryInterface) {
    // Rollback: xóa comment (set empty)
    for (const [table] of TABLE_COMMENTS) {
      if (!(await tableExists(queryInterface, table))) continue;
      await queryInterface.sequelize.query(
        `ALTER TABLE \`${table}\` COMMENT = ''`
      );
    }
  },
};
