/**
 * Các hàm hỗ trợ cho sản phẩm
 * Tiện ích quản lý tồn kho và biến thể sản phẩm
 */

const { ProductVariant } = require('../models');

/**
 * Tính tổng tồn kho từ các biến thể
 * @param {Array} variants - Mảng các biến thể sản phẩm
 * @returns {number} Tổng số lượng tồn kho
 */
const calculateTotalStock = (variants) => {
  if (!variants || variants.length === 0) return 0;
  return variants.reduce(
    (total, variant) => total + (variant.stockQuantity || 0),
    0
  );
};

/**
 * Cập nhật tổng tồn kho của sản phẩm dựa trên các biến thể
 * @param {string} productId - ID sản phẩm
 * @param {Object} Product - Model Product
 * @returns {Promise<number>} Tổng tồn kho sau khi cập nhật
 */
const updateProductTotalStock = async (productId, Product) => {
  try {
    const variants = await ProductVariant.findAll({
      where: { productId },
      attributes: ['stockQuantity'],
    });

    const totalStock = calculateTotalStock(variants);

    await Product.update(
      {
        stockQuantity: totalStock,
        inStock: totalStock > 0,
      },
      { where: { id: productId } }
    );

    return totalStock;
  } catch (error) {
    console.error('Lỗi khi cập nhật tổng tồn kho sản phẩm:', error);
    throw error;
  }
};

/**
 * Kiểm tra thuộc tính biến thể so với thuộc tính sản phẩm
 * @param {Array} productAttributes - Thuộc tính sản phẩm
 * @param {Object} variantAttributes - Thuộc tính biến thể
 * @returns {boolean} Hợp lệ hay không
 */
const validateVariantAttributes = (productAttributes, variantAttributes) => {
  // Nếu không có thuộc tính sản phẩm hoặc không có thuộc tính biến thể, trả về true
  if (!productAttributes || productAttributes.length === 0) return true;
  if (!variantAttributes) return true;

  // Kiểm tra từng thuộc tính sản phẩm
  for (const productAttr of productAttributes) {
    // Kiểm tra nếu thuộc tính này có trong biến thể
    const variantValue = variantAttributes[productAttr.name];

    // Nếu không có giá trị biến thể cho thuộc tính này, bỏ qua
    if (!variantValue) continue;

    // Kiểm tra nếu values tồn tại và là mảng
    if (productAttr.values && Array.isArray(productAttr.values)) {
      // Kiểm tra nếu giá trị biến thể không nằm trong danh sách giá trị cho phép
      if (!productAttr.values.includes(variantValue)) {
        console.log(
          `Giá trị biến thể không hợp lệ: ${variantValue} không nằm trong ${productAttr.values.join(', ')}`
        );
        return false;
      }
    }
  }

  return true;
};

/**
 * Tạo SKU cho biến thể
 * @param {string} productSku - SKU gốc của sản phẩm
 * @param {Object} attributes - Thuộc tính biến thể
 * @returns {string} SKU đã tạo
 */
const generateVariantSku = (productSku, attributes) => {
  const suffix = Object.values(attributes)
    .map((value) => value.toUpperCase().replace(/\s+/g, ''))
    .join('-');

  return `${productSku}-${suffix}`;
};

/**
 * Kiểm tra sản phẩm có biến thể không
 * @param {Object} product - Sản phẩm kèm biến thể
 * @returns {boolean} Có biến thể hay không
 */
const hasVariants = (product) => {
  return product.variants && product.variants.length > 0;
};

/**
 * Lấy số lượng tồn kho theo tổ hợp thuộc tính cụ thể
 * @param {Array} variants - Danh sách biến thể sản phẩm
 * @param {Object} selectedAttributes - Thuộc tính được chọn
 * @returns {number} Số lượng tồn kho hiện có
 */
const getVariantStock = (variants, selectedAttributes) => {
  if (!variants || variants.length === 0) return 0;

  const matchingVariant = variants.find((variant) => {
    return Object.entries(selectedAttributes).every(
      ([key, value]) => variant.attributes[key] === value
    );
  });

  return matchingVariant ? matchingVariant.stockQuantity : 0;
};

/**
 * Tìm biến thể theo thuộc tính
 * @param {Array} variants - Danh sách biến thể sản phẩm
 * @param {Object} selectedAttributes - Thuộc tính được chọn
 * @returns {Object|null} Biến thể khớp hoặc null
 */
const findVariantByAttributes = (variants, selectedAttributes) => {
  if (!variants || variants.length === 0) return null;

  return variants.find((variant) => {
    return Object.entries(selectedAttributes).every(
      ([key, value]) => variant.attributes[key] === value
    );
  });
};

module.exports = {
  calculateTotalStock,
  updateProductTotalStock,
  validateVariantAttributes,
  generateVariantSku,
  hasVariants,
  getVariantStock,
  findVariantByAttributes,
};
