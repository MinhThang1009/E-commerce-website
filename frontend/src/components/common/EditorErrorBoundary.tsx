/**
 * @file EditorErrorBoundary.tsx
 * @layer Component
 * @feature shared
 * @description Shared UI component
 */
import React, { Component, ReactNode } from 'react';
import i18next from 'i18next';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  height?: number;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

class EditorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('EditorErrorBoundary bắt được lỗi:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      const {
        height = 200,
        placeholder,
        value = '',
        onChange,
      } = this.props;

      const resolvedPlaceholder = placeholder ?? i18next.t('editor.placeholder');

      return (
        <div
          style={{
            border: '1px solid #d9d9d9',
            borderRadius: '6px',
            padding: '12px',
            minHeight: `${height}px`,
            backgroundColor: '#fff2f0',
            color: '#ff4d4f',
          }}
        >
          <p>❌ {i18next.t('editor.errorFallback')}</p>
          <p style={{ fontSize: '12px', color: '#999' }}>
            {i18next.t('editor.error', { message: this.state.error?.message || i18next.t('errors.unknown') })}
          </p>
          <textarea
            placeholder={resolvedPlaceholder}
            value={value}
            onChange={(e) => onChange?.(e.target.value)}
            style={{
              width: '100%',
              minHeight: `${height - 80}px`,
              border: 'none',
              outline: 'none',
              resize: 'vertical',
              fontFamily: 'inherit',
              backgroundColor: 'transparent',
            }}
          />
        </div>
      );
    }

    return this.props.children;
  }
}

export default EditorErrorBoundary;
