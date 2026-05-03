import { ProductFormData } from '@/types';

export const sampleLaptopData: Partial<ProductFormData> = {
  // Thông tin co b?n
  name: 'MacBook Pro 16-inch M3 Max',
  slug: 'macbook-pro-16-inch-m3-max',
  shortDescription:
    'Laptop cao c?p v?i chip M3 Max m?nh m?, màn hình Liquid Retina XDR 16 inch, pin 22 gi?. Hoàn h?o cho chuyên gia sáng t?o và l?p trình viên.',
  description: `
    <h2>?? MacBook Pro 16-inch M3 Max - S?c m?nh vu?t tr?i cho chuyên gia</h2>
    <p>MacBook Pro 16-inch v?i chip M3 Max là d?nh cao c?a công ngh? Apple, du?c thi?t k? dành cho nh?ng chuyên gia dòi h?i hi?u nang t?i da.</p>
    
    <h3>? Hi?u nang d?t phá v?i chip M3 Max</h3>
    <p>Chip M3 Max v?i 16 nhân CPU và 40 nhân GPU mang l?i hi?u nang vu?t tr?i:</p>
    <ul>
      <li>X? lý video 8K ProRes mu?t mà</li>
      <li>Render 3D nhanh g?p 2.5 l?n th? h? tru?c</li>
      <li>Multitasking mu?t mà v?i hàng tram tab Chrome</li>
      <li>Compile code nhanh chóng v?i Xcode</li>
    </ul>
    
    <h3>??? Màn hình Liquid Retina XDR tuy?t d?p</h3>
    <p>Màn hình 16.2 inch v?i công ngh? mini-LED:</p>
    <ul>
      <li>Ð? phân gi?i 3456 x 2234 pixels</li>
      <li>Ð? sáng 1000 nits (1600 nits peak HDR)</li>
      <li>T? l? tuong ph?n 1,000,000:1</li>
      <li>H? tr? P3 wide color gamut</li>
      <li>ProMotion v?i t?n s? quét lên d?n 120Hz</li>
    </ul>
    
    <h3>?? Pin b?n b? c? ngày dài</h3>
    <p>Pin lithium-polymer 100Wh cung c?p:</p>
    <ul>
      <li>Lên d?n 22 gi? phát video</li>
      <li>18 gi? duy?t web không dây</li>
      <li>S?c nhanh v?i adapter 140W USB-C</li>
    </ul>
    
    <h3>?? Âm thanh d?nh cao</h3>
    <p>H? th?ng âm thanh 6 loa v?i:</p>
    <ul>
      <li>Woofers force-cancelling</li>
      <li>Âm thanh không gian v?i Dolby Atmos</li>
      <li>3 micro array v?i beamforming</li>
    </ul>
    
    <h3>?? K?t n?i da d?ng</h3>
    <ul>
      <li>3 c?ng Thunderbolt 4 (USB-C)</li>
      <li>1 c?ng HDMI</li>
      <li>1 khe th? SDXC</li>
      <li>1 c?ng MagSafe 3</li>
      <li>Jack tai nghe 3.5mm</li>
    </ul>
    
    <h3>??? B?o m?t t?i uu</h3>
    <ul>
      <li>Touch ID tích h?p</li>
      <li>Secure Enclave</li>
      <li>Camera FaceTime HD 1080p</li>
    </ul>
    
    <p><strong>Lý do ch?n MacBook Pro 16-inch M3 Max:</strong></p>
    <ul>
      <li>? Hi?u nang d?nh cao cho m?i tác v?</li>
      <li>? Màn hình chuyên nghi?p</li>
      <li>? Pin b?n b?</li>
      <li>? Thi?t k? premium</li>
      <li>? H? sinh thái Apple hoàn h?o</li>
    </ul>
  `,

  // Pricing
  basePrice: 89990000,
  salePrice: 84990000,
  costPrice: 75000000,
  onSale: true,

  // Inventory
  trackInventory: true,
  stockQuantity: 50,
  lowStockThreshold: 5,
  allowBackorder: false,
  weight: 2.16,
  length: 35.57,
  width: 24.81,
  height: 1.68,
  sku: 'MBP16-M3MAX-1TB-SG',

  // Status
  status: 'active',
  featured: true,
  tags: ['laptop', 'macbook', 'apple', 'm3-max', 'professional', 'creative'],

  // SEO
  metaTitle:
    'MacBook Pro 16-inch M3 Max - Laptop cao c?p cho chuyên gia | TechStore',
  metaDescription:
    'MacBook Pro 16-inch M3 Max v?i chip M3 Max m?nh m?, màn hình Liquid Retina XDR, pin 22 gi?. Giá t?t nh?t, b?o hành chính hãng. Mua ngay!',
  metaKeywords:
    'macbook pro 16, m3 max, laptop apple, macbook pro 2024, laptop cao c?p',

  // Shipping
  freeShipping: true,
  shippingClass: 'standard',

  // Warranty
  warrantyPeriod: 12,
  warrantyType: 'manufacturer',
  warrantyDescription: 'B?o hành chính hãng Apple 12 tháng toàn c?u',
};

