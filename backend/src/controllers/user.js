const { User, Address } = require('../models');
const { AppError } = require('../middlewares/errorHandler');

// Cập nhật thông tin user profile
const updateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName, phone, avatar } = req.body;
    const userId = req.user.id;

    // Tìm user
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404);
    }

    // Cập nhật thông tin user
    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.phone = phone !== undefined ? phone : user.phone;
    user.avatar = avatar || user.avatar;

    await user.save();

    res.status(200).json({
      status: 'success',
      data: user.toJSON(),
    });
  } catch (error) {
    next(error);
  }
};

// Đổi mật khẩu
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id;

    // Tìm user
    const user = await User.findByPk(userId);
    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404);
    }

    // Kiểm tra mật khẩu hiện tại
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new AppError('Mật khẩu hiện tại không đúng', 401);
    }

    // Cập nhật mật khẩu
    user.password = newPassword;
    await user.save();

    res.status(200).json({
      status: 'success',
      message: 'Đổi mật khẩu thành công',
    });
  } catch (error) {
    next(error);
  }
};

// Lấy danh sách địa chỉ của user
const getAddresses = async (req, res, next) => {
  try {
    const userId = req.user.id;

    // Lấy danh sách địa chỉ
    const addresses = await Address.findAll({
      where: { userId },
      order: [
        ['isDefault', 'DESC'],
        ['createdAt', 'DESC'],
      ],
    });

    res.status(200).json({
      status: 'success',
      data: addresses,
    });
  } catch (error) {
    next(error);
  }
};

// Thêm địa chỉ mới
const addAddress = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const addressData = req.body;

    // Nếu là địa chỉ đầu tiên, tự động đặt làm mặc định
    const addressCount = await Address.count({ where: { userId } });
    if (addressCount === 0) {
      addressData.isDefault = true;
    }

    // Nếu đặt làm mặc định, bỏ mặc định các địa chỉ khác
    if (addressData.isDefault) {
      await Address.update(
        { isDefault: false },
        { where: { userId, isDefault: true } }
      );
    }

    // Tạo địa chỉ
    const address = await Address.create({
      ...addressData,
      userId,
    });

    res.status(201).json({
      status: 'success',
      data: address,
    });
  } catch (error) {
    next(error);
  }
};

// Cập nhật địa chỉ
const updateAddress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const addressData = req.body;

    // Tìm địa chỉ
    const address = await Address.findOne({
      where: { id, userId },
    });

    if (!address) {
      throw new AppError('Không tìm thấy địa chỉ', 404);
    }

    // Nếu đặt làm mặc định, bỏ mặc định các địa chỉ khác
    if (addressData.isDefault && !address.isDefault) {
      await Address.update(
        { isDefault: false },
        { where: { userId, isDefault: true } }
      );
    }

    // Cập nhật địa chỉ
    await address.update(addressData);

    res.status(200).json({
      status: 'success',
      data: address,
    });
  } catch (error) {
    next(error);
  }
};

// Xóa địa chỉ
const deleteAddress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Tìm địa chỉ
    const address = await Address.findOne({
      where: { id, userId },
    });

    if (!address) {
      throw new AppError('Không tìm thấy địa chỉ', 404);
    }

    // Xóa địa chỉ
    await address.destroy();

    // Nếu địa chỉ bị xóa là mặc định, đặt địa chỉ gần nhất làm mặc định
    if (address.isDefault) {
      const anotherAddress = await Address.findOne({
        where: { userId },
        order: [['createdAt', 'DESC']],
      });

      if (anotherAddress) {
        anotherAddress.isDefault = true;
        await anotherAddress.save();
      }
    }

    res.status(200).json({
      status: 'success',
      message: 'Xóa địa chỉ thành công',
    });
  } catch (error) {
    next(error);
  }
};

// Đặt làm địa chỉ mặc định
const setDefaultAddress = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Tìm địa chỉ
    const address = await Address.findOne({
      where: { id, userId },
    });

    if (!address) {
      throw new AppError('Không tìm thấy địa chỉ', 404);
    }

    // Bỏ mặc định các địa chỉ khác
    await Address.update(
      { isDefault: false },
      { where: { userId, isDefault: true } }
    );

    // Đặt làm mặc định
    address.isDefault = true;
    await address.save();

    res.status(200).json({
      status: 'success',
      data: address,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  updateProfile,
  changePassword,
  getAddresses,
  addAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};
