'use strict';
/**
 * Seeder: tin tức công nghệ mẫu.
 * Idempotent: INSERT IGNORE theo slug.
 */
module.exports = {
  async up(queryInterface) {
    // Xóa hết news cũ (kể cả soft-deleted) trước khi insert để đảm bảo idempotent
    await queryInterface.sequelize.query('DELETE FROM news');
    await queryInterface.sequelize.query(`
      INSERT INTO news
        (title_vi, title_en, slug, content_vi, description_vi, category_vi, thumbnail, is_published, user_id, view_count, created_at, updated_at)
      VALUES
        ('iPhone 17 Pro ra mắt với chip A19 Bionic mạnh mẽ nhất từ trước đến nay',
         'iPhone 17 Pro Launched with Most Powerful A19 Bionic Chip Ever',
         'iphone-17-pro-ra-mat-chip-a19-bionic',
         '<p>Apple vừa chính thức ra mắt dòng iPhone 17 Pro với chip A19 Bionic thế hệ mới, mang lại hiệu năng vượt trội so với thế hệ trước. Thiết bị được trang bị màn hình ProMotion 120Hz, camera 108MP và pin dung lượng lớn hơn 20%.</p><p>Giá bán khởi điểm từ 29.990.000đ, iPhone 17 Pro chính thức mở đặt hàng từ ngày 20/09/2026.</p>',
         'Apple vừa ra mắt iPhone 17 Pro với chip A19 Bionic mạnh mẽ nhất từ trước đến nay, camera 108MP và màn hình ProMotion 120Hz.',
         'Điện thoại',
         'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/42/342667/iphone-17-xanh-6-638930798970669098-750x500.jpg',
         1, 1, 1520, NOW(), NOW()),

        ('Samsung Galaxy S26 Ultra: Camera 200MP, zoom quang học 10x ấn tượng',
         'Samsung Galaxy S26 Ultra: 200MP Camera, Impressive 10x Optical Zoom',
         'samsung-galaxy-s26-ultra-camera-200mp',
         '<p>Samsung đã chính thức ra mắt Galaxy S26 Ultra với cụm camera ấn tượng gồm camera chính 200MP, tele 50MP với zoom quang học 10x và camera góc siêu rộng 12MP. Máy chạy trên chip Snapdragon 8 Elite 2 với RAM 12GB.</p><p>Pin 5500mAh hỗ trợ sạc nhanh 65W và sạc không dây 15W.</p>',
         'Samsung Galaxy S26 Ultra ra mắt với camera 200MP, zoom quang học 10x và chip Snapdragon 8 Elite 2 mạnh mẽ.',
         'Điện thoại',
         'https://cdn.tgdd.vn/Products/Images/42/363398/samsung-galaxy-a57-8gb-128gb-tim-thumb-600x600.jpg',
         1, 1, 980, NOW(), NOW()),

        ('MacBook Pro M5 Max: Hiệu năng đỉnh cao cho dân sáng tạo nội dung',
         'MacBook Pro M5 Max: Peak Performance for Content Creators',
         'macbook-pro-m5-max-hieu-nang-dinh-cao',
         '<p>Apple MacBook Pro 14 inch M5 Max là lựa chọn hoàn hảo cho các chuyên gia sáng tạo nội dung. Với chip M5 Max 14 nhân CPU và 30 nhân GPU, máy có thể xử lý video 8K ProRes một cách mượt mà.</p><p>Thời lượng pin lên đến 22 giờ sử dụng thực tế, màn hình Liquid Retina XDR 14.2 inch.</p>',
         'MacBook Pro M5 Max mang lại hiệu năng vượt trội với chip 14 nhân CPU, 30 nhân GPU, xử lý video 8K mượt mà.',
         'Laptop',
         'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/44/358086/macbook-pro-14-inch-m5-16gb-512gb-thumb-638962954605863722-600x600.jpg',
         1, 1, 750, NOW(), NOW()),

        ('Xiaomi 15 Ultra: Vua chụp ảnh phân khúc tầm trung cao cấp',
         'Xiaomi 15 Ultra: Photography King in Upper Mid-Range Segment',
         'xiaomi-15-ultra-vua-chup-anh',
         '<p>Xiaomi 15 Ultra trang bị hệ thống camera Leica Summilux với 4 ống kính, trong đó có ống kính chính 50MP f/1.63 và tele 200MP f/2.6. Chip Snapdragon 8 Elite cho hiệu năng gaming ổn định.</p><p>Màn hình LTPO AMOLED 6.73 inch 120Hz, pin 6000mAh sạc nhanh 90W.</p>',
         'Xiaomi 15 Ultra với camera Leica 4 ống kính, tele 200MP và pin 6000mAh sạc nhanh 90W.',
         'Điện thoại',
         'https://cdn.tgdd.vn/Products/Images/42/360310/xiaomi-redmi-note-15-5g-thumb-600x600.jpg',
         1, 1, 630, NOW(), NOW()),

        ('Apple Watch Ultra 3: Đồng hồ thể thao cao cấp với pin 72 giờ',
         'Apple Watch Ultra 3: Premium Sports Watch with 72-Hour Battery',
         'apple-watch-ultra-3-pin-72-gio',
         '<p>Apple Watch Ultra 3 ra mắt với thiết kế titan bền bỉ, màn hình Always-On 2000 nit sáng hơn 20% so với thế hệ trước. Pin lên đến 72 giờ trong chế độ tiết kiệm năng lượng.</p><p>Tích hợp GPS chính xác cao, độ sâu chịu nước 100m, lý tưởng cho các hoạt động thể thao mạo hiểm.</p>',
         'Apple Watch Ultra 3 với thiết kế titan, pin 72 giờ và màn hình 2000 nit, lý tưởng cho thể thao mạo hiểm.',
         'Smartwatch',
         'https://cdn.tgdd.vn/Products/Images/7077/344764/apple-watch-ultra-3-gps-cellular-49mm-vien-titanium-day-ocean-den-tb-600x600.jpg',
         1, 1, 890, NOW(), NOW())
    `);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('news', {
      slug: [
        'iphone-17-pro-ra-mat-chip-a19-bionic',
        'samsung-galaxy-s26-ultra-camera-200mp',
        'macbook-pro-m5-max-hieu-nang-dinh-cao',
        'xiaomi-15-ultra-vua-chup-anh',
        'apple-watch-ultra-3-pin-72-gio',
      ],
    });
  },
};
