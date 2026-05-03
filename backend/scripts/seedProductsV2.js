const {
  Product,
  Category,
  ProductAttribute,
  ProductVariant,
  ProductSpecification,
  Brand,
  OrderItem,
  CartItem,
  sequelize,
} = require('../src/models');

const CAT_PHONE  = 'Điện thoại';
const CAT_LAPTOP = 'Laptop';
const CAT_TABLET = 'Tablet';
const CAT_PC     = 'PC';
const CAT_WATCH  = 'Smartwatch';

function getSpecCategory(name) {
  const n = name.toLowerCase();
  if (['cpu', 'chip', 'ram', 'ổ cứng', 'ssd', 'gpu', 'vga', 'vi xử lý'].some(k => n.includes(k))) return 'Hiệu năng';
  if (['màn hình', 'độ sáng', 'tần số quét', 'oled', 'lcd', 'độ phân giải'].some(k => n.includes(k))) return 'Màn hình';
  if (['pin', 'sạc', 'dung lượng pin'].some(k => n.includes(k))) return 'Pin & Nguồn';
  if (['camera', 'selfie', 'quay phim', 'ống kính'].some(k => n.includes(k))) return 'Camera';
  if (['kháng nước', 'chống nước', 'độ sâu', 'ip68', 'ip67'].some(k => n.includes(k))) return 'Độ bền';
  return 'Thông số chung';
}

const pList = [];

function addDetailProduct(category, brand, name, basePrice, specs, attributes) {
  const variants = [];
  const generateCombos = (attrs, currentIdx, currentSelection) => {
    if (currentIdx === attrs.length) {
      const comboName = Object.values(currentSelection).join(' - ');
      let variantPrice = Number(basePrice);
      for (const attrVal of Object.values(currentSelection)) {
        const val = attrVal.toLowerCase();
        if (val.includes('16gb') || val.includes('256gb')) variantPrice += 2000000;
        if (val.includes('32gb') || val.includes('512gb') || val.includes('m4 pro')) variantPrice += 5000000;
        if (val.includes('64gb') || val.includes('1tb') || val.includes('m4 max') || val.includes('rtx 4070') || val.includes('ultra 7')) variantPrice += 10000000;
        if (val.includes('2tb') || val.includes('rtx 4090') || val.includes('rtx 4080')) variantPrice += 20000000;
      }
      variants.push({
        name: comboName,
        attributes: { ...currentSelection },
        price: variantPrice,
        stock: Math.floor(Math.random() * 20) + 2,
      });
      return;
    }
    for (const val of attrs[currentIdx].values) {
      currentSelection[attrs[currentIdx].name] = val;
      generateCombos(attrs, currentIdx + 1, currentSelection);
    }
  };
  generateCombos(attributes, 0, {});
  if (variants.length > 0) variants[0].isDefault = true;
  pList.push({ category, brand, name, basePrice: Number(basePrice), specifications: specs, attributes, variants });
}

// =============================================================================
// DỮ LIỆU 45 SẢN PHẨM
// =============================================================================

// ── ĐIỆN THOẠI (15) ──────────────────────────────────────────────────────────

addDetailProduct(CAT_PHONE, 'Apple', 'iPhone 16 Pro Max', 34990000,
  { 'Chip': 'Apple A18 Pro 6-core', 'Màn hình': '6.9" Super Retina XDR ProMotion 120Hz', 'Camera': 'Hệ thống 48MP Fusion + 48MP Ultra Wide + 12MP Tetra Prism 5x', 'Pin': '4.685 mAh, sạc 30W', 'Kháng nước': 'IP68 – 6m / 30 phút' },
  [{ name: 'Màu sắc', values: ['Titan Đen', 'Titan Trắng', 'Titan Tự Nhiên', 'Titan Sa Mạc'] }, { name: 'Dung lượng', values: ['256GB', '512GB', '1TB'] }]);

addDetailProduct(CAT_PHONE, 'Apple', 'iPhone 16 Pro', 28990000,
  { 'Chip': 'Apple A18 Pro 6-core', 'Màn hình': '6.3" Super Retina XDR ProMotion 120Hz', 'Camera': '48MP Fusion + 48MP Ultra Wide + Tetra Prism 5x', 'Pin': '3.582 mAh, USB-C 3.2 Gen 2', 'Kháng nước': 'IP68 – 6m / 30 phút' },
  [{ name: 'Màu sắc', values: ['Titan Đen', 'Titan Trắng', 'Titan Tự Nhiên'] }, { name: 'Dung lượng', values: ['128GB', '256GB', '512GB'] }]);

