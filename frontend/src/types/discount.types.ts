export interface DiscountCode {
  id: string;
  code: string;
  type: 'percent' | 'fixed';
  value: string | number; // Back-end might return string for decimal
  minOrderAmount: string | number;
  maxDiscountAmount?: string | number;
  startDate?: string;
  endDate?: string;
  usageLimit?: number;
  usedCount: number;
  isActive: boolean;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}
