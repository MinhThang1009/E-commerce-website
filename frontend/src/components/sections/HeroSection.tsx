/**
 * @file HeroSection.tsx
 * @layer Component
 * @feature shared
 * @description Hero section redesign 2025-2026 — Liquid Glass + Motion + gradient mesh
 */
import React, { useRef } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowRight, Zap, ShieldCheck, Truck, Sparkles, ChevronRight, Star } from 'lucide-react';

// Danh mục sản phẩm thực từ database — với thumbnail từ sản phẩm nổi bật
// Ảnh lấy từ sản phẩm mới nhất trong database thực tế của TechStore
const PRODUCT_CATEGORIES = [
  {
    id: 'dien-thoai',
    label: 'Điện thoại',
    labelEn: 'Smartphones',
    count: 12,
    slug: '/shop?category=dien-thoai',
    // iPhone 17 (id=1 — mới nhất DB)
    thumbnail:
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/42/342667/iphone-17-xanh-6-638930798970669098-750x500.jpg',
    color: 'from-blue-500/25 to-indigo-600/20',
    accent: '#3B82F6',
    badge: 'iPhone 17',
    rating: 4.9,
  },
  {
    id: 'laptop',
    label: 'Laptop',
    labelEn: 'Laptops',
    count: 22,
    slug: '/shop?category=laptop',
    // MacBook Pro 14" M5 (id=24 — mới nhất DB)
    thumbnail:
      'https://cdnv2.tgdd.vn/mwg-static/tgdd/Products/Images/44/358086/macbook-pro-14-inch-m5-16gb-512gb-thumb-638962954605863722-600x600.jpg',
    color: 'from-violet-500/25 to-purple-600/20',
    accent: '#8B5CF6',
    badge: 'MacBook Pro M5',
    rating: 4.9,
  },
  {
    id: 'smartwatch',
    label: 'Smartwatch',
    labelEn: 'Smartwatches',
    count: 10,
    slug: '/shop?category=smartwatch',
    // Apple Watch Ultra 3 (id=47 — mới nhất DB)
    thumbnail:
      'https://cdn.tgdd.vn/Products/Images/7077/344764/apple-watch-ultra-3-gps-cellular-49mm-vien-titanium-day-ocean-den-tb-600x600.jpg',
    color: 'from-emerald-500/25 to-teal-600/20',
    accent: '#10B981',
    badge: 'Watch Ultra 3',
    rating: 4.9,
  },
  {
    id: 'tablet',
    label: 'Tablet',
    labelEn: 'Tablets',
    count: 11,
    slug: '/shop?category=tablet',
    // iPad A16 5G (id=14 — mới nhất DB)
    thumbnail: 'https://cdn.tgdd.vn/Products/Images/522/335311/ipad-11-5g-sliver-thumb-600x600.jpg',
    color: 'from-orange-500/25 to-amber-600/20',
    accent: '#F59E0B',
    badge: 'iPad A16',
    rating: 4.8,
  },
] as const;

const FEATURES = [
  {
    icon: Truck,
    titleKey: 'homepage.hero.features.fastDelivery.title',
    subtitleKey: 'homepage.hero.features.fastDelivery.subtitle',
    color: 'text-primary-500',
    bg: 'bg-primary-500/10 dark:bg-primary-500/15',
  },
  {
    icon: ShieldCheck,
    titleKey: 'homepage.hero.features.highQuality.title',
    subtitleKey: 'homepage.hero.features.highQuality.subtitle',
    color: 'text-success-500',
    bg: 'bg-success-500/10 dark:bg-success-500/15',
  },
  {
    icon: Zap,
    titleKey: 'homepage.hero.features.warranty.title',
    subtitleKey: 'homepage.hero.features.warranty.subtitle',
    color: 'text-warning-500',
    bg: 'bg-warning-500/10 dark:bg-warning-500/15',
  },
] as const;

// Animation variants
const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.12, delayChildren: 0.1 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] },
  },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  visible: (i: number) => ({
    opacity: 1,
    scale: 1,
    y: 0,
    transition: { duration: 0.6, delay: 0.3 + i * 0.1, ease: [0.16, 1, 0.3, 1] },
  }),
};

interface HeroSectionProps {
  onShopNowClick?: () => void;
  onBrowseCategoriesClick?: () => void;
}

