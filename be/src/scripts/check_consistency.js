
const { Product, ProductVariant, Category, sequelize } = require('../models');

async function checkConsistency() {
  try {
    await sequelize.authenticate();
    console.log('\x1b[36m%s\x1b[0m', '--- Database Consistency Check ---');

    const products = await Product.findAll({
      include: [
        { association: 'categories', through: { attributes: [] } },
        { association: 'variants' }
      ]
    });

    console.log(`Total Products in DB: ${products.length}`);

    products.forEach(p => {
      console.log(`\nProduct: "${p.name}" (ID: ${p.id})`);
      console.log(`- Slug: ${p.slug}`);
      console.log(`- BaseName: ${p.baseName}`);
      console.log(`- Categories: ${p.categories.map(c => c.name).join(', ')}`);
      
      if (p.isVariantProduct) {
        console.log(`- Variants (${p.variants.length}):`);
        p.variants.forEach(v => {
          console.log(`  * Variant ID: ${v.id}`);
          console.log(`    Display Name: "${v.displayName}"`);
          console.log(`    Full Name (name): "${v.name}"`);
          console.log(`    Attributes: ${JSON.stringify(v.attributeValues)}`);
        });
      } else {
        console.log(`- Stock: ${p.stockQuantity}`);
      }
    });

    console.log('\n\x1b[36m%s\x1b[0m', '--- Summary ---');
    const variantCount = await ProductVariant.count();
    console.log(`Total Variants in DB: ${variantCount}`);
    
    // Check for potential issues
    const productsWithoutBaseName = products.filter(p => p.isVariantProduct && !p.baseName);
    if (productsWithoutBaseName.length > 0) {
      console.log('\x1b[31m%s\x1b[0m', `Warning: ${productsWithoutBaseName.length} variant products are missing baseName.`);
    }

    const variantsWithoutDisplayName = await ProductVariant.count({ where: { displayName: null } });
    if (variantsWithoutDisplayName > 0) {
      console.log('\x1b[31m%s\x1b[0m', `Warning: ${variantsWithoutDisplayName} variants are missing displayName.`);
    }

    process.exit(0);
  } catch (error) {
    console.error('Error during consistency check:', error);
    process.exit(1);
  }
}

checkConsistency();
