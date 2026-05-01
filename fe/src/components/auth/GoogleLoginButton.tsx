import React from 'react';
import { useGoogleLogin } from '@react-oauth/google';
import { useGoogleLoginMutation } from '@/services/authApi';
import { useDispatch } from 'react-redux';
import { loginSuccess } from '@/features/auth/authSlice';
import { addNotification } from '@/features/ui/uiSlice';
import { PremiumButton } from '@/components/common';

const GoogleLoginButton: React.FC = () => {
  const dispatch = useDispatch();
  const [googleLogin, { isLoading }] = useGoogleLoginMutation();

  const handleGoogleSuccess = async (tokenResponse: any) => {
    try {
      console.log('Google login client success, sending to backend...');
      
      // The implicit flow gives an access_token. 
      // We pass this to our backend which will fetch the user info.
      const result = await googleLogin({ token: tokenResponse.access_token }).unwrap();
      
      dispatch(loginSuccess(result));

      dispatch(addNotification({
        message: 'Đăng nhập Google thành công!',
        type: 'success',
      }));
    } catch (error: any) {
      console.error('Google login error:', error);
      dispatch(addNotification({
        message: error?.data?.message || 'Đăng nhập Google thất bại',
        type: 'error',
      }));
    }
  };

  const login = useGoogleLogin({
    onSuccess: handleGoogleSuccess,
    onError: () => {
      dispatch(addNotification({
        message: 'Xác thực Google thất bại',
        type: 'error',
      }));
    },
  });

  return (
    <PremiumButton
      variant="outline"
      onClick={() => login()}
      isProcessing={isLoading}
      className="w-full h-12 flex items-center justify-center gap-2 border-neutral-300 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800"
    >
      <div className="flex items-center justify-center gap-2">
        <svg className="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span className="font-semibold text-neutral-700 dark:text-neutral-200">
          Đăng nhập với Google
        </span>
      </div>
    </PremiumButton>
  );
};

export default GoogleLoginButton;
