/**
 * @file cn.ts
 * @layer Utility
 * @feature global
 * @description Helper utility function
 */
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
