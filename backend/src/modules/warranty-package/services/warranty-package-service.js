/**
 * @file warrantyPackageService.js
 * @layer Service
 * @module warrantyPackage
 * @description Business logic layer cho warrantyPackage
 */
const { AppError } = require('@shared/errors');
const repo = require('@modules/warranty-package/repositories/sequelize-warranty-package-repository');

const getAll = async ({ page = 1, limit = 10, isActive }) => {
  const where = {};
  if (isActive !== undefined) where.isActive = isActive === 'true';
  const offset = (parseInt(page, 10) - 1) * parseInt(limit, 10);
  const { count, rows } = await repo.findAll({ where, offset, limit: parseInt(limit, 10) });
  return {
    warrantyPackages: rows,
    pagination: {
      total: count,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(count / limit),
    },
  };
};

const getByProduct = async (productId) => {
  const product = await repo.productExists(productId);
  if (!product) throw new AppError('Không tìm thấy sản phẩm', 404);
  const productWarranties = await repo.findByProduct(productId);
  return productWarranties.map((pw) => ({ ...pw.warrantyPackage.toJSON(), isDefault: pw.isDefault }));
};

const getById = async (id) => {
  const pkg = await repo.findById(id);
  if (!pkg) throw new AppError('Không tìm thấy gói bảo hành', 404);
  return pkg;
};

const create = (data) => repo.create(data);

const update = async (id, data) => {
  const pkg = await repo.findById(id);
  if (!pkg) throw new AppError('Không tìm thấy gói bảo hành', 404);
  await pkg.update(data);
  return pkg;
};

const remove = async (id) => {
  const pkg = await repo.findById(id);
  if (!pkg) throw new AppError('Không tìm thấy gói bảo hành', 404);
  const isUsed = await repo.isUsedByProduct(id);
  if (isUsed) throw new AppError('Không thể xóa gói bảo hành đang được sử dụng bởi sản phẩm', 400);
  await pkg.destroy();
};

module.exports = { getAll, getByProduct, getById, create, update, remove };
