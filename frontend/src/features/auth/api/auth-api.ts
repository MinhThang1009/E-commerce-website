/**
 * @file authApi.ts
 * @layer API Client
 * @feature auth
 * @description API client functions cho feature auth
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/api-client';
import { User } from '@/types/user.types';
import { AuthResponse, LoginCredentials, RegisterData } from '../types/auth.types';

type BackendResponse = {
  status?: string;
  message?: string;
  user?: User;
  token?: string;
  data?: User;
};

function parseAuthResponse(data: BackendResponse): AuthResponse {
  if (data?.status === 'success') {
    return { user: data.user!, token: data.token! };
  }
  return data as unknown as AuthResponse;
}

function parseMessageResponse(data: BackendResponse, fallback: string): { message: string } {
  if (data?.status === 'success') {
    return { message: data.message || fallback };
  }
  return { message: data?.message || fallback };
}

export function useLoginMutation() {
  return useMutation({
    mutationFn: async (credentials: LoginCredentials) => {
      const { data } = await apiClient.post<BackendResponse>('/auth/login', {
        email: credentials.email,
        password: credentials.password,
      });
      return parseAuthResponse(data);
    },
  });
}

export function useGoogleLoginMutation() {
  return useMutation({
    mutationFn: async ({ token }: { token: string }) => {
      const { data } = await apiClient.post<BackendResponse>('/auth/google', { token });
      return parseAuthResponse(data);
    },
  });
}

export function useVerifyOtpMutation() {
  return useMutation({
    mutationFn: async ({ email, otp }: { email: string; otp: string }) => {
      const { data } = await apiClient.post<BackendResponse>('/auth/verify-otp', { email, otp });
      return parseMessageResponse(data, 'Email verified successfully');
    },
  });
}

export function useRegisterMutation() {
  return useMutation({
    mutationFn: async (userData: RegisterData) => {
      const { data } = await apiClient.post<BackendResponse>('/auth/register', userData);
      return parseAuthResponse(data);
    },
  });
}

export function useRefreshTokenMutation() {
  return useMutation({
    mutationFn: async () => {
      const { data } = await apiClient.post<BackendResponse>('/auth/refresh-token');
      if (data?.status === 'success') {
        return { token: data.token! };
      }
      return data as unknown as { token: string };
    },
  });
}

export function useForgotPasswordMutation() {
  return useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const { data } = await apiClient.post<BackendResponse>('/auth/forgot-password', { email });
      return parseMessageResponse(data, 'Password reset email sent');
    },
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await apiClient.post('/auth/logout');
    },
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

export function useResetPasswordMutation() {
  return useMutation({
    mutationFn: async ({ token, password }: { token: string; password: string }) => {
      const { data } = await apiClient.post<BackendResponse>('/auth/reset-password', {
        token,
        password,
      });
      return parseMessageResponse(data, 'Password has been reset successfully');
    },
  });
}

export function useResendVerificationMutation() {
  return useMutation({
    mutationFn: async ({ email }: { email: string }) => {
      const { data } = await apiClient.post<BackendResponse>('/auth/resend-verification', {
        email,
      });
      return parseMessageResponse(data, 'Verification email sent successfully');
    },
  });
}

export function useGetCurrentUserQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['auth', 'currentUser'],
    queryFn: async () => {
      const { data } = await apiClient.get<BackendResponse>('/auth/me');
      if (data?.status === 'success') {
        return data.data as User;
      }
      return data as unknown as User;
    },
    ...options,
  });
}