addDetailProduct(CAT_PHONE, 'Apple', 'iPhone 16', 22990000,
  { 'Chip': 'Apple A18 4-core GPU', 'Màn hình': '6.1" Super Retina XDR 60Hz', 'Camera sau': '48MP Fusion OIS', 'Camera trước': '12MP TrueDepth', 'Pin': '3.561 mAh' },
  [{ name: 'Màu sắc', values: ['Đen', 'Trắng', 'Hồng', 'Xanh Lam', 'Mòng Két'] }, { name: 'Dung lượng', values: ['128GB', '256GB'] }]);

addDetailProduct(CAT_PHONE, 'Samsung', 'Samsung Galaxy S25 Ultra', 33990000,
  { 'Chip': 'Snapdragon 8 Elite for Galaxy', 'Màn hình': '6.9" QHD+ 120Hz Dynamic LTPO AMOLED 2X', 'Camera': '200MP HP9 + 50MP + 10MP + 50MP', 'Pin': '5.000 mAh, sạc 45W', 'Bút S-Pen': 'Tích hợp sẵn trong máy' },
  [{ name: 'Màu sắc', values: ['Titanium Silverblue', 'Titanium Black', 'Titanium Whitesilver'] }, { name: 'Dung lượng', values: ['256GB', '512GB', '1TB'] }]);

addDetailProduct(CAT_PHONE, 'Samsung', 'Samsung Galaxy S25+', 26990000,
  { 'Chip': 'Snapdragon 8 Elite for Galaxy', 'Màn hình': '6.7" FHD+ 120Hz Dynamic LTPO AMOLED 2X', 'Camera': '50MP OIS + 10MP Telephoto + 12MP Ultra Wide', 'Pin': '4.900 mAh, sạc 45W', 'HĐH': 'One UI 7 / Android 15' },
  [{ name: 'Màu sắc', values: ['Icyblue', 'Mint', 'Navy', 'Silver Shadow'] }, { name: 'Dung lượng', values: ['256GB', '512GB'] }]);

addDetailProduct(CAT_PHONE, 'Samsung', 'Samsung Galaxy S25', 22990000,
  { 'Chip': 'Snapdragon 8 Elite for Galaxy', 'Màn hình': '6.2" FHD+ 120Hz AMOLED', 'Camera': '50MP OIS + 12MP Ultra Wide + 10MP Telephoto', 'Pin': '4.000 mAh, sạc 25W', 'Galaxy AI': 'Tích hợp, hỗ trợ tiếng Việt' },
  [{ name: 'Màu sắc', values: ['Icyblue', 'Mint', 'Navy', 'Silver Shadow'] }, { name: 'Dung lượng', values: ['128GB', '256GB'] }]);

addDetailProduct(CAT_PHONE, 'Samsung', 'Samsung Galaxy Z Fold 6', 43990000,
  { 'Chip': 'Snapdragon 8 Gen 3 for Galaxy', 'Màn hình chính': '7.6" Dynamic AMOLED 2X 120Hz', 'Màn hình phụ': '6.3" 120Hz', 'Pin': '4.400 mAh, sạc 25W', 'Chống nước': 'IPX8' },
  [{ name: 'Màu sắc', values: ['Navy', 'Silver', 'Pink'] }, { name: 'Dung lượng', values: ['256GB', '512GB'] }]);

addDetailProduct(CAT_PHONE, 'Samsung', 'Samsung Galaxy A56 5G', 11990000,
  { 'Chip': 'Exynos 1580 Octa-core', 'Màn hình': '6.7" FHD+ 120Hz Super AMOLED', 'Camera': '50MP OIS + 12MP Ultra Wide + 5MP Macro', 'Pin': '5.000 mAh, sạc 45W', 'Kháng nước': 'IP67' },
  [{ name: 'Màu sắc', values: ['Awesome Graphite', 'Awesome Iceblue', 'Awesome Lilac'] }, { name: 'RAM', values: ['8GB', '12GB'] }]);

addDetailProduct(CAT_PHONE, 'Xiaomi', 'Xiaomi 15 Ultra', 32990000,
  { 'Chip': 'Snapdragon 8 Elite', 'Camera': 'Leica Light Fusion 900 – 50MP, Zoom quang 5x', 'Màn hình': '6.73" WQHD+ 120Hz LTPO AMOLED', 'Pin': '6.000 mAh, sạc có dây 90W', 'Sạc không dây': '80W HyperCharge' },
  [{ name: 'Màu sắc', values: ['Titan Đen', 'Titan Trắng'] }, { name: 'Dung lượng', values: ['256GB', '512GB'] }]);

