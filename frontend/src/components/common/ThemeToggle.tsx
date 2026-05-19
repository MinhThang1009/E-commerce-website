/**
 * @file ThemeToggle.tsx
 * @layer Component
 * @feature shared
 * @description Toggle switch dark/light mode với circular reveal animation
 */
import React, { useRef } from 'react';
import { flushSync } from 'react-dom';
import { useTranslation } from 'react-i18next';
import { useUiStore } from '@/stores/ui-store';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle: React.FC = () => {
  const { t } = useTranslation();
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const isDark = theme === 'dark';
  const btnRef = useRef<HTMLButtonElement>(null);

  const handleToggle = () => {
    const newTheme = isDark ? 'light' : 'dark';

    if (!document.startViewTransition) {
      setTheme(newTheme);
      return;
    }

    // Origin point từ tâm nút toggle
    const rect = btnRef.current?.getBoundingClientRect();
    const x = rect ? `${Math.round(rect.left + rect.width / 2)}px` : '50%';
    const y = rect ? `${Math.round(rect.top + rect.height / 2)}px` : '50%';
    document.documentElement.style.setProperty('--theme-toggle-x', x);
    document.documentElement.style.setProperty('--theme-toggle-y', y);

    /*
     * startViewTransition: browser snapshot page rồi animate.
     * Snapshot xảy ra trước khi setTheme() → sau đó theme change → circular reveal.
     */
    /*
     * flushSync: buộc React update DOM đồng bộ TRONG callback của startViewTransition
     * Không có flushSync → React update DOM async → transition capture state cũ → lag/glitch
     * Source: https://notanumber.in/blog/animated-dark-mode-toggle-with-view-transitions-api-in-react
     */
    document.startViewTransition(() => {
      flushSync(() => {
        setTheme(newTheme);
      });
    });
  };

  return (
    <button
      ref={btnRef}
      onClick={handleToggle}
      className={`relative w-[52px] h-7 rounded-full border transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 ${
        isDark
          ? 'bg-primary-500/20 border-primary-500/40'
          : 'bg-neutral-200/80 border-neutral-300/60'
      }`}
      aria-label={isDark ? t('common.switchToLight') : t('common.switchToDark')}
    >
      <div
        className={`absolute inset-0 rounded-full bg-gradient-to-r from-primary-600/30 to-primary-400/20 transition-opacity duration-200 ${isDark ? 'opacity-100' : 'opacity-0'}`}
      />
      <div
        className={`absolute top-[3px] left-[3px] w-[22px] h-[22px] rounded-full bg-white shadow-md flex items-center justify-center transition-transform duration-200 ${
          isDark ? 'translate-x-[24px]' : 'translate-x-0'
        }`}
        style={{
          boxShadow: isDark ? '0 1px 8px rgba(42,172,167,0.35)' : '0 1px 4px rgba(0,0,0,0.15)',
        }}
      >
        {isDark ? (
          <Moon className="w-3 h-3 text-primary-500" />
        ) : (
          <Sun className="w-3.5 h-3.5 text-warning-500" />
        )}
      </div>
    </button>
  );
};

export default ThemeToggle;
