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

const CAT_PHONE = 'Điện thoại';
const CAT_LAPTOP = 'Laptop';
const CAT_TABLET = 'Tablet';
const CAT_PC = 'PC';
const CAT_WATCH = 'Smartwatch';
const CAT_CLOCK = 'Đồng hồ';

function getSpecCategory(name) {
  const n = name.toLowerCase();
  if (['cpu', 'chip', 'ram', 'ổ cứng', 'ssd', 'gpu', 'vga', 'vi xử lý'].some(k => n.includes(k))) return 'Hiệu năng';
  if (['màn hình', 'độ sáng', 'tần số quét', 'oled', 'lcd', 'độ phân giải'].some(k => n.includes(k))) return 'Màn hình';
  if (['pin', 'sạc', 'dung lượng pin'].some(k => n.includes(k))) return 'Pin & Nguồn';
  if (['camera', 'selfie', 'quay phim', 'ống kính'].some(k => n.includes(k))) return 'Camera';
  if (['kháng nước', 'chống nước', 'độ sâu', 'ip68'].some(k => n.includes(k))) return 'Độ bền';
  return 'Thông số chung';
}

const DEFAULT_FAQS = [
  { question: 'Sản phẩm có chính hãng không?', answer: 'Cam kết hàng mới 100%, bảo hành chính hãng 12 tháng tại các trung tâm bảo hành toàn quốc.' },
  { question: 'Có hỗ trợ trả góp không?', answer: 'Hỗ trợ trả góp 0% qua thẻ tín dụng hoặc các công ty tài chính như HomeCredit, FE-Credit.' }
];

const pList = [];

