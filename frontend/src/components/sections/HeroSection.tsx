import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  LightningIcon,
  CategoriesIcon,
  ChevronDownIcon,
} from '@/components/icons';

interface HeroSectionProps {
  onShopNowClick?: () => void;
  onBrowseCategoriesClick?: () => void;
}

const HERO_SLIDES = [
  {
    id: 1,
    image:
      'https://images.unsplash.com/photo-1593640408182-31c70c8268f5?auto=format&fit=crop&w=2340&q=80',
    titleKey: 'homepage.hero.slides.shopping.title',
    subtitleKey: 'homepage.hero.slides.shopping.subtitle',
    badgeKey: 'homepage.hero.slides.shopping.badge',
  },
  {
    id: 2,
    image:
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=2340&q=80',
    titleKey: 'homepage.hero.slides.fashion.title',
    subtitleKey: 'homepage.hero.slides.fashion.subtitle',
    badgeKey: 'homepage.hero.slides.fashion.badge',
  },
  {
    id: 3,
    image:
      'https://images.unsplash.com/photo-1560472354-b33ff0c44a43?ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D&auto=format&fit=crop&w=2340&q=80',
    titleKey: 'homepage.hero.slides.technology.title',
    subtitleKey: 'homepage.hero.slides.technology.subtitle',
    badgeKey: 'homepage.hero.slides.technology.badge',
  },
] as const;

const HERO_STATS = [
  {
    value: '10K+',
    labelKey: 'homepage.hero.stats.products',
    color: 'hover:text-primary-300',
    icon: '📦',
  },
  {
    value: '50K+',
    labelKey: 'homepage.hero.stats.customers',
    color: 'hover:text-secondary-300',
    icon: '👥',
  },
  {
    value: '99%',
    labelKey: 'homepage.hero.stats.satisfaction',
    color: 'hover:text-success-300',
    icon: '⭐',
  },
  {
    value: '24/7',
    labelKey: 'homepage.hero.stats.support',
    color: 'hover:text-info-300',
    icon: '🛟',
  },
] as const;

