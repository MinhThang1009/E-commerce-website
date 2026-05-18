const UsersController = require('./users-controller');

// toUserDto và toAddressDto là pass-through khi user/address không có toJSON
// → test controller behavior mà không cần mock dtos

describe('UsersController', () => {
  let usersService;
  let controller;
  let res;
  let next;

  beforeEach(() => {
    usersService = {
      updateProfile: jest.fn(),
      changePassword: jest.fn(),
      getAddresses: jest.fn(),
      addAddress: jest.fn(),
      updateAddress: jest.fn(),
      deleteAddress: jest.fn(),
      setDefaultAddress: jest.fn(),
    };
    controller = new UsersController({ usersService });

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  // Helper: tạo plain object user (toUserDto trả {...user})
  const mkUser = (overrides = {}) => ({ id: 1, firstName: 'A', lastName: 'B', ...overrides });
  const mkAddress = (overrides = {}) => ({ id: 10, street: 'Số 1', ...overrides });

  // -------- updateProfile --------

  describe('updateProfile', () => {
    test('trả về 200 với user DTO khi cập nhật thành công', async () => {
      const user = mkUser();
      usersService.updateProfile.mockResolvedValue({ user });

      const req = {
        user: { id: 1 },
        body: { firstName: 'A', lastName: 'B', phone: '09', avatar: null },
      };
      await controller.updateProfile(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data: expect.objectContaining({ id: 1 }) });
    });

    test('truyền đúng tất cả fields từ body vào service', async () => {
      usersService.updateProfile.mockResolvedValue({ user: mkUser() });

      const req = {
        user: { id: 5 },
        body: { firstName: 'Tên', lastName: 'Họ', phone: '0911', avatar: 'avatar.jpg' },
      };
      await controller.updateProfile(req, res, next);

      expect(usersService.updateProfile).toHaveBeenCalledWith({
        userId: 5, firstName: 'Tên', lastName: 'Họ', phone: '0911', avatar: 'avatar.jpg',
      });
    });

    test('gọi next(err) khi service throw', async () => {
      const err = new Error('not found');
      usersService.updateProfile.mockRejectedValue(err);

      await controller.updateProfile({ user: { id: 1 }, body: {} }, res, next);

      expect(next).toHaveBeenCalledWith(err);
      expect(res.status).not.toHaveBeenCalled();
    });
  });

  // -------- changePassword --------

  describe('changePassword', () => {
    test('trả về 200 với message khi đổi mật khẩu thành công', async () => {
      usersService.changePassword.mockResolvedValue({ message: 'Đổi mật khẩu thành công' });

      const req = {
        user: { id: 1 },
        body: { currentPassword: 'cũ', newPassword: 'mới' },
      };
      await controller.changePassword(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', message: 'Đổi mật khẩu thành công' });
    });

    test('truyền đúng userId + currentPassword + newPassword vào service', async () => {
      usersService.changePassword.mockResolvedValue({ message: 'ok' });

      const req = {
        user: { id: 3 },
        body: { currentPassword: 'pass123', newPassword: 'newPass456' },
      };
      await controller.changePassword(req, res, next);

      expect(usersService.changePassword).toHaveBeenCalledWith({
        userId: 3, currentPassword: 'pass123', newPassword: 'newPass456',
      });
    });

    test('gọi next(err) khi mật khẩu cũ sai (service throw)', async () => {
      const err = new Error('401');
      usersService.changePassword.mockRejectedValue(err);

      await controller.changePassword({ user: { id: 1 }, body: {} }, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // -------- getAddresses --------

  describe('getAddresses', () => {
    test('trả về 200 với mảng addresses đã map qua dto', async () => {
      const addresses = [mkAddress({ id: 1 }), mkAddress({ id: 2 })];
      usersService.getAddresses.mockResolvedValue({ addresses });

      const req = { user: { id: 1 } };
      await controller.getAddresses(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      const jsonArg = res.json.mock.calls[0][0];
      expect(jsonArg.data).toHaveLength(2);
      expect(jsonArg.data[0]).toMatchObject({ id: 1 });
    });

    test('gọi next(err) khi service throw', async () => {
      const err = new Error('db fail');
      usersService.getAddresses.mockRejectedValue(err);

      await controller.getAddresses({ user: { id: 1 } }, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // -------- addAddress --------

  describe('addAddress', () => {
    test('trả về 201 với address mới', async () => {
      const address = mkAddress({ id: 5 });
      usersService.addAddress.mockResolvedValue({ address });

      const req = {
        user: { id: 1 },
        body: { street: 'Số 5', city: 'Hà Nội', isDefault: false },
      };
      await controller.addAddress(req, res, next);

      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data: expect.objectContaining({ id: 5 }) });
    });

    test('truyền toàn bộ body làm addressData', async () => {
      usersService.addAddress.mockResolvedValue({ address: mkAddress() });

      const body = { street: 'Đường B', city: 'HCM', isDefault: true };
      const req = { user: { id: 2 }, body };
      await controller.addAddress(req, res, next);

      expect(usersService.addAddress).toHaveBeenCalledWith({ userId: 2, addressData: body });
    });

    test('gọi next(err) khi service throw', async () => {
      const err = new Error('oops');
      usersService.addAddress.mockRejectedValue(err);

      await controller.addAddress({ user: { id: 1 }, body: {} }, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // -------- updateAddress --------

  describe('updateAddress', () => {
    test('trả về 200 với address đã cập nhật', async () => {
      const address = mkAddress({ street: 'Mới' });
      usersService.updateAddress.mockResolvedValue({ address });

      const req = {
        user: { id: 1 },
        params: { id: '10' },
        body: { street: 'Mới' },
      };
      await controller.updateAddress(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', data: expect.objectContaining({ street: 'Mới' }) });
    });

    test('truyền addressId từ params.id vào service', async () => {
      usersService.updateAddress.mockResolvedValue({ address: mkAddress() });

      const req = {
        user: { id: 1 }, params: { id: '20' }, body: { city: 'Đà Nẵng' },
      };
      await controller.updateAddress(req, res, next);

      expect(usersService.updateAddress).toHaveBeenCalledWith(
        expect.objectContaining({ addressId: '20' })
      );
    });

    test('gọi next(err) khi service throw', async () => {
      const err = new Error('not found');
      usersService.updateAddress.mockRejectedValue(err);

      await controller.updateAddress({ user: { id: 1 }, params: { id: '1' }, body: {} }, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // -------- deleteAddress --------

  describe('deleteAddress', () => {
    test('trả về 200 với message khi xóa thành công', async () => {
      usersService.deleteAddress.mockResolvedValue({ message: 'Xóa địa chỉ thành công' });

      const req = { user: { id: 1 }, params: { id: '10' } };
      await controller.deleteAddress(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ status: 'success', message: 'Xóa địa chỉ thành công' });
    });

    test('truyền đúng userId + addressId vào service', async () => {
      usersService.deleteAddress.mockResolvedValue({ message: 'ok' });

      const req = { user: { id: 7 }, params: { id: '33' } };
      await controller.deleteAddress(req, res, next);

      expect(usersService.deleteAddress).toHaveBeenCalledWith({ userId: 7, addressId: '33' });
    });

    test('gọi next(err) khi service throw', async () => {
      const err = new Error('404');
      usersService.deleteAddress.mockRejectedValue(err);

      await controller.deleteAddress({ user: { id: 1 }, params: { id: '1' } }, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });

  // -------- setDefaultAddress --------

  describe('setDefaultAddress', () => {
    test('trả về 200 với address được set làm default', async () => {
      const address = mkAddress({ isDefault: true });
      usersService.setDefaultAddress.mockResolvedValue({ address });

      const req = { user: { id: 1 }, params: { id: '10' } };
      await controller.setDefaultAddress(req, res, next);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        status: 'success',
        data: expect.objectContaining({ isDefault: true }),
      });
    });

    test('gọi next(err) khi service throw', async () => {
      const err = new Error('not found');
      usersService.setDefaultAddress.mockRejectedValue(err);

      await controller.setDefaultAddress({ user: { id: 1 }, params: { id: '99' } }, res, next);

      expect(next).toHaveBeenCalledWith(err);
    });
  });
});
