import { api, baseQuery } from './api';
import { User } from '@/types/user.types';
import {
  AuthResponse,
  LoginCredentials,
  RegisterData,
} from '@/types/auth.types';

type BackendResponse = {
  status?: string;
  message?: string;
  user?: User;
  token?: string;
  refreshToken?: string;
};
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
            // Không để lỗi 401 kích hoạt auto-logout khi đang đăng nhập
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

          const data = result.data as BackendResponse;

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
          return { data: data as unknown as AuthResponse };
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

          const data = result.data as BackendResponse;
          if (data?.status === 'success') {
            return {
              data: {
                user: data.user,
                token: data.token,
                refreshToken: data.refreshToken,
              },
            };
          }
          return { data: data as unknown as AuthResponse };
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

          const data = result.data as BackendResponse;
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
            // Không để lỗi 401 kích hoạt auto-logout khi đang đăng ký
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

          const data = result.data as BackendResponse;

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
          console.error('Lỗi mạng khi đăng ký:', error);
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
      transformResponse: (response: BackendResponse) => {
        if (response?.status === 'success') {
          return {
            token: response.token,
            refreshToken: response.refreshToken,
          };
        }

        return response;
      },
      transformErrorResponse: (response: { data?: BackendResponse; status?: number }) => {
        // Xóa tokens nếu refresh token đã hết hạn
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

          const data = result.data as BackendResponse;
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
          // Xóa dữ liệu trong localStorage
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
            // Không để lỗi 401 kích hoạt auto-logout khi đang đặt lại mật khẩu
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

          const data = result.data as BackendResponse;

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
          console.error('Lỗi mạng khi đặt lại mật khẩu:', error);
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
            // Không để lỗi 401 kích hoạt auto-logout khi đang gửi lại xác minh
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

          const data = result.data as BackendResponse;

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
          console.log('✅ Trả về dữ liệu người dùng:', response.data);
          return response.data; // API trả về user trong response.data
        }

        // Fallback nếu format khác
        return response;
      },
      transformErrorResponse: (response: any) => {
        // Để interceptor global xử lý lỗi 401
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

