/**
 * @file index.ts
 * @layer Component
 * @feature shared
 * @description Shared UI component
 */
export { default as Badge } from './Badge';
export { default as Button } from './Button';
export { default as PremiumButton } from './PremiumButton';
export type { PremiumButtonVariant } from './PremiumButton';
export { default as Input } from './Input';
export { default as LanguageSwitcher } from './LanguageSwitcher';
export { default as LoadingSpinner } from './LoadingSpinner';
export { default as Modal } from './Modal';
export { default as Notifications } from './Notifications';
export { default as Pagination } from './Pagination';
export { Rating } from './Rating';
export { default as Select } from './Select';
export { default as ThemeToggle } from './ThemeToggle';
export { default as TiptapEditor } from './TiptapEditor';

// Các component tiện ích mới
export * from './LoadingState';
export * from './ErrorState';
