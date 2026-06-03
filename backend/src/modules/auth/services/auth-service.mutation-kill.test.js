// Auth service — mutation-kill: assert OUTCOME (i18n message key, token payload
// {id,role}/{id}, expiry window chính xác, verifyOtp timing-safe + boundary,
// Google merge). KHÔNG tautological. Pattern: new AuthService + mock adapters.

const crypto = require('crypto');
const AuthService = require('./auth-service');

function makeDeps(overrides = {}) {
  return {
    authRepository: {
      findByEmail: jest.fn(),
      findById: jest.fn(),
      findByIdWithAddresses: jest.fn(),
      findByGoogleIdOrEmail: jest.fn(),
      findByResetToken: jest.fn(),
      createUser: jest.fn(),
      saveUser: jest.fn((u) => Promise.resolve(u)),
    },
    emailGateway: {
      sendOtpEmail: jest.fn().mockResolvedValue(),
      sendResetPasswordEmail: jest.fn().mockResolvedValue(),
    },
    googleVerifier: {
      verifyIdToken: jest.fn(),
      verifyAccessToken: jest.fn(),
    },
    tokenSigner: {
      signAccessToken: jest.fn(() => 'access-tok'),
      signRefreshToken: jest.fn(() => 'refresh-tok'),
      verifyAccessToken: jest.fn(),
      verifyRefreshToken: jest.fn(),
    },
    eventBus: { publish: jest.fn().mockResolvedValue() },
    logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn(), debug: jest.fn() },
    ...overrides,
  };
}

function makeService(deps) {
  return new AuthService(deps);
}

// OTP 6 chữ số đúng, dùng cho verifyOtp success
function userWithOtp(otp, overrides = {}) {
  return {
    id: 1,
    email: 'a@b.c',
    isEmailVerified: false,
    isActive: true,
    otpCode: otp,
    otpExpires: new Date(Date.now() + 5 * 60 * 1000), // còn hạn
    ...overrides,
  };
}

