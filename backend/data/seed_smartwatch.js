/**
 * Script tạo SQL INSERT cho sản phẩm Smartwatch
 * Chạy: node backend/data/seed_smartwatch.js
 * Output: append vào backend/data/seed_data.sql (trước SET FOREIGN_KEY_CHECKS = 1)
 */
const fs = require('fs');
const path = require('path');

const NOW = '2026-05-16 10:00:00';

// === IDs tiếp nối từ seed_data.sql hiện tại ===
const CATEGORY_ID = 4; // Smartwatch
const PRODUCT_START_ID = 46;
const VARIANT_START_ID = 203;
const IMAGE_START_ID = 1015;

let nextProductId = PRODUCT_START_ID;
let nextVariantId = VARIANT_START_ID;
let nextImageId = IMAGE_START_ID;

const lines = [];

function esc(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''").replace(/\\/g, '\\\\')}'`;
}

function jsonEsc(obj) {
  return esc(JSON.stringify(obj));
}

// ===== CATEGORY =====
lines.push(`\n-- ===== SMARTWATCH CATEGORY =====`);
lines.push(
  `INSERT INTO categories (\`id\`, \`name\`, \`slug\`, \`description\`, \`created_at\`, \`updated_at\`, \`deleted_at\`) VALUES (${CATEGORY_ID}, 'Smartwatch', 'smartwatch', 'Tất cả các dòng đồng hồ thông minh', '${NOW}', '${NOW}', NULL);`
);

// ===== BRAND_CATEGORIES (liên kết Apple, Samsung với Smartwatch) =====
lines.push(`\n-- ===== BRAND_CATEGORIES (Smartwatch) =====`);
lines.push(
  `INSERT INTO brand_categories (\`brand_id\`, \`category_id\`) VALUES (1, ${CATEGORY_ID});`
);
lines.push(
  `INSERT INTO brand_categories (\`brand_id\`, \`category_id\`) VALUES (2, ${CATEGORY_ID});`
);

