export const SAMPLE_LAPTOP_DATA: Record<string, unknown> = {
  // Thông tin cơ bản
  name: 'MacBook Pro 16-inch M3 Max',
  slug: 'macbook-pro-16-inch-m3-max',
  shortDescription:
    'Laptop cao cấp với chip M3 Max mạnh mẽ, màn hình Liquid Retina XDR 16 inch, pin 22 giờ. Hoàn hảo cho chuyên gia sáng tạo và lập trình viên.',
  description: `
    <h2>MacBook Pro 16-inch M3 Max - Sức mạnh vượt trội cho chuyên gia</h2>
    <p>MacBook Pro 16-inch với chip M3 Max là đỉnh cao của công nghệ Apple, được thiết kế dành cho những chuyên gia đòi hỏi hiệu năng tối đa.</p>
    
    <h3>Hiệu năng đột phá với chip M3 Max</h3>
    <p>Chip M3 Max với 16 nhân CPU và 40 nhân GPU mang lại hiệu năng vượt trội:</p>
    <ul>
      <li>Xử lý video 8K ProRes mượt mà</li>
      <li>Render 3D nhanh gấp 2.5 lần thế hệ trước</li>
      <li>Multitasking mượt mà với hàng trăm tab Chrome</li>
      <li>Compile code nhanh chóng với Xcode</li>
    </ul>
    
    <h3>Màn hình Liquid Retina XDR tuyệt đẹp</h3>
    <p>Màn hình 16.2 inch với công nghệ mini-LED:</p>
    <ul>
      <li>Độ phân giải 3456 x 2234 pixels</li>
      <li>Độ sáng 1000 nits (1600 nits peak HDR)</li>
      <li>Tỷ lệ tương phản 1,000,000:1</li>
      <li>Hỗ trợ P3 wide color gamut</li>
      <li>ProMotion với tần số quét lên đến 120Hz</li>
    </ul>
    
    <h3>Pin bền bỉ cả ngày dài</h3>
    <p>Pin lithium-polymer 100Wh cung cấp:</p>
    <ul>
      <li>Lên đến 22 giờ phát video</li>
      <li>18 giờ duyệt web không dây</li>
      <li>Sạc nhanh với adapter 140W USB-C</li>
    </ul>
    
    <h3>Âm thanh đỉnh cao</h3>
    <p>Hệ thống âm thanh 6 loa với:</p>
    <ul>
      <li>Woofers force-cancelling</li>
      <li>Âm thanh không gian với Dolby Atmos</li>
      <li>3 micro array với beamforming</li>
    </ul>
    
    <h3>Kết nối đa dạng</h3>
    <ul>
      <li>3 cổng Thunderbolt 4 (USB-C)</li>
      <li>1 cổng HDMI</li>
      <li>1 khe thẻ SDXC</li>
      <li>1 cổng MagSafe 3</li>
      <li>Jack tai nghe 3.5mm</li>
    </ul>
    
    <h3>Bảo mật tối ưu</h3>
    <ul>
      <li>Touch ID tích hợp</li>
      <li>Secure Enclave</li>
      <li>Camera FaceTime HD 1080p</li>
    </ul>
    
    <p><strong>Lý do chọn MacBook Pro 16-inch M3 Max:</strong></p>
    <ul>
      <li>Hiệu năng đỉnh cao cho mọi tác vụ</li>
      <li>Màn hình chuyên nghiệp</li>
      <li>Pin bền bỉ</li>
      <li>Thiết kế premium</li>
      <li>Hệ sinh thái Apple hoàn hảo</li>
    </ul>
  `,

  // Pricing — field names khớp với form fields
  price: 89990000,
  compareAtPrice: 84990000,

  // Inventory
  stockQuantity: 50,
  sku: 'MBP16-M3MAX-1TB-SG',

  // Status
  status: 'active',
  featured: true,

  // SEO — field names khớp với form fields (Vi + En tách riêng)
  seoTitleVi: 'MacBook Pro 16-inch M3 Max - Laptop cao cấp cho chuyên gia | TechStore',
  seoTitleEn: 'MacBook Pro 16-inch M3 Max - Premium Laptop for Professionals | TechStore',
  seoDescriptionVi:
    'MacBook Pro 16-inch M3 Max với chip M3 Max mạnh mẽ, màn hình Liquid Retina XDR, pin 22 giờ. Giá tốt nhất, bảo hành chính hãng. Mua ngay!',
  seoDescriptionEn:
    'MacBook Pro 16-inch M3 Max with powerful M3 Max chip, Liquid Retina XDR display, 22-hour battery life. Best price, official warranty. Buy now!',
  seoKeywords: 'macbook pro 16, m3 max, laptop apple, macbook pro 2024, laptop cao cấp',

  // Specifications
  specifications: [
    { name: 'Chip', value: 'Apple M3 Max (16 nhân CPU, 40 nhân GPU)', category: 'Hiệu năng' },
    { name: 'RAM', value: '36GB unified memory', category: 'Hiệu năng' },
    { name: 'Bộ nhớ', value: '1TB SSD', category: 'Thông số chung' },
    {
      name: 'Màn hình',
      value: '16.2 inch Liquid Retina XDR, 3456×2234, 120Hz',
      category: 'Màn hình',
    },
    { name: 'Pin', value: '100Wh, lên đến 22 giờ', category: 'Pin & Nguồn' },
    { name: 'Hệ điều hành', value: 'macOS Sonoma', category: 'Hệ điều hành' },
    { name: 'Trọng lượng', value: '2.16 kg', category: 'Thiết kế' },
  ],

  // Attributes (thuộc tính màu/bộ nhớ)
  attributes: [
    { id: 'attr-sample-1', name: 'Màu sắc', values: ['Xám Vũ Trụ', 'Bạc'] },
    { id: 'attr-sample-2', name: 'Dung lượng', values: ['1TB', '2TB'] },
  ],

  // Variants (biến thể kết hợp)
  variants: [
    {
      id: 'var-sample-1',
      name: 'MacBook Pro 16 M3 Max 1TB Xám Vũ Trụ',
      sku: 'MBP16-M3MAX-1TB-SG',
      price: 89990000,
      compareAtPrice: 94990000,
      stock: 30,
      attributes: { 'Màu sắc': 'Xám Vũ Trụ', 'Dung lượng': '1TB' },
    },
    {
      id: 'var-sample-2',
      name: 'MacBook Pro 16 M3 Max 1TB Bạc',
      sku: 'MBP16-M3MAX-1TB-SL',
      price: 89990000,
      compareAtPrice: 94990000,
      stock: 20,
      attributes: { 'Màu sắc': 'Bạc', 'Dung lượng': '1TB' },
    },
    {
      id: 'var-sample-3',
      name: 'MacBook Pro 16 M3 Max 2TB Xám Vũ Trụ',
      sku: 'MBP16-M3MAX-2TB-SG',
      price: 104990000,
      compareAtPrice: 109990000,
      stock: 15,
      attributes: { 'Màu sắc': 'Xám Vũ Trụ', 'Dung lượng': '2TB' },
    },
  ],

  // FAQs
  faqs: [
    {
      question: 'MacBook Pro M3 Max có hỗ trợ sạc nhanh không?',
      answer:
        'Có, MacBook Pro M3 Max hỗ trợ sạc nhanh với adapter 140W USB-C MagSafe 3, có thể sạc 50% chỉ trong 30 phút.',
    },
    {
      question: 'MacBook Pro M3 Max có chạy được game không?',
      answer:
        "Có, với GPU 40 nhân, MacBook Pro M3 Max có thể chạy nhiều game AAA qua Apple Arcade hoặc các game được tối ưu cho macOS như Resident Evil Village, Baldur's Gate 3.",
    },
    {
      question: 'Tôi có thể nâng cấp RAM hoặc SSD không?',
      answer:
        'Không, RAM và SSD của MacBook Pro M3 Max được hàn chặt vào bo mạch chủ, không thể nâng cấp sau khi mua. Hãy chọn cấu hình phù hợp ngay khi đặt hàng.',
    },
  ],
};