function addDetailProduct(category, brand, name, basePrice, specs, attributes) {
  const variants = [];
  const generateCombos = (attrs, currentIdx, currentSelection) => {
    if (currentIdx === attrs.length) {
      const comboName = Object.values(currentSelection).join(' - ');
      let variantPrice = Number(basePrice);
      for (const [attrName, attrVal] of Object.entries(currentSelection)) {
        const val = attrVal.toLowerCase();
        if (val.includes('16gb') || val.includes('256gb')) variantPrice += 2000000;
        if (val.includes('32gb') || val.includes('512gb') || val.includes('m3 pro')) variantPrice += 5000000;
        if (val.includes('64gb') || val.includes('1tb') || val.includes('m3 max') || val.includes('ultra 7') || val.includes('rtx 4070')) variantPrice += 10000000;
        if (val.includes('2tb') || val.includes('rtx 4090')) variantPrice += 25000000;
      }
      variants.push({
        name: comboName, attributes: { ...currentSelection }, price: variantPrice, stock: Math.floor(Math.random() * 20) + 2
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
  pList.push({ category, brand, name, price: Number(basePrice), specifications: specs, attributes, variants });
}

// =============================================================================
// THỨ TỰ: [Màu sắc] ĐẦU TIÊN -> THÔNG SỐ CỰC CHI TIẾT (4-6 ITEMS)
// =============================================================================

// --- ĐIỆN THOẠI ---
addDetailProduct(CAT_PHONE, 'iPhone', 'iPhone 15 Pro Max', 34990000, 
  { 'Chip': 'Apple A17 Pro 6-core', 'Màn hình': '6.7" Super Retina XDR', 'Camera': 'Chính 48MP, Phụ 12MP, 12MP', 'Pin': '4.441 mAh (20W)', 'HĐH': 'iOS 17' }, 
  [{ name: 'Màu sắc', values: ['Titan Tự Nhiên', 'Titan Xanh'] }, { name: 'Dung lượng', values: ['256GB', '512GB', '1TB'] }]);

addDetailProduct(CAT_PHONE, 'iPhone', 'iPhone 14 Pro', 24990000, 
  { 'Chip': 'Apple A16 Bionic', 'Màn hình': '6.1" OLED 120Hz', 'Camera sau': '48MP + 12MP + 12MP', 'Selfie': '12MP', 'Pin': '3.200 mAh' }, 
  [{ name: 'Màu sắc', values: ['Tím', 'Vàng'] }, { name: 'Dung lượng', values: ['128GB', '256GB'] }]);

addDetailProduct(CAT_PHONE, 'Samsung', 'Samsung Galaxy S24 Ultra', 33990000, 
  { 'Chip': 'Snapdragon 8 Gen 3 for Galaxy', 'Màn hình': '6.8" QHD+ 120Hz', 'Camera': '200MP + 50MP + 12MP + 10MP', 'Pin': '5.000 mAh', 'Bút': 'S-Pen tích hợp' }, 
  [{ name: 'Màu sắc', values: ['Xám Titan', 'Đen Titan'] }, { name: 'Dung lượng', values: ['256GB', '512GB'] }]);

addDetailProduct(CAT_PHONE, 'Samsung', 'Samsung Galaxy Z Fold 5', 39990000, 
  { 'Chip': 'Snapdragon 8 Gen 2', 'Màn hình chính': '7.6" Dynamic AMOLED', 'Màn hình phụ': '6.2"', 'Pin': '4.400 mAh', 'Gấp mở': 'Bản lề Flex' }, 
  [{ name: 'Màu sắc', values: ['Xanh Icy', 'Kem'] }, { name: 'Dung lượng', values: ['256GB', '512GB'] }]);

addDetailProduct(CAT_PHONE, 'Xiaomi', 'Xiaomi 14 Ultra', 31990000, 
  { 'Chip': 'Snapdragon 8 Gen 3', 'Ống kính': 'Leica Summilux', 'Màn hình': '6.73" WQHD+ 120Hz', 'Pin': '5.000 mAh', 'Sạc': '90W' }, 
  [{ name: 'Màu sắc', values: ['Đen Da', 'Trắng Gốm'] }, { name: 'RAM', values: ['12GB', '16GB'] }]);

addDetailProduct(CAT_PHONE, 'Xiaomi', 'Xiaomi 13T Pro', 14990000, 
  { 'Chip': 'Dimensity 9200+', 'Màn hình': '6.67" AMOLED 144Hz', 'Camera': 'Leica 50MP', 'Kháng nước': 'IP68', 'Sạc': '120W HyperCharge' }, 
  [{ name: 'Màu sắc', values: ['Xanh Alpine', 'Đen'] }, { name: 'Dung lượng', values: ['256GB', '512GB'] }]);

addDetailProduct(CAT_PHONE, 'Realme', 'Realme 12 Pro+', 10990000, 
  { 'Chip': 'Snapdragon 7s Gen 2', 'Camera': '64MP Periscope Portrait', 'Màn hình': '6.7" OLED 120Hz', 'Sạc': '67W SUPERVOOC', 'RAM': '12GB' }, 
  [{ name: 'Màu sắc', values: ['Xanh Đậm', 'Vàng Cát'] }, { name: 'Bộ nhớ', values: ['256GB', '512GB'] }]);

addDetailProduct(CAT_PHONE, 'Realme', 'Realme C67', 4290000, 
  { 'Chip': 'Snapdragon 685', 'Camera': '108MP Dual', 'Màn hình': '6.72" 90Hz', 'Pin': '5000 mAh', 'Loa': 'Stereo' }, 
  [{ name: 'Màu sắc', values: ['Xanh', 'Đen'] }, { name: 'RAM', values: ['8GB', '12GB'] }]);

addDetailProduct(CAT_PHONE, 'Oppo', 'Oppo Find X7 Ultra', 26990000, 
  { 'Chip': 'Snapdragon 8 Gen 3', 'Màn hình': '6.82" AMOLED 2500 nits', 'Camera': 'Quad-Core 50MP', 'Zoom': '120x Ultra Image', 'HĐH': 'ColorOS 14' }, 
  [{ name: 'Màu sắc', values: ['Nâu', 'Xanh'] }, { name: 'Dung lượng', values: ['256GB', '512GB'] }]);

addDetailProduct(CAT_PHONE, 'Oppo', 'Oppo Reno11 Pro', 15990000, 
  { 'Chip': 'Dimensity 8200', 'Camera': '50MP Sony IMX890', 'Màn hình': '6.7" Curved 120Hz', 'Sạc': '80W SUPERVOOC', 'Mỏng': '7.59mm' }, 
  [{ name: 'Màu sắc', values: ['Trắng Trai', 'Xám'] }, { name: 'RAM/SSD', values: ['12GB/256GB', '12GB/512GB'] }]);

addDetailProduct(CAT_PHONE, 'Vivo', 'Vivo X100 Pro', 23990000, 
  { 'Chip': 'Dimensity 9300', 'Hệ thống Camera': 'ZEISS APO 50MP', 'Màn hình': '6.78" 1.5K 120Hz', 'Pin': '5.400 mAh', 'Kháng nước': 'IP68' }, 
  [{ name: 'Màu sắc', values: ['Cam', 'Xanh'] }, { name: 'Dung lượng', values: ['256GB', '512GB'] }]);

addDetailProduct(CAT_PHONE, 'Vivo', 'Vivo V30 Pro', 13990000, 
  { 'Chip': 'Dimensity 8200', 'Màn hình': '6.78" 1.5K AMOLED', 'Sáng': '2800 nits', 'Portrait': 'Aura Light 3.0', 'Dày': '7.45mm' }, 
  [{ name: 'Màu sắc', values: ['Trắng', 'Đen'] }, { name: 'RAM', values: ['12GB', '16GB'] }]);

// --- LAPTOP ---
addDetailProduct(CAT_LAPTOP, 'Macbook', 'MacBook Air M3 13"', 27990000, 
  { 'Chip': 'Apple M3 8-core CPU, 10-core GPU', 'Màn hình': '13.6" Liquid Retina', 'Wifi': 'Wi-Fi 6E', 'Microphone': '3 mic input', 'Khối lượng': '1.24 kg' }, 
  [{ name: 'Màu sắc', values: ['Midnight', 'Starlight', 'Silver'] }, { name: 'RAM', values: ['8GB', '16GB'] }, { name: 'SSD', values: ['256GB', '512GB'] }]);

addDetailProduct(CAT_LAPTOP, 'Macbook', 'MacBook Pro 14" M3 Pro', 49990000, 
  { 'Chip': 'Apple M3 Pro / M3 Max', 'Màn hình': '14.2" Liquid Retina XDR', 'Tần số': '120Hz ProMotion', 'Pin': 'Đến 22 giờ', 'Âm thanh': '6 loa' }, 
  [{ name: 'Màu sắc', values: ['Space Black', 'Silver'] }, { name: 'RAM', values: ['18GB', '36GB'] }, { name: 'Chip', values: ['M3 Pro', 'M3 Max'] }]);

addDetailProduct(CAT_LAPTOP, 'Dell', 'Dell XPS 16 9640', 59990000, 
  { 'Chip': 'Intel Core Ultra 7 155H', 'Màn hình': '16.3" 4K+ OLED Touch', 'VGA': 'RTX 4060 8GB', 'Bàn phím': 'Lattice Keyboard', 'Trọng lượng': '2.2 kg' }, 
  [{ name: 'Màu sắc', values: ['Platinum', 'Graphite'] }, { name: 'RAM', values: ['16GB', '32GB'] }, { name: 'SSD', values: ['512GB', '1TB'] }]);

addDetailProduct(CAT_LAPTOP, 'Dell', 'Dell Inspiron 16 5630', 19990000, 
  { 'Chip': 'Intel Core i5-1340P', 'Màn hình': '16" FHD+ WVA', 'Độ phân giải': '1920x1200', 'Vỏ': 'Nhôm', 'Bảo mật': 'Vân tay' }, 
  [{ name: 'Màu sắc', values: ['Silver'] }, { name: 'RAM', values: ['8GB', '16GB'] }, { name: 'Chip', values: ['Core i5', 'Core i7'] }]);

addDetailProduct(CAT_LAPTOP, 'Asus', 'Asus ROG Zephyrus G16', 45990000, 
  { 'Chip': 'Intel Core Ultra 9 185H', 'VGA': 'RTX 4070 8GB GDDR6', 'Màn hình': '16" OLED 2.5K 240Hz', 'Tản nhiệt': '3 quạt Tri-fan', 'Trọng lượng': '1.85 kg' }, 
  [{ name: 'Màu sắc', values: ['Xám Eclipse', 'Trắng Platinum'] }, { name: 'RAM', values: ['16GB', '32GB'] }, { name: 'Card đồ họa', values: ['RTX 4060', 'RTX 4070'] }]);

addDetailProduct(CAT_LAPTOP, 'Asus', 'Asus Zenbook 14 OLED', 25990000, 
  { 'Chip': 'Intel Core Ultra 7', 'Màn hình': '14" 3K OLED 120Hz', 'Sáng': '600 nits', 'Pin': '75Wh', 'Âm thanh': 'Harman Kardon' }, 
  [{ name: 'Màu sắc', values: ['Xanh Ponder', 'Bạc Sương'] }, { name: 'RAM/SSD', values: ['16GB/512GB', '32GB/1TB'] }]);

addDetailProduct(CAT_LAPTOP, 'Acer', 'Acer Predator Helios Neo 16', 34990000, 
  { 'CPU': 'Intel Core i7-13700HX', 'VGA': 'RTX 4060 8GB', 'Màn hình': '16" WQXGA 165Hz', 'Tản nhiệt': 'Kim loại lỏng AeroBlade', 'Phím': 'RGB 4 vùng' }, 
  [{ name: 'Màu sắc', values: ['Đen Phantom'] }, { name: 'RAM', values: ['16GB', '32GB'] }, { name: 'SSD', values: ['512GB', '1TB'] }]);

addDetailProduct(CAT_LAPTOP, 'Acer', 'Acer Swift Go 14', 20990000, 
  { 'Chip': 'Intel Core Ultra 5 / 7', 'Màn hình': '14" OLED 2.8K 90Hz', 'Webcam': '1440p QHD', 'Touchpad': 'Đa điểm', 'Pin': 'Đến 10 giờ' }, 
  [{ name: 'Màu sắc', values: ['Bạc Space', 'Hồng'] }, { name: 'RAM', values: ['16GB'] }, { name: 'Chip', values: ['Ultra 5', 'Ultra 7'] }]);

addDetailProduct(CAT_LAPTOP, 'HP', 'HP Victus 16 2024', 21990000, 
  { 'CPU': 'Intel Core i5-13500H', 'VGA': 'RTX 4050 6GB', 'Màn hình': '16.1" FHD 144Hz', 'Pin': '70Wh', 'Camera': 'HD 720p' }, 
  [{ name: 'Màu sắc', values: ['Xám Mica', 'Xanh Blue'] }, { name: 'RAM', values: ['8GB', '16GB'] }, { name: 'Card đồ họa', values: ['RTX 4050', 'RTX 4060'] }]);

addDetailProduct(CAT_LAPTOP, 'HP', 'HP Spectre x360 14', 38990000, 
  { 'Chip': 'Intel Core Ultra 7-155H', 'Màn hình': '14" 2.8K OLED Touch 120Hz', 'Gập': 'Xoay 360 độ', 'Loa': 'Poly Audio', 'Bảo mật': 'Nhận diện khuôn mặt' }, 
  [{ name: 'Màu sắc', values: ['Đen Đêm', 'Xanh Biển'] }, { name: 'RAM', values: ['16GB', '32GB'] }, { name: 'SSD', values: ['512GB', '1TB'] }]);

addDetailProduct(CAT_LAPTOP, 'Lenovo', 'Lenovo Legion Slim 5', 29990000, 
  { 'CPU': 'AMD Ryzen 7-7840HS', 'VGA': 'RTX 4060 8GB', 'Màn hình': '16" WQXGA 165Hz', 'AI': 'Lenovo AI Engine+', 'Tản': 'ColdFront 5.0' }, 
  [{ name: 'Màu sắc', values: ['Xám Storm'] }, { name: 'RAM', values: ['16GB', '32GB'] }, { name: 'SSD', values: ['512GB', '1TB'] }]);

addDetailProduct(CAT_LAPTOP, 'Lenovo', 'Lenovo Yoga 7i Gen 9', 21990000, 
  { 'Chip': 'Intel Core Ultra 5 / 7', 'Màn hình': '14" OLED 2.8K Touch', 'Hỗ trợ': 'Bút cảm ứng S-Pen', 'Vỏ': 'Kim loại nguyên khối', 'Âm thanh': 'Dolby Atmos' }, 
  [{ name: 'Màu sắc', values: ['Xanh Teal', 'Xám Storm'] }, { name: 'RAM', values: ['16GB'] }, { name: 'Chip', values: ['Core Ultra 5', 'Core Ultra 7'] }]);

// --- TABLET ---
addDetailProduct(CAT_TABLET, 'iPad', 'iPad Pro M4', 28990000, 
  { 'Chip': 'Apple M4 9-core', 'Màn hình': 'Ultra Retina XDR OLED', 'Độ sáng': '1600 nits', 'Dày': '5.1mm', 'Kết nối': 'Thunderbolt 4' }, 
  [{ name: 'Màu sắc', values: ['Space Black', 'Silver'] }, { name: 'Dung lượng', values: ['256GB', '512GB'] }, { name: 'Kích thước', values: ['11 inch', '13 inch'] }]);

addDetailProduct(CAT_TABLET, 'iPad', 'iPad Air M2', 16990000, 
  { 'Chip': 'Apple M2 8-core', 'Màn hình': 'Liquid Retina Display', 'Camera': '12MP Center Stage', 'Wifi': 'Wifi 6', 'Loa': 'Stereo' }, 
  [{ name: 'Màu sắc', values: ['Xanh', 'Tím', 'Xám Space', 'Vàng Starlight'] }, { name: 'Dung lượng', values: ['128GB', '256GB'] }]);

addDetailProduct(CAT_TABLET, 'Samsung', 'Samsung Galaxy Tab S9 Ultra', 23990000, 
  { 'Chip': 'Snapdragon 8 Gen 2 for Galaxy', 'Màn hình': '14.6" Dynamic AMOLED 2X', 'Pin': '11.200 mAh', 'Kháng nước': 'IP68', 'Phụ kiện': 'Bút S-Pen tặng kèm' }, 
  [{ name: 'Màu sắc', values: ['Xám Graphite', 'Bạc'] }, { name: 'Bộ nhớ', values: ['256GB', '512GB'] }, { name: 'Kết nối', values: ['WiFi Only', 'Hỗ trợ 5G'] }]);

addDetailProduct(CAT_TABLET, 'Samsung', 'Samsung Galaxy Tab A9+', 5990000, 
  { 'Chip': 'Snapdragon 695', 'Màn hình': '11" 90Hz LCD', 'Âm thanh': 'Quad Speakers Dolby Atmos', 'Kids': 'Samsung Kids Mode', 'Vỏ': 'Kim loại' }, 
  [{ name: 'Màu sắc', values: ['Đen', 'Bạc'] }, { name: 'Bộ nhớ', values: ['64GB', '128GB'] }]);

addDetailProduct(CAT_TABLET, 'Xiaomi', 'Xiaomi Pad 6', 8990000, 
  { 'Chip': 'Snapdragon 870', 'Màn hình': '11" WQHD+ 144Hz', 'Pin': '8840 mAh', 'Sạc': '33W', 'Camera': '13MP sau, 8MP trước' }, 
  [{ name: 'Màu sắc', values: ['Xanh Dương', 'Đen'] }, { name: 'RAM/SSD', values: ['8GB/128GB', '8GB/256GB'] }]);

addDetailProduct(CAT_TABLET, 'Xiaomi', 'Xiaomi Pad SE', 4490000, 
  { 'Chip': 'Snapdragon 680', 'Màn hình': '11" FHD+ 90Hz', 'Pin': '8000 mAh', 'Bảo vệ mắt': 'TUV Rheinland', 'Chất liệu': 'Hợp kim nhôm' }, 
  [{ name: 'Màu sắc', values: ['Xanh', 'Xám'] }, { name: 'Dung lượng', values: ['128GB', '256GB'] }]);

addDetailProduct(CAT_TABLET, 'Oppo', 'Oppo Pad 2', 12990000, 
  { 'Chip': 'Dimensity 9000', 'Màn hình': '11.61" 144Hz', 'Tỷ lệ': '7:5', 'Pin': '9510 mAh', 'Sạc': '67W' }, 
  [{ name: 'Màu sắc', values: ['Xám Tinh Vân'] }, { name: 'RAM/Storage', values: ['8GB/256GB', '12GB/512GB'] }]);

addDetailProduct(CAT_TABLET, 'Oppo', 'Oppo Pad Neo', 7990000, 
  { 'Chip': 'Helio G99', 'Màn hình': '11.4" 2.4K 90Hz', 'Pin': '8000 mAh', 'Âm thanh': 'Hi-Res Dolby Atmos', 'Mắt': 'Blue Light Filter' }, 
  [{ name: 'Màu sắc', values: ['Xám Carbon'] }, { name: 'Kết nối', values: ['WiFi Only', 'WiFi + 4G LTE'] }]);

addDetailProduct(CAT_TABLET, 'Lenovo', 'Lenovo Tab P12', 9490000, 
  { 'Chip': 'MediaTek Dimensity 7050', 'Màn hình': '12.7" 3K LCD', 'Dung lượng pin': '10.200 mAh', 'Tiện ích': 'Chế độ đọc sách', 'Âm': '4 loa JBL' }, 
  [{ name: 'Màu sắc', values: ['Xám'] }, { name: 'Bộ nhớ', values: ['128GB', '256GB'] }]);

addDetailProduct(CAT_TABLET, 'Lenovo', 'Lenovo Tab M11', 5290000, 
  { 'Chip': 'Helio G88', 'Màn hình': '11" 90Hz', 'Hỗ trợ': 'Bút Tab Pen', 'Kháng bụi': 'IP52', 'Âm': 'Dolby Atmos' }, 
  [{ name: 'Màu sắc', values: ['Xám'] }, { name: 'RAM', values: ['4GB', '8GB'] }, { name: 'Bộ nhớ', values: ['64GB', '128GB'] }]);

// --- PC ---
addDetailProduct(CAT_PC, 'iMac', 'iMac 24" M3', 36990000, 
  { 'Chip': 'Apple M3 8-core CPU', 'GPU': '8-core / 10-core GPU', 'Màn hình': '4.5K Retina 24 inch', 'Camera': '1080p FaceTime', 'Phụ kiện': 'Magic Keyboard/Mouse cùng màu' }, 
  [{ name: 'Màu sắc', values: ['Xanh Dương', 'Hồng', 'Bạc', 'Xanh Lá'] }, { name: 'RAM', values: ['8GB', '16GB'] }, { name: 'GPU', values: ['8-core', '10-core'] }]);

addDetailProduct(CAT_PC, 'iMac', 'Mac mini M2', 14990000, 
  { 'Chip': 'Apple M2', 'Cổng': 'Thunderbolt 4, HDMI, USB-A', 'Kết nối': 'Ethernet 10Gb option', 'Khối lượng': '1.18 kg', 'Thiết kế': 'Ultra Compact' }, 
  [{ name: 'Màu sắc', values: ['Bạc'] }, { name: 'RAM', values: ['8GB', '16GB'] }, { name: 'SSD', values: ['256GB', '512GB'] }]);

addDetailProduct(CAT_PC, 'Asus', 'ROG Strix G16CH', 35990000, 
  { 'CPU': 'Intel Core i5 / i7 Gen 13', 'VGA': 'RTX 4060 8GB', 'RAM': 'Up to 32GB DDR4', 'Nguồn': '500W / 700W', 'Tản': 'Air-cooled / Liquid-cooled' }, 
  [{ name: 'Màu sắc', values: ['Đen Phantom'] }, { name: 'Chip', values: ['Core i5', 'Core i7'] }, { name: 'RAM', values: ['16GB', '32GB'] }]);

addDetailProduct(CAT_PC, 'Asus', 'Asus ExpertCenter D5', 12990000, 
  { 'CPU': 'Intel Core i3 / i5 Gen 13', 'Case': 'Small Form Factor', 'Mainboard': 'Intel B760', 'Bảo mật': 'TPM 2.0', 'Cổng': 'VGA, HDMI, DisplayPort' }, 
  [{ name: 'Màu sắc', values: ['Đen'] }, { name: 'CPU', values: ['Core i3', 'Core i5'] }, { name: 'RAM', values: ['8GB', '16GB'] }]);

addDetailProduct(CAT_PC, 'MSI', 'MSI MEG Trident X2', 89990000, 
  { 'CPU': 'Intel Core i9-13900K', 'VGA': 'RTX 4090 24GB GDDR6X', 'Cảm ứng': 'HMI 2.0 Touch Screen', 'Tản nhiệt': 'Silent Storm Cooling 3', 'Nguồn': '1000W 80 Plus Gold' }, 
  [{ name: 'Màu sắc', values: ['Đen'] }, { name: 'RAM', values: ['32GB', '64GB'] }, { name: 'SSD', values: ['1TB', '2TB'] }]);

addDetailProduct(CAT_PC, 'MSI', 'MSI MPG Infinite X2', 64990000, 
  { 'CPU': 'Intel Core i7-13700K / i9-13900K', 'VGA': 'RTX 4070 / 4080', 'Kính': 'Cường lực 4mm', 'Wifi': 'Wifi 6E', 'RAM': '64GB max' }, 
  [{ name: 'Màu sắc', values: ['Đen'] }, { name: 'Chip', values: ['i7-13700K', 'i9-13900K'] }, { name: 'RAM', values: ['32GB'] }]);

addDetailProduct(CAT_PC, 'Gigabyte', 'Gigabyte Aorus Model S', 45990000, 
  { 'CPU': 'Intel Core i7-12700K', 'VGA': 'RTX 3070 / 3080', 'Dung tích': '14 lít', 'Tản nhiệt': 'SFF Custom Liquid', 'Cổng': 'Multi USB-C' }, 
  [{ name: 'Màu sắc', values: ['Đen'] }, { name: 'Card đồ họa', values: ['RTX 3070', 'RTX 3080'] }, { name: 'SSD', values: ['1TB', '2TB'] }]);

addDetailProduct(CAT_PC, 'Gigabyte', 'Gigabyte Brix Extreme', 15990000, 
  { 'CPU': 'AMD Ryzen 7 5700U', 'Case': 'NUC Compact', 'Video': 'Quad Display Output', 'LAN': '2.5G Ethernet', 'Kích thước': '196 x 44 x 140 mm' }, 
  [{ name: 'Màu sắc', values: ['Xám Gunmetal'] }, { name: 'RAM', values: ['16GB', '32GB'] }, { name: 'SSD', values: ['512GB', '1TB'] }]);

// --- WATCH ---
addDetailProduct(CAT_WATCH, 'Apple Watch', 'Apple Watch Ultra 2', 19990000, 
  { 'Màn hình': 'Always-On Retina 3000 nits', 'Vỏ': 'Titanium cấp hàng không', 'Độ bền': 'MIL-STD 810H', 'Pin': 'Đến 36 giờ', 'Chống nước': '100m' }, 
  [{ name: 'Màu sắc', values: ['Cam Carbon', 'Xanh Biển'] }, { name: 'Loại dây', values: ['Alpine Loop', 'Trail Loop', 'Ocean Band'] }]);

addDetailProduct(CAT_WATCH, 'Apple Watch', 'Apple Watch Series 9', 10490000, 
  { 'Chip': 'S9 SiP Double Tap', 'Màn hình': '2000 nits Always-On', 'Health': 'SpO2, ECG, Heart Rate', 'SOS': 'Phát hiện va chạm', 'Pin': '18 giờ' }, 
  [{ name: 'Màu sắc', values: ['Midnight', 'Starlight', 'Silver'] }, { name: 'Kích thước', values: ['41mm', '45mm'] }, { name: 'Chất liệu dây', values: ['Silicon', 'Vải'] }]);

addDetailProduct(CAT_WATCH, 'Samsung', 'Galaxy Watch 6 Classic', 8990000, 
  { 'Màn hình': 'Sapphire Crystal AMOLED', 'Viền': 'Xoay vật lý (Physical Bezel)', 'Body': 'Thép không gỉ', 'Tính năng': 'Thành phần cơ thể BIA', 'Pin': 'Đến 40 giờ' }, 
  [{ name: 'Màu sắc', values: ['Đen', 'Bạc'] }, { name: 'Size', values: ['43mm', '47mm'] }, { name: 'Loại dây', values: ['Da Hybrid', 'Cao su'] }]);

addDetailProduct(CAT_WATCH, 'Samsung', 'Galaxy Watch 6', 5990000, 
  { 'Viền': 'Cảm ứng', 'Màn hình': 'Super AMOLED', 'Health': 'Huấn luyện giấc ngủ AI', 'Body': 'Nhôm Armor', 'Chống nước/bụi': 'IP68' }, 
  [{ name: 'Màu sắc', values: ['Vàng', 'Đen', 'Bạc'] }, { name: 'Size', values: ['40mm', '44mm'] }]);

addDetailProduct(CAT_WATCH, 'Huawei', 'Huawei Watch GT 4', 5490000, 
  { 'Màn hình': 'AMOLED 1.43"', 'Pin': 'Đến 14 ngày', 'Health': 'TruSeen 5.5+', 'Thể thao': '100+ chế độ tập luyện', 'Tương thích': 'Android & iOS' }, 
  [{ name: 'Màu sắc', values: ['Đen', 'Nâu Classic', 'Xanh Green'] }, { name: 'Size', values: ['41mm', '46mm'] }, { name: 'Loại dây', values: ['Dây Da', 'Dây Thép', 'Dây Cao su'] }]);

addDetailProduct(CAT_WATCH, 'Huawei', 'Huawei Watch Fit 3', 2990000, 
  { 'Màn hình': '1.82" AMOLED 1500 nits', 'Trọng lượng': '26g', 'Độ dày': '9.9mm', 'Health': 'Quản lý Calo', 'Pin': '10 ngày' }, 
  [{ name: 'Màu sắc', values: ['Trắng', 'Đen', 'Hồng', 'Xanh'] }, { name: 'Loại dây', values: ['Nylon', 'Leather', 'Fluoroelastomer'] }]);

addDetailProduct(CAT_WATCH, 'Garmin', 'Garmin Fenix 7 Pro', 21990000, 
  { 'Màn hình': 'MIP Sapphire Solar', 'Sạc': 'Năng lượng mặt trời', 'Pin': '37 ngày (Solar mode)', 'Bản đồ': 'TOPO Maps đa lục địa', 'Đèn': 'Đèn pin LED tích hợp' }, 
  [{ name: 'Màu sắc', values: ['Titanium / Black'] }, { name: 'Size', values: ['42mm', '47mm', '51mm'] }]);

addDetailProduct(CAT_WATCH, 'Garmin', 'Garmin Forerunner 265', 11690000, 
  { 'Màn hình': 'AMOLED', 'Gps': 'Đa băng tần GNSS', 'Tính năng': 'Sẵn sàng tập luyện (Training Readiness)', 'Pin': '15 ngày (Smartwatch mode)', 'Kính': 'Gorilla Glass 3' }, 
  [{ name: 'Màu sắc', values: ['Vàng', 'Đen', 'Trắng'] }, { name: 'Size', values: ['S (42mm)', 'Tiêu chuẩn (46mm)'] }]);

// --- CLOCK ---
addDetailProduct(CAT_CLOCK, 'Citizen', 'Citizen Tsuyosa', 9500000, 
  { 'Bộ máy': 'Automatic 8210 (Cơ)', 'Đường kính': '40mm', 'Mặt số': 'Thiết kế tối giản', 'Kính': 'Sapphire chống trầy', 'Chống nước': '50m' }, 
  [{ name: 'Màu mặt số', values: ['Tiffany Blue', 'Forest Green', 'Black'] }, { name: 'Loại dây', values: ['Dây Thép', 'Dây Da'] }]);

addDetailProduct(CAT_CLOCK, 'Citizen', 'Citizen Eco-Drive Diver', 8500000, 
  { 'Bộ máy': 'Eco-Drive (Năng lượng mặt trời)', 'Đường kính': '44mm', 'Viền': 'Xoay 1 chiều', 'Kim': 'Dạ quang siêu sáng', 'Chuyên dụng': 'Diver 200m' }, 
  [{ name: 'Màu mặt', values: ['Xanh Dương', 'Đen'] }, { name: 'Loại dây', values: ['Dây Cao su', 'Dây Thép'] }]);

addDetailProduct(CAT_CLOCK, 'Orient', 'Orient Sun & Moon Gen 4', 10200000, 
  { 'Bộ máy': 'Automatic (Cơ tự động)', 'Chức năng': 'Sun & Moon AM/PM', 'Đường kính': '42.5mm', 'Kính': 'Sapphire cong', 'Vỏ': 'Thép mạ PVD' }, 
  [{ name: 'Màu mặt số', values: ['Trắng', 'Xanh'] }, { name: 'Loại dây', values: ['Dây Da', 'Dây Thép'] }]);

addDetailProduct(CAT_CLOCK, 'Orient', 'Orient Bambino Gen 2', 5600000, 
  { 'Bộ máy': 'F6724 (Cơ)', 'Kính': 'Crystal Domed (Kính cong)', 'Phong cách': 'Dress Watch cổ điển', 'Đường kính': '40.5mm', 'Chống nước': '30m' }, 
  [{ name: 'Màu mặt số', values: ['Kem', 'Trắng'] }, { name: 'Size', values: ['38mm', '41mm'] }]);

addDetailProduct(CAT_CLOCK, 'Casio', 'Casio G-Shock GA-2100', 3200000, 
  { 'Cấu trúc': 'Carbon Core Guard', 'Kích thước': '48.5 x 45.4 mm', 'Độ dày': '11.8 mm', 'Tính năng': 'Chống sốc, Giờ thế giới, Đèn LED đôi', 'Pin': '3 năm' }, 
  [{ name: 'Màu sắc', values: ['Đen phối trắng', 'Vàng Neon', 'Đỏ'] }, { name: 'Loại máy', values: ['Quartz (Pin)', 'Tough Solar (Năng lượng)'] }]);

addDetailProduct(CAT_CLOCK, 'Casio', 'Casio Edifice EFR-571', 4500000, 
  { 'Bộ máy': 'Quartz Chronograph', 'Độ phân giải': 'Bấm giờ 1/10 giây', 'Kính': 'Mineral Glass', 'Đường kính': '47.1mm', 'Chống nước': '100m' }, 
  [{ name: 'Màu mặt', values: ['Xanh Ray', 'Đen Carbon'] }, { name: 'Loại dây', values: ['Dây Thép đúc', 'Dây Da'] }]);

// SEED EXEC
async function seedFull() {
  try {
    console.log('🚀 SEEDING FINAL: ĐẦY ĐỦ THÔNG SỐ (4-6 ITEMS) & THỨ TỰ [MÀU SẮC] ĐỨNG ĐẦU...');
    await OrderItem.destroy({ where: {} }); await CartItem.destroy({ where: {} });
    await ProductVariant.destroy({ where: {} }); await ProductAttribute.destroy({ where: {} });
    await ProductSpecification.destroy({ where: {} }); await Product.destroy({ where: {} });
    await Category.destroy({ where: {} }); await Brand.destroy({ where: {} });

    const categories = await Category.bulkCreate([CAT_PHONE, CAT_LAPTOP, CAT_TABLET, CAT_PC, CAT_WATCH, CAT_CLOCK].map(n => ({
      name: n, slug: n.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, '-'), description: `Danh mục ${n}`
    })));

    const brandNames = [...new Set(pList.map(p => p.brand))];
    const createdBrands = await Brand.bulkCreate(brandNames.map(n => ({ name: n, slug: n.toLowerCase().replace(/\s+/g, '-'), isActive: true })));

    for (const p of pList) {
      const cat = categories.find(c => c.name === p.category);
      const b = createdBrands.find(br => br.name === p.brand);
      
      const product = await Product.create({
        name: p.name, brandId: b?.id, model: p.name, price: p.price, compareAtPrice: p.price * 1.15,
        description: `Sản phẩm ${p.name} hiện đại, sang trọng, mang lại trải nghiệm đỉnh cao cho người dùng.`, 
        shortDescription: `${p.name} thuộc dòng ${p.category} cao cấp từ ${p.brand}.`,
        thumbnail: `https://via.placeholder.com/400?text=${encodeURIComponent(p.name)}`,
        status: 'active', sku: `SKU-${Math.random().toString(36).substr(2, 6).toUpperCase()}`, inStock: true, condition: 'new', baseName: p.name, isVariantProduct: true, faqs: DEFAULT_FAQS,
        specifications: p.specifications // Populate JSON field
      });
      if (cat) await product.setCategories([cat]);

      for (const [name, value] of Object.entries(p.specifications)) {
        await ProductSpecification.create({ productId: product.id, name, value, category: getSpecCategory(name), sortOrder: 0 });
      }

      for (const attr of p.attributes) {
        await ProductAttribute.create({ productId: product.id, name: attr.name, values: attr.values });
      }

      let totalStock = 0;
      for (const v of p.variants) {
        totalStock += v.stock;
        await ProductVariant.create({
          productId: product.id, name: v.name, displayName: v.name, sku: `${product.sku}-${Math.random().toString(36).substr(2, 4).toUpperCase()}`,
          attributes: v.attributes, price: v.price, stockQuantity: v.stock, isDefault: v.isDefault || false, isAvailable: true
        });
      }
      await product.update({ stockQuantity: totalStock, inStock: totalStock > 0 });
      console.log(`✅ [${p.brand}] ${p.name} (${p.variants.length} v, ${Object.keys(p.specifications).length} specs)`);
    }
    console.log(`🎉 HOÀN TẤT NẠP DỮ LIỆU ĐA DẠNG THÔNG SỐ KỸ THUẬT!`);
  } catch (err) { console.error('❌ LỖI:', err); }
}

seedFull().then(() => process.exit(0));
