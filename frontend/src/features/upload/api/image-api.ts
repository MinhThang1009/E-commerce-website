/**
 * @file imageApi.ts
 * @layer API Client
 * @feature upload
 * @description API client functions cho feature upload (image management)
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/lib/api-client';

export interface ImageResponse {
  status: string;
  message: string;
  data: {
    id: string;
    originalName: string;
    fileName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    width?: number;
    height?: number;
    category: 'product' | 'thumbnail' | 'user' | 'review';
    productId?: string;
    userId?: string;
    url: string;
    thumbnails?: Array<{
      size: 'small' | 'medium' | 'large';
      path: string;
      fileName: string;
    }>;
    createdAt: string;
    updatedAt: string;
  };
}

export interface ConvertBase64Options {
  category?: string;
  productId?: string;
}

const imageKeys = {
  all: ['images'] as const,
};

export function useDeleteImageMutation() {
  const queryClient = useQueryClient();
  return useMutation<{ status: string; message: string }, Error, string>({
    mutationFn: async (id) => {
      const { data } = await apiClient.delete(`/images/${id}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imageKeys.all });
    },
  });
}

export function useConvertBase64ToImageMutation() {
  const queryClient = useQueryClient();
  return useMutation<ImageResponse, Error, { base64Data: string; options?: ConvertBase64Options }>({
    mutationFn: async ({ base64Data, options = {} }) => {
      const { data } = await apiClient.post('/images/convert/base64', {
        base64Data,
        category: options.category || 'product',
        productId: options.productId,
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imageKeys.all });
    },
  });
}
