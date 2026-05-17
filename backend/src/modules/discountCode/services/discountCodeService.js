const { Op } = require('sequelize');
const { AppError } = require('../../../shared/errors');
const { AdminAuditService } = require('../../../shared/adminAudit');
const discountCodeRepository = require('../repositories/discountCodeRepository');

/**
 * @file discountCodeService.js
 * @layer Service — Business logic layer cho discount code
 * @module discountCode
 * @description Xử lý toàn bộ business logic của mã giảm giá.
 *   Controller gọi service, service gọi repository.
 *   Không truy cập Model Sequelize trực tiếp.
 *
 * Luồng xử lý applyDiscountCode:
 *   1. Tìm mã theo code + isActive = true (qua repository)
 *   2. Kiểm tra thời gian hiệu lực (startDate, endDate)
 *   3. Kiểm tra giới hạn lượt dùng
 *   4. Kiểm tra giá trị đơn hàng tối thiểu
 *   5. Tính số tiền giảm theo type (percent / fixed)
 *   6. Cap theo maxDiscountAmount và orderAmount
 */

/**
 * Lấy danh sách mã giảm giá có phân trang, tìm kiếm và sắp xếp.
 * @param {Object} params
 * @param {number} params.page        - Trang hiện tại (bắt đầu từ 1)
 * @param {number} params.limit       - Số bản ghi mỗi trang
 * @param {string} params.search      - Tìm kiếm theo code (LIKE)
 * @param {string} params.isActive    - Lọc theo trạng thái ('true'/'false'/undefined)
 * @param {string} params.sortBy      - Tên cột sắp xếp
 * @param {string} params.sortOrder   - 'ASC' hoặc 'DESC'
 * @returns {Promise<{discountCodes: DiscountCode[], pagination: Object}>}
 */
const getAllDiscountCodes = async ({
  page = 1,
  limit = 10,
  search = '',
  isActive,
  sortBy = 'createdAt',
  sortOrder = 'DESC',
}) => {
  const offset = (page - 1) * limit;
  const where = {};

  if (search) {
    where.code = { [Op.like]: `%${search}%` };
  }
  if (isActive !== undefined) {
    where.isActive = isActive === 'true';
  }

  const { count, rows: discountCodes } = await discountCodeRepository.findAll({
    where,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [[sortBy, sortOrder.toUpperCase()]],
  });

  return {
    discountCodes,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(count / limit),
      totalItems: count,
      itemsPerPage: parseInt(limit),
    },
  };
};

/**
 * Lấy chi tiết một mã giảm giá theo ID.
 * @param {string} id - UUID của mã giảm giá
 * @returns {Promise<DiscountCode>}
 * @throws {AppError} 404 - Không tìm thấy mã giảm giá
 */
const getDiscountCodeById = async (id) => {
  const discountCode = await discountCodeRepository.findById(id);
  if (!discountCode) throw new AppError('Không tìm thấy mã giảm giá', 404);
  return discountCode;
};

/**
 * Tạo mã giảm giá mới và ghi audit log.
 * @param {Object} data  - Dữ liệu mã giảm giá
 * @param {Object} actor - User thực hiện (dùng cho audit log)
 * @returns {Promise<DiscountCode>}
 * @throws {AppError} 400 - Mã giảm giá đã tồn tại
 */
const createDiscountCode = async (data, actor) => {
  const {
    code,
    type,
    value,
    minOrderAmount,
    maxDiscountAmount,
    startDate,
    endDate,
    usageLimit,
    isActive,
    description,
  } = data;

  // Kiểm tra trùng mã trước khi tạo
  const existingCode = await discountCodeRepository.findOne({ code });
  if (existingCode) throw new AppError('Mã giảm giá đã tồn tại', 400);

  const discountCode = await discountCodeRepository.create({
    code,
    type,
    value,
    minOrderAmount: minOrderAmount || 0,
    maxDiscountAmount,
    startDate,
    endDate,
    usageLimit,
    isActive: isActive !== undefined ? isActive : true,
    description,
  });

  AdminAuditService.logDiscountCodeAction(actor, 'CREATE', discountCode.id, code);
  return discountCode;
};

/**
 * Cập nhật thông tin mã giảm giá và ghi audit log.
 * @param {string} id    - UUID của mã giảm giá
 * @param {Object} data  - Các trường cần cập nhật
 * @param {Object} actor - User thực hiện (dùng cho audit log)
 * @returns {Promise<DiscountCode>}
 * @throws {AppError} 404 - Không tìm thấy mã giảm giá
 * @throws {AppError} 400 - Mã mới đã tồn tại
 */
