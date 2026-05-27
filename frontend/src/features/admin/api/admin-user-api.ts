/**
 * @file adminUserApi.ts
 * @layer API Client
 * @feature admin
 * @description API client functions cho feature admin
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';
import type { User } from '@/types/user.types';

export interface UserDetail extends User {
  isActive: boolean;
  isEmailVerified: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserResponse {
  status: string;
  data: {
    users: UserDetail[];
    pagination: {
      currentPage: number;
      totalPages: number;
      totalItems: number;
      itemsPerPage: number;
    };
  };
}

export interface UpdateUserRequest {
  id: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: 'customer' | 'admin';
  isEmailVerified?: boolean;
  isActive?: boolean;
}

export interface UserFilters {
  page?: number;
  limit?: number;
  search?: string;
  role?: string;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
  isEmailVerified?: boolean;
}

// === Query Keys ===

const adminUserKeys = {
  all: ['admin-users'] as const,
  lists: () => [...adminUserKeys.all, 'list'] as const,
  list: (filters: unknown) => [...adminUserKeys.lists(), filters] as const,
  details: () => [...adminUserKeys.all, 'detail'] as const,
  detail: (id: string) => [...adminUserKeys.details(), id] as const,
};

// === Query Hooks ===

export function useGetAllUsersQuery(
  params: UserFilters = {},
  options?: { enabled?: boolean; skip?: boolean },
) {
  return useQuery<UserResponse>({
    queryKey: adminUserKeys.list(params),
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== '') {
          queryParams.append(key, value.toString());
        }
      });
      const { data } = await apiClient.get(`/admin/users?${queryParams.toString()}`);
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

export function useGetUserByIdQuery(id: string, options?: { enabled?: boolean; skip?: boolean }) {
  // Admin API trả về user detail với nhiều trường mở rộng (orders, addresses, loyalty...)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return useQuery<{ status: string; data: { user: any } }>({
    queryKey: adminUserKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get(`/admin/users/${id}`);
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : !!id,
  });
}

// === Mutation Hooks ===

export function useUpdateUserMutation() {
  const queryClient = useQueryClient();
  return useMutation<{ status: string; data: { user: UserDetail } }, Error, UpdateUserRequest>({
    mutationFn: async ({ id, ...userData }) => {
      const { data } = await apiClient.put(`/admin/users/${id}`, userData);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
    },
  });
}

export function useDeleteUserMutation() {
  const queryClient = useQueryClient();
  return useMutation<{ status: string; message: string }, Error, string>({
    mutationFn: async (id) => {
      const { data } = await apiClient.delete(`/admin/users/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: adminUserKeys.all });
    },
  });
}