// ===== PRODUCTS DEFINITION =====
const products = [
  // --- 1. Apple Watch Series 11 GPS+Cellular 46mm Titanium Milan ---
  {
    brand_id: 1,
    name: 'Đồng hồ thông minh Apple Watch Series 11 GPS + Cellular 46mm viền Titanium dây Milan',
    slug: 'apple-watch-series-11-gps-cellular-46mm-titanium-milan',
    model: 'Apple Watch Series 11 GPS + Cellular 46mm Titanium Milan',
    base_price: 23590000,
    compare_at_price: 23990000,
    short_description: 'Đồng hồ thông minh cao cấp viền Titanium, dây Milan thép không gỉ, chip Apple S10 mạnh hơn 30%, màn hình OLED 2000 nits, hỗ trợ eSIM gọi độc lập và theo dõi sức khỏe toàn diện.',
    description: 'Apple Watch Series 11 GPS + Cellular 46mm viền Titanium dây Milan kết hợp thiết kế Titanium cao cấp với dây loop Milan thép không gỉ sang trọng. Sở hữu màn hình OLED 416x496 pixels với độ sáng tối đa 2000 nits, chip S10 cải thiện hiệu năng 30%, bộ nhớ 64GB. Theo dõi sức khỏe toàn diện: ECG, SpO2, phát hiện ngưng thở khi ngủ, cảnh báo huyết áp, theo dõi stress 24h. Hỗ trợ eSIM gọi độc lập, Bluetooth 5.3, WiFi, 5G, GPS đa hệ thống. Pin kéo dài ~24 giờ thông thường, ~38 giờ tiết kiệm. Chống nước 5 ATM, kính Sapphire.',
    warranty_months: 12,
    tags: '["apple","apple-watch","series-11","smartwatch","titanium","esim","cellular"]',
    specifications: {
      display_specs: 'OLED 416x496 pixels, 46mm, 2000 nits, Always-On Display',
      processor_chipset: 'Apple S10',
      storage_capacity: '64GB',
      network_connectivity: 'Bluetooth 5.3, WiFi, 5G, eSIM, NFC',
      battery_capacity: '~24 giờ thông thường, ~38 giờ tiết kiệm',
      charging_speed: 'Đế sạc từ tính',
      operating_system: 'watchOS mới nhất',
      water_resistance: '5 ATM (ISO 22810:2010)',
      build_material: 'Viền Titanium, kính Sapphire, dây Milan thép không gỉ',
      dimensions_weight: '46 × 39 × 9.7 mm, 43.1g',
      sensors: 'ECG, SpO2, nhịp tim quang học gen 3, nhiệt độ, khí áp, gia tốc, con quay hồi chuyển, la bàn, ánh sáng, độ sâu',
      health_features: 'ECG, SpO2, huyết áp, ngưng thở khi ngủ, stress 24h, nhịp tim 24h, chu kỳ kinh nguyệt, rụng trứng, phát hiện ngã, phát hiện va chạm, SOS khẩn cấp',
      sports_modes: 'Đi bộ, chạy, bơi, đạp xe, triathlon, golf, yoga, trượt tuyết, chèo thuyền',
      positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
      sim_slots: 'eSIM (gọi độc lập)',
      compatibility: 'iPhone 11 trở lên, iOS 26+',
      release_year: '2025',
      other_features: 'Always-On Display, Apple Pay, Family Setup, Smart Stack, sạc nhanh, cử chỉ chạm kép'
    },
    attributes: [
      { name: 'color', values: ['Titan xám', 'Titan vàng', 'Titan tự nhiên'] }
    ],
    sold_count: 207,
    view_count: 2000,
    rating_average: '0.00',
    variants: [
      { sku: 'APL-AWS11-46-TIT-GRY', color: 'Titan xám', price: 23590000, compare: 23990000, stock: 30, is_default: 1 },
      { sku: 'APL-AWS11-46-TIT-GLD', color: 'Titan vàng', price: 23590000, compare: 23990000, stock: 25, is_default: 0 },
      { sku: 'APL-AWS11-46-TIT-NAT', color: 'Titan tự nhiên', price: 23590000, compare: 23990000, stock: 20, is_default: 0 },
    ],
    images: {
      thumbnail: 'https://cdn.tgdd.vn/Products/Images/7077/344756/apple-watch-series-11-gps-cellular-vien-titanium-day-milan-den-tb-600x600.jpg',
      colors: {
        'Titan xám': [
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344756/apple-watch-series-11-gps-cellular-vien-titanium-day-milan-den-1-638931882687554734.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344756/apple-watch-series-11-gps-cellular-vien-titanium-day-milan-den-2-638931882694440235.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344756/apple-watch-series-11-gps-cellular-vien-titanium-day-milan-den-3-638931882703619452.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344756/apple-watch-series-11-gps-cellular-46mm-vien-titanium-day-milan-40-638976224348394630.jpg',
        ],
        'Titan vàng': [
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344756/apple-watch-series-11-gps-cellular-vien-titanium-day-milan-vang-1-638931882788080928.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344756/apple-watch-series-11-gps-cellular-vien-titanium-day-milan-vang-2-638931882795236193.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344756/apple-watch-series-11-gps-cellular-vien-titanium-day-milan-vang-3-638931882802005785.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344756/apple-watch-series-11-gps-cellular-46mm-vien-titanium-day-milan-40-638976224439449820.jpg',
        ],
        'Titan tự nhiên': [
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344756/apple-watch-series-11-gps-cellular-vien-titanium-day-milan-tu-nhien-1-638931882579092440.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344756/apple-watch-series-11-gps-cellular-vien-titanium-day-milan-tu-nhien-2-638931882585722262.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344756/apple-watch-series-11-gps-cellular-vien-titanium-day-milan-tu-nhien-3-638931882591228014.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344756/apple-watch-series-11-gps-cellular-46mm-vien-titanium-day-milan-40-638976224263474958.jpg',
        ],
      },
    },
  },

  // --- 2. Apple Watch Ultra 3 GPS+Cellular 49mm Titanium Ocean ---
  {
    brand_id: 1,
    name: 'Đồng hồ thông minh Apple Watch Ultra 3 GPS + Cellular 49mm viền Titanium dây Ocean',
    slug: 'apple-watch-ultra-3-gps-cellular-49mm-titanium-ocean',
    model: 'Apple Watch Ultra 3 GPS + Cellular 49mm Titanium Ocean',
    base_price: 23490000,
    compare_at_price: 23990000,
    short_description: 'Đồng hồ thông minh siêu bền viền Titanium 49mm, dây Ocean cao su, pin 42 giờ (72 giờ tiết kiệm), chống nước 10 ATM chuẩn lặn EN13319, chip S10, màn hình OLED 3000 nits.',
    description: 'Apple Watch Ultra 3 GPS + Cellular 49mm viền Titanium dây Ocean là đồng hồ thông minh cao cấp nhất của Apple, thiết kế cho thể thao mạo hiểm và hoạt động ngoài trời. Vỏ Titanium siêu bền, màn hình Sapphire OLED 1.92 inch 422x514 pixels với độ sáng 3000 nits, chip S10 5nm, bộ nhớ 64GB. Chống nước 10 ATM đạt chuẩn EN13319 cho lặn. Pin kéo dài 42 giờ thông thường hoặc 72 giờ chế độ tiết kiệm. Hỗ trợ eSIM gọi độc lập, Bluetooth 5.3, WiFi, 5G. Theo dõi sức khỏe toàn diện với ECG, SpO2, phát hiện ngưng thở, cảnh báo huyết áp.',
    warranty_months: 12,
    tags: '["apple","apple-watch","ultra-3","smartwatch","titanium","esim","cellular","diving"]',
    specifications: {
      display_specs: 'OLED 1.92 inch, 422x514 pixels, 49mm, 3000 nits, Always-On Display',
      processor_chipset: 'Apple S10 (64-bit, 5nm)',
      storage_capacity: '64GB',
      network_connectivity: 'Bluetooth 5.3, WiFi 4, 5G, eSIM, NFC',
      battery_capacity: '~42 giờ thông thường, ~72 giờ tiết kiệm',
      charging_speed: 'Cáp sạc từ tính USB-C, 0-80% trong ~45 phút',
      operating_system: 'watchOS mới nhất',
      water_resistance: '10 ATM (chuẩn EN13319, hỗ trợ lặn)',
      build_material: 'Viền Titanium, kính Sapphire, dây Ocean cao su',
      dimensions_weight: '49 × 44 × 12 mm',
      sensors: 'ECG, SpO2, nhịp tim quang học gen 3, nhiệt độ nước, khí áp, gia tốc, con quay hồi chuyển, la bàn, ánh sáng, độ sâu',
      health_features: 'ECG, SpO2, huyết áp, ngưng thở khi ngủ, stress, nhịp tim 24h, chu kỳ kinh nguyệt, phát hiện ngã, phát hiện va chạm, SOS khẩn cấp',
      sports_modes: 'Đi bộ, chạy, bơi, đạp xe, lặn, yoga',
      positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
      sim_slots: 'eSIM (gọi độc lập)',
      compatibility: 'iPhone 11 trở lên, iOS 26+',
      release_year: '2025',
      other_features: 'Always-On Display, Apple Pay, nút Action, còi báo động 86dB, đo độ sâu khi lặn'
    },
    attributes: [
      { name: 'color', values: ['Titan đen', 'Titan tự nhiên'] }
    ],
    sold_count: 511,
    view_count: 5000,
    rating_average: '0.00',
    variants: [
      { sku: 'APL-AWU3-49-TIT-BLK', color: 'Titan đen', price: 23490000, compare: 23990000, stock: 20, is_default: 1 },
      { sku: 'APL-AWU3-49-TIT-NAT', color: 'Titan tự nhiên', price: 23490000, compare: 23990000, stock: 15, is_default: 0 },
    ],
    images: {
      thumbnail: 'https://cdn.tgdd.vn/Products/Images/7077/344764/apple-watch-ultra-3-gps-cellular-49mm-vien-titanium-day-ocean-den-tb-600x600.jpg',
      colors: {
        'Titan đen': [
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344764/apple-watch-ultra-3-gps-cellular-49mm-vien-titanium-day-ocean-den-1-638931950391226626.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344764/apple-watch-ultra-3-gps-cellular-49mm-vien-titanium-day-ocean-den-2-638931950398035319.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344764/apple-watch-ultra-3-gps-cellular-49mm-vien-titanium-day-ocean-den-3-638931950404919316.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344764/apple-watch-ultra-3-gps-cellular-49mm-vien-titanium-day-ocean-40-638976225649352842.jpg',
        ],
        'Titan tự nhiên': [
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344764/apple-watch-ultra-3-gps-cellular-49mm-vien-titanium-day-ocean-tu-nhien-1-638931884423100114.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344764/apple-watch-ultra-3-gps-cellular-49mm-vien-titanium-day-ocean-tu-nhien-2-638931884428984160.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344764/apple-watch-ultra-3-gps-cellular-49mm-vien-titanium-day-ocean-tu-nhien-3-638931884435307109.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344764/apple-watch-ultra-3-gps-cellular-49mm-vien-titanium-day-ocean-40-638976225437526139.jpg',
        ],
      },
    },
  },

  // --- 3. Apple Watch SE 3 GPS 40mm nhôm dây thể thao ---
  {
    brand_id: 1,
    name: 'Đồng hồ thông minh Apple Watch SE 3 GPS 40mm viền nhôm dây thể thao',
    slug: 'apple-watch-se-3-gps-40mm-nhom-day-the-thao',
    model: 'Apple Watch SE 3 GPS 40mm nhôm dây thể thao',
    base_price: 6790000,
    compare_at_price: 6990000,
    short_description: 'Đồng hồ thông minh giá tốt với chip S10, màn hình OLED Always-On, kính Ion-X, theo dõi sức khỏe toàn diện, phát hiện ngưng thở khi ngủ, chống nước 5 ATM, bộ nhớ 64GB.',
    description: 'Apple Watch SE 3 GPS 40mm viền nhôm dây thể thao là lựa chọn giá tốt trong dòng Apple Watch 2025. Chip S10 với Neural Engine 4 nhân, màn hình OLED Always-On 324x394 pixels với kính Ion-X, bộ nhớ 64GB gấp đôi thế hệ trước. Theo dõi sức khỏe: nhịp tim, SpO2, nhiệt độ cổ tay, phát hiện ngưng thở khi ngủ, theo dõi giấc ngủ và chu kỳ kinh nguyệt. Phát hiện ngã, phát hiện va chạm, SOS khẩn cấp. Pin ~18 giờ, sạc nhanh 80% trong 45 phút. Chống nước 5 ATM.',
    warranty_months: 12,
    tags: '["apple","apple-watch","se-3","smartwatch","gia-re","nhom"]',
    specifications: {
      display_specs: 'OLED 324x394 pixels, 40mm, kính Ion-X cường lực, Always-On Display',
      processor_chipset: 'Apple S10 với Neural Engine 4 nhân',
      storage_capacity: '64GB',
      network_connectivity: 'Bluetooth 5.3, WiFi, GPS',
      battery_capacity: '~18 giờ thông thường, ~32 giờ tiết kiệm',
      charging_speed: 'Đế sạc từ tính, 80% trong ~45 phút',
      operating_system: 'watchOS mới nhất',
      water_resistance: '5 ATM (ISO 22810:2010)',
      build_material: 'Viền nhôm, kính Ion-X, dây silicone thể thao',
      dimensions_weight: '40 × 34 × 10.7 mm, 26.3g',
      sensors: 'Nhịp tim quang học gen 2, nhiệt độ, khí áp, gia tốc, con quay hồi chuyển, la bàn, ánh sáng',
      health_features: 'Nhịp tim, SpO2, nhiệt độ, ngưng thở khi ngủ, giấc ngủ, chu kỳ kinh nguyệt, stress, phát hiện ngã, phát hiện va chạm, SOS',
      sports_modes: 'Đi bộ, chạy, bơi, đạp xe, yoga',
      positioning: 'GPS, GLONASS, Galileo, QZSS',
      compatibility: 'iPhone 11 trở lên, iOS 26+',
      release_year: '2025',
      other_features: 'Always-On Display, Apple Pay, Family Setup, Smart Stack, cử chỉ cổ tay, bản đồ offline'
    },
    attributes: [
      { name: 'color', values: ['Trắng Starlight', 'Xanh đen'] }
    ],
    sold_count: 0,
    view_count: 0,
    rating_average: '0.00',
    variants: [
      { sku: 'APL-AWSE3-40-ALU-WHI', color: 'Trắng Starlight', price: 6790000, compare: 6990000, stock: 50, is_default: 1 },
      { sku: 'APL-AWSE3-40-ALU-BLK', color: 'Xanh đen', price: 6790000, compare: 6990000, stock: 50, is_default: 0 },
    ],
    images: {
      thumbnail: 'https://cdn.tgdd.vn/Products/Images/7077/344767/apple-watch-se-3-gps-vien-nhom-day-the-thao-trang-tb-600x600.jpg',
      colors: {
        'Trắng Starlight': [
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344767/apple-watch-se-3-vien-nhom-day-the-thao-trang-1-638931870568348659.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344767/apple-watch-se-3-vien-nhom-day-the-thao-trang-2-638931870575290841.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344767/apple-watch-se-3-vien-nhom-day-the-thao-trang-3-638931870581517623.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344767/-40-638976068697097777.jpg',
        ],
        'Xanh đen': [
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344767/apple-watch-se-3-vien-nhom-day-the-thao-den-1-638931871319778005.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344767/apple-watch-se-3-vien-nhom-day-the-thao-den-2-638931871326293252.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344767/apple-watch-se-3-vien-nhom-day-the-thao-den-3-638931871333633520.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344767/apple-watch-se-3-vien-nhom-40mm-day-the-thao-40-638976069618405528.jpg',
        ],
      },
    },
  },

  // --- 4. Apple Watch SE 3 GPS 44mm nhôm dây thể thao ---
  {
    brand_id: 1,
    name: 'Đồng hồ thông minh Apple Watch SE 3 GPS 44mm viền nhôm dây thể thao',
    slug: 'apple-watch-se-3-gps-44mm-nhom-day-the-thao',
    model: 'Apple Watch SE 3 GPS 44mm nhôm dây thể thao',
    base_price: 7690000,
    compare_at_price: 7850000,
    short_description: 'Phiên bản 44mm lớn hơn của Apple Watch SE 3 với chip S10, màn hình OLED Always-On 448x368 pixels, bộ nhớ 64GB, chống nước 5 ATM, theo dõi sức khỏe toàn diện.',
    description: 'Apple Watch SE 3 GPS 44mm viền nhôm dây thể thao là phiên bản mặt lớn, phù hợp cổ tay 14-24.5cm. Màn hình OLED 448x368 pixels, chip S10, 64GB bộ nhớ. Theo dõi sức khỏe toàn diện: nhịp tim, SpO2, phát hiện ngưng thở, chu kỳ kinh nguyệt, stress. Phát hiện ngã, phát hiện va chạm, SOS khẩn cấp. Pin ~18 giờ thông thường, ~32 giờ tiết kiệm. Viền nhôm, dây silicone thể thao, chống nước 5 ATM.',
    warranty_months: 12,
    tags: '["apple","apple-watch","se-3","smartwatch","44mm","nhom"]',
    specifications: {
      display_specs: 'OLED 448x368 pixels, 44mm, kính Ion-X cường lực',
      processor_chipset: 'Apple S10',
      storage_capacity: '64GB',
      network_connectivity: 'Bluetooth 5.3, WiFi, GPS',
      battery_capacity: '~18 giờ thông thường, ~32 giờ tiết kiệm',
      charging_speed: 'Đế sạc từ tính',
      operating_system: 'watchOS mới nhất',
      water_resistance: '5 ATM (ISO 22810:2010)',
      build_material: 'Viền nhôm, kính Ion-X, dây silicone thể thao',
      dimensions_weight: '44 × 38 × 10.7 mm, 32.9g',
      sensors: 'Nhịp tim quang học gen 2, nhiệt độ, khí áp, gia tốc, con quay hồi chuyển, la bàn, ánh sáng',
      health_features: 'Nhịp tim, SpO2, ngưng thở khi ngủ, giấc ngủ, chu kỳ kinh nguyệt, stress, phát hiện ngã, phát hiện va chạm, SOS',
      sports_modes: 'Đi bộ, chạy, bơi, đạp xe, yoga, HIIT, Pilates',
      positioning: 'GPS, GLONASS, Galileo, QZSS',
      compatibility: 'iPhone 11 trở lên, iOS 26+',
      release_year: '2025',
      other_features: 'Apple Pay, Family Setup, Smart Stack, cử chỉ cổ tay, bản đồ offline, Liquid Glass UI'
    },
    attributes: [
      { name: 'color', values: ['Trắng Starlight', 'Xanh đen'] }
    ],
    sold_count: 0,
    view_count: 0,
    rating_average: '0.00',
    variants: [
      { sku: 'APL-AWSE3-44-ALU-WHI', color: 'Trắng Starlight', price: 7690000, compare: 7850000, stock: 50, is_default: 1 },
      { sku: 'APL-AWSE3-44-ALU-BLK', color: 'Xanh đen', price: 7690000, compare: 7850000, stock: 50, is_default: 0 },
    ],
    images: {
      thumbnail: 'https://cdn.tgdd.vn/Products/Images/7077/344768/apple-watch-se-3-gps-vien-nhom-day-the-thao-den-tb-600x600.jpg',
      colors: {
        'Trắng Starlight': [
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344768/apple-watch-se-3-vien-nhom-day-the-thao-trang-1-638931870612723737.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344768/apple-watch-se-3-vien-nhom-day-the-thao-trang-2-638931870618644243.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344768/apple-watch-se-3-vien-nhom-day-the-thao-trang-3-638931870605670944.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344768/apple-watch-se-3-vien-nhom-44mm-day-the-thao-40-638976214820693071.jpg',
        ],
        'Xanh đen': [
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344768/apple-watch-se-3-vien-nhom-day-the-thao-den-1-638931871371641860.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344768/apple-watch-se-3-vien-nhom-day-the-thao-den-2-638931871378244397.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344768/apple-watch-se-3-vien-nhom-day-the-thao-den-3-638931871364484088.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/344768/apple-watch-se-3-vien-nhom-44mm-day-the-thao-40-638976214902571941.jpg',
        ],
      },
    },
  },

  // --- 5. Samsung Galaxy Watch8 40mm dây silicone ---
  {
    brand_id: 2,
    name: 'Đồng hồ thông minh Samsung Galaxy Watch8 40mm dây silicone',
    slug: 'samsung-galaxy-watch8-40mm-day-silicone',
    model: 'Samsung Galaxy Watch8 40mm dây silicone',
    base_price: 8190000,
    compare_at_price: 8990000,
    short_description: 'Đồng hồ thông minh mỏng nhất dòng Galaxy Watch chỉ 8.6mm, màn hình Super AMOLED 3000 nits, chip Exynos W1000 3nm, cảm biến BioActive 3.0 theo dõi sức khỏe chuyên sâu cùng AI thông minh.',
    description: 'Galaxy Watch8 40mm là đồng hồ thông minh mỏng nhất dòng Galaxy Watch với thiết kế squircle chỉ 8.6mm. Vi xử lý Exynos W1000 tiến trình 3nm tăng hiệu năng gấp 3 lần, tiết kiệm pin 30%. Màn hình Super AMOLED 1.34 inch sáng 3000 nits. Cảm biến BioActive 3.0 theo dõi nhịp tim, ECG, huyết áp, SpO2, sức ép mạch máu, chỉ số chống oxy hóa AGEs, thành phần cơ thể. Sleep Coaching phân tích môi trường ngủ, phát hiện ngưng thở. 100+ chế độ thể thao, GPS băng tần kép L1/L5, NFC Samsung Wallet, chống nước 5 ATM, MIL-STD-810H. RAM 2GB, bộ nhớ 32GB, Wear OS 6.',
    warranty_months: 12,
    tags: '["samsung","galaxy-watch","watch8","smartwatch","exynos-w1000","bioactive","ai"]',
    specifications: {
      display_specs: 'Super AMOLED 1.34 inch, 438x438 pixels, 40mm, 3000 nits, Sapphire Crystal',
      processor_chipset: 'Exynos W1000 (tiến trình 3nm)',
      ram_capacity: '2GB',
      storage_capacity: '32GB',
      network_connectivity: 'Bluetooth 5.3, WiFi, NFC, GPS băng tần kép L1/L5',
      battery_capacity: '325 mAh (~40 giờ tắt AOD)',
      charging_speed: 'Đế sạc từ tính, ~1.1 giờ',
      operating_system: 'Wear OS 6 + One UI Watch 8.0',
      water_resistance: '5 ATM (IP68, ISO 22810:2010)',
      build_material: 'Khung nhôm nguyên khối, kính Sapphire Crystal, dây silicone',
      dimensions_weight: '42.7 × 40.4 × 8.6 mm, 30.1g',
      sensors: 'BioActive 3.0 (3-in-1), ánh sáng, khí áp, nhiệt kế hồng ngoại, từ trường, con quay hồi chuyển, gia tốc',
      health_features: 'ECG, huyết áp, SpO2, nhịp tim, sức ép mạch máu, AGEs, thành phần cơ thể, ngưng thở khi ngủ, Sleep Coaching, stress, chu kỳ kinh nguyệt, phát hiện té ngã',
      sports_modes: '100+ chế độ: đi bộ, nhảy dây, leo núi, chạy bộ, bơi, đạp xe, yoga',
      positioning: 'GPS, GLONASS, Galileo, BeiDou (băng tần kép L1/L5)',
      mil_std: 'MIL-STD-810H',
      compatibility: 'Android 12+ (Google Mobile Services)',
      release_year: '2025',
      other_features: 'Samsung Wallet, Always-On Display, phân tích chạy bộ nâng cao'
    },
    attributes: [
      { name: 'color', values: ['Trắng', 'Xám'] }
    ],
    sold_count: 0,
    view_count: 0,
    rating_average: '0.00',
    variants: [
      { sku: 'SM-GW8-40-SIL-WHI', color: 'Trắng', price: 8190000, compare: 8990000, stock: 40, is_default: 1 },
      { sku: 'SM-GW8-40-SIL-GRY', color: 'Xám', price: 8190000, compare: 8990000, stock: 35, is_default: 0 },
    ],
    images: {
      thumbnail: 'https://cdn.tgdd.vn/Products/Images/7077/338265/samsung-galaxy-watch8-40mm-trang-tb-600x600.jpg',
      colors: {
        'Trắng': [
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338265/samsung-galaxy-watch8-40mm-trang-1-639087500464157953.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338265/samsung-galaxy-watch8-40mm-trang-2-639087500471714490.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338265/samsung-galaxy-watch8-40mm-trang-3-639087500479804716.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338265/samsung-galaxy-watch8-40mm-trang-4-639087500485548189.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338265/samsung-galaxy-watch8-40mm-trang-5-639087500492382297.jpg',
        ],
        'Xám': [
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338265/samsung-galaxy-watch8-40mm-xam-1-638878309234246240.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338265/samsung-galaxy-watch8-40mm-xam-2-638878309228969240.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338265/samsung-galaxy-watch8-40mm-xam-3-638878309223253196.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338265/samsung-galaxy-watch8-40mm-xam-4-638878309216001688.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338265/samsung-galaxy-watch8-40mm-xam-5-638878309251783219.jpg',
        ],
      },
    },
  },

  // --- 6. Samsung Galaxy Watch7 44mm dây silicone ---
  {
    brand_id: 2,
    name: 'Đồng hồ thông minh Samsung Galaxy Watch7 44mm dây silicone',
    slug: 'samsung-galaxy-watch7-44mm-day-silicone',
    model: 'Samsung Galaxy Watch7 44mm dây silicone',
    base_price: 5840000,
    compare_at_price: 8340000,
    short_description: 'Đồng hồ thông minh Samsung thế hệ 7 với cảm biến BioActive 2, màn hình Super AMOLED 1.47 inch, chip Exynos W1000, GPS băng tần kép và theo dõi sức khỏe toàn diện.',
    description: 'Galaxy Watch7 44mm kết hợp thiết kế tinh tế với theo dõi sức khỏe toàn diện. Cảm biến BioActive 2 đo nhịp tim, ECG, SpO2, huyết áp (cần kết nối điện thoại Samsung). Sleep Coaching, phát hiện té ngã, chỉ số chống oxy hóa AGEs, phân tích thành phần cơ thể. Màn hình Super AMOLED 1.47 inch 480x480 pixels, kính Sapphire Crystal, khung nhôm hợp kim. Chip Exynos W1000, bộ nhớ 32GB. GPS băng tần kép L1/L5, chống nước 5 ATM, MIL-STD-810H. Pin 425mAh ~40 giờ. Samsung Wallet, gợi ý trả lời tin nhắn AI.',
    warranty_months: 12,
    tags: '["samsung","galaxy-watch","watch7","smartwatch","exynos-w1000","bioactive"]',
    specifications: {
      display_specs: 'Super AMOLED 1.47 inch, 480x480 pixels, 44mm, Sapphire Crystal',
      processor_chipset: 'Exynos W1000',
      storage_capacity: '32GB',
      network_connectivity: 'Bluetooth 5.3, WiFi, NFC, GPS băng tần kép L1/L5',
      battery_capacity: '425 mAh (~40 giờ tắt AOD)',
      charging_speed: 'Đế sạc từ tính, ~1.3 giờ',
      operating_system: 'Wear OS tùy biến bởi Samsung',
      water_resistance: '5 ATM (ISO 22810:2010)',
      build_material: 'Khung nhôm hợp kim, kính Sapphire Crystal, dây silicone',
      dimensions_weight: '44.4 × 44.4 × 9.7 mm, 33.8g',
      sensors: 'BioActive 2 (3-in-1), ánh sáng, khí áp, nhiệt kế hồng ngoại, từ trường, con quay hồi chuyển, gia tốc',
      health_features: 'ECG, huyết áp, SpO2, nhịp tim, AGEs, thành phần cơ thể, ngưng thở khi ngủ, Sleep Coaching, stress, chu kỳ kinh nguyệt, phát hiện té ngã',
      sports_modes: 'Đi bộ, nhảy dây, leo núi, chạy bộ, bơi, đạp xe, yoga',
      positioning: 'GPS, GLONASS, Galileo, BeiDou (băng tần kép L1/L5)',
      mil_std: 'MIL-STD-810H',
      compatibility: 'Android 11+',
      release_year: '2024',
      other_features: 'Samsung Wallet, gợi ý trả lời tin nhắn AI'
    },
    attributes: [
      { name: 'color', values: ['Bạc', 'Xanh rêu'] }
    ],
    sold_count: 2200,
    view_count: 15000,
    rating_average: '4.90',
    variants: [
      { sku: 'SM-GW7-44-SIL-SLV', color: 'Bạc', price: 5840000, compare: 8340000, stock: 30, is_default: 1 },
      { sku: 'SM-GW7-44-SIL-GRN', color: 'Xanh rêu', price: 5840000, compare: 8340000, stock: 25, is_default: 0 },
    ],
    images: {
      thumbnail: 'https://cdn.tgdd.vn/Products/Images/7077/327697/samsung-galaxy-watch7-44mm-bac-tn2-600x600.jpg',
      colors: {
        'Bạc': [
          'https://cdn.tgdd.vn/Products/Images/7077/327697/samsung-galaxy-watch7-44mm-bac-1.jpg',
          'https://cdn.tgdd.vn/Products/Images/7077/327697/samsung-galaxy-watch7-44mm-bac-2.jpg',
          'https://cdn.tgdd.vn/Products/Images/7077/327697/samsung-galaxy-watch7-44mm-bac-3.jpg',
          'https://cdn.tgdd.vn/Products/Images/7077/327697/samsung-galaxy-watch7-44mm-bac-4.jpg',
          'https://cdn.tgdd.vn/Products/Images/7077/327697/samsung-galaxy-watch7-44mm-bac-5.jpg',
        ],
        'Xanh rêu': [
          'https://cdn.tgdd.vn/Products/Images/7077/327697/samsung-galaxy-watch7-44mm-xanh-1.jpg',
          'https://cdn.tgdd.vn/Products/Images/7077/327697/samsung-galaxy-watch7-44mm-xanh-2.jpg',
          'https://cdn.tgdd.vn/Products/Images/7077/327697/samsung-galaxy-watch7-44mm-xanh-3.jpg',
          'https://cdn.tgdd.vn/Products/Images/7077/327697/samsung-galaxy-watch7-44mm-xanh-4.jpg',
          'https://cdn.tgdd.vn/Products/Images/7077/327697/samsung-galaxy-watch7-44mm-xanh-5.jpg',
        ],
      },
    },
  },
];

