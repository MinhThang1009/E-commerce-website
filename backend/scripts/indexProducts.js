require('dotenv').config();
const path = require('path');
const fs = require('fs');
const { Product, Category, ProductImage } = require('../src/models');
const vectorStoreService = require('../src/services/ai/vectorStore');
const { enrichProductData } = vectorStoreService;
const viEmbeddingService = require('../src/services/ai/viEmbedding');

// Script index tất cả sản phẩm vào vector store
// Chạy: node scripts/indexProducts.js hoặc npm run ai:rebuild-vectors
const indexAllProducts = async () => {
  try {
    // Đảm bảo vectorStore đã load xong trước khi thao tác
    await vectorStoreService.loadPromise;

    console.log('📦 Đang lấy sản phẩm từ database...');
    // Fix: `inStock` không tồn tại. Index mọi product status='active'.
    // (Stock thực ở variant level — chatbot post-filter khi search.)
    const products = await Product.findAll({
      where: { status: 'active' },
      include: [
        { model: Category, as: 'categories', through: { attributes: [] }, attributes: ['name'] },
        { model: Category, as: 'category', attributes: ['name'] },
        { model: ProductImage, as: 'productImages', attributes: ['imageUrl', 'isThumbnail'], required: false },
      ],
    });

    console.log(`Tìm thấy ${products.length} sản phẩm cần index.`);
    console.log(`🌐 Vietnamese embedding: ${viEmbeddingService.isAvailable() ? '✅ Khả dụng' : '⚠️ Chưa cấu hình (chỉ tạo English vectors)'}`);

    // Backup trước khi clear — nếu script crash giữa chừng còn file để restore
    const storagePath = vectorStoreService.storagePath;
    if (fs.existsSync(storagePath)) {
      const backupPath = storagePath + '.bak';
      fs.copyFileSync(storagePath, backupPath);
      console.log(`✅ Đã backup vectorDb.json → vectorDb.json.bak`);
    }

    // 3. Xóa index cũ — bắt đầu lại từ đầu
    console.log('🧹 Đang xóa vector store cũ...');
    vectorStoreService.clear();

    // 4. Index từng sản phẩm (tuần tự để dễ debug lỗi từng cái)
    const failedIds = [];
    for (let i = 0; i < products.length; i++) {
      const product = products[i];
      process.stdout.write(`[${i + 1}/${products.length}] Indexing: ${product.name}... `);
      try {
        await vectorStoreService.addProduct(enrichProductData(product.toJSON()));
        process.stdout.write('✅\n');
      } catch (err) {
        process.stdout.write(`❌ ${err.message}\n`);
        failedIds.push(product.id);
      }
    }

    console.log('💾 Đang lưu vector store...');
    await vectorStoreService.save();

    // 6. Report kết quả
    if (failedIds.length > 0) {
      console.warn(`⚠️ Không thể index ${failedIds.length} sản phẩm: ID [${failedIds.join(', ')}]`);
    }
    console.log(`✅ Hoàn thành! Đã index ${products.length - failedIds.length}/${products.length} sản phẩm.`);
    process.exit(0);
  } catch (error) {
    console.error('❌ Index thất bại:', error);
    process.exit(1);
  }
};

indexAllProducts();
