const UsersService = require('./users-service');

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
  });

  // -------- updateProfile --------

  describe('updateProfile', () => {
    test('user không tồn tại → 404', async () => {
      usersRepository.findUserById.mockResolvedValue(null);

      await expect(
        service.updateProfile({ userId: 99, firstName: 'A', lastName: 'B' }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('cập nhật firstName và lastName', async () => {
      const user = { firstName: 'Cũ', lastName: 'Tên', phone: '09', avatar: 'old.jpg' };
      usersRepository.findUserById.mockResolvedValue(user);

      const result = await service.updateProfile({
        userId: 1,
        firstName: 'Mới',
        lastName: 'Họ',
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
        service.changePassword({ userId: 99, currentPassword: 'old', newPassword: 'new' }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('mật khẩu hiện tại sai → 401', async () => {
      usersRepository.findUserById.mockResolvedValue({
        comparePassword: jest.fn().mockResolvedValue(false),
      });

      await expect(
        service.changePassword({ userId: 1, currentPassword: 'sai', newPassword: 'new' }),
      ).rejects.toMatchObject({ statusCode: 401, message: 'users.wrongPassword' });
    });

    test('đổi mật khẩu thành công → cập nhật password + trả message', async () => {
      const user = { comparePassword: jest.fn().mockResolvedValue(true) };
      usersRepository.findUserById.mockResolvedValue(user);

      const result = await service.changePassword({
        userId: 1,
        currentPassword: 'đúng',
        newPassword: 'mậtKhẩuMới',
      });

      expect(user.password).toBe('mậtKhẩuMới');
      expect(usersRepository.saveUser).toHaveBeenCalledWith(user);
      expect(result.message).toBe('users.changePasswordSuccess');
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
        userId: 1,
        addressData: { street: 'Số 1 Đường A' },
      });

      expect(usersRepository.createAddress).toHaveBeenCalledWith(
        expect.objectContaining({ isDefault: true }),
      );
      expect(result.address).toBe(newAddress);
    });

    test('đã có address và isDefault=true → clear defaults cũ trước khi tạo mới', async () => {
      usersRepository.countAddressesByUserId.mockResolvedValue(2);
      usersRepository.createAddress.mockResolvedValue({ id: 3 });

      await service.addAddress({
        userId: 1,
        addressData: { street: 'Số 2', isDefault: true },
      });

      expect(usersRepository.clearDefaultAddresses).toHaveBeenCalledWith(1);
      expect(usersRepository.createAddress).toHaveBeenCalledWith(
        expect.objectContaining({ isDefault: true, userId: 1 }),
      );
    });

    test('đã có address và isDefault không được set → không clear defaults', async () => {
      usersRepository.countAddressesByUserId.mockResolvedValue(1);
      usersRepository.createAddress.mockResolvedValue({ id: 2 });

      await service.addAddress({
        userId: 1,
        addressData: { street: 'Số 3' },
      });

      expect(usersRepository.clearDefaultAddresses).not.toHaveBeenCalled();
    });
  });

  // -------- updateAddress --------

  describe('updateAddress', () => {
    test('address không thuộc user → 404', async () => {
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(null);

      await expect(
        service.updateAddress({ userId: 1, addressId: 99, addressData: {} }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('cập nhật các trường của address', async () => {
      const address = { id: 1, street: 'Cũ', city: 'HN', isDefault: false };
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(address);

      await service.updateAddress({
        userId: 1,
        addressId: 1,
        addressData: { street: 'Mới', city: 'HCM' },
      });

      expect(address.street).toBe('Mới');
      expect(address.city).toBe('HCM');
      expect(usersRepository.saveAddress).toHaveBeenCalledWith(address);
    });

    test('isDefault=true + chưa là default → clear defaults cũ trước', async () => {
      const address = { id: 1, isDefault: false };
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(address);

      await service.updateAddress({
        userId: 1,
        addressId: 1,
        addressData: { isDefault: true },
      });

      expect(usersRepository.clearDefaultAddresses).toHaveBeenCalledWith(1);
    });

    test('isDefault=true + đã là default → không gọi clearDefaultAddresses', async () => {
      const address = { id: 1, isDefault: true };
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(address);

      await service.updateAddress({
        userId: 1,
        addressId: 1,
        addressData: { isDefault: true },
      });

      expect(usersRepository.clearDefaultAddresses).not.toHaveBeenCalled();
    });
  });

  // -------- deleteAddress --------

  describe('deleteAddress', () => {
    test('address không thuộc user → 404', async () => {
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(null);

      await expect(service.deleteAddress({ userId: 1, addressId: 99 })).rejects.toMatchObject({
        statusCode: 404,
      });
    });

    test('xóa address không phải default → không promote address khác', async () => {
      usersRepository.findAddressByIdAndUserId.mockResolvedValue({ id: 1, isDefault: false });

      const result = await service.deleteAddress({ userId: 1, addressId: 1 });

      expect(usersRepository.deleteAddress).toHaveBeenCalled();
      expect(usersRepository.findLatestAddressByUserId).not.toHaveBeenCalled();
      expect(result.message).toBe('users.deleteAddressSuccess');
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

      await expect(service.deleteAddress({ userId: 1, addressId: 1 })).resolves.toMatchObject({
        message: 'users.deleteAddressSuccess',
      });

      expect(usersRepository.saveAddress).not.toHaveBeenCalled();
    });
  });

  // -------- setDefaultAddress --------

  describe('setDefaultAddress', () => {
    test('address không tồn tại → 404', async () => {
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(null);

      await expect(service.setDefaultAddress({ userId: 1, addressId: 99 })).rejects.toMatchObject({
        statusCode: 404,
      });
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

// -------- users-service.unit (additional coverage) --------

describe('UsersService — unit (additional coverage)', () => {
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
      await expect(service.updateProfile({ userId: 1, firstName: 'A' })).rejects.toMatchObject({
        statusCode: 404,
      });
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
        service.changePassword({ userId: 1, currentPassword: 'a', newPassword: 'b' }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('mật khẩu hiện tại sai → 401', async () => {
      usersRepository.findUserById.mockResolvedValue({
        comparePassword: jest.fn().mockResolvedValue(false),
      });
      await expect(
        service.changePassword({ userId: 1, currentPassword: 'wrong', newPassword: 'new' }),
      ).rejects.toMatchObject({ statusCode: 401 });
    });

    test('mật khẩu đúng → cập nhật + save', async () => {
      const user = {
        comparePassword: jest.fn().mockResolvedValue(true),
      };
      usersRepository.findUserById.mockResolvedValue(user);

      const result = await service.changePassword({
        userId: 1,
        currentPassword: 'old',
        newPassword: 'newSecret',
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
        expect.objectContaining({ city: 'HN', isDefault: true, userId: 1 }),
      );
    });

    test('address thứ 2 không request default → KHÔNG clear default cũ', async () => {
      usersRepository.countAddressesByUserId.mockResolvedValue(1);
      usersRepository.createAddress.mockResolvedValue({ id: 2 });

      await service.addAddress({ userId: 1, addressData: { city: 'HCM' } });

      expect(usersRepository.clearDefaultAddresses).not.toHaveBeenCalled();
      expect(usersRepository.createAddress).toHaveBeenCalledWith(
        expect.objectContaining({ city: 'HCM', userId: 1 }),
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
        service.updateAddress({ userId: 1, addressId: 5, addressData: { city: 'X' } }),
      ).rejects.toMatchObject({ statusCode: 404 });
    });

    test('set isDefault=true cho address chưa default → clear default cũ', async () => {
      const address = { isDefault: false };
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(address);

      await service.updateAddress({
        userId: 1,
        addressId: 5,
        addressData: { isDefault: true, city: 'HP' },
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
        userId: 1,
        addressId: 5,
        addressData: { isDefault: true },
      });

      expect(usersRepository.clearDefaultAddresses).not.toHaveBeenCalled();
    });
  });

  describe('deleteAddress', () => {
    test('không tìm thấy → 404', async () => {
      usersRepository.findAddressByIdAndUserId.mockResolvedValue(null);
      await expect(service.deleteAddress({ userId: 1, addressId: 5 })).rejects.toMatchObject({
        statusCode: 404,
      });
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
      await expect(service.setDefaultAddress({ userId: 1, addressId: 5 })).rejects.toMatchObject({
        statusCode: 404,
      });
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
