/**
 * @file usersController.js
 * @layer Controller
 * @module users
 * @description Xử lý HTTP request/response cho users
 */
const { toUserDto, toAddressDto } = require('../dtos/usersDto');

// Users Controller — parse req → call service → format res. Arrow function bound
// vào instance để truyền trực tiếp cho Express router không mất `this`.
class UsersController {
  constructor({ usersService }) {
    this.usersService = usersService;
  }

  updateProfile = async (req, res, next) => {
    try {
      const { firstName, lastName, phone, avatar } = req.body;
      const { user } = await this.usersService.updateProfile({
        userId: req.user.id,
        firstName, lastName, phone, avatar,
      });
      res.status(200).json({ status: 'success', data: toUserDto(user) });
    } catch (err) { next(err); }
  };

  changePassword = async (req, res, next) => {
    try {
      const { currentPassword, newPassword } = req.body;
      const result = await this.usersService.changePassword({
        userId: req.user.id, currentPassword, newPassword,
      });
      res.status(200).json({ status: 'success', message: result.message });
    } catch (err) { next(err); }
  };

  getAddresses = async (req, res, next) => {
    try {
      const { addresses } = await this.usersService.getAddresses({ userId: req.user.id });
      res.status(200).json({ status: 'success', data: addresses.map(toAddressDto) });
    } catch (err) { next(err); }
  };

  addAddress = async (req, res, next) => {
    try {
      const { address } = await this.usersService.addAddress({
        userId: req.user.id,
        addressData: req.body,
      });
      res.status(201).json({ status: 'success', data: toAddressDto(address) });
    } catch (err) { next(err); }
  };

  updateAddress = async (req, res, next) => {
    try {
      const { address } = await this.usersService.updateAddress({
        userId: req.user.id,
        addressId: req.params.id,
        addressData: req.body,
      });
      res.status(200).json({ status: 'success', data: toAddressDto(address) });
    } catch (err) { next(err); }
  };

  deleteAddress = async (req, res, next) => {
    try {
      const result = await this.usersService.deleteAddress({
        userId: req.user.id,
        addressId: req.params.id,
      });
      res.status(200).json({ status: 'success', message: result.message });
    } catch (err) { next(err); }
  };

  setDefaultAddress = async (req, res, next) => {
    try {
      const { address } = await this.usersService.setDefaultAddress({
        userId: req.user.id,
        addressId: req.params.id,
      });
      res.status(200).json({ status: 'success', data: toAddressDto(address) });
    } catch (err) { next(err); }
  };
}

module.exports = UsersController;
