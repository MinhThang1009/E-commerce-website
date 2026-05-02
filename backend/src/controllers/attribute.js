const {
  AttributeGroup,
  AttributeValue,
  ProductAttributeGroup,
  Product,
} = require('../models');
const productNameGeneratorService = require('../services/ai/productNameGenerator');
const logger = require('../utils/logger');

// Lấy danh sách nhóm thuộc tính cùng với các giá trị của chúng
const getAttributeGroups = async (req, res) => {
  try {
    const attributeGroups = await AttributeGroup.findAll({
      include: [
        {
          model: AttributeValue,
          as: 'values',
          where: { isActive: true },
          required: false,
          order: [
            ['sortOrder', 'ASC'],
            ['name', 'ASC'],
          ],
        },
      ],
      where: { isActive: true },
      order: [
        ['sortOrder', 'ASC'],
        ['name', 'ASC'],
      ],
    });

    res.json({
      success: true,
      data: attributeGroups,
    });
  } catch (error) {
    logger.error('Lỗi khi lấy danh sách nhóm thuộc tính:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể lấy danh sách nhóm thuộc tính',
      error: error.message,
    });
  }
};

// Lấy nhóm thuộc tính của một sản phẩm cụ thể
const getProductAttributeGroups = async (req, res) => {
  try {
    const { productId } = req.params;

    const product = await Product.findByPk(productId, {
      include: [
        {
          model: AttributeGroup,
          as: 'attributeGroups',
          through: {
            attributes: ['isRequired', 'sortOrder'],
          },
          include: [
            {
              model: AttributeValue,
              as: 'values',
              where: { isActive: true },
              required: false,
              order: [
                ['sortOrder', 'ASC'],
                ['name', 'ASC'],
              ],
            },
          ],
          where: { isActive: true },
          required: false,
        },
      ],
    });

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy sản phẩm',
      });
    }

    res.json({
      success: true,
      data: product.attributeGroups,
    });
  } catch (error) {
    logger.error('Lỗi khi lấy nhóm thuộc tính của sản phẩm:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể lấy nhóm thuộc tính của sản phẩm',
      error: error.message,
    });
  }
};

// Tạo nhóm thuộc tính mới
const createAttributeGroup = async (req, res) => {
  try {
    const { name, description, type, isRequired, sortOrder } = req.body;

    const attributeGroup = await AttributeGroup.create({
      name,
      description,
      type,
      isRequired,
      sortOrder,
    });

    res.status(201).json({
      success: true,
      data: attributeGroup,
      message: 'Tạo nhóm thuộc tính thành công',
    });
  } catch (error) {
    logger.error('Lỗi khi tạo nhóm thuộc tính:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể tạo nhóm thuộc tính',
      error: error.message,
    });
  }
};

// Thêm giá trị thuộc tính vào nhóm
const addAttributeValue = async (req, res) => {
  try {
    const { attributeGroupId } = req.params;
    const {
      name,
      value,
      colorCode,
      imageUrl,
      priceAdjustment,
      sortOrder,
      affectsName,
      nameTemplate,
    } = req.body;

    const attributeValue = await AttributeValue.create({
      attributeGroupId,
      name,
      value,
      colorCode,
      imageUrl,
      priceAdjustment,
      sortOrder,
      affectsName: affectsName || false,
      nameTemplate,
    });

    res.status(201).json({
      success: true,
      data: attributeValue,
      message: 'Thêm giá trị thuộc tính thành công',
    });
  } catch (error) {
    logger.error('Lỗi khi thêm giá trị thuộc tính:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể thêm giá trị thuộc tính',
      error: error.message,
    });
  }
};

// Gán nhóm thuộc tính cho sản phẩm
const assignAttributeGroupToProduct = async (req, res) => {
  try {
    const { productId, attributeGroupId } = req.params;
    const { isRequired, sortOrder } = req.body;

    const assignment = await ProductAttributeGroup.create({
      productId,
      attributeGroupId,
      isRequired,
      sortOrder,
    });

    res.status(201).json({
      success: true,
      data: assignment,
      message: 'Gán nhóm thuộc tính cho sản phẩm thành công',
    });
  } catch (error) {
    logger.error('Lỗi khi gán nhóm thuộc tính cho sản phẩm:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể gán nhóm thuộc tính cho sản phẩm',
      error: error.message,
    });
  }
};

