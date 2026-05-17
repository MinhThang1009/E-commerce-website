const { DiscountCode } = require('../../../models');
const { Op } = require('sequelize');

/**
 * @file discountCodeRepository.js
 * @layer Repository — Data access layer cho discount code
 * @module discountCode
 * @description Tất cả thao tác với database liên quan đến mã giảm giá.
 *   Service gọi repository, repository gọi model Sequelize.
 *   Không chứa business logic — chỉ CRUD thuần túy.
 */

/**
 * Tìm nhiều mã giảm giá với filter, phân trang và sắp xếp.
 * @param {Object} params
 * @param {Object} params.where      - Điều kiện lọc Sequelize
 * @param {number} params.limit      - Số bản ghi mỗi trang
 * @param {number} params.offset     - Vị trí bắt đầu
 * @param {Array}  params.order      - Điều kiện sắp xếp [[column, direction]]
 * @returns {Promise<{count: number, rows: DiscountCode[]}>}
 */
const findAll = ({ where = {}, limit, offset, order }) => {
  return DiscountCode.findAndCountAll({ where, limit, offset, order });
};

/**
 * Tìm một mã giảm giá theo ID.
 * @param {string} id - UUID của mã giảm giá
 * @returns {Promise<DiscountCode|null>} null nếu không tìm thấy
 */
const findById = (id) => {
  return DiscountCode.findByPk(id);
};

/**
 * Tìm một mã giảm giá theo điều kiện.
 * @param {Object} where - Điều kiện Sequelize
 * @returns {Promise<DiscountCode|null>}
 */
const findOne = (where) => {
  return DiscountCode.findOne({ where });
};

/**
 * Tạo mã giảm giá mới trong database.
 * @param {Object} data - Dữ liệu mã giảm giá
 * @returns {Promise<DiscountCode>}
 */
const create = (data) => {
  return DiscountCode.create(data);
};

/**
 * Xóa mã giảm giá khỏi database (hard delete).
 * @param {DiscountCode} discountCode - Instance Sequelize cần xóa
 * @returns {Promise<void>}
 */
const remove = (discountCode) => {
  return discountCode.destroy();
};

/**
 * Tăng usedCount của mã giảm giá sau khi được sử dụng thành công.
 * @param {string} id - UUID của mã giảm giá
 * @returns {Promise<void>}
 */
const incrementUsedCount = (id) => {
  return DiscountCode.increment('usedCount', { where: { id } });
};

module.exports = {
  findAll,
  findById,
  findOne,
  create,
  remove,
  incrementUsedCount,
};
