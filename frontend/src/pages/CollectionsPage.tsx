import React from 'react';
import { Link } from 'react-router-dom';
import { useGetCollectionsQuery } from '@/services/collectionApi';
import { PageLayout } from '@/components/layout/PageLayout';
import { ErrorState } from '@/components/common/ErrorState';

const CollectionsPage: React.FC = () => {
    const { data: collectionsData, isLoading, error, refetch } = useGetCollectionsQuery({ isActive: true });
    const collections = collectionsData?.data || [];

    return (
        <PageLayout title="Bộ sưu tập" description="Khám phá các bộ sưu tập đặc biệt của chúng tôi">
            <div className="py-10">
                <div className="mb-14 text-center">
                    <h1 className="text-5xl font-black text-neutral-900 dark:text-white mb-6 tracking-tight">
                        Bộ Sưu Tập Của Chúng Tôi
                    </h1>
                    <p className="text-lg text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto leading-relaxed">
                        Mỗi bộ sưu tập là một câu chuyện riêng, mang phong cách và cá tính độc đáo dành cho bạn.
                    </p>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {Array.from({ length: 4 }).map((_, i) => (
                            <div key={i} className="h-80 bg-neutral-100 dark:bg-neutral-800 rounded-3xl animate-pulse" />
                        ))}
                    </div>
                ) : error ? (
                    <ErrorState error={error} onRetry={refetch} />
                ) : collections.length === 0 ? (
                    <div className="text-center py-20">
                         <div className="text-6xl mb-4">🎨</div>
                        <h3 className="text-xl font-bold">Chưa có bộ sưu tập nào</h3>
                        <p className="text-neutral-500">Quay lại sau để khám phá những bộ sưu tập mới</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                        {collections.map((collection: any) => (
                            <Link
                                key={collection.id}
                                to={`/shop?collection=${collection.id}`}
                                className="group relative h-[450px] overflow-hidden rounded-[2.5rem] shadow-2xl hover:shadow-primary-500/20 transition-all duration-700"
                            >
                                <img
                                    src={collection.banner || collection.thumbnail || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=1000&q=80'}
                                    alt={collection.name}
                                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-1000"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent flex flex-col justify-end p-12">
                                    <div className="transform translate-y-6 group-hover:translate-y-0 transition-transform duration-500">
                                        <h3 className="text-4xl font-black text-white mb-4 drop-shadow-2xl">
                                            {collection.name}
                                        </h3>
                                        <p className="text-neutral-300 text-lg mb-8 max-w-md line-clamp-2 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
                                            {collection.description || 'Khám phá bộ sưu tập phong cách mới nhất.'}
                                        </p>
                                        <div className="flex items-center gap-3 text-white font-bold group-hover:gap-5 transition-all">
                                            <span className="bg-white text-black px-8 py-4 rounded-full hover:bg-neutral-100 transition-colors">
                                                Khám phá ngay
                                            </span>
                                            <div className="w-12 h-12 rounded-full border border-white/30 flex items-center justify-center backdrop-blur-sm group-hover:bg-white group-hover:text-black transition-all">
                                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                                                </svg>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </PageLayout>
    );
};

export default CollectionsPage;
