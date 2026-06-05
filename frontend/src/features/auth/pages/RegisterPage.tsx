/**
 * @file RegisterPage.tsx
 * @layer Page
 * @feature auth
 * @description Page component của feature auth
 */
import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/routes/paths';
import { PremiumButton } from '@/components/common';
import Input from '@/components/common/Input';
import {
  useRegisterMutation,
  useVerifyOtpMutation,
  useResendVerificationMutation,
} from '../api/auth-api';
import { getErrorMsg } from '@/utils/error-utils';
import { registerSchema } from '@/schemas/auth';
import { Eye, EyeOff, Mail, CheckCircle } from 'lucide-react';

type Step = 'form' | 'otp';

const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('form');
  const [registeredEmail, setRegisteredEmail] = useState('');

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [errors, setErrors] = useState<{
    firstName?: string;
    lastName?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    phone?: string;
    acceptTerms?: string;
  }>({});

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const navigate = useNavigate();
  const {
    mutateAsync: register,
    isPending: isRegistering,
    error: registerError,
  } = useRegisterMutation();
  const { mutateAsync: verifyOtp, isPending: isVerifying } = useVerifyOtpMutation();
  const { mutateAsync: resendVerification, isPending: isResending } =
    useResendVerificationMutation();

  const validateForm = () => {
    const result = registerSchema.safeParse({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email,
      password,
      confirmPassword,
      phone: phone.trim() || undefined,
      acceptTerms,
    });
    if (!result.success) {
      const fe = result.error.flatten().fieldErrors;
      setErrors({
        firstName: fe.firstName?.[0],
        lastName: fe.lastName?.[0],
        email: fe.email?.[0],
        password: fe.password?.[0],
        confirmPassword: fe.confirmPassword?.[0],
        phone: fe.phone?.[0],
        acceptTerms: fe.acceptTerms?.[0],
      });
      return false;
    }
    setErrors({});
    return true;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validateForm()) return;
    try {
      await register({
        email,
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim() || '',
      });
      setRegisteredEmail(email);
      setStep('otp');
    } catch (_err) {
      // Lỗi đã được TanStack Query xử lý
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;
    const newValues = [...otpValues];
    newValues[index] = value.slice(-1);
    setOtpValues(newValues);
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
    setOtpError('');
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpValues[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  const handleOtpPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pasted.length === 6) {
      setOtpValues(pasted.split(''));
      otpRefs.current[5]?.focus();
    }
  };

  const handleVerifyOtp = async () => {
    const otp = otpValues.join('');
    if (otp.length < 6) {
      setOtpError(t('auth.otp.incomplete'));
      return;
    }
    setOtpError('');
    try {
      await verifyOtp({ email: registeredEmail, otp });
      setOtpSuccess(t('auth.otp.success'));
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err) {
      setOtpError(getErrorMsg(err, t('auth.otp.invalid')));
    }
  };

  const handleResend = async () => {
    // Nút resend đã disabled khi cooldown > 0 — guard chỉ phòng thủ, không reach được qua UI
    /* istanbul ignore next */
    if (resendCooldown > 0) return;
    try {
      await resendVerification({ email: registeredEmail });
      setOtpValues(['', '', '', '', '', '']);
      setOtpError('');
      setResendCooldown(60);
      const timer = setInterval(() => {
        setResendCooldown((c) => {
          if (c <= 1) {
            clearInterval(timer);
            return 0;
          }
          return c - 1;
        });
      }, 1000);
    } catch (err) {
      setOtpError(getErrorMsg(err, t('auth.otp.resendError')));
    }
  };

  // ===== OTP STEP =====
  if (step === 'otp') {
    return (
      <div className="container mx-auto px-4 py-8 sm:py-16">
        <div className="max-w-md mx-auto">
          <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl border border-neutral-100 dark:border-neutral-700/50 p-5 sm:p-8">
            <div className="text-center mb-8">
              <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-primary-700/30 rounded-2xl flex items-center justify-center mb-4">
                <Mail className="w-8 h-8 text-blue-600 dark:text-blue-400" />
              </div>
              <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-2">
                {t('auth.otp.title')}
              </h1>
              <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                {t('auth.otp.description')}
                <br />
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                  {registeredEmail}
                </span>
              </p>
            </div>

            {otpSuccess ? (
              <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-xl text-center">
                <CheckCircle className="w-8 h-8 mx-auto mb-2" />
                <p className="font-semibold">{otpSuccess}</p>
                <p className="text-sm mt-1">{t('auth.otp.redirecting')}</p>
              </div>
            ) : (
              <>
                <div className="flex justify-center gap-3 mb-6" onPaste={handleOtpPaste}>
                  {otpValues.map((val, i) => (
                    <input
                      key={i}
                      ref={(el) => {
                        otpRefs.current[i] = el;
                      }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={val}
                      onChange={(e) => handleOtpChange(i, e.target.value)}
                      onKeyDown={(e) => handleOtpKeyDown(i, e)}
                      className={`w-12 h-14 text-center text-2xl font-bold border-2 rounded-lg outline-none transition-all
                        ${val ? 'border-blue-500 bg-blue-50 dark:bg-primary-700/20 text-blue-700 dark:text-blue-300' : 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100'}
                        ${otpError ? 'border-red-400' : ''}
                        focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800`}
                    />
                  ))}
                </div>

                {otpError && (
                  <p className="text-center text-sm text-red-600 dark:text-red-400 mb-4">
                    {otpError}
                  </p>
                )}

                <PremiumButton
                  variant="primary"
                  size="large"
                  iconType="check"
                  isProcessing={isVerifying}
                  processingText={t('auth.otp.verifying')}
                  onClick={handleVerifyOtp}
                  className="w-full h-12 mb-4"
                >
                  {t('auth.otp.confirm')}
                </PremiumButton>

                <div className="text-center">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    {t('auth.otp.notReceived')}{' '}
                    <button
                      onClick={handleResend}
                      disabled={isResending || resendCooldown > 0}
                      className="text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {resendCooldown > 0
                        ? t('auth.otp.resendAfter', { seconds: resendCooldown })
                        : isResending
                          ? t('auth.otp.sending')
                          : t('auth.otp.resend')}
                    </button>
                  </p>
                  <button
                    onClick={() => setStep('form')}
                    className="mt-3 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  >
                    {t('auth.otp.backToRegister')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===== REGISTER FORM STEP =====
  return (
    <div className="container mx-auto px-4 py-8 sm:py-16">
      <div className="max-w-md mx-auto">
        <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl border border-neutral-100 dark:border-neutral-700/50 p-5 sm:p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-2">
              {t('auth.register.title')}
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">{t('auth.register.subtitle')}</p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <Input
                  type="text"
                  label={`${t('auth.register.firstNameLabel')} *`}
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder={t('auth.register.firstNamePlaceholder')}
                  error={errors.firstName}
                  required
                />
              </div>
              <div>
                <Input
                  type="text"
                  label={`${t('auth.register.lastNameLabel')} *`}
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder={t('auth.register.lastNamePlaceholder')}
                  error={errors.lastName}
                  required
                />
              </div>
            </div>

            <div className="mb-6">
              <Input
                type="email"
                label={`${t('auth.register.emailLabel')} *`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t('auth.register.emailPlaceholder')}
                error={errors.email}
                required
              />
            </div>

            <div className="mb-6">
              <Input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                label={t('auth.register.phoneLabel')}
                value={phone}
                onChange={(e) => setPhone(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder={t('auth.register.phonePlaceholder')}
                error={errors.phone}
              />
            </div>

            <div className="mb-6">
              <Input
                type={showPassword ? 'text' : 'password'}
                label={`${t('auth.register.passwordLabel')} *`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('auth.register.passwordMinHint')}
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
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                }
              />
            </div>

            <div className="mb-6">
              <Input
                type={showConfirmPassword ? 'text' : 'password'}
                label={`${t('auth.register.confirmPasswordLabel')} *`}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder={t('auth.register.confirmPasswordPlaceholderText')}
                error={errors.confirmPassword}
                required
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300 focus:outline-none"
                    tabIndex={-1}
                    aria-label={
                      showConfirmPassword
                        ? t('auth.login.hidePassword')
                        : t('auth.login.showPassword')
                    }
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                }
              />
            </div>

            <div className="mb-6">
              <label className="flex items-start">
                <input
                  type="checkbox"
                  checked={acceptTerms}
                  onChange={(e) => setAcceptTerms(e.target.checked)}
                  className={`h-4 w-4 mt-0.5 text-primary-600 focus:ring-primary-500 border-neutral-300 rounded ${errors.acceptTerms ? 'border-error-500' : ''}`}
                />
                <span className="ml-2 text-sm text-neutral-600 dark:text-neutral-400">
                  {t('auth.register.agreeToTerms')}{' '}
                  <Link
                    to={ROUTES.TERMS}
                    className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                  >
                    {t('auth.register.termsOfService')}
                  </Link>{' '}
                  {t('auth.register.and')}{' '}
                  <Link
                    to={ROUTES.PRIVACY_POLICY}
                    className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300"
                  >
                    {t('auth.register.privacyPolicy')}
                  </Link>
                </span>
              </label>
              {errors.acceptTerms && (
                <p className="mt-1 text-sm text-error-600 dark:text-error-400">
                  {errors.acceptTerms}
                </p>
              )}
            </div>

            {registerError && (
              <div className="mb-4 p-4 bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400 rounded-lg">
                {getErrorMsg(registerError, t('auth.register.errors.registrationFailed'))}
              </div>
            )}

            <div className="mb-6">
              <PremiumButton
                variant="primary"
                size="large"
                iconType="arrow-right"
                isProcessing={isRegistering}
                processingText={t('auth.register.creating')}
                onClick={() => handleSubmit()}
                className="w-full h-12"
              >
                {t('auth.register.createAccountButton')}
              </PremiumButton>
            </div>
          </form>

          <div className="text-center">
            <p className="text-neutral-600 dark:text-neutral-400">
              {t('auth.register.haveAccount')}{' '}
              <Link
                to={ROUTES.LOGIN}
                className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium"
              >
                {t('auth.register.loginNow')}
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
