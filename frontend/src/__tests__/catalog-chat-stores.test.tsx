/// <reference types="jest" />
/**
 * Frontend unit tests — Catalog Store + Chat Store.
 * Test Zustand state management cho filters, recently viewed, compare list, và AI chat.
 */
import { act, renderHook } from '@testing-library/react';
import { useCatalogStore } from '@stores/catalog-store';
import {
  useChatStore,
  createSessionId,
  saveMessagesToStorage,
  saveSessionIdToStorage,
} from '@stores/chat-store';

// ── Helpers ───────────────────────────────────────────────────────────────────

const makeProduct = (id: string, overrides = {}) =>
  ({
    id,
    name: `Sản phẩm ${id}`,
    slug: `san-pham-${id}`,
    price: 1000000,
    compareAtPrice: null,
    thumbnail: '',
    images: [],
    description: '',
    categoryId: 'cat1',
    categoryName: 'Laptop',
    stock: 5,
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
    ...overrides,
  }) as any;

const makeMessage = (id: string, sender: 'user' | 'ai' = 'user') =>
  ({
    id,
    text: `Tin nhắn ${id}`,
    sender,
  }) as any;

// ── Reset stores giữa tests ───────────────────────────────────────────────────

const INITIAL_FILTERS = {
  priceRange: [0, 10000000] as [number, number],
  categories: [],
  attributes: {},
  sortBy: 'newest',
};

beforeEach(() => {
  useCatalogStore.setState({
    recentlyViewed: [],
    compareList: [],
    filters: { ...INITIAL_FILTERS },
  });
  useChatStore.setState({
    messages: [],
    isOpen: false,
    sessionId: 'test-session',
    chatHistory: {},
  });
  jest.clearAllMocks();
});

// ═══════════════════════════════════════════════════════════════════════════════
// CATALOG STORE
// ═══════════════════════════════════════════════════════════════════════════════

// ── setFilters / clearFilters ──────────────────────────────────────────────────

describe('catalogStore — filters', () => {
  test('setPriceRange cập nhật priceRange', () => {
    const { result } = renderHook(() => useCatalogStore());

    act(() => {
      result.current.setPriceRange([500000, 5000000]);
    });

    expect(result.current.filters.priceRange).toEqual([500000, 5000000]);
  });

  test('setCategories cập nhật categories', () => {
    const { result } = renderHook(() => useCatalogStore());

    act(() => {
      result.current.setCategories(['laptop', 'gaming']);
    });

    expect(result.current.filters.categories).toEqual(['laptop', 'gaming']);
  });

  test('setAttributes cập nhật attributes', () => {
    const { result } = renderHook(() => useCatalogStore());

    act(() => {
      result.current.setAttributes({ ram: ['8GB', '16GB'], storage: ['512GB'] });
    });

    expect(result.current.filters.attributes).toEqual({ ram: ['8GB', '16GB'], storage: ['512GB'] });
  });

  test('setSortBy cập nhật sortBy', () => {
    const { result } = renderHook(() => useCatalogStore());

    act(() => {
      result.current.setSortBy('price-asc');
    });

    expect(result.current.filters.sortBy).toBe('price-asc');
  });

  test('clearFilters reset về giá trị ban đầu', () => {
    const { result } = renderHook(() => useCatalogStore());

    act(() => {
      result.current.setPriceRange([100000, 2000000]);
      result.current.setCategories(['laptop']);
      result.current.setSortBy('price-desc');
      result.current.clearFilters();
    });

    expect(result.current.filters).toEqual(INITIAL_FILTERS);
  });
});

// ── addToRecentlyViewed ────────────────────────────────────────────────────────

describe('catalogStore — addToRecentlyViewed', () => {
  test('thêm sản phẩm vào đầu danh sách', () => {
    const { result } = renderHook(() => useCatalogStore());

    act(() => {
      result.current.addToRecentlyViewed(makeProduct('1'));
      result.current.addToRecentlyViewed(makeProduct('2'));
    });

    // Sản phẩm thêm sau nằm đầu
    expect(result.current.recentlyViewed[0].id).toBe('2');
    expect(result.current.recentlyViewed[1].id).toBe('1');
  });

  test('dedup: thêm sản phẩm đã có → đưa lên đầu, không tạo bản sao', () => {
    const { result } = renderHook(() => useCatalogStore());

    act(() => {
      result.current.addToRecentlyViewed(makeProduct('1'));
      result.current.addToRecentlyViewed(makeProduct('2'));
      result.current.addToRecentlyViewed(makeProduct('1')); // p1 xem lại
    });

    expect(result.current.recentlyViewed).toHaveLength(2);
    expect(result.current.recentlyViewed[0].id).toBe('1'); // p1 lên đầu
    expect(result.current.recentlyViewed[1].id).toBe('2');
  });

  test('giới hạn MAX_RECENTLY_VIEWED = 10', () => {
    const { result } = renderHook(() => useCatalogStore());

    act(() => {
      // Thêm 12 sản phẩm khác nhau
      for (let i = 1; i <= 12; i++) {
        result.current.addToRecentlyViewed(makeProduct(String(i)));
      }
    });

    expect(result.current.recentlyViewed).toHaveLength(10);
    // Sản phẩm 12 (mới nhất) ở đầu
    expect(result.current.recentlyViewed[0].id).toBe('12');
    // Sản phẩm 1 và 2 (cũ nhất) đã bị loại
    const ids = result.current.recentlyViewed.map((p) => p.id);
    expect(ids).not.toContain('1');
    expect(ids).not.toContain('2');
  });

  test('lưu vào localStorage sau mỗi lần thêm', () => {
    const { result } = renderHook(() => useCatalogStore());
    const p = makeProduct('42');

    act(() => {
      result.current.addToRecentlyViewed(p);
    });

    expect(localStorage.setItem).toHaveBeenCalledWith(
      'recentlyViewed',
      expect.stringContaining('"id":"42"'),
    );
  });
});

