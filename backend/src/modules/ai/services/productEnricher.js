// Compute thumbnail + inStock từ product associations — dùng chung cho indexProducts, model hooks, admin controllers
function enrichProductData(productData) {
  const thumbImg = productData.productImages?.find((img) => img.isThumbnail);
  productData.thumbnail = thumbImg?.imageUrl || productData.productImages?.[0]?.imageUrl || null;
  const variantStock = (productData.variants || []).reduce(
    (sum, v) => sum + (v.stockQuantity || 0),
    0,
  );
  productData.inStock = variantStock > 0 || productData.stockQuantity > 0;
  return productData;
}

module.exports = { enrichProductData };
