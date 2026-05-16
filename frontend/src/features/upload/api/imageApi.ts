import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';

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

export interface MultipleImageResponse {
  status: string;
  message: string;
  data: {
    successful: ImageResponse['data'][];
    failed: Array<{
      fileName: string;
      error: string;
    }>;
    count: {
      total: number;
      successful: number;
      failed: number;
    };
  };
}

export interface ProductImagesResponse {
  status: string;
  data: {
    images: ImageResponse['data'][];
    count: number;
  };
}

export interface UploadImageOptions {
  category?: 'product' | 'user' | 'review';
  productId?: string;
  generateThumbs?: boolean;
  optimize?: boolean;
}

export interface ConvertBase64Options {
  category?: 'product' | 'user' | 'review';
  productId?: string;
}

// === Query Keys ===

export const imageKeys = {
  all: ['images'] as const,
  detail: (id: string) => [...imageKeys.all, 'detail', id] as const,
  byProduct: (productId: string) => [...imageKeys.all, 'product', productId] as const,
  health: () => [...imageKeys.all, 'health'] as const,
};

// === Query Hooks ===

export function useGetImageByIdQuery(
  id: string,
  options?: { enabled?: boolean; skip?: boolean }
) {
  return useQuery<ImageResponse>({
    queryKey: imageKeys.detail(id),
    queryFn: async () => {
      const { data } = await apiClient.get(`/images/${id}`);
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : !!id,
  });
}

export function useGetImagesByProductIdQuery(
  productId: string,
  options?: { enabled?: boolean; skip?: boolean }
) {
  return useQuery<ProductImagesResponse>({
    queryKey: imageKeys.byProduct(productId),
    queryFn: async () => {
      const { data } = await apiClient.get(`/images/product/${productId}`);
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : !!productId,
  });
}

export function useImageHealthCheckQuery() {
  return useQuery<{ status: string; message: string; data: any }>({
    queryKey: imageKeys.health(),
    queryFn: async () => {
      const { data } = await apiClient.get('/images/health');
      return data;
    },
  });
}

// === Mutation Hooks ===

export function useUploadImageMutation() {
  const queryClient = useQueryClient();
  return useMutation<ImageResponse, Error, { file: File; options?: UploadImageOptions }>({
    mutationFn: async ({ file, options = {} }) => {
      const formData = new FormData();
      formData.append('image', file);

      // Thêm các tùy chọn vào form data
      if (options.category) formData.append('category', options.category);
      if (options.productId) formData.append('productId', options.productId);
      if (options.generateThumbs !== undefined) {
        formData.append('generateThumbs', String(options.generateThumbs));
      }
      if (options.optimize !== undefined) {
        formData.append('optimize', String(options.optimize));
      }

      const { data } = await apiClient.post('/images/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imageKeys.all });
    },
  });
}

export function useUploadMultipleImagesMutation() {
  const queryClient = useQueryClient();
  return useMutation<MultipleImageResponse, Error, { files: File[]; options?: UploadImageOptions }>({
    mutationFn: async ({ files, options = {} }) => {
      const formData = new FormData();
      files.forEach((file) => {
        formData.append('images', file);
      });

      // Thêm các tùy chọn vào form data
      if (options.category) formData.append('category', options.category);
      if (options.productId) formData.append('productId', options.productId);
      if (options.generateThumbs !== undefined) {
        formData.append('generateThumbs', String(options.generateThumbs));
      }
      if (options.optimize !== undefined) {
        formData.append('optimize', String(options.optimize));
      }

      const { data } = await apiClient.post('/images/upload-multiple', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imageKeys.all });
    },
  });
}

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

export function useCleanupOrphanedFilesMutation() {
  const queryClient = useQueryClient();
  return useMutation<{
    status: string;
    message: string;
    data: {
      totalFiles: number;
      activeFiles: number;
      orphanedFiles: number;
      deletedFiles: number;
    };
  }, Error, void>({
    mutationFn: async () => {
      const { data } = await apiClient.post('/images/admin/cleanup');
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: imageKeys.all });
    },
  });
}
