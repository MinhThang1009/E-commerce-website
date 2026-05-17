/**
 * @file Rating.tsx
 * @layer Component
 * @feature shared
 * @description Shared UI component
 */
import React from 'react';

interface RatingProps {
  value: number;
  onChange?: (value: number) => void;
  size?: 'small' | 'medium' | 'large';
  interactive?: boolean;
  className?: string;
  showCount?: boolean;
  count?: number;
  readOnly?: boolean;
  readonly?: boolean;
}

export const Rating: React.FC<RatingProps> = ({
  value,
  onChange,
  size = 'medium',
  interactive = false,
  className = '',
  showCount = false,
  count,
  readOnly,
  readonly,
}) => {
  const [hoverValue, setHoverValue] = React.useState<number | null>(null);
  const isReadOnly = readOnly ?? readonly ?? false;
  const isInteractive = interactive && !isReadOnly;

  // Xác định kích thước ngôi sao theo prop size
  const starSizeClass = {
    small: 'w-4 h-4',
    medium: 'w-5 h-5',
    large: 'w-6 h-6',
  }[size];

  // Xác định kích thước container theo prop size
  const containerSizeClass = {
    small: 'gap-1',
    medium: 'gap-1.5',
    large: 'gap-2',
  }[size];

  // Xử lý khi di chuột vào ngôi sao
  const handleMouseEnter = (index: number) => {
    if (isInteractive) {
      setHoverValue(index);
    }
  };

  // Xử lý khi di chuột ra khỏi component rating
  const handleMouseLeave = () => {
    if (isInteractive) {
      setHoverValue(null);
    }
  };

  // Xử lý khi click vào ngôi sao
  const handleClick = (index: number) => {
    if (isInteractive && onChange) {
      onChange(index);
    }
  };

  // Xác định giá trị hiển thị (giá trị hover hoặc giá trị thực)
  const effectiveValue = hoverValue !== null ? hoverValue : value;

  return (
    <div className={`flex items-center ${className}`}>
      <div
        className={`flex ${containerSizeClass}`}
        onMouseLeave={handleMouseLeave}
      >
        {[1, 2, 3, 4, 5].map((index) => (
          <Star
            key={index}
            filled={index <= effectiveValue}
            size={starSizeClass}
            onMouseEnter={() => handleMouseEnter(index)}
            onClick={() => handleClick(index)}
            interactive={isInteractive}
          />
        ))}
      </div>

      {showCount && count !== undefined && (
        <span className="ml-2 text-sm text-neutral-500 dark:text-neutral-400">
          ({count})
        </span>
      )}
    </div>
  );
};

interface StarProps {
  filled: boolean;
  size: string;
  onMouseEnter: () => void;
  onClick: () => void;
  interactive: boolean;
}

const Star: React.FC<StarProps> = ({
  filled,
  size,
  onMouseEnter,
  onClick,
  interactive,
}) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      className={`${size} ${
        filled ? 'text-yellow-400' : 'text-neutral-300 dark:text-neutral-600'
      } ${interactive ? 'cursor-pointer' : ''}`}
      fill={filled ? 'currentColor' : 'none'}
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={filled ? '0' : '1.5'}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
      />
    </svg>
  );
};

