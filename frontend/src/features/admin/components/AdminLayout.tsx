/**
 * @file AdminLayout.tsx
 * @layer Component
 * @feature admin
 * @description Layout admin với floating sidebar + glass header + cinematic motion
 */
import React, { useState } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Package,
  FolderTree,
  Tag,
  ShoppingCart,
  Users,
  Ticket,
  Boxes,
  Menu,
  Bell,
  ChevronDown,
  LogOut,
  Home,
  Sparkles,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/features/auth';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import ThemeToggle from '@/components/common/ThemeToggle';
import { cn } from '@/utils/cn';

type NavItem = {
  key: string;
  path: string;
  labelKey: string;
  Icon: LucideIcon;
  // Role được phép thấy mục này; bỏ trống = mọi back-office role (admin + staff)
  roles?: Array<'admin' | 'staff'>;
};

type NavGroup = {
  labelKey: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    labelKey: 'admin.nav.groups.overview',
    items: [
      {
        key: 'dashboard',
        path: '/admin/dashboard',
        labelKey: 'admin.nav.dashboard',
        Icon: LayoutDashboard,
      },
    ],
  },
  {
    labelKey: 'admin.nav.groups.sales',
    items: [
      {
        key: 'orders',
        path: '/admin/orders',
        labelKey: 'admin.nav.orders',
        Icon: ShoppingCart,
      },
      {
        key: 'discounts',
        path: '/admin/discount-codes',
        labelKey: 'admin.nav.discounts',
        Icon: Ticket,
      },
      {
        key: 'users',
        path: '/admin/users',
        labelKey: 'admin.nav.users',
        Icon: Users,
        roles: ['admin'], // Quản lý người dùng: chỉ admin (quản trị hệ thống)
      },
    ],
  },
  {
    labelKey: 'admin.nav.groups.catalog',
    items: [
      {
        key: 'products',
        path: '/admin/products',
        labelKey: 'admin.nav.products',
        Icon: Package,
      },
      {
        key: 'categories',
        path: '/admin/categories',
        labelKey: 'admin.nav.categories',
        Icon: FolderTree,
      },
      {
        key: 'brands',
        path: '/admin/brands',
        labelKey: 'admin.nav.brands',
        Icon: Tag,
      },
      {
        key: 'inventory',
        path: '/admin/inventory',
        labelKey: 'admin.nav.inventory',
        Icon: Boxes,
      },
    ],
  },
];

// Apple-style out-quart easing curve cho mọi UI transition
const easeOutQuart = [0.22, 1, 0.36, 1] as const;

const containerVariants = {
  initial: { opacity: 0, scale: 0.96 },
  animate: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: easeOutQuart },
  },
};

const sidebarVariants = {
  initial: { x: -40, opacity: 0 },
  animate: {
    x: 0,
    opacity: 1,
    transition: { delay: 0.15, duration: 0.4, ease: easeOutQuart },
  },
};

const headerVariants = {
  initial: { y: -16, opacity: 0 },
  animate: {
    y: 0,
    opacity: 1,
    transition: { delay: 0.2, duration: 0.35, ease: easeOutQuart },
  },
};

const navStaggerVariants = {
  animate: { transition: { staggerChildren: 0.03, delayChildren: 0.3 } },
};

const navItemVariants = {
  initial: { x: -8, opacity: 0 },
  animate: { x: 0, opacity: 1, transition: { duration: 0.25, ease: easeOutQuart } },
};

