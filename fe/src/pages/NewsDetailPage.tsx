import { useParams, Link } from 'react-router-dom';
import { useGetNewsBySlugQuery, useGetNewsQuery, useGetRelatedNewsQuery } from '@/services/newsApi';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import dayjs from 'dayjs';

const RelatedNewsList: React.FC<{ slug: string }> = ({ slug }) => {
  const { data, isLoading } = useGetRelatedNewsQuery(slug);

  if (isLoading) return <LoadingSpinner />;
  if (!data?.news || data.news.length === 0) return null;

  return (
    <>
      {data.news.map((n: any) => (
        <Link key={n.id} to={`/news/${n.slug}`} className="group block bg-neutral-50 dark:bg-neutral-800 rounded-3xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1">
          <div className="aspect-[16/10] overflow-hidden relative">
            <img 
              src={n.thumbnail || '/placeholder-news.jpg'} 
              alt={n.title}
              className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
            />
            <div className="absolute top-4 left-4 bg-white/90 dark:bg-black/80 backdrop-blur-md px-3 py-1 rounded-full text-xs font-bold text-neutral-900 dark:text-white uppercase tracking-wider shadow-sm">
                {n.category || 'Tin tức'}
            </div>
          </div>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-3 text-xs text-neutral-400 font-medium">
               <span>{dayjs(n.createdAt).format('DD/MM/YYYY')}</span>
               <span>•</span>
               <span>{n.viewCount || 0} lượt xem</span>
            </div>
            <h4 className="text-lg font-bold text-neutral-900 dark:text-neutral-100 leading-snug group-hover:text-primary-600 transition-colors line-clamp-2 mb-2">
              {n.title}
            </h4>
          </div>
        </Link>
      ))}
    </>
  );
};