addDetailProduct(CAT_PHONE, 'Xiaomi', 'Xiaomi 15', 21990000,
  { 'Chip': 'Snapdragon 8 Elite', 'Màn hình': '6.36" FHD+ 120Hz AMOLED', 'Camera': 'Leica 50MP OIS + 50MP Tele + 50MP Ultra Wide', 'Pin': '5.240 mAh, sạc 90W', 'Kháng nước': 'IP68' },
  [{ name: 'Màu sắc', values: ['Trắng', 'Đen', 'Xanh Lá'] }, { name: 'Dung lượng', values: ['256GB', '512GB'] }]);

addDetailProduct(CAT_PHONE, 'OPPO', 'OPPO Find X8 Pro', 27990000,
  { 'Chip': 'MediaTek Dimensity 9400', 'Màn hình': '6.78" BOE LTPO AMOLED 120Hz', 'Camera': 'Hasselblad 50MP + 50MP Periscope 6x + 50MP Ultra Wide', 'Pin': '5.910 mAh, sạc 80W', 'Kháng nước': 'IP69' },
  [{ name: 'Màu sắc', values: ['Xanh Biển', 'Đen Vũ Trụ'] }, { name: 'Dung lượng', values: ['256GB', '512GB'] }]);

addDetailProduct(CAT_PHONE, 'OPPO', 'OPPO Reno13 Pro', 15990000,
  { 'Chip': 'MediaTek Dimensity 8350', 'Màn hình': '6.83" FHD+ 120Hz AMOLED', 'Camera': '50MP Sony LYT-600 OIS + 50MP Telephoto + 8MP', 'Pin': '5.600 mAh, sạc 80W SUPERVOOC', 'Kháng nước': 'IP66 / IP68 / IP69' },
  [{ name: 'Màu sắc', values: ['Hồng Ánh Bình Minh', 'Xanh Lam', 'Đen'] }, { name: 'RAM', values: ['12GB', '16GB'] }]);

addDetailProduct(CAT_PHONE, 'Vivo', 'Vivo X200 Pro', 24990000,
  { 'Chip': 'MediaTek Dimensity 9400', 'Camera': 'ZEISS APO Telephoto 200MP + 50MP + 50MP', 'Màn hình': '6.78" 1.5K LTPO AMOLED 120Hz', 'Pin': '6.000 mAh, sạc 90W FlashCharge', 'Kháng nước': 'IP69' },
  [{ name: 'Màu sắc', values: ['Đen Titan', 'Trắng Titan'] }, { name: 'Dung lượng', values: ['256GB', '512GB'] }]);

addDetailProduct(CAT_PHONE, 'Realme', 'Realme GT 7 Pro', 16990000,
  { 'Chip': 'Snapdragon 8 Elite', 'Màn hình': '6.78" AMOLED 144Hz, 4500 nits', 'Camera': '50MP OIS + 50MP Telephoto 3x + 8MP', 'Pin': '6.500 mAh, sạc 120W SUPERVOOC', 'Kháng nước': 'IP69' },
  [{ name: 'Màu sắc', values: ['Mars Orange', 'Fluid Silver', 'Space Black'] }, { name: 'Dung lượng', values: ['256GB', '512GB'] }]);

addDetailProduct(CAT_PHONE, 'Google', 'Google Pixel 9 Pro', 25990000,
  { 'Chip': 'Google Tensor G4', 'Màn hình': '6.3" LTPO OLED 120Hz 2000 nits', 'Camera': '50MP OIS + 48MP Ultra Wide + 48MP Telephoto 5x', 'Pin': '4.700 mAh, sạc 27W', 'AI': 'Gemini AI tích hợp' },
  [{ name: 'Màu sắc', values: ['Obsidian', 'Porcelain', 'Hazel', 'Rose Quartz'] }, { name: 'Dung lượng', values: ['128GB', '256GB', '512GB'] }]);

// ── LAPTOP (12) ───────────────────────────────────────────────────────────────

addDetailProduct(CAT_LAPTOP, 'Apple', 'MacBook Air 13" M4', 28990000,
  { 'Chip': 'Apple M4 10-core CPU, 10-core GPU', 'Màn hình': '13.6" Liquid Retina 500 nits', 'Bộ nhớ': '16GB Unified Memory', 'Wifi': 'Wi-Fi 6E, Bluetooth 5.3', 'Trọng lượng': '1.24 kg' },
  [{ name: 'Màu sắc', values: ['Midnight', 'Starlight', 'Sky Blue', 'Silver'] }, { name: 'SSD', values: ['256GB', '512GB', '1TB'] }]);

addDetailProduct(CAT_LAPTOP, 'Apple', 'MacBook Air 15" M4', 35990000,
  { 'Chip': 'Apple M4 10-core CPU, 10-core GPU', 'Màn hình': '15.3" Liquid Retina 500 nits', 'Bộ nhớ': '16GB Unified Memory', 'Âm thanh': '6 loa Spatial Audio', 'Trọng lượng': '1.51 kg' },
  [{ name: 'Màu sắc', values: ['Midnight', 'Starlight', 'Sky Blue', 'Silver'] }, { name: 'SSD', values: ['256GB', '512GB', '1TB'] }]);

