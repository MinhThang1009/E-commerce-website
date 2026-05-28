import React from 'react';
import { motion } from 'framer-motion';
import { viewportOnce } from '@/utils/motion';

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

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

const fadeUpItem = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] as const } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.8 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const },
  },
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
      {/* Animated aurora orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 bg-white/10 rounded-full blur-3xl"
          animate={{ x: [0, 30, 0], y: [0, -20, 0], scale: [1, 1.1, 1] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-white/8 rounded-full blur-3xl"
          animate={{ x: [0, -25, 0], y: [0, 15, 0], scale: [1, 1.15, 1] }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute top-1/3 left-2/3 w-1/4 h-1/4 bg-white/5 rounded-full blur-2xl"
          animate={{ x: [0, -40, 0], y: [0, 30, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Dot grid pattern */}
      <div
        className="absolute inset-0 opacity-[0.07] pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.9) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />

      {/* Noise texture */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Decorative rings — animated rotation */}
      <motion.div
        className="absolute -top-20 -right-20 w-72 h-72 border border-white/[0.08] rounded-full pointer-events-none"
        animate={{ rotate: 360 }}
        transition={{ duration: 60, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute -top-8 -right-8 w-44 h-44 border border-dashed border-white/[0.06] rounded-full pointer-events-none"
        animate={{ rotate: -360 }}
        transition={{ duration: 45, repeat: Infinity, ease: 'linear' }}
      />
      <motion.div
        className="absolute -bottom-16 -left-16 w-56 h-56 border border-white/[0.08] rounded-full pointer-events-none"
        animate={{ rotate: 360 }}
        transition={{ duration: 50, repeat: Infinity, ease: 'linear' }}
      />

      {/* Floating specular highlights */}
      <motion.div
        className="absolute top-1/4 right-1/4 w-2 h-2 bg-white/30 rounded-full blur-[1px] pointer-events-none"
        animate={{ y: [0, -15, 0], opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-2/3 left-1/3 w-1.5 h-1.5 bg-white/20 rounded-full blur-[1px] pointer-events-none"
        animate={{ y: [0, -20, 0], opacity: [0.2, 0.5, 0.2] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
      <motion.div
        className="absolute bottom-1/3 right-1/3 w-1 h-1 bg-white/25 rounded-full pointer-events-none"
        animate={{ y: [0, -12, 0], opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut', delay: 2 }}
      />

      {/* Content — stagger entrance */}
      <motion.div
        className="relative container mx-auto px-4 py-16 md:py-20 text-center"
        initial="hidden"
        animate="visible"
        variants={staggerContainer}
        viewport={viewportOnce}
      >
        {/* Glass icon badge with glow */}
        <motion.div variants={scaleIn} className="inline-block mb-5">
          <div className="relative inline-flex items-center justify-center w-16 h-16 bg-white/15 backdrop-blur-md rounded-2xl border border-white/25 shadow-[0_8px_32px_rgba(0,0,0,0.12),0_0_60px_rgba(255,255,255,0.08)] ring-1 ring-white/10">
            {icon}
            <div className="absolute inset-0 rounded-2xl bg-white/5 animate-pulse" />
          </div>
        </motion.div>

        {/* Title with subtle text shadow */}
        <motion.h1
          className="text-3xl md:text-4xl lg:text-5xl font-bold mb-3 tracking-tight"
          style={{ textShadow: '0 2px 20px rgba(0,0,0,0.15)' }}
          variants={fadeUpItem}
        >
          {title}
        </motion.h1>

        {subtitle && (
          <motion.p
            className="text-white/70 text-sm md:text-base max-w-lg mx-auto leading-relaxed"
            variants={fadeUpItem}
          >
            {subtitle}
          </motion.p>
        )}

        {badge && (
          <motion.div variants={fadeUpItem} className="mt-6">
            <span className="inline-block bg-white/12 backdrop-blur-sm text-white font-semibold py-2.5 px-6 rounded-full text-sm border border-white/20 shadow-lg">
              {badge}
            </span>
          </motion.div>
        )}

        {children && (
          <motion.div variants={fadeUpItem} className="mt-8">
            {children}
          </motion.div>
        )}
      </motion.div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-b from-transparent to-neutral-50 dark:to-neutral-950" />
    </div>
  );
};

export default PageHero;
