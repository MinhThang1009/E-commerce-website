// Các kiểu dữ liệu đơn hàng
import { Address } from './user.types';

export interface OrderItem {
  id: string;
  orderId?: string;
  productId: string;
  variantId?: string;
  name: string;
  sku?: string;
  price: number;
  quantity: number;
  subtotal: number;
  image?: string;
  attributes?: Record<string, any>;
  createdAt?: string;
  updatedAt?: string;
  Product?: {
    id: string;
    name: string;
    images: string[];
    price: number;
    thumbnail?: string;
  };
}

export interface PaymentDetails {
  transactionId: string;
  provider: string;
  amount: number;
  currency: string;
  date: string;
}

export type OrderStatus =
  | 'pending'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';
export type PaymentStatus = 'pending' | 'paid' | 'failed' | 'refunded';
export type PaymentMethod =
  | 'credit_card'
  | 'paypal'
  | 'bank_transfer'
  | 'cash_on_delivery';

export interface Order {
  id: string;
  number: string;
  userId: string;
  status: OrderStatus;
  shippingFirstName: string;
  shippingLastName: string;
  shippingCompany?: string;
  shippingAddress1: string;
  shippingAddress2?: string;
  shippingCity: string;
  shippingState: string;
  shippingZip: string;
  shippingCountry: string;
  shippingPhone?: string;
  billingFirstName: string;
  billingLastName: string;
  billingCompany?: string;
  billingAddress1: string;
  billingAddress2?: string;
  billingCity: string;
  billingState: string;
  billingZip: string;
  billingCountry: string;
  billingPhone?: string;
  paymentMethod: string;
  paymentStatus: PaymentStatus;
  paymentTransactionId?: string;
  paymentProvider?: string;
  subtotal: number;
  tax: number;
  shippingCost: number;
  discount: number;
  total: number;
  warrantyCost?: number;
  notes?: string;
  trackingNumber?: string;
  shippingProvider?: string;
  estimatedDelivery?: string;
  pointsEarned?: number;
  pointsUsed?: number;
  pointsDiscount?: number;
  items?: OrderItem[];
  createdAt: string;
  updatedAt: string;
}

export interface OrdersResponse {
  orders: Order[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface OrderFilters {
  status?: OrderStatus;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface CheckoutData {
  items: OrderItem[];
  shipping: Address;
  billing: Address;
  paymentMethod: PaymentMethod;
  notes?: string;
}
