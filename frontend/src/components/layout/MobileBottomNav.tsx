import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Store, ShoppingCart, User } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '@/stores/cart-store';
import { useAuthStore } from '@/stores/auth-store';
import { ROUTES } from '@/routes/paths';

const MobileBottomNav: React.FC = () => {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const totalItems = useCartStore((s) => s.totalItems);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const navItems = [
    { icon: Home, label: t('header.navigation.home'), path: ROUTES.HOME },
    { icon: Store, label: t('header.navigation.shop'), path: ROUTES.SHOP },
    {
      icon: ShoppingCart,
      label: t('header.actions.shoppingCart'),
      path: ROUTES.CART,
      badge: totalItems,
    },
    {
      icon: User,
      label: t('header.dropdown.profile', { defaultValue: 'Tài khoản' }),
      path: isAuthenticated ? ROUTES.PROFILE : ROUTES.LOGIN,
    },
  ];

  const isActive = (path: string) =>
    pathname === path || (path !== '/' && pathname.startsWith(path));

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-white/95 dark:bg-neutral-900/95 backdrop-blur-xl border-t border-neutral-200 dark:border-neutral-700/80"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <div className="flex items-center justify-around h-16">
        {navItems.map(({ icon: Icon, label, path, badge }) => {
          const active = isActive(path);
          return (
            <button
              key={path}
              onClick={() => navigate(path)}
              className={`flex flex-col items-center justify-center gap-0.5 w-full h-full transition-colors relative ${
                active
                  ? 'text-primary-600 dark:text-primary-400'
                  : 'text-neutral-500 dark:text-neutral-400'
              }`}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${active ? 'stroke-[2.5]' : ''}`} />
                {badge != null && badge > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {badge > 99 ? '99+' : badge}
                  </span>
                )}
              </div>
              <span className={`text-[10px] font-medium ${active ? 'font-semibold' : ''}`}>
                {label}
              </span>
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-primary-500 rounded-full" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default MobileBottomNav;
