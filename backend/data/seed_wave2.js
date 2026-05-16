/**
 * Wave 2: Thêm 4 smartwatch + 1 category "Đồng hồ" + 3 brands + 5 đồng hồ truyền thống
 * Chạy: node backend/data/seed_wave2.js
 * Insert đúng vị trí trong từng section của seed_data.sql
 */
const fs = require('fs');
const path = require('path');

const NOW = '2026-05-16 12:00:00';
const SEED_PATH = path.join(__dirname, 'seed_data.sql');

function esc(str) {
  if (str === null || str === undefined) return 'NULL';
  return `'${String(str).replace(/'/g, "''")}'`;
}
function jsonEsc(obj) { return esc(JSON.stringify(obj)); }

// ══════════════════════════════════════════════════
// DATA
// ══════════════════════════════════════════════════

const NEW_CATEGORY = {
  id: 5, name: 'Đồng hồ', slug: 'dong-ho',
  description: 'Tất cả các dòng đồng hồ đeo tay truyền thống',
};

const NEW_BRANDS = [
  { id: 11, name: 'CASIO', slug: 'casio', logo_url: null },
  { id: 12, name: 'CITIZEN', slug: 'citizen', logo_url: null },
  { id: 13, name: 'ORIENT', slug: 'orient', logo_url: null },
];

const SMARTWATCH_CAT = 4;
const WATCH_CAT = 5;

const shippingSmallWatch = JSON.stringify({
  weight_g: 200, length_cm: 12, width_cm: 12, height_cm: 8,
  is_fragile: true, shipping_class: 'small_electronic',
  free_shipping: false, contains_battery: true, requires_insurance: true,
});
const shippingTraditionalWatch = JSON.stringify({
  weight_g: 300, length_cm: 15, width_cm: 10, height_cm: 8,
  is_fragile: true, shipping_class: 'small_accessory',
  free_shipping: false, contains_battery: false, requires_insurance: true,
});

