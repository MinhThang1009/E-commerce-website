import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, Outlet, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/useAuth';
import { useSelector, useDispatch } from 'react-redux';
import { RootState } from '@/store';
import { setTheme } from '@/features/ui/uiSlice';
import { ConfigProvider, theme as antdTheme, Button, Drawer } from 'antd';
import { MenuOutlined, CloseOutlined } from '@ant-design/icons';
import { UserIcon } from '@/components/icons';

const AdminLayout: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user, getUserFullName, isAuthenticated, logout } = useAuth();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const userDropdownRef = useRef<HTMLDivElement>(null);
  const dispatch = useDispatch();
  const theme = useSelector((state: RootState) => state.ui.theme);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(window.innerWidth);

  // Handle window resize for responsive design
  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
      if (window.innerWidth >= 768) {
        setMobileMenuOpen(false);
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Handle click outside dropdown
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target as Node)
      ) {
        setShowUserDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleUserClick = () => {
    if (isAuthenticated) {
      setShowUserDropdown(!showUserDropdown);
    } else {
      navigate('/login');
    }
  };

  const handleLogoutClick = async () => {
    await logout();
    navigate('/', { replace: true });
  };

  const toggleTheme = () => {
    dispatch(setTheme(theme === 'light' ? 'dark' : 'light'));
  };

  const adminNavItems = [
    {
      key: 'dashboard',
      path: '/admin/dashboard',
      label: t('admin.nav.dashboard'),
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      ),
    },
    {
      key: 'products',
      path: '/admin/products',
      label: t('admin.nav.products'),
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      ),
    },
    {
      key: 'news',
      path: '/admin/news',
      label: t('admin.nav.news'),
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z"
          />
        </svg>
      ),
    },
    {
      key: 'categories',
      path: '/admin/categories',
      label: t('admin.nav.categories'),
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z"
          />
        </svg>
      ),
    },
    {
      key: 'brands',
      path: '/admin/brands',
      label: t('admin.nav.brands'),
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.054.191l-.868.434a2 2 0 00-.918 2.336l.244.733a2 2 0 002.321 1.341l.733-.122a6 6 0 013.92-.016l.32.08a6 6 0 003.92.016l.732.122a2 2 0 002.321-1.341l.244-.733a2 2 0 00-.918-2.336l-.868-.434z"
          />
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 8a4 4 0 118 0 4 4 0 01-8 0z"
          />
        </svg>
      ),
    },
    {
      key: 'collections',
      path: '/admin/collections',
      label: t('admin.nav.collections'),
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
          />
        </svg>
      ),
    },
    {
      key: 'orders',
      path: '/admin/orders',
      label: t('admin.nav.orders'),
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
      ),
    },
    {
      key: 'users',
      path: '/admin/users',
      label: t('admin.nav.users'),
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"
          />
        </svg>
      ),
    },
    {
      key: 'warranty-packages',
      path: '/admin/warranty-packages',
      label: t('admin.nav.warranty'),
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
          />
        </svg>
      ),
    },
    {
      key: 'discount-codes',
      path: '/admin/discount-codes',
      label: t('admin.nav.discounts'),
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z"
          />
        </svg>
      ),
    },
    {
      key: 'support',
      path: '/admin/support',
      label: t('admin.nav.support'),
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
          />
        </svg>
      ),
    },
    /*
        {
          key: 'banners',
          path: '/admin/banners',
          label: 'Quản lý Banner',
          icon: (
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          ),
        },
    */
    {
      key: 'email-campaigns',
      path: '/admin/email-campaigns',
      label: t('admin.nav.email'),
      icon: (
        <svg
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
          />
        </svg>
      ),
    },
  ];

  return (
    <ConfigProvider
      theme={{
        algorithm:
          theme === 'dark'
            ? antdTheme.darkAlgorithm
            : antdTheme.defaultAlgorithm,
        token: {
          colorPrimary: '#1890ff',
          borderRadius: 6,
        },
      }}
    >
      <div className="min-h-screen bg-neutral-50 dark:bg-neutral-900">
        {/* Admin Header */}
        <div className="bg-white dark:bg-neutral-800 shadow-sm border-b border-neutral-200 dark:border-neutral-700 sticky top-0 z-30">
          <div className="px-4 md:px-6 h-16">
            <div className="flex items-center justify-between h-full">
              <div className="flex items-center space-x-4">
                {/* Mobile menu button */}
                <Button
                  type="text"
                  icon={<MenuOutlined />}
                  className="md:hidden text-neutral-700 dark:text-neutral-300"
                  onClick={() => setMobileMenuOpen(true)}
                />

                  {t('admin.title')}
              </div>
              <div className="flex items-center space-x-2 md:space-x-4">
                {/* Theme toggle button */}
                <Button
                  type="text"
                  onClick={toggleTheme}
                  className="flex items-center justify-center text-neutral-700 dark:text-neutral-300"
                >
                  {theme === 'light' ? (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                    </svg>
                  ) : (
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-5 w-5"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                    >
                      <path
                        fillRule="evenodd"
                        d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </Button>

                {/* User Dropdown */}
                <div className="relative" ref={userDropdownRef}>
                  <button
                    onClick={handleUserClick}
                    className={`group relative p-1.5 sm:p-2 rounded-xl transition-all duration-300 ${isAuthenticated
                      ? 'bg-gradient-to-r from-primary-100 to-primary-50 dark:from-primary-900/20 dark:to-primary-800/10 text-primary-600 dark:text-primary-400 hover:from-primary-200 hover:to-primary-100 dark:hover:from-primary-900/30 dark:hover:to-primary-800/20 border border-primary-200/50 dark:border-primary-700/30'
                      : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-transparent hover:border-neutral-200 dark:hover:border-neutral-700'
                      }`}
                    aria-label={t('header.actions.userAccount')}
                  >
                    <UserIcon className="h-4 w-4 sm:h-5 sm:w-5 group-hover:scale-110 transition-transform duration-300" />
                    {isAuthenticated && (
                      <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-gradient-to-r from-success-500 to-success-400 rounded-full border-2 border-white dark:border-neutral-800 animate-pulse"></span>
                    )}
                    {isAuthenticated && (
                      <div className="absolute inset-0 bg-gradient-to-r from-primary-500/10 to-primary-400/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                    )}
                  </button>

                  {/* User Dropdown Menu */}
                  {isAuthenticated && showUserDropdown && (
                    <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-neutral-800 rounded-lg shadow-lg border border-neutral-200 dark:border-neutral-700 z-50">
                      <div className="py-2">
                        <div className="px-4 py-2 border-b border-neutral-200 dark:border-neutral-700">
                          <p className="font-semibold text-neutral-800 dark:text-neutral-100 truncate max-w-[160px]">
                            {getUserFullName()}
                          </p>
                          <p className="text-sm text-neutral-600 dark:text-neutral-400 truncate max-w-[160px]">
                            {user?.email}
                          </p>
                        </div>
                        <Link
                          to="/"
                          className="block px-4 py-2 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                          onClick={() => setShowUserDropdown(false)}
                        >
                          {t('admin.backToStore')}
                        </Link>
                        <div className="border-t border-neutral-200 dark:border-neutral-700 mt-2">
                          <button
                            onClick={() => {
                              setShowUserDropdown(false);
                              handleLogoutClick();
                            }}
                            className="block w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                          >
                            {t('header.dropdown.logout')}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col md:flex-row">
          {/* Mobile Sidebar Drawer */}
          <Drawer
            title={t('admin.menu')}
            placement="left"
            onClose={() => setMobileMenuOpen(false)}
            open={mobileMenuOpen}
            width={280}
            styles={{
              body: { padding: 0 },
              header: {
                borderBottom: `1px solid ${theme === 'dark' ? '#424242' : '#f0f0f0'}`,
                background: theme === 'dark' ? '#141414' : '#fff',
                color: theme === 'dark' ? '#fff' : '#000',
              }
            }}
          >
            <nav className="px-4 py-4">
              <ul className="space-y-2">
                {adminNavItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <li key={item.key}>
                      <Link
                        to={item.path}
                        className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive
                          ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                          : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-900 dark:hover:text-white'
                          }`}
                        onClick={() => setMobileMenuOpen(false)}
                      >
                        <span
                          className={
                            isActive
                              ? 'text-primary-600 dark:text-primary-400'
                              : ''
                          }
                        >
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </Drawer>

          {/* Desktop Sidebar */}
          <div className="hidden md:block w-64 bg-white dark:bg-neutral-800 shadow-sm border-r border-neutral-200 dark:border-neutral-700 sticky top-16 h-[calc(100vh-64px)] overflow-y-auto overflow-x-hidden">
            <nav className="px-6 py-6">
              <ul className="space-y-2">
                {adminNavItems.map((item) => {
                  const isActive = location.pathname === item.path;
                  return (
                    <li key={item.key}>
                      <Link
                        to={item.path}
                        className={`flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors ${isActive
                          ? 'bg-primary-100 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium'
                          : 'text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-900 dark:hover:text-white'
                          }`}
                      >
                        <span
                          className={
                            isActive
                              ? 'text-primary-600 dark:text-primary-400'
                              : ''
                          }
                        >
                          {item.icon}
                        </span>
                        <span>{item.label}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>

          {/* Main Content */}
          <div className="flex-1 w-full">
            <main className="p-4 md:p-6">
              <Outlet />
            </main>
          </div>
        </div>
      </div>
    </ConfigProvider>
  );
};

export default AdminLayout;