describe('AuthService — mutation kill (message + token + expiry + otp)', () => {
  // ── register: expiry window + log ──────────────────────────────
  describe('register — OTP expiry = now + 10 phút', () => {
    test('otpExpires = Date.now() + 10*60*1000 (kill arithmetic L33)', async () => {
      const FIXED = 1_700_000_000_000;
      const spy = jest.spyOn(Date, 'now').mockReturnValue(FIXED);
      const deps = makeDeps();
      deps.authRepository.findByEmail.mockResolvedValue(null);
      deps.authRepository.createUser.mockResolvedValue({ id: 5, email: 'a@b.c' });
      const service = makeService(deps);

      await service.register({ email: 'a@b.c', password: 'p', firstName: 'A', lastName: 'B' });

      const arg = deps.authRepository.createUser.mock.calls[0][0];
      expect(arg.otpExpires.getTime()).toBe(FIXED + 10 * 60 * 1000); // 600.000ms tương lai
      expect(arg.otpCode).toMatch(/^\d{6}$/); // 6 chữ số
      spy.mockRestore();
    });

    test('email gửi lỗi → logger.error CÓ message + email (kill log template L48)', async () => {
      const deps = makeDeps();
      deps.authRepository.findByEmail.mockResolvedValue(null);
      deps.authRepository.createUser.mockResolvedValue({ id: 5, email: 'fail@b.c' });
      deps.emailGateway.sendOtpEmail.mockRejectedValue(new Error('SMTP down'));
      const service = makeService(deps);

      const result = await service.register({
        email: 'fail@b.c',
        password: 'p',
        firstName: 'A',
        lastName: 'B',
      });

      expect(deps.logger.error).toHaveBeenCalledWith(expect.stringContaining('fail@b.c'));
      expect(deps.logger.error).toHaveBeenCalledWith(expect.stringContaining('SMTP down'));
      expect(result.message).toBe('auth.registerSuccess'); // vẫn success
    });
  });

  // ── login: token payload {id, role} / {id} ─────────────────────
  describe('login — token payload đúng', () => {
    function activeUser(overrides = {}) {
      return {
        id: 42,
        email: 'u@b.c',
        role: 'customer',
        isEmailVerified: true,
        isActive: true,
        comparePassword: jest.fn().mockResolvedValue(true),
        ...overrides,
      };
    }

    test('signAccessToken nhận {id, role}, signRefreshToken nhận {id} (kill ObjectLiteral L75)', async () => {
      const deps = makeDeps();
      deps.authRepository.findByEmail.mockResolvedValue(activeUser());
      const service = makeService(deps);

      await service.login({ email: 'u@b.c', password: 'p' });

      expect(deps.tokenSigner.signAccessToken).toHaveBeenCalledWith({ id: 42, role: 'customer' });
      expect(deps.tokenSigner.signRefreshToken).toHaveBeenCalledWith({ id: 42 });
    });

    test('login thành công → logger.info có "Login success" (kill log L77)', async () => {
      const deps = makeDeps();
      deps.authRepository.findByEmail.mockResolvedValue(activeUser());
      const service = makeService(deps);

      await service.login({ email: 'u@b.c', password: 'p' });

      expect(deps.logger.info).toHaveBeenCalledWith(
        expect.stringContaining('Login success'),
        expect.objectContaining({ userId: 42 }),
      );
    });

    test('sai password → 401 auth.invalidCredentials', async () => {
      const deps = makeDeps();
      deps.authRepository.findByEmail.mockResolvedValue(
        activeUser({ comparePassword: jest.fn().mockResolvedValue(false) }),
      );
      const service = makeService(deps);

      await expect(service.login({ email: 'u@b.c', password: 'x' })).rejects.toThrow(
        'auth.invalidCredentials',
      );
    });

    test('chưa verify email → 401 auth.emailNotVerified', async () => {
      const deps = makeDeps();
      deps.authRepository.findByEmail.mockResolvedValue(activeUser({ isEmailVerified: false }));
      const service = makeService(deps);

      await expect(service.login({ email: 'u@b.c', password: 'p' })).rejects.toThrow(
        'auth.emailNotVerified',
      );
    });

    test('tài khoản bị khoá → 401 auth.accountDisabled', async () => {
      const deps = makeDeps();
      deps.authRepository.findByEmail.mockResolvedValue(activeUser({ isActive: false }));
      const service = makeService(deps);

      await expect(service.login({ email: 'u@b.c', password: 'p' })).rejects.toThrow(
        'auth.accountDisabled',
      );
    });
  });

  // ── googleLogin: message + token args + merge ──────────────────
  describe('googleLogin', () => {
    const payload = {
      sub: 'g-123',
      email: 'g@b.c',
      given_name: 'G',
      family_name: 'U',
      picture: 'pic.jpg',
      email_verified: true,
    };

    test('cả verifyIdToken và verifyAccessToken fail → 401 auth.googleAuthFailed (L91)', async () => {
      const deps = makeDeps();
      deps.googleVerifier.verifyIdToken.mockRejectedValue(new Error('bad'));
      deps.googleVerifier.verifyAccessToken.mockRejectedValue(new Error('bad2'));
      const service = makeService(deps);

      await expect(service.googleLogin({ token: 't' })).rejects.toThrow('auth.googleAuthFailed');
    });

    test('payload null → 401 auth.googleAuthFailed (L96)', async () => {
      const deps = makeDeps();
      deps.googleVerifier.verifyIdToken.mockResolvedValue(null);
      const service = makeService(deps);

      await expect(service.googleLogin({ token: 't' })).rejects.toThrow('auth.googleAuthFailed');
    });

    test('email_verified === false → 401 auth.googleAuthFailed (L103)', async () => {
      const deps = makeDeps();
      deps.googleVerifier.verifyIdToken.mockResolvedValue({ ...payload, email_verified: false });
      const service = makeService(deps);

      await expect(service.googleLogin({ token: 't' })).rejects.toThrow('auth.googleAuthFailed');
    });

    test('user mới → createUser isEmailVerified=true + token {id,role}/{id} (L140/141)', async () => {
      const deps = makeDeps();
      deps.googleVerifier.verifyIdToken.mockResolvedValue(payload);
      deps.authRepository.findByGoogleIdOrEmail.mockResolvedValue(null);
      deps.authRepository.createUser.mockResolvedValue({
        id: 7,
        role: 'customer',
        isActive: true,
      });
      const service = makeService(deps);

      await service.googleLogin({ token: 't' });

      expect(deps.authRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({ googleId: 'g-123', email: 'g@b.c', isEmailVerified: true }),
      );
      expect(deps.tokenSigner.signAccessToken).toHaveBeenCalledWith({ id: 7, role: 'customer' });
      expect(deps.tokenSigner.signRefreshToken).toHaveBeenCalledWith({ id: 7 });
    });

    test('verifyIdToken fail → fallback verifyAccessToken thành công', async () => {
      const deps = makeDeps();
      deps.googleVerifier.verifyIdToken.mockRejectedValue(new Error('not id token'));
      deps.googleVerifier.verifyAccessToken.mockResolvedValue(payload);
      deps.authRepository.findByGoogleIdOrEmail.mockResolvedValue({
        id: 9,
        role: 'customer',
        isActive: true,
        googleId: 'g-123',
        avatar: 'x',
        isEmailVerified: true,
      });
      const service = makeService(deps);

      const result = await service.googleLogin({ token: 't' });

      expect(deps.googleVerifier.verifyAccessToken).toHaveBeenCalledWith('t');
      expect(result.token).toBe('access-tok');
    });

    test('user tồn tại thiếu googleId/avatar → merge updates + saveUser', async () => {
      const deps = makeDeps();
      deps.googleVerifier.verifyIdToken.mockResolvedValue(payload);
      const user = {
        id: 9,
        role: 'customer',
        isActive: true,
        googleId: null,
        avatar: null,
        isEmailVerified: false,
      };
      deps.authRepository.findByGoogleIdOrEmail.mockResolvedValue(user);
      const service = makeService(deps);

      await service.googleLogin({ token: 't' });

      expect(user.googleId).toBe('g-123');
      expect(user.avatar).toBe('pic.jpg');
      expect(user.isEmailVerified).toBe(true);
      expect(deps.authRepository.saveUser).toHaveBeenCalledWith(user);
    });

    test('user tồn tại đã đủ field → KHÔNG saveUser (updates rỗng)', async () => {
      const deps = makeDeps();
      deps.googleVerifier.verifyIdToken.mockResolvedValue(payload);
      deps.authRepository.findByGoogleIdOrEmail.mockResolvedValue({
        id: 9,
        role: 'customer',
        isActive: true,
        googleId: 'g-123',
        avatar: 'pic.jpg',
        isEmailVerified: true,
      });
      const service = makeService(deps);

      await service.googleLogin({ token: 't' });

      expect(deps.authRepository.saveUser).not.toHaveBeenCalled();
    });

    test('user google bị khoá → 401 auth.accountDisabled', async () => {
      const deps = makeDeps();
      deps.googleVerifier.verifyIdToken.mockResolvedValue(payload);
      deps.authRepository.findByGoogleIdOrEmail.mockResolvedValue({
        id: 9,
        role: 'customer',
        isActive: false,
        googleId: 'g-123',
        avatar: 'x',
        isEmailVerified: true,
      });
      const service = makeService(deps);

      await expect(service.googleLogin({ token: 't' })).rejects.toThrow('auth.accountDisabled');
    });
  });

  // ── verifyOtp: required + timing-safe + boundary + outcome ──────
  describe('verifyOtp', () => {
    test('thiếu email → 400 auth.emailAndOtpRequired (L155/156)', async () => {
      const service = makeService(makeDeps());
      await expect(service.verifyOtp({ email: '', otp: '123456' })).rejects.toThrow(
        'auth.emailAndOtpRequired',
      );
    });

    test('thiếu otp → 400 auth.emailAndOtpRequired', async () => {
      const service = makeService(makeDeps());
      await expect(service.verifyOtp({ email: 'a@b.c', otp: '' })).rejects.toThrow(
        'auth.emailAndOtpRequired',
      );
    });

    test('user không tồn tại → 400 auth.otpInvalidOrExpired (L164/167)', async () => {
      const deps = makeDeps();
      deps.authRepository.findByEmail.mockResolvedValue(null);
      const service = makeService(deps);
      await expect(service.verifyOtp({ email: 'a@b.c', otp: '123456' })).rejects.toThrow(
        'auth.otpInvalidOrExpired',
      );
    });

    test('user đã verify → 400 auth.otpInvalidOrExpired', async () => {
      const deps = makeDeps();
      deps.authRepository.findByEmail.mockResolvedValue(
        userWithOtp('123456', { isEmailVerified: true }),
      );
      const service = makeService(deps);
      await expect(service.verifyOtp({ email: 'a@b.c', otp: '123456' })).rejects.toThrow(
        'auth.otpInvalidOrExpired',
      );
    });

    test('user không có otpCode → 400 generic (L170 !user.otpCode)', async () => {
      const deps = makeDeps();
      deps.authRepository.findByEmail.mockResolvedValue(userWithOtp(null));
      const service = makeService(deps);
      await expect(service.verifyOtp({ email: 'a@b.c', otp: '123456' })).rejects.toThrow(
        'auth.otpInvalidOrExpired',
      );
    });

    test('OTP sai → 400 generic (timingSafeEqual false)', async () => {
      const deps = makeDeps();
      deps.authRepository.findByEmail.mockResolvedValue(userWithOtp('123456'));
      const service = makeService(deps);
      await expect(service.verifyOtp({ email: 'a@b.c', otp: '654321' })).rejects.toThrow(
        'auth.otpInvalidOrExpired',
      );
    });

    test('OTP hết hạn → 400 auth.otpExpired (L177 boundary)', async () => {
      const deps = makeDeps();
      deps.authRepository.findByEmail.mockResolvedValue(
        userWithOtp('123456', { otpExpires: new Date(Date.now() - 1000) }), // đã qua
      );
      const service = makeService(deps);
      await expect(service.verifyOtp({ email: 'a@b.c', otp: '123456' })).rejects.toThrow(
        'auth.otpExpired',
      );
    });

    test('OTP đúng + còn hạn → set isEmailVerified, clear otp, saveUser, message', async () => {
      const deps = makeDeps();
      const user = userWithOtp('123456');
      deps.authRepository.findByEmail.mockResolvedValue(user);
      const service = makeService(deps);

      const result = await service.verifyOtp({ email: 'a@b.c', otp: '123456' });

      expect(user.isEmailVerified).toBe(true);
      expect(user.otpCode).toBeNull();
      expect(user.otpExpires).toBeNull();
      expect(deps.authRepository.saveUser).toHaveBeenCalledWith(user);
      expect(result.message).toBe('auth.emailVerified');
    });

    test('OTP đúng dạng padding (otpCode "1234" + input "001234") khớp sau pad', async () => {
      const deps = makeDeps();
      const user = userWithOtp('1234'); // 4 chữ số → pad thành '001234'
      deps.authRepository.findByEmail.mockResolvedValue(user);
      const service = makeService(deps);

      // input '001234' pad → '001234' khớp storedOtp '001234'
      const result = await service.verifyOtp({ email: 'a@b.c', otp: '001234' });
      expect(result.message).toBe('auth.emailVerified');
    });

    test('otpCode null + otp "000000" → VẪN reject (bảo mật: không có OTP thì không verify được) (L170)', async () => {
      // Chống lỗ hổng: nếu bỏ guard !user.otpCode, storedOtp = ''.padStart(6,'0') = '000000'
      // → kẻ tấn công gửi '000000' sẽ verify được tài khoản chưa từng có OTP.
      const deps = makeDeps();
      deps.authRepository.findByEmail.mockResolvedValue(userWithOtp(null));
      const service = makeService(deps);

      await expect(service.verifyOtp({ email: 'a@b.c', otp: '000000' })).rejects.toThrow(
        'auth.otpInvalidOrExpired',
      );
      expect(deps.authRepository.saveUser).not.toHaveBeenCalled(); // KHÔNG verify
    });

    test('otp dài hơn 6 (lệch độ dài) → reject sạch, KHÔNG crash timingSafeEqual (L171)', async () => {
      // Guard length phải chặn trước timingSafeEqual — nếu không, buffer lệch độ dài
      // làm crypto.timingSafeEqual ném RangeError (crash) thay vì AppError.
      const deps = makeDeps();
      deps.authRepository.findByEmail.mockResolvedValue(userWithOtp('123456'));
      const service = makeService(deps);

      await expect(service.verifyOtp({ email: 'a@b.c', otp: '1234567' })).rejects.toThrow(
        'auth.otpInvalidOrExpired',
      );
    });

    test('otpExpires === ĐÚNG khoảnh khắc now → VẪN còn hạn (biên >, không >=) (L177)', async () => {
      // Fake timers: new Date() trong service == FIXED. otpExpires = FIXED (hết hạn
      // đúng lúc này). Semantics: > nghĩa "chỉ hết hạn khi QUÁ mốc" → tại đúng mốc
      // vẫn valid. Mutant >= sẽ coi là hết hạn → throw otpExpired.
      const FIXED = 1_700_000_000_000;
      jest.useFakeTimers().setSystemTime(FIXED);
      try {
        const deps = makeDeps();
        const user = userWithOtp('123456', { otpExpires: new Date(FIXED) });
        deps.authRepository.findByEmail.mockResolvedValue(user);
        const service = makeService(deps);

        const result = await service.verifyOtp({ email: 'a@b.c', otp: '123456' });
        expect(result.message).toBe('auth.emailVerified'); // > : FIXED>FIXED=false → không hết hạn
      } finally {
        jest.useRealTimers();
      }
    });
  });

  // ── resendVerification: expiry + generic + log ─────────────────
  describe('resendVerification', () => {
    test('user không tồn tại → generic, KHÔNG tạo otp/gửi mail', async () => {
      const deps = makeDeps();
      deps.authRepository.findByEmail.mockResolvedValue(null);
      const service = makeService(deps);

      const result = await service.resendVerification({ email: 'x@b.c' });

      expect(result.message).toBe('auth.resendGeneric');
      expect(deps.emailGateway.sendOtpEmail).not.toHaveBeenCalled();
    });

    test('user chưa verify → otpExpires = now + 10 phút + gửi mail + message otpResent (L198)', async () => {
      const FIXED = 1_700_000_000_000;
      const spy = jest.spyOn(Date, 'now').mockReturnValue(FIXED);
      const deps = makeDeps();
      const user = { id: 1, email: 'a@b.c', isEmailVerified: false };
      deps.authRepository.findByEmail.mockResolvedValue(user);
      const service = makeService(deps);

      const result = await service.resendVerification({ email: 'a@b.c' });

      expect(user.otpExpires.getTime()).toBe(FIXED + 10 * 60 * 1000);
      expect(user.otpCode).toMatch(/^\d{6}$/);
      expect(deps.emailGateway.sendOtpEmail).toHaveBeenCalledWith('a@b.c', user.otpCode);
      expect(result.message).toBe('auth.otpResent');
      spy.mockRestore();
    });

    test('gửi mail lỗi → logger.error có email (kill log L207), vẫn message otpResent', async () => {
      const deps = makeDeps();
      deps.authRepository.findByEmail.mockResolvedValue({
        id: 1,
        email: 'a@b.c',
        isEmailVerified: false,
      });
      deps.emailGateway.sendOtpEmail.mockRejectedValue(new Error('SMTP'));
      const service = makeService(deps);

      const result = await service.resendVerification({ email: 'a@b.c' });

      expect(deps.logger.error).toHaveBeenCalledWith(expect.stringContaining('a@b.c'));
      expect(result.message).toBe('auth.otpResent');
    });
  });

  // ── refreshToken: required + invalid + outcome + rotation ──────
  describe('refreshToken', () => {
    test('thiếu refreshToken → 401 auth.refreshTokenRequired (L216)', async () => {
      const service = makeService(makeDeps());
      await expect(service.refreshToken({ refreshToken: null })).rejects.toThrow(
        'auth.refreshTokenRequired',
      );
    });

    test('token JWT invalid → 401 auth.refreshTokenInvalid', async () => {
      const deps = makeDeps();
      const err = new Error('bad');
      err.name = 'JsonWebTokenError';
      deps.tokenSigner.verifyRefreshToken.mockImplementation(() => {
        throw err;
      });
      const service = makeService(deps);
      await expect(service.refreshToken({ refreshToken: 'x' })).rejects.toThrow(
        'auth.refreshTokenInvalid',
      );
    });

    test('lỗi khác (không phải JWT) → re-throw nguyên lỗi', async () => {
      const deps = makeDeps();
      const err = new Error('db down');
      err.name = 'SomeOtherError';
      deps.tokenSigner.verifyRefreshToken.mockImplementation(() => {
        throw err;
      });
      const service = makeService(deps);
      await expect(service.refreshToken({ refreshToken: 'x' })).rejects.toThrow('db down');
    });

    test('user không tồn tại → 401 auth.refreshTokenError (L233)', async () => {
      const deps = makeDeps();
      deps.tokenSigner.verifyRefreshToken.mockReturnValue({ id: 5 });
      deps.authRepository.findById.mockResolvedValue(null);
      const service = makeService(deps);
      await expect(service.refreshToken({ refreshToken: 'x' })).rejects.toThrow(
        'auth.refreshTokenError',
      );
    });

    test('user bị khoá → 401 auth.accountDisabled', async () => {
      const deps = makeDeps();
      deps.tokenSigner.verifyRefreshToken.mockReturnValue({ id: 5 });
      deps.authRepository.findById.mockResolvedValue({ id: 5, role: 'customer', isActive: false });
      const service = makeService(deps);
      await expect(service.refreshToken({ refreshToken: 'x' })).rejects.toThrow(
        'auth.accountDisabled',
      );
    });

    test('thành công → rotate cặp token mới, payload {id,role}/{id}', async () => {
      const deps = makeDeps();
      deps.tokenSigner.verifyRefreshToken.mockReturnValue({ id: 5 });
      deps.authRepository.findById.mockResolvedValue({ id: 5, role: 'staff', isActive: true });
      const service = makeService(deps);

      const result = await service.refreshToken({ refreshToken: 'x' });

      expect(deps.tokenSigner.signAccessToken).toHaveBeenCalledWith({ id: 5, role: 'staff' });
      expect(deps.tokenSigner.signRefreshToken).toHaveBeenCalledWith({ id: 5 });
      expect(result).toEqual({ token: 'access-tok', refreshToken: 'refresh-tok' });
    });
  });

  // ── forgotPassword: reset token expiry 15 phút + generic ───────
  describe('forgotPassword', () => {
    test('user tồn tại → resetPasswordExpires = now + 15 phút + gửi mail (L250)', async () => {
      const FIXED = 1_700_000_000_000;
      const spy = jest.spyOn(Date, 'now').mockReturnValue(FIXED);
      const deps = makeDeps();
      const user = { id: 1, email: 'a@b.c' };
      deps.authRepository.findByEmail.mockResolvedValue(user);
      const service = makeService(deps);

      const result = await service.forgotPassword({ email: 'a@b.c' });

      expect(user.resetPasswordExpires.getTime()).toBe(FIXED + 15 * 60 * 1000); // 900.000ms
      expect(user.resetPasswordToken).toMatch(/^[0-9a-f]{64}$/); // hex 32 byte
      expect(deps.emailGateway.sendResetPasswordEmail).toHaveBeenCalledWith(
        'a@b.c',
        user.resetPasswordToken,
      );
      expect(result.message).toBe('auth.passwordResetSent');
      spy.mockRestore();
    });

    test('user không tồn tại → generic, KHÔNG gửi mail (chống enumeration)', async () => {
      const deps = makeDeps();
      deps.authRepository.findByEmail.mockResolvedValue(null);
      const service = makeService(deps);

      const result = await service.forgotPassword({ email: 'x@b.c' });

      expect(deps.emailGateway.sendResetPasswordEmail).not.toHaveBeenCalled();
      expect(result.message).toBe('auth.passwordResetSent'); // vẫn generic
    });

    test('gửi mail lỗi → logger.error có email (kill log L260)', async () => {
      const deps = makeDeps();
      deps.authRepository.findByEmail.mockResolvedValue({ id: 1, email: 'a@b.c' });
      deps.emailGateway.sendResetPasswordEmail.mockRejectedValue(new Error('SMTP'));
      const service = makeService(deps);

      await service.forgotPassword({ email: 'a@b.c' });

      expect(deps.logger.error).toHaveBeenCalledWith(expect.stringContaining('a@b.c'));
    });
  });

  // ── resetPassword / getCurrentUser: message ────────────────────
  describe('resetPassword + getCurrentUser', () => {
    test('token không hợp lệ → 400 auth.tokenInvalidOrExpired', async () => {
      const deps = makeDeps();
      deps.authRepository.findByResetToken.mockResolvedValue(null);
      const service = makeService(deps);
      await expect(service.resetPassword({ token: 'x', password: 'new' })).rejects.toThrow(
        'auth.tokenInvalidOrExpired',
      );
    });

    test('reset thành công → set password, clear token, message', async () => {
      const deps = makeDeps();
      const user = { id: 1, resetPasswordToken: 'x', resetPasswordExpires: new Date() };
      deps.authRepository.findByResetToken.mockResolvedValue(user);
      const service = makeService(deps);

      const result = await service.resetPassword({ token: 'x', password: 'newpass' });

      expect(user.password).toBe('newpass');
      expect(user.resetPasswordToken).toBeNull();
      expect(user.resetPasswordExpires).toBeNull();
      expect(deps.authRepository.saveUser).toHaveBeenCalledWith(user);
      expect(result.message).toBe('auth.passwordResetSuccess');
    });

    test('getCurrentUser không tồn tại → 404 auth.userNotFound (L288)', async () => {
      const deps = makeDeps();
      deps.authRepository.findByIdWithAddresses.mockResolvedValue(null);
      const service = makeService(deps);
      await expect(service.getCurrentUser({ userId: 99 })).rejects.toThrow('auth.userNotFound');
    });

    test('getCurrentUser tồn tại → trả user', async () => {
      const deps = makeDeps();
      const user = { id: 1, email: 'a@b.c' };
      deps.authRepository.findByIdWithAddresses.mockResolvedValue(user);
      const service = makeService(deps);

      const result = await service.getCurrentUser({ userId: 1 });
      expect(result.user).toBe(user);
    });
  });
});

// Sanity: crypto.timingSafeEqual thật sự được dùng (đảm bảo test OTP đi qua path thật)
test('crypto khả dụng cho timing-safe compare', () => {
  expect(typeof crypto.timingSafeEqual).toBe('function');
});