// ── Smartwatch products (cat=4) ──
const smartwatchProducts = [
  {
    brand_id: 2,
    name: 'Đồng hồ thông minh Samsung Galaxy Watch8 Classic 46mm dây da',
    slug: 'samsung-galaxy-watch8-classic-46mm-day-da',
    model: 'Samsung Galaxy Watch8 Classic 46mm dây da',
    base_price: 10560000, compare_at_price: 12990000,
    short_description: 'Đồng hồ thông minh phong cách cổ điển với vòng bezel xoay, viền thép không gỉ, chip Exynos W1000 3nm, màn hình Super AMOLED 3000 nits, cảm biến BioActive 3.0, pin 445mAh 40 giờ.',
    description: 'Samsung Galaxy Watch8 Classic 46mm mang thiết kế cổ điển với mặt tròn, vòng bezel xoay vật lý, dây da Eco Hybrid cao cấp. Màn hình Super AMOLED 1.34 inch sáng 3000 nits, kính Sapphire. Chip Exynos W1000 (3nm), RAM 2GB, bộ nhớ 64GB. Cảm biến BioActive 3.0 theo dõi ECG, huyết áp, SpO2, áp lực mạch máu, chỉ số chống oxy hóa AGEs. Pin 445mAh sử dụng ~40 giờ, sạc ~1.2 giờ. Chống nước 5 ATM, MIL-STD-810H. Wear OS 6 + One UI Watch 8.0.',
    warranty_months: 12,
    tags: '["samsung","galaxy-watch","watch8-classic","smartwatch","bezel","classic"]',
    specifications: {
      display_specs: 'Super AMOLED 1.34 inch, 438x438 pixels, 46mm, 3000 nits, Sapphire Crystal',
      processor_chipset: 'Exynos W1000 (tiến trình 3nm)',
      storage_capacity: '64GB (RAM 2GB)',
      network_connectivity: 'Bluetooth 5.3, WiFi, NFC',
      battery_capacity: '445 mAh (~40 giờ)',
      charging_speed: 'Đế sạc từ tính, ~1.2 giờ',
      operating_system: 'Wear OS 6 + One UI Watch 8.0',
      water_resistance: '5 ATM (ISO 22810:2010)',
      build_material: 'Viền thép không gỉ, kính Sapphire, dây da Eco Hybrid',
      dimensions_weight: '46.5 × 46 × 10.6 mm, 63.5g',
      sensors: 'BioActive 3.0 (3-in-1), ánh sáng, khí áp, nhiệt độ, địa từ, con quay hồi chuyển, gia tốc',
      health_features: 'ECG, huyết áp, SpO2, áp lực mạch máu, AGEs, thành phần cơ thể, giấc ngủ, stress, phát hiện té ngã, chu kỳ kinh nguyệt',
      sports_modes: '100+ chế độ: đi bộ, chạy bộ, bơi, đạp xe, yoga, leo núi',
      positioning: 'GPS, GLONASS, Galileo, BeiDou (băng tần kép L1/L5)',
      sim_slots: 'Không',
      compatibility: 'Android 12+',
      release_year: '2025',
      other_features: 'MIL-STD-810H, vòng bezel xoay, Samsung Wallet, Always-On Display',
    },
    attributes: [{ name: 'color', values: ['Trắng', 'Đen'] }],
    sold_count: 0, view_count: 0, rating_average: '0.00',
    shipping_info: shippingSmallWatch,
    variants: [
      { sku: 'SM-GW8C-46-DA-WHI', color: 'Trắng', price: 10560000, compare: 12990000, stock: 25, is_default: 1 },
      { sku: 'SM-GW8C-46-DA-BLK', color: 'Đen', price: 10560000, compare: 12990000, stock: 20, is_default: 0 },
    ],
    images: {
      thumbnail: 'https://cdn.tgdd.vn/Products/Images/7077/338266/Slider/vi-vn-samsung-galaxy-watch8-classic-thumbvideo.jpg',
      colors: {
        'Trắng': [
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338266/samsung-galaxy-watch8-classic-hc-1-638888811617288837.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338266/samsung-galaxy-watch8-classic-hc-2-638888811628233098.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338266/samsung-galaxy-watch8-classic-hc-3-638888811635769308.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338266/samsung-galaxy-watch8-classic-hc-4-638888811643437834.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338266/samsung-galaxy-watch8-classic-hc-5-638888811649374451.jpg',
        ],
        'Đen': [
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338266/samsung-galaxy-watch8-classic-den-1-638878303089744795.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338266/samsung-galaxy-watch8-classic-den-2-638878303120420165.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338266/samsung-galaxy-watch8-classic-den-3-638878303115185270.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338266/samsung-galaxy-watch8-classic-den-4-638878303108879295.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/338266/samsung-galaxy-watch8-classic-den-5-638878303102241704.jpg',
        ],
      },
    },
  },
  {
    brand_id: 3,
    name: 'Vòng đeo tay thông minh Mi Band 10 viền nhôm',
    slug: 'mi-band-10-vien-nhom',
    model: 'Xiaomi Mi Band 10 viền nhôm',
    base_price: 970000, compare_at_price: 1170000,
    short_description: 'Vòng đeo tay thông minh màn hình AMOLED 1.72 inch, pin 21 ngày, chống nước 5 ATM, 150+ chế độ luyện tập, viền hợp kim nhôm siêu nhẹ 15.95g.',
    description: 'Xiaomi Mi Band 10 sở hữu màn hình AMOLED 1.72 inch 212x520 pixels, độ sáng 1500 nits. Viền hợp kim nhôm, dây TPU kháng khuẩn, siêu nhẹ chỉ 15.95g. 150+ chế độ luyện tập, theo dõi sức khỏe 24/7 (nhịp tim, SpO2, giấc ngủ, stress), hệ thống PAI. Pin 233mAh sử dụng 21 ngày (cơ bản) hoặc 9 ngày (Always On Display). Bluetooth 5.4, chống nước 5 ATM. HyperOS, tương thích Android 8.0+ và iOS 12+.',
    warranty_months: 12,
    tags: '["xiaomi","mi-band","mi-band-10","smartwatch","vong-tay","gia-re"]',
    specifications: {
      display_specs: 'AMOLED 1.72 inch, 212x520 pixels, 1500 nits',
      processor_chipset: 'Hãng không công bố',
      storage_capacity: 'Hãng không công bố',
      network_connectivity: 'Bluetooth 5.4',
      battery_capacity: '233 mAh (~21 ngày cơ bản, ~9 ngày AOD)',
      charging_speed: 'Dây sạc nam châm, ~1 giờ',
      operating_system: 'HyperOS',
      water_resistance: '5 ATM',
      build_material: 'Viền hợp kim nhôm, kính cường lực 2.5D, dây TPU kháng khuẩn',
      dimensions_weight: '46.57 × 22.54 × 10.95 mm, 15.95g',
      sensors: 'Nhịp tim PPG, ánh sáng, từ, con quay hồi chuyển, gia tốc, la bàn',
      health_features: 'SpO2, nhịp tim 24h, PAI, giấc ngủ, stress, chu kỳ kinh nguyệt, bước chân, calories, bài tập thở',
      sports_modes: '150+ chế độ: đi bộ, chạy bộ, đạp xe, bơi, yoga',
      positioning: 'Không (dùng GPS điện thoại)',
      sim_slots: 'Không',
      compatibility: 'Android 8.0+, iOS 12+',
      release_year: '2025',
      other_features: 'Always-On Display, đèn pin, điều khiển chụp ảnh/nhạc, tìm điện thoại, thay mặt đồng hồ',
    },
    attributes: [{ name: 'color', values: ['Đen', 'Bạc', 'Hồng'] }],
    sold_count: 0, view_count: 0, rating_average: '0.00',
    shipping_info: shippingSmallWatch,
    variants: [
      { sku: 'XMI-MB10-ALU-BLK', color: 'Đen', price: 970000, compare: 1170000, stock: 100, is_default: 1 },
      { sku: 'XMI-MB10-ALU-SLV', color: 'Bạc', price: 970000, compare: 1170000, stock: 80, is_default: 0 },
      { sku: 'XMI-MB10-ALU-PNK', color: 'Hồng', price: 970000, compare: 1170000, stock: 60, is_default: 0 },
    ],
    images: {
      thumbnail: 'https://cdn.tgdd.vn/Products/Images/7077/336899/mi-band-10-den-600x600.jpg',
      colors: {
        'Đen': [
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/336899/mi-band-10-den-hc-1-638868969734558044.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/336899/mi-band-10-den-hc-2-638868969742923184.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/336899/mi-band-10-den-hc-3-638868969752387906.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/336899/mi-band-10-den-hc-4-638868969759195288.jpg',
        ],
        'Bạc': [
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/336899/mi-band-10-bac-hc-1-638868969125651214.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/336899/mi-band-10-bac-hc-2-638868969118039342.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/336899/mi-band-10-bac-hc-3-638868969110765856.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/336899/mi-band-10-bac-hc-4-638868969170742803.jpg',
        ],
        'Hồng': [
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/336899/mi-band-10-hong-hc-1-638868970190379936.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/336899/mi-band-10-hong-hc-2-638868970196414274.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/336899/mi-band-10-hong-hc-3-638868970202686531.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/336899/mi-band-10-hong-hc-4-638868970208468563.jpg',
        ],
      },
    },
  },
  {
    brand_id: 3,
    name: 'Đồng hồ thông minh Xiaomi Redmi Watch 5 47.5mm dây TPU',
    slug: 'xiaomi-redmi-watch-5-47-5mm-day-tpu',
    model: 'Xiaomi Redmi Watch 5 47.5mm dây TPU',
    base_price: 2540000, compare_at_price: 2940000,
    short_description: 'Đồng hồ thông minh màn hình AMOLED 2.07 inch sắc nét, pin 24 ngày, GPS độc lập, nghe gọi trực tiếp, 150+ chế độ thể thao, chống nước 5 ATM.',
    description: 'Xiaomi Redmi Watch 5 sở hữu màn hình AMOLED 2.07 inch 432x514 pixels, độ sáng 1500 nits. Khung hợp kim nhôm, dây TPU. Theo dõi sức khỏe toàn diện (SpO2, nhịp tim, giấc ngủ, stress), hỗ trợ nghe gọi trực tiếp trên đồng hồ. GPS độc lập đa hệ thống, 150+ chế độ thể thao. Pin 550mAh sử dụng ~24 ngày, chống nước 5 ATM. HyperOS 2.0, Bluetooth 5.3.',
    warranty_months: 12,
    tags: '["xiaomi","redmi-watch","redmi-watch-5","smartwatch","gps","nghe-goi"]',
    specifications: {
      display_specs: 'AMOLED 2.07 inch, 432x514 pixels, 1500 nits',
      processor_chipset: 'Hãng không công bố',
      storage_capacity: '512 MB',
      network_connectivity: 'Bluetooth 5.3',
      battery_capacity: '550 mAh (~24 ngày tắt AOD)',
      charging_speed: 'Dây sạc nam châm, ~1.5 giờ',
      operating_system: 'HyperOS 2.0',
      water_resistance: '5 ATM (ISO 22810:2010)',
      build_material: 'Khung hợp kim nhôm, kính cường lực, dây TPU',
      dimensions_weight: '47.5 × 41.1 × 11.3 mm, 33.5g',
      sensors: 'Nhịp tim, ánh sáng, gia tốc, la bàn điện tử, SpO2',
      health_features: 'SpO2, nhịp tim 24h, giấc ngủ, stress, nhịp thở, chu kỳ kinh nguyệt, cảnh báo nhịp tim cao/thấp, bước chân, calories',
      sports_modes: '150+ chế độ: đi bộ, nhảy dây, leo núi, chạy bộ, đạp xe, yoga, bơi',
      positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
      sim_slots: 'Không',
      compatibility: 'Android 8.0+, iOS 12+',
      release_year: '2024',
      other_features: 'Always-On Display, nghe gọi trên đồng hồ (loa + mic), điều khiển chụp ảnh/nhạc, tìm điện thoại',
    },
    attributes: [{ name: 'color', values: ['Đen', 'Bạc', 'Tím'] }],
    sold_count: 0, view_count: 0, rating_average: '0.00',
    shipping_info: shippingSmallWatch,
    variants: [
      { sku: 'XMI-RW5-475-TPU-BLK', color: 'Đen', price: 2540000, compare: 2940000, stock: 50, is_default: 1 },
      { sku: 'XMI-RW5-475-TPU-SLV', color: 'Bạc', price: 2540000, compare: 2940000, stock: 40, is_default: 0 },
      { sku: 'XMI-RW5-475-TPU-PUR', color: 'Tím', price: 2540000, compare: 2940000, stock: 35, is_default: 0 },
    ],
    images: {
      thumbnail: 'https://cdn.tgdd.vn/Products/Images/7077/332069/Slider/vi-vn-xiaomi-redmi-watch-5-thumbvideo.jpg',
      colors: {
        'Đen': [
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/332069/xiaomi-redmi-watch-5-den-hc-1-638711561164855097.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/332069/xiaomi-redmi-watch-5-den-hc-2-638711561172010526.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/332069/xiaomi-redmi-watch-5-den-hc-3-638711561178032941.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/332069/xiaomi-redmi-watch-5-den-hc-4-638711561184315180.jpg',
        ],
        'Bạc': [
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/332069/xiaomi-redmi-watch-5-bac-hc-1-638711559651906928.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/332069/xiaomi-redmi-watch-5-bac-hc-2-638711559658761877.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/332069/xiaomi-redmi-watch-5-bac-hc-3-638711559665353882.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/332069/xiaomi-redmi-watch-5-bac-hc-4-638711559671821494.jpg',
        ],
        'Tím': [
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/332069/xiaomi-redmi-watch-5-tim-hc-1-638711561928253291.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/332069/xiaomi-redmi-watch-5-tim-hc-2-638711561988043621.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/332069/xiaomi-redmi-watch-5-tim-hc-3-638711561982855454.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/332069/xiaomi-redmi-watch-5-tim-hc-4-638711561976514114.jpg',
        ],
      },
    },
  },
  {
    brand_id: 3,
    name: 'Đồng hồ thông minh Xiaomi Redmi Watch 5 Lite 48.2mm dây TPU',
    slug: 'xiaomi-redmi-watch-5-lite-48-2mm-day-tpu',
    model: 'Xiaomi Redmi Watch 5 Lite 48.2mm dây TPU',
    base_price: 1190000, compare_at_price: 1370000,
    short_description: 'Đồng hồ thông minh màn hình AMOLED 1.96 inch, pin 18 ngày, GPS độc lập, nghe gọi trực tiếp, 150+ chế độ thể thao, chống nước 5 ATM, giá phải chăng.',
    description: 'Xiaomi Redmi Watch 5 Lite sở hữu màn hình AMOLED 1.96 inch 410x502 pixels. Dây TPU thoải mái, HyperOS, Bluetooth 5.3. 150+ chế độ luyện tập với GPS độc lập đa hệ thống. Theo dõi sức khỏe: nhịp tim, SpO2, giấc ngủ, stress, chu kỳ kinh nguyệt. Nghe gọi trực tiếp với mic và loa kép. Pin 470mAh sử dụng tới 18 ngày (cơ bản) hoặc 7 ngày (Always On). Chống nước 5 ATM.',
    warranty_months: 12,
    tags: '["xiaomi","redmi-watch","redmi-watch-5-lite","smartwatch","gia-re","gps"]',
    specifications: {
      display_specs: 'AMOLED 1.96 inch, 410x502 pixels, kính cường lực Panda',
      processor_chipset: 'Sifli SF32LB523',
      storage_capacity: '4 GB',
      network_connectivity: 'Bluetooth 5.3',
      battery_capacity: '470 mAh (~18 ngày cơ bản, ~7 ngày AOD)',
      charging_speed: 'Dây sạc nam châm, ~2 giờ',
      operating_system: 'HyperOS',
      water_resistance: '5 ATM (ISO 22810:2010)',
      build_material: 'Khung nhựa, kính cường lực Panda, dây TPU',
      dimensions_weight: '48.2 × 39.3 × 10.6 mm, 29.2g',
      sensors: 'Nhịp tim, con quay hồi chuyển, gia tốc, SpO2',
      health_features: 'SpO2, nhịp tim 24h, giấc ngủ, stress, nhịp thở, chu kỳ kinh nguyệt, cảnh báo nhịp tim cao/thấp, bước chân',
      sports_modes: '150+ chế độ: đi bộ, nhảy dây, leo núi, chạy bộ, đạp xe, yoga, cầu lông, bóng rổ, chèo thuyền',
      positioning: 'GPS, GLONASS, Galileo, QZSS, BeiDou',
      sim_slots: 'Không',
      compatibility: 'Android 8.0+, iOS 12+',
      release_year: '2024',
      other_features: 'Always-On Display, nghe gọi trên đồng hồ (loa + mic kép), trợ lý giọng nói, SOS, đèn pin',
    },
    attributes: [{ name: 'color', values: ['Đen', 'Vàng'] }],
    sold_count: 0, view_count: 0, rating_average: '0.00',
    shipping_info: shippingSmallWatch,
    variants: [
      { sku: 'XMI-RW5L-482-TPU-BLK', color: 'Đen', price: 1190000, compare: 1370000, stock: 60, is_default: 1 },
      { sku: 'XMI-RW5L-482-TPU-YLW', color: 'Vàng', price: 1190000, compare: 1370000, stock: 40, is_default: 0 },
    ],
    images: {
      thumbnail: 'https://cdn.tgdd.vn/Products/Images/7077/329832/redmi-watch-5-lite-kem-tb-600x600.jpg',
      colors: {
        'Đen': [
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/329832/redmi-watch-5-lite-den-hc-1-638629600197599153.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/329832/redmi-watch-5-lite-den-hc-2-638629600203164274.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/329832/redmi-watch-5-lite-den-hc-3-638677841266751761.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/329832/redmi-watch-5-lite-den-hc-4-638629600215060479.jpg',
        ],
        'Vàng': [
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/329832/redmi-watch-5-lite-vang-01-638985549400007743.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/329832/redmi-watch-5-lite-vang-2-638985549412979711.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/329832/redmi-watch-5-lite-vang-3-638985549419675680.jpg',
          'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/7077/329832/redmi-watch-5-lite-vang-4-638985549428511932.jpg',
        ],
      },
    },
  },
];

