/**
 * @file SequelizeAuthRepository.js
 * @layer Repository
 * @module auth
 * @description Data access layer cho auth
 */
const { Op } = require('sequelize');
const IAuthRepository = require('@modules/auth/repositories/i-auth-repository');

// Sequelize impl của IAuthRepository — duy nhất layer được phép truy cập User
// model trong auth module. Service chỉ gọi method của repo này.
class SequelizeAuthRepository extends IAuthRepository {
  constructor({ User }) {
    super();
    if (!User) throw new Error('SequelizeAuthRepository: User model bắt buộc');
    this.User = User;
  }

  async findByEmail(email) {
    return this.User.findOne({ where: { email } });
  }

  async findById(id) {
    return this.User.findByPk(id);
  }

  async findByIdWithAddresses(id) {
    return this.User.findByPk(id, {
      include: [
        {
          association: 'addresses',
          attributes: { exclude: ['userId'] },
        },
      ],
    });
  }

  async findByGoogleIdOrEmail(googleId, email) {
    return this.User.findOne({
      where: {
        [Op.or]: [{ googleId }, { email }],
      },
    });
  }

  async findByResetToken(token) {
    return this.User.findOne({
      where: {
        resetPasswordToken: token,
        resetPasswordExpires: { [Op.gt]: new Date() },
      },
    });
  }

  async createUser(payload) {
    return this.User.create(payload);
  }

  // Service mutate user instance (vd user.password = ...) rồi gọi saveUser(user)
  // để repository persist. Tách save() ra interface để service tránh gọi
  // user.save() trực tiếp (sẽ xem là leak ORM).
  async saveUser(user) {
    return user.save();
  }
}

module.exports = SequelizeAuthRepository;
