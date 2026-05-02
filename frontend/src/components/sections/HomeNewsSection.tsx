import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import dayjs from 'dayjs';
import { useGetNewsQuery } from '@/services/newsApi';
import { PageSection } from '@/components/layout/PageLayout';
import { SectionLoading } from '@/components/common/LoadingState';

const GRADIENTS = [
  'from-orange-600/90 to-rose-900/90',      // 1. Đỏ/Cam
  'from-lime-500/90 to-green-900/90',       // 2. Xanh lá/Vàng chanh
  'from-yellow-500/90 to-amber-900/90',     // 3. Vàng
  'from-teal-500/90 to-blue-900/90',        // 4. Xanh dương/Teal
  'from-fuchsia-600/90 to-purple-900/90',   // 5. Tím
];

export const HomeNewsSection: React.FC = () => {
  const { t } = useTranslation();
  const { data, isLoading } = useGetNewsQuery({ limit: 5, isPublished: true });

  if (isLoading) return <SectionLoading />;
  // Ẩn section nếu không có tin tức
  if (!data?.news || data.news.length === 0) return null;

  const news = data.news.slice(0, 5); // Đảm bảo tối đa 5 bài

  return (
    <PageSection
      title="Tin tức & Sự kiện"
      className="py-16 bg-neutral-50 dark:bg-neutral-900"
      headerActions={
        <Link 
          to="/news" 
          className="group flex items-center gap-2 text-primary-600 dark:text-primary-400 font-bold hover:text-primary-700 transition-colors"
        >
          Xem tất cả
          <span className="group-hover:translate-x-1 transition-transform">→</span>
        </Link>
      }
    >
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-4 lg:gap-6 h-auto lg:h-[600px]">
        {news.map((item: any, index: number) => {
           // Logic bố cục:
           // Mục 0, 1: Lớn (chiếm 3 cột trên LG)
           // Mục 2, 3, 4: Nhỏ (chiếm 2 cột trên LG)
           const isLarge = index < 2;
           const colSpan = isLarge ? 'lg:col-span-3' : 'lg:col-span-2';
           const gradient = GRADIENTS[index % GRADIENTS.length];
           
           return (
             <Link 
               key={item.id} 
               to={`/news/${item.slug}`}
               className={`group relative rounded-[32px] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 ${colSpan} h-64 md:h-80 lg:h-auto`}
             >
               {/* Ảnh nền */}
               <img 
                 src={item.thumbnail || '/placeholder-news.jpg'} 
                 alt={item.title} 
                 className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
               />
               
               {/* Lớp gradient màu sắc */}
               <div className={`absolute inset-0 bg-gradient-to-br ${gradient} mix-blend-multiply opacity-80 group-hover:opacity-90 transition-opacity duration-300`} />
               
               {/* Gradient tối hơn để dễ đọc văn bản phía dưới */}
               <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

               {/* Nội dung */}
               <div className="absolute inset-0 p-6 md:p-8 flex flex-col justify-end">
                 <div className="transform translate-y-4 group-hover:translate-y-0 transition-transform duration-300">
                    <span className="inline-block px-3 py-1 bg-white/20 backdrop-blur-md border border-white/30 text-white text-xs font-bold rounded-full mb-3 uppercase tracking-wider">
                      {item.category || 'Tin tức'}
                    </span>
                    <h3 className={`font-bold text-white mb-2 leading-tight ${isLarge ? 'text-2xl md:text-3xl' : 'text-xl'} line-clamp-2`}>
                      {item.title}
                    </h3>
                    <div className="flex items-center gap-3 text-white/80 text-xs md:text-sm font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-300 delay-100">
                      <span>{item.author?.firstName ? `${item.author.firstName} ${item.author.lastName}` : 'Admin'}</span>
                      <span>•</span>
                      <span>{dayjs(item.createdAt).format('DD/MM/YYYY')}</span>
                    </div>
                 </div>
               </div>
             </Link>
           );
        })}
      </div>
    </PageSection>
  );
};
