/// <reference types="jest" />
/**
 * Bổ sung coverage SearchBar.tsx cho các nhánh còn thiếu:
 *  - getRecentSearches khi localStorage trả null (line 205 else → [])
 *  - saveSearchTerm khi isLoggedIn=true (line 228 → sessionId=undefined)
 *  - render khối isError=true (lines 371-373)
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'vi' } }),
}));

const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
}));

jest.mock('@/routes/paths', () => ({
  buildRoute: { shopSearch: (q: string) => `/shop?q=${q}` },
}));

jest.mock('@/hooks/use-debounce', () => ({ useDebounce: (val: string) => val }));

const mockToggleSearch = jest.fn();
jest.mock('@/stores/ui-store', () => ({
  useUiStore: (selector: (s: unknown) => unknown) => selector({ toggleSearch: mockToggleSearch }),
}));

// State điều khiển hook search
const searchState = {
  isLoggedIn: false,
  isError: false,
  isFetching: false,
  suggestions: null as { data: unknown[] } | null,
  historyData: null as { data: { keyword: string; id: string }[] } | null,
};

jest.mock('@/features/auth', () => ({
  useAuth: () => ({ isLoggedIn: searchState.isLoggedIn }),
}));

const mockSaveSearch = jest.fn().mockResolvedValue({});
jest.mock('@/features/catalog', () => ({
  useSearchProductsQuery: () => ({
    data: searchState.suggestions,
    isFetching: searchState.isFetching,
    isError: searchState.isError,
  }),
  useSaveSearchMutation: () => ({ mutateAsync: (...a: unknown[]) => mockSaveSearch(...a) }),
  useGetSearchHistoryQuery: () => ({ data: searchState.historyData }),
  useDeleteSearchHistoryMutation: () => ({ mutateAsync: jest.fn() }),
  useClearAllSearchHistoryMutation: () => ({ mutateAsync: jest.fn() }),
  Product: {},
}));

jest.mock('@/utils/format', () => ({ getLocale: () => 'vi-VN' }));
jest.mock('@/utils/proxy-img', () => ({ proxyImg: (u: string) => u || 'placeholder' }));

Object.defineProperty(globalThis, 'crypto', {
  value: { ...globalThis.crypto, randomUUID: () => 'uuid-fixed' },
  configurable: true,
});

import SearchBar from '@/components/common/SearchBar';

beforeEach(() => {
  jest.clearAllMocks();
  searchState.isLoggedIn = false;
  searchState.isError = false;
  searchState.isFetching = false;
  searchState.suggestions = null;
  searchState.historyData = null;
  (localStorage.getItem as jest.Mock).mockReturnValue(null);
});

describe('SearchBar — nhánh phụ', () => {
  it('isLoggedIn=true + submit → saveSearch không truyền sessionId (line 228)', async () => {
    searchState.isLoggedIn = true;
    // localStorage trả null cho 'recentSearches' → getRecentSearches else branch (line 205)
    (localStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'search_session_id') return 'sess-1';
      return null; // recentSearches → null → parsedSearches = []
    });
    render(<SearchBar isExpanded />);
    const input = screen.getByPlaceholderText('header.actions.searchPlaceholder');
    fireEvent.change(input, { target: { value: 'laptop' } });
    await act(async () => {
      fireEvent.submit(input.closest('form')!);
    });
    expect(mockSaveSearch).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: 'laptop', sessionId: undefined }),
    );
    expect(mockNavigate).toHaveBeenCalledWith('/shop?q=laptop');
  });

  it('isLoggedIn=false + submit → saveSearch truyền sessionId', async () => {
    searchState.isLoggedIn = false;
    (localStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'search_session_id') return 'sess-guest';
      return JSON.stringify([]);
    });
    render(<SearchBar isExpanded />);
    const input = screen.getByPlaceholderText('header.actions.searchPlaceholder');
    fireEvent.change(input, { target: { value: 'chuột' } });
    await act(async () => {
      fireEvent.submit(input.closest('form')!);
    });
    expect(mockSaveSearch).toHaveBeenCalledWith(
      expect.objectContaining({ keyword: 'chuột', sessionId: 'sess-guest' }),
    );
  });

  it('isError=true + có searchTerm > 1 ký tự → hiển thị thông báo lỗi (lines 371-373)', () => {
    searchState.isError = true;
    searchState.isFetching = false;
    // suggestions không rỗng để box render (điều kiện line 364), nhưng isError=true ưu tiên hiển thị lỗi
    searchState.suggestions = { data: [{ id: 'p1', name: 'X' }] };
    (localStorage.getItem as jest.Mock).mockReturnValue(JSON.stringify([]));
    render(<SearchBar isExpanded />);
    const input = screen.getByPlaceholderText('header.actions.searchPlaceholder');
    fireEvent.change(input, { target: { value: 'abc' } });
    expect(screen.getByText('search.error')).toBeInTheDocument();
  });

  // ── historyData truthy + recentSearches null → || '[]' branch (line 84) ──
  it("historyData có data + recentSearches null → fallback '[]' được dùng, không crash", () => {
    searchState.historyData = { data: [{ keyword: 'laptop', id: '1' }] };
    // localStorage.getItem trả null (beforeEach default) → null || '[]' fires
    render(<SearchBar isExpanded />);
    expect(screen.getByPlaceholderText('header.actions.searchPlaceholder')).toBeInTheDocument();
  });

  // ── saveSearchTerm catch: saveSearch mutation throw → catch console.error ──
  it('saveSearch throw → catch block chạy, console.error được gọi, không crash', async () => {
    mockSaveSearch.mockRejectedValueOnce(new Error('network error'));
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    (localStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'search_session_id') return 'sess-1';
      return JSON.stringify([]);
    });
    render(<SearchBar isExpanded />);
    const input = screen.getByPlaceholderText('header.actions.searchPlaceholder');
    fireEvent.change(input, { target: { value: 'keyboard' } });
    await act(async () => {
      fireEvent.submit(input.closest('form')!);
    });
    expect(errorSpy).toHaveBeenCalledWith('Lỗi lưu từ khóa tìm kiếm:', expect.any(Error));
    errorSpy.mockRestore();
  });

  // ── getRecentSearches: localStorage chứa JSON hỏng → JSON.parse throw → catch fallback [] ──
  it('recentSearches là JSON hỏng → submit → getRecentSearches catch chạy, fallback rỗng, không crash', async () => {
    // localStorage trả JSON hỏng cho 'recentSearches' → JSON.parse('{invalid json') throw
    (localStorage.getItem as jest.Mock).mockImplementation((key: string) => {
      if (key === 'recentSearches') return '{invalid json';
      if (key === 'search_session_id') return 'sess-bad';
      return null;
    });
    // Mock console.error để không nhiễu output + assert catch đã chạy
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<SearchBar isExpanded />);
    const input = screen.getByPlaceholderText('header.actions.searchPlaceholder');

    // Submit form → handleSearchSubmit → saveSearchTerm → getRecentSearches (JSON.parse throw → catch)
    fireEvent.change(input, { target: { value: 'tai nghe' } });
    await act(async () => {
      fireEvent.submit(input.closest('form')!);
    });

    // OUTCOME 1: component render OK, không crash. Sau submit isActive=false → search thu lại
    // thành nút icon (aria-label 'header.actions.search'). Sự tồn tại của nút này chứng minh
    // component vẫn mounted/render bình thường, không bị JSON.parse hỏng làm crash.
    expect(screen.getByLabelText('header.actions.search')).toBeInTheDocument();
    // OUTCOME 2: catch chạy → console.error được gọi (getRecentSearches catch log lỗi)
    expect(errorSpy).toHaveBeenCalledWith('Lỗi lấy lịch sử tìm kiếm:', expect.any(Error));
    // OUTCOME 3: getRecentSearches trả [] → saveSearchTerm tiếp tục bình thường, saveSearch được gọi
    expect(mockSaveSearch).toHaveBeenCalledWith(expect.objectContaining({ keyword: 'tai nghe' }));
    // OUTCOME 4: không có recent-search item rác từ JSON hỏng được render
    expect(screen.queryByText('{invalid json')).not.toBeInTheDocument();

    errorSpy.mockRestore();
  });
});
