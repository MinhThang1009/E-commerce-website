import { api, baseQuery } from './api';
import { User } from '@/types/user.types';
import {
  AuthResponse,
  LoginCredentials,
  RegisterData,
} from '@/types/auth.types';
import { authenticateUser, getUserByEmail } from '@/data/mockUsers';

export const authApi = api.injectEndpoints({
  endpoints: (builder) => ({
    login: builder.mutation<AuthResponse, LoginCredentials>({
      queryFn: async (credentials, api, extraOptions) => {
        try {
          const result = await baseQuery(
            {
              url: '/auth/login',
              method: 'POST',
              body: {
                email: credentials.email,
                password: credentials.password,
              },
            },
            api,
            extraOptions
          );

          if (result.error) {
            console.log('Login error:', result.error);

            // Don't let 401 errors trigger auto-logout for login attempts
            if (result.error.status === 401) {
              return {
                error: {
                  status: result.error.status,
                  data: result.error.data || 'Invalid email or password',
                },
              };
            }

            return { error: result.error };
          }

          console.log('Login response:', result.data);
          const data = result.data as any;

          // Xử lý response từ API theo format thật từ backend
          if (data?.status === 'success') {
            return {
              data: {
                user: data.user,
                token: data.token,
                refreshToken: data.refreshToken,
              },
            };
          }

          // Fallback nếu format khác
          return { data: data as AuthResponse };
        } catch (error) {
          console.error('Login network error:', error);
          return {
            error: {
              status: 'FETCH_ERROR',
              error: 'Network error, please try again',
            },
          };
        }
      },
    }),

    googleLogin: builder.mutation<AuthResponse, { token: string }>({
      queryFn: async ({ token }, api, extraOptions) => {
        try {
          const result = await baseQuery(
            {
              url: '/auth/google',
              method: 'POST',
              body: { token },
            },
            api,
            extraOptions
          );

          if (result.error) {
            return { error: result.error };
          }

          const data = result.data as any;
          if (data?.status === 'success') {
            return {
              data: {
                user: data.user,
                token: data.token,
                refreshToken: data.refreshToken,
              },
            };
          }
          return { data: data as AuthResponse };
        } catch (error) {
          return {
            error: {
              status: 'FETCH_ERROR',
              error: 'Network error, please try again',
            },
          };
        }
      },
    }),

    verifyOtp: builder.mutation<{ message: string }, { email: string; otp: string }>({
      queryFn: async ({ email, otp }, api, extraOptions) => {
        try {
          const result = await baseQuery(
            {
              url: '/auth/verify-otp',
              method: 'POST',
              body: { email, otp },
            },
            api,
            extraOptions
          );

          if (result.error) {
            return { error: result.error };
          }

          const data = result.data as any;
          return {
            data: {
              message: data?.message || 'Email verified successfully',
            },
          };
        } catch (error) {
          return {
            error: {
              status: 'FETCH_ERROR',
              error: error instanceof Error ? error.message : 'Network error',
            },
          };
        }
      },
    }),

    register: builder.mutation<AuthResponse, RegisterData>({
      queryFn: async (userData, api, extraOptions) => {
        try {
          const result = await baseQuery(
            {
              url: '/auth/register',
              method: 'POST',
              body: userData,
            },
            api,
            extraOptions
          );

          if (result.error) {
            console.log('Register error:', result.error);

            // Don't let 401 errors trigger auto-logout for registration attempts
            if (result.error.status === 401) {
              return {
                error: {
                  status: result.error.status,
                  data: result.error.data || 'Registration failed',
                },
              };
            }

            return { error: result.error };
          }

          console.log('Register response:', result.data);
          const data = result.data as any;

          // Xử lý response từ API theo format thật từ backend
          if (data?.status === 'success') {
            return {
              data: {
                user: data.user,
                token: data.token,
                refreshToken: data.refreshToken,
              },
            };
          }

          // Fallback nếu format khác
          return { data: data as AuthResponse };
        } catch (error) {
          console.error('Register network error:', error);
          return {
            error: {
              status: 'FETCH_ERROR',
              error: 'Network error, please try again',
            },
          };
        }
      },
    }),

    refreshToken: builder.mutation<
      { token: string; refreshToken: string },
      void
    >({
      query: () => ({
        url: '/auth/refresh-token',
        method: 'POST',
        body: { refreshToken: localStorage.getItem('refreshToken') },
      }),
      transformResponse: (response: any) => {
        console.log('Refresh token response:', response);

        if (response?.status === 'success') {
          return {
            token: response.token,
            refreshToken: response.refreshToken,
          };
        }

        return response;
      },
      transformErrorResponse: (response: any) => {
        console.log('Refresh token error:', response);

        // Clear tokens nếu refresh token expired
        localStorage.removeItem('token');
        localStorage.removeItem('refreshToken');

        return response?.data || 'Token refresh failed';
      },
    }),

    forgotPassword: builder.mutation<{ message: string }, { email: string }>({
      queryFn: async ({ email }, api, extraOptions) => {
        try {
          const result = await baseQuery(
            {
              url: '/auth/forgot-password',
              method: 'POST',
              body: { email },
            },
            api,
            extraOptions
          );

          if (result.error) {
            return { error: result.error };
          }

          const data = result.data as any;
          return {
            data: {
              message: data?.message || 'Password reset email sent',
            },
          };
        } catch (error) {
          return {
            error: {
              status: 'FETCH_ERROR',
              error: 'Network error, please try again',
            },
          };
        }
      },
    }),

    logout: builder.mutation<void, void>({
      queryFn: () => {
        try {
          // Clear localStorage
          localStorage.removeItem('token');
          localStorage.removeItem('refreshToken');
          localStorage.removeItem('user');

          return { data: undefined };
        } catch (error) {
          return { error: { status: 500, data: 'Logout failed' } };
        }
      },
    }),

    resetPassword: builder.mutation<
      { message: string },
      { token: string; password: string }
    >({
      queryFn: async ({ token, password }, api, extraOptions) => {
        try {
          const result = await baseQuery(
            {
              url: `/auth/reset-password`,
              method: 'POST',
              body: { token, password },
            },
            api,
            extraOptions
          );

          if (result.error) {
            console.log('Reset password error:', result.error);

            // Don't let 401 errors trigger auto-logout for password reset attempts
            if (result.error.status === 401) {
              return {
                error: {
                  status: result.error.status as number,
                  data: result.error.data || 'Password reset failed',
                },
              };
            }

            return { error: result.error };
          }

          console.log('Reset password response:', result.data);
          const data = result.data as any;

          // Xử lý response từ API theo format thật từ backend
          if (data?.status === 'success') {
            return {
              data: {
                message:
                  data.message || 'Password has been reset successfully',
              },
            };
          }

          // Fallback nếu format khác
          return { data: { message: data?.message || 'Password has been reset successfully' } };
        } catch (error) {
          console.error('Reset password network error:', error);
          return {
            error: {
              status: 'FETCH_ERROR',
              error: 'Network error, please try again',
            },
          };
        }
      },
    }),

    resendVerification: builder.mutation<
      { message: string },
      { email: string }
    >({
      queryFn: async ({ email }, api, extraOptions) => {
        try {
          const result = await baseQuery(
            {
              url: '/auth/resend-verification',
              method: 'POST',
              body: { email },
            },
            api,
            extraOptions
          );

          if (result.error) {
            console.log('Resend verification error:', result.error);

            // Don't let 401 errors trigger auto-logout for resend attempts
            if (result.error.status === 401) {
              return {
                error: {
                  status: result.error.status as number,
                  data:
                    result.error.data || 'Failed to resend verification email',
                },
              };
            }

            return { error: result.error };
          }

          const data = result.data as any;

          // Xử lý response từ API theo format thật từ backend
          if (data?.status === 'success') {
            return {
              data: {
                message:
                  data.message || 'Verification email sent successfully',
              },
            };
          }

          // Fallback nếu format khác
          return { data: { message: data?.message || 'Verification email sent successfully' } };
        } catch (error) {
          return {
            error: {
              status: 'FETCH_ERROR',
              error: 'Network error, please try again',
            },
          };
        }
      },
    }),

    getCurrentUser: builder.query<User, void>({
      query: () => ({
        url: '/auth/me',
        method: 'GET',
      }),
      transformResponse: (response: any) => {
        // Xử lý response từ API theo format thật từ backend
        if (response?.status === 'success') {
          console.log('✅ Returning user data:', response.data);
          return response.data; // API trả về user trong response.data
        }

        // Fallback nếu format khác
        return response;
      },
      transformErrorResponse: (response: any) => {
        // Let the global interceptor handle 401 errors
        return response?.data || 'Failed to fetch user';
      },
      providesTags: ['CurrentUser'],
    }),
  }),
});

export const {
  useLoginMutation,
  useRegisterMutation,
  useRefreshTokenMutation,
  useLogoutMutation,
  useResetPasswordMutation,
  useResendVerificationMutation,
  useGetCurrentUserQuery,
  useVerifyOtpMutation,
  useForgotPasswordMutation,
  useGoogleLoginMutation,
} = authApi;

