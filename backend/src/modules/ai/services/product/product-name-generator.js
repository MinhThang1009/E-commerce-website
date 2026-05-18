/**
 * @file productNameGenerator.js
 * @layer Service
 * @module ai
 * @description Business logic layer cho ai
 */
const logger = require('@utils/logger');
const { AttributeValue, AttributeGroup } = require('@models');

// Định nghĩa association nếu chưa tồn tại
if (!AttributeValue.associations.attributeGroup) {
  AttributeValue.belongsTo(AttributeGroup, {
    foreignKey: 'attributeGroupId',
    as: 'attributeGroup',
  });
}

if (!AttributeGroup.associations.values) {
  AttributeGroup.hasMany(AttributeValue, {
    foreignKey: 'attributeGroupId',
    as: 'values',
  });
}

/**
 * Service tạo tên sản phẩm động dựa trên các thuộc tính được chọn
 */
class ProductNameGeneratorService {
  /**
   * Tạo tên sản phẩm dựa trên tên gốc và các giá trị thuộc tính được chọn
   * @param {string} baseName - Tên gốc của sản phẩm (ví dụ: "ThinkPad X1 Carbon")
   * @param {Array} selectedAttributes - Mảng ID các giá trị thuộc tính được chọn
   * @param {string} separator - Ký tự phân cách giữa các phần tên (mặc định: " ")
   * @returns {Promise<string>} Tên sản phẩm đã tạo
   */
  async generateProductName(baseName, selectedAttributes = [], separator = ' ') {
    try {
      if (!baseName) {
        throw new Error('Base name is required');
      }

      if (!selectedAttributes.length) {
        return baseName;
      }

      // Lấy các giá trị thuộc tính ảnh hưởng đến tên sản phẩm
      const attributeValues = await AttributeValue.findAll({
        where: {
          id: selectedAttributes,
          affectsName: true,
          isActive: true,
        },
        include: [
          {
            model: AttributeGroup,
            as: 'attributeGroup',
            attributes: ['name', 'type', 'sortOrder'],
          },
        ],
        order: [
          [{ model: AttributeGroup, as: 'attributeGroup' }, 'sortOrder', 'ASC'],
          ['sortOrder', 'ASC'],
        ],
      });

      if (!attributeValues.length) {
        return baseName;
      }

      // Xây dựng các phần của tên
      const nameParts = [baseName];

      for (const attrValue of attributeValues) {
        const nameToAdd = attrValue.nameTemplate || attrValue.name;
        if (nameToAdd && nameToAdd.trim()) {
          nameParts.push(nameToAdd.trim());
        }
      }

      return nameParts.join(separator);
    } catch (error) {
      logger.error('Error generating product name:', error);
      throw error;
    }
  }

  /**
   * Tạo tên sản phẩm từ tổ hợp thuộc tính (dùng cho biến thể)
   * @param {string} baseName - Tên gốc của sản phẩm
   * @param {Object} attributesCombination - Object với cặp attributeGroupId: attributeValueId
   * @param {string} separator - Ký tự phân cách giữa các phần tên
   * @returns {Promise<string>} Tên sản phẩm đã tạo
   */
  async generateVariantName(baseName, attributesCombination = {}, separator = ' ') {
    try {
      const selectedAttributeIds = Object.values(attributesCombination).filter((id) => id);
      return this.generateProductName(baseName, selectedAttributeIds, separator);
    } catch (error) {
      logger.error('Error generating variant name:', error);
      throw error;
    }
  }

  /**
   * Xem trước tên sản phẩm mà không lưu
   * @param {string} baseName - Tên gốc của sản phẩm
   * @param {Array} selectedAttributes - Mảng ID các giá trị thuộc tính được chọn
   * @param {Object} options - Tuỳ chọn cho việc tạo tên
   * @returns {Promise<Object>} Kết quả xem trước gồm tên gốc và tên đã tạo
   */
  async previewProductName(baseName, selectedAttributes = [], options = {}) {
    try {
      const { separator = ' ', includeDetails = false } = options;

      const generatedName = await this.generateProductName(baseName, selectedAttributes, separator);

      const result = {
        originalName: baseName,
        generatedName,
        hasChanges: generatedName !== baseName,
        parts: generatedName.split(separator),
      };

      if (includeDetails) {
        // Lấy chi tiết về các thuộc tính ảnh hưởng đến tên
        const attributeValues = await AttributeValue.findAll({
          where: {
            id: selectedAttributes,
            affectsName: true,
            isActive: true,
          },
          include: [
            {
              model: AttributeGroup,
              as: 'attributeGroup',
              attributes: ['id', 'name', 'type'],
            },
          ],
        });

        result.affectingAttributes = attributeValues.map((attr) => ({
          id: attr.id,
          name: attr.name,
          nameTemplate: attr.nameTemplate,
          groupName: attr.attributeGroup?.name,
          groupType: attr.attributeGroup?.type,
        }));
      }

      return result;
    } catch (error) {
      logger.error('Error previewing product name:', error);
      throw error;
    }
  }

  /**
   * Lấy tất cả giá trị thuộc tính có thể ảnh hưởng đến tên sản phẩm
   * @param {string} productId - ID sản phẩm (tuỳ chọn, dùng cho thuộc tính riêng của sản phẩm)
   * @returns {Promise<Array>} Mảng các giá trị thuộc tính ảnh hưởng đến tên
   */
  async getNameAffectingAttributes(productId = null) {
    try {
      const whereCondition = {
        affectsName: true,
        isActive: true,
      };

      const attributeValues = await AttributeValue.findAll({
        where: whereCondition,
        include: [
          {
            model: AttributeGroup,
            as: 'attributeGroup',
            attributes: ['id', 'name', 'type', 'description'],
            where: { isActive: true },
          },
        ],
        order: [
          [{ model: AttributeGroup, as: 'attributeGroup' }, 'sortOrder', 'ASC'],
          ['sortOrder', 'ASC'],
        ],
      });

      return attributeValues;
    } catch (error) {
      logger.error('Error getting name affecting attributes:', error);
      throw error;
    }
  }

  /**
   * Tạo tên hàng loạt cho nhiều sản phẩm/biến thể
   * @param {Array} items - Mảng các mục với baseName và selectedAttributes
   * @param {string} separator - Ký tự phân cách giữa các phần tên
   * @returns {Promise<Array>} Mảng các tên đã tạo
   */
  async batchGenerateNames(items = [], separator = ' ') {
    try {
      const results = [];

      for (const item of items) {
        const { baseName, selectedAttributes, id } = item;
        const generatedName = await this.generateProductName(
          baseName,
          selectedAttributes,
          separator,
        );

        results.push({
          id,
          baseName,
          generatedName,
          selectedAttributes,
        });
      }

      return results;
    } catch (error) {
      logger.error('Error batch generating names:', error);
      throw error;
    }
  }
}

module.exports = new ProductNameGeneratorService();
