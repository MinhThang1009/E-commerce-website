/**
 * @file uploadApi.ts
 * @layer API Client
 * @feature upload
 * @description API client functions cho feature upload
 */
import { useMutation } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface UploadResponse {
  status: string;
  message: string;
  data: {
    filename: string;
    originalName: string;
    url: string;
    size: number;
    type: string;
  };
}

export interface MultipleUploadResponse {
  status: string;
  message: string;
  data: {
    files: Array<{
      filename: string;
      originalName: string;
      url: string;
      size: number;
    }>;
    type: string;
    count: number;
  };
}

// === Mutation Hooks ===

export function useUploadSingleMutation() {
  return useMutation<UploadResponse, Error, { type: string; file: File }>({
    mutationFn: async ({ type, file }) => {
      const formData = new FormData();
      formData.append('file', file);
      const { data } = await apiClient.post(`/uploads/${type}/single`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
  });
}

export function useUploadMultipleMutation() {
  return useMutation<MultipleUploadResponse, Error, { type: string; files: File[] }>({
    mutationFn: async ({ type, files }) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('files', file);
      });
      const { data } = await apiClient.post(`/uploads/${type}/multiple`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
  });
}

export function useDeleteFileMutation() {
  return useMutation<
    { status: string; message: string },
    Error,
    { type: string; filename: string }
  >({
    mutationFn: async ({ type, filename }) => {
      const { data } = await apiClient.delete(`/uploads/${type}/${filename}`);
      return data;
    },
  });
}
