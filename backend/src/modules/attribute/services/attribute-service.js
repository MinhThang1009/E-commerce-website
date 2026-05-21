/**
 * @file attributeService.js
 * @layer Service
 * @module attribute
 * @description Business logic layer cho attribute
 */
const { AppError } = require('@shared/errors');
const repo = require('@modules/attribute/repositories/sequelize-attribute-repository');
const logger = require('@utils/logger');

// productNameGeneratorService được inject từ module.js để tránh cross-module coupling trực tiếp
let _nameGenerator = null;
const setNameGenerator = (service) => {
  _nameGenerator = service;
};

const getAttributeGroups = () => repo.findAllGroups();

const getProductAttributeGroups = async (productId) => {
  const product = await repo.findProductWithGroups(productId);
  if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);
  return product.attributeGroups;
};

const createGroup = (data) => repo.createGroup(data);

const updateGroup = async (id, data) => {
  const group = await repo.findGroupById(id);
  if (!group) throw new AppError('Không tìm thấy nhóm thuộc tính', 404);
  await group.update(data);
  return group;
};

const deleteGroup = async (id) => {
  const group = await repo.findGroupById(id);
  if (!group) throw new AppError('Không tìm thấy nhóm thuộc tính', 404);
  await group.update({ isActive: false });
};

const addValue = async (data) => {
  const group = await repo.findGroupById(data.attributeGroupId);
  if (!group) throw new AppError('Không tìm thấy nhóm thuộc tính', 404);
  return repo.createValue(data);
};

const updateValue = async (id, data) => {
  const value = await repo.findValueById(id);
  if (!value) throw new AppError('Không tìm thấy giá trị thuộc tính', 404);
  await value.update(data);
  return value;
};

const deleteValue = async (id) => {
  const value = await repo.findValueById(id);
  if (!value) throw new AppError('Không tìm thấy giá trị thuộc tính', 404);
  await value.update({ isActive: false });
};

const assignGroupToProduct = (data) => repo.createProductGroupAssignment(data);

const getPopularAttributeCombinations = async (productId) => {
  try {
    const variants = await repo.findRecentVariants(productId);
    return variants.map((v) => ({
      attributeValues: v.attributeValues,
      displayName: v.displayName,
      fullName: v.name,
    }));
  } catch (error) {
    logger.info('Không thể lấy tổ hợp phổ biến:', error.message);
    return [];
  }
};

const previewProductName = (baseName, selectedAttributes, options) => {
  if (!_nameGenerator) throw new AppError('Name generator chưa được khởi tạo', 500);
  return _nameGenerator.previewProductName(baseName, selectedAttributes, options);
};

const getNameAffectingAttributes = (productId) => {
  if (!_nameGenerator) throw new AppError('Name generator chưa được khởi tạo', 500);
  return _nameGenerator.getNameAffectingAttributes(productId);
};

const batchGenerateNames = (items, separator) => {
  if (!_nameGenerator) throw new AppError('Name generator chưa được khởi tạo', 500);
  return _nameGenerator.batchGenerateNames(items, separator);
};

const generateNameRealTime = async (baseName, attributeValues, productId) => {
  const selectedAttributes = Array.isArray(attributeValues)
    ? attributeValues
    : Object.values(attributeValues || {}).filter((id) => id);

  const preview = await previewProductName(baseName, selectedAttributes, {
    separator: ' ',
    includeDetails: true,
  });

  let suggestions = [];
  if (productId) suggestions = await getPopularAttributeCombinations(productId);

  return { ...preview, suggestions, timestamp: new Date().toISOString() };
};

module.exports = {
  setNameGenerator,
  getAttributeGroups,
  getProductAttributeGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  addValue,
  updateValue,
  deleteValue,
  assignGroupToProduct,
  previewProductName,
  getNameAffectingAttributes,
  batchGenerateNames,
  generateNameRealTime,
};
