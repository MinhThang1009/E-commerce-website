/**
 * @file adminUserService.js
 * @layer Service
 * @module admin
 * @description CRUD users cho admin
 */
const adminRepository = require('@modules/admin/repositories/sequelize-admin-repository');
const Op = adminRepository.getOp();
const { User, Order, Address, SearchHistory, RecentlyViewed } = adminRepository.getModels();

const { catchAsync } = require('@utils/catch-async');
const { AppError } = require('@shared/errors');
const { t } = require('@utils/i18n');

const getAllUsers = catchAsync(async (req, res) => {
  const {
    page = 1,
    search = '',
    role = '',
    sortBy = 'createdAt',
    sortOrder = 'DESC',
    isEmailVerified,
  } = req.query;
  const limit = Math.min(parseInt(req.query.limit) || 20, 100);

  const offset = (page - 1) * limit;
  const whereClause = {};

  if (search) {
    whereClause[Op.or] = [
      { firstName: { [Op.like]: `%${search}%` } },
      { lastName: { [Op.like]: `%${search}%` } },
      { email: { [Op.like]: `%${search}%` } },
      { phone: { [Op.like]: `%${search}%` } },
    ];
  }

  if (role) {
    whereClause.role = role;
  }

  if (isEmailVerified !== undefined) {
    whereClause.isEmailVerified = isEmailVerified === 'true';
  }

  const { count, rows: users } = await adminRepository.findUsers({
    where: whereClause,
    limit: parseInt(limit),
    offset: parseInt(offset),
    order: [[sortBy, sortOrder.toUpperCase()]],
    attributes: {
      exclude: ['password', 'verificationToken', 'resetPasswordToken'],
    },
  });

  res.status(200).json({
    status: 'success',
    data: {
      users,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(count / limit),
        totalItems: count,
        itemsPerPage: parseInt(limit),
      },
    },
  });
});

const updateUser = catchAsync(async (req, res) => {
  const { id } = req.params;
  const { firstName, lastName, phone, role, isEmailVerified, isActive } = req.body;

  const user = await adminRepository.findUserById(id);
  if (!user) {
    throw new AppError(t('admin.userNotFound', req.locale), 404);
  }

  const numericId = Number(id);

  if (req.user.id === numericId && role && role !== user.role) {
    throw new AppError(t('admin.cannotChangeSelfRole', req.locale), 403);
  }

  if (req.user.id === numericId && isActive === false) {
    throw new AppError(t('admin.cannotDeactivateSelf', req.locale), 403);
  }

  if (role && role !== user.role && req.user.role !== 'admin') {
    throw new AppError(t('admin.roleChangeAdminOnly', req.locale), 403);
  }

  const updatePayload = {
    role: role || user.role,
    isEmailVerified: isEmailVerified !== undefined ? isEmailVerified : user.isEmailVerified,
    isActive: isActive !== undefined ? isActive : user.isActive,
  };
  updatePayload.firstName = req.body.hasOwnProperty('firstName')
    ? firstName || user.firstName
    : user.firstName;
  updatePayload.lastName = req.body.hasOwnProperty('lastName')
    ? lastName || user.lastName
    : user.lastName;
  updatePayload.phone = req.body.hasOwnProperty('phone') ? phone : user.phone;

  const updatedUser = await user.update(updatePayload);

  res.status(200).json({
    status: 'success',
    data: { user: updatedUser },
  });
});

const deleteUser = catchAsync(async (req, res) => {
  const { id } = req.params;

  if (String(req.user.id) === String(id)) {
    throw new AppError(t('admin.cannotDeleteSelf', req.locale), 403);
  }

  const user = await adminRepository.findUserById(id);
  if (!user) {
    throw new AppError(t('admin.userNotFound', req.locale), 404);
  }

  await user.destroy();

  res.status(200).json({
    status: 'success',
    message: 'Xóa người dùng thành công',
  });
});

const getUserById = catchAsync(async (req, res) => {
  const { id } = req.params;

  const user = await adminRepository.findUserById(id, {
    include: [
      { model: Address, as: 'addresses' },
      {
        model: Order,
        as: 'orders',
        limit: 10,
        order: [['createdAt', 'DESC']],
      },
      { model: SearchHistory, as: 'searchHistories', limit: 10 },
      { model: RecentlyViewed, as: 'recentlyViewed', limit: 10 },
    ],
  });

  if (!user) {
    throw new AppError(t('admin.userNotFound', req.locale), 404);
  }

  res.status(200).json({
    status: 'success',
    data: { user },
  });
});

module.exports = { getAllUsers, updateUser, deleteUser, getUserById };
