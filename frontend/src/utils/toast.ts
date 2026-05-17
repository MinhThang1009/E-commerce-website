/**
 * @file toast.ts
 * @layer Utility
 * @feature global
 * @description Helper utility function
 */
import { message } from 'antd';
import { useUiStore } from '@/stores/uiStore';

/**
 * Tiện ích toast cho toàn bộ ứng dụng
 *
 * Đây là cách được khuyến nghị để hiển thị thông báo toast trong ứng dụng.
 * Tự động xử lý dark/light mode và cung cấp interface nhất quán.
 *
 * Cách dùng:
 * import { toast } from '@/utils/toast';
 *
 * toast.success('Operation successful');
 * toast.error('Something went wrong');
 * toast.info('Information message');
 * toast.warning('Warning message');
 * toast.loading('Loading...');
 *
 * // Tùy chỉnh thời gian hiển thị (tính bằng giây)
 * toast.success('Saved successfully', 5);
 *
 * // Dùng key để cập nhật hoặc đóng toast
 * const key = 'updating';
 * toast.loading('Updating...', 0, key); // Duration 0 nghĩa là không tự đóng
 * // Sau đó:
 * toast.success('Updated successfully', 2, key); // Sẽ thay thế toast đang loading
 * // Hoặc đóng thủ công:
 * toast.close(key);
 */

// Cấu hình mặc định cho toast
message.config({
  top: 70,
  duration: 3,
  maxCount: 5,
});

// Hàm helper để lấy theme hiện tại từ Zustand store
const isDarkMode = () => {
  try {
    const theme = useUiStore.getState().theme;

    // Nếu không có theme trong store, kiểm tra class trên document
    if (!theme) {
      return document.documentElement.classList.contains('dark');
    }

    return theme === 'dark';
  } catch (error) {
    // Fallback nếu có lỗi khi truy cập store
    return document.documentElement.classList.contains('dark');
  }
};

// Tạo class name dựa trên theme
const getClassName = () => {
  return isDarkMode() ? 'ant-message-dark' : '';
};

// Export toast API để sử dụng trong toàn bộ ứng dụng
export const toast = {
  success: (content: string, duration?: number, key?: string) => {
    return message.success({
      content,
      duration,
      key,
      className: getClassName(),
    });
  },

  error: (content: string, duration?: number, key?: string) => {
    return message.error({
      content,
      duration,
      key,
      className: getClassName(),
    });
  },

  info: (content: string, duration?: number, key?: string) => {
    return message.info({
      content,
      duration,
      key,
      className: getClassName(),
    });
  },

  warning: (content: string, duration?: number, key?: string) => {
    return message.warning({
      content,
      duration,
      key,
      className: getClassName(),
    });
  },

  loading: (content: string, duration?: number, key?: string) => {
    return message.loading({
      content,
      duration,
      key,
      className: getClassName(),
    });
  },

  // Đóng toast theo key hoặc tất cả
  close: (key?: string) => {
    if (key) {
      message.destroy(key);
    } else {
      message.destroy();
    }
  },
};

