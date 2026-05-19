/**
 * @file PremiumButton.tsx
 * @layer Component
 * @feature shared
 * @description Shared UI component
 */
import React from 'react';
import { Button, ButtonProps } from 'antd';
import {
  CheckCircleOutlined,
  ArrowRightOutlined,
  ShoppingCartOutlined,
  HeartOutlined,
  UserOutlined,
  SettingOutlined,
} from '@ant-design/icons';

export type PremiumButtonVariant =
  | 'primary' // Gradient xanh lá - CTA chính
  | 'secondary' // Gradient cam - hành động phụ
  | 'success' // Gradient xanh lục - hành động thành công
  | 'info' // Gradient xanh dương - hành động thông tin
  | 'warning' // Gradient vàng - hành động cảnh báo
  | 'danger' // Gradient đỏ - hành động nguy hiểm
  | 'ghost' // Trong suốt có viền
  | 'outline'; // Kiểu outline

export type PremiumButtonIcon =
  | 'check'
  | 'arrow-right'
  | 'cart'
  | 'heart'
  | 'user'
  | 'settings'
  | 'none';

interface PremiumButtonProps extends Omit<ButtonProps, 'type' | 'icon' | 'variant'> {
  variant?: PremiumButtonVariant;
  iconType?: PremiumButtonIcon;
  isProcessing?: boolean;
  processingText?: string;
  gradientHover?: boolean;
}

const getIcon = (iconType: PremiumButtonIcon) => {
  switch (iconType) {
    case 'check':
      return <CheckCircleOutlined />;
    case 'arrow-right':
      return <ArrowRightOutlined />;
    case 'cart':
      return <ShoppingCartOutlined />;
    case 'heart':
      return <HeartOutlined />;
    case 'user':
      return <UserOutlined />;
    case 'settings':
      return <SettingOutlined />;
    default:
      return null;
  }
};

const getGradientStyle = (variant: PremiumButtonVariant, isProcessing: boolean) => {
  const gradients = {
    // primary/secondary: không set background — CSS class .premium-button-primary/secondary xử lý glass
    primary: {
      normal: '',
      processing: '',
      shadow: '',
      shadowHover: 'rgba(42, 172, 167, 0.5)',
    },
    secondary: {
      normal: '',
      processing: '',
      shadow: '',
      shadowHover: 'rgba(255, 117, 94, 0.5)',
    },
    success: {
      normal: 'linear-gradient(135deg, #10B981, #059669)',
      processing: 'linear-gradient(135deg, #34D399, #10B981)',
      shadow: 'rgba(16, 185, 129, 0.3)',
      shadowHover: 'rgba(16, 185, 129, 0.4)',
    },
    info: {
      normal: 'linear-gradient(135deg, #3B82F6, #2563EB)',
      processing: 'linear-gradient(135deg, #60A5FA, #3B82F6)',
      shadow: 'rgba(59, 130, 246, 0.3)',
      shadowHover: 'rgba(59, 130, 246, 0.4)',
    },
    warning: {
      normal: 'linear-gradient(135deg, #F59E0B, #D97706)',
      processing: 'linear-gradient(135deg, #FBBF24, #F59E0B)',
      shadow: 'rgba(245, 158, 11, 0.3)',
      shadowHover: 'rgba(245, 158, 11, 0.4)',
    },
    danger: {
      normal: 'linear-gradient(135deg, #EF4444, #DC2626)',
      processing: 'linear-gradient(135deg, #F87171, #EF4444)',
      shadow: 'rgba(239, 68, 68, 0.3)',
      shadowHover: 'rgba(239, 68, 68, 0.4)',
    },
    ghost: {
      normal: 'transparent',
      processing: 'rgba(42, 172, 167, 0.1)',
      shadow: 'rgba(42, 172, 167, 0.1)',
      shadowHover: 'rgba(42, 172, 167, 0.2)',
    },
    outline: {
      normal: 'transparent',
      processing: 'rgba(42, 172, 167, 0.05)',
      shadow: 'rgba(42, 172, 167, 0.1)',
      shadowHover: 'rgba(42, 172, 167, 0.15)',
    },
  };

  const config = gradients[variant];
  return {
    background: isProcessing ? config.processing : config.normal,
    boxShadow: `0 4px 15px 0 ${config.shadow}`,
    shadowHover: `0 8px 25px 0 ${config.shadowHover}`,
  };
};

const PremiumButton: React.FC<PremiumButtonProps> = ({
  variant = 'primary',
  iconType = 'none',
  isProcessing = false,
  processingText = 'Processing...',
  gradientHover = true,
  children,
  className = '',
  style = {},
  onMouseEnter,
  onMouseLeave,
  disabled,
  ...props
}) => {
  const gradientStyle = getGradientStyle(variant, isProcessing);
  const icon = !isProcessing && iconType !== 'none' ? getIcon(iconType) : null;

  const isGhost = variant === 'ghost';
  const isOutline = variant === 'outline';

  const buttonStyle = {
    // primary/secondary: background='' → không override → CSS class glass xử lý
    ...(gradientStyle.background ? { background: gradientStyle.background } : {}),
    ...(gradientStyle.boxShadow && !gradientStyle.boxShadow.endsWith(' ')
      ? { boxShadow: gradientStyle.boxShadow }
      : {}),
    borderColor: isOutline ? '#2AACA7' : 'transparent',
    color: isGhost || isOutline ? '#2AACA7' : 'white',
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    ...style,
  };

  const handleMouseEnter = (e: React.MouseEvent<HTMLElement>) => {
    if (!isProcessing && !disabled && gradientHover) {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = gradientStyle.shadowHover;
    }
    onMouseEnter?.(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLElement>) => {
    if (!isProcessing && !disabled) {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = gradientStyle.boxShadow;
    }
    onMouseLeave?.(e);
  };

  const getButtonType = () => {
    if (isGhost || isOutline) return 'default';
    return 'primary';
  };

  const getButtonClasses = () => {
    const baseClasses = [
      'premium-button',
      `premium-button-${variant}`,
      'css-dev-only-do-not-override-mc1tut',
    ];

    // Thêm các class Ant Design tương ứng cho từng variant
    if (variant === 'primary') {
      baseClasses.push('ant-btn-primary', 'ant-btn-color-primary', 'ant-btn-variant-solid');
    } else if (variant === 'secondary') {
      baseClasses.push('ant-btn-default', 'ant-btn-color-default', 'ant-btn-variant-solid');
    } else if (variant === 'success') {
      baseClasses.push('ant-btn-primary', 'ant-btn-color-primary', 'ant-btn-variant-solid');
    } else if (variant === 'danger') {
      baseClasses.push('ant-btn-dangerous', 'ant-btn-color-danger', 'ant-btn-variant-solid');
    } else if (variant === 'outline') {
      baseClasses.push('ant-btn-default', 'ant-btn-color-default', 'ant-btn-variant-outlined');
    } else if (variant === 'ghost') {
      baseClasses.push('ant-btn-text', 'ant-btn-color-default', 'ant-btn-variant-text');
    }

    if (className) {
      baseClasses.push(className);
    }

    return baseClasses.join(' ');
  };

  return (
    <Button
      type={getButtonType()}
      loading={isProcessing}
      disabled={disabled || isProcessing}
      icon={icon}
      className={getButtonClasses()}
      style={buttonStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {isProcessing ? (
        <span className="flex items-center justify-center">{processingText}</span>
      ) : (
        <span className="flex items-center justify-center">{children}</span>
      )}
    </Button>
  );
};

export default PremiumButton;
