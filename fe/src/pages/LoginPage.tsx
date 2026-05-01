import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import Button from '@/components/common/Button';
import { PremiumButton } from '@/components/common';
import Input from '@/components/common/Input';
import {
  useLoginMutation,
  useResendVerificationMutation,
} from '@/services/authApi';
import { loginSuccess } from '@/features/auth/authSlice';
import GoogleLoginButton from '@/components/auth/GoogleLoginButton';

const LoginPage: React.FC = () => {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {}
  );
  const [resendSuccess, setResendSuccess] = useState('');
  const [resendError, setResendError] = useState('');

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();

  const [login, { isLoading, error }] = useLoginMutation();
  const [resendVerification, { isLoading: isResending }] =
    useResendVerificationMutation();

  // Get the redirect path from location state or default to home
  const from = (location.state as any)?.from?.pathname || '/';

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
    // Only prevent default if an event is provided
    e?.preventDefault();

    if (!validateForm()) return;

    try {
      console.log('🚀 Attempting login with:', { email, password: '***' });

      const result = await login({ email, password }).unwrap();

      console.log('✅ Login successful:', result);

      // Dispatch success to Redux store
      dispatch(loginSuccess(result));

      // Redirect based on role
      const userRole = result?.user?.role;
      if (userRole === 'admin' || userRole === 'manager') {
        navigate('/admin', { replace: true });
      } else {
        navigate(from === '/admin' ? '/' : from, { replace: true });
      }
    } catch (err: any) {
      console.log('❌ Login failed:', err);
      // Error is already handled by RTK Query and displayed in UI
    }
  };

  const handleResendVerification = async () => {
    if (!email) {
      setResendError('Vui lòng nhập email của bạn trước');
      return;
    }
    setResendSuccess('');
    setResendError('');
    try {
      await resendVerification({ email }).unwrap();
      setResendSuccess('Đã gửi mã OTP mới đến email của bạn!');
    } catch (err: any) {
      setResendError(err?.data?.message || 'Không thể gửi lại OTP');
    }
  };

  const handleGoToOtp = () => {
    navigate(`/verify-email${email ? `?email=${encodeURIComponent(email)}` : ''}`);
  };

  const handleButtonClick = (e: React.MouseEvent) => {
    // Call handleSubmit without an event to prevent default behavior conflicts
    handleSubmit();
  };

  return (
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-md mx-auto">
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-2">
              {t('auth.login.title')}
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              {t('auth.login.subtitle')}
            </p>
          </div>

          <form>
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
                </label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                >
                  {t('auth.login.forgotPassword')}
                </Link>
              </div>
              <Input
                type="password"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.login.passwordPlaceholder')}
                error={errors.password}
                required
              />
            </div>

            <div className="mb-6">
              <PremiumButton
                variant="primary"
                size="large"
                iconType="arrow-right"
                isProcessing={isLoading}
                processingText="Đang đăng nhập..."
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
                to="/register"
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
                Hoặc
              </span>
            </div>
          </div>

          <GoogleLoginButton />
          <div className="mt-4 space-y-3">
            {/* Login error */}
            {error && (
              <div className="p-4 bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400 rounded-lg">
                <p className="text-sm font-medium">
                  {typeof error === 'string'
                    ? error
                    : (error as any)?.data?.message ||
                      (error as any)?.message ||
                      t('auth.login.errors.invalidCredentials')}
                </p>
                {(error as any)?.data?.message?.includes('Vui lòng xác thực email') && (
                  <div className="mt-3 flex flex-col gap-2">
                    {/* Nút nhập OTP */}
                    <button
                      type="button"
                      onClick={handleGoToOtp}
                      className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
                    >
                      📩 Nhập mã OTP xác thực
                    </button>
                    {/* Nút gửi lại OTP */}
                    <button
                      type="button"
                      onClick={handleResendVerification}
                      disabled={isResending}
                      className="w-full py-2 px-4 border border-current text-sm font-medium rounded-lg hover:bg-error-200 dark:hover:bg-error-900/50 disabled:opacity-50 transition-colors"
                    >
                      {isResending ? 'Đang gửi...' : 'Gửi lại email xác minh'}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Resend OTP success */}
            {resendSuccess && (
              <div className="p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg flex items-start gap-2">
                <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <div>
                  <p className="text-sm font-medium">{resendSuccess}</p>
                  <button
                    type="button"
                    onClick={handleGoToOtp}
                    className="mt-1 text-sm underline hover:no-underline"
                  >
                    Nhập mã OTP ngay →
                  </button>
                </div>
              </div>
            )}

            {/* Resend OTP error */}
            {resendError && (
              <div className="p-3 bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400 rounded-lg text-sm">
                {resendError}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