// ── addToCompareList / removeFromCompareList / clearCompareList ───────────────

describe('catalogStore — compareList', () => {
  test('addToCompareList thêm sản phẩm', () => {
    const { result } = renderHook(() => useCatalogStore());

    act(() => {
      result.current.addToCompareList(makeProduct('a'));
    });

    expect(result.current.compareList).toHaveLength(1);
    expect(result.current.compareList[0].id).toBe('a');
  });

  test('addToCompareList không thêm trùng', () => {
    const { result } = renderHook(() => useCatalogStore());

    act(() => {
      result.current.addToCompareList(makeProduct('a'));
      result.current.addToCompareList(makeProduct('a')); // thêm lại
    });

    expect(result.current.compareList).toHaveLength(1);
  });

  test('giới hạn tối đa 4 sản phẩm — sản phẩm thứ 5 bị bỏ qua', () => {
    const { result } = renderHook(() => useCatalogStore());

    act(() => {
      for (let i = 1; i <= 5; i++) {
        result.current.addToCompareList(makeProduct(String(i)));
      }
    });

    expect(result.current.compareList).toHaveLength(4);
  });

  test('removeFromCompareList xóa đúng sản phẩm', () => {
    const { result } = renderHook(() => useCatalogStore());

    act(() => {
      result.current.addToCompareList(makeProduct('x'));
      result.current.addToCompareList(makeProduct('y'));
      result.current.removeFromCompareList('x');
    });

    expect(result.current.compareList).toHaveLength(1);
    expect(result.current.compareList[0].id).toBe('y');
  });

  test('clearCompareList xóa tất cả', () => {
    const { result } = renderHook(() => useCatalogStore());

    act(() => {
      result.current.addToCompareList(makeProduct('1'));
      result.current.addToCompareList(makeProduct('2'));
      result.current.clearCompareList();
    });

    expect(result.current.compareList).toHaveLength(0);
  });
});

// ── clearRecentlyViewed ────────────────────────────────────────────────────────

describe('catalogStore — clearRecentlyViewed', () => {
  test('xóa tất cả sản phẩm đã xem gần đây khỏi state', () => {
    const { result } = renderHook(() => useCatalogStore());

    act(() => {
      result.current.addToRecentlyViewed(makeProduct('r1'));
      result.current.addToRecentlyViewed(makeProduct('r2'));
      result.current.clearRecentlyViewed();
    });

    expect(result.current.recentlyViewed).toHaveLength(0);
  });

  test('gọi localStorage.removeItem("recentlyViewed") khi xóa', () => {
    const { result } = renderHook(() => useCatalogStore());

    act(() => {
      result.current.addToRecentlyViewed(makeProduct('r3'));
      result.current.clearRecentlyViewed();
    });

    expect(localStorage.removeItem).toHaveBeenCalledWith('recentlyViewed');
  });
});

// ── loadRecentlyViewed ─────────────────────────────────────────────────────────

describe('catalogStore — loadRecentlyViewed', () => {
  test('load từ localStorage vào state', () => {
    const products = [makeProduct('p1'), makeProduct('p2')];
    (localStorage.getItem as jest.Mock).mockReturnValueOnce(JSON.stringify(products));

    const { result } = renderHook(() => useCatalogStore());

    act(() => {
      result.current.loadRecentlyViewed();
    });

    expect(result.current.recentlyViewed).toHaveLength(2);
    expect(result.current.recentlyViewed[0].id).toBe('p1');
  });

  test('localStorage null → không thay đổi state', () => {
    (localStorage.getItem as jest.Mock).mockReturnValueOnce(null);

    const { result } = renderHook(() => useCatalogStore());

    act(() => {
      result.current.loadRecentlyViewed();
    });

    expect(result.current.recentlyViewed).toHaveLength(0);
  });

  test('localStorage chứa JSON không hợp lệ → state reset về mảng rỗng (catch branch)', () => {
    // Arrange — JSON parse sẽ throw SyntaxError
    (localStorage.getItem as jest.Mock).mockReturnValueOnce('invalid-json{{{');

    const { result } = renderHook(() => useCatalogStore());

    // Đặt sẵn dữ liệu trong state để xác nhận nó bị xóa sau lỗi parse
    act(() => {
      result.current.addToRecentlyViewed(makeProduct('existing'));
    });

    act(() => {
      result.current.loadRecentlyViewed();
    });

    // Assert — catch block đặt recentlyViewed = []
    expect(result.current.recentlyViewed).toHaveLength(0);
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// CHAT STORE
// ═══════════════════════════════════════════════════════════════════════════════

// ── addMessage / clearMessages ────────────────────────────────────────────────

describe('chatStore — addMessage', () => {
  test('thêm message vào cuối danh sách', () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      result.current.addMessage(makeMessage('m1', 'user'));
      result.current.addMessage(makeMessage('m2', 'ai'));
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].sender).toBe('user');
    expect(result.current.messages[1].sender).toBe('ai');
  });

  test('clearMessages xóa hết và cập nhật sessionId', () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      result.current.addMessage(makeMessage('m1'));
      result.current.clearMessages('new-session-123');
    });

    expect(result.current.messages).toHaveLength(0);
    expect(result.current.sessionId).toBe('new-session-123');
  });
});

