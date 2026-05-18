/**
 * @file imageRepository.js
 * @layer Repository
 * @module image
 * @description Data access layer cho image
 */
const Image = require('@models/image');
const { Op } = require('sequelize');

const create = (data) => Image.create(data);

const findById = (id) => Image.findByPk(id);

const findByProduct = (productId) =>
  Image.findAll({
    where: { entityType: 'product', entityId: productId },
    order: [['sortOrder', 'ASC'], ['createdAt', 'DESC']],
  });

const findAll = (where) => Image.findAll({ where });

const findByFilePath = (filePath) => Image.findOne({ where: { filePath } });

module.exports = { create, findById, findByProduct, findAll, findByFilePath };
