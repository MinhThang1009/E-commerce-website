/// <reference types="jest" />
/**
 * Tests cho useNotifications hook — bao phủ hideNotification (line 25) và clearAllNotifications (line 31).
 * Hai hàm này là wrapper ngắn gọn quanh uiStore, cần test riêng để đạt coverage 100%.
 */
import { act, renderHook } from '@testing-library/react';
import { useUiStore } from '@stores/ui-store';
import { useNotifications } from '@/hooks/use-notifications';

beforeEach(() => {
  useUiStore.setState({
    notifications: [],
    isSearchOpen: false,
    isMobileMenuOpen: false,
    isLoading: false,
  });
  jest.clearAllMocks();
});

describe('useNotifications — showNotification', () => {
  test('showNotification thêm thông báo vào store', () => {
    const { result } = renderHook(() => useNotifications());
    act(() => {
      result.current.showNotification({ message: 'Thông báo', type: 'success', duration: 3000 });
    });
    expect(useUiStore.getState().notifications).toHaveLength(1);
    expect(useUiStore.getState().notifications[0].message).toBe('Thông báo');
  });
});

describe('useNotifications — hideNotification (line 25)', () => {
  test('hideNotification xóa đúng notification theo id', async () => {
    const { result: uiResult } = renderHook(() => useUiStore());
    const { result: notifResult } = renderHook(() => useNotifications());

    act(() => {
      uiResult.current.addNotification({ message: 'A', type: 'info', duration: 3000 });
    });
    await new Promise((r) => setTimeout(r, 2));
    act(() => {
      uiResult.current.addNotification({ message: 'B', type: 'success', duration: 3000 });
    });

    expect(uiResult.current.notifications).toHaveLength(2);
    const idToRemove = uiResult.current.notifications[0].id;

    act(() => {
      notifResult.current.hideNotification(idToRemove);
    });

    expect(uiResult.current.notifications).toHaveLength(1);
    expect(uiResult.current.notifications[0].message).toBe('B');
  });
});

describe('useNotifications — clearAllNotifications (line 31)', () => {
  test('clearAllNotifications xóa toàn bộ notifications', () => {
    const { result: uiResult } = renderHook(() => useUiStore());
    const { result: notifResult } = renderHook(() => useNotifications());

    act(() => {
      uiResult.current.addNotification({ message: 'X', type: 'error', duration: 3000 });
      uiResult.current.addNotification({ message: 'Y', type: 'warning', duration: 3000 });
    });
    expect(uiResult.current.notifications).toHaveLength(2);

    act(() => {
      notifResult.current.clearAllNotifications();
    });

    expect(uiResult.current.notifications).toHaveLength(0);
  });
});
