/**
 * @file IUsersRepository.js
 * @layer Repository
 * @module users
 * @description Data access layer cho users
 */
// IUsersRepository — interface user-profile + address data access cho users module.
// Service chỉ phụ thuộc interface này, KHÔNG require User/Address model trực tiếp.

class IUsersRepository {
  // User profile
  async findUserById(_id) {
    throw new Error('not implemented');
  }
  async saveUser(_user) {
    throw new Error('not implemented');
  }

  // Address operations (cùng aggregate với User per UserAddresses CRUD)
  async findAddressesByUserId(_userId) {
    throw new Error('not implemented');
  }
  async findAddressByIdAndUserId(_id, _userId) {
    throw new Error('not implemented');
  }
  async countAddressesByUserId(_userId) {
    throw new Error('not implemented');
  }
  async createAddress(_payload) {
    throw new Error('not implemented');
  }
  async saveAddress(_address) {
    throw new Error('not implemented');
  }
  async deleteAddress(_address) {
    throw new Error('not implemented');
  }
  async clearDefaultAddresses(_userId) {
    throw new Error('not implemented');
  }
  async findLatestAddressByUserId(_userId) {
    throw new Error('not implemented');
  }
}

module.exports = IUsersRepository;
