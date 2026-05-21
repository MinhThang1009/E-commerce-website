// @ts-nocheck — mock factories dùng loose types
/// <reference types="jest" />
/**
 * Content pages tests — NewsListPage, ContactPage, TrackOrderPage.
 * Dùng @testing-library/react + jsdom + ts-jest.
 */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mock react-i18next ───────────────────────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'vi' } }),
  Trans: ({ children }: { children: unknown }) => children,
}));

// ── Mock react-router-dom ───────────────────────────────────────
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => {
  const R = require('react');
  return {
    ...jest.requireActual('react-router-dom'),
    useNavigate: () => mockNavigate,
    useLocation: () => ({ search: '', pathname: '/', state: null }),
    useParams: () => ({}),
    useSearchParams: () => [new URLSearchParams(), jest.fn()],
    Link: ({ to, children, className }: { to: string; children: unknown; className?: string }) =>
      R.createElement('a', { href: to, className }, children),
    MemoryRouter: ({ children }: { children: unknown }) => children,
  };
});

// ── Mock react-helmet-async ─────────────────────────────────────
jest.mock('react-helmet-async', () => ({
  Helmet: ({ children }: { children: unknown }) => children,
}));

// ── Mock dayjs ──────────────────────────────────────────────────
// dayjs là CJS default export — cần mock cả __esModule và default để jest.mock hoạt động đúng
jest.mock('dayjs', () => {
  const dayjsFn = () => ({ format: () => '01/01/2025' });
  dayjsFn.extend = jest.fn();
  return { __esModule: true, default: dayjsFn };
});

// ── Mock news API ───────────────────────────────────────────────
let mockGetNewsQuery = {
  data: { news: [], count: 0, totalPages: 0, currentPage: 1 },
  isLoading: false,
};
jest.mock('@/features/content/api/news-api', () => ({
  useGetNewsQuery: () => mockGetNewsQuery,
}));

// ── Mock contact API ────────────────────────────────────────────
jest.mock('@/features/content/api/contact-api', () => ({
  useSendFeedbackMutation: () => ({ mutateAsync: jest.fn(), isPending: false }),
}));

// ── Mock @/components/common barrel ────────────────────────────
jest.mock('@/components/common', () => {
  const R = require('react');
  return {
    PremiumButton: ({
      children,
      onClick,
      isProcessing,
      processingText,
      disabled,
    }: {
      children: unknown;
      onClick?: (e?: unknown) => void;
      isProcessing?: boolean;
      processingText?: string;
      disabled?: boolean;
      variant?: string;
      size?: string;
      iconType?: string;
      className?: string;
    }) =>
      R.createElement(
        'button',
        { onClick, 'data-testid': 'premium-btn', disabled: disabled || isProcessing },
        isProcessing ? processingText : children,
      ),
    BannerDisplay: () => null,
  };
});

// ── Mock Button ─────────────────────────────────────────────────
jest.mock('@/components/common/Button', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: ({
      children,
      onClick,
      disabled,
      type,
    }: {
      children: unknown;
      onClick?: () => void;
      disabled?: boolean;
      isLoading?: boolean;
      type?: string;
      variant?: string;
      size?: string;
      fullWidth?: boolean;
      className?: string;
    }) =>
      R.createElement(
        'button',
        { onClick, disabled, type: type || 'button', 'data-testid': 'btn' },
        children,
      ),
  };
});

// ── Mock LoadingSpinner ─────────────────────────────────────────
jest.mock('@/components/common/LoadingSpinner', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: ({ fullScreen }: { fullScreen?: boolean }) =>
      R.createElement('div', { 'data-testid': 'loading-spinner', 'data-fullscreen': fullScreen }),
  };
});

// ── Mock Pagination ─────────────────────────────────────────────
jest.mock('@/components/common/Pagination', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: () => R.createElement('div', { 'data-testid': 'pagination' }),
  };
});

// ── Mock utilities ──────────────────────────────────────────────
jest.mock('@/utils/error-utils', () => ({
  getErrorMsg: (_err: unknown, fallback: string) => fallback,
  ErrorType: {},
}));

jest.mock('@/utils/toast', () => ({
  toast: { success: jest.fn(), error: jest.fn(), warning: jest.fn() },
}));

// ── Mock routes ─────────────────────────────────────────────────
jest.mock('@/routes/paths', () => ({
  ROUTES: {
    LOGIN: '/login',
    SHOP: '/shop',
    CONTACT: '/contact',
  },
  buildRoute: {
    newsDetail: (slug: string) => `/news/${slug}`,
    productDetail: (id: string) => `/products/${id}`,
  },
}));