const updateDiscountCode = async (id, data, actor) => {
  const {
    code,
    type,
    value,
    minOrderAmount,
    maxDiscountAmount,
    startDate,
    endDate,
    usageLimit,
    isActive,
    description,
  } = data;

  const discountCode = await discountCodeRepository.findById(id);
  if (!discountCode) throw new AppError('Không tìm thấy mã giảm giá', 404);

  if (code && code !== discountCode.code) {
    const existingCode = await discountCodeRepository.findOne({ code });
    if (existingCode) throw new AppError('Mã giảm giá đã tồn tại', 400);
  }

  const wasActive = discountCode.isActive;

  await discountCode.update({
    code: code || discountCode.code,
    type: type || discountCode.type,
    value: value !== undefined ? value : discountCode.value,
    minOrderAmount: minOrderAmount !== undefined ? minOrderAmount : discountCode.minOrderAmount,
    maxDiscountAmount:
      maxDiscountAmount !== undefined ? maxDiscountAmount : discountCode.maxDiscountAmount,
    startDate: startDate || discountCode.startDate,
    endDate: endDate || discountCode.endDate,
    usageLimit: usageLimit !== undefined ? usageLimit : discountCode.usageLimit,
    isActive: isActive !== undefined ? isActive : discountCode.isActive,
    description: description || discountCode.description,
  });

  // Phân biệt DEACTIVATE và UPDATE thông thường để audit log rõ ràng hơn
  const action = isActive === false && wasActive ? 'DEACTIVATE' : 'UPDATE';
  AdminAuditService.logDiscountCodeAction(actor, action, id, discountCode.code);

  return discountCode;
};

/**
 * Xóa mã giảm giá và ghi audit log.
 * @param {string} id    - UUID của mã giảm giá
 * @param {Object} actor - User thực hiện (dùng cho audit log)
 * @throws {AppError} 404 - Không tìm thấy mã giảm giá
 */
const deleteDiscountCode = async (id, actor) => {
  const discountCode = await discountCodeRepository.findById(id);
  if (!discountCode) throw new AppError('Không tìm thấy mã giảm giá', 404);

  await discountCodeRepository.remove(discountCode);
  AdminAuditService.logDiscountCodeAction(actor, 'DELETE', id, discountCode.code);
};

/**
 * Kiểm tra tính hợp lệ và tính toán số tiền giảm khi áp dụng mã.
 *
 * Luồng xử lý:
 *   1. Tìm mã theo code + isActive = true
 *   2. Kiểm tra thời gian hiệu lực
 *   3. Kiểm tra giới hạn lượt dùng
 *   4. Kiểm tra giá trị đơn hàng tối thiểu
 *   5. Tính tiền giảm (percent hoặc fixed), cap theo maxDiscountAmount
 *
 * @param {string} code        - Mã giảm giá nhập vào
 * @param {number} orderAmount - Tổng giá trị đơn hàng
 * @returns {Promise<{discountAmount: number, discountCodeId: string, code: string}>}
 * @throws {AppError} 400 - Mã không hợp lệ, hết hạn, hết lượt dùng, hoặc đơn không đủ điều kiện
 */
const applyDiscountCode = async (code, orderAmount) => {
  const discountCode = await discountCodeRepository.findOne({ code, isActive: true });
  if (!discountCode) throw new AppError('Mã giảm giá không hợp lệ hoặc đã hết hạn', 400);

  const now = new Date();
  if (discountCode.startDate && now < new Date(discountCode.startDate)) {
    throw new AppError('Mã giảm giá chưa đến thời gian áp dụng', 400);
  }
  if (discountCode.endDate && now > new Date(discountCode.endDate)) {
    throw new AppError('Mã giảm giá đã hết hạn', 400);
  }
  if (discountCode.usageLimit !== null && discountCode.usedCount >= discountCode.usageLimit) {
    throw new AppError('Mã giảm giá đã đạt giới hạn lượt sử dụng', 400);
  }
  if (orderAmount < parseFloat(discountCode.minOrderAmount)) {
    throw new AppError(
      `Đơn hàng phải tối thiểu ${discountCode.minOrderAmount} để sử dụng mã này`,
      400,
    );
  }

  let discountAmount = 0;
  const value = parseFloat(discountCode.value);

  if (discountCode.type === 'percent') {
    discountAmount = (orderAmount * value) / 100;
    // Giới hạn số tiền giảm tối đa nếu có cấu hình
    if (
      discountCode.maxDiscountAmount &&
      discountAmount > parseFloat(discountCode.maxDiscountAmount)
    ) {
      discountAmount = parseFloat(discountCode.maxDiscountAmount);
    }
  } else {
    discountAmount = value;
  }

  // Không giảm quá tổng giá trị đơn hàng
  if (discountAmount > orderAmount) {
    discountAmount = orderAmount;
  }

  return { discountAmount, discountCodeId: discountCode.id, code: discountCode.code };
};

module.exports = {
  getAllDiscountCodes,
  getDiscountCodeById,
  createDiscountCode,
  updateDiscountCode,
  deleteDiscountCode,
  applyDiscountCode,
};
