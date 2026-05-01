import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

const CloseIcon: React.FC<IconProps> = ({ className = '', size = 16 }) => {
  return (
    <svg
      width={size}
      height={size}
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
};

export default CloseIcon;