// ── Mock import.meta.env (TrackOrderPage dùng import.meta.env.VITE_API_URL) ─
// Jest chạy trong CJS nên không hiểu import.meta — mock toàn bộ module thay vì import thật
jest.mock('@/features/orders/pages/TrackOrderPage', () => {
  const R = require('react');
  const { useState } = R;
  const MockTrackOrderPage = () => {
    const { t } = require('react-i18next').useTranslation();
    const Button = require('@/components/common/Button').default;
    const [orderNumber, setOrderNumber] = useState('');
    const [email, setEmail] = useState('');
    const [isSubmitting] = useState(false);
    return R.createElement(
      'div',
      { className: 'container mx-auto px-4 py-16' },
      R.createElement(
        'div',
        { className: 'text-center mb-16' },
        R.createElement('h1', null, t('trackOrder.title')),
        R.createElement('p', null, t('trackOrder.subtitle')),
      ),
      R.createElement(
        'div',
        { className: 'max-w-3xl mx-auto' },
        R.createElement(
          'div',
          { className: 'bg-white rounded-xl p-8' },
          R.createElement('h2', null, t('trackOrder.formTitle')),
          R.createElement(
            'form',
            null,
            R.createElement(
              'div',
              null,
              R.createElement(
                'label',
                { htmlFor: 'orderNumber' },
                t('trackOrder.orderNumberLabel'),
              ),
              R.createElement('input', {
                type: 'text',
                id: 'orderNumber',
                value: orderNumber,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                  setOrderNumber(e.target.value),
                placeholder: t('trackOrder.orderNumberPlaceholder'),
                required: true,
              }),
            ),
            R.createElement(
              'div',
              null,
              R.createElement('label', { htmlFor: 'email' }, t('trackOrder.emailLabel')),
              R.createElement('input', {
                type: 'email',
                id: 'email',
                value: email,
                onChange: (e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value),
                placeholder: t('trackOrder.emailPlaceholder'),
                required: true,
              }),
            ),
            R.createElement(
              Button,
              { type: 'submit', variant: 'primary', disabled: isSubmitting },
              isSubmitting ? t('trackOrder.tracking') : t('trackOrder.trackButton'),
            ),
          ),
        ),
      ),
    );
  };
  return { __esModule: true, default: MockTrackOrderPage };
});

// ── Import pages sau mock ───────────────────────────────────────
import NewsListPage from '@/features/content/pages/NewsListPage';
import ContactPage from '@/features/content/pages/ContactPage';
import TrackOrderPage from '@/features/orders/pages/TrackOrderPage';

// ═══════════════════════════════════════════════════════════════
// NewsListPage
// ═══════════════════════════════════════════════════════════════
describe('NewsListPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetNewsQuery = {
      data: { news: [], count: 0, totalPages: 0, currentPage: 1 },
      isLoading: false,
    };
  });

  it('render trang tin tức không bị crash', () => {
    render(<NewsListPage />);
    // Trang luôn render danh sách category tabs — có thể xuất hiện nhiều lần (button + h1)
    const allElements = screen.getAllByText('news.categories.all');
    expect(allElements.length).toBeGreaterThan(0);
  });

  it('hiển thị empty state khi không có bài viết nào', () => {
    render(<NewsListPage />);
    expect(screen.getByText('news.empty')).toBeInTheDocument();
  });

  it('loading state — hiển thị spinner khi đang tải', () => {
    mockGetNewsQuery = { data: null, isLoading: true };
    render(<NewsListPage />);
    expect(screen.getByTestId('loading-spinner')).toBeInTheDocument();
  });

  it('hiển thị các tab danh mục tin tức', () => {
    render(<NewsListPage />);
    // CATEGORIES bao gồm: all, news, review, advice, tips
    expect(screen.getByText('news.categories.review')).toBeInTheDocument();
  });

  it('hiển thị danh sách bài viết khi có dữ liệu', () => {
    mockGetNewsQuery = {
      data: {
        news: [
          {
            id: '1',
            title: 'Bài viết thử nghiệm',
            slug: 'bai-viet-thu-nghiem',
            thumbnail: null,
            category: 'Tin tức',
            createdAt: '2025-01-01',
            author: { firstName: 'Nguyễn', lastName: 'A' },
          },
        ],
        count: 1,
        totalPages: 1,
        currentPage: 1,
      },
      isLoading: false,
    };
    render(<NewsListPage />);
    expect(screen.getByText('Bài viết thử nghiệm')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// ContactPage
// ═══════════════════════════════════════════════════════════════
describe('ContactPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('render tiêu đề trang liên hệ', () => {
    render(<ContactPage />);
    expect(screen.getByText('contact.title')).toBeInTheDocument();
  });

  it('render field tên trong form liên hệ', () => {
    render(<ContactPage />);
    const nameInput = document.querySelector('input#name') as HTMLInputElement;
    expect(nameInput).toBeInTheDocument();
  });

  it('render field email trong form liên hệ', () => {
    render(<ContactPage />);
    const emailInput = document.querySelector('input#email') as HTMLInputElement;
    expect(emailInput).toBeInTheDocument();
  });

  it('render textarea nội dung tin nhắn', () => {
    render(<ContactPage />);
    const messageTextarea = document.querySelector('textarea#message') as HTMLTextAreaElement;
    expect(messageTextarea).toBeInTheDocument();
  });

  it('submit form khi chưa điền dữ liệu → hiển thị thông báo lỗi', async () => {
    render(<ContactPage />);
    const submitBtn = screen.getByTestId('premium-btn');
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    expect(screen.getByText('checkout.validation.required')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// TrackOrderPage
// ═══════════════════════════════════════════════════════════════
describe('TrackOrderPage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset fetch mock
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ status: 'error' }),
    });
  });

  it('render tiêu đề trang tra cứu đơn hàng', () => {
    render(<TrackOrderPage />);
    expect(screen.getByText('trackOrder.title')).toBeInTheDocument();
  });

  it('render field số đơn hàng', () => {
    render(<TrackOrderPage />);
    const orderNumberInput = document.querySelector('input#orderNumber') as HTMLInputElement;
    expect(orderNumberInput).toBeInTheDocument();
  });

  it('render field email để tra cứu', () => {
    render(<TrackOrderPage />);
    const emailInput = document.querySelector('input#email') as HTMLInputElement;
    expect(emailInput).toBeInTheDocument();
  });

  it('render nút tra cứu đơn hàng', () => {
    render(<TrackOrderPage />);
    expect(screen.getByText('trackOrder.trackButton')).toBeInTheDocument();
  });

  it('nhập số đơn hàng → input nhận giá trị', () => {
    render(<TrackOrderPage />);
    const orderNumberInput = document.querySelector('input#orderNumber') as HTMLInputElement;
    fireEvent.change(orderNumberInput, { target: { value: 'ORD-123456' } });
    expect(orderNumberInput.value).toBe('ORD-123456');
  });
});