export const sampleLaptopAttributes = [
  {
    groupName: 'Thông s? k? thu?t',
    attributes: [
      { name: 'Chip x? lý', value: 'Apple M3 Max (16-core CPU, 40-core GPU)' },
      { name: 'RAM', value: '36GB Unified Memory' },
      { name: '? c?ng', value: '1TB SSD' },
      { name: 'Màn hình', value: '16.2-inch Liquid Retina XDR (3456 x 2234)' },
      { name: 'Card d? h?a', value: '40-core GPU tích h?p' },
      { name: 'H? di?u hành', value: 'macOS Sonoma' },
      { name: 'Pin', value: '100Wh lithium-polymer' },
      { name: 'Tr?ng lu?ng', value: '2.16 kg' },
    ],
  },
  {
    groupName: 'K?t n?i',
    attributes: [
      {
        name: 'C?ng k?t n?i',
        value: '3x Thunderbolt 4, 1x HDMI, 1x SDXC, MagSafe 3',
      },
      { name: 'Wireless', value: 'Wi-Fi 6E, Bluetooth 5.3' },
      { name: 'Camera', value: '1080p FaceTime HD camera' },
      { name: 'Audio', value: '6-speaker system, 3-mic array' },
    ],
  },
  {
    groupName: 'Thi?t k?',
    attributes: [
      { name: 'Ch?t li?u', value: '100% recycled aluminum' },
      { name: 'Màu s?c', value: 'Space Gray, Silver' },
      { name: 'Bàn phím', value: 'Magic Keyboard with Touch ID' },
      { name: 'Trackpad', value: 'Force Touch trackpad' },
    ],
  },
];

export const sampleLaptopVariants = [
  {
    name: 'MacBook Pro 16" M3 Max - 36GB RAM - 1TB SSD - Space Gray',
    sku: 'MBP16-M3MAX-36GB-1TB-SG',
    price: 89990000,
    salePrice: 84990000,
    stockQuantity: 25,
    attributes: [
      { name: 'RAM', value: '36GB' },
      { name: 'Storage', value: '1TB SSD' },
      { name: 'Color', value: 'Space Gray' },
    ],
  },
  {
    name: 'MacBook Pro 16" M3 Max - 36GB RAM - 1TB SSD - Silver',
    sku: 'MBP16-M3MAX-36GB-1TB-SL',
    price: 89990000,
    salePrice: 84990000,
    stockQuantity: 25,
    attributes: [
      { name: 'RAM', value: '36GB' },
      { name: 'Storage', value: '1TB SSD' },
      { name: 'Color', value: 'Silver' },
    ],
  },
  {
    name: 'MacBook Pro 16" M3 Max - 48GB RAM - 2TB SSD - Space Gray',
    sku: 'MBP16-M3MAX-48GB-2TB-SG',
    price: 109990000,
    salePrice: 104990000,
    stockQuantity: 15,
    attributes: [
      { name: 'RAM', value: '48GB' },
      { name: 'Storage', value: '2TB SSD' },
      { name: 'Color', value: 'Space Gray' },
    ],
  },
  {
    name: 'MacBook Pro 16" M3 Max - 48GB RAM - 2TB SSD - Silver',
    sku: 'MBP16-M3MAX-48GB-2TB-SL',
    price: 109990000,
    salePrice: 104990000,
    stockQuantity: 15,
    attributes: [
      { name: 'RAM', value: '48GB' },
      { name: 'Storage', value: '2TB SSD' },
      { name: 'Color', value: 'Silver' },
    ],
  },
];