// ── Traditional watch products (cat=5) ──
const watchProducts = [
  {
    brand_id: 11,
    name: 'Đồng hồ CASIO 30.2 mm Unisex A158WA-1DF',
    slug: 'casio-a158wa-1df-unisex',
    model: 'CASIO A158WA-1DF',
    base_price: 555000, compare_at_price: 1014000,
    short_description: 'Đồng hồ Casio cổ điển phong cách Vintage Nhật Bản, pin 7 năm, chống nước 3 ATM, thiết kế Unisex nhỏ gọn 30.2mm.',
    description: 'Đồng hồ CASIO A158WA-1DF thuộc bộ sưu tập Vintage, thiết kế Unisex với đường kính mặt 30.2mm. Khung viền nhựa PC kết hợp dây hợp kim nhẹ và bền. Chống nước 3 ATM phù hợp rửa tay, đi mưa. Trang bị báo thức, đèn nền LED, lịch ngày - thứ. Bộ máy Quartz pin khoảng 7 năm.',
    warranty_months: 12,
    tags: '["casio","vintage","unisex","dong-ho","gia-re","nhat-ban"]',
    specifications: {
      brand_origin: 'Nhật Bản',
      target_user: 'Unisex',
      collection: 'Vintage',
      dial_size: '30.2 mm',
      case_thickness: '9.2 mm',
      band_width: '14.8 mm',
      band_material: 'Hợp kim',
      case_material: 'Nhựa PC',
      glass_material: 'Nhựa',
      movement_type: 'Pin (Quartz)',
      power_source: 'Pin',
      battery_life: 'Khoảng 7 năm',
      water_resistance: '3 ATM - Rửa tay, đi mưa',
      features: 'Báo thức, Đèn nền LED, Lịch ngày - thứ',
      made_in: 'Nhật Bản/Thái Lan/Trung Quốc (tùy lô)',
      release_year: '2019',
    },
    attributes: [{ name: 'color', values: ['Bạc'] }],
    sold_count: 0, view_count: 0, rating_average: '0.00',
    shipping_info: shippingTraditionalWatch,
    variants: [
      { sku: 'CSO-A158WA-1DF-SLV', color: 'Bạc', price: 555000, compare: 1014000, stock: 50, is_default: 1 },
    ],
    images: {
      thumbnail: 'https://cdn.tgdd.vn/Products/Images/7264/199508/casio-a158wa-1df-bac-thumb-600x600.jpg',
      colors: {
        'Bạc': [
          'https://cdn.tgdd.vn/Products/Images/7264/199508/casio-a158wa-1df-bac-1-2-org.jpg',
          'https://cdn.tgdd.vn/Products/Images/7264/199508/casio-a158wa-1df-bac-2-2-org.jpg',
          'https://cdn.tgdd.vn/Products/Images/7264/199508/casio-a158wa-1df-bac-3-2-org.jpg',
          'https://cdn.tgdd.vn/Products/Images/7264/199508/casio-a158wa-1df-bac-4-2-org.jpg',
          'https://cdn.tgdd.vn/Products/Images/7264/199508/casio-a158wa-1df-bac-5-2-org.jpg',
        ],
      },
    },
  },
  {
    brand_id: 11,
    name: 'Đồng hồ CASIO Timeless 36.8 mm Nam W-800H-1AVDF',
    slug: 'casio-w-800h-1avdf-nam',
    model: 'CASIO W-800H-1AVDF',
    base_price: 861000, compare_at_price: 1014000,
    short_description: 'Đồng hồ Casio thể thao nam, chống nước 10 ATM tắm bơi được, pin 10 năm, bấm giờ thể thao, đèn nền LED.',
    description: 'Đồng hồ nam CASIO W-800H-1AVDF thuộc bộ sưu tập Timeless, kiểu dáng thể thao phù hợp nam giới năng động. Vỏ nhựa Resin nhỏ gọn, mặt kính trong suốt chống trầy. Bấm giờ thể thao với split time, báo thức hàng ngày, đèn nền LED. Dây đeo đục lỗ nhẹ nhàng. Chống nước 10 ATM có thể tắm và bơi. Pin khoảng 10 năm.',
    warranty_months: 12,
    tags: '["casio","timeless","nam","dong-ho","the-thao","chong-nuoc"]',
    specifications: {
      brand_origin: 'Nhật Bản',
      target_user: 'Nam',
      collection: 'Timeless',
      dial_size: '36.8 mm',
      case_thickness: '12.5 mm',
      band_material: 'Nhựa',
      case_material: 'Nhựa Resin',
      glass_material: 'Nhựa Resin',
      movement_type: 'Pin (Quartz)',
      power_source: 'Pin',
      battery_life: 'Khoảng 10 năm',
      water_resistance: '10 ATM - Tắm, bơi lội',
      features: 'Báo thức, Bấm giờ thể thao, Đèn nền LED',
      made_in: 'Nhật Bản/Thái Lan/Trung Quốc (tùy lô)',
      release_year: '2019',
    },
    attributes: [{ name: 'color', values: ['Đen'] }],
    sold_count: 0, view_count: 0, rating_average: '0.00',
    shipping_info: shippingTraditionalWatch,
    variants: [
      { sku: 'CSO-W800H-1AVDF-BLK', color: 'Đen', price: 861000, compare: 1014000, stock: 50, is_default: 1 },
    ],
    images: {
      thumbnail: 'https://cdn.tgdd.vn/Products/Images/7264/209084/casio-w-800h-1avdf-nam-avatar-1-600x600.jpg',
      colors: {
        'Đen': [
          'https://cdn.tgdd.vn/Products/Images/7264/209084/casio-w-800h-1avdf-nam-1-org.jpg',
          'https://cdn.tgdd.vn/Products/Images/7264/209084/casio-w-800h-1avdf-nam-2-org.jpg',
          'https://cdn.tgdd.vn/Products/Images/7264/209084/casio-w-800h-1avdf-nam-3-org.jpg',
          'https://cdn.tgdd.vn/Products/Images/7264/209084/casio-w-800h-1avdf-nam-20.jpg',
          'https://cdn.tgdd.vn/Products/Images/7264/209084/casio-w-800h-1avdf-nam-045920-015958.jpg',
        ],
      },
    },
  },
  {
    brand_id: 12,
    name: 'Đồng hồ CITIZEN 39 mm Nam BI5006-81L',
    slug: 'citizen-bi5006-81l-nam',
    model: 'CITIZEN BI5006-81L',
    base_price: 3727000, compare_at_price: 4385000,
    short_description: 'Đồng hồ Citizen nam Quartz mặt xanh, khung thép không gỉ sáng bóng, kính khoáng Mineral, chống nước 5 ATM, dây hợp kim.',
    description: 'Đồng hồ CITIZEN BI5006-81L thương hiệu Nhật Bản uy tín. Khung viền thép không gỉ bền bỉ, chống oxy hóa và ăn mòn. Mặt kính khoáng Mineral trong suốt, độ cứng cao. Chống nước 5 ATM phù hợp tắm và đi mưa. Trang bị lịch ngày. Dây hợp kim bền bỉ, mát tay. Bộ máy Quartz pin khoảng 2 năm.',
    warranty_months: 12,
    tags: '["citizen","nam","dong-ho","quartz","nhat-ban","mat-xanh"]',
    specifications: {
      brand_origin: 'Nhật Bản',
      target_user: 'Nam',
      dial_size: '39 mm',
      band_width: '21 mm',
      band_material: 'Hợp kim',
      case_material: 'Thép không gỉ',
      glass_material: 'Kính khoáng Mineral',
      movement_type: 'Pin (Quartz)',
      power_source: 'Pin',
      battery_life: 'Khoảng 2 năm',
      water_resistance: '5 ATM - Đi mưa, tắm',
      features: 'Lịch ngày',
      made_in: 'Nhật Bản/Thái Lan/Trung Quốc (tùy lô)',
      release_year: '2019',
    },
    attributes: [{ name: 'color', values: ['Xanh'] }],
    sold_count: 0, view_count: 0, rating_average: '0.00',
    shipping_info: shippingTraditionalWatch,
    variants: [
      { sku: 'CTZ-BI5006-81L-BLU', color: 'Xanh', price: 3727000, compare: 4385000, stock: 30, is_default: 1 },
    ],
    images: {
      thumbnail: 'https://cdn.tgdd.vn/Products/Images/7264/201740/dong-ho-nam-citizen-bi5006-81l-xanh-304320-114308-600x600.jpg',
      colors: {
        'Xanh': [
          'https://cdn.tgdd.vn/Products/Images/7264/201740/dong-ho-nam-citizen-bi5006-81l-xanh-3-org.jpg',
          'https://cdn.tgdd.vn/Products/Images/7264/201740/dong-ho-nam-citizen-bi5006-81l-xanh-1-1-org.jpg',
          'https://cdn.tgdd.vn/Products/Images/7264/201740/dong-ho-nam-citizen-bi5006-81l-xanh-2-1-org.jpg',
          'https://cdn.tgdd.vn/Products/Images/7264/201740/dong-ho-nam-citizen-bi5006-81l-xanh-99.jpg',
          'https://cdn.tgdd.vn/Products/Images/7264/201740/dong-ho-nam-citizen-bi5006-81l-xanh-4.jpg',
        ],
      },
    },
  },
  {
    brand_id: 12,
    name: 'Đồng hồ CITIZEN 42 mm Nam NH8350-08A',
    slug: 'citizen-nh8350-08a-nam',
    model: 'CITIZEN NH8350-08A',
    base_price: 4426000, compare_at_price: 6385000,
    short_description: 'Đồng hồ cơ tự động Citizen nam, bộ máy Caliber 8200, vỏ thép không gỉ, kính Mineral, dây da tổng hợp, lịch ngày + thứ, chống nước 5 ATM.',
    description: 'Đồng hồ CITIZEN NH8350-08A bộ máy cơ tự động (Automatic) Caliber 8200, không lo hết pin. Vỏ thép không gỉ bền bỉ, mặt kính khoáng Mineral chịu va đập. Lịch ngày và lịch thứ tiện lợi. Chống nước 5 ATM. Dây da tổng hợp đeo thoải mái, khóa cài thép không gỉ. Thời gian trữ cót khoảng 24 tiếng.',
    warranty_months: 12,
    tags: '["citizen","nam","dong-ho","automatic","co-tu-dong","nhat-ban"]',
    specifications: {
      brand_origin: 'Nhật Bản',
      target_user: 'Nam',
      collection: 'Mechanical',
      dial_size: '42 mm',
      case_thickness: '11.2 mm',
      band_width: '20 mm',
      band_material: 'Da tổng hợp',
      case_material: 'Thép không gỉ',
      glass_material: 'Kính khoáng Mineral',
      movement_name: 'Caliber 8200',
      movement_type: 'Cơ tự động (Automatic)',
      power_source: 'Cơ tự động',
      power_reserve: 'Khoảng 24 tiếng',
      water_resistance: '5 ATM - Đi mưa, tắm',
      features: 'Lịch ngày, Lịch thứ',
      made_in: 'Nhật Bản/Thái Lan/Trung Quốc (tùy lô)',
      release_year: '2019',
    },
    attributes: [{ name: 'color', values: ['Trắng'] }],
    sold_count: 0, view_count: 0, rating_average: '0.00',
    shipping_info: shippingTraditionalWatch,
    variants: [
      { sku: 'CTZ-NH8350-08A-WHI', color: 'Trắng', price: 4426000, compare: 6385000, stock: 20, is_default: 1 },
    ],
    images: {
      thumbnail: 'https://cdn.tgdd.vn/Products/Images/7264/200934/citizen-nh8350-08a-trang-thumb-fix-600x600.jpg',
      colors: {
        'Trắng': [
          'https://cdn.tgdd.vn/Products/Images/7264/200934/citizen-nh8350-08a-trang-1-1-org.jpg',
          'https://cdn.tgdd.vn/Products/Images/7264/200934/citizen-nh8350-08a-trang-2-1-org.jpg',
          'https://cdn.tgdd.vn/Products/Images/7264/200934/citizen-nh8350-08a-trang-3-org.jpg',
          'https://cdn.tgdd.vn/Products/Images/7264/200934/citizen-nh8350-08a-trang-4-org.jpg',
          'https://cdn.tgdd.vn/Products/Images/7264/200934/citizen-nh8350-08a-trang-5-org.jpg',
        ],
      },
    },
  },
  {
    brand_id: 13,
    name: 'Đồng hồ ORIENT Bambino 42.5 mm Nam FAG00001T0',
    slug: 'orient-bambino-fag00001t0-nam',
    model: 'ORIENT Bambino FAG00001T0',
    base_price: 8483000, compare_at_price: 9980000,
    short_description: 'Đồng hồ cơ tự động Orient Bambino nam lịch lãm, bộ máy Caliber F6T22, mặt kính lồi Mineral, vỏ thép không gỉ, dây da tổng hợp, chống nước 5 ATM.',
    description: 'Đồng hồ ORIENT Bambino FAG00001T0 thuộc bộ sưu tập Bambino thời thượng. Máy cơ tự động (Automatic) Caliber F6T22, trữ cót khoảng 32 tiếng. Vỏ thép không gỉ chống ăn mòn, mặt kính khoáng Mineral dạng lồi tăng khả năng chống rạn nứt. Chống nước 5 ATM. Dây da tổng hợp nhẹ nhàng, êm ái, đục lỗ phù hợp nhiều cổ tay.',
    warranty_months: 12,
    tags: '["orient","bambino","nam","dong-ho","automatic","co-tu-dong","nhat-ban","lich-lam"]',
    specifications: {
      brand_origin: 'Nhật Bản',
      target_user: 'Nam',
      collection: 'Bambino',
      dial_size: '42.5 mm',
      case_thickness: '11.6 mm',
      band_width: '22 mm',
      band_material: 'Da tổng hợp',
      case_material: 'Thép không gỉ',
      glass_material: 'Kính khoáng Mineral (dạng lồi)',
      movement_name: 'Caliber F6T22',
      movement_type: 'Cơ tự động (Automatic)',
      power_source: 'Cơ tự động',
      power_reserve: 'Khoảng 32 tiếng',
      water_resistance: '5 ATM - Đi mưa, tắm',
      made_in: 'Nhật Bản/Thái Lan/Trung Quốc (tùy lô)',
      release_year: '2020',
    },
    attributes: [{ name: 'color', values: ['Nâu'] }],
    sold_count: 0, view_count: 0, rating_average: '0.00',
    shipping_info: shippingTraditionalWatch,
    variants: [
      { sku: 'ORT-FAG00001T0-BRN', color: 'Nâu', price: 8483000, compare: 9980000, stock: 15, is_default: 1 },
    ],
    images: {
      thumbnail: 'https://cdn.tgdd.vn/Products/Images/7264/202676/orient-fag00001t0-nam-co-tu-dong-2-600x600.jpg',
      colors: {
        'Nâu': [
          'https://cdn.tgdd.vn/Products/Images/7264/202676/orient-fag00001t0-nam-co-tu-dong-5-org.jpg',
          'https://cdn.tgdd.vn/Products/Images/7264/202676/orient-fag00001t0-nam-co-tu-dong-6-org.jpg',
          'https://cdn.tgdd.vn/Products/Images/7264/202676/orient-fag00001t0-nam-co-tu-dong-7-org.jpg',
          'https://cdn.tgdd.vn/Products/Images/7264/202676/orient-fag00001t0-nam-co-tu-dong-8-org.jpg',
          'https://cdn.tgdd.vn/Products/Images/7264/202676/orient-fag00001t0-nam-co-tu-dong-15.jpg',
        ],
      },
    },
  },
];

