import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useGetNewsQuery } from '@/services/newsApi';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import Pagination from '@/components/common/Pagination';
import dayjs from 'dayjs';

const CATEGORIES = ['Tất cả', 'Tin tức', 'Đánh giá', 'Tư vấn', 'Thủ thuật'];

const NewsListPage: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const page = searchParams.get('page') ? Number(searchParams.get('page')) : 1;
  const search = searchParams.get('search') || '';
  const currentCategory = searchParams.get('category') || 'Tất cả';
  const limit = 15;

  const { data: newsData, isLoading } = useGetNewsQuery({
    page,
    limit,
    search,
    category: currentCategory,
    isPublished: true,
  });

  const handlePageChange = (newPage: number) => {
    const updatedParams = new URLSearchParams(searchParams);
    updatedParams.set('page', String(newPage));
    setSearchParams(updatedParams);
  };

  const handleCategoryChange = (category: string) => {
    const updatedParams = new URLSearchParams(searchParams);
    if (category === 'Tất cả') {
      updatedParams.delete('category');
    } else {
      updatedParams.set('category', category);
    }
    updatedParams.set('page', '1');
    setSearchParams(updatedParams);
  };

  if (isLoading) return <LoadingSpinner fullScreen />;

  const allNews = newsData?.news || [];
  const showFeatured = page === 1 && currentCategory === 'Tất cả' && allNews.length >= 3;
  
  const featuredPost = showFeatured ? allNews[0] : null;
  const gridPosts = showFeatured ? allNews.slice(1, 5) : [];
  const listPosts = showFeatured ? allNews.slice(5) : allNews;
  const totalPages = newsData?.totalPages || 0;

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900 py-12 pt-28">
      <div className="container mx-auto px-4">
        {/* Category Filters */}
        <div className="flex flex-wrap gap-3 mb-12 overflow-x-auto pb-2 no-scrollbar">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => handleCategoryChange(cat)}
              className={`px-6 py-2 rounded-full font-medium transition-all duration-300 border ${
                currentCategory === cat
                  ? 'bg-primary-600 border-primary-600 text-white shadow-lg'
                  : 'bg-white dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:border-primary-500'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <h1 className="text-4xl font-bold text-neutral-900 dark:text-white mb-10">
          {currentCategory}
        </h1>

        {allNews.length === 0 ? (
          <div className="text-center py-20 bg-neutral-50 dark:bg-neutral-800 rounded-3xl">
             <p className="text-neutral-500 text-lg">Chưa có bài viết nào trong chuyên mục này.</p>
          </div>
        ) : (
          <div className="space-y-12">
            {/* Top Layout: Featured + Grid (Only on page 1 and "Tất cả") */}
            {showFeatured && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                {/* Featured Post */}
                <Link 
                  to={`/news/${featuredPost!.slug}`}
                  className="lg:col-span-8 group relative overflow-hidden rounded-3xl bg-neutral-100 aspect-[16/9] lg:aspect-auto"
                >
                  <img 
                    src={featuredPost!.thumbnail || '/placeholder-news.jpg'} 
                    alt={featuredPost!.title}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                  <div className="absolute bottom-0 left-0 p-8 w-full">
                     <span className="inline-block px-3 py-1 bg-primary-600 text-white text-xs font-bold rounded-full mb-4">
                        {featuredPost!.category || 'Tin tức'}
                     </span>
                     <h2 className="text-2xl md:text-4xl font-bold text-white mb-4 line-clamp-2 leading-tight group-hover:text-primary-400 transition-colors">
                        {featuredPost!.title}
                     </h2>
                     <div className="flex items-center text-white/70 text-sm gap-4">
                        <span>{featuredPost!.author?.firstName} {featuredPost!.author?.lastName}</span>
                        <span className="w-1 h-1 bg-white/50 rounded-full" />
                        <span>{dayjs(featuredPost!.createdAt).format('DD/MM/YYYY')}</span>
                     </div>
                  </div>
                </Link>

                {/* Grid Posts */}
                {gridPosts.length > 0 && (
                  <div className="lg:col-span-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-6">
                    {gridPosts.map((post: any) => (
                      <Link 
                        key={post.id} 
                        to={`/news/${post.slug}`}
                        className="group flex gap-4 h-[120px]"
                      >
                        <div className="w-[120px] h-[120px] rounded-2xl overflow-hidden flex-shrink-0">
                          <img 
                            src={post.thumbnail || '/placeholder-news.jpg'} 
                            alt={post.title}
                            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                          />
                        </div>
                        <div className="flex flex-col justify-center">
                          <span className="text-primary-600 text-xs font-bold mb-1 uppercase tracking-wider">
                            {post.category || 'Tin tức'}
                          </span>
                          <h3 className="text-sm font-bold text-neutral-800 dark:text-neutral-100 line-clamp-2 group-hover:text-primary-600 transition-colors leading-snug">
                            {post.title}
                          </h3>
                          <div className="mt-2 text-[11px] text-neutral-500 font-medium">
                            {dayjs(post.createdAt).format('DD/MM/YYYY')}
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* List Layout: Default Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
              {listPosts.map((item: any) => (
                <Link 
                  key={item.id} 
                  to={`/news/${item.slug}`}
                  className="group flex flex-col"
                >
                  <div className="relative aspect-[16/10] rounded-3xl overflow-hidden mb-6 shadow-sm">
                    <img 
                      src={item.thumbnail || '/placeholder-news.jpg'} 
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                    <div className="absolute top-4 left-4">
                       <span className="px-3 py-1 bg-white/90 dark:bg-neutral-800/90 text-primary-600 text-[10px] font-extrabold rounded-full uppercase tracking-tighter shadow-sm border border-neutral-100 dark:border-neutral-700">
                          {item.category || 'Tin tức'}
                       </span>
                    </div>
                  </div>
                  <div className="flex flex-col flex-grow">
                    <h2 className="text-lg font-bold text-neutral-800 dark:text-neutral-100 mb-3 line-clamp-2 group-hover:text-primary-600 transition-colors leading-snug">
                      {item.title}
                    </h2>
                    <div className="mt-auto flex items-center justify-between">
                       <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-neutral-200 overflow-hidden">
                             <img src={item.author?.avatar || '/placeholder-avatar.jpg'} alt="" />
                          </div>
                          <span className="text-xs text-neutral-600 dark:text-neutral-400 font-medium">
                             {item.author?.firstName} {item.author?.lastName}
                          </span>
                       </div>
                       <span className="text-[11px] text-neutral-400">
                          {dayjs(item.createdAt).format('DD/MM/YYYY')}
                       </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-16 flex justify-center">
                <Pagination 
                  currentPage={page}
                  totalPages={totalPages}
                  onPageChange={handlePageChange}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NewsListPage;
