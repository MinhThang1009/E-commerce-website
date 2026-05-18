/**
 * @file attributeRepository.js
 * @layer Repository
 * @module attribute
 * @description Data access layer cho attribute
 */
const {
  AttributeGroup,
  AttributeValue,
  ProductAttributeGroup,
  Product,
  ProductVariant,
} = require('@models');

const findAllGroups = () =>
  AttributeGroup.findAll({
    include: [{
      model: AttributeValue,
      as: 'values',
      where: { isActive: true },
      required: false,
      order: [['sortOrder', 'ASC'], ['name', 'ASC']],
    }],
    where: { isActive: true },
    order: [['sortOrder', 'ASC'], ['name', 'ASC']],
  });

const findProductWithGroups = (productId) =>
  Product.findByPk(productId, {
    include: [{
      model: AttributeGroup,
      as: 'attributeGroups',
      through: { attributes: ['isRequired', 'sortOrder'] },
      include: [{
        model: AttributeValue,
        as: 'values',
        where: { isActive: true },
        required: false,
        order: [['sortOrder', 'ASC'], ['name', 'ASC']],
      }],
      where: { isActive: true },
      required: false,
    }],
  });

const createGroup = (data) => AttributeGroup.create(data);

const findGroupById = (id) => AttributeGroup.findByPk(id);

const createValue = (data) => AttributeValue.create(data);

const findValueById = (id) => AttributeValue.findByPk(id);

const createProductGroupAssignment = (data) => ProductAttributeGroup.create(data);

const findRecentVariants = (productId) =>
  ProductVariant.findAll({
    where: { productId },
    attributes: ['attributeValues', 'displayName', 'name'],
    limit: 10,
    order: [['createdAt', 'DESC']],
  });

module.exports = {
  findAllGroups,
  findProductWithGroups,
  createGroup,
  findGroupById,
  createValue,
  findValueById,
  createProductGroupAssignment,
  findRecentVariants,
};
