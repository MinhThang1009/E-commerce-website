require('dotenv').config();
require('module-alias/register');
const path = require('path');
const fs = require('fs');
const { Product, Category, ProductImage, ProductVariant, ProductSpecification } = require('../src/models');
const vectorStoreService = require('../src/services/vector-store/vector-store');
const { enrichProductData } = require('../src/utils/product-helpers');

// Script index tất cả sản phẩm vào vector store
// Chạy: node scripts/indexProducts.js hoặc npm run ai:rebuild-vectors

/** Gọi LLM 1 lần để dịch tất cả spec keys EN→VI. Fallback: giữ nguyên nếu LLM không có. */
async function translateSpecKeys(keys) {
  const apiKey = process.env.LLM_API_KEY;
  const baseUrl = process.env.LLM_BASE_URL;
  const model   = process.env.LLM_MODEL_1 || process.env.LLM_MODEL_2;
  if (!apiKey || !baseUrl || !model || !keys.length) return {};

  const axios = require('axios');
  const prompt = `Dịch các tên thông số kỹ thuật sau từ tiếng Anh sang tiếng Việt ngắn gọn, chuyên nghiệp.
Trả về JSON {"<key>": "<tên tiếng Việt>"}. Chỉ trả JSON, không giải thích.
Keys: ${JSON.stringify(keys)}`;
  try {
    const res = await axios.post(`${baseUrl}/chat/completions`, {
      model,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      temperature: 0,
      max_tokens: 600,
    }, { headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' }, timeout: 30000 });
    const raw = res.data.choices?.[0]?.message?.content;
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    console.warn('⚠️  Không dịch được spec keys — giữ nguyên tiếng Anh:', e.message);
    return {};
  }
}

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
        { model: ProductVariant, as: 'variants',
          attributes: ['variantName', 'displayName', 'price', 'compareAtPrice', 'stockQuantity', 'isDefault', 'attributes', 'attributesEn'],
          required: false },
        { model: ProductSpecification, as: 'productSpecifications', attributes: ['name', 'value', 'valueEn', 'category'], required: false },
      ],
    });

    console.log(`Tìm thấy ${products.length} sản phẩm cần index.`);

    // Thu thập tất cả spec keys và dịch 1 lần qua LLM trước khi index
    const allSpecKeys = [...new Set(products.flatMap(p => {
      const specs = p.specifications;
      return (specs && typeof specs === 'object') ? Object.keys(specs) : [];
    }))];
    if (allSpecKeys.length > 0) {
      process.stdout.write(`🔤 Dịch ${allSpecKeys.length} spec keys EN→VI qua LLM... `);
      const specKeyMap = await translateSpecKeys(allSpecKeys);
      const translated = Object.keys(specKeyMap).length;
      process.stdout.write(translated > 0 ? `✅ ${translated} keys\n` : `⚠️ bỏ qua (không có LLM)\n`);
      vectorStoreService.setSpecKeyMap(specKeyMap);
    }

    // Backup trước khi clear — nếu script crash giữa chừng còn file để restore
    const storagePath = vectorStoreService.storagePath;
    if (fs.existsSync(storagePath)) {
      const backupPath = storagePath + '.bak';
      fs.copyFileSync(storagePath, backupPath);
      console.log(`✅ Đã backup vector-db.json → vector-db.json.bak`);
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
        await vectorStoreService.upsertProduct(enrichProductData(product.toJSON()));
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
