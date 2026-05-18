/**
 * @file IAuthRepository.js
 * @layer Repository
 * @module auth
 * @description Data access layer cho auth
 */
// IAuthRepository — interface auth-specific data access cho User aggregate.
// Service chỉ phụ thuộc interface này, không phụ thuộc Sequelize impl trực tiếp.
//
// User model thuộc users module (sẽ refactor ở Sprint 2). Auth module truy cập
// User qua repository này, KHÔNG require ../models/user.

class IAuthRepository {
  async findByEmail(_email) { throw new Error('not implemented'); }
  async findById(_id) { throw new Error('not implemented'); }
  async findByIdWithAddresses(_id) { throw new Error('not implemented'); }
  async findByGoogleIdOrEmail(_googleId, _email) { throw new Error('not implemented'); }
  async findByResetToken(_token) { throw new Error('not implemented'); }
  async createUser(_payload) { throw new Error('not implemented'); }
  async saveUser(_user) { throw new Error('not implemented'); }
}

module.exports = IAuthRepository;
