const { AppError } = require('../../../shared/errors');

// Users Service — business logic profile + address. KHÔNG import Sequelize/Model
// trực tiếp; mọi data access qua usersRepository. Address CRUD đặt cùng module
// vì address luôn thuộc về 1 user (user-aggregate boundary).
class UsersService {
  constructor({ usersRepository, eventBus, logger }) {
    this.usersRepository = usersRepository;
    this.eventBus = eventBus;
    this.logger = logger;
  }

  // -------- Profile --------

  async updateProfile({ userId, firstName, lastName, phone, avatar }) {
    const user = await this.usersRepository.findUserById(userId);
    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404);
    }

    user.firstName = firstName || user.firstName;
    user.lastName = lastName || user.lastName;
    user.phone = phone !== undefined ? phone : user.phone;
    user.avatar = avatar || user.avatar;

    await this.usersRepository.saveUser(user);
    return { user };
  }

  async changePassword({ userId, currentPassword, newPassword }) {
    const user = await this.usersRepository.findUserById(userId);
    if (!user) {
      throw new AppError('Không tìm thấy người dùng', 404);
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw new AppError('Mật khẩu hiện tại không đúng', 401);
    }

    user.password = newPassword;
    await this.usersRepository.saveUser(user);
    return { message: 'Đổi mật khẩu thành công' };
  }

  // -------- Address --------

  async getAddresses({ userId }) {
    const addresses = await this.usersRepository.findAddressesByUserId(userId);
    return { addresses };
  }

  // Tạo address. Auto-set isDefault=true cho address đầu tiên. Nếu request
  // isDefault=true thì clear default cũ trước khi insert.
  async addAddress({ userId, addressData }) {
    const data = { ...addressData };

    const count = await this.usersRepository.countAddressesByUserId(userId);
    if (count === 0) {
      data.isDefault = true;
    }

    if (data.isDefault) {
      await this.usersRepository.clearDefaultAddresses(userId);
    }

    const address = await this.usersRepository.createAddress({ ...data, userId });
    return { address };
  }

  async updateAddress({ userId, addressId, addressData }) {
    const address = await this.usersRepository.findAddressByIdAndUserId(addressId, userId);
    if (!address) {
      throw new AppError('Không tìm thấy địa chỉ', 404);
    }

    if (addressData.isDefault && !address.isDefault) {
      await this.usersRepository.clearDefaultAddresses(userId);
    }

    Object.assign(address, addressData);
    await this.usersRepository.saveAddress(address);
    return { address };
  }

  // Xóa address. Nếu địa chỉ vừa xóa là default, promote địa chỉ mới nhất còn
  // lại làm default (UX: user luôn có 1 default sau khi xóa).
  async deleteAddress({ userId, addressId }) {
    const address = await this.usersRepository.findAddressByIdAndUserId(addressId, userId);
    if (!address) {
      throw new AppError('Không tìm thấy địa chỉ', 404);
    }

    const wasDefault = address.isDefault;
    await this.usersRepository.deleteAddress(address);

    if (wasDefault) {
      const next = await this.usersRepository.findLatestAddressByUserId(userId);
      if (next) {
        next.isDefault = true;
        await this.usersRepository.saveAddress(next);
      }
    }

    return { message: 'Xóa địa chỉ thành công' };
  }

  async setDefaultAddress({ userId, addressId }) {
    const address = await this.usersRepository.findAddressByIdAndUserId(addressId, userId);
    if (!address) {
      throw new AppError('Không tìm thấy địa chỉ', 404);
    }

    await this.usersRepository.clearDefaultAddresses(userId);
    address.isDefault = true;
    await this.usersRepository.saveAddress(address);
    return { address };
  }
}

module.exports = UsersService;
