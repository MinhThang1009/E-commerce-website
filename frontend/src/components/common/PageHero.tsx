import React from 'react';
import { motion } from 'framer-motion';
import { fadeUp, viewportOnce } from '@/utils/motion';

interface PageHeroProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: string;
  gradient?: 'primary' | 'warm' | 'cool' | 'violet';
  children?: React.ReactNode;
}

const GRADIENT_MAP = {
  primary:
    'from-primary-700 via-primary-600 to-teal-500 dark:from-primary-900 dark:via-primary-800 dark:to-teal-800',
  warm: 'from-amber-600 via-orange-500 to-rose-500 dark:from-amber-800 dark:via-orange-700 dark:to-rose-700',
  cool: 'from-blue-700 via-indigo-600 to-purple-500 dark:from-blue-900 dark:via-indigo-800 dark:to-purple-800',
  violet:
    'from-purple-700 via-fuchsia-600 to-pink-500 dark:from-purple-900 dark:via-fuchsia-800 dark:to-pink-800',
};

const PageHero: React.FC<PageHeroProps> = ({
  icon,
  title,
  subtitle,
  badge,
  gradient = 'primary',
  children,
}) => {
  return (
    <div
      className={`relative overflow-hidden bg-gradient-to-br ${GRADIENT_MAP[gradient]} text-white`}
    >
      {/* Aurora orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-white/10 rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-white/8 rounded-full blur-3xl animate-pulse [animation-delay:1s]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1/3 h-1/3 bg-white/5 rounded-full blur-2xl" />
      </div>

      {/* Noise texture overlay */}
      <div
        className="absolute inset-0 opacity-[0.04] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Content */}
      <motion.div
        className="relative container mx-auto px-4 py-16 md:py-20 text-center"
        initial="hidden"
        animate="visible"
        variants={fadeUp}
        viewport={viewportOnce}
      >
        <div className="inline-flex items-center justify-center w-14 h-14 bg-white/15 backdrop-blur-sm rounded-2xl border border-white/25 mb-5 shadow-lg">
          {icon}
        </div>

        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 tracking-tight">{title}</h1>

        {subtitle && (
          <p className="text-white/80 text-sm md:text-base max-w-lg mx-auto leading-relaxed">
            {subtitle}
          </p>
        )}

        {badge && (
          <div className="mt-6 inline-block bg-white/15 backdrop-blur-sm text-white font-semibold py-2.5 px-6 rounded-full text-sm border border-white/25">
            {badge}
          </div>
        )}

        {children && <div className="mt-8">{children}</div>}
      </motion.div>
    </div>
  );
};

export default PageHero;