addDetailProduct(CAT_LAPTOP, 'Apple', 'MacBook Pro 14" M4 Pro', 52990000,
  { 'Chip': 'Apple M4 Pro / M4 Max', 'Màn hình': '14.2" Liquid Retina XDR 1000 nits, ProMotion 120Hz', 'Pin': 'Đến 24 giờ', 'Âm thanh': '6 loa Force-cancelling', 'Cổng kết nối': '3x Thunderbolt 5, HDMI 2.1, SD Card' },
  [{ name: 'Màu sắc', values: ['Space Black', 'Silver'] }, { name: 'Chip', values: ['M4 Pro', 'M4 Max'] }, { name: 'RAM', values: ['24GB', '48GB'] }]);

addDetailProduct(CAT_LAPTOP, 'Dell', 'Dell XPS 15 9530', 54990000,
  { 'Chip': 'Intel Core Ultra 9 185H', 'Màn hình': '15.6" 3.5K OLED Touch 120Hz', 'VGA': 'NVIDIA RTX 4070 8GB GDDR6', 'Pin': '86Wh, sạc 130W', 'Trọng lượng': '1.86 kg' },
  [{ name: 'Màu sắc', values: ['Platinum Silver'] }, { name: 'RAM', values: ['32GB', '64GB'] }, { name: 'SSD', values: ['1TB', '2TB'] }]);

addDetailProduct(CAT_LAPTOP, 'Dell', 'Dell Inspiron 15 3535', 18990000,
  { 'Chip': 'AMD Ryzen 7 7730U', 'Màn hình': '15.6" FHD 120Hz', 'RAM': '16GB DDR4 3200MHz', 'Ổ cứng': 'SSD 512GB PCIe NVMe', 'Pin': '54Wh, sạc 65W' },
  [{ name: 'Màu sắc', values: ['Carbon Black', 'Platinum Silver'] }, { name: 'RAM', values: ['8GB', '16GB'] }, { name: 'SSD', values: ['512GB', '1TB'] }]);

addDetailProduct(CAT_LAPTOP, 'Asus', 'Asus ROG Zephyrus G16 2024', 47990000,
  { 'Chip': 'Intel Core Ultra 9 185H', 'VGA': 'NVIDIA RTX 4070 / 4080 8GB', 'Màn hình': '16" 2.5K OLED 240Hz, 100% DCI-P3', 'Tản nhiệt': 'Tri-fan Technology, MUX Switch', 'Trọng lượng': '1.85 kg' },
  [{ name: 'Màu sắc', values: ['Eclipse Gray', 'Platinum White'] }, { name: 'Card đồ họa', values: ['RTX 4070', 'RTX 4080'] }, { name: 'RAM', values: ['16GB', '32GB'] }]);

addDetailProduct(CAT_LAPTOP, 'Asus', 'Asus Zenbook Pro 14 OLED', 29990000,
  { 'Chip': 'Intel Core Ultra 9 185H', 'Màn hình': '14.5" 2.8K OLED 120Hz, 550 nits', 'VGA': 'NVIDIA RTX 4060 8GB', 'Âm thanh': 'Harman Kardon Spatial Audio', 'Trọng lượng': '1.64 kg' },
  [{ name: 'Màu sắc', values: ['Tech Black'] }, { name: 'RAM', values: ['16GB', '32GB'] }, { name: 'SSD', values: ['1TB', '2TB'] }]);

addDetailProduct(CAT_LAPTOP, 'Lenovo', 'Lenovo ThinkPad X1 Carbon Gen 12', 42990000,
  { 'Chip': 'Intel Core Ultra 7 165U', 'Màn hình': '14" 2.8K OLED 120Hz', 'Trọng lượng': '1.12 kg', 'Pin': 'Đến 15 giờ, sạc 65W USB-C', 'Bảo mật': 'vPro, Match-on-Chip Fingerprint, IR Camera' },
  [{ name: 'Màu sắc', values: ['Deep Black'] }, { name: 'RAM', values: ['16GB', '32GB'] }, { name: 'SSD', values: ['512GB', '1TB'] }]);

addDetailProduct(CAT_LAPTOP, 'Lenovo', 'Lenovo Legion Pro 5i Gen 9', 35990000,
  { 'CPU': 'Intel Core i9-14900HX', 'VGA': 'NVIDIA RTX 4070 8GB 140W TGP', 'Màn hình': '16" WQXGA 165Hz 500 nits', 'Tản nhiệt': 'Legion ColdFront 5.0 + Vapor Chamber', 'RAM': 'DDR5 5600MHz' },
  [{ name: 'Màu sắc', values: ['Onyx Grey'] }, { name: 'RAM', values: ['16GB', '32GB'] }, { name: 'SSD', values: ['1TB', '2TB'] }]);

