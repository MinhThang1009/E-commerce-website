/**
 * @file adminDashboardApi.ts
 * @layer API Client
 * @feature admin
 * @description API client functions cho feature admin
 */
import { useQuery } from '@tanstack/react-query';
import apiClient from '@/services/apiClient';

// Kiểu dữ liệu cho Dashboard
export interface DashboardOverview {
  totalUsers: number;
  totalProducts: number;
  totalOrders: number;
  totalRevenue: number;
  aov: number;
  cancelledOrdersMonth: number;
  lowStockCount: number;
  ordersByStatus: Record<string, number>;
}

export interface MonthlyStats {
  users: number;
  orders: number;
  revenue: number;
}

export interface GrowthStats {
  users: number;
  orders: number;
  revenue: number;
}

export interface TopProduct {
  product: {
    id: string;
    name: string;
    images: string[];
    price: number;
  };
  totalSold: number;
  totalRevenue: number;
}

export interface DashboardStats {
  overview: DashboardOverview;
  monthly: MonthlyStats;
  growth: GrowthStats;
  topProducts: TopProduct[];
}

export interface DashboardResponse {
  status: string;
  data: DashboardStats;
}

export interface DetailedStatsQuery {
  startDate: string;
  endDate: string;
  groupBy?: 'hour' | 'day' | 'week' | 'month';
}

export interface OrderStat {
  period: string;
  orderCount: number;
  revenue: number;
}

export interface UserStat {
  period: string;
  newUsers: number;
}

export interface DetailedStats {
  orders: OrderStat[];
  users: UserStat[];
}

export interface DetailedStatsResponse {
  status: string;
  data: DetailedStats;
}

// Kiểu cho analytics endpoints mới — Phase 32
export interface OrderStatusItem {
  status: string;
  count: number;
  label: string;
}

export interface TopProductAnalytics {
  productId: number;
  name: string;
  thumbnail: string | null;
  revenue: number;
  soldCount: number;
}

export interface CategoryRevenue {
  categoryId: number;
  categoryName: string;
  revenue: number;
  orderItemCount: number;
}

export interface UserGrowthItem {
  date: string;
  newUsers: number;
}

export interface PaymentMethodItem {
  method: string;
  count: number;
  revenue: number;
}

export interface LowStockProduct {
  id: number;
  name: string;
  sku: string;
  stockQuantity: number;
  thumbnail: string | null;
}

export interface ChatbotStats {
  totalSessions: number;
  totalMessages: number;
  avgMessagesPerSession: number;
  intentBreakdown: Record<string, number>;
  fallbackRate: number;
  avgResponseTimeMs: number;
}

export interface DateRangeQuery {
  startDate?: string;
  endDate?: string;
}

export interface TopProductsQuery {
  metric?: 'revenue' | 'soldCount';
  limit?: number;
}

export interface LowStockQuery {
  threshold?: number;
}

export interface ExportQuery {
  type: 'orders' | 'products';
  startDate?: string;
  endDate?: string;
}

// === Query Keys ===

export const adminDashboardKeys = {
  all: ['admin-dashboard'] as const,
  stats: () => [...adminDashboardKeys.all, 'stats'] as const,
  detailed: (params: unknown) => [...adminDashboardKeys.all, 'detailed', params] as const,
  orderStatus: (params?: unknown) => [...adminDashboardKeys.all, 'order-status', params] as const,
  topProducts: (params?: unknown) => [...adminDashboardKeys.all, 'top-products', params] as const,
  revenueByCategory: (params?: unknown) => [...adminDashboardKeys.all, 'revenue-category', params] as const,
  userGrowth: (params: unknown) => [...adminDashboardKeys.all, 'user-growth', params] as const,
  paymentMethods: () => [...adminDashboardKeys.all, 'payment-methods'] as const,
  lowStock: (params?: unknown) => [...adminDashboardKeys.all, 'low-stock', params] as const,
  chatbotStats: (params?: unknown) => [...adminDashboardKeys.all, 'chatbot-stats', params] as const,
};

// === Query Hooks ===

export function useGetDashboardStatsQuery() {
  return useQuery<DashboardResponse>({
    queryKey: adminDashboardKeys.stats(),
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/dashboard');
      return data;
    },
  });
}

export function useGetDetailedStatsQuery(
  params: DetailedStatsQuery,
  options?: { enabled?: boolean; skip?: boolean }
) {
  return useQuery<DetailedStatsResponse>({
    queryKey: adminDashboardKeys.detailed(params),
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/stats', { params });
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

export function useGetOrderStatusAnalyticsQuery(
  params?: DateRangeQuery | void,
  options?: { enabled?: boolean; skip?: boolean }
) {
  return useQuery<{ status: string; data: OrderStatusItem[] }>({
    queryKey: adminDashboardKeys.orderStatus(params),
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/analytics/order-status', {
        params: params || undefined,
      });
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

export function useGetTopProductsAnalyticsQuery(
  params?: TopProductsQuery | void,
  options?: { enabled?: boolean; skip?: boolean }
) {
  return useQuery<{ status: string; data: TopProductAnalytics[] }>({
    queryKey: adminDashboardKeys.topProducts(params),
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/analytics/top-products', {
        params: params || undefined,
      });
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

export function useGetRevenueByCategoryAnalyticsQuery(
  params?: DateRangeQuery | void,
  options?: { enabled?: boolean; skip?: boolean }
) {
  return useQuery<{ status: string; data: CategoryRevenue[] }>({
    queryKey: adminDashboardKeys.revenueByCategory(params),
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/analytics/revenue-by-category', {
        params: params || undefined,
      });
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

export function useGetUserGrowthAnalyticsQuery(
  params: DetailedStatsQuery,
  options?: { enabled?: boolean; skip?: boolean }
) {
  return useQuery<{ status: string; data: UserGrowthItem[] }>({
    queryKey: adminDashboardKeys.userGrowth(params),
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/analytics/user-growth', { params });
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

export function useGetPaymentMethodsAnalyticsQuery() {
  return useQuery<{ status: string; data: PaymentMethodItem[] }>({
    queryKey: adminDashboardKeys.paymentMethods(),
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/analytics/payment-methods');
      return data;
    },
  });
}

export function useGetLowStockAnalyticsQuery(
  params?: LowStockQuery | void,
  options?: { enabled?: boolean; skip?: boolean }
) {
  return useQuery<{ status: string; data: LowStockProduct[] }>({
    queryKey: adminDashboardKeys.lowStock(params),
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/analytics/low-stock', {
        params: params || undefined,
      });
      return data;
    },
    enabled: options?.skip !== undefined ? !options.skip : true,
  });
}

export function useGetChatbotStatsQuery(
  params?: DateRangeQuery | void,
  options?: { enabled?: boolean; skip?: boolean }
) {
  // Ưu tiên enabled nếu có, fallback sang skip (compat), mặc định true
  const isEnabled = options?.enabled !== undefined
    ? options.enabled
    : options?.skip !== undefined ? !options.skip : true;

  return useQuery<{ status: string; data: ChatbotStats }>({
    queryKey: adminDashboardKeys.chatbotStats(params),
    queryFn: async () => {
      const { data } = await apiClient.get('/admin/chatbot/stats', {
        params: params || undefined,
      });
      return data;
    },
    enabled: isEnabled,
  });
}
