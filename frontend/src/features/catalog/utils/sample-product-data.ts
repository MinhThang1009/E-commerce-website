export const SAMPLE_LAPTOP_DATA: Record<string, unknown> = {
  // Thông tin cơ bản
  name: 'MacBook Pro 16-inch M3 Max',
  slug: 'macbook-pro-16-inch-m3-max',
  shortDescription:
    'Laptop cao cấp với chip M3 Max mạnh mẽ, màn hình Liquid Retina XDR 16 inch, pin 22 giờ. Hoàn hảo cho chuyên gia sáng tạo và lập trình viên.',
  description: `
    <h2>💻 MacBook Pro 16-inch M3 Max - Sức mạnh vượt trội cho chuyên gia</h2>
    <p>MacBook Pro 16-inch với chip M3 Max là đỉnh cao của công nghệ Apple, được thiết kế dành cho những chuyên gia đòi hỏi hiệu năng tối đa.</p>
    
    <h3>⚡ Hiệu năng đột phá với chip M3 Max</h3>
    <p>Chip M3 Max với 16 nhân CPU và 40 nhân GPU mang lại hiệu năng vượt trội:</p>
    <ul>
      <li>Xử lý video 8K ProRes mượt mà</li>
      <li>Render 3D nhanh gấp 2.5 lần thế hệ trước</li>
      <li>Multitasking mượt mà với hàng trăm tab Chrome</li>
      <li>Compile code nhanh chóng với Xcode</li>
    </ul>
    
    <h3>🖥️ Màn hình Liquid Retina XDR tuyệt đẹp</h3>
    <p>Màn hình 16.2 inch với công nghệ mini-LED:</p>
    <ul>
      <li>Độ phân giải 3456 x 2234 pixels</li>
      <li>Độ sáng 1000 nits (1600 nits peak HDR)</li>
      <li>Tỷ lệ tương phản 1,000,000:1</li>
      <li>H? tr? P3 wide color gamut</li>
      <li>ProMotion với tần số quét lên đến 120Hz</li>
    </ul>
    
    <h3>🔋 Pin bền bỉ cả ngày dài</h3>
    <p>Pin lithium-polymer 100Wh cung cấp:</p>
    <ul>
      <li>Lên đến 22 giờ phát video</li>
      <li>18 giờ duyệt web không dây</li>
      <li>Sạc nhanh với adapter 140W USB-C</li>
    </ul>
    
    <h3>🔊 Âm thanh đỉnh cao</h3>
    <p>Hệ thống âm thanh 6 loa với:</p>
    <ul>
      <li>Woofers force-cancelling</li>
      <li>Âm thanh không gian với Dolby Atmos</li>
      <li>3 micro array v?i beamforming</li>
    </ul>
    
    <h3>🔌 Kết nối đa dạng</h3>
    <ul>
      <li>3 cổng Thunderbolt 4 (USB-C)</li>
      <li>1 cổng HDMI</li>
      <li>1 khe thẻ SDXC</li>
      <li>1 cổng MagSafe 3</li>
      <li>Jack tai nghe 3.5mm</li>
    </ul>
    
    <h3>🔐 Bảo mật tối ưu</h3>
    <ul>
      <li>Touch ID tích hợp</li>
      <li>Secure Enclave</li>
      <li>Camera FaceTime HD 1080p</li>
    </ul>
    
    <p><strong>Lý do chọn MacBook Pro 16-inch M3 Max:</strong></p>
    <ul>
      <li>✅ Hiệu năng đỉnh cao cho mọi tác vụ</li>
      <li>✅ Màn hình chuyên nghiệp</li>
      <li>✅ Pin bền bỉ</li>
      <li>✅ Thiết kế premium</li>
      <li>✅ Hệ sinh thái Apple hoàn hảo</li>
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
  metaTitle: 'MacBook Pro 16-inch M3 Max - Laptop cao cấp cho chuyên gia | TechStore',
  metaDescription:
    'MacBook Pro 16-inch M3 Max với chip M3 Max mạnh mẽ, màn hình Liquid Retina XDR, pin 22 giờ. Giá tốt nhất, bảo hành chính hãng. Mua ngay!',
  metaKeywords: 'macbook pro 16, m3 max, laptop apple, macbook pro 2024, laptop cao cấp',

  // Shipping
  freeShipping: true,
  shippingClass: 'standard',
};
