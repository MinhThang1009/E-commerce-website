import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from '@/components/layout/MainLayout';
import AdminLayout from '@/components/admin/AdminLayout';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import ProtectedRoute from '@/components/auth/ProtectedRoute';
import PublicOnlyRoute from '@/components/auth/PublicOnlyRoute';
import AdminRoute from './AdminRoute';

// Lazy-loaded pages
const HomePage = lazy(() => import('@/pages/HomePage'));
const ShopPage = lazy(() => import('@/pages/ShopPage'));
const ProductDetailPage = lazy(() => import('@/pages/ProductDetailPage'));
const CartPage = lazy(() => import('@/pages/CartPage'));
const CheckoutPage = lazy(() => import('@/pages/CheckoutPage'));
const LoginPage = lazy(() => import('@/pages/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/RegisterPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPasswordPage'));
const VerifyEmailPage = lazy(() => import('@/pages/VerifyEmailPage'));
const ProfilePage = lazy(() => import('@/pages/ProfilePage'));
const OrdersPage = lazy(() => import('@/pages/OrdersPage'));
const WishlistPage = lazy(() => import('@/pages/WishlistPage'));
const CategoriesPage = lazy(() => import('@/pages/CategoriesPage'));
const CategoryPage = lazy(() => import('@/pages/CategoryPage'));
const BrandsPage = lazy(() => import('@/pages/BrandsPage'));
const CollectionsPage = lazy(() => import('@/pages/CollectionsPage'));
const DealsPage = lazy(() => import('@/pages/DealsPage'));
const NewArrivalsPage = lazy(() => import('@/pages/NewArrivalsPage'));
const BestSellersPage = lazy(() => import('@/pages/BestSellersPage'));
const AboutPage = lazy(() => import('@/pages/AboutPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));
const FAQsPage = lazy(() => import('@/pages/FAQsPage'));
const ShippingReturnsPage = lazy(() => import('@/pages/ShippingReturnsPage'));
const TrackOrderPage = lazy(() => import('@/pages/TrackOrderPage'));
const PrivacyPolicyPage = lazy(() => import('@/pages/PrivacyPolicyPage'));
const TermsPage = lazy(() => import('@/pages/TermsPage'));

// Admin pages
const AdminDashboardPage = lazy(() => import('@/pages/admin/DashboardPage'));
const AdminProductsPage = lazy(() => import('@/pages/admin/ProductsPage'));
const CreateProductPage = lazy(() => import('@/pages/admin/CreateProductPage'));
const EditProductPage = lazy(() => import('@/pages/admin/EditProductPage'));
const AdminOrdersPage = lazy(() => import('@/pages/admin/OrdersPage'));
const AdminUsersPage = lazy(() => import('@/pages/admin/UsersPage'));
const AdminUserDetailPage = lazy(() => import('@/pages/admin/UserDetailPage'));
const AdminCategoriesPage = lazy(() => import('@/pages/admin/CategoriesPage'));
const AdminWarrantyPackagesPage = lazy(
  () => import('@/pages/admin/WarrantyPackagesPage')
);
const AdminDiscountCodesPage = lazy(
  () => import('@/pages/admin/DiscountCodesPage')
);
const AdminBrandsPage = lazy(() => import('@/pages/admin/BrandsPage'));
const AdminCollectionsPage = lazy(() => import('@/pages/admin/CollectionsPage'));
const AdminNewsPage = lazy(() => import('@/pages/admin/NewsPage'));
const CreateNewsPage = lazy(() => import('@/pages/admin/CreateNewsPage'));
const SupportDashboard = lazy(() => import('@/pages/admin/SupportDashboard'));
const AdminBannersPage = lazy(() => import('@/pages/admin/BannersPage'));
const AdminEmailCampaignsPage = lazy(
  () => import('@/pages/admin/EmailCampaignsPage')
);

const SimpleNamingTestPage = lazy(
  () => import('@/pages/admin/SimpleNamingTestPage')
);

// Test components
const TestComponents = lazy(() => import('@/test-components'));
const TestBasicForm = lazy(() => import('@/test-basic-form'));
const PaymentQRPage = lazy(() => import('@/pages/PaymentQRPage'));

// Error pages
const UnauthorizedPage = lazy(() => import('@/pages/UnauthorizedPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

const NewsListPage = lazy(() => import('@/pages/NewsListPage'));
const NewsDetailPage = lazy(() => import('@/pages/NewsDetailPage'));

const AppRoutes: React.FC = () => {
  return (
    <Suspense fallback={<LoadingSpinner fullScreen />}>
      <Routes>
        {/* Main Layout Routes */}
        <Route path="/" element={<MainLayout />}>
          {/* Public routes */}
          <Route index element={<HomePage />} />
          <Route path="shop" element={<ShopPage />} />
          <Route path="products/:productId" element={<ProductDetailPage />} />
          <Route path="cart" element={<CartPage />} />

          {/* Category pages */}
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="categories/:slug" element={<CategoryPage />} />

          {/* Brand & Collection pages */}
          <Route path="brands" element={<BrandsPage />} />
          <Route path="collections" element={<CollectionsPage />} />

          {/* Shop sections */}
          <Route path="deals" element={<DealsPage />} />
          <Route path="new-arrivals" element={<NewArrivalsPage />} />
          <Route path="best-sellers" element={<BestSellersPage />} />

          {/* Static pages */}
          <Route path="about" element={<AboutPage />} />
          <Route path="contact" element={<ContactPage />} />
          <Route path="faqs" element={<FAQsPage />} />
          <Route path="shipping-returns" element={<ShippingReturnsPage />} />
          <Route path="track-order" element={<TrackOrderPage />} />
          <Route path="privacy-policy" element={<PrivacyPolicyPage />} />
          <Route path="terms" element={<TermsPage />} />
          <Route path="news" element={<NewsListPage />} />
          <Route path="news/:slug" element={<NewsDetailPage />} />

          {/* Public-only routes (redirect to home if authenticated) */}
          <Route
            path="login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="register"
            element={
              <PublicOnlyRoute>
                <RegisterPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="forgot-password"
            element={
              <PublicOnlyRoute>
                <ForgotPasswordPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="reset-password"
            element={
              <PublicOnlyRoute>
                <ResetPasswordPage />
              </PublicOnlyRoute>
            }
          />
          <Route path="verify-email" element={<VerifyEmailPage />} />
          <Route path="verify-email/:token" element={<VerifyEmailPage />} />


          {/* Protected routes (require authentication) */}
          <Route
            path="checkout"
            element={
              <ProtectedRoute>
                <CheckoutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="checkout/payment"
            element={
              <ProtectedRoute>
                <CheckoutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="payment-qr"
            element={
              <ProtectedRoute>
                <PaymentQRPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="orders"
            element={
              <ProtectedRoute>
                <OrdersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="wishlist"
            element={
              <ProtectedRoute>
                <WishlistPage />
              </ProtectedRoute>
            }
          />

          {/* Error pages */}
          <Route path="unauthorized" element={<UnauthorizedPage />} />

          {/* 404 route */}
          <Route path="*" element={<NotFoundPage />} />
        </Route>

        {/* Admin routes */}
        <Route
          path="admin"
          element={
            <AdminRoute>
              <AdminLayout />
            </AdminRoute>
          }
        >
          <Route index element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="dashboard" element={<AdminDashboardPage />} />

          {/* Product management */}
          <Route path="products" element={<AdminProductsPage />} />
          <Route path="products/create" element={<CreateProductPage />} />
          <Route path="products/edit/:id" element={<EditProductPage />} />

          {/* News management */}
          <Route path="news" element={<AdminNewsPage />} />
          <Route path="news/create" element={<CreateNewsPage />} />
          <Route path="news/edit/:id" element={<CreateNewsPage />} />

          {/* Other admin sections */}
          <Route path="categories" element={<AdminCategoriesPage />} />
          <Route path="orders" element={<AdminOrdersPage />} />
          <Route path="support" element={<SupportDashboard />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="users/:id" element={<AdminUserDetailPage />} />
          <Route
            path="warranty-packages"
            element={<AdminWarrantyPackagesPage />}
          />
          <Route
            path="discount-codes"
            element={<AdminDiscountCodesPage />}
          />
          <Route path="brands" element={<AdminBrandsPage />} />
          <Route path="collections" element={<AdminCollectionsPage />} />
          <Route path="banners" element={<AdminBannersPage />} />
          <Route
            path="email-campaigns"
            element={<AdminEmailCampaignsPage />}
          />

          {/* Test Pages */}
          <Route path="test-simple-naming" element={<SimpleNamingTestPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
};

export default AppRoutes;
