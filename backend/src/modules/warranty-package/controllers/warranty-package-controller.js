/**
 * @file warrantyPackageController.js
 * @layer Controller
 * @module warrantyPackage
 * @description Xử lý HTTP request/response cho warrantyPackage
 */
const service = require('@modules/warranty-package/services/warranty-package-service');

exports.getAllWarrantyPackages = async (req, res, next) => {
  try {
    const data = await service.getAll(req.query);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
};

exports.getWarrantyPackagesByProduct = async (req, res, next) => {
  try {
    const warrantyPackages = await service.getByProduct(req.params.productId);
    res.json({ status: 'success', data: { warrantyPackages, productId: req.params.productId } });
  } catch (error) {
    next(error);
  }
};

exports.getWarrantyPackageById = async (req, res, next) => {
  try {
    const data = await service.getById(req.params.id);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
};

exports.createWarrantyPackage = async (req, res, next) => {
  try {
    const data = await service.create(req.body);
    res.status(201).json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
};

exports.updateWarrantyPackage = async (req, res, next) => {
  try {
    const data = await service.update(req.params.id, req.body);
    res.json({ status: 'success', data });
  } catch (error) {
    next(error);
  }
};

exports.deleteWarrantyPackage = async (req, res, next) => {
  try {
    await service.remove(req.params.id);
    res.json({ status: 'success', message: 'Xóa gói bảo hành thành công' });
  } catch (error) {
    next(error);
  }
};