const AdminLayout: React.FC = () => {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { user, getUserFullName, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const fullName = getUserFullName() || user?.email || '';
  // Lời chào dùng firstName field trực tiếp (vd: "Admin", "Nguyễn Văn") — không parse
  // Fallback: email prefix nếu thiếu firstName
  const greetingName = user?.firstName || user?.email?.split('@')[0] || '';

  const renderNavItem = (item: NavItem, onClick?: () => void) => {
    const isActive =
      location.pathname === item.path || location.pathname.startsWith(item.path + '/');
    const Icon = item.Icon;
    return (
      <motion.li key={item.key} variants={navItemVariants}>
        <Link
          to={item.path}
          onClick={onClick}
          className={cn(
            'group relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-200',
            isActive
              ? 'bg-[var(--accent)]/15 text-[var(--accent)] font-medium'
              : 'text-[var(--text-secondary)] hover:bg-white/5 hover:text-[var(--text-primary)]',
          )}
        >
          {isActive && (
            <span className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-[var(--accent)] rounded-r" />
          )}
          <Icon className="w-[18px] h-[18px] flex-shrink-0" strokeWidth={isActive ? 2.25 : 2} />
          <span className="truncate">{t(item.labelKey)}</span>
        </Link>
      </motion.li>
    );
  };

  const sidebarContent = (mobileOnClose?: () => void) => (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-2 mb-6">
        <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-[var(--color-primary)] to-[var(--color-primary-dark)] flex items-center justify-center shadow-md">
          <span className="text-white font-bold text-sm">TS</span>
        </div>
        <div className="min-w-0">
          <div className="font-bold text-base tracking-tight text-[var(--text-primary)]">
            TechStore
          </div>
          <div className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider">
            {t('admin.title')}
          </div>
        </div>
      </div>

      {/* Nav groups */}
      <motion.nav
        className="flex-1 overflow-y-auto -mx-1 px-1 scrollbar-thin"
        variants={navStaggerVariants}
        initial="initial"
        animate="animate"
      >
        {NAV_GROUPS.map((group, idx) => {
          // Lọc mục theo role hiện tại (vd staff không thấy "Quản lý người dùng")
          const visibleItems = group.items.filter(
            (item) =>
              !item.roles || (user?.role && item.roles.includes(user.role as 'admin' | 'staff')),
          );
          if (visibleItems.length === 0) return null;
          return (
            <div key={group.labelKey} className={idx === 0 ? '' : 'mt-5'}>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-tertiary)] mb-2 px-3">
                {t(group.labelKey)}
              </div>
              <ul className="space-y-0.5">
                {visibleItems.map((item) => renderNavItem(item, mobileOnClose))}
              </ul>
            </div>
          );
        })}
      </motion.nav>

      {/* User card sticky bottom */}
      <div className="mt-4 pt-4 border-t border-[var(--border-default)] relative">
        <button
          type="button"
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="w-full flex items-center gap-3 p-2 rounded-xl hover:bg-white/5 transition"
        >
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[var(--accent)] to-[var(--color-primary-dark)] flex items-center justify-center text-white font-semibold text-sm ring-2 ring-[var(--accent)]/20">
            {(fullName[0] || 'A').toUpperCase()}
          </div>
          <div className="flex-1 text-left min-w-0">
            <div className="text-sm font-medium truncate text-[var(--text-primary)]">
              {fullName}
            </div>
            <div className="text-[11px] text-[var(--text-tertiary)] truncate">{user?.email}</div>
          </div>
          <ChevronDown
            className={cn(
              'w-4 h-4 text-[var(--text-tertiary)] transition flex-shrink-0',
              showUserMenu && 'rotate-180',
            )}
          />
        </button>

        {showUserMenu && (
          <div className="absolute bottom-full mb-2 left-0 right-0 glass-card rounded-xl overflow-hidden shadow-lg z-50">
            <Link
              to="/"
              onClick={() => setShowUserMenu(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--text-primary)] hover:bg-white/5 transition"
            >
              <Home className="w-4 h-4" />
              <span>{t('admin.backToStore')}</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                setShowUserMenu(false);
                handleLogout();
              }}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10 transition border-t border-[var(--border-default)]"
            >
              <LogOut className="w-4 h-4" />
              <span>{t('header.dropdown.logout')}</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <motion.div
      className="min-h-screen bg-[var(--bg-sunken)]"
      variants={containerVariants}
      initial="initial"
      animate="animate"
    >
      <div className="flex min-h-screen p-3 md:p-4 lg:p-6 gap-4">
        {/* Sidebar desktop — floating glass */}
        <motion.aside
          className="hidden lg:flex w-60 glass-card rounded-3xl p-5 sticky top-4 self-start h-[calc(100vh-3rem)]"
          variants={sidebarVariants}
          initial="initial"
          animate="animate"
        >
          {sidebarContent()}
        </motion.aside>

        {/* Sheet mobile */}
        <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
          <SheetContent side="left" className="w-[280px] p-0 glass-dialog border-none">
            <SheetHeader className="sr-only">
              <SheetTitle>{t('admin.menu')}</SheetTitle>
            </SheetHeader>
            <div className="h-full p-5">{sidebarContent(() => setMobileMenuOpen(false))}</div>
          </SheetContent>
        </Sheet>

        {/* Main column */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header sticky glass */}
          <motion.header
            className="sticky top-3 z-40 mb-4 admin-sticky-header rounded-2xl px-4 md:px-6 py-3 flex items-center justify-between gap-3"
            variants={headerVariants}
            initial="initial"
            animate="animate"
          >
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <button
                type="button"
                className="lg:hidden p-2 rounded-lg hover:bg-white/5 transition flex-shrink-0"
                onClick={() => setMobileMenuOpen(true)}
                aria-label={t('admin.menu')}
              >
                <Menu className="w-5 h-5" />
              </button>
              <div className="min-w-0 flex-1">
                <div className="hidden md:flex items-center gap-1.5 text-base font-semibold truncate text-[var(--text-primary)]">
                  <Sparkles
                    className="w-4 h-4 text-[var(--accent)] flex-shrink-0"
                    strokeWidth={2.25}
                    aria-hidden="true"
                  />
                  <span className="truncate">
                    {t('admin.welcome.greeting', { name: greetingName })}
                  </span>
                </div>
                <div className="hidden md:block text-xs text-[var(--text-tertiary)] truncate">
                  {t('admin.welcome.subtitle')}
                </div>
                <div className="md:hidden font-semibold text-[var(--text-primary)]">
                  {t('admin.title')}
                </div>
              </div>
            </div>

            {/* Right cluster: notif + theme */}
            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
              <button
                type="button"
                className="relative p-2 rounded-xl hover:bg-white/5 transition"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5 text-[var(--text-secondary)]" />
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 right-1.5 w-2 h-2 bg-[var(--color-danger)] rounded-full"
                />
              </button>

              <ThemeToggle />
            </div>
          </motion.header>

          {/* Main content với page transition */}
          <main className="flex-1 min-w-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.3, ease: easeOutQuart }}
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </motion.div>
  );
};

export default AdminLayout;
