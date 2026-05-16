import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { buildRoute } from '@/routes/paths';
import { useDebounce } from '@/hooks/useDebounce';
import { useUiStore } from '@/stores/uiStore';
import { useSearchProductsQuery, Product } from '@/features/catalog';
import { useAuth } from '@/features/auth';
import { 
  useSaveSearchMutation, 
  useGetSearchHistoryQuery,
  useDeleteSearchHistoryMutation,
  useClearAllSearchHistoryMutation
} from '@/features/catalog/api/searchHistoryApi';
import { v4 as uuidv4 } from 'uuid';
import { getLocale } from '@/utils/format';

interface SearchBarProps {
  className?: string;
  placeholder?: string;
  onClose?: () => void;
  isExpanded?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  className = '',
  placeholder,
  onClose,
  isExpanded = false,
}) => {
  const { t } = useTranslation();
  const [searchTerm, setSearchTerm] = useState('');
  const [isActive, setIsActive] = useState(isExpanded);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  
  const { isLoggedIn } = useAuth();
  const { mutateAsync: saveSearch } = useSaveSearchMutation();
  const { mutateAsync: deleteSearch } = useDeleteSearchHistoryMutation();
  const { mutateAsync: clearAllSearch } = useClearAllSearchHistoryMutation();
  
  const { data: historyData } = useGetSearchHistoryQuery(
    { limit: 5 },
    { enabled: isActive }
  );
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const toggleSearch = useUiStore((s) => s.toggleSearch);

  // Tải lịch sử tìm kiếm gần đây và session ID khi render lần đầu
  useEffect(() => {
    try {
      // Xử lý Session ID
      let currentSessionId = localStorage.getItem('search_session_id');
      if (!currentSessionId) {
        currentSessionId = uuidv4();
        localStorage.setItem('search_session_id', currentSessionId);
      }
      setSessionId(currentSessionId);

      // Xử lý tìm kiếm cục bộ
      const storedSearches = localStorage.getItem('recentSearches');
      if (storedSearches) {
        const parsedSearches = JSON.parse(storedSearches);
        setRecentSearches(parsedSearches);
      } else {
        localStorage.setItem('recentSearches', JSON.stringify([]));
      }
    } catch (error) {
      console.error('Lỗi tải trạng thái ban đầu của tìm kiếm:', error);
    }
  }, []);

  // Cập nhật recentSearches khi historyData thay đổi (từ server)
  useEffect(() => {
    if (historyData?.data) {
      const serverSearches = historyData.data.map((item: any) => item.keyword);
      // Kết hợp với tìm kiếm cục bộ, loại bỏ trùng lặp
      const localSearches = JSON.parse(localStorage.getItem('recentSearches') || '[]');
      const combined = Array.from(new Set([...serverSearches, ...localSearches])).slice(0, 5);
      setRecentSearches(combined);
    }
  }, [historyData]);

  // Tải lại lịch sử tìm kiếm khi thanh tìm kiếm được mở
  useEffect(() => {
    if (isActive) {
      try {
        const storedSearches = localStorage.getItem('recentSearches');
        if (storedSearches) {
          const parsedSearches = JSON.parse(storedSearches);
          setRecentSearches(parsedSearches);
        }
      } catch (error) {
        console.error('Lỗi tải lại lịch sử tìm kiếm:', error);
      }
    }
  }, [isActive]);

  const searchPlaceholder =
    placeholder || t('header.actions.searchPlaceholder');

  const debouncedSearchTerm = useDebounce(searchTerm, 300);

  // Dùng TanStack Query hook để lấy kết quả tìm kiếm
  const {
    data: searchResults,
    isFetching,
    isError,
  } = useSearchProductsQuery(
    { q: debouncedSearchTerm, limit: 5 },
    {
      enabled: debouncedSearchTerm.length > 1 && isActive,
      staleTime: 0,
    }
  );

  // Lấy gợi ý từ kết quả tìm kiếm
  const suggestions = searchResults?.data || [];

  // Xử lý click bên ngoài để đóng thanh tìm kiếm
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        searchRef.current &&
        !searchRef.current.contains(event.target as Node)
      ) {
        setIsActive(false);
        if (onClose) onClose();
      }
    };

    if (isActive) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
    return undefined;
  }, [onClose, isActive]);

  // Focus vào input khi mở rộng
  useEffect(() => {
    if (isActive && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isActive]);

  const handleSuggestionClick = (id: string) => {
    // Tìm tên sản phẩm để lưu làm từ khóa tìm kiếm
    const product = suggestions.find((p: Product) => p.id === id);
    if (product && product.name) {
      // Lưu tên sản phẩm làm từ khóa tìm kiếm
      saveSearchTerm(product.name);
    }

    navigate(buildRoute.productDetail(id));
    setIsActive(false);
    toggleSearch();
  };

  const toggleSearchBar = () => {
    setIsActive(!isActive);
    toggleSearch();
  };

  // Xóa tất cả lịch sử tìm kiếm gần đây
  const clearRecentSearches = async () => {
    try {
      localStorage.setItem('recentSearches', JSON.stringify([]));
      setRecentSearches([]);
      
      if (isLoggedIn) {
        await clearAllSearch();
      }
      
    } catch (error) {
      console.error('Lỗi xóa lịch sử tìm kiếm:', error);
    }
  };

  // Xóa một từ khóa tìm kiếm
  const removeSearchTerm = async (termToRemove: string) => {
    try {
      const updatedSearches = recentSearches.filter(
        (term) => term !== termToRemove
      );
      localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
      setRecentSearches(updatedSearches);

      if (isLoggedIn && historyData?.data) {
        const itemToDelete = historyData.data.find((item: any) => item.keyword === termToRemove);
        if (itemToDelete) {
          await deleteSearch(itemToDelete.id);
        }
      }

    } catch (error) {
      console.error('Lỗi xóa từ khóa tìm kiếm:', error);
    }
  };

  // Lấy lịch sử tìm kiếm gần đây từ localStorage
  const getRecentSearches = (): string[] => {
    try {
      const recentSearches = localStorage.getItem('recentSearches');
      const parsedSearches = recentSearches ? JSON.parse(recentSearches) : [];
      return parsedSearches;
    } catch (error) {
      console.error('Lỗi lấy lịch sử tìm kiếm:', error);
      return [];
    }
  };

  // Lưu từ khóa tìm kiếm vào localStorage và Server
  const saveSearchTerm = async (term: string, resultsCount: number = 0) => {
    try {
      const storedSearches = getRecentSearches();
      // Thêm vào đầu và xóa trùng lặp
      const updatedSearches = [
        term,
        ...storedSearches.filter((s) => s !== term),
      ].slice(0, 5);
      localStorage.setItem('recentSearches', JSON.stringify(updatedSearches));
      setRecentSearches(updatedSearches);

      // Lưu lên server
      await saveSearch({ 
        keyword: term, 
        resultsCount,
        sessionId: !isLoggedIn ? sessionId : undefined 
      });

    } catch (error) {
      console.error('Lỗi lưu từ khóa tìm kiếm:', error);
    }
  };

  // Xử lý gửi tìm kiếm kèm lưu lịch sử
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      const term = searchTerm.trim();
      const resultsCount = searchResults?.total || 0;
      
      // Lưu từ khóa tìm kiếm
      saveSearchTerm(term, resultsCount);

      // Chuyển đến kết quả tìm kiếm
      navigate(buildRoute.shopSearch(term));
      setIsActive(false);
      toggleSearch();
    }
  };

  return (
    <div ref={searchRef} className={`relative ${className}`}>
      {/* Nút icon tìm kiếm (hiển thị khi thanh tìm kiếm chưa mở) */}
      {!isActive && (
        <button
          onClick={toggleSearchBar}
          className="p-2 rounded-full text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
          aria-label={t('header.actions.search')}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </button>
      )}

      {/* Thanh tìm kiếm mở rộng */}
      {isActive && (
        <div className="absolute right-0 top-0 w-screen max-w-md bg-white dark:bg-neutral-800 rounded-lg shadow-xl overflow-hidden z-50 animate-fadeIn">
          <div className="p-4">
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                ref={inputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={searchPlaceholder}
                className="w-full py-2 pl-10 pr-12 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-neutral-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                autoComplete="off"
              />
              <div className="absolute left-3 top-1/2 transform -translate-y-1/2 text-neutral-500 dark:text-neutral-400">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <div className="absolute right-3 top-1/2 transform -translate-y-1/2 flex space-x-2">
                {searchTerm && (
                  <button
                    type="button"
                    onClick={() => setSearchTerm('')}
                    className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                    aria-label={t('common.clear')}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2M3 12l6.414 6.414a2 2 0 001.414.586H19a2 2 0 002-2V7a2 2 0 00-2-2h-8.172a2 2 0 00-1.414.586L3 12z"
                      />
                    </svg>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setIsActive(false);
                    toggleSearch();
                  }}
                  className="text-neutral-500 dark:text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200"
                  aria-label={t('common.close')}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>
            </form>
          </div>

          {/* Gợi ý tìm kiếm */}
          {(suggestions.length > 0 || isFetching) &&
            debouncedSearchTerm.length > 1 && (
              <div className="border-t border-neutral-200 dark:border-neutral-700 max-h-80 overflow-y-auto">
                {isFetching ? (
                  <div className="p-4 text-center text-neutral-500 dark:text-neutral-400">
                    <div className="inline-block animate-spin rounded-full h-5 w-5 border-t-2 border-neutral-500 dark:border-neutral-400 border-r-2 border-neutral-500 dark:border-neutral-400 mr-2"></div>
                    {t('search.loading')}
                  </div>
                ) : isError ? (
                  <div className="p-4 text-center text-red-500">
                    {t('search.error')}
                  </div>
                ) : suggestions.length === 0 &&
                  debouncedSearchTerm.length > 1 ? (
                  <div className="p-4 text-center text-neutral-500 dark:text-neutral-400">
                    {t('search.noResults')}
                  </div>
                ) : (
                  <ul>
                    {suggestions.map((product: Product) => (
                      <li key={product.id}>
                        <button
                          onClick={() => handleSuggestionClick(product.id)}
                          className="w-full text-left px-4 py-3 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors flex items-center gap-3"
                        >
                          {/* Ảnh thumbnail sản phẩm */}
                          {product.thumbnail && (
                            <div className="w-12 h-12 flex-shrink-0 rounded overflow-hidden border border-neutral-200 dark:border-neutral-700">
                              <img
                                src={product.thumbnail}
                                alt={product.name}
                                className="w-full h-full object-cover"
                                loading="lazy"
                              />
                            </div>
                          )}

                          <div className="flex-1">
                            <p className="text-neutral-900 dark:text-white font-medium line-clamp-1">
                              {product.name}
                            </p>
                            <div className="flex items-center justify-between mt-1">
                              <p className="text-neutral-500 dark:text-neutral-400 text-sm">
                                {product.categoryName}
                              </p>
                              <p className="text-primary-600 dark:text-primary-400 font-medium">
                                {new Intl.NumberFormat(getLocale(), {
                                  style: 'currency',
                                  currency: 'VND',
                                  maximumFractionDigits: 0,
                                }).format(product.price)}
                              </p>
                            </div>
                          </div>
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 text-neutral-400 flex-shrink-0"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </button>
                      </li>
                    ))}

                    {/* Nút xem tất cả kết quả */}
                    {suggestions.length > 0 && (
                      <li className="border-t border-neutral-200 dark:border-neutral-700">
                        <button
                          onClick={handleSearchSubmit}
                          className="w-full text-center px-4 py-3 text-primary-600 dark:text-primary-400 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
                        >
                          {t('search.viewAll')}
                        </button>
                      </li>
                    )}
                  </ul>
                )}
              </div>
            )}

          {/* Tìm kiếm gần đây - lưu bằng localStorage */}
          {searchTerm.length === 0 && (
            <div className="border-t border-neutral-200 dark:border-neutral-700 p-4">
              <div className="flex justify-between items-center mb-2">
                <h3 className="text-sm font-medium text-neutral-500 dark:text-neutral-400">
                  {t('search.recentTitle')}
                </h3>
                {recentSearches.length > 0 && (
                  <button
                    onClick={clearRecentSearches}
                    className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                  >
                    {t('search.clearAll')}
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((term) => (
                  <div key={term} className="inline-flex items-center">
                    <button
                      onClick={() => setSearchTerm(term)}
                      className="px-3 py-1 bg-neutral-100 dark:bg-neutral-700 rounded-l-full text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600 transition-colors"
                    >
                      {term}
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeSearchTerm(term);
                      }}
                      className="p-1 bg-neutral-200 dark:bg-neutral-600 rounded-r-full text-neutral-500 dark:text-neutral-400 hover:bg-neutral-300 dark:hover:bg-neutral-500 transition-colors"
                      aria-label={t('search.remove')}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-3 w-3"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                      >
                        <path
                          fillRule="evenodd"
                          d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                          clipRule="evenodd"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
                {recentSearches.length === 0 && (
                  <p className="text-sm text-neutral-500 dark:text-neutral-400">
                    {t('search.noRecent')}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SearchBar;

