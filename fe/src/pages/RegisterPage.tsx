import { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import Button from '@/components/common/Button';
import { PremiumButton } from '@/components/common';
import Input from '@/components/common/Input';
import { useRegisterMutation, useVerifyOtpMutation, useResendVerificationMutation } from '@/services/authApi';

type Step = 'form' | 'otp';

const RegisterPage: React.FC = () => {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('form');
  const [registeredEmail, setRegisteredEmail] = useState('');

  // Form fields
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

  // OTP fields
  const [otpValues, setOtpValues] = useState(['', '', '', '', '', '']);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const [otpError, setOtpError] = useState('');
  const [otpSuccess, setOtpSuccess] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);

  const navigate = useNavigate();
  const [register, { isLoading: isRegistering, error: registerError }] = useRegisterMutation();
  const [verifyOtp, { isLoading: isVerifying }] = useVerifyOtpMutation();
  const [resendVerification, { isLoading: isResending }] = useResendVerificationMutation();

  const validateForm = () => {
    const newErrors: typeof errors = {};
    let isValid = true;

    if (!firstName.trim()) { newErrors.firstName = 'Tên không được để trống'; isValid = false; }
    if (!lastName.trim()) { newErrors.lastName = 'Họ không được để trống'; isValid = false; }
    if (!email) { newErrors.email = 'Email không được để trống'; isValid = false; }
    else if (!/\S+@\S+\.\S+/.test(email)) { newErrors.email = 'Email không hợp lệ'; isValid = false; }
    if (!password) { newErrors.password = 'Mật khẩu không được để trống'; isValid = false; }
    else if (password.length < 6) { newErrors.password = 'Mật khẩu phải có ít nhất 6 ký tự'; isValid = false; }
    if (!confirmPassword) { newErrors.confirmPassword = 'Vui lòng xác nhận mật khẩu'; isValid = false; }
    else if (password !== confirmPassword) { newErrors.confirmPassword = 'Mật khẩu xác nhận không khớp'; isValid = false; }
    if (!acceptTerms) { newErrors.acceptTerms = 'Bạn phải đồng ý với Điều khoản dịch vụ và Chính sách bảo mật'; isValid = false; }

    setErrors(newErrors);
    return isValid;
  };

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!validateForm()) return;
    try {
      await register({ email, password, firstName: firstName.trim(), lastName: lastName.trim(), phone: phone.trim() || '' }).unwrap();
      setRegisteredEmail(email);
      setStep('otp');
    } catch (err) {
      // Error handled by RTK Query
    }
  };

  // OTP input handlers
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
    if (otp.length < 6) { setOtpError('Vui lòng nhập đủ 6 chữ số OTP'); return; }
    setOtpError('');
    try {
      await verifyOtp({ email: registeredEmail, otp }).unwrap();
      setOtpSuccess('Xác thực thành công!');
      setTimeout(() => navigate('/login', { replace: true }), 2000);
    } catch (err: any) {
      setOtpError(err?.data?.message || 'Mã OTP không đúng hoặc đã hết hạn');
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await resendVerification({ email: registeredEmail }).unwrap();
      setOtpValues(['', '', '', '', '', '']);
      setOtpError('');
      // Cooldown 60 seconds
      setResendCooldown(60);
      const t = setInterval(() => {
        setResendCooldown(c => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; });
      }, 1000);
    } catch (err: any) {
      setOtpError(err?.data?.message || 'Không thể gửi lại OTP');
    }
  };

  // ===== OTP STEP =====
  if (step === 'otp') {
    return (
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto">
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-8">
            <div className="text-center mb-8">
              <div className="mx-auto w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </div>
              <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-2">Nhập mã OTP</h1>
              <p className="text-neutral-600 dark:text-neutral-400 text-sm">
                Mã xác thực 6 số đã được gửi đến<br />
                <span className="font-semibold text-neutral-800 dark:text-neutral-200">{registeredEmail}</span>
              </p>
            </div>

            {otpSuccess ? (
              <div className="mb-6 p-4 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg text-center">
                <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="font-semibold">{otpSuccess}</p>
                <p className="text-sm mt-1">Đang chuyển đến trang đăng nhập...</p>
              </div>
            ) : (
              <>
                {/* OTP 6 boxes */}
                <div className="flex justify-center gap-3 mb-6" onPaste={handleOtpPaste}>
                  {otpValues.map((val, i) => (
                    <input
                      key={i}
                      ref={el => { otpRefs.current[i] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={val}
                      onChange={e => handleOtpChange(i, e.target.value)}
                      onKeyDown={e => handleOtpKeyDown(i, e)}
                      className={`w-12 h-14 text-center text-2xl font-bold border-2 rounded-lg outline-none transition-all
                        ${val ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-800 dark:text-neutral-100'}
                        ${otpError ? 'border-red-400' : ''}
                        focus:border-blue-500 focus:ring-2 focus:ring-blue-200 dark:focus:ring-blue-800`}
                    />
                  ))}
                </div>

                {otpError && (
                  <p className="text-center text-sm text-red-600 dark:text-red-400 mb-4">{otpError}</p>
                )}

                <PremiumButton
                  variant="success"
                  size="large"
                  iconType="check"
                  isProcessing={isVerifying}
                  processingText="Đang xác thực..."
                  onClick={handleVerifyOtp}
                  className="w-full h-12 mb-4"
                >
                  Xác nhận OTP
                </PremiumButton>

                <div className="text-center">
                  <p className="text-sm text-neutral-600 dark:text-neutral-400">
                    Không nhận được mã?{' '}
                    <button
                      onClick={handleResend}
                      disabled={isResending || resendCooldown > 0}
                      className="text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                    >
                      {resendCooldown > 0 ? `Gửi lại sau ${resendCooldown}s` : isResending ? 'Đang gửi...' : 'Gửi lại OTP'}
                    </button>
                  </p>
                  <button
                    onClick={() => setStep('form')}
                    className="mt-3 text-sm text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  >
                    ← Quay lại đăng ký
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
    <div className="container mx-auto px-4 py-16">
      <div className="max-w-md mx-auto">
        <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-md p-8">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-2">
              Tạo tài khoản mới
            </h1>
            <p className="text-neutral-600 dark:text-neutral-400">
              Đăng ký để trở thành thành viên và nhận nhiều ưu đãi
            </p>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <Input type="text" label="Tên *" value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="Nhập tên của bạn" error={errors.firstName} required />
              </div>
              <div>
                <Input type="text" label="Họ *" value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Nhập họ của bạn" error={errors.lastName} required />
              </div>
            </div>

            <div className="mb-6">
              <Input type="email" label="Email *" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Nhập địa chỉ email" error={errors.email} required />
            </div>

            <div className="mb-6">
              <Input type="tel" label="Số điện thoại" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Nhập số điện thoại (không bắt buộc)" error={errors.phone} />
            </div>

            <div className="mb-6">
              <Input type="password" label="Mật khẩu *" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Mật khẩu tối thiểu 6 ký tự" error={errors.password} required />
            </div>

            <div className="mb-6">
              <Input type="password" label="Xác nhận mật khẩu *" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Nhập lại mật khẩu" error={errors.confirmPassword} required />
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
                  Tôi đồng ý với{' '}
                  <Link to="/terms" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">Điều khoản dịch vụ</Link>
                  {' '}và{' '}
                  <Link to="/privacy-policy" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300">Chính sách bảo mật</Link>
                </span>
              </label>
              {errors.acceptTerms && <p className="mt-1 text-sm text-error-600 dark:text-error-400">{errors.acceptTerms}</p>}
            </div>

            <div className="mb-6">
              <PremiumButton
                variant="success"
                size="large"
                iconType="check"
                isProcessing={isRegistering}
                processingText="Đang tạo tài khoản..."
                onClick={() => handleSubmit()}
                className="w-full h-12"
              >
                Tạo tài khoản
              </PremiumButton>
            </div>
          </form>

          <div className="text-center">
            <p className="text-neutral-600 dark:text-neutral-400">
              Đã có tài khoản?{' '}
              <Link to="/login" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium">
                Đăng nhập ngay
              </Link>
            </p>
          </div>

          <div className="mb-6 min-h-[56px] mt-6">
            {registerError && (
              <div className="p-4 bg-error-100 dark:bg-error-900/30 text-error-700 dark:text-error-400 rounded-lg">
                {typeof registerError === 'string'
                  ? registerError
                  : (registerError as any)?.data?.message || (registerError as any)?.message || 'Đăng ký thất bại. Vui lòng thử lại!'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