addDetailProduct(CAT_LAPTOP, 'HP', 'HP Spectre x360 14 2024', 39990000,
  { 'Chip': 'Intel Core Ultra 7 155H', 'Màn hình': '14" 2.8K OLED Touch 120Hz', 'Gập': 'Xoay 360 độ, tương thích bút HP Tilt Pen', 'Âm thanh': 'Bang & Olufsen Spatial Audio', 'Trọng lượng': '1.56 kg' },
  [{ name: 'Màu sắc', values: ['Nightfall Black', 'Nocturne Blue'] }, { name: 'RAM', values: ['16GB', '32GB'] }, { name: 'SSD', values: ['512GB', '1TB'] }]);

addDetailProduct(CAT_LAPTOP, 'HP', 'HP Victus 15 2024', 22990000,
  { 'CPU': 'Intel Core i7-13700H', 'VGA': 'NVIDIA RTX 4060 8GB', 'Màn hình': '15.6" FHD 144Hz 300 nits', 'Pin': '70Wh, sạc 200W', 'Camera': 'HP Wide Vision HD 720p' },
  [{ name: 'Màu sắc', values: ['Performance Blue', 'Mica Silver'] }, { name: 'RAM', values: ['16GB', '32GB'] }, { name: 'Card đồ họa', values: ['RTX 4060'] }]);

addDetailProduct(CAT_LAPTOP, 'Acer', 'Acer Swift Go 14 2024', 21990000,
  { 'Chip': 'Intel Core Ultra 7 155U', 'Màn hình': '14" 2.8K OLED 120Hz 400 nits', 'Trọng lượng': '1.35 kg', 'Pin': '65Wh, sạc 65W USB-C', 'Webcam': '1440p QHD IR' },
  [{ name: 'Màu sắc', values: ['Steam Blue', 'Pure Silver'] }, { name: 'RAM', values: ['16GB', '32GB'] }, { name: 'SSD', values: ['512GB', '1TB'] }]);

// ── TABLET (8) ────────────────────────────────────────────────────────────────

addDetailProduct(CAT_TABLET, 'Apple', 'iPad Pro M4 11"', 28990000,
  { 'Chip': 'Apple M4 9-core CPU, 10-core GPU', 'Màn hình': '11" Ultra Retina XDR OLED 1600 nits', 'Dày': '5.3mm – mỏng nhất từ trước đến nay', 'Kết nối': 'Thunderbolt 4 / USB 4', 'Tương thích': 'Apple Pencil Pro, Magic Keyboard' },
  [{ name: 'Màu sắc', values: ['Space Black', 'Silver'] }, { name: 'Dung lượng', values: ['256GB', '512GB', '1TB'] }]);

addDetailProduct(CAT_TABLET, 'Apple', 'iPad Air M2 11"', 16990000,
  { 'Chip': 'Apple M2 8-core CPU', 'Màn hình': '11" Liquid Retina 500 nits True Tone', 'Camera trước': '12MP Center Stage Ultra Wide', 'Wifi': 'Wi-Fi 6E', 'Tương thích': 'Apple Pencil Pro, Magic Keyboard Folio' },
  [{ name: 'Màu sắc', values: ['Blue', 'Purple', 'Starlight', 'Space Gray'] }, { name: 'Dung lượng', values: ['128GB', '256GB'] }]);

addDetailProduct(CAT_TABLET, 'Apple', 'iPad mini 7', 13990000,
  { 'Chip': 'Apple A17 Pro', 'Màn hình': '8.3" Liquid Retina 500 nits True Tone', 'Camera sau': '12MP Wide OIS', 'Camera trước': '12MP Ultra Wide Center Stage', 'Tương thích': 'Apple Pencil Pro' },
  [{ name: 'Màu sắc', values: ['Blue', 'Purple', 'Starlight', 'Space Gray'] }, { name: 'Dung lượng', values: ['128GB', '256GB'] }]);

addDetailProduct(CAT_TABLET, 'Samsung', 'Samsung Galaxy Tab S10 Ultra', 25990000,
  { 'Chip': 'Snapdragon 8 Gen 3 for Galaxy', 'Màn hình': '14.6" Dynamic AMOLED 2X 120Hz 930 nits', 'Camera': '13MP + 8MP (sau) / 12MP + 12MP (trước)', 'Pin': '11.200 mAh, sạc 45W', 'Kháng nước': 'IP68, bút S-Pen tặng kèm' },
  [{ name: 'Màu sắc', values: ['Graphite', 'Platinum'] }, { name: 'Dung lượng', values: ['256GB', '512GB', '1TB'] }]);

