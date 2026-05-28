/**
 * @file FlipNumber.tsx
 * @layer Component
 * @feature admin
 * @description Hiển thị số với flip animation từng digit (theo spec §21.2 + §28.4)
 */
import React, { useMemo } from 'react';
import { motion, useReducedMotion } from 'framer-motion';

interface FlipNumberProps {
  /** Giá trị số cần hiển thị */
  value: number;
  /** Locale format số — mặc định vi-VN ("1.299.000") */
  locale?: 'vi-VN' | 'en-US';
  /** Prefix prepend trước số (vd: "+", "-") — KHÔNG dùng cho currency, dùng <FlipCurrency> riêng */
  prefix?: string;
  /** Suffix append sau số (vd: "₫", "%") */
  suffix?: string;
  /** Class cho wrapper span */
  className?: string;
}

const easeOutQuart = [0.22, 1, 0.36, 1] as const;

/**
 * Hiển thị số có hiệu ứng flip từng digit khi mount/thay đổi.
 *
 * Edge cases handled:
 * - Số âm: dấu `-` render riêng (không animate cùng digit)
 * - Vietnamese separator `.`: split('') include dấu, mỗi char flip riêng
 * - Reduced motion: render immediate
 * - Rapid update: key bao gồm value, React tự skip nếu unchanged
 * - Layout shift: tabular-nums + inline-flex (caller set min-width nếu cần)
 */
const FlipNumber: React.FC<FlipNumberProps> = ({
  value,
  locale = 'vi-VN',
  prefix,
  suffix,
  className,
}) => {
  const shouldReduce = useReducedMotion();
  const isNegative = value < 0;
  const absValue = Math.abs(value);

  const formatted = useMemo(
    () => new Intl.NumberFormat(locale).format(absValue),
    [absValue, locale],
  );

  const ariaLabel = `${prefix ?? ''}${isNegative ? '-' : ''}${formatted}${suffix ?? ''}`;

  return (
    <span
      className={`inline-flex items-baseline tabular-nums ${className ?? ''}`}
      aria-label={ariaLabel}
    >
      {prefix && <span aria-hidden="true">{prefix}</span>}
      {isNegative && <span aria-hidden="true">-</span>}
      {formatted.split('').map((char, i) => (
        <motion.span
          key={`${char}-${i}-${absValue}`}
          initial={shouldReduce ? false : { y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{
            delay: shouldReduce ? 0 : 0.04 * i,
            duration: shouldReduce ? 0 : 0.4,
            ease: easeOutQuart,
          }}
          className="inline-block"
          aria-hidden="true"
        >
          {char}
        </motion.span>
      ))}
      {suffix && (
        <span aria-hidden="true" className="ml-1">
          {suffix}
        </span>
      )}
    </span>
  );
};

export default FlipNumber;