// ══════════════════════════════════════════════════
// GENERATE SQL & INSERT INTO CORRECT POSITIONS
// ══════════════════════════════════════════════════

let content = fs.readFileSync(SEED_PATH, 'utf8');
const lines = content.split('\n');

// ── Collect all new SQL by type ──
const allProducts = [...smartwatchProducts, ...watchProducts];
let nextProdId = 52;
let nextVarId = 200;
let nextImgId = 1077;

const categorySQL = [];
const brandSQL = [];
const productSQL = [];
const variantSQL = [];
const imageSQL = [];

// Category
categorySQL.push(
  `INSERT INTO categories (\`id\`, \`name\`, \`slug\`, \`description\`, \`created_at\`, \`updated_at\`, \`deleted_at\`) VALUES (${NEW_CATEGORY.id}, ${esc(NEW_CATEGORY.name)}, ${esc(NEW_CATEGORY.slug)}, ${esc(NEW_CATEGORY.description)}, '${NOW}', '${NOW}', NULL);`
);

// Brands
for (const b of NEW_BRANDS) {
  brandSQL.push(
    `INSERT INTO brands (\`id\`, \`name\`, \`slug\`, \`logo_url\`, \`created_at\`, \`updated_at\`, \`deleted_at\`) VALUES (${b.id}, ${esc(b.name)}, ${esc(b.slug)}, ${b.logo_url ? esc(b.logo_url) : 'NULL'}, '${NOW}', '${NOW}', NULL);`
  );
}

