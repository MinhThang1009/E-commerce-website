// Unit tests cho authDto (src/modules/auth/dtos/authDto.js)
// Covers: toAuthUserDto — null input, user với toJSON(), user plain object

const { toAuthUserDto } = require('./auth-dto');

describe('toAuthUserDto', () => {
  it('trả về null khi user = null', () => {
    expect(toAuthUserDto(null)).toBeNull();
  });

  it('trả về null khi user = undefined', () => {
    expect(toAuthUserDto(undefined)).toBeNull();
  });

  it('gọi toJSON() khi user có phương thức toJSON — covers line 8 (toJSON branch)', () => {
    const jsonData = { id: 1, email: 'user@example.com', role: 'customer' };
    const sequelizeUser = {
      id: 1,
      email: 'user@example.com',
      role: 'customer',
      password: 'hashed-secret', // sẽ bị strip bởi toJSON
      toJSON: jest.fn().mockReturnValue(jsonData),
    };

    const result = toAuthUserDto(sequelizeUser);

    expect(sequelizeUser.toJSON).toHaveBeenCalled();
    expect(result).toEqual(jsonData);
    // Password không bị lọc bởi DTO (toJSON xử lý), nhưng raw object không lộ
    expect(result).not.toHaveProperty('password');
  });

  it('spread object khi user không có toJSON — covers line 8 (spread branch)', () => {
    const plainUser = { id: 2, email: 'plain@example.com', role: 'admin' };

    const result = toAuthUserDto(plainUser);

    expect(result).toEqual(plainUser);
    expect(result).not.toBe(plainUser); // là copy, không phải reference gốc
  });

  it('toJSON trả về object đã loại bỏ trường nhạy cảm', () => {
    const user = {
      id: 3,
      email: 'secure@example.com',
      password: 'bcrypt-hash',
      otpCode: '123456',
      toJSON() {
        const { password: _pw, otpCode: _otp, ...safe } = this;
        return safe;
      },
    };

    const result = toAuthUserDto(user);

    expect(result.id).toBe(3);
    expect(result.email).toBe('secure@example.com');
    expect(result.password).toBeUndefined();
    expect(result.otpCode).toBeUndefined();
  });
});
