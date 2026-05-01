import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

const SendIcon: React.FC<IconProps> = ({ className = '', size = 20 }) => {
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
        d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
      />
    </svg>
  );
};

export default SendIcon;