// Products, variants, images
for (const p of allProducts) {
  const pid = nextProdId++;
  const catId = smartwatchProducts.includes(p) ? SMARTWATCH_CAT : WATCH_CAT;

  productSQL.push(
    `INSERT INTO products (\`id\`, \`category_id\`, \`brand_id\`, \`name\`, \`slug\`, \`base_name\`, \`model\`, \`base_price\`, \`compare_at_price\`, \`short_description\`, \`description\`, \`status\`, \`is_featured\`, \`condition\`, \`visibility\`, \`warranty_months\`, \`tags\`, \`specifications\`, \`attributes\`, \`sold_count\`, \`view_count\`, \`rating_average\`, \`shipping_info\`, \`seo_title\`, \`seo_description\`, \`seo_keywords\`, \`created_at\`, \`updated_at\`, \`deleted_at\`, \`sku\`) VALUES (${pid}, ${catId}, ${p.brand_id}, ${esc(p.name)}, ${esc(p.slug)}, NULL, ${esc(p.model)}, '${p.base_price}.00', ${p.compare_at_price ? `'${p.compare_at_price}.00'` : 'NULL'}, ${esc(p.short_description)}, ${esc(p.description)}, 'active', 1, 'new', 'public', ${p.warranty_months}, ${esc(p.tags)}, ${jsonEsc(p.specifications)}, ${jsonEsc(p.attributes)}, ${p.sold_count}, ${p.view_count}, '${p.rating_average}', ${esc(p.shipping_info)}, NULL, NULL, NULL, '${NOW}', '${NOW}', NULL, NULL);`
  );

  for (const v of p.variants) {
    const vid = nextVarId++;
    variantSQL.push(
      `INSERT INTO product_variants (\`id\`, \`product_id\`, \`sku\`, \`variant_name\`, \`display_name\`, \`price\`, \`compare_at_price\`, \`stock_quantity\`, \`is_default\`, \`attributes\`, \`created_at\`, \`updated_at\`, \`deleted_at\`, \`sort_order\`, \`is_available\`) VALUES (${vid}, ${pid}, ${esc(v.sku)}, ${esc(p.model + ' - ' + v.color)}, ${esc(v.color)}, '${v.price}.00', '${v.compare}.00', ${v.stock}, ${v.is_default}, ${esc(JSON.stringify({ color: v.color }))}, '${NOW}', '${NOW}', NULL, 0, 1);`
    );
  }

  if (p.images.thumbnail) {
    imageSQL.push(
      `INSERT INTO product_images (\`id\`, \`product_id\`, \`variant_id\`, \`image_url\`, \`is_thumbnail\`, \`color\`, \`created_at\`, \`updated_at\`, \`deleted_at\`) VALUES (${nextImgId++}, ${pid}, NULL, ${esc(p.images.thumbnail)}, 1, NULL, '${NOW}', '${NOW}', NULL);`
    );
  }
  for (const [color, urls] of Object.entries(p.images.colors)) {
    for (const url of urls) {
      imageSQL.push(
        `INSERT INTO product_images (\`id\`, \`product_id\`, \`variant_id\`, \`image_url\`, \`is_thumbnail\`, \`color\`, \`created_at\`, \`updated_at\`, \`deleted_at\`) VALUES (${nextImgId++}, ${pid}, NULL, ${esc(url)}, 0, ${esc(color)}, '${NOW}', '${NOW}', NULL);`
      );
    }
  }
}

