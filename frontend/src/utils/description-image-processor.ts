/**
 * @file descriptionImageProcessor.ts
 * @layer Utility
 * @feature global
 * @description Helper utility function
 */
import { message } from 'antd';
import i18next from 'i18next';
import { getErrorMsg } from '@/utils/error-utils';

export interface ProcessDescriptionOptions {
  productId?: string;
  category?: 'product' | 'user' | 'review';
  uploadImageFn: (params: {
    base64Data: string;
    options?: {
      category?: string;
      productId?: string;
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) => Promise<any>;
}

export interface ProcessDescriptionResult {
  processedDescription: string;
  uploadedImages: Array<{
    originalBase64: string;
    uploadedUrl: string;
    imageId: string;
  }>;
  hasChanges: boolean;
}

/**
 * Xử lý nội dung mô tả để chuyển đổi ảnh base64 thành file đã tải lên
 * @param description - Nội dung HTML từ trình soạn thảo văn bản
 * @param options - Tùy chọn xử lý
 * @returns Promise với mô tả đã xử lý và kết quả tải lên
 */
export const processDescriptionImages = async (
  description: string,
  options: ProcessDescriptionOptions,
): Promise<ProcessDescriptionResult> => {
  if (!description) {
    return {
      processedDescription: description,
      uploadedImages: [],
      hasChanges: false,
    };
  }

  // Tìm tất cả URL dữ liệu ảnh base64 trong mô tả
  const base64ImageRegex = /data:image\/[a-zA-Z]*;base64,[A-Za-z0-9+/=]+/g;
  const base64Images = description.match(base64ImageRegex) || [];

  if (base64Images.length === 0) {
    return {
      processedDescription: description,
      uploadedImages: [],
      hasChanges: false,
    };
  }

  let processedDescription = description;
  const uploadedImages: ProcessDescriptionResult['uploadedImages'] = [];
  let hasErrors = false;

  // Hiển thị thông báo đang tải
  const loadingKey = 'converting-images';
  message.loading({
    content: i18next.t('descProcessor.converting', { count: base64Images.length }),
    key: loadingKey,
    duration: 0,
  });

  try {
    // Xử lý từng ảnh base64
    for (let i = 0; i < base64Images.length; i++) {
      const base64Data = base64Images[i];

      try {
        // Cập nhật thông báo đang tải
        message.loading({
          content: i18next.t('descProcessor.convertingItem', {
            current: i + 1,
            total: base64Images.length,
          }),
          key: loadingKey,
          duration: 0,
        });

        // Gọi API để chuyển đổi base64 thành file đã tải lên
        const result = await options.uploadImageFn({
          base64Data,
          options: {
            category: options.category || 'product',
            productId: options.productId,
          },
        });

        if (result?.data) {
          const domainUrl = (import.meta.env.VITE_API_URL || 'http://localhost:8888/api').replace(
            /\/api\/?$/,
            '',
          );
          const uploadedUrl = `${domainUrl}${result.data.url}`;

          // Thay thế base64 bằng URL đã tải lên trong mô tả
          processedDescription = processedDescription.replace(base64Data, uploadedUrl);

          // Lưu thông tin ảnh đã tải lên
          uploadedImages.push({
            originalBase64: base64Data,
            uploadedUrl,
            imageId: result.data.id,
          });
        } else {
          console.error(`Chuyển đổi ảnh ${i + 1} thất bại: Không có dữ liệu trong response`);
          hasErrors = true;
        }
      } catch (error) {
        console.error(`Lỗi khi chuyển đổi ảnh ${i + 1}:`, error);
        hasErrors = true;

        // Tiếp tục xử lý ảnh khác dù một ảnh bị lỗi
        const errorMessage = getErrorMsg(error, 'Unknown error');
        console.error(`Chuyển đổi ảnh ${i + 1} thất bại: ${errorMessage}`);
      }
    }

    // Ẩn thông báo đang tải
    message.destroy(loadingKey);

    // Hiển thị thông báo kết quả
    if (uploadedImages.length > 0) {
      if (hasErrors) {
        message.warning(
          i18next.t('descProcessor.partialSuccess', {
            uploaded: uploadedImages.length,
            total: base64Images.length,
          }),
        );
      } else {
        message.success(i18next.t('descProcessor.fullSuccess', { count: uploadedImages.length }));
      }
    } else if (hasErrors) {
      message.error(i18next.t('descProcessor.allFailed'));
    }

    return {
      processedDescription,
      uploadedImages,
      hasChanges: uploadedImages.length > 0,
    };
  } catch (error) {
    message.destroy(loadingKey);
    console.error('Lỗi khi xử lý ảnh trong mô tả:', error);
    message.error(i18next.t('descProcessor.error'));

    return {
      processedDescription: description, // Trả về bản gốc nếu có lỗi
      uploadedImages: [],
      hasChanges: false,
    };
  }
};

/**
 * Kiểm tra mô tả có chứa ảnh base64 không
 * @param description - Nội dung HTML cần kiểm tra
 * @returns boolean cho biết có tìm thấy ảnh base64 không
 */
export const hasBase64Images = (description: string): boolean => {
  if (!description) return false;
  const base64ImageRegex = /data:image\/[a-zA-Z]*;base64,[A-Za-z0-9+/=]+/g;
  return base64ImageRegex.test(description);
};

/**
 * Đếm số ảnh base64 trong mô tả
 * @param description - Nội dung HTML cần kiểm tra
 * @returns Số lượng ảnh base64 tìm thấy
 */
export const countBase64Images = (description: string): number => {
  if (!description) return 0;
  const base64ImageRegex = /data:image\/[a-zA-Z]*;base64,[A-Za-z0-9+/=]+/g;
  const matches = description.match(base64ImageRegex);
  return matches ? matches.length : 0;
};