addDetailProduct(CAT_TABLET, 'Samsung', 'Samsung Galaxy Tab S10+', 19990000,
  { 'Chip': 'Snapdragon 8 Gen 3 for Galaxy', 'Màn hình': '12.4" Dynamic AMOLED 2X 120Hz', 'Pin': '10.090 mAh, sạc 45W', 'Kháng nước': 'IP68', 'Tương thích': 'S-Pen, Book Cover Keyboard' },
  [{ name: 'Màu sắc', values: ['Graphite', 'Silver', 'Rose'] }, { name: 'Dung lượng', values: ['256GB', '512GB'] }]);

addDetailProduct(CAT_TABLET, 'Samsung', 'Samsung Galaxy Tab A9+', 5990000,
  { 'Chip': 'Snapdragon 695 5G', 'Màn hình': '11" FHD+ 90Hz LCD', 'Âm thanh': '4 loa Dolby Atmos', 'Pin': '7.040 mAh, sạc 15W', 'Chế độ': 'Samsung Kids Mode' },
  [{ name: 'Màu sắc', values: ['Graphite', 'Silver', 'Lavender'] }, { name: 'RAM', values: ['4GB', '8GB'] }]);

addDetailProduct(CAT_TABLET, 'Xiaomi', 'Xiaomi Pad 7', 9990000,
  { 'Chip': 'Snapdragon 7+ Gen 3', 'Màn hình': '11.2" 3.2K LCD 144Hz 900 nits', 'Pin': '8.850 mAh, sạc 45W', 'Âm thanh': '6 loa Dolby Atmos', 'Camera sau': '50MP' },
  [{ name: 'Màu sắc', values: ['Graphite Gray', 'Crisp Green', 'Mist Blue'] }, { name: 'RAM/SSD', values: ['8GB/128GB', '8GB/256GB', '12GB/256GB'] }]);

addDetailProduct(CAT_TABLET, 'Lenovo', 'Lenovo Tab P12 Pro', 11990000,
  { 'Chip': 'MediaTek Dimensity 9000', 'Màn hình': '12.6" AMOLED 2K 120Hz', 'Pin': '10.200 mAh, sạc 45W', 'Âm thanh': '4 loa JBL Dolby Atmos', 'Kháng nước': 'IP52' },
  [{ name: 'Màu sắc', values: ['Grayish Blue'] }, { name: 'RAM/SSD', values: ['8GB/256GB', '12GB/512GB'] }]);

// ── PC (5) ────────────────────────────────────────────────────────────────────

addDetailProduct(CAT_PC, 'Apple', 'Mac mini M4', 16990000,
  { 'Chip': 'Apple M4 10-core CPU, 10-core GPU', 'RAM': '16GB Unified Memory', 'Cổng': 'Thunderbolt 4 × 3, USB-A × 2, HDMI 2.1, RJ-45', 'Kích thước': '127 × 127 × 50 mm', 'Tiêu thụ điện': '20W – hiệu suất / W tốt nhất thị trường' },
  [{ name: 'SSD', values: ['256GB', '512GB', '1TB', '2TB'] }, { name: 'RAM', values: ['16GB', '32GB'] }]);

addDetailProduct(CAT_PC, 'Apple', 'iMac 24" M4', 39990000,
  { 'Chip': 'Apple M4 10-core CPU, 10-core GPU', 'Màn hình': '24" 4.5K Retina 500 nits True Tone', 'Camera': '12MP Center Stage Ultra Wide', 'Âm thanh': '6 loa Spatial Audio + 3 mic', 'Phụ kiện': 'Magic Keyboard + Magic Mouse cùng màu' },
  [{ name: 'Màu sắc', values: ['Blue', 'Green', 'Pink', 'Silver', 'Orange', 'Purple', 'Yellow'] }, { name: 'GPU', values: ['10-core GPU'] }, { name: 'SSD', values: ['256GB', '512GB'] }]);

addDetailProduct(CAT_PC, 'Asus', 'Asus ROG Strix G35 2024', 38990000,
  { 'CPU': 'Intel Core i9-14900KF', 'VGA': 'NVIDIA RTX 4070 Ti SUPER 16GB', 'RAM': '32GB DDR5 5600MHz', 'SSD': '2TB PCIe 4.0 NVMe', 'Nguồn': '850W 80 Plus Gold' },
  [{ name: 'Màu sắc', values: ['Gunmetal Gray'] }, { name: 'RAM', values: ['32GB', '64GB'] }, { name: 'Card đồ họa', values: ['RTX 4070', 'RTX 4080'] }]);

