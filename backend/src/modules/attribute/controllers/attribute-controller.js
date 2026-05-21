/**
 * @file attributeController.js
 * @layer Controller
 * @module attribute
 * @description Xử lý HTTP request/response cho attribute
 */
const service = require('@modules/attribute/services/attribute-service');

const getAttributeGroups = async (req, res, next) => {
  try {
    res.json({ status: 'success', data: await service.getAttributeGroups() });
  } catch (error) {
    next(error);
  }
};

const getProductAttributeGroups = async (req, res, next) => {
  try {
    res.json({
      status: 'success',
      data: await service.getProductAttributeGroups(req.params.productId),
    });
  } catch (error) {
    next(error);
  }
};

const createAttributeGroup = async (req, res, next) => {
  try {
    const data = await service.createGroup(req.body);
    res.status(201).json({ status: 'success', data, message: 'Tạo nhóm thuộc tính thành công' });
  } catch (error) {
    next(error);
  }
};

const updateAttributeGroup = async (req, res, next) => {
  try {
    const data = await service.updateGroup(req.params.id, req.body);
    res.json({ status: 'success', data, message: 'Cập nhật nhóm thuộc tính thành công' });
  } catch (error) {
    next(error);
  }
};

const deleteAttributeGroup = async (req, res, next) => {
  try {
    await service.deleteGroup(req.params.id);
    res.json({ status: 'success', message: 'Xóa nhóm thuộc tính thành công' });
  } catch (error) {
    next(error);
  }
};

const addAttributeValue = async (req, res, next) => {
  try {
    const data = await service.addValue({
      ...req.body,
      attributeGroupId: req.params.attributeGroupId,
    });
    res
      .status(201)
      .json({ status: 'success', data, message: 'Thêm giá trị thuộc tính thành công' });
  } catch (error) {
    next(error);
  }
};

const updateAttributeValue = async (req, res, next) => {
  try {
    const data = await service.updateValue(req.params.id, req.body);
    res.json({ status: 'success', data, message: 'Cập nhật giá trị thuộc tính thành công' });
  } catch (error) {
    next(error);
  }
};

const deleteAttributeValue = async (req, res, next) => {
  try {
    await service.deleteValue(req.params.id);
    res.json({ status: 'success', message: 'Xóa giá trị thuộc tính thành công' });
  } catch (error) {
    next(error);
  }
};

const assignAttributeGroupToProduct = async (req, res, next) => {
  try {
    const data = await service.assignGroupToProduct({
      productId: req.params.productId,
      attributeGroupId: req.params.attributeGroupId,
      ...req.body,
    });
    res
      .status(201)
      .json({ status: 'success', data, message: 'Gán nhóm thuộc tính cho sản phẩm thành công' });
  } catch (error) {
    next(error);
  }
};

const previewProductName = async (req, res, next) => {
  try {
    const { baseName, selectedAttributes, separator, includeDetails } = req.body;
    if (!baseName)
      return res.status(400).json({ status: 'error', message: 'Tên cơ sở là bắt buộc' });
    const data = await service.previewProductName(baseName, selectedAttributes || [], {
      separator: separator || ' ',
      includeDetails: includeDetails || false,
    });
    res.json({ status: 'success', data, message: 'Tạo xem trước tên sản phẩm thành công' });
  } catch (error) {
    next(error);
  }
};

const getNameAffectingAttributes = async (req, res, next) => {
  try {
    const data = await service.getNameAffectingAttributes(req.query.productId);
    res.json({
      status: 'success',
      data,
      message: 'Lấy danh sách thuộc tính ảnh hưởng đến tên thành công',
    });
  } catch (error) {
    next(error);
  }
};

const batchGenerateProductNames = async (req, res, next) => {
  try {
    const { items, separator } = req.body;
    if (!Array.isArray(items))
      return res.status(400).json({ status: 'error', message: 'Tham số items phải là một mảng' });
    const data = await service.batchGenerateNames(items, separator || ' ');
    res.json({ status: 'success', data, message: 'Tạo tên sản phẩm hàng loạt thành công' });
  } catch (error) {
    next(error);
  }
};

const generateNameRealTime = async (req, res, next) => {
  try {
    const { baseName, attributeValues, productId } = req.body;
    if (!baseName)
      return res.status(400).json({ status: 'error', message: 'Tên cơ sở là bắt buộc' });
    const data = await service.generateNameRealTime(baseName, attributeValues, productId);
    res.json({ status: 'success', data, message: 'Tạo tên theo thời gian thực thành công' });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getAttributeGroups,
  getProductAttributeGroups,
  createAttributeGroup,
  updateAttributeGroup,
  deleteAttributeGroup,
  addAttributeValue,
  updateAttributeValue,
  deleteAttributeValue,
  assignAttributeGroupToProduct,
  previewProductName,
  getNameAffectingAttributes,
  batchGenerateProductNames,
  generateNameRealTime,
};
