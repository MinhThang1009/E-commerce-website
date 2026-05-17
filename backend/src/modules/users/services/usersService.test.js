// Mock redis trước khi require UsersService để tránh hit real Redis
jest.mock('../../../config/redis', () => ({
  getRedisClient: jest.fn(),
}));

const UsersService = require('./usersService');
const { getRedisClient } = require('../../../config/redis');

describe('UsersService', () => {
  let usersRepository;
  let service;

  beforeEach(() => {
    usersRepository = {
      findUserById: jest.fn(),
      saveUser: jest.fn((u) => Promise.resolve(u)),
      findAddressesByUserId: jest.fn(),
      countAddressesByUserId: jest.fn(),
      clearDefaultAddresses: jest.fn().mockResolvedValue(),
      createAddress: jest.fn(),
      findAddressByIdAndUserId: jest.fn(),
      saveAddress: jest.fn((a) => Promise.resolve(a)),
      deleteAddress: jest.fn().mockResolvedValue(),
      findLatestAddressByUserId: jest.fn(),
    };

    service = new UsersService({
      usersRepository,
      eventBus: { publish: jest.fn() },
      logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    });

    // Mặc định redis mock trả null (skip redis)
    getRedisClient.mockResolvedValue(null);
  });

  // -------- updateProfile --------

  describe('updateProfile', () => {
    test('user không tồn tại → 404', async () => {
      usersRepository.findUserById.mockResolvedValue(null);

      await expect(
        service.updateProfile({ userId: 99, firstName: 'A', lastName: 'B' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('cập nhật firstName và lastName', async () => {
      const user = { firstName: 'Cũ', lastName: 'Tên', phone: '09', avatar: 'old.jpg' };
      usersRepository.findUserById.mockResolvedValue(user);

      const result = await service.updateProfile({
        userId: 1, firstName: 'Mới', lastName: 'Họ',
      });

      expect(user.firstName).toBe('Mới');
      expect(user.lastName).toBe('Họ');
      expect(result.user).toBe(user);
    });

    test('phone=undefined → giữ nguyên phone cũ', async () => {
      const user = { firstName: 'A', lastName: 'B', phone: '0912345678', avatar: null };
      usersRepository.findUserById.mockResolvedValue(user);

      await service.updateProfile({ userId: 1, firstName: 'A', lastName: 'B' });

      expect(user.phone).toBe('0912345678');
    });

    test('phone=null → set phone thành null (xóa số)', async () => {
      const user = { firstName: 'A', lastName: 'B', phone: '0912345678', avatar: null };
      usersRepository.findUserById.mockResolvedValue(user);

      await service.updateProfile({ userId: 1, firstName: 'A', lastName: 'B', phone: null });

      expect(user.phone).toBeNull();
    });

    test('avatar không cung cấp → giữ avatar cũ', async () => {
      const user = { firstName: 'A', lastName: 'B', phone: null, avatar: 'existing.jpg' };
      usersRepository.findUserById.mockResolvedValue(user);

      await service.updateProfile({ userId: 1, firstName: 'A', lastName: 'B' });

      expect(user.avatar).toBe('existing.jpg');
    });

    test('avatar mới → cập nhật avatar', async () => {
      const user = { firstName: 'A', lastName: 'B', phone: null, avatar: 'old.jpg' };
      usersRepository.findUserById.mockResolvedValue(user);

      await service.updateProfile({ userId: 1, firstName: 'A', lastName: 'B', avatar: 'new.jpg' });

      expect(user.avatar).toBe('new.jpg');
    });

    test('gọi saveUser sau khi cập nhật', async () => {
      const user = { firstName: 'A', lastName: 'B', phone: null, avatar: null };
      usersRepository.findUserById.mockResolvedValue(user);

      await service.updateProfile({ userId: 1, firstName: 'X', lastName: 'Y' });

      expect(usersRepository.saveUser).toHaveBeenCalledWith(user);
    });
  });

  // -------- changePassword --------

  describe('changePassword', () => {
    test('user không tồn tại → 404', async () => {
      usersRepository.findUserById.mockResolvedValue(null);

      await expect(
        service.changePassword({ userId: 99, currentPassword: 'old', newPassword: 'new' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('mật khẩu hiện tại sai → 401', async () => {
      usersRepository.findUserById.mockResolvedValue({
        comparePassword: jest.fn().mockResolvedValue(false),
      });

      await expect(
        service.changePassword({ userId: 1, currentPassword: 'sai', newPassword: 'new' })
      ).rejects.toMatchObject({ statusCode: 401, message: expect.stringContaining('không đúng') });
    });

    test('đổi mật khẩu thành công → cập nhật password + trả message', async () => {
      const user = { comparePassword: jest.fn().mockResolvedValue(true) };
      usersRepository.findUserById.mockResolvedValue(user);

      const result = await service.changePassword({
        userId: 1, currentPassword: 'đúng', newPassword: 'mậtKhẩuMới',
      });

      expect(user.password).toBe('mậtKhẩuMới');
      expect(usersRepository.saveUser).toHaveBeenCalledWith(user);
      expect(result.message).toMatch(/thành công/);
    });

    test('đổi mật khẩu thành công + redis có → gọi redis.set với key pw_changed', async () => {
      const user = { comparePassword: jest.fn().mockResolvedValue(true) };
      usersRepository.findUserById.mockResolvedValue(user);
      const redisMock = { set: jest.fn().mockResolvedValue() };
      getRedisClient.mockResolvedValue(redisMock);

      await service.changePassword({ userId: 42, currentPassword: 'ok', newPassword: 'new' });

      expect(redisMock.set).toHaveBeenCalledWith(
        'pw_changed:42',
        expect.any(String),
        expect.objectContaining({ EX: expect.any(Number) })
      );
    });

    test('redis lỗi → không throw, tiếp tục return success', async () => {
      const user = { comparePassword: jest.fn().mockResolvedValue(true) };
      usersRepository.findUserById.mockResolvedValue(user);
      getRedisClient.mockRejectedValue(new Error('redis down'));

      await expect(
        service.changePassword({ userId: 1, currentPassword: 'ok', newPassword: 'new' })
      ).resolves.toMatchObject({ message: expect.stringContaining('thành công') });
    });
  });

  // -------- getAddresses --------

  describe('getAddresses', () => {
    test('trả về danh sách address của user', async () => {
      const addresses = [{ id: 1 }, { id: 2 }];
      usersRepository.findAddressesByUserId.mockResolvedValue(addresses);

      const result = await service.getAddresses({ userId: 5 });

      expect(usersRepository.findAddressesByUserId).toHaveBeenCalledWith(5);
      expect(result.addresses).toBe(addresses);
    });
  });

  // -------- addAddress --------

  describe('addAddress', () => {
    test('address đầu tiên → tự động set isDefault=true', async () => {
      usersRepository.countAddressesByUserId.mockResolvedValue(0);
      const newAddress = { id: 1, isDefault: true };
      usersRepository.createAddress.mockResolvedValue(newAddress);

      const result = await service.addAddress({
        userId: 1, addressData: { street: 'Số 1 Đường A' },
      });

      expect(usersRepository.createAddress).toHaveBeenCalledWith(
        expect.objectContaining({ isDefault: true })
      );
      expect(result.address).toBe(newAddress);
    });

    test('đã có address và isDefault=true → clear defaults cũ trước khi tạo mới', async () => {
      usersRepository.countAddressesByUserId.mockResolvedValue(2);
      usersRepository.createAddress.mockResolvedValue({ id: 3 });

      await service.addAddress({
        userId: 1, addressData: { street: 'Số 2', isDefault: true },
      });

      expect(usersRepository.clearDefaultAddresses).toHaveBeenCalledWith(1);
      expect(usersRepository.createAddress).toHaveBeenCalledWith(
        expect.objectContaining({ isDefault: true, userId: 1 })
      );
    });

    test('đã có address và isDefault không được set → không clear defaults', async () => {
      usersRepository.countAddressesByUserId.mockResolvedValue(1);
      usersRepository.createAddress.mockResolvedValue({ id: 2 });

      await service.addAddress({
        userId: 1, addressData: { street: 'Số 3' },
      });

      expect(usersRepository.clearDefaultAddresses).not.toHaveBeenCalled();
    });
  });

  // -------- updateAddress --------

  describe('updateAddress', () => {
    test('address không thuộc user → 404', async () => {
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(null);

      await expect(
        service.updateAddress({ userId: 1, addressId: 99, addressData: {} })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('cập nhật các trường của address', async () => {
      const address = { id: 1, street: 'Cũ', city: 'HN', isDefault: false };
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(address);

      await service.updateAddress({
        userId: 1, addressId: 1, addressData: { street: 'Mới', city: 'HCM' },
      });

      expect(address.street).toBe('Mới');
      expect(address.city).toBe('HCM');
      expect(usersRepository.saveAddress).toHaveBeenCalledWith(address);
    });

    test('isDefault=true + chưa là default → clear defaults cũ trước', async () => {
      const address = { id: 1, isDefault: false };
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(address);

      await service.updateAddress({
        userId: 1, addressId: 1, addressData: { isDefault: true },
      });

      expect(usersRepository.clearDefaultAddresses).toHaveBeenCalledWith(1);
    });

    test('isDefault=true + đã là default → không gọi clearDefaultAddresses', async () => {
      const address = { id: 1, isDefault: true };
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(address);

      await service.updateAddress({
        userId: 1, addressId: 1, addressData: { isDefault: true },
      });

      expect(usersRepository.clearDefaultAddresses).not.toHaveBeenCalled();
    });
  });

  // -------- deleteAddress --------

  describe('deleteAddress', () => {
    test('address không thuộc user → 404', async () => {
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(null);

      await expect(
        service.deleteAddress({ userId: 1, addressId: 99 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('xóa address không phải default → không promote address khác', async () => {
      usersRepository.findAddressByIdAndUserId.mockResolvedValue({ id: 1, isDefault: false });

      const result = await service.deleteAddress({ userId: 1, addressId: 1 });

      expect(usersRepository.deleteAddress).toHaveBeenCalled();
      expect(usersRepository.findLatestAddressByUserId).not.toHaveBeenCalled();
      expect(result.message).toMatch(/thành công/);
    });

    test('xóa default address → promote address tiếp theo làm default', async () => {
      usersRepository.findAddressByIdAndUserId.mockResolvedValue({ id: 1, isDefault: true });
      const nextAddress = { id: 2, isDefault: false };
      usersRepository.findLatestAddressByUserId.mockResolvedValue(nextAddress);

      await service.deleteAddress({ userId: 1, addressId: 1 });

      expect(nextAddress.isDefault).toBe(true);
      expect(usersRepository.saveAddress).toHaveBeenCalledWith(nextAddress);
    });

    test('xóa default address + không còn address nào → không throw', async () => {
      usersRepository.findAddressByIdAndUserId.mockResolvedValue({ id: 1, isDefault: true });
      usersRepository.findLatestAddressByUserId.mockResolvedValue(null);

      await expect(
        service.deleteAddress({ userId: 1, addressId: 1 })
      ).resolves.toMatchObject({ message: expect.stringContaining('thành công') });

      expect(usersRepository.saveAddress).not.toHaveBeenCalled();
    });
  });

  // -------- setDefaultAddress --------

  describe('setDefaultAddress', () => {
    test('address không tồn tại → 404', async () => {
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(null);

      await expect(
        service.setDefaultAddress({ userId: 1, addressId: 99 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('set default → clear cũ + đặt isDefault=true + save', async () => {
      const address = { id: 5, isDefault: false };
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(address);

      const result = await service.setDefaultAddress({ userId: 1, addressId: 5 });

      expect(usersRepository.clearDefaultAddresses).toHaveBeenCalledWith(1);
      expect(address.isDefault).toBe(true);
      expect(usersRepository.saveAddress).toHaveBeenCalledWith(address);
      expect(result.address).toBe(address);
    });
  });
});