// Cập nhật nhóm thuộc tính
const updateAttributeGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, type, isRequired, sortOrder, isActive } =
      req.body;

    const attributeGroup = await AttributeGroup.findByPk(id);
    if (!attributeGroup) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhóm thuộc tính',
      });
    }

    await attributeGroup.update({
      name,
      description,
      type,
      isRequired,
      sortOrder,
      isActive,
    });

    res.json({
      success: true,
      data: attributeGroup,
      message: 'Cập nhật nhóm thuộc tính thành công',
    });
  } catch (error) {
    logger.error('Lỗi khi cập nhật nhóm thuộc tính:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể cập nhật nhóm thuộc tính',
      error: error.message,
    });
  }
};

// Cập nhật giá trị thuộc tính
const updateAttributeValue = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      value,
      colorCode,
      imageUrl,
      priceAdjustment,
      sortOrder,
      isActive,
      affectsName,
      nameTemplate,
    } = req.body;

    const attributeValue = await AttributeValue.findByPk(id);
    if (!attributeValue) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy giá trị thuộc tính',
      });
    }

    await attributeValue.update({
      name,
      value,
      colorCode,
      imageUrl,
      priceAdjustment,
      sortOrder,
      isActive,
      affectsName,
      nameTemplate,
    });

    res.json({
      success: true,
      data: attributeValue,
      message: 'Cập nhật giá trị thuộc tính thành công',
    });
  } catch (error) {
    logger.error('Lỗi khi cập nhật giá trị thuộc tính:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể cập nhật giá trị thuộc tính',
      error: error.message,
    });
  }
};

// Xóa nhóm thuộc tính
const deleteAttributeGroup = async (req, res) => {
  try {
    const { id } = req.params;

    const attributeGroup = await AttributeGroup.findByPk(id);
    if (!attributeGroup) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy nhóm thuộc tính',
      });
    }

    await attributeGroup.update({ isActive: false });

    res.json({
      success: true,
      message: 'Xóa nhóm thuộc tính thành công',
    });
  } catch (error) {
    logger.error('Lỗi khi xóa nhóm thuộc tính:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể xóa nhóm thuộc tính',
      error: error.message,
    });
  }
};

// Xóa giá trị thuộc tính
const deleteAttributeValue = async (req, res) => {
  try {
    const { id } = req.params;

    const attributeValue = await AttributeValue.findByPk(id);
    if (!attributeValue) {
      return res.status(404).json({
        success: false,
        message: 'Không tìm thấy giá trị thuộc tính',
      });
    }

    await attributeValue.update({ isActive: false });

    res.json({
      success: true,
      message: 'Xóa giá trị thuộc tính thành công',
    });
  } catch (error) {
    logger.error('Lỗi khi xóa giá trị thuộc tính:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể xóa giá trị thuộc tính',
      error: error.message,
    });
  }
};

// Xem trước tên sản phẩm với các thuộc tính đã chọn
const previewProductName = async (req, res) => {
  try {
    const { baseName, selectedAttributes, separator, includeDetails } =
      req.body;

    if (!baseName) {
      return res.status(400).json({
        success: false,
        message: 'Tên cơ bản là bắt buộc',
      });
    }

    const preview = await productNameGeneratorService.previewProductName(
      baseName,
      selectedAttributes || [],
      {
        separator: separator || ' ',
        includeDetails: includeDetails || false,
      }
    );

    res.json({
      success: true,
      data: preview,
      message: 'Tạo xem trước tên sản phẩm thành công',
    });
  } catch (error) {
    logger.error('Lỗi khi xem trước tên sản phẩm:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể xem trước tên sản phẩm',
      error: error.message,
    });
  }
};

