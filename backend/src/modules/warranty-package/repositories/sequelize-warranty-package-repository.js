/**
 * @file warrantyPackageRepository.js
 * @layer Repository
 * @module warrantyPackage
 * @description Data access layer cho warrantyPackage
 */
const { WarrantyPackage, ProductWarranty, Product } = require('@models');

const findAll = ({ where, offset, limit }) =>
  WarrantyPackage.findAndCountAll({
    where,
    order: [
      ['sortOrder', 'ASC'],
      ['createdAt', 'ASC'],
    ],
    offset,
    limit,
  });

const findById = (id) => WarrantyPackage.findByPk(id);

const findByProduct = (productId) =>
  ProductWarranty.findAll({
    where: { productId },
    include: [{ model: WarrantyPackage, as: 'warrantyPackage', where: { isActive: true } }],
    order: [
      [{ model: WarrantyPackage, as: 'warrantyPackage' }, 'sortOrder', 'ASC'],
      [{ model: WarrantyPackage, as: 'warrantyPackage' }, 'price', 'ASC'],
    ],
  });

const productExists = (productId) => Product.findByPk(productId);

const isUsedByProduct = (warrantyPackageId) =>
  ProductWarranty.findOne({ where: { warrantyPackageId } });

const create = (data) => WarrantyPackage.create(data);

module.exports = { findAll, findById, findByProduct, productExists, isUsedByProduct, create };
