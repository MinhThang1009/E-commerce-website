/**
 * @file ChatbotErrorBoundary.tsx
 * @layer Component
 * @feature ai
 * @description UI component cho feature ai
 */
import React, { ReactNode } from 'react';
import i18next from 'i18next';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Error Boundary bọc quanh chatbot widget — nếu ChatWidget throw lỗi không mong muốn
 * (ví dụ: API trả data format sai), chỉ chatbot bị ẩn, không crash toàn bộ trang
 */
class ChatbotErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: React.ErrorInfo) {
    // Log lỗi để debug — không log sensitive data
  }

  render() {
    if (this.state.hasError) {
      // Hiển thị fallback nhỏ gọn thay vì crash trang
      return (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50">
          <div className="bg-neutral-100 dark:bg-neutral-800 text-neutral-500 dark:text-neutral-400 text-xs px-3 py-2 rounded-full shadow">
            {i18next.t('chat.errors.unavailable')}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ChatbotErrorBoundary;