// Lấy các thuộc tính ảnh hưởng đến tên sản phẩm
const getNameAffectingAttributes = async (req, res) => {
  try {
    const { productId } = req.query;

    const attributes =
      await productNameGeneratorService.getNameAffectingAttributes(productId);

    res.json({
      success: true,
      data: attributes,
      message: 'Lấy danh sách thuộc tính ảnh hưởng đến tên thành công',
    });
  } catch (error) {
    logger.error('Lỗi khi lấy thuộc tính ảnh hưởng đến tên:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể lấy thuộc tính ảnh hưởng đến tên',
      error: error.message,
    });
  }
};

// Tạo hàng loạt tên sản phẩm
const batchGenerateProductNames = async (req, res) => {
  try {
    const { items, separator } = req.body;

    if (!Array.isArray(items)) {
      return res.status(400).json({
        success: false,
        message: 'Tham số items phải là một mảng',
      });
    }

    const results = await productNameGeneratorService.batchGenerateNames(
      items,
      separator || ' '
    );

    res.json({
      success: true,
      data: results,
      message: 'Tạo tên sản phẩm hàng loạt thành công',
    });
  } catch (error) {
    logger.error('Lỗi khi tạo tên sản phẩm hàng loạt:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể tạo tên sản phẩm hàng loạt',
      error: error.message,
    });
  }
};

// Tạo tên sản phẩm theo thời gian thực cho form động
const generateNameRealTime = async (req, res) => {
  try {
    const { baseName, attributeValues, productId } = req.body;

    if (!baseName) {
      return res.status(400).json({
        success: false,
        message: 'Tên cơ bản là bắt buộc',
      });
    }

    // Chuyển đổi object attributeValues thành mảng ID
    const selectedAttributes = Array.isArray(attributeValues)
      ? attributeValues
      : Object.values(attributeValues || {}).filter((id) => id);

    const preview = await productNameGeneratorService.previewProductName(
      baseName,
      selectedAttributes,
      {
        separator: ' ',
        includeDetails: true,
      }
    );

    // Lấy thêm gợi ý tổ hợp thuộc tính nếu có productId
    let suggestions = [];
    if (productId) {
      // Lấy các tổ hợp thuộc tính phổ biến cho loại sản phẩm này
      suggestions = await getPopularAttributeCombinations(productId);
    }

    res.json({
      success: true,
      data: {
        ...preview,
        suggestions,
        timestamp: new Date().toISOString(),
      },
      message: 'Tạo tên theo thời gian thực thành công',
    });
  } catch (error) {
    logger.error('Lỗi khi tạo tên theo thời gian thực:', error);
    res.status(500).json({
      success: false,
      message: 'Không thể tạo tên theo thời gian thực',
      error: error.message,
    });
  }
};

// Hàm hỗ trợ lấy các tổ hợp thuộc tính phổ biến
async function getPopularAttributeCombinations(productId) {
  try {
    const { ProductVariant } = require('../models');

    // Lấy các variant hiện có của sản phẩm để gợi ý tổ hợp phổ biến
    const existingVariants = await ProductVariant.findAll({
      where: { productId },
      attributes: ['attributeValues', 'displayName', 'name'],
      limit: 10,
      order: [['createdAt', 'DESC']],
    });

    return existingVariants.map((variant) => ({
      attributeValues: variant.attributeValues,
      displayName: variant.displayName,
      fullName: variant.name,
    }));
  } catch (error) {
    logger.info('Không thể lấy tổ hợp phổ biến:', error.message);
    return [];
  }
}

module.exports = {
  getAttributeGroups,
  getProductAttributeGroups,
  createAttributeGroup,
  addAttributeValue,
  assignAttributeGroupToProduct,
  updateAttributeGroup,
  updateAttributeValue,
  deleteAttributeGroup,
  deleteAttributeValue,
  // Các endpoint mới cho tính năng tạo tên sản phẩm
  previewProductName,
  getNameAffectingAttributes,
  batchGenerateProductNames,
  generateNameRealTime,
};
