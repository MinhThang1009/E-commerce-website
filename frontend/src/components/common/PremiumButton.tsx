/**
 * @file PremiumButton.tsx
 * @layer Component
 * @feature shared
 * @description Shared UI component
 */
import React from 'react';
import {
  CheckCircle,
  ArrowRight,
  ShoppingCart,
  Heart,
  User,
  Settings,
  Loader2,
} from 'lucide-react';

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

interface PremiumButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: PremiumButtonVariant;
  iconType?: PremiumButtonIcon;
  isProcessing?: boolean;
  processingText?: string;
  gradientHover?: boolean;
  /** Kích thước button — tương thích với API cũ */
  size?: 'small' | 'middle' | 'large';
  /** HTML button type */
  htmlType?: 'button' | 'submit' | 'reset';
}

const getIcon = (iconType: PremiumButtonIcon) => {
  const iconClass = 'size-4';
  switch (iconType) {
    case 'check':
      return <CheckCircle className={iconClass} />;
    case 'arrow-right':
      return <ArrowRight className={iconClass} />;
    case 'cart':
      return <ShoppingCart className={iconClass} />;
    case 'heart':
      return <Heart className={iconClass} />;
    case 'user':
      return <User className={iconClass} />;
    case 'settings':
      return <Settings className={iconClass} />;
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

const getSizeClasses = (size: 'small' | 'middle' | 'large') => {
  switch (size) {
    case 'small':
      return 'h-8 px-3 text-xs rounded-lg';
    case 'large':
      return 'h-12 px-6 text-base rounded-xl';
    case 'middle':
    default:
      return 'h-10 px-4 text-sm rounded-xl';
  }
};

const PremiumButton: React.FC<PremiumButtonProps> = ({
  variant = 'primary',
  iconType = 'none',
  isProcessing = false,
  processingText = 'Processing...',
  gradientHover = true,
  size = 'middle',
  htmlType = 'button',
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

  const buttonStyle: React.CSSProperties = {
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

  const handleMouseEnter = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isProcessing && !disabled && gradientHover) {
      e.currentTarget.style.transform = 'translateY(-2px)';
      e.currentTarget.style.boxShadow = gradientStyle.shadowHover;
    }
    onMouseEnter?.(e);
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLButtonElement>) => {
    if (!isProcessing && !disabled) {
      e.currentTarget.style.transform = 'translateY(0)';
      e.currentTarget.style.boxShadow = gradientStyle.boxShadow;
    }
    onMouseLeave?.(e);
  };

  const getButtonClasses = () => {
    const baseClasses = [
      'premium-button',
      `premium-button-${variant}`,
      'inline-flex items-center justify-center gap-2 font-semibold border cursor-pointer',
      getSizeClasses(size),
    ];

    if (disabled || isProcessing) {
      baseClasses.push('opacity-50 cursor-not-allowed');
    }

    if (className) {
      baseClasses.push(className);
    }

    return baseClasses.join(' ');
  };

  return (
    <button
      type={htmlType}
      disabled={disabled || isProcessing}
      className={getButtonClasses()}
      style={buttonStyle}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      {...props}
    >
      {isProcessing ? (
        <span className="flex items-center justify-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          {processingText}
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          {icon}
          {children}
        </span>
      )}
    </button>
  );
};

export default PremiumButton;