// ── setMessages ───────────────────────────────────────────────────────────────

describe('chatStore — setMessages', () => {
  test('thay thế toàn bộ messages', () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      result.current.addMessage(makeMessage('old1'));
      result.current.setMessages([makeMessage('new1'), makeMessage('new2')]);
    });

    expect(result.current.messages).toHaveLength(2);
    expect(result.current.messages[0].id).toBe('new1');
  });
});

// ── sessionId / toggleChat ────────────────────────────────────────────────────

describe('chatStore — sessionId', () => {
  test('sessionId khác rỗng sau clearMessages', () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      result.current.clearMessages('session-abc');
    });

    expect(result.current.sessionId).toBe('session-abc');
  });
});

describe('chatStore — toggleChat / openChat / closeChat', () => {
  test('toggleChat đổi trạng thái isOpen', () => {
    const { result } = renderHook(() => useChatStore());

    expect(result.current.isOpen).toBe(false);
    act(() => {
      result.current.toggleChat();
    });
    expect(result.current.isOpen).toBe(true);
    act(() => {
      result.current.toggleChat();
    });
    expect(result.current.isOpen).toBe(false);
  });

  test('openChat đặt isOpen = true', () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      result.current.openChat();
    });
    expect(result.current.isOpen).toBe(true);
  });

  test('closeChat đặt isOpen = false', () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      result.current.openChat();
      result.current.closeChat();
    });
    expect(result.current.isOpen).toBe(false);
  });
});

// ── saveChatHistory / loadChatHistory ─────────────────────────────────────────

describe('chatStore — saveChatHistory và loadChatHistory', () => {
  test('saveChatHistory lưu messages theo userId', () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      result.current.addMessage(makeMessage('m1', 'user'));
      result.current.saveChatHistory('user-99');
    });

    expect(result.current.chatHistory['user-99']).toHaveLength(1);
    expect(result.current.chatHistory['user-99'][0].id).toBe('m1');
  });

  test('saveChatHistory không lưu khi messages rỗng', () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      result.current.saveChatHistory('user-99');
    });

    expect(result.current.chatHistory['user-99']).toBeUndefined();
  });

  test('loadChatHistory phục hồi messages theo userId', () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      result.current.addMessage(makeMessage('m1'));
      result.current.saveChatHistory('user-1');
      result.current.clearMessages('new-session');
    });

    expect(result.current.messages).toHaveLength(0);

    act(() => {
      result.current.loadChatHistory('user-1');
    });

    expect(result.current.messages).toHaveLength(1);
    expect(result.current.messages[0].id).toBe('m1');
  });

  test('loadChatHistory với userId không tồn tại → messages rỗng', () => {
    const { result } = renderHook(() => useChatStore());

    act(() => {
      result.current.addMessage(makeMessage('m1'));
      result.current.loadChatHistory('ghost-user');
    });

    expect(result.current.messages).toHaveLength(0);
  });
});

// ── createSessionId ────────────────────────────────────────────────────────────

describe('createSessionId', () => {
  test('trả về chuỗi không rỗng', () => {
    const id = createSessionId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  test('hai lần gọi tạo ID khác nhau (entropy)', () => {
    // crypto.randomUUID() luôn unique, hoặc fallback Date.now() + random
    const id1 = createSessionId();
    const id2 = createSessionId();
    // Rất khó trùng — nếu trùng thì có bug thực sự
    expect(id1).not.toBe(id2);
  });
});

// ── localStorage persistence ──────────────────────────────────────────────────

describe('chatStore — localStorage persistence (saveMessagesToStorage)', () => {
  test('saveMessagesToStorage lưu messages vào localStorage', () => {
    const messages = [makeMessage('m1'), makeMessage('m2')];

    saveMessagesToStorage(messages);

    expect(localStorage.setItem).toHaveBeenCalledWith('chat_messages', JSON.stringify(messages));
  });

  test('saveSessionIdToStorage lưu sessionId vào localStorage', () => {
    saveSessionIdToStorage('session-xyz');

    expect(localStorage.setItem).toHaveBeenCalledWith('chat_session_id', 'session-xyz');
  });
});
