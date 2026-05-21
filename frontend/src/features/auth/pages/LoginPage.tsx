/**
 * @file LoginPage.tsx
 * @layer Page
 * @feature auth
 * @description Page component của feature auth
 */
import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES, buildRoute } from '@/routes/paths';
import { PremiumButton } from '@/components/common';
import Input from '@/components/common/Input';
import { useLoginMutation, useResendVerificationMutation } from '../api/auth-api';
import { useAuthStore } from '@/stores/auth-store';
import GoogleLoginButton from '../components/GoogleLoginButton';
import { getErrorMsg } from '@/utils/error-utils';

interface LocationState {
  from?: { pathname: string };
}
type ApiError = { data?: { message?: string }; message?: string };

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [resendSuccess, setResendSuccess] = useState('');
  const [resendError, setResendError] = useState('');

  const navigate = useNavigate();
  const location = useLocation();

  const { mutateAsync: login, isPending: isLoading, error } = useLoginMutation();
  const { mutateAsync: resendVerification, isPending: isResending } =
    useResendVerificationMutation();

  // Lấy đường dẫn redirect từ location state hoặc mặc định về trang chủ
  const from = (location.state as LocationState | null)?.from?.pathname || '/';

  const validateForm = () => {
    const newErrors: { email?: string; password?: string } = {};
    let isValid = true;

    if (!email) {
      newErrors.email = t('auth.login.validation.emailRequired');
      isValid = false;
    } else if (!/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = t('auth.login.validation.emailInvalid');
      isValid = false;
    }

    if (!password) {
      newErrors.password = t('auth.login.validation.passwordRequired');
      isValid = false;
    } else if (password.length < 6) {
      newErrors.password = t('auth.login.validation.passwordMinLength');
      isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (isLoading) return; // chặn double-submit khi đang xử lý
    if (!validateForm()) return;

    try {
      const result = await login({ email, password });

      // Cập nhật Zustand store
      useAuthStore.getState().loginSuccess(result);

      // Chuyển hướng theo vai trò người dùng
      const userRole = result?.user?.role;
      if (userRole === 'admin' || userRole === 'manager') {
        navigate('/admin', { replace: true });
      } else {
        navigate(from === '/admin' ? '/' : from, { replace: true });
      }
    } catch (err) {
      // Lỗi đã được TanStack Query xử lý và hiển thị trên UI
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      setResendError(t('auth.login.emailRequired'));
      return;
    }
    setResendSuccess('');
    setResendError('');
    try {
      await resendVerification({ email });
      setResendSuccess(t('auth.login.resendOtpSuccess'));
    } catch (err) {
      setResendError(getErrorMsg(err, t('auth.login.resendOtpError')));
    }
  };

  const handleGoToOtp = () => {
    navigate(buildRoute.verifyEmail(email || undefined));
  };

  const handleButtonClick = (_e: React.MouseEvent) => {
    // Gọi handleSubmit không có event để tránh xung đột với hành vi mặc định
    handleSubmit();
  };

  return (
    <div className="container mx-auto px-4 py-8 sm:py-16">
      <div className="max-w-md mx-auto">
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-5 sm:p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-2">
              {t('auth.login.title')}
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">{t('auth.login.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <Input
                type="email"
                label={t('auth.login.emailLabel')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.login.emailPlaceholder')}
                error={errors.email}
                required
              />
            </div>

            <div className="mb-6">
              <div className="flex justify-between items-center mb-1">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-neutral-700 dark:text-neutral-300"
                >
                  {t('auth.login.passwordLabel')}
                  <span className="text-red-500 ml-1">*</span>
                </label>
                <Link
                  to={ROUTES.FORGOT_PASSWORD}
                  className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                >
                  {t('auth.login.forgotPassword')}
                </Link>
              </div>
              <Input
                type={showPassword ? 'text' : 'password'}
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.login.passwordPlaceholder')}
                error={errors.password}
                required
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 focus:outline-none"
                    tabIndex={-1}
                    aria-label={
                      showPassword ? t('auth.login.hidePassword') : t('auth.login.showPassword')
                    }
                  >
                    {showPassword ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"
                        />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-5 w-5"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                    )}
                  </button>
                }
              />
            </div>

            <div className="mb-4 space-y-3">
              {/* Lỗi đăng nhập */}
              {error && (
                <div className="p-4 bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400 rounded-lg">
                  <p className="text-sm font-medium">
                    {getErrorMsg(error, t('auth.login.errors.invalidCredentials'))}
                  </p>
                  {/xác thực email|verify.*email/i.test(
                    (error as ApiError)?.data?.message || '',
                  ) && (
                    <div className="mt-3 flex flex-col gap-2">
                      {/* Nút nhập OTP */}
                      <button
                        type="button"
                        onClick={handleGoToOtp}
                        className="w-full py-2 px-4 bg-primary-600 hover:bg-primary-50/40 text-white text-sm font-medium rounded-lg transition-colors"
                      >
                        📩 {t('auth.login.enterOtp')}
                      </button>
                      {/* Nút gửi lại OTP */}
                      <button
                        type="button"
                        onClick={handleResendVerification}
                        disabled={isResending}
                        className="w-full py-2 px-4 border border-current text-sm font-medium rounded-lg hover:bg-error-200 dark:hover:bg-error-900/50 disabled:opacity-50 transition-colors"
                      >
                        {isResending
                          ? t('auth.login.resending')
                          : t('auth.login.resendVerification')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Gửi lại OTP thành công */}
              {resendSuccess && (
                <div className="p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg flex items-start gap-2">
                  <svg
                    className="w-5 h-5 mt-0.5 flex-shrink-0"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                  <div>
                    <p className="text-sm font-medium">{resendSuccess}</p>
                    <button
                      type="button"
                      onClick={handleGoToOtp}
                      className="mt-1 text-sm underline hover:no-underline"
                    >
                      {t('auth.login.enterOtpNow')}
                    </button>
                  </div>
                </div>
              )}

              {/* Lỗi gửi lại OTP */}
              {resendError && (
                <div className="p-3 bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400 rounded-lg text-sm">
                  {resendError}
                </div>
              )}
            </div>

            <div className="mb-6">
              <PremiumButton
                variant="primary"
                size="large"
                iconType="arrow-right"
                isProcessing={isLoading}
                processingText={t('auth.login.signingIn')}
                onClick={handleButtonClick}
                className="w-full h-12"
              >
                {t('auth.login.signInButton')}
              </PremiumButton>
            </div>
          </form>
          <div className="text-center">
            <p className="text-neutral-600 dark:text-neutral-400">
              {t('auth.login.noAccount')}{' '}
              <Link
                to={ROUTES.REGISTER}
                className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
              >
                {t('auth.login.signUpLink')}
              </Link>
            </p>
          </div>

          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-neutral-200 dark:border-neutral-700"></span>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white dark:bg-neutral-800 text-neutral-500">
                {t('common.or')}
              </span>
            </div>
          </div>

          <GoogleLoginButton />
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
