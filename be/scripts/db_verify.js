const { Product, Category, Brand, ProductVariant, AttributeGroup, AttributeValue, ProductSpecification } = require('../src/models');

async function verify() {
  console.log('--- KHỞI ĐỘNG KIỂM TRA DỮ LIỆU ---');
  try {
    const pCount = await Product.count();
    const vCount = await ProductVariant.count();
    const catCount = await Category.count();
    const brandCount = await Brand.count();
    const attrGCount = await AttributeGroup.count();
    const attrVCount = await AttributeValue.count();
    const specCount = await ProductSpecification.count();

    console.log(`\nTHỐNG KÊ TỔNG QUAN:`);
    console.log(`- Sản phẩm: ${pCount}`);
    console.log(`- Biến thể: ${vCount}`);
    console.log(`- Thông số kỹ thuật: ${specCount}`);
    console.log(`- Danh mục: ${catCount}`);
    console.log(`- Thương hiệu: ${brandCount}`);
    console.log(`- Nhóm thuộc tính: ${attrGCount}`);
    console.log(`- Giá trị thuộc tính: ${attrVCount}`);

    console.log(`\nCHI TIẾT DANH MỤC:`);
    const cats = await Category.findAll();
    for (const cat of cats) {
      const count = await cat.countProducts();
      console.log(`- [${cat.name}]: ${count} sản phẩm`);
    }

    console.log(`\nKIỂM TRA BIẾN THỂ & SPECS (Lấy mẫu sản phẩm đầu tiên):`);
    const sample = await Product.findOne({ include: ['variants', 'productSpecifications'] });
    if (sample) {
      console.log(`Sản phẩm: ${sample.name}`);
      console.log(`Số biến thể: ${sample.variants.length}`);
      console.log(`Số thông số kỹ thuật: ${sample.productSpecifications.length}`);
      sample.productSpecifications.forEach(s => {
        console.log(`  * ${s.name}: ${s.value}`);
      });
      console.log(`Biến thể:`);
      sample.variants.forEach(v => {
        console.log(`  + ${v.name}: ${Number(v.price).toLocaleString()} VNĐ`);
      });
    }

    console.log('\n--- KIỂM TRA HOÀN TẤT ---');
    process.exit(0);
  } catch (error) {
    console.error('Lỗi khi kiểm tra dữ liệu:', error);
    process.exit(1);
  }
}

verify();
