import React from 'react';
import { useTranslation } from 'react-i18next';
import { useGetBannersQuery } from '@/services/bannerApi';
import { Carousel, Skeleton } from 'antd';
import { Link } from 'react-router-dom';

interface BannerDisplayProps {
  position: 'home_hero' | 'home_middle' | 'sidebar';
  className?: string;
}

const BannerDisplay: React.FC<BannerDisplayProps> = ({ position, className }) => {
  const { t } = useTranslation();
  const { data, isLoading, isError } = useGetBannersQuery({ position, isActive: true });

  if (isLoading) {
    return (
      <div className={`w-full ${className}`}>
        <Skeleton.Button active block style={{ height: position === 'home_hero' ? 400 : 200 }} />
      </div>
    );
  }

  const banners = data?.data || [];
  if (banners.length === 0) return null;

  const renderBanner = (banner: any, wrapperClass?: string) => {
    const content = (
      <div className="relative w-full h-full overflow-hidden group cursor-pointer transition-all duration-500">
        <img
          src={banner.imageUrl.startsWith('http') ? banner.imageUrl : `${import.meta.env.VITE_API_URL || 'http://localhost:8888'}${banner.imageUrl}`}
          alt={banner.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent flex flex-col justify-end p-6 md:p-10 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
          <h3 className="text-white text-2xl md:text-3xl font-bold mb-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
            {banner.title}
          </h3>
          {banner.linkUrl && (
            <div className="text-white opacity-80 flex items-center gap-2 transform translate-y-4 group-hover:translate-y-0 transition-transform duration-500 delay-75">
              <span>{t('banner.exploreNow')}</span>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          )}
        </div>
      </div>
    );

    return banner.linkUrl ? (
      <Link key={banner.id} to={banner.linkUrl} className={`block w-full outline-none ${wrapperClass || 'h-full'}`}>
        {content}
      </Link>
    ) : (
      <div key={banner.id} className={`w-full outline-none ${wrapperClass || 'h-full'}`}>{content}</div>
    );
  };

  if (position === 'home_hero') {
    return (
      <div className={`w-full mb-8 ${className}`}>
        <Carousel autoplay effect="fade" autoplaySpeed={5000} className="rounded-2xl overflow-hidden shadow-2xl">
          {banners.map((b: any) => renderBanner(b, 'h-[300px] md:h-[500px]'))}
        </Carousel>
      </div>
    );
  }

  if (position === 'home_middle') {
    return (
      <div className={`w-full my-12 rounded-3xl overflow-hidden shadow-xl transform transition-transform hover:scale-[1.01] duration-500 ${className}`}>
        {banners.length > 1 ? (
          <Carousel autoplay dots={false} pauseOnHover={false} speed={1000}>
            {banners.map((b: any) => renderBanner(b, 'h-[200px] md:h-[300px]'))}
          </Carousel>
        ) : (
          renderBanner(banners[0], 'h-[200px] md:h-[300px]')
        )}
      </div>
    );
  }

  if (position === 'sidebar') {
    return (
      <div className={`flex flex-col gap-4 ${className}`}>
        {banners.map((banner: any) => (
          <div key={banner.id} className="w-full aspect-[3/4] rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-all duration-300">
            {renderBanner(banner, 'h-full')}
          </div>
        ))}
      </div>
    );
  }

  return null;
};

export default BannerDisplay;
