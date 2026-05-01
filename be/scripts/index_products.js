require('dotenv').config();
const { Product, Category } = require('../src/models');
const vectorStoreService = require('../src/services/vectorStore.service');
const sequelize = require('../src/config/sequelize');

/**
 * Script to index all products into the vector store
 */
const indexAllProducts = async () => {
  try {
    // 1. Fetch all active products with categories
    console.log('📦 Fetching products from database...');
    const products = await Product.findAll({
      where: { status: 'active' },
      include: [
        {
          model: Category,
          as: 'categories',
          through: { attributes: [] }
        }
      ]
    });

    console.log(`Found ${products.length} products to index.`);

    // 2. Clear old index before starting fresh
    console.log('🧹 Clearing old vector store...');
    vectorStoreService.clear();

    // 3. Index each product
    for (let i = 0; i < products.length; i++) {
        const product = products[i];
        console.log(`[${i + 1}/${products.length}] Indexing: ${product.name}...`);
        try {
            await vectorStoreService.addProduct(product.toJSON());
        } catch (err) {
            console.error(`Failed to index product ${product.id}:`, err.message);
        }
    }

    // 3. Save the vector store
    console.log('💾 Saving vector store to disk...');
    vectorStoreService.save();
    
    console.log('✅ Indexing complete!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Indexing failed:', error);
    process.exit(1);
  }
};

indexAllProducts();