const NewsDetailPage: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  
  const { data: newsResponse, isLoading } = useGetNewsBySlugQuery(slug!);
  const { data: recentNewsResponse } = useGetNewsQuery({ limit: 5, isPublished: true });

  if (isLoading) return <LoadingSpinner fullScreen />;
  
  const newsItem = newsResponse?.news;
  if (!newsItem) return (
    <div className="min-h-screen flex flex-col justify-center items-center">
      <h1 className="text-2xl font-bold mb-4 font-heading">Không tìm thấy bài viết</h1>
      <Link to="/news" className="text-primary-600 hover:underline">Quay lại danh sách tin tức</Link>
    </div>
  );

  const item = newsItem;
  const authorName = item.author ? `${item.author.firstName} ${item.author.lastName}` : 'Admin';
  const authorAvatar = item.author?.avatar || '/placeholder-avatar.jpg';

  return (
    <div className="min-h-screen bg-white dark:bg-neutral-900 pt-28 pb-20">
      <div className="container mx-auto px-4">
        {/* Breadcrumbs */}
        <nav className="mb-8 text-sm text-neutral-500 font-medium overflow-x-auto whitespace-nowrap no-scrollbar">
          <Link to="/" className="hover:text-primary-600">Trang chủ</Link>
          <span className="mx-2">/</span>
          <Link to="/news" className="hover:text-primary-600">Tin tức</Link>
          <span className="mx-2">/</span>
          <span className="hover:text-primary-600 cursor-pointer">{item.category || 'Tin tức'}</span>
          <span className="mx-2">/</span>
          <span className="text-neutral-800 dark:text-neutral-200 truncate inline-block max-w-[200px] align-bottom">
            {item.title}
          </span>
        </nav>

        <div className="flex flex-col lg:flex-row gap-12 lg:items-start">
          {/* Main Content */}
          <article className="flex-grow lg:max-w-4xl">
            <header className="mb-10">
              <div className="flex items-center gap-3 mb-6">
                 <span className="px-3 py-1 bg-primary-50 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400 text-xs font-bold rounded-full uppercase tracking-wider">
                    {item.category || 'Tin tức'}
                 </span>
                 <span className="text-neutral-400 text-xs font-medium">
                    {dayjs(item.createdAt).format('DD/MM/YYYY')}
                 </span>
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-neutral-900 dark:text-white mb-8 leading-[1.2] font-heading">
                {item.title}
              </h1>
              
              <div className="flex items-center gap-4 py-6 border-y border-neutral-100 dark:border-neutral-800">
                <div className="w-12 h-12 rounded-full overflow-hidden bg-neutral-100 flex-shrink-0">
                  <img src={authorAvatar} alt={authorName} className="w-full h-full object-cover" />
                </div>
                <div>
                  <div className="text-neutral-900 dark:text-white font-bold text-sm">
                    {authorName}
                  </div>
                  <div className="text-neutral-500 text-xs">
                    Tác giả tại ShopMini
                  </div>
                </div>
              </div>
            </header>

            {item.thumbnail && (
              <div className="mb-12 rounded-3xl overflow-hidden shadow-2xl shadow-neutral-200 dark:shadow-none">
                <img 
                  src={item.thumbnail} 
                  alt={item.title}
                  className="w-full h-auto"
                />
              </div>
            )}

            <div 
              className="description-content prose prose-lg dark:prose-invert max-w-none 
                prose-headings:text-neutral-900 dark:prose-headings:text-white
                prose-p:text-neutral-700 dark:prose-p:text-neutral-300
                prose-a:text-primary-600 hover:prose-a:text-primary-700
                prose-img:rounded-3xl prose-img:shadow-xl"
              dangerouslySetInnerHTML={{ __html: item.content }}
            />

            {item.tags && (
              <div className="mt-8 flex flex-wrap gap-2">
                {item.tags.split(',').map((tag: string) => (
                  <span key={tag} className="px-3 py-1 bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-xs rounded-lg">
                    #{tag.trim()}
                  </span>
                ))}
              </div>
            )}

            {/* Social Share / Tags Placeholder */}
            <div className="mt-16 pt-8 border-t border-neutral-100 dark:border-neutral-800 flex flex-wrap items-center justify-between gap-6">
               <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-neutral-400 uppercase tracking-widest">Share:</span>
                  <div className="flex gap-2">
                     <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-400 cursor-pointer hover:bg-primary-500 hover:text-white transition-all">F</div>
                     <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-400 cursor-pointer hover:bg-primary-500 hover:text-white transition-all">T</div>
                     <div className="w-10 h-10 rounded-full bg-neutral-100 dark:bg-neutral-800 flex items-center justify-center text-neutral-600 dark:text-neutral-400 cursor-pointer hover:bg-primary-500 hover:text-white transition-all">L</div>
                  </div>
               </div>
               <div className="text-neutral-400 text-sm font-medium">
                  Lượt xem: {item.viewCount || 0}
               </div>
            </div>

            {/* Related News Section */}
            <div className="mt-16">
              <h3 className="text-2xl font-bold mb-8 text-neutral-900 dark:text-white flex items-center gap-3">
                <span className="w-2 h-8 bg-primary-600 rounded-full" />
                Bài viết liên quan
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                 <RelatedNewsList slug={slug!} />
              </div>
            </div>
          </article>

            {/* Sidebar */}
          <aside className="lg:w-96 flex-shrink-0 lg:sticky lg:top-28">
            <div className="bg-neutral-50 dark:bg-neutral-800/50 rounded-3xl p-8 border border-neutral-100 dark:border-neutral-800">
              <h3 className="text-xl font-bold mb-8 text-neutral-900 dark:text-white flex items-center gap-3">
                <span className="w-2 h-8 bg-primary-600 rounded-full" />
                Tin mới cập nhật
              </h3>
              <div className="space-y-8">
                {recentNewsResponse?.news?.filter((n: any) => n.id !== item.id).slice(0, 4).map((n: any) => (
                  <Link key={n.id} to={`/news/${n.slug}`} className="group flex gap-4">
                    <div className="w-24 h-24 flex-shrink-0 rounded-2xl overflow-hidden shadow-sm">
                      <img 
                        src={n.thumbnail || '/placeholder-news.jpg'} 
                        alt={n.title}
                        className="w-full h-full object-cover transition-transform group-hover:scale-110"
                      />
                    </div>
                    <div className="flex flex-col justify-center flex-grow">
                      <span className="text-[10px] font-extrabold text-primary-600 uppercase tracking-wider mb-1">
                        {n.category || 'Tin tức'}
                      </span>
                      <h4 className="text-sm font-bold text-neutral-800 dark:text-neutral-100 line-clamp-2 leading-snug group-hover:text-primary-600 transition-colors">
                        {n.title}
                      </h4>
                      <p className="text-[10px] text-neutral-400 mt-2 font-medium">
                        {dayjs(n.createdAt).format('DD/MM/YYYY')}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default NewsDetailPage;
