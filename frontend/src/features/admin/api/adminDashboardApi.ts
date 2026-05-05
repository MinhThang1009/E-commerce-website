import { api } from '@/services/api';

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

export const adminDashboardApi = api.injectEndpoints({
  endpoints: (builder) => ({
    // Lấy thống kê dashboard
    getDashboardStats: builder.query<DashboardResponse, void>({
      query: () => ({
        url: '/admin/dashboard',
        method: 'GET',
      }),
      providesTags: ['AdminDashboard'],
    }),

    // Lấy thống kê chi tiết
    getDetailedStats: builder.query<DetailedStatsResponse, DetailedStatsQuery>({
      query: (params) => ({
        url: '/admin/stats',
        method: 'GET',
        params,
      }),
      providesTags: ['AdminStats'],
    }),

    // Phân bổ trạng thái đơn hàng
    getOrderStatusAnalytics: builder.query<{ status: string; data: OrderStatusItem[] }, DateRangeQuery | void>({
      query: (params) => ({
        url: '/admin/analytics/order-status',
        method: 'GET',
        params: params || undefined,
      }),
      providesTags: ['AdminStats'],
    }),

    // Top sản phẩm theo doanh thu/số lượng
    getTopProductsAnalytics: builder.query<{ status: string; data: TopProductAnalytics[] }, TopProductsQuery | void>({
      query: (params) => ({
        url: '/admin/analytics/top-products',
        method: 'GET',
        params: params || undefined,
      }),
      providesTags: ['AdminStats'],
    }),

    // Doanh thu theo danh mục
    getRevenueByCategoryAnalytics: builder.query<{ status: string; data: CategoryRevenue[] }, DateRangeQuery | void>({
      query: (params) => ({
        url: '/admin/analytics/revenue-by-category',
        method: 'GET',
        params: params || undefined,
      }),
      providesTags: ['AdminStats'],
    }),

    // Tăng trưởng user
    getUserGrowthAnalytics: builder.query<{ status: string; data: UserGrowthItem[] }, DetailedStatsQuery>({
      query: (params) => ({
        url: '/admin/analytics/user-growth',
        method: 'GET',
        params,
      }),
      providesTags: ['AdminStats'],
    }),

    // Phân bổ phương thức thanh toán
    getPaymentMethodsAnalytics: builder.query<{ status: string; data: PaymentMethodItem[] }, void>({
      query: () => ({
        url: '/admin/analytics/payment-methods',
        method: 'GET',
      }),
      providesTags: ['AdminStats'],
    }),

    // Sản phẩm sắp hết hàng
    getLowStockAnalytics: builder.query<{ status: string; data: LowStockProduct[] }, LowStockQuery | void>({
      query: (params) => ({
        url: '/admin/analytics/low-stock',
        method: 'GET',
        params: params || undefined,
      }),
      providesTags: ['AdminStats'],
    }),

    // Thống kê AI chatbot
    getChatbotStats: builder.query<{ status: string; data: ChatbotStats }, DateRangeQuery | void>({
      query: (params) => ({
        url: '/admin/chatbot/stats',
        method: 'GET',
        params: params || undefined,
      }),
      providesTags: ['AdminStats'],
    }),
  }),
});

export const {
  useGetDashboardStatsQuery,
  useGetDetailedStatsQuery,
  useGetOrderStatusAnalyticsQuery,
  useGetTopProductsAnalyticsQuery,
  useGetRevenueByCategoryAnalyticsQuery,
  useGetUserGrowthAnalyticsQuery,
  useGetPaymentMethodsAnalyticsQuery,
  useGetLowStockAnalyticsQuery,
  useGetChatbotStatsQuery,
} = adminDashboardApi;
