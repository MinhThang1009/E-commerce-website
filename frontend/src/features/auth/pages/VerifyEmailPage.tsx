import React, { useState, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useVerifyOtpMutation, useResendVerificationMutation } from '../api/authApi';
import Button from '@/components/common/Button';
import { getErrorMsg } from '@/utils/errorUtils';

const VerifyEmailPage: React.FC = () => {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const emailFromQuery = searchParams.get('email') || '';

  const [email, setEmail] = useState(emailFromQuery);
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [emailError, setEmailError] = useState('');

  const { mutateAsync: verifyOtp, isPending: isVerifying } = useVerifyOtpMutation();
  const { mutateAsync: resendVerification, isPending: isResending } =
    useResendVerificationMutation();

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

  const handleVerify = async () => {
    if (!email || !/\S+@\S+\.\S+/.test(email)) {
      setEmailError(t('verifyEmail.emailError'));
      return;
    }
    const otp = otpValues.join('');
    if (otp.length < 6) {
      setOtpError(t('verifyEmail.otpError'));
      return;
    }
    setOtpError('');
    setEmailError('');
    try {
      await verifyOtp({ email, otp });
      setOtpSuccess(t('verifyEmail.successTitle'));
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err) {
      setOtpError(getErrorMsg(err, t('verifyEmail.defaultOtpError')));
    }
  };

  const handleResend = async () => {
    if (!email || resendCooldown > 0) return;
    try {
      await resendVerification({ email });
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
      setOtpError(getErrorMsg(err, t('verifyEmail.resendError')));
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-neutral-900 px-4">
      <div className="max-w-md w-full bg-white dark:bg-neutral-800 rounded-lg shadow-lg p-8">
        {otpSuccess ? (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-green-100 dark:bg-green-900/30 mb-4">
              <svg
                className="h-8 w-8 text-green-600 dark:text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mb-2">
              {t('verifyEmail.successTitle')}
            </h2>
            <p className="text-gray-600 dark:text-neutral-400 mb-6">
              {t('verifyEmail.successDesc')}
            </p>
            <Button onClick={() => navigate('/login')} className="w-full" variant="primary">
              {t('verifyEmail.loginNow')}
            </Button>
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                <svg
                  className="w-8 h-8 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-neutral-100 mb-1">
                {t('verifyEmail.title')}
              </h2>
              <p className="text-sm text-gray-600 dark:text-neutral-400">
                {t('verifyEmail.subtitle')}
              </p>
            </div>

            {!emailFromQuery && (
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-1">
                  {t('verifyEmail.emailLabel')}
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setEmailError('');
                  }}
                  placeholder={t('verifyEmail.emailPlaceholder')}
                  className={`w-full px-4 py-2.5 border rounded-lg outline-none focus:ring-2 focus:ring-blue-500 dark:bg-neutral-700 dark:text-white dark:border-neutral-600 ${emailError ? 'border-red-400' : 'border-gray-300'}`}
                />
                {emailError && (
                  <p className="mt-1 text-sm text-red-600 dark:text-red-400">{emailError}</p>
                )}
              </div>
            )}

            <div className="mb-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-neutral-300 mb-3 text-center">
                {t('verifyEmail.otpLabel')}
              </label>
              <div className="flex justify-center gap-3" onPaste={handleOtpPaste}>
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
                      ${val ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-gray-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-gray-800 dark:text-neutral-100'}
                      ${otpError ? 'border-red-400' : ''}
                      focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800`}
                  />
                ))}
              </div>
            </div>

            {otpError && (
              <p className="text-center text-sm text-red-600 dark:text-red-400 mb-4">{otpError}</p>
            )}

            <div className="mt-6 space-y-3">
              <Button
                onClick={handleVerify}
                className="w-full"
                variant="primary"
                disabled={isVerifying}
              >
                {isVerifying ? t('verifyEmail.verifying') : t('verifyEmail.verify')}
              </Button>

              <div className="text-center">
                <p className="text-sm text-gray-600 dark:text-neutral-400">
                  {t('verifyEmail.noCode')}{' '}
                  <button
                    onClick={handleResend}
                    disabled={isResending || resendCooldown > 0 || !email}
                    className="text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                  >
                    {resendCooldown > 0
                      ? t('verifyEmail.resendCooldown', { count: resendCooldown })
                      : isResending
                        ? t('verifyEmail.resending')
                        : t('verifyEmail.resend')}
                  </button>
                </p>
              </div>

              <div className="text-center">
                <button
                  onClick={() => navigate('/login')}
                  className="text-sm text-gray-500 dark:text-neutral-400 hover:text-gray-700 dark:hover:text-neutral-200"
                >
                  {t('verifyEmail.backToLogin')}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default VerifyEmailPage;