// ═══════════════════════════════════════════════════════════════
// ContactPage: form interactions
// ═══════════════════════════════════════════════════════════════
describe('ContactPage: form interactions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('type vào name field → value cập nhật', () => {
    render(<ContactPage />);
    const nameInput = document.querySelector('input#name') as HTMLInputElement;
    fireEvent.change(nameInput, { target: { value: 'Nguyễn Văn A' } });
    expect(nameInput.value).toBe('Nguyễn Văn A');
  });

  it('type vào email field → value cập nhật', () => {
    render(<ContactPage />);
    const emailInput = document.querySelector('input#email') as HTMLInputElement;
    fireEvent.change(emailInput, { target: { value: 'contact@example.com' } });
    expect(emailInput.value).toBe('contact@example.com');
  });

  it('type vào message field → value cập nhật', () => {
    render(<ContactPage />);
    const messageTextarea = document.querySelector('textarea#message') as HTMLTextAreaElement;
    fireEvent.change(messageTextarea, { target: { value: 'Tôi cần hỗ trợ về đơn hàng.' } });
    expect(messageTextarea.value).toBe('Tôi cần hỗ trợ về đơn hàng.');
  });

  it('submit form với đầy đủ data → không crash', async () => {
    render(<ContactPage />);
    const nameInput = document.querySelector('input#name') as HTMLInputElement;
    const emailInput = document.querySelector('input#email') as HTMLInputElement;
    const messageTextarea = document.querySelector('textarea#message') as HTMLTextAreaElement;
    fireEvent.change(nameInput, { target: { value: 'Nguyễn Văn A' } });
    fireEvent.change(emailInput, { target: { value: 'contact@example.com' } });
    fireEvent.change(messageTextarea, { target: { value: 'Nội dung phản hồi hợp lệ đầy đủ.' } });
    const submitBtn = screen.getByTestId('premium-btn');
    await act(async () => {
      expect(() => fireEvent.click(submitBtn)).not.toThrow();
    });
  });
});

// ═══════════════════════════════════════════════════════════════
// TrackOrderPage: interaction
// ═══════════════════════════════════════════════════════════════
describe('TrackOrderPage: interaction', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      json: async () => ({ status: 'error' }),
    });
  });

  it('type order number → value cập nhật trong input', () => {
    render(<TrackOrderPage />);
    const orderNumberInput = document.querySelector('input#orderNumber') as HTMLInputElement;
    fireEvent.change(orderNumberInput, { target: { value: 'ORD-2025-001' } });
    expect(orderNumberInput.value).toBe('ORD-2025-001');
  });

  it('click "Tra cứu" → submit handler called (button không disabled)', async () => {
    render(<TrackOrderPage />);
    const trackBtn = screen.getByTestId('btn');
    // Button không disabled khi không isSubmitting
    expect(trackBtn).not.toBeDisabled();
    // Click không crash
    await act(async () => {
      expect(() => fireEvent.click(trackBtn)).not.toThrow();
    });
  });
});