// ===== GENERATE PRODUCT SQL =====
lines.push(`\n-- ===== SMARTWATCH PRODUCTS (${products.length} rows) =====`);

const productIds = {};
const allVariants = [];
const allImages = [];

for (const p of products) {
  const pid = nextProductId++;
  productIds[p.slug] = pid;

  const shippingInfo = JSON.stringify({
    weight_g: 300,
    length_cm: 15,
    width_cm: 15,
    height_cm: 8,
    is_fragile: true,
    shipping_class: 'small_electronic',
    free_shipping: false,
    contains_battery: true,
    requires_insurance: true,
  });

  lines.push(
    `INSERT INTO products (\`id\`, \`category_id\`, \`brand_id\`, \`name\`, \`slug\`, \`base_name\`, \`model\`, \`base_price\`, \`compare_at_price\`, \`short_description\`, \`description\`, \`status\`, \`is_featured\`, \`condition\`, \`visibility\`, \`warranty_months\`, \`tags\`, \`specifications\`, \`attributes\`, \`sold_count\`, \`view_count\`, \`rating_average\`, \`shipping_info\`, \`seo_title\`, \`seo_description\`, \`seo_keywords\`, \`created_at\`, \`updated_at\`, \`deleted_at\`, \`sku\`) VALUES (${pid}, ${CATEGORY_ID}, ${p.brand_id}, ${esc(p.name)}, ${esc(p.slug)}, NULL, ${esc(p.model)}, '${p.base_price}.00', ${p.compare_at_price ? `'${p.compare_at_price}.00'` : 'NULL'}, ${esc(p.short_description)}, ${esc(p.description)}, 'active', 1, 'new', 'public', ${p.warranty_months}, ${esc(p.tags)}, ${jsonEsc(p.specifications)}, ${jsonEsc(p.attributes)}, ${p.sold_count}, ${p.view_count}, '${p.rating_average}', ${esc(shippingInfo)}, NULL, NULL, NULL, '${NOW}', '${NOW}', NULL, NULL);`
  );

  // Variants
  for (const v of p.variants) {
    const vid = nextVariantId++;
    const variantName = `${p.model} - ${v.color}`;
    const displayName = v.color;
    allVariants.push({
      id: vid,
      product_id: pid,
      sku: v.sku,
      variant_name: variantName,
      display_name: displayName,
      price: v.price,
      compare_at_price: v.compare,
      stock_quantity: v.stock,
      is_default: v.is_default,
      attributes: JSON.stringify({ color: v.color }),
    });
  }

  // Images
  // Thumbnail first
  if (p.images.thumbnail) {
    allImages.push({
      product_id: pid,
      variant_id: null,
      image_url: p.images.thumbnail,
      is_thumbnail: 1,
      color: null,
    });
  }

  // Color images
  for (const [colorName, urls] of Object.entries(p.images.colors)) {
    for (const url of urls) {
      allImages.push({
        product_id: pid,
        variant_id: null,
        image_url: url,
        is_thumbnail: 0,
        color: colorName,
      });
    }
  }
}