const HeroSection: React.FC<HeroSectionProps> = ({
  onShopNowClick,
  onBrowseCategoriesClick,
}) => {
  const { t } = useTranslation();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);

  // Tự động chuyển slide
  useEffect(() => {
    if (!isAutoPlaying) return;

    const interval = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % HERO_SLIDES.length);
    }, 8000); // Chuyển slide mỗi 8 giây

    return () => clearInterval(interval);
  }, [isAutoPlaying]);

  const handleShopNow = () => {
    onShopNowClick?.() ?? (window.location.href = '/shop');
  };

  const handleBrowseCategories = () => {
    onBrowseCategoriesClick?.() ?? (window.location.href = '/categories');
  };

  const goToSlide = (index: number) => {
    setCurrentSlide(index);
    setIsAutoPlaying(false);
    // Tiếp tục tự động chuyển sau 10 giây
    setTimeout(() => setIsAutoPlaying(true), 10000);
  };

  const currentSlideData = HERO_SLIDES[currentSlide];

  return (
    <section className="relative h-screen min-h-[100vh] overflow-hidden">
      {/* Slider nền - KHÔNG DÙNG GRADIENT TUYẾN TÍNH */}
      <div className="absolute inset-0">
        {HERO_SLIDES.map((slide, index) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-all duration-1000 ease-in-out ${
              index === currentSlide
                ? 'opacity-100 scale-100'
                : 'opacity-0 scale-105'
            }`}
          >
            <img
              src={slide.image}
              alt={t(slide.titleKey)}
              className="w-full h-full object-cover"
              loading={index === 0 ? 'eager' : 'lazy'}
            />
            {/* Lớp tối đơn giản - KHÔNG DÙNG GRADIENT */}
            <div className="absolute inset-0 bg-black/60" />
          </div>
        ))}
      </div>

      {/* Chỉ số slide */}
      <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-20">
        <div className="flex space-x-3">
          {HERO_SLIDES.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentSlide
                  ? 'bg-white scale-125 shadow-lg'
                  : 'bg-white/50 hover:bg-white/80 hover:scale-110'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      </div>

      {/* Nội dung */}
      <div className="container mx-auto px-4 h-full relative z-10">
        <div className="flex flex-col lg:flex-row items-center justify-between h-full py-12 lg:py-16">
          {/* Nội dung trái */}
          <div className="flex-1 max-w-3xl text-center lg:text-left mb-12 lg:mb-0">
            {/* Nhãn */}
            <div
              className="inline-flex items-center px-6 py-3 rounded-full bg-white/20 backdrop-blur-md border border-white/30 text-white text-sm font-medium mb-8 animate-fade-in-up"
              style={{ animationDelay: '0.2s' }}
            >
              <span className="w-2 h-2 bg-green-400 rounded-full mr-3 animate-pulse" />
              {t(currentSlideData.badgeKey)}
            </div>

            {/* Tiêu đề chính - KHÔNG DÙNG GRADIENT CHỮ */}
            <h1
              className="text-4xl md:text-6xl lg:text-7xl xl:text-8xl font-black mb-8 leading-tight text-white animate-fade-in-up"
              style={{ animationDelay: '0.4s' }}
            >
              {t(currentSlideData.titleKey)}
            </h1>

            {/* Phụ đề */}
            <p
              className="text-lg md:text-xl lg:text-2xl mb-10 text-white/90 font-light leading-relaxed max-w-2xl mx-auto lg:mx-0 animate-fade-in-up"
              style={{ animationDelay: '0.6s' }}
            >
              {t(currentSlideData.subtitleKey)}
            </p>

            {/* Nút kêu gọi hành động - Gọn & Sạch */}
            <div
              className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in-up"
              style={{ animationDelay: '0.8s' }}
            >
              <button
                className="group relative px-8 py-4 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-base rounded-xl shadow-lg hover:shadow-primary-500/25 transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 overflow-hidden"
                onClick={handleShopNow}
                aria-label={t('homepage.hero.buttons.shopNow')}
              >
                <div className="absolute inset-0 bg-white/20 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <div className="relative flex items-center justify-center">
                  <LightningIcon className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />
                  {t('homepage.hero.buttons.shopNow')}
                </div>
              </button>

              <button
                className="group relative px-8 py-4 bg-white/10 backdrop-blur-md border border-white/30 text-white font-semibold text-base rounded-xl hover:bg-white/20 hover:border-white/50 transition-all duration-300 transform hover:scale-105 overflow-hidden"
                onClick={handleBrowseCategories}
                aria-label={t('homepage.hero.buttons.browseCategories')}
              >
                <div className="absolute inset-0 bg-white/10 transform -skew-x-12 -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <div className="relative flex items-center justify-center">
                  <CategoriesIcon className="h-5 w-5 mr-2 group-hover:rotate-12 transition-transform duration-300" />
                  {t('homepage.hero.buttons.browseCategories')}
                </div>
              </button>
            </div>
          </div>

          {/* Nội dung phải - Thẻ tính năng gọn */}
          <div
            className="flex-1 max-w-md lg:max-w-lg relative animate-fade-in-up"
            style={{ animationDelay: '1s' }}
          >
            <div className="space-y-4">
              {/* Thẻ tính năng 1 - Gọn */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-lg hover:scale-105 transition-all duration-300 hover:bg-white/15">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-primary-600 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <span className="text-lg">🚀</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-base">
                      {t('homepage.hero.features.fastDelivery.title')}
                    </h3>
                    <p className="text-white/70 text-xs">
                      {t('homepage.hero.features.fastDelivery.subtitle')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Thẻ tính năng 2 - Gọn */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-lg hover:scale-105 transition-all duration-300 hover:bg-white/15">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-success-600 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <span className="text-lg">💎</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-base">
                      {t('homepage.hero.features.highQuality.title')}
                    </h3>
                    <p className="text-white/70 text-xs">
                      {t('homepage.hero.features.highQuality.subtitle')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Thẻ tính năng 3 - Gọn */}
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/20 shadow-lg hover:scale-105 transition-all duration-300 hover:bg-white/15">
                <div className="flex items-center">
                  <div className="w-10 h-10 bg-warning-600 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                    <span className="text-lg">🛡️</span>
                  </div>
                  <div>
                    <h3 className="font-semibold text-white text-base">
                      {t('homepage.hero.features.warranty.title')}
                    </h3>
                    <p className="text-white/70 text-xs">
                      {t('homepage.hero.features.warranty.subtitle')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Phần tử nổi - Nhỏ hơn & Dễ thương */}
            <div className="absolute -top-2 -right-2 bg-warning-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md animate-bounce">
              🏷️ {t('homepage.hero.promotions.discount')}
            </div>

            <div className="absolute -bottom-2 -left-2 bg-success-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md animate-pulse">
              🚚 {t('homepage.hero.promotions.freeShip')}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;