addDetailProduct(CAT_PC, 'Dell', 'Dell Alienware Aurora R16', 65990000,
  { 'CPU': 'Intel Core i9-14900KF', 'VGA': 'NVIDIA RTX 4090 24GB GDDR6X', 'RAM': '32GB DDR5 4800MHz', 'Tản nhiệt': 'Liquid Cooling 360mm', 'Thiết kế': 'Legend 3.0 Chassis, RGB 360°' },
  [{ name: 'Màu sắc', values: ['Dark Side of the Moon'] }, { name: 'RAM', values: ['32GB', '64GB'] }, { name: 'SSD', values: ['1TB', '2TB'] }]);

addDetailProduct(CAT_PC, 'Lenovo', 'Lenovo Legion Tower 7i Gen 9', 42990000,
  { 'CPU': 'Intel Core i9-14900KF', 'VGA': 'NVIDIA RTX 4080 Super 16GB', 'RAM': '32GB DDR5 5600MHz', 'Tản nhiệt': 'Liquid Cooling 240mm', 'RGB': 'Legion RGB Lighting, Kính cường lực' },
  [{ name: 'Màu sắc', values: ['Ghost White', 'Luna Grey'] }, { name: 'RAM', values: ['32GB', '64GB'] }, { name: 'SSD', values: ['1TB', '2TB'] }]);

// ── SMARTWATCH (5) ────────────────────────────────────────────────────────────

addDetailProduct(CAT_WATCH, 'Apple', 'Apple Watch Series 10', 10990000,
  { 'Chip': 'S10 SiP', 'Màn hình': 'Always-On Retina LTPO OLED 2000 nits', 'Sức khỏe': 'ECG, SpO2, Nhiệt độ da, Phát hiện ngủ ngáy', 'Pin': '18 giờ, sạc nhanh 0→80% / 45 phút', 'Kháng nước': 'IP6X / 50m WR' },
  [{ name: 'Màu sắc', values: ['Jet Black', 'Rose Gold', 'Silver', 'Natural Titanium'] }, { name: 'Kích thước', values: ['42mm', '46mm'] }, { name: 'Dây đeo', values: ['Sport Band', 'Sport Loop', 'Milanese Loop'] }]);

addDetailProduct(CAT_WATCH, 'Apple', 'Apple Watch Ultra 2', 20990000,
  { 'Vỏ': 'Titanium hàng không vũ trụ', 'Màn hình': 'Always-On Retina 3000 nits', 'Pin': 'Đến 36 giờ (100 giờ chế độ năng lượng thấp)', 'Kháng nước': '100m EN 13319', 'Chuẩn': 'MIL-STD 810H, IP6X bụi' },
  [{ name: 'Màu sắc', values: ['Natural Titanium', 'Black Titanium'] }, { name: 'Dây đeo', values: ['Alpine Loop', 'Trail Loop', 'Ocean Band'] }]);

addDetailProduct(CAT_WATCH, 'Samsung', 'Samsung Galaxy Watch 7', 8990000,
  { 'Chip': 'Exynos W1000 5-core', 'Màn hình': '1.5" Super AMOLED 2000 nits', 'Sức khỏe': 'BioActive Sensor, Body Composition, ECG', 'Pin': '500mAh – đến 40 giờ', 'Kháng nước': 'IP68 / 5ATM' },
  [{ name: 'Màu sắc', values: ['Cream', 'Green', 'Silver'] }, { name: 'Kích thước', values: ['40mm', '44mm'] }]);

addDetailProduct(CAT_WATCH, 'Samsung', 'Samsung Galaxy Watch Ultra', 16990000,
  { 'Vỏ': 'Titanium Grade 4', 'Màn hình': '1.47" Super AMOLED 3000 nits', 'Kháng nước': '10ATM / IP68 / MIL-STD 810H', 'Pin': '590mAh – đến 48 giờ', 'Sức khỏe': 'ECG, SpO2, Nhiệt độ, BioActive' },
  [{ name: 'Màu sắc', values: ['White', 'Gray', 'Yellow'] }, { name: 'Dây đeo', values: ['Marine Band', 'Trail Band'] }]);

addDetailProduct(CAT_WATCH, 'Xiaomi', 'Xiaomi Watch S4', 4990000,
  { 'Màn hình': '1.43" AMOLED 60Hz 600 nits', 'Pin': '515mAh – đến 15 ngày', 'Sức khỏe': 'SpO2, ECG, Căng thẳng, Nhiệt độ da', 'Thể thao': '150+ chế độ tập luyện, GPS đa băng tần', 'Kháng nước': '5ATM' },
  [{ name: 'Màu sắc', values: ['Black', 'Gold', 'Silver'] }, { name: 'Dây đeo', values: ['Rubber Band', 'Metal Band'] }]);

