/**
 * @file MainLayout.tsx
 * @layer Component
 * @feature shared
 * @description Shared UI component
 */
import React from 'react';
import { Outlet } from 'react-router-dom';
import { useAuthStore } from '@/stores/auth-store';
import Header from './Header';
import Footer from './Footer';
// Không cần import ChatWidget ở đây nữa vì đã được thêm vào App.tsx
import { useScrollToTop } from '@/hooks/use-scroll-to-top';
import { useCartMerge } from '@/features/cart';

const MainLayout: React.FC = () => {
  // Sử dụng hook để scroll lên đầu trang khi chuyển trang
  useScrollToTop();

  // Lấy trạng thái xác thực để gộp giỏ hàng
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const justLoggedIn = useAuthStore((s) => s.justLoggedIn);

  // Gộp giỏ hàng khi user đăng nhập
  useCartMerge(isAuthenticated, justLoggedIn);

  return (
    <div className="flex flex-col min-h-screen">
      <Header />
      <main className="flex-grow pt-16 sm:pt-18 lg:pt-20">
        <div className="w-full">
          <Outlet />
        </div>
      </main>
      <Footer />
      {/* ChatWidget đã được thêm vào App.tsx */}
    </div>
  );
};

export default MainLayout;
