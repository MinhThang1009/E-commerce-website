/// <reference types="jest" />
/**
 * Auth pages tests — LoginPage, ForgotPasswordPage.
 * Dùng @testing-library/react + jsdom + ts-jest.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mock react-i18next ───────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'vi' } }),
  Trans: ({ children }: { children: unknown }) => children,
}));

// ── Mock react-router-dom ───────────────────────────────────────
const mockNavigate = jest.fn();
// location.state mutable — test redirect theo `from` (vd from=/admin tránh loop)
let mockLocationState: unknown = null;
jest.mock('react-router-dom', () => {
  const R = require('react');
  return {
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
    useLocation: () => ({ search: '', pathname: '/login', state: mockLocationState }),
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
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

// ── Mock auth API hooks ─────────────────────────────────────────
const mockLoginMutateAsync = jest.fn();
const mockResendMutateAsync = jest.fn();
const mockForgotPasswordMutateAsync = jest.fn();
// error/isPending của useLoginMutation — mutable để test banner lỗi + guard double-submit
let mockLoginError: unknown = null;
let mockLoginPending = false;
let mockResendPending = false;
let mockForgotSuccess = false;
let mockForgotError: unknown = null;

jest.mock('@/features/auth/api/auth-api', () => ({
  useLoginMutation: () => ({
    mutateAsync: mockLoginMutateAsync,
    isPending: mockLoginPending,
    error: mockLoginError,
  }),
  useResendVerificationMutation: () => ({
    mutateAsync: mockResendMutateAsync,
    isPending: mockResendPending,
  }),
  useForgotPasswordMutation: () => ({
    mutateAsync: mockForgotPasswordMutateAsync,
    isPending: false,
    isSuccess: mockForgotSuccess,
    error: mockForgotError,
  }),
}));

// ── Mock auth store ─────────────────────────────────────────────
const mockLoginSuccess = jest.fn();
jest.mock('@/stores/auth-store', () => {
  const store = Object.assign(
    (selector?: (s: unknown) => unknown) => {
      const state = { loginSuccess: mockLoginSuccess, isAuthenticated: false, user: null };
      return selector ? selector(state) : state;
    },
    { getState: () => ({ loginSuccess: mockLoginSuccess }) },
  );
  return { useAuthStore: store };
});

// ── Mock GoogleLoginButton ──────────────────────────────────────
jest.mock('@/features/auth/components/GoogleLoginButton', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: () => R.createElement('div', { 'data-testid': 'google-btn' }),
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
      onClick?: (e: unknown) => void;
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

// ── Mock utilities ──────────────────────────────────────────────
jest.mock('@/utils/error-utils', () => ({
  getErrorMsg: (_err: unknown, fallback: string) => fallback,
  ErrorType: {},
}));

jest.mock('@/utils/format', () => ({
  formatPrice: (p: number) => `${p}đ`,
  parsePrice: (p: unknown) => Number(p) || 0,
  getLocale: () => 'vi-VN',
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
  },
  buildRoute: {
    verifyEmail: (email?: string) => `/verify-email${email ? `?email=${email}` : ''}`,
    productDetail: (id: string) => `/products/${id}`,
    shopSearch: (q: string) => `/shop?q=${q}`,
  },
}));

// ── Import pages sau mock ───────────────────────────────────────
import LoginPage from '@/features/auth/pages/LoginPage';
import ForgotPasswordPage from '@/features/auth/pages/ForgotPasswordPage';

// Reset state mutable + impl mutation trước mỗi test (clearAllMocks không reset impl/biến thường)
beforeEach(() => {
  jest.clearAllMocks();
  mockLoginError = null;
  mockLoginPending = false;
  mockResendPending = false;
  mockForgotSuccess = false;
  mockForgotError = null;
  mockLocationState = null;
  mockLoginMutateAsync.mockReset();
  mockResendMutateAsync.mockReset();
  mockForgotPasswordMutateAsync.mockReset();
});

// ═══════════════════════════════════════════════════════════════
// LoginPage
// ═══════════════════════════════════════════════════════════════
describe('LoginPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('render đúng tiêu đề trang đăng nhập', () => {
    render(<LoginPage />);
    expect(screen.getByText('auth.login.title')).toBeInTheDocument();
  });

  it('render email input', () => {
    render(<LoginPage />);
    const emailInput = screen.getByPlaceholderText('auth.login.emailPlaceholder');
    expect(emailInput).toBeInTheDocument();
  });

  it('render password input', () => {
    render(<LoginPage />);
    const passwordInput = screen.getByPlaceholderText('auth.login.passwordPlaceholder');
    expect(passwordInput).toBeInTheDocument();
  });

  it('submit với field rỗng → hiển thị validation error email bắt buộc', async () => {
    render(<LoginPage />);
    const submitBtn = screen.getByTestId('premium-btn');
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(screen.getByText('Vui lòng nhập email')).toBeInTheDocument();
  });

  it('submit với email không hợp lệ → hiển thị lỗi sai định dạng', async () => {
    render(<LoginPage />);
    const emailInput = screen.getByPlaceholderText('auth.login.emailPlaceholder');
    fireEvent.change(emailInput, { target: { value: 'khonghoplelEmail' } });
    const submitBtn = screen.getByTestId('premium-btn');
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(screen.getByText('Email không hợp lệ')).toBeInTheDocument();
  });

  it('link đăng ký dẫn đến /register', () => {
    render(<LoginPage />);
    const registerLink = screen.getByText('auth.login.signUpLink');
    expect(registerLink.closest('a')).toHaveAttribute('href', '/register');
  });

  it('link quên mật khẩu dẫn đến /forgot-password', () => {
    render(<LoginPage />);
    const forgotLink = screen.getByText('auth.login.forgotPassword');
    expect(forgotLink.closest('a')).toHaveAttribute('href', '/forgot-password');
  });
});

// ═══════════════════════════════════════════════════════════════
// LoginPage: submit + luồng xác thực email
// ═══════════════════════════════════════════════════════════════
describe('LoginPage: submit + OTP flow', () => {
  const fillCredentials = () => {
    fireEvent.change(screen.getByPlaceholderText('auth.login.emailPlaceholder'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.login.passwordPlaceholder'), {
      target: { value: 'secret1' },
    });
  };

  it('đăng nhập hợp lệ (customer) → loginSuccess + navigate về trang chủ', async () => {
    mockLoginMutateAsync.mockResolvedValue({ user: { role: 'customer' } });
    render(<LoginPage />);
    fillCredentials();
    await act(async () => {
      fireEvent.click(screen.getByTestId('premium-btn'));
    });
    expect(mockLoginMutateAsync).toHaveBeenCalledWith({ email: 'a@b.com', password: 'secret1' });
    expect(mockLoginSuccess).toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('đăng nhập hợp lệ (admin) → navigate /admin', async () => {
    mockLoginMutateAsync.mockResolvedValue({ user: { role: 'admin' } });
    render(<LoginPage />);
    fillCredentials();
    await act(async () => {
      fireEvent.click(screen.getByTestId('premium-btn'));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/admin', { replace: true });
  });

  it('đăng nhập thất bại → catch, không crash, không gọi loginSuccess', async () => {
    mockLoginMutateAsync.mockRejectedValue(new Error('sai mật khẩu'));
    render(<LoginPage />);
    fillCredentials();
    await act(async () => {
      fireEvent.click(screen.getByTestId('premium-btn'));
    });
    expect(mockLoginSuccess).not.toHaveBeenCalled();
    expect(screen.getByText('auth.login.title')).toBeInTheDocument();
  });

  it('toggle ẩn/hiện mật khẩu', () => {
    render(<LoginPage />);
    const toggle = screen.getByLabelText('auth.login.showPassword');
    fireEvent.click(toggle);
    expect(screen.getByLabelText('auth.login.hidePassword')).toBeInTheDocument();
  });

  it('lỗi cần xác thực email → bấm "nhập OTP" → navigate verify-email', () => {
    mockLoginError = { data: { message: 'Vui lòng xác thực email trước' } };
    render(<LoginPage />);
    fireEvent.click(screen.getByText('auth.login.enterOtp'));
    expect(mockNavigate).toHaveBeenCalledWith('/verify-email');
  });

  it('gửi lại OTP khi email rỗng → báo lỗi email bắt buộc', () => {
    mockLoginError = { data: { message: 'xác thực email' } };
    render(<LoginPage />);
    fireEvent.click(screen.getByText('auth.login.resendVerification'));
    expect(screen.getByText('auth.login.emailRequired')).toBeInTheDocument();
  });

  it('gửi lại OTP thành công → hiện thông báo + bấm "nhập OTP ngay" navigate', async () => {
    mockLoginError = { data: { message: 'xác thực email' } };
    mockResendMutateAsync.mockResolvedValue({});
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText('auth.login.emailPlaceholder'), {
      target: { value: 'a@b.com' },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('auth.login.resendVerification'));
    });
    expect(screen.getByText('auth.login.resendOtpSuccess')).toBeInTheDocument();
    fireEvent.click(screen.getByText('auth.login.enterOtpNow'));
    expect(mockNavigate).toHaveBeenCalledWith('/verify-email?email=a@b.com');
  });

  it('gửi lại OTP thất bại → hiển thị lỗi resend', async () => {
    mockLoginError = { data: { message: 'xác thực email' } };
    mockResendMutateAsync.mockRejectedValue(new Error('fail'));
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText('auth.login.emailPlaceholder'), {
      target: { value: 'a@b.com' },
    });
    await act(async () => {
      fireEvent.click(screen.getByText('auth.login.resendVerification'));
    });
    expect(screen.getByText('auth.login.resendOtpError')).toBeInTheDocument();
  });

  it('lỗi đăng nhập thường (không phải xác thực email) → không hiện nút OTP', () => {
    mockLoginError = { data: { message: 'Sai mật khẩu' } };
    render(<LoginPage />);
    expect(screen.getByText('auth.login.errors.invalidCredentials')).toBeInTheDocument();
    expect(screen.queryByText('auth.login.enterOtp')).not.toBeInTheDocument();
  });

  it('lỗi không có field data → không crash, không hiện nút OTP', () => {
    mockLoginError = { message: 'lỗi không rõ' };
    render(<LoginPage />);
    expect(screen.queryByText('auth.login.enterOtp')).not.toBeInTheDocument();
  });

  it('lỗi có data nhưng thiếu message → fallback chuỗi rỗng, không hiện nút OTP', () => {
    mockLoginError = { data: {} };
    render(<LoginPage />);
    expect(screen.queryByText('auth.login.enterOtp')).not.toBeInTheDocument();
  });

  it('đang gửi lại OTP (isResending) → nút hiển thị "đang gửi"', () => {
    mockLoginError = { data: { message: 'xác thực email' } };
    mockResendPending = true;
    render(<LoginPage />);
    expect(screen.getByText('auth.login.resending')).toBeInTheDocument();
  });

  it('đang đăng nhập (isLoading) → submit form bị chặn double-submit', async () => {
    mockLoginPending = true;
    render(<LoginPage />);
    const form = screen.getByPlaceholderText('auth.login.emailPlaceholder').closest('form')!;
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(mockLoginMutateAsync).not.toHaveBeenCalled();
  });

  it('login customer với from=/admin → tránh loop, navigate về /', async () => {
    mockLocationState = { from: { pathname: '/admin' } };
    mockLoginMutateAsync.mockResolvedValue({ user: { role: 'customer' } });
    render(<LoginPage />);
    fireEvent.change(screen.getByPlaceholderText('auth.login.emailPlaceholder'), {
      target: { value: 'a@b.com' },
    });
    fireEvent.change(screen.getByPlaceholderText('auth.login.passwordPlaceholder'), {
      target: { value: 'secret1' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('premium-btn'));
    });
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });
});

// ═══════════════════════════════════════════════════════════════
// ForgotPasswordPage
// ═══════════════════════════════════════════════════════════════
describe('ForgotPasswordPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('render đúng tiêu đề trang quên mật khẩu', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByText('auth.forgotPassword.title')).toBeInTheDocument();
  });

  it('render email input', () => {
    render(<ForgotPasswordPage />);
    const emailInput = screen.getByPlaceholderText('auth.forgotPassword.emailPlaceholder');
    expect(emailInput).toBeInTheDocument();
  });

  it('render nút gửi link đặt lại mật khẩu', () => {
    render(<ForgotPasswordPage />);
    expect(screen.getByText('auth.forgotPassword.sendResetLinkButton')).toBeInTheDocument();
  });

  it('submit với email rỗng → hiển thị validation error bắt buộc', async () => {
    render(<ForgotPasswordPage />);
    const form = screen
      .getByPlaceholderText('auth.forgotPassword.emailPlaceholder')
      .closest('form')!;
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(screen.getByText('Vui lòng nhập email')).toBeInTheDocument();
  });

  it('submit với email sai định dạng → hiển thị lỗi định dạng', async () => {
    render(<ForgotPasswordPage />);
    const emailInput = screen.getByPlaceholderText('auth.forgotPassword.emailPlaceholder');
    fireEvent.change(emailInput, { target: { value: 'emailsaidinhdang' } });
    const form = emailInput.closest('form')!;
    await act(async () => {
      fireEvent.submit(form);
    });
    expect(screen.getByText('Email không hợp lệ')).toBeInTheDocument();
  });

  it('link quay lại đăng nhập dẫn đến /login', () => {
    render(<ForgotPasswordPage />);
    const links = screen.getAllByText('auth.forgotPassword.backToLogin');
    expect(links.length).toBeGreaterThan(0);
    expect(links[0].closest('a')).toHaveAttribute('href', '/login');
  });

  it('submit email hợp lệ (bấm nút) → gọi forgotPassword', async () => {
    mockForgotPasswordMutateAsync.mockResolvedValue({});
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText('auth.forgotPassword.emailPlaceholder'), {
      target: { value: 'a@b.com' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('premium-btn'));
    });
    expect(mockForgotPasswordMutateAsync).toHaveBeenCalledWith({ email: 'a@b.com' });
  });

  it('submit nhưng API lỗi → catch console.error, không crash', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockForgotPasswordMutateAsync.mockRejectedValue(new Error('fail'));
    render(<ForgotPasswordPage />);
    fireEvent.change(screen.getByPlaceholderText('auth.forgotPassword.emailPlaceholder'), {
      target: { value: 'a@b.com' },
    });
    await act(async () => {
      fireEvent.click(screen.getByTestId('premium-btn'));
    });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });

  it('isSuccess=true → hiển thị màn thành công', () => {
    mockForgotSuccess = true;
    render(<ForgotPasswordPage />);
    expect(screen.getByText('auth.forgotPassword.successMessage')).toBeInTheDocument();
  });

  it('có error → hiển thị banner lỗi gửi', () => {
    mockForgotError = new Error('boom');
    render(<ForgotPasswordPage />);
    expect(screen.getByText('auth.forgotPassword.errors.sendFailed')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// LoginPage: validation interactions
// ═══════════════════════════════════════════════════════════════
describe('LoginPage: validation interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('type email không hợp lệ rồi submit → hiển thị lỗi email', async () => {
    render(<LoginPage />);
    const emailInput = screen.getByPlaceholderText('auth.login.emailPlaceholder');
    fireEvent.change(emailInput, { target: { value: 'emailkhonghople' } });
    const submitBtn = screen.getByTestId('premium-btn');
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(screen.getByText('Email không hợp lệ')).toBeInTheDocument();
  });

  it('type password < 6 ký tự → validation error', async () => {
    render(<LoginPage />);
    const emailInput = screen.getByPlaceholderText('auth.login.emailPlaceholder');
    const passwordInput = screen.getByPlaceholderText('auth.login.passwordPlaceholder');
    // Nhập email hợp lệ trước để bỏ qua lỗi email
    fireEvent.change(emailInput, { target: { value: 'valid@example.com' } });
    fireEvent.change(passwordInput, { target: { value: '123' } });
    const submitBtn = screen.getByTestId('premium-btn');
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    // Mật khẩu ngắn → validation error xuất hiện
    const errors = screen.queryAllByTestId('input-error');
    const hasPasswordError =
      errors.length > 0 ||
      screen.queryByText('Mật khẩu tối thiểu 6 ký tự') !== null ||
      screen.queryByText('Vui lòng nhập mật khẩu') !== null;
    expect(hasPasswordError).toBe(true);
  });

  it('type valid email và password → submit button không disabled', () => {
    render(<LoginPage />);
    const emailInput = screen.getByPlaceholderText('auth.login.emailPlaceholder');
    const passwordInput = screen.getByPlaceholderText('auth.login.passwordPlaceholder');
    fireEvent.change(emailInput, { target: { value: 'valid@example.com' } });
    fireEvent.change(passwordInput, { target: { value: 'Password123!' } });
    const submitBtn = screen.getByTestId('premium-btn');
    // Button không disabled khi mutation isPending=false (theo mock)
    expect(submitBtn).not.toBeDisabled();
  });
});

// ═══════════════════════════════════════════════════════════════
// ForgotPasswordPage: form interaction
// ═══════════════════════════════════════════════════════════════
describe('ForgotPasswordPage: form interaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('type email rồi submit → form gọi mutation', async () => {
    render(<ForgotPasswordPage />);
    const emailInput = screen.getByPlaceholderText('auth.forgotPassword.emailPlaceholder');
    fireEvent.change(emailInput, { target: { value: 'user@example.com' } });
    const form = emailInput.closest('form')!;
    await act(async () => {
      fireEvent.submit(form);
    });
    // mutateAsync phải được gọi khi email hợp lệ
    expect(mockForgotPasswordMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'user@example.com' }),
    );
  });
});
