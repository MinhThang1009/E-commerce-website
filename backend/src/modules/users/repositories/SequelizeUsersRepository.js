/**
 * @file SequelizeUsersRepository.js
 * @layer Repository
 * @module users
 * @description Data access layer cho users
 */
const IUsersRepository = require('./IUsersRepository');

// Sequelize impl của IUsersRepository — duy nhất layer được phép truy cập User
// + Address model trong users module. Service chỉ gọi method của repo này.
class SequelizeUsersRepository extends IUsersRepository {
  constructor({ User, Address }) {
    super();
    if (!User) throw new Error('SequelizeUsersRepository: User model bắt buộc');
    if (!Address) throw new Error('SequelizeUsersRepository: Address model bắt buộc');
    this.User = User;
    this.Address = Address;
  }

  // -------- User --------
  async findUserById(id) {
    return this.User.findByPk(id);
  }

  async saveUser(user) {
    return user.save();
  }

  // -------- Address --------
  async findAddressesByUserId(userId) {
    return this.Address.findAll({
      where: { userId },
      order: [
        ['isDefault', 'DESC'],
        ['createdAt', 'DESC'],
      ],
    });
  }

  async findAddressByIdAndUserId(id, userId) {
    return this.Address.findOne({ where: { id, userId } });
  }

  async countAddressesByUserId(userId) {
    return this.Address.count({ where: { userId } });
  }

  async createAddress(payload) {
    return this.Address.create(payload);
  }

  async saveAddress(address) {
    return address.save();
  }

  async deleteAddress(address) {
    return address.destroy();
  }

  // Bỏ default flag mọi address khác của user — gọi trước khi set default mới.
  async clearDefaultAddresses(userId) {
    return this.Address.update(
      { isDefault: false },
      { where: { userId, isDefault: true } }
    );
  }

  async findLatestAddressByUserId(userId) {
    return this.Address.findOne({
      where: { userId },
      order: [['createdAt', 'DESC']],
    });
  }
}

module.exports = SequelizeUsersRepository;