// =============================================================================
// THỰC THI SEED
// =============================================================================

async function seedFull() {
  try {
    console.log('🚀 Bắt đầu seed 45 sản phẩm mới...');

    // Xóa dữ liệu cũ — paranoid models (Product, ProductVariant, Category, Brand) phải dùng
    // force: true để hard-delete, tránh soft-delete gây lỗi unique slug/sku khi chạy lại
    await OrderItem.destroy({ where: {} });
    await CartItem.destroy({ where: {} });
    await ProductVariant.destroy({ where: {}, force: true });
    await ProductAttribute.destroy({ where: {} });
    await ProductSpecification.destroy({ where: {} });
    await Product.destroy({ where: {}, force: true });
    await Category.destroy({ where: {}, force: true });
    await Brand.destroy({ where: {}, force: true });

    // Tạo categories
    const categories = await Category.bulkCreate(
      [CAT_PHONE, CAT_LAPTOP, CAT_TABLET, CAT_PC, CAT_WATCH].map(n => ({
        name: n,
        slug: n.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, '-'),
        description: `Danh mục ${n}`,
      }))
    );

    // Tạo brands từ danh sách sản phẩm
    const brandNames = [...new Set(pList.map(p => p.brand))];
    const createdBrands = await Brand.bulkCreate(
      brandNames.map(n => ({ name: n, slug: n.toLowerCase().replace(/\s+/g, '-'), isActive: true }))
    );

    for (const p of pList) {
      const cat = categories.find(c => c.name === p.category);
      const b   = createdBrands.find(br => br.name === p.brand);

      const product = await Product.create({
        name:             p.name,
        brandId:          b?.id,
        categoryId:       cat?.id,
        model:            p.name,
        baseName:         p.name,
        basePrice:        p.basePrice,
        compareAtPrice:   Math.round(p.basePrice * 1.12),
        shortDescription: `${p.name} – ${p.category} cao cấp từ ${p.brand}.`,
        description:      `${p.name} mang đến trải nghiệm vượt trội với công nghệ tiên tiến nhất, thiết kế sang trọng và hiệu năng ổn định. Sản phẩm chính hãng, bảo hành 12 tháng toàn quốc.`,
        status:           'active',
        condition:        'new',
        visibility:       'public',
        isFeatured:       false,
        warrantyMonths:   12,
        specifications:   p.specifications,
        attributes:       p.attributes,
        shippingInfo:     { weight_g: 500, is_fragile: true, contains_battery: true },
        tags:             [p.brand.toLowerCase(), p.category.toLowerCase(), p.name.toLowerCase().replace(/\s+/g, '-')],
        seoTitle:         `${p.name} – Chính hãng, giá tốt | TechStore`,
        seoDescription:   `Mua ${p.name} chính hãng tại TechStore. Bảo hành 12 tháng, giao hàng toàn quốc, hỗ trợ trả góp 0%.`,
        seoKeywords:      [p.brand, p.name, p.category, 'chính hãng', 'giá tốt'],
      });

      if (cat) await product.setCategories([cat]);

      // Specifications
      let sortOrder = 0;
      for (const [name, value] of Object.entries(p.specifications)) {
        await ProductSpecification.create({
          productId: product.id,
          name,
          value,
          category:  getSpecCategory(name),
          sortOrder: sortOrder++,
        });
      }

      // Attributes
      for (const attr of p.attributes) {
        await ProductAttribute.create({
          productId: product.id,
          name:      attr.name,
          values:    attr.values,
        });
      }

      // Variants
      let totalStock = 0;
      for (const v of p.variants) {
        totalStock += v.stock;
        const randomSuffix = Math.random().toString(36).substr(2, 6).toUpperCase();
        await ProductVariant.create({
          productId:    product.id,
          sku:          `${p.brand.toUpperCase().replace(/\s/g, '')}-${randomSuffix}`,
          variantName:  v.name,
          displayName:  v.name,
          attributes:   v.attributes,
          price:        v.price,
          compareAtPrice: Math.round(v.price * 1.12),
          stockQuantity: v.stock,
          isDefault:    v.isDefault || false,
        });
      }

      await product.update({ soldCount: 0, viewCount: 0 });
      console.log(`  ✅ [${p.brand}] ${p.name} – ${p.variants.length} biến thể, ${Object.keys(p.specifications).length} thông số`);
    }

    console.log(`\n🎉 Hoàn tất! Đã seed ${pList.length} sản phẩm.`);
  } catch (err) {
    console.error('❌ Lỗi seed:', err);
  }
}

if (require.main === module) {
  seedFull().then(() => process.exit(0));
}

module.exports = { seedFull };