// ===== GENERATE VARIANT SQL =====
lines.push(`\n-- ===== SMARTWATCH PRODUCT_VARIANTS (${allVariants.length} rows) =====`);
for (const v of allVariants) {
  lines.push(
    `INSERT INTO product_variants (\`id\`, \`product_id\`, \`sku\`, \`variant_name\`, \`display_name\`, \`price\`, \`compare_at_price\`, \`stock_quantity\`, \`is_default\`, \`attributes\`, \`created_at\`, \`updated_at\`, \`deleted_at\`, \`sort_order\`, \`is_available\`) VALUES (${v.id}, ${v.product_id}, ${esc(v.sku)}, ${esc(v.variant_name)}, ${esc(v.display_name)}, '${v.price}.00', '${v.compare_at_price}.00', ${v.stock_quantity}, ${v.is_default}, ${esc(v.attributes)}, '${NOW}', '${NOW}', NULL, 0, 1);`
  );
}

// ===== GENERATE IMAGE SQL =====
lines.push(`\n-- ===== SMARTWATCH PRODUCT_IMAGES (${allImages.length} rows) =====`);
for (const img of allImages) {
  const iid = nextImageId++;
  lines.push(
    `INSERT INTO product_images (\`id\`, \`product_id\`, \`variant_id\`, \`image_url\`, \`is_thumbnail\`, \`color\`, \`created_at\`, \`updated_at\`, \`deleted_at\`) VALUES (${iid}, ${img.product_id}, NULL, ${esc(img.image_url)}, ${img.is_thumbnail}, ${img.color ? esc(img.color) : 'NULL'}, '${NOW}', '${NOW}', NULL);`
  );
}

// ===== WRITE TO seed_data.sql =====
const seedPath = path.join(__dirname, 'seed_data.sql');
let content = fs.readFileSync(seedPath, 'utf8');

const marker = 'SET FOREIGN_KEY_CHECKS = 1;';
const idx = content.lastIndexOf(marker);
if (idx === -1) {
  console.error('Không tìm thấy marker SET FOREIGN_KEY_CHECKS = 1 trong seed_data.sql');
  process.exit(1);
}

const sqlBlock = lines.join('\n') + '\n\n';
content = content.slice(0, idx) + sqlBlock + content.slice(idx);

fs.writeFileSync(seedPath, content, 'utf8');

console.log('Đã thêm vào seed_data.sql:');
console.log(`  - 1 category (Smartwatch, id=${CATEGORY_ID})`);
console.log(`  - 2 brand_categories (Apple+Samsung → Smartwatch)`);
console.log(`  - ${products.length} products (id ${PRODUCT_START_ID}-${nextProductId - 1})`);
console.log(`  - ${allVariants.length} variants (id ${VARIANT_START_ID}-${nextVariantId - 1})`);
console.log(`  - ${allImages.length} images (id ${IMAGE_START_ID}-${nextImageId - 1})`);
