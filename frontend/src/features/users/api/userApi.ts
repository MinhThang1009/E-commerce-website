/**
 * @file userApi.ts
 * @layer API Client
 * @feature users
 * @description API client functions cho feature users
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';
import { User, Address } from '@/types/user.types';

export interface UpdateProfileRequest {
  firstName?: string;
  lastName?: string;
  phone?: string;
  avatar?: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

// === Query Keys ===

export const userKeys = {
  all: ['user'] as const,
  addresses: () => [...userKeys.all, 'addresses'] as const,
  currentUser: () => [...userKeys.all, 'current'] as const,
};

// === Query Hooks ===

export function useGetAddressesQuery(options?: { enabled?: boolean; skip?: boolean }) {
  return useQuery<Address[]>({
    queryKey: userKeys.addresses(),
    queryFn: async () => {
      const { data: response } = await apiClient.get('/users/addresses');
      if (response?.status === 'success') {
        return response.data;
      }
      return [];
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

// === Mutation Hooks ===

export function useUpdateProfileMutation() {
  const queryClient = useQueryClient();
  return useMutation<User, Error, UpdateProfileRequest>({
    mutationFn: async (userData) => {
      const { data: response } = await apiClient.put('/users/profile', userData);
      if (response?.status === 'success') {
        return response.data;
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.currentUser() });
    },
  });
}

export function useChangePasswordMutation() {
  return useMutation<{ message: string }, Error, ChangePasswordRequest>({
    mutationFn: async (passwordData) => {
      const { data: response } = await apiClient.post('/users/change-password', passwordData);
      if (response?.status === 'success') {
        return { message: response.message };
      }
      return response;
    },
  });
}

export function useAddAddressMutation() {
  const queryClient = useQueryClient();
  return useMutation<Address, Error, Omit<Address, 'id'>>({
    mutationFn: async (addressData) => {
      const { data: response } = await apiClient.post('/users/addresses', addressData);
      if (response?.status === 'success') {
        return response.data;
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.addresses() });
    },
  });
}

export function useUpdateAddressMutation() {
  const queryClient = useQueryClient();
  return useMutation<Address, Error, Partial<Address> & { id: string }>({
    mutationFn: async ({ id, ...addressData }) => {
      const { data: response } = await apiClient.put(`/users/addresses/${id}`, addressData);
      if (response?.status === 'success') {
        return response.data;
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.addresses() });
    },
  });
}

export function useDeleteAddressMutation() {
  const queryClient = useQueryClient();
  return useMutation<{ message: string }, Error, string>({
    mutationFn: async (id) => {
      const { data: response } = await apiClient.delete(`/users/addresses/${id}`);
      if (response?.status === 'success') {
        return { message: response.message };
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.addresses() });
    },
  });
}

export function useSetDefaultAddressMutation() {
  const queryClient = useQueryClient();
  return useMutation<Address, Error, string>({
    mutationFn: async (id) => {
      const { data: response } = await apiClient.patch(`/users/addresses/${id}/default`);
      if (response?.status === 'success') {
        return response.data;
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: userKeys.addresses() });
    },
  });
}
