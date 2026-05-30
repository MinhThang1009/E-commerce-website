/// <reference types="jest" />
/**
 * Auth pages extra tests — RegisterPage, ResetPasswordPage, VerifyEmailPage.
 * Dùng @testing-library/react + jsdom + ts-jest.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';
import { resetPasswordSchema } from '@/schemas/auth';

// ── Mock react-i18next ───────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'vi' } }),
  Trans: ({ children }: { children: unknown }) => children,
}));

// ── Mock react-router-dom ───────────────────────────────────────
const mockNavigate = jest.fn();
// Dùng biến mutable để override useSearchParams trong từng test
let mockSearchParamsGet: (key: string) => string | null = (_key: string) => null;
// mutateAsync mutable cho từng mutation — đổi impl per-test để cover success/reject/cooldown
let mockResetPasswordFn: jest.Mock = jest.fn();
let mockRegisterFn: jest.Mock = jest.fn();
let mockRegisterError: unknown = null;
let mockVerifyOtpFn: jest.Mock = jest.fn();
let mockResendFn: jest.Mock = jest.fn();
let mockResendPending = false;

jest.mock('react-router-dom', () => {
  const R = require('react');
  return {
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
    useLocation: () => ({ search: '', pathname: '/', state: null }),
    useParams: () => ({}),
    // Trả về proxy để mockSearchParamsGet có thể thay đổi per-test
    useSearchParams: () => [
      { get: (key: string) => mockSearchParamsGet(key) } as unknown as URLSearchParams,
      jest.fn(),
    ],
    Link: ({ to, children }: { to: string; children: unknown }) =>
      R.createElement('a', { href: to }, children),
    MemoryRouter: ({ children }: { children: unknown }) => children,
  };
});

// ── Mock framer-motion ──────────────────────────────────────────
jest.mock('framer-motion', () => ({
  motion: new Proxy(
    {},
    {
      get:
        (_t: unknown, tag: string) =>
        ({ children, ...props }: Record<string, unknown>) => {
          const React = require('react');
          return React.createElement(tag, props, children);
        },
    },
  ),
  AnimatePresence: ({ children }: { children: unknown }) => children,
  MotionConfig: ({ children }: { children: unknown }) => children,
}));

// ── Mock react-helmet-async ─────────────────────────────────────
jest.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children: unknown }) => children,
}));

// ── Mock auth API hooks (RegisterPage & VerifyEmailPage dùng chung) ─
jest.mock('@/features/auth/api/auth-api', () => ({
  useRegisterMutation: () => ({
    mutateAsync: (...args: unknown[]) => mockRegisterFn(...args),
    isPending: false,
    error: mockRegisterError,
  }),
  useVerifyOtpMutation: () => ({
    mutateAsync: (...args: unknown[]) => mockVerifyOtpFn(...args),
    isPending: false,
  }),
  useResendVerificationMutation: () => ({
    mutateAsync: (...args: unknown[]) => mockResendFn(...args),
    isPending: mockResendPending,
  }),
  useResetPasswordMutation: () => ({
    mutateAsync: (...args: unknown[]) => mockResetPasswordFn(...args),
    isPending: false,
  }),
}));

// ── Mock @/components/common barrel ────────────────────────────
jest.mock('@/components/common', () => {
  const R = require('react');
  return {
    PremiumButton: ({
      children,
      onClick,
      isProcessing,
      processingText,
      disabled,
    }: {
      children: unknown;
      onClick?: (e?: unknown) => void;
      isProcessing?: boolean;
      processingText?: string;
      disabled?: boolean;
      variant?: string;
      size?: string;
      iconType?: string;
      className?: string;
    }) =>
      R.createElement(
        'button',
        { onClick, 'data-testid': 'premium-btn', disabled: disabled || isProcessing },
        isProcessing ? processingText : children,
      ),
  };
});

// ── Mock Input ──────────────────────────────────────────────────
jest.mock('@/components/common/Input', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: ({
      type,
      placeholder,
      value,
      onChange,
      error,
      id,
      rightIcon,
    }: {
      type?: string;
      placeholder?: string;
      value?: string;
      onChange?: (e: unknown) => void;
      error?: string;
      id?: string;
      label?: string;
      required?: boolean;
      rightIcon?: unknown;
      inputMode?: string;
      maxLength?: number;
    }) =>
      R.createElement(
        'div',
        null,
        R.createElement('input', {
          type: type || 'text',
          placeholder,
          value,
          onChange,
          id,
        }),
        // Render rightIcon (nút toggle ẩn/hiện mật khẩu) để test tương tác được
        rightIcon ?? null,
        error ? R.createElement('span', { 'data-testid': 'input-error' }, error) : null,
      ),
  };
});

// ── Mock Button ─────────────────────────────────────────────────
jest.mock('@/components/common/Button', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: ({
      children,
      onClick,
      isLoading,
      disabled,
      type,
    }: {
      children: unknown;
      onClick?: () => void;
      isLoading?: boolean;
      disabled?: boolean;
      type?: string;
      variant?: string;
      size?: string;
      fullWidth?: boolean;
      className?: string;
    }) =>
      R.createElement(
        'button',
        { onClick, disabled: isLoading || disabled, type: type || 'button', 'data-testid': 'btn' },
        isLoading ? '...' : children,
      ),
  };
});

// ── Mock utilities ──────────────────────────────────────────────
jest.mock('@/utils/error-utils', () => ({
  getErrorMsg: (_err: unknown, fallback: string) => fallback,
  ErrorType: {},
}));

jest.mock('@/utils/localize', () => ({
  localizeField: (_field: unknown, key: string) => key,
}));

// ── Mock routes ─────────────────────────────────────────────────
jest.mock('@/routes/paths', () => ({
  ROUTES: {
    LOGIN: '/login',
    REGISTER: '/register',
    FORGOT_PASSWORD: '/forgot-password',
    TERMS: '/terms',
    PRIVACY_POLICY: '/privacy-policy',
  },
  buildRoute: {
    verifyEmail: (email?: string) => `/verify-email${email ? `?email=${email}` : ''}`,
    productDetail: (id: string) => `/products/${id}`,
  },
}));

// ── Import pages sau mock ───────────────────────────────────────
import RegisterPage from '@/features/auth/pages/RegisterPage';
import ResetPasswordPage from '@/features/auth/pages/ResetPasswordPage';
import VerifyEmailPage from '@/features/auth/pages/VerifyEmailPage';

// Reset impl mặc định cho mọi mutation trước mỗi test (clearAllMocks không xoá mockResolvedValue)
beforeEach(() => {
  mockResetPasswordFn = jest.fn().mockResolvedValue({});
  mockRegisterFn = jest.fn().mockResolvedValue({});
  mockRegisterError = null;
  mockVerifyOtpFn = jest.fn().mockResolvedValue({});
  mockResendFn = jest.fn().mockResolvedValue({});
  mockResendPending = false;
});

// ═══════════════════════════════════════════════════════════════
// RegisterPage
// ═══════════════════════════════════════════════════════════════
describe('RegisterPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('render đúng tiêu đề trang đăng ký', () => {
    render(<RegisterPage />);
    expect(screen.getByText('auth.register.title')).toBeInTheDocument();
  });

  it('render email input', () => {
    render(<RegisterPage />);
    const emailInput = screen.getByPlaceholderText('auth.register.emailPlaceholder');
    expect(emailInput).toBeInTheDocument();
  });

  it('render password input', () => {
    render(<RegisterPage />);
    const passwordInput = screen.getByPlaceholderText('auth.register.passwordMinHint');
    expect(passwordInput).toBeInTheDocument();
  });

  it('submit khi họ rỗng → hiển thị validation error họ bắt buộc', async () => {
    render(<RegisterPage />);
    const submitBtn = screen.getByTestId('premium-btn');
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(screen.getByText('Vui lòng nhập họ')).toBeInTheDocument();
  });

  it('link đăng nhập dẫn đến /login', () => {
    render(<RegisterPage />);
    const loginLink = screen.getByText('auth.register.loginNow');
    expect(loginLink.closest('a')).toHaveAttribute('href', '/login');
  });
});

// ═══════════════════════════════════════════════════════════════
// ResetPasswordPage
// ═══════════════════════════════════════════════════════════════
describe('ResetPasswordPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mặc định: cung cấp token hợp lệ — tránh redirect sang /forgot-password
    mockSearchParamsGet = (key: string) => (key === 'token' ? 'test-token-123' : null);
    // Mặc định API reset password thành công
    mockResetPasswordFn = jest.fn().mockResolvedValue({});
  });

  // ResetPasswordPage dùng useSearchParams().get('token'), không phải useParams
  it('render tiêu đề trang đặt lại mật khẩu khi có token', () => {
    render(<ResetPasswordPage />);
    expect(screen.getByText('auth.resetPassword.title')).toBeInTheDocument();
  });

  it('render password input khi có token hợp lệ', () => {
    render(<ResetPasswordPage />);
    const passwordInput = screen.getByPlaceholderText('auth.resetPassword.passwordPlaceholder');
    expect(passwordInput).toBeInTheDocument();
  });

  it('render confirm password input khi có token hợp lệ', () => {
    render(<ResetPasswordPage />);
    const confirmInput = screen.getByPlaceholderText(
      'auth.resetPassword.confirmPasswordPlaceholder',
    );
    expect(confirmInput).toBeInTheDocument();
  });

  it('submit form rỗng → hiển thị validation error mật khẩu bắt buộc', async () => {
    render(<ResetPasswordPage />);
    const form = document.querySelector('form')!;
    await act(async () => {
      fireEvent.submit(form);
    });
    // Sau khi chuyển sang Zod: message lấy từ resetPasswordSchema (tiếng Việt hardcode)
    expect(screen.getByText('Vui lòng nhập mật khẩu')).toBeInTheDocument();
  });

  it('không có token → navigate sang /forgot-password', () => {
    mockSearchParamsGet = (_key: string) => null;
    render(<ResetPasswordPage />);
    expect(mockNavigate).toHaveBeenCalledWith('/forgot-password');
  });

  it('submit form hợp lệ → hiển thị màn thành công và chuyển hướng /login sau 3s', async () => {
    jest.useFakeTimers();
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText('auth.resetPassword.passwordPlaceholder'), {
      target: { value: 'secret123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.resetPassword.confirmPasswordPlaceholder'), {
      target: { value: 'secret123' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('premium-btn'));
    });
    expect(screen.getByText('auth.resetPassword.successMessage')).toBeInTheDocument();
    expect(mockResetPasswordFn).toHaveBeenCalledWith({
      token: 'test-token-123',
      password: 'secret123',
    });
    await act(async () => {
      jest.advanceTimersByTime(3000);
    });
    expect(mockNavigate).toHaveBeenCalledWith('/login');
    jest.useRealTimers();
  });

  it('submit hợp lệ nhưng API lỗi → hiển thị thông báo lỗi', async () => {
    mockResetPasswordFn = jest.fn().mockRejectedValue(new Error('fail'));
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText('auth.resetPassword.passwordPlaceholder'), {
      target: { value: 'secret123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.resetPassword.confirmPasswordPlaceholder'), {
      target: { value: 'secret123' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('premium-btn'));
    });
    expect(screen.getByText('auth.resetPassword.errors.resetFailed')).toBeInTheDocument();
  });

  it('submit khi mật khẩu không khớp → lỗi xác nhận mật khẩu', async () => {
    render(<ResetPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText('auth.resetPassword.passwordPlaceholder'), {
      target: { value: 'secret123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.resetPassword.confirmPasswordPlaceholder'), {
      target: { value: 'secret999' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('premium-btn'));
    });
    expect(screen.getByText('Mật khẩu xác nhận không khớp')).toBeInTheDocument();
  });

  it('toggle ẩn/hiện mật khẩu → đổi nhãn nút', () => {
    render(<ResetPasswordPage />);
    const toggles = screen.getAllByLabelText('auth.login.showPassword');
    expect(toggles).toHaveLength(2);
    fireEvent.click(toggles[0]);
    fireEvent.click(toggles[1]);
    expect(screen.getAllByLabelText('auth.login.hidePassword')).toHaveLength(2);
  });
});

// ═══════════════════════════════════════════════════════════════
// VerifyEmailPage
// ═══════════════════════════════════════════════════════════════
describe('VerifyEmailPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mặc định: không có email trong query string
    mockSearchParamsGet = (_key: string) => null;
  });

  it('render tiêu đề trang xác thực email', () => {
    render(<VerifyEmailPage />);
    expect(screen.getByText('verifyEmail.title')).toBeInTheDocument();
  });

  it('render 6 ô nhập OTP', () => {
    render(<VerifyEmailPage />);
    // OTP inputs có maxLength=1 và inputMode=numeric
    const otpInputs = document.querySelectorAll('input[inputmode="numeric"]');
    expect(otpInputs).toHaveLength(6);
  });

  it('render nút xác thực', () => {
    render(<VerifyEmailPage />);
    expect(screen.getByText('verifyEmail.verify')).toBeInTheDocument();
  });

  it('render field nhập email khi không có email trong URL', () => {
    render(<VerifyEmailPage />);
    // Khi emailFromQuery rỗng → hiển thị thêm input email
    const emailInput = screen.getByPlaceholderText('verifyEmail.emailPlaceholder');
    expect(emailInput).toBeInTheDocument();
  });

  it('không render field email khi đã có email trong URL', () => {
    // Cung cấp email qua query string — emailFromQuery sẽ là truthy → ẩn input email
    mockSearchParamsGet = (key: string) => (key === 'email' ? 'user@example.com' : null);
    render(<VerifyEmailPage />);
    // emailPlaceholder input không xuất hiện vì emailFromQuery đã có giá trị
    expect(screen.queryByPlaceholderText('verifyEmail.emailPlaceholder')).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// RegisterPage: form interactions
// ═══════════════════════════════════════════════════════════════
describe('RegisterPage: form interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParamsGet = (_key: string) => null;
  });

  it('type firstName → giá trị cập nhật', () => {
    render(<RegisterPage />);
    const firstNameInput = screen.getByPlaceholderText('auth.register.firstNamePlaceholder');
    fireEvent.change(firstNameInput, { target: { value: 'Minh' } });
    expect(firstNameInput).toHaveValue('Minh');
  });

  it('type email rồi submit → validation trigger (không crash)', async () => {
    render(<RegisterPage />);
    const emailInput = screen.getByPlaceholderText('auth.register.emailPlaceholder');
    fireEvent.change(emailInput, { target: { value: 'newuser@example.com' } });
    const submitBtn = screen.getByTestId('premium-btn');
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    // Validation phải chạy — form không crash và xuất hiện ít nhất 1 error (firstName còn rỗng)
    expect(screen.getByText('Vui lòng nhập họ')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// VerifyEmailPage: OTP interaction
// ═══════════════════════════════════════════════════════════════
describe('VerifyEmailPage: OTP interaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParamsGet = (_key: string) => null;
  });

  it('click button "Xác nhận OTP" → không crash', async () => {
    render(<VerifyEmailPage />);
    const verifyBtn = screen.getByText('verifyEmail.verify');
    // Click nút xác nhận OTP — không crash dù OTP chưa được nhập
    await act(async () => {
      fireEvent.click(verifyBtn);
    });
    // Sau click, button vẫn tồn tại trong DOM
    expect(verifyBtn).toBeInTheDocument();
  });

  it('nhập vào OTP input đầu tiên → value cập nhật', () => {
    render(<VerifyEmailPage />);
    const otpInputs = document.querySelectorAll('input[inputmode="numeric"]');
    expect(otpInputs.length).toBeGreaterThan(0);
    const firstInput = otpInputs[0] as HTMLInputElement;
    fireEvent.change(firstInput, { target: { value: '5' } });
    expect(firstInput.value).toBe('5');
  });
});

// ── resetPasswordSchema (Zod) ───────────────────────────────────
// ResetPasswordPage dùng schema này, nhưng test page không submit form hợp lệ
// nên không chạm nhánh `.refine` so khớp mật khẩu — test trực tiếp để cover.
describe('resetPasswordSchema (Zod)', () => {
  it('hợp lệ khi password khớp confirmPassword', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'secret123',
      confirmPassword: 'secret123',
    });
    expect(result.success).toBe(true);
  });

  it('báo lỗi confirmPassword khi password không khớp', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'secret123',
      confirmPassword: 'secret999',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.confirmPassword?.[0]).toBe('Mật khẩu xác nhận không khớp');
    }
  });

  it('báo lỗi khi password ngắn hơn 6 ký tự', () => {
    const result = resetPasswordSchema.safeParse({
      password: '123',
      confirmPassword: '123',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      const fieldErrors = result.error.flatten().fieldErrors;
      expect(fieldErrors.password?.[0]).toBe('Mật khẩu tối thiểu 6 ký tự');
    }
  });
});

// ═══════════════════════════════════════════════════════════════
// RegisterPage: đăng ký + bước OTP (full flow)
// ═══════════════════════════════════════════════════════════════
describe('RegisterPage: đăng ký + OTP', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParamsGet = (_key: string) => null;
  });

  // Điền form đăng ký hợp lệ (có phone) — đủ điều kiện registerSchema
  const fillRegisterForm = (withPhone = true) => {
    fireEvent.change(screen.getByPlaceholderText('auth.register.firstNamePlaceholder'), {
      target: { value: 'Minh' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.lastNamePlaceholder'), {
      target: { value: 'Quang' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.emailPlaceholder'), {
      target: { value: 'minh@example.com' },
    });
    if (withPhone) {
      fireEvent.change(screen.getByPlaceholderText('auth.register.phonePlaceholder'), {
        target: { value: '0901234567' },
      });
    }
    fireEvent.change(screen.getByPlaceholderText('auth.register.passwordMinHint'), {
      target: { value: 'secret123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.confirmPasswordPlaceholderText'), {
      target: { value: 'secret123' },
    });
    fireEvent.click(screen.getByRole('checkbox'));
  };

  // Đăng ký thành công → vào bước OTP
  const goToOtp = async () => {
    render(<RegisterPage />);
    fillRegisterForm();
    await act(async () => {
      fireEvent.click(screen.getByTestId('premium-btn'));
    });
  };

  it('submit form hợp lệ → chuyển sang bước nhập OTP', async () => {
    await goToOtp();
    expect(screen.getByText('auth.otp.title')).toBeInTheDocument();
    expect(mockRegisterFn).toHaveBeenCalled();
  });

  it('register thất bại → vẫn ở bước form (không sang OTP)', async () => {
    mockRegisterFn = jest.fn().mockRejectedValue(new Error('fail'));
    render(<RegisterPage />);
    fillRegisterForm(false); // không nhập phone → cover nhánh phone rỗng
    await act(async () => {
      fireEvent.click(screen.getByTestId('premium-btn'));
    });
    expect(screen.getByText('auth.register.createAccountButton')).toBeInTheDocument();
  });

  it('submit khi chưa đồng ý điều khoản → lỗi acceptTerms', async () => {
    render(<RegisterPage />);
    fireEvent.change(screen.getByPlaceholderText('auth.register.firstNamePlaceholder'), {
      target: { value: 'Minh' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.lastNamePlaceholder'), {
      target: { value: 'Quang' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.emailPlaceholder'), {
      target: { value: 'minh@example.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.passwordMinHint'), {
      target: { value: 'secret123' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.register.confirmPasswordPlaceholderText'), {
      target: { value: 'secret123' },
    });
    // KHÔNG tick checkbox điều khoản
    await act(async () => {
      fireEvent.click(screen.getByTestId('premium-btn'));
    });
    expect(screen.getByText('Vui lòng đồng ý với điều khoản sử dụng')).toBeInTheDocument();
  });

  it('có registerError → hiển thị banner lỗi đăng ký', () => {
    mockRegisterError = new Error('boom');
    render(<RegisterPage />);
    expect(screen.getByText('auth.register.errors.registrationFailed')).toBeInTheDocument();
  });

  it('toggle ẩn/hiện mật khẩu ở form đăng ký', () => {
    render(<RegisterPage />);
    const toggles = screen.getAllByLabelText('auth.login.showPassword');
    expect(toggles).toHaveLength(2);
    fireEvent.click(toggles[0]);
    fireEvent.click(toggles[1]);
    expect(screen.getAllByLabelText('auth.login.hidePassword')).toHaveLength(2);
  });

  it('nhập OTP: số hợp lệ, ký tự không phải số bị bỏ, xoá ô', async () => {
    await goToOtp();
    const inputs = document.querySelectorAll('input[inputmode="numeric"]');
    fireEvent.change(inputs[0], { target: { value: '5' } });
    expect((inputs[0] as HTMLInputElement).value).toBe('5');
    fireEvent.change(inputs[1], { target: { value: 'a' } }); // bỏ qua (không phải số)
    expect((inputs[1] as HTMLInputElement).value).toBe('');
    fireEvent.change(inputs[0], { target: { value: '' } }); // xoá ô (value falsy)
    expect((inputs[0] as HTMLInputElement).value).toBe('');
  });

  it('Backspace ở ô OTP rỗng → focus ô trước', async () => {
    await goToOtp();
    const inputs = document.querySelectorAll('input[inputmode="numeric"]');
    fireEvent.keyDown(inputs[1], { key: 'Backspace' });
    expect(document.activeElement).toBe(inputs[0]);
    fireEvent.keyDown(inputs[0], { key: 'Enter' }); // nhánh không phải Backspace
  });

  it('paste 6 chữ số vào OTP → điền đủ 6 ô', async () => {
    await goToOtp();
    const inputs = document.querySelectorAll('input[inputmode="numeric"]');
    fireEvent.paste(inputs[0].parentElement!, {
      clipboardData: { getData: () => '123456' },
    });
    const after = document.querySelectorAll('input[inputmode="numeric"]');
    expect((after[5] as HTMLInputElement).value).toBe('6');
  });

  it('paste ít hơn 6 chữ số → không điền', async () => {
    await goToOtp();
    const inputs = document.querySelectorAll('input[inputmode="numeric"]');
    fireEvent.paste(inputs[0].parentElement!, { clipboardData: { getData: () => '12' } });
    expect(
      (document.querySelectorAll('input[inputmode="numeric"]')[0] as HTMLInputElement).value,
    ).toBe('');
  });

  it('xác nhận OTP khi chưa đủ 6 số → lỗi incomplete', async () => {
    await goToOtp();
    await act(async () => {
      fireEvent.click(screen.getByTestId('premium-btn'));
    });
    expect(screen.getByText('auth.otp.incomplete')).toBeInTheDocument();
  });

  it('xác nhận OTP hợp lệ → thành công và chuyển hướng /login', async () => {
    jest.useFakeTimers();
    await goToOtp();
    const inputs = document.querySelectorAll('input[inputmode="numeric"]');
    inputs.forEach((inp, i) => fireEvent.change(inp, { target: { value: String(i + 1) } }));
    await act(async () => {
      fireEvent.click(screen.getByTestId('premium-btn'));
    });
    expect(screen.getByText('auth.otp.success')).toBeInTheDocument();
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    jest.useRealTimers();
  });

  it('xác nhận OTP nhưng API lỗi → hiển thị lỗi', async () => {
    mockVerifyOtpFn = jest.fn().mockRejectedValue(new Error('bad'));
    await goToOtp();
    const inputs = document.querySelectorAll('input[inputmode="numeric"]');
    inputs.forEach((inp, i) => fireEvent.change(inp, { target: { value: String(i + 1) } }));
    await act(async () => {
      fireEvent.click(screen.getByTestId('premium-btn'));
    });
    expect(screen.getByText('auth.otp.invalid')).toBeInTheDocument();
  });

  it('gửi lại OTP thành công → đếm ngược + chạy interval', async () => {
    jest.useFakeTimers();
    await goToOtp();
    await act(async () => {
      fireEvent.click(screen.getByText('auth.otp.resend'));
    });
    expect(screen.getByText('auth.otp.resendAfter')).toBeInTheDocument();
    await act(async () => {
      jest.advanceTimersByTime(60000);
    });
    jest.useRealTimers();
  });

  it('gửi lại OTP thất bại → hiển thị lỗi', async () => {
    mockResendFn = jest.fn().mockRejectedValue(new Error('e'));
    await goToOtp();
    await act(async () => {
      fireEvent.click(screen.getByText('auth.otp.resend'));
    });
    expect(screen.getByText('auth.otp.resendError')).toBeInTheDocument();
  });

  it('đang gửi lại OTP (isResending) → nút hiển thị "đang gửi"', async () => {
    mockResendPending = true;
    await goToOtp();
    expect(screen.getByText('auth.otp.sending')).toBeInTheDocument();
  });

  it('bấm "quay lại đăng ký" → về bước form', async () => {
    await goToOtp();
    fireEvent.click(screen.getByText('auth.otp.backToRegister'));
    expect(screen.getByText('auth.register.createAccountButton')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// VerifyEmailPage: full flow
// ═══════════════════════════════════════════════════════════════
describe('VerifyEmailPage: full flow', () => {
  // Cung cấp email qua query để bật nút verify/resend
  const withEmail = (key: string) => (key === 'email' ? 'user@example.com' : null);

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParamsGet = (_key: string) => null;
  });

  it('nhập email vào input → cập nhật giá trị', () => {
    render(<VerifyEmailPage />);
    const emailInput = screen.getByPlaceholderText('verifyEmail.emailPlaceholder');
    fireEvent.change(emailInput, { target: { value: 'a@b.com' } });
    expect(emailInput).toHaveValue('a@b.com');
  });

  it('xác nhận khi chưa nhập email → hiển thị lỗi email', async () => {
    render(<VerifyEmailPage />);
    await act(async () => {
      fireEvent.click(screen.getByText('verifyEmail.verify'));
    });
    expect(screen.getByText('verifyEmail.emailError')).toBeInTheDocument();
  });

  it('email hợp lệ nhưng OTP thiếu → lỗi OTP', async () => {
    mockSearchParamsGet = withEmail;
    render(<VerifyEmailPage />);
    await act(async () => {
      fireEvent.click(screen.getByText('verifyEmail.verify'));
    });
    expect(screen.getByText('verifyEmail.otpError')).toBeInTheDocument();
  });

  it('xác nhận thành công → màn thành công + nút đăng nhập + chuyển hướng', async () => {
    jest.useFakeTimers();
    mockSearchParamsGet = withEmail;
    render(<VerifyEmailPage />);
    const inputs = document.querySelectorAll('input[inputmode="numeric"]');
    inputs.forEach((inp, i) => fireEvent.change(inp, { target: { value: String(i + 1) } }));
    await act(async () => {
      fireEvent.click(screen.getByText('verifyEmail.verify'));
    });
    expect(screen.getByText('verifyEmail.successDesc')).toBeInTheDocument();
    fireEvent.click(screen.getByText('verifyEmail.loginNow')); // nút trong màn thành công
    expect(mockNavigate).toHaveBeenCalledWith('/login');
    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true });
    jest.useRealTimers();
  });

  it('xác nhận OTP nhưng API lỗi → hiển thị lỗi', async () => {
    mockVerifyOtpFn = jest.fn().mockRejectedValue(new Error('x'));
    mockSearchParamsGet = withEmail;
    render(<VerifyEmailPage />);
    const inputs = document.querySelectorAll('input[inputmode="numeric"]');
    inputs.forEach((inp, i) => fireEvent.change(inp, { target: { value: String(i + 1) } }));
    await act(async () => {
      fireEvent.click(screen.getByText('verifyEmail.verify'));
    });
    expect(screen.getByText('verifyEmail.defaultOtpError')).toBeInTheDocument();
  });

  it('gửi lại mã thành công → đếm ngược + chạy interval', async () => {
    jest.useFakeTimers();
    mockSearchParamsGet = withEmail;
    render(<VerifyEmailPage />);
    await act(async () => {
      fireEvent.click(screen.getByText('verifyEmail.resend'));
    });
    expect(screen.getByText('verifyEmail.resendCooldown')).toBeInTheDocument();
    await act(async () => {
      jest.advanceTimersByTime(60000);
    });
    jest.useRealTimers();
  });

  it('gửi lại mã thất bại → hiển thị lỗi', async () => {
    mockResendFn = jest.fn().mockRejectedValue(new Error('x'));
    mockSearchParamsGet = withEmail;
    render(<VerifyEmailPage />);
    await act(async () => {
      fireEvent.click(screen.getByText('verifyEmail.resend'));
    });
    expect(screen.getByText('verifyEmail.resendError')).toBeInTheDocument();
  });

  it('đang gửi lại mã (isResending) → nút hiển thị "đang gửi"', () => {
    mockResendPending = true;
    mockSearchParamsGet = withEmail;
    render(<VerifyEmailPage />);
    expect(screen.getByText('verifyEmail.resending')).toBeInTheDocument();
  });

  it('bấm "quay lại đăng nhập" → navigate /login', () => {
    mockSearchParamsGet = withEmail;
    render(<VerifyEmailPage />);
    fireEvent.click(screen.getByText('verifyEmail.backToLogin'));
    expect(mockNavigate).toHaveBeenCalledWith('/login');
  });

  it('nhập ký tự không phải số / xoá ô OTP', () => {
    mockSearchParamsGet = withEmail;
    render(<VerifyEmailPage />);
    const inputs = document.querySelectorAll('input[inputmode="numeric"]');
    fireEvent.change(inputs[0], { target: { value: 'x' } }); // bỏ qua
    expect((inputs[0] as HTMLInputElement).value).toBe('');
    fireEvent.change(inputs[1], { target: { value: '' } }); // xoá (value falsy)
    expect((inputs[1] as HTMLInputElement).value).toBe('');
  });

  it('Backspace ô OTP rỗng → focus ô trước', () => {
    mockSearchParamsGet = withEmail;
    render(<VerifyEmailPage />);
    const inputs = document.querySelectorAll('input[inputmode="numeric"]');
    fireEvent.keyDown(inputs[1], { key: 'Backspace' });
    expect(document.activeElement).toBe(inputs[0]);
    fireEvent.keyDown(inputs[0], { key: 'Enter' }); // nhánh false
  });

  it('paste 6 / ít hơn 6 chữ số', () => {
    mockSearchParamsGet = withEmail;
    render(<VerifyEmailPage />);
    let inputs = document.querySelectorAll('input[inputmode="numeric"]');
    fireEvent.paste(inputs[0].parentElement!, { clipboardData: { getData: () => '654321' } });
    inputs = document.querySelectorAll('input[inputmode="numeric"]');
    expect((inputs[5] as HTMLInputElement).value).toBe('1');
    fireEvent.paste(inputs[0].parentElement!, { clipboardData: { getData: () => '99' } });
    // paste <6 không thay đổi (vẫn 654321)
    expect(
      (document.querySelectorAll('input[inputmode="numeric"]')[0] as HTMLInputElement).value,
    ).toBe('6');
  });
});