// ── Insert into correct positions (bottom-up to avoid index shift) ──

// Find last line of each section
function findLastInsert(prefix) {
  for (let i = lines.length - 1; i >= 0; i--) {
    if (lines[i].startsWith(prefix)) return i;
  }
  return -1;
}

// Images (insert after last image)
const lastImg = findLastInsert('INSERT INTO product_images');
lines.splice(lastImg + 1, 0, ...imageSQL);

// Variants (insert after last variant) — recalc since we spliced
const lastVar = findLastInsert('INSERT INTO product_variants');
lines.splice(lastVar + 1, 0, ...variantSQL);

// Products (insert after last product)
const lastProd = findLastInsert('INSERT INTO products');
lines.splice(lastProd + 1, 0, ...productSQL);

// Brands (insert after last brand)
const lastBrand = findLastInsert('INSERT INTO brands');
lines.splice(lastBrand + 1, 0, ...brandSQL);

// Categories (insert after last category)
const lastCat = findLastInsert('INSERT INTO categories');
lines.splice(lastCat + 1, 0, ...categorySQL);

// ── Update section headers ──
for (let i = 0; i < lines.length; i++) {
  if (lines[i].match(/CATEGORIES \(\d+ rows\)/)) lines[i] = `-- ===== CATEGORIES (5 rows) =====`;
  if (lines[i].match(/BRANDS \(\d+ rows\)/)) lines[i] = `-- ===== BRANDS (13 rows) =====`;
  if (lines[i].match(/PRODUCTS \(\d+ rows\)/)) lines[i] = `-- ===== PRODUCTS (60 rows) =====`;
  if (lines[i].match(/PRODUCT_VARIANTS \(\d+ rows\)/)) lines[i] = `-- ===== PRODUCT_VARIANTS (${199 + variantSQL.length} rows) =====`;
  if (lines[i].match(/PRODUCT_IMAGES \(\d+ rows\)/)) lines[i] = `-- ===== PRODUCT_IMAGES (${568 + imageSQL.length} rows) =====`;
}

fs.writeFileSync(SEED_PATH, lines.join('\n'), 'utf8');

console.log('Done! Added to seed_data.sql:');
console.log(`  Categories: +1 (Đồng hồ, id=5)`);
console.log(`  Brands: +3 (CASIO=12, CITIZEN=13, ORIENT=14)`);
console.log(`  Products: +${allProducts.length} (id 52-${nextProdId - 1})`);
console.log(`  Variants: +${variantSQL.length} (id 200-${nextVarId - 1})`);
console.log(`  Images: +${imageSQL.length} (id 1077-${nextImgId - 1})`);
