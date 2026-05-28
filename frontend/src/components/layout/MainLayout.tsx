/**
 * @file MainLayout.tsx
 * @layer Component
 * @feature shared
 * @description Shared UI component
 */
import React from 'react';
import { Outlet } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuthStore } from '@/stores/auth-store';
import Header from './Header';
import Footer from './Footer';
import PageTransition from './PageTransition';
import MobileBottomNav from './MobileBottomNav';
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
      <main className="flex-grow pt-16 sm:pt-[4.5rem] lg:pt-20">
        <div className="w-full">
          <AnimatePresence mode="wait">
            <PageTransition>
              <Outlet />
            </PageTransition>
          </AnimatePresence>
        </div>
      </main>
      <Footer />
      <MobileBottomNav />
      {/* Padding cho mobile bottom nav */}
      <div className="h-16 lg:hidden" />
    </div>
  );
};

export default MainLayout;
