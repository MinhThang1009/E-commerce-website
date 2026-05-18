// Phase 42.3 — Unit tests cho UsersService (modules/users)
// Mock toàn bộ usersRepository → test pure business logic không hit DB.

const UsersService = require('./users-service');

describe('UsersService', () => {
  let usersRepository;
  let eventBus;
  let logger;
  let service;

  beforeEach(() => {
    usersRepository = {
      findUserById: jest.fn(),
      saveUser: jest.fn((u) => Promise.resolve(u)),
      findAddressesByUserId: jest.fn(),
      findAddressByIdAndUserId: jest.fn(),
      countAddressesByUserId: jest.fn(),
      createAddress: jest.fn(),
      saveAddress: jest.fn((a) => Promise.resolve(a)),
      deleteAddress: jest.fn().mockResolvedValue(),
      clearDefaultAddresses: jest.fn().mockResolvedValue(),
      findLatestAddressByUserId: jest.fn(),
    };
    eventBus = { publish: jest.fn().mockResolvedValue() };
    logger = { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() };

    service = new UsersService({ usersRepository, eventBus, logger });
  });

  describe('updateProfile', () => {
    test('user không tồn tại → 404', async () => {
      usersRepository.findUserById.mockResolvedValue(null);
      await expect(
        service.updateProfile({ userId: 1, firstName: 'A' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('cập nhật field cung cấp, giữ nguyên field cũ nếu thiếu', async () => {
      const user = { firstName: 'Old', lastName: 'Name', phone: '0900', avatar: 'a.png' };
      usersRepository.findUserById.mockResolvedValue(user);

      await service.updateProfile({ userId: 1, firstName: 'New', avatar: 'b.png' });

      expect(user.firstName).toBe('New');
      expect(user.lastName).toBe('Name');
      expect(user.avatar).toBe('b.png');
      expect(usersRepository.saveUser).toHaveBeenCalledWith(user);
    });

    test('phone undefined → giữ nguyên; phone empty string "" → cập nhật thành ""', async () => {
      const user = { phone: '0900' };
      usersRepository.findUserById.mockResolvedValue(user);

      await service.updateProfile({ userId: 1, phone: '' });
      expect(user.phone).toBe('');
    });
  });

  describe('changePassword', () => {
    test('user không tồn tại → 404', async () => {
      usersRepository.findUserById.mockResolvedValue(null);
      await expect(
        service.changePassword({ userId: 1, currentPassword: 'a', newPassword: 'b' })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('mật khẩu hiện tại sai → 401', async () => {
      usersRepository.findUserById.mockResolvedValue({
        comparePassword: jest.fn().mockResolvedValue(false),
      });
      await expect(
        service.changePassword({ userId: 1, currentPassword: 'wrong', newPassword: 'new' })
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    test('mật khẩu đúng → cập nhật + save', async () => {
      const user = {
        comparePassword: jest.fn().mockResolvedValue(true),
      };
      usersRepository.findUserById.mockResolvedValue(user);

      const result = await service.changePassword({
        userId: 1, currentPassword: 'old', newPassword: 'newSecret',
      });

      expect(user.password).toBe('newSecret');
      expect(usersRepository.saveUser).toHaveBeenCalledWith(user);
      expect(result.message).toBe('users.changePasswordSuccess');
    });
  });

  describe('getAddresses', () => {
    test('trả danh sách addresses', async () => {
      const addresses = [{ id: 1 }, { id: 2 }];
      usersRepository.findAddressesByUserId.mockResolvedValue(addresses);

      const result = await service.getAddresses({ userId: 7 });

      expect(usersRepository.findAddressesByUserId).toHaveBeenCalledWith(7);
      expect(result.addresses).toBe(addresses);
    });
  });

  describe('addAddress', () => {
    test('address đầu tiên → auto-set isDefault=true (không cần clearDefault)', async () => {
      usersRepository.countAddressesByUserId.mockResolvedValue(0);
      usersRepository.createAddress.mockResolvedValue({ id: 1, isDefault: true });

      await service.addAddress({ userId: 1, addressData: { city: 'HN' } });

      expect(usersRepository.clearDefaultAddresses).toHaveBeenCalled();
      expect(usersRepository.createAddress).toHaveBeenCalledWith(
        expect.objectContaining({ city: 'HN', isDefault: true, userId: 1 })
      );
    });

    test('address thứ 2 không request default → KHÔNG clear default cũ', async () => {
      usersRepository.countAddressesByUserId.mockResolvedValue(1);
      usersRepository.createAddress.mockResolvedValue({ id: 2 });

      await service.addAddress({ userId: 1, addressData: { city: 'HCM' } });

      expect(usersRepository.clearDefaultAddresses).not.toHaveBeenCalled();
      expect(usersRepository.createAddress).toHaveBeenCalledWith(
        expect.objectContaining({ city: 'HCM', userId: 1 })
      );
    });

    test('address thứ 2 request isDefault=true → clear default cũ trước', async () => {
      usersRepository.countAddressesByUserId.mockResolvedValue(1);
      usersRepository.createAddress.mockResolvedValue({ id: 2, isDefault: true });

      await service.addAddress({ userId: 1, addressData: { city: 'HCM', isDefault: true } });

      expect(usersRepository.clearDefaultAddresses).toHaveBeenCalledWith(1);
    });
  });

  describe('updateAddress', () => {
    test('không tìm thấy address → 404', async () => {
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(null);
      await expect(
        service.updateAddress({ userId: 1, addressId: 5, addressData: { city: 'X' } })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('set isDefault=true cho address chưa default → clear default cũ', async () => {
      const address = { isDefault: false };
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(address);

      await service.updateAddress({
        userId: 1, addressId: 5, addressData: { isDefault: true, city: 'HP' },
      });

      expect(usersRepository.clearDefaultAddresses).toHaveBeenCalledWith(1);
      expect(address.city).toBe('HP');
      expect(address.isDefault).toBe(true);
      expect(usersRepository.saveAddress).toHaveBeenCalledWith(address);
    });

    test('address đã default + request isDefault=true → KHÔNG gọi clear (idempotent)', async () => {
      const address = { isDefault: true };
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(address);

      await service.updateAddress({
        userId: 1, addressId: 5, addressData: { isDefault: true },
      });

      expect(usersRepository.clearDefaultAddresses).not.toHaveBeenCalled();
    });
  });

  describe('deleteAddress', () => {
    test('không tìm thấy → 404', async () => {
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(null);
      await expect(
        service.deleteAddress({ userId: 1, addressId: 5 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('xóa address không default → không promote address khác', async () => {
      const address = { isDefault: false };
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(address);

      const result = await service.deleteAddress({ userId: 1, addressId: 5 });

      expect(usersRepository.deleteAddress).toHaveBeenCalledWith(address);
      expect(usersRepository.findLatestAddressByUserId).not.toHaveBeenCalled();
      expect(result.message).toBe('users.deleteAddressSuccess');
    });

    test('xóa address default + còn address khác → promote address mới nhất làm default', async () => {
      const deleted = { isDefault: true };
      const next = { isDefault: false };
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(deleted);
      usersRepository.findLatestAddressByUserId.mockResolvedValue(next);

      await service.deleteAddress({ userId: 1, addressId: 5 });

      expect(usersRepository.deleteAddress).toHaveBeenCalledWith(deleted);
      expect(next.isDefault).toBe(true);
      expect(usersRepository.saveAddress).toHaveBeenCalledWith(next);
    });

    test('xóa address default cuối cùng → không promote (không còn address)', async () => {
      const deleted = { isDefault: true };
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(deleted);
      usersRepository.findLatestAddressByUserId.mockResolvedValue(null);

      await service.deleteAddress({ userId: 1, addressId: 5 });

      expect(usersRepository.saveAddress).not.toHaveBeenCalled();
    });
  });

  describe('setDefaultAddress', () => {
    test('không tìm thấy → 404', async () => {
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(null);
      await expect(
        service.setDefaultAddress({ userId: 1, addressId: 5 })
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('clear default cũ + set address này làm default + save', async () => {
      const address = { isDefault: false };
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(address);

      const result = await service.setDefaultAddress({ userId: 1, addressId: 5 });

      expect(usersRepository.clearDefaultAddresses).toHaveBeenCalledWith(1);
      expect(address.isDefault).toBe(true);
      expect(usersRepository.saveAddress).toHaveBeenCalledWith(address);
      expect(result.address).toBe(address);
    });
  });
});
