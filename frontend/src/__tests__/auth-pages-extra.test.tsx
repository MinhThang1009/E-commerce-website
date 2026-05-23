/// <reference types="jest" />
/**
 * Auth pages extra tests — RegisterPage, ResetPasswordPage, VerifyEmailPage.
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
// Dùng biến mutable để override useSearchParams trong từng test
let mockSearchParamsGet: (key: string) => string | null = (_key: string) => null;

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
  motion: { div: ({ children }: { children: unknown }) => children },
  AnimatePresence: ({ children }: { children: unknown }) => children,
}));

// ── Mock react-helmet-async ─────────────────────────────────────
jest.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children: unknown }) => children,
}));

// ── Mock auth API hooks (RegisterPage & VerifyEmailPage dùng chung) ─
jest.mock('@/features/auth/api/auth-api', () => ({
  useRegisterMutation: () => ({ mutateAsync: jest.fn(), isPending: false, error: null }),
  useVerifyOtpMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useResendVerificationMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
  useResetPasswordMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
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

jest.mock('@/utils/toast', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
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
    expect(screen.getByText('validation.firstName.required')).toBeInTheDocument();
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
    expect(screen.getByText('auth.resetPassword.validation.passwordRequired')).toBeInTheDocument();
  });

  it('không có token → navigate sang /forgot-password', () => {
    mockSearchParamsGet = (_key: string) => null;
    render(<ResetPasswordPage />);
    expect(mockNavigate).toHaveBeenCalledWith('/forgot-password');
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
    expect(screen.getByText('validation.firstName.required')).toBeInTheDocument();
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