const HeroSection: React.FC<HeroSectionProps> = ({ onShopNowClick, onBrowseCategoriesClick }) => {
  const { t, i18n } = useTranslation();
  const isEn = i18n.language === 'en';
  const sectionRef = useRef<HTMLElement>(null);

  // Parallax scroll
  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start start', 'end start'],
  });
  const orbY1 = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const orbY2 = useTransform(scrollYProgress, [0, 1], [0, -40]);
  const contentY = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const opacity = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  const handleShopNow = () => {
    onShopNowClick?.() ?? (window.location.href = '/shop');
  };
  const handleBrowseCategories = () => {
    onBrowseCategoriesClick?.() ?? (window.location.href = '/categories');
  };

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen overflow-hidden flex items-center
                 bg-[var(--bg-base)] dark:bg-transparent"
      data-motion="true"
    >
      {/* ── SVG Liquid Glass Distortion Filter ── */}
      <svg className="absolute w-0 h-0 pointer-events-none" aria-hidden="true">
        <defs>
          <filter id="glass-distortion" x="-20%" y="-20%" width="140%" height="140%">
            <feTurbulence
              type="turbulence"
              baseFrequency="0.015 0.012"
              numOctaves="3"
              seed="2"
              result="noise"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="noise"
              scale="6"
              xChannelSelector="R"
              yChannelSelector="G"
            />
          </filter>
        </defs>
      </svg>

      {/* ── Gradient Mesh Background ── */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        {/* Base gradient */}
        {/* Base bg — dark mode dùng neutral thuần, KHÔNG zinc-based */}
        <div
          className="absolute inset-0 bg-gradient-to-br
          from-neutral-50 via-white to-primary-50/30
          dark:from-[#111111] dark:via-[#0d0d0d] dark:to-[#111111]"
        />

        {/* Orb 1 — teal */}
        <motion.div
          style={{
            y: orbY1,
            background: 'radial-gradient(ellipse, rgba(42,172,167,0.14) 0%, transparent 70%)',
          }}
          className="absolute -top-32 -left-32 w-[700px] h-[700px] rounded-full animate-orb-1 pointer-events-none blur-[1px]"
          aria-hidden="true"
        />
        {/* Orb 2 — coral */}
        <motion.div
          style={{
            y: orbY2,
            background: 'radial-gradient(ellipse, rgba(255,117,94,0.14) 0%, transparent 70%)',
          }}
          className="absolute top-1/4 -right-48 w-[500px] h-[500px] rounded-full animate-orb-2 pointer-events-none"
          aria-hidden="true"
        />
        {/* Orb 3 — deep teal */}
        <div
          className="absolute -bottom-20 left-1/3 w-[400px] h-[400px] rounded-full animate-orb-3 pointer-events-none"
          style={{
            background: 'radial-gradient(ellipse, rgba(75,188,184,0.12) 0%, transparent 70%)',
          }}
          aria-hidden="true"
        />

        {/* Subtle grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.025] dark:opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(rgba(42,172,167,1) 1px, transparent 1px), linear-gradient(to right, rgba(42,172,167,1) 1px, transparent 1px)',
            backgroundSize: '64px 64px',
          }}
        />
      </div>

      {/* ── Main Content ── */}
      <motion.div
        style={{ y: contentY, opacity }}
        className="container mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-10 lg:pt-24 lg:pb-14 relative z-10 no-theme-transition"
      >
        <div className="grid lg:grid-cols-2 gap-12 xl:gap-16 items-center">
          {/* ─── Left: Typography + CTAs ─── */}
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="text-center lg:text-left"
          >
            {/* Badge */}
            <motion.div variants={itemVariants} className="inline-flex mb-6">
              <span
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full
                text-sm font-medium glass-card !rounded-full !p-0 overflow-hidden"
              >
                <span className="flex items-center gap-2 px-4 py-2">
                  <Sparkles className="w-4 h-4 text-primary-500 animate-pulse" />
                  <span className="text-neutral-700 dark:text-neutral-200 font-medium">
                    TechStore 2026
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-primary-500 animate-ping" />
                </span>
              </span>
            </motion.div>

            {/* Headline */}
            <motion.h1
              variants={itemVariants}
              className="font-heading font-black leading-[1.05] tracking-tight mb-6"
            >
              <span
                className="block text-5xl sm:text-6xl lg:text-7xl xl:text-8xl
                text-neutral-900 dark:text-white"
              >
                {isEn ? 'Premium Tech' : 'Công nghệ'}
              </span>
              <span
                className="block text-5xl sm:text-6xl lg:text-7xl xl:text-8xl
                gradient-text mt-1"
              >
                {isEn ? 'Redefined' : 'Cao cấp'}
              </span>
              <span
                className="block text-5xl sm:text-6xl lg:text-7xl xl:text-8xl
                text-neutral-900 dark:text-white mt-1"
              >
                {isEn ? 'For You' : 'Cho bạn'}
              </span>
            </motion.h1>

            {/* Subheading */}
            <motion.p
              variants={itemVariants}
              className="text-lg sm:text-xl text-neutral-500 dark:text-neutral-400
                font-light leading-relaxed max-w-xl mx-auto lg:mx-0 mb-8"
            >
              {isEn
                ? '60+ premium tech products — phones, laptops, smartwatches. Fast delivery, 12-month warranty.'
                : '60+ sản phẩm công nghệ cao cấp — điện thoại, laptop, smartwatch. Giao nhanh 24h, bảo hành 12 tháng.'}
            </motion.p>

            {/* Stats row */}
            <motion.div
              variants={itemVariants}
              className="flex items-center gap-6 justify-center lg:justify-start mb-10"
            >
              {[
                { value: '60+', label: isEn ? 'Products' : 'Sản phẩm' },
                { value: '12', label: isEn ? 'Months warranty' : 'Tháng bảo hành' },
                { value: '24h', label: isEn ? 'Fast delivery' : 'Giao hàng' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl font-black text-primary-500 dark:text-primary-400">
                    {stat.value}
                  </div>
                  <div className="text-xs text-neutral-500 dark:text-neutral-500 font-medium mt-0.5">
                    {stat.label}
                  </div>
                </div>
              ))}
              <div className="w-px h-10 bg-neutral-200 dark:bg-neutral-700" />
              <div className="flex items-center gap-1.5">
                <div className="flex">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Star key={i} className="w-3.5 h-3.5 text-warning-400 fill-warning-400" />
                  ))}
                </div>
                <span className="text-xs text-neutral-500 dark:text-neutral-400 font-medium">
                  4.9/5
                </span>
              </div>
            </motion.div>

            {/* CTAs */}
            <motion.div
              variants={itemVariants}
              className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start"
            >
              {/* Primary CTA */}
              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleShopNow}
                className="group relative flex items-center justify-center gap-2.5
                  px-7 py-4 rounded-2xl font-semibold text-base text-white
                  bg-primary-600 hover:bg-primary-500
                  shadow-[0_4px_24px_rgba(42,172,167,0.4)]
                  hover:shadow-[0_8px_32px_rgba(42,172,167,0.55)]
                  transition-all duration-300 overflow-hidden"
              >
                <span
                  className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/10 to-white/0
                  translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700"
                />
                <Zap className="w-5 h-5 group-hover:scale-110 transition-transform" />
                <span>{isEn ? 'Shop Now' : 'Mua sắm ngay'}</span>
                <ArrowRight className="w-4 h-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
              </motion.button>

              {/* Secondary CTA */}
              <motion.button
                whileHover={{ scale: 1.03, y: -2 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleBrowseCategories}
                className="group flex items-center justify-center gap-2.5
                  px-7 py-4 rounded-2xl font-semibold text-base
                  glass-card !transition-all !duration-300
                  text-neutral-700 dark:text-neutral-200
                  hover:text-primary-600 dark:hover:text-primary-400"
              >
                <span>{isEn ? 'Browse Categories' : 'Khám phá danh mục'}</span>
                <ChevronRight className="w-4 h-4 group-hover:translate-x-1 transition-transform duration-300" />
              </motion.button>
            </motion.div>

            {/* Feature chips */}
            <motion.div
              variants={itemVariants}
              className="flex flex-wrap gap-2 justify-center lg:justify-start mt-8"
            >
              {FEATURES.map((f) => (
                <span
                  key={f.titleKey}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium
                    ${f.bg} ${f.color} border border-current/10`}
                >
                  <f.icon className="w-3 h-3" />
                  {t(f.titleKey)}
                </span>
              ))}
            </motion.div>
          </motion.div>

          {/* ─── Right: Product Category Cards ─── */}
          <div className="relative hidden lg:flex items-center justify-center">
            {/* 2×2 equal grid — fill full column width */}
            <div className="grid grid-cols-2 gap-3 w-full">
              {PRODUCT_CATEGORIES.map((cat, i) => (
                <motion.div
                  key={cat.id}
                  custom={i}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover={{ scale: 1.04, y: -6 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <Link
                    to={cat.slug}
                    className="block glass-card group cursor-pointer overflow-hidden"
                  >
                    <div
                      className={`relative overflow-hidden rounded-[inherit] bg-gradient-to-br ${cat.color}`}
                    >
                      {/* Product thumbnail */}
                      <div className="relative h-36 overflow-hidden">
                        <img
                          src={cat.thumbnail}
                          alt={cat.label}
                          className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-700"
                          loading="lazy"
                        />
                        {/* Gradient overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />

                        {/* Badge */}
                        <div className="absolute top-3 left-3">
                          <span
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full
                            text-[11px] font-bold bg-white/90 dark:bg-black/70 backdrop-blur-sm"
                            style={{ color: cat.accent }}
                          >
                            {cat.badge}
                          </span>
                        </div>

                        {/* Rating */}
                        <div className="absolute top-3 right-3">
                          <span
                            className="inline-flex items-center gap-1 px-2 py-1 rounded-full
                            text-[11px] font-semibold text-white bg-black/40 backdrop-blur-sm"
                          >
                            <Star className="w-2.5 h-2.5 fill-warning-400 text-warning-400" />
                            {cat.rating}
                          </span>
                        </div>
                      </div>

                      {/* Card content */}
                      <div className="p-3.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-bold text-neutral-900 dark:text-white text-sm leading-tight">
                              {isEn ? cat.labelEn : cat.label}
                            </h3>
                            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                              {cat.count} {isEn ? 'products' : 'sản phẩm'}
                            </p>
                          </div>
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center
                              group-hover:scale-110 transition-transform duration-300"
                            style={{ backgroundColor: `${cat.accent}20` }}
                          >
                            <ArrowRight
                              className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"
                              style={{ color: cat.accent }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* Floating promo badges */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8, rotate: -6 }}
              animate={{ opacity: 1, scale: 1, rotate: -6 }}
              transition={{ delay: 0.8, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="absolute -top-4 -right-4 z-20"
            >
              <div
                className="glass-card !rounded-2xl px-4 py-2 border border-warning-400/30
                bg-warning-500/10 backdrop-blur-xl shadow-glow-secondary"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🏷️</span>
                  <div>
                    <div className="text-xs font-bold text-warning-600 dark:text-warning-400">
                      {t('homepage.hero.promotions.discount')}
                    </div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                      {isEn ? 'Limited time' : 'Có hạn'}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="absolute -bottom-4 -left-4 z-20"
            >
              <div
                className="glass-card !rounded-2xl px-4 py-2 border border-success-400/30
                bg-success-500/10 backdrop-blur-xl"
              >
                <div className="flex items-center gap-2">
                  <span className="text-lg">🚚</span>
                  <div>
                    <div className="text-xs font-bold text-success-600 dark:text-success-400">
                      {t('homepage.hero.promotions.freeShip')}
                    </div>
                    <div className="text-[10px] text-neutral-500 dark:text-neutral-400">
                      {isEn ? 'Within 24h' : 'Trong 24h'}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>

        {/* ── Mobile category chips (lg hidden) ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="lg:hidden mt-10 flex gap-3 overflow-x-auto pb-2 no-scrollbar justify-center flex-wrap"
        >
          {PRODUCT_CATEGORIES.map((cat) => (
            <Link
              key={cat.id}
              to={cat.slug}
              className="flex-shrink-0 flex items-center gap-2.5 px-4 py-2.5 rounded-2xl
                glass-card text-sm font-medium text-neutral-700 dark:text-neutral-200
                hover:text-primary-600 dark:hover:text-primary-400 transition-colors"
            >
              <img
                src={cat.thumbnail}
                alt={cat.label}
                className="w-8 h-8 rounded-lg object-cover"
              />
              <span>{isEn ? cat.labelEn : cat.label}</span>
              <span className="text-xs text-neutral-400 dark:text-neutral-500">{cat.count}</span>
            </Link>
          ))}
        </motion.div>
      </motion.div>

      {/* ── Scroll indicator ── */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-2"
      >
        <span className="text-xs text-neutral-400 dark:text-neutral-500 font-medium tracking-widest uppercase">
          {isEn ? 'Scroll' : 'Cuộn'}
        </span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
          className="w-5 h-8 rounded-full border-2 border-neutral-300 dark:border-neutral-600 flex justify-center pt-1.5"
        >
          <motion.div className="w-1 h-1.5 rounded-full bg-primary-500" />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
