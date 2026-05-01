import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetBrandsQuery } from '@/services/brandApi';
import { PageLayout } from '@/components/layout/PageLayout';
import { ErrorState } from '@/components/common/ErrorState';

const BrandsPage: React.FC = () => {
    const { data: brandsData, isLoading, error, refetch } = useGetBrandsQuery({ isActive: true });
    const [searchTerm, setSearchTerm] = useState('');

    const brands = brandsData?.data || [];
    const filteredBrands = brands.filter((brand: any) =>
        brand.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <PageLayout title="Thương hiệu" description="Khám phá các thương hiệu hàng đầu">
            <div className="py-10">
                <div className="mb-10 text-center">
                    <h1 className="text-4xl font-extrabold text-neutral-900 dark:text-white mb-4">
                        Thương hiệu của chúng tôi
                    </h1>
                    <p className="text-neutral-600 dark:text-neutral-400 max-w-2xl mx-auto mb-8">
                        Chúng tôi hợp tác với những thương hiệu hàng đầu để mang đến cho bạn những sản phẩm chất lượng nhất.
                    </p>
                    <div className="max-w-md mx-auto relative">
                         <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Tìm kiếm thương hiệu..."
                            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 focus:ring-2 focus:ring-primary-500 transition-all shadow-sm"
                        />
                        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                </div>

                {isLoading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-6">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <div key={i} className="h-32 bg-neutral-100 dark:bg-neutral-800 rounded-2xl animate-pulse" />
                        ))}
                    </div>
                ) : error ? (
                    <ErrorState error={error} onRetry={refetch} />
                ) : filteredBrands.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-6xl mb-4">🏪</div>
                        <h3 className="text-xl font-bold">Không tìm thấy thương hiệu nào</h3>
                        <p className="text-neutral-500">Thử tìm kiếm với từ khóa khác</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-6">
                        {filteredBrands.map((brand: any) => (
                            <Link
                                key={brand.id}
                                to={`/shop?brand=${brand.id}`}
                                className="group bg-white dark:bg-neutral-900 border border-neutral-100 dark:border-neutral-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center hover:shadow-xl hover:border-primary-500/30 transition-all duration-300"
                            >
                                <div className="h-20 flex items-center justify-center mb-4 transition-transform group-hover:scale-110 duration-500">
                                    {brand.logo ? (
                                        <img src={brand.logo} alt={brand.name} className="max-h-full max-w-full grayscale group-hover:grayscale-0 transition-all duration-300" />
                                    ) : (
                                        <div className="w-16 h-16 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 flex items-center justify-center text-2xl font-bold">
                                            {brand.name.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <h3 className="font-bold text-neutral-900 dark:text-white group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors">
                                    {brand.name}
                                </h3>
                                <p className="text-xs text-neutral-500 mt-2 line-clamp-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    Xem sản phẩm
                                </p>
                            </Link>
                        ))}
                    </div>
                )}
            </div>
        </PageLayout>
    );
};

export default BrandsPage;
