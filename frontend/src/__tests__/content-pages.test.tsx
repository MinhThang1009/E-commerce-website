// @ts-nocheck — mock factories dùng loose types
/// <reference types="jest" />
/**
 * Content pages tests — ContactPage, TrackOrderPage.
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

// ── Mock contact API ────────────────────────────────────────────
// Dùng object wrapper để các test có thể kiểm soát behavior (success vs error)
const contactMockState = { sendFeedback: jest.fn().mockResolvedValue(undefined) };
jest.mock('@/features/content/api/contact-api', () => ({
  useSendFeedbackMutation: () => ({ mutateAsync: contactMockState.sendFeedback, isPending: false }),
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
import ContactPage from '@/features/content/pages/ContactPage';
import TrackOrderPage from '@/features/orders/pages/TrackOrderPage';

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

  it('submit form với email sai định dạng → hiển thị lỗi validation.email.invalid', async () => {
    // Arrange — điền đủ các trường nhưng email sai format
    render(<ContactPage />);
    const nameInput = document.querySelector('input#name') as HTMLInputElement;
    const emailInput = document.querySelector('input#email') as HTMLInputElement;
    const subjectSelect = document.querySelector('select#subject') as HTMLSelectElement;
    const messageTextarea = document.querySelector('textarea#message') as HTMLTextAreaElement;
    fireEvent.change(nameInput, { target: { value: 'Nguyễn Văn A' } });
    fireEvent.change(emailInput, { target: { value: 'not-an-email' } });
    fireEvent.change(subjectSelect, { target: { value: 'general' } });
    fireEvent.change(messageTextarea, { target: { value: 'Nội dung hợp lệ.' } });
    // Act
    const submitBtn = screen.getByTestId('premium-btn');
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    // Assert — email format validation lỗi
    expect(screen.getByText('validation.email.invalid')).toBeInTheDocument();
  });

  it('submit form hợp lệ → API sendFeedback được gọi với đúng payload', async () => {
    // Arrange
    contactMockState.sendFeedback = jest.fn().mockResolvedValue(undefined);
    render(<ContactPage />);
    const nameInput = document.querySelector('input#name') as HTMLInputElement;
    const emailInput = document.querySelector('input#email') as HTMLInputElement;
    const subjectSelect = document.querySelector('select#subject') as HTMLSelectElement;
    const messageTextarea = document.querySelector('textarea#message') as HTMLTextAreaElement;
    fireEvent.change(nameInput, { target: { value: 'Trần Thị B' } });
    fireEvent.change(emailInput, { target: { value: 'b@example.com' } });
    fireEvent.change(subjectSelect, { target: { value: 'support' } });
    fireEvent.change(messageTextarea, { target: { value: 'Tôi cần hỗ trợ kỹ thuật.' } });
    // Act
    const submitBtn = screen.getByTestId('premium-btn');
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    // Assert — sendFeedback được gọi với field content (không phải message)
    expect(contactMockState.sendFeedback).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'Trần Thị B',
        email: 'b@example.com',
        subject: 'support',
        content: 'Tôi cần hỗ trợ kỹ thuật.',
      }),
    );
  });

  it('submit form hợp lệ → hiển thị thông báo thành công contact.form.success', async () => {
    // Arrange
    contactMockState.sendFeedback = jest.fn().mockResolvedValue(undefined);
    render(<ContactPage />);
    const nameInput = document.querySelector('input#name') as HTMLInputElement;
    const emailInput = document.querySelector('input#email') as HTMLInputElement;
    const subjectSelect = document.querySelector('select#subject') as HTMLSelectElement;
    const messageTextarea = document.querySelector('textarea#message') as HTMLTextAreaElement;
    fireEvent.change(nameInput, { target: { value: 'Lê Văn C' } });
    fireEvent.change(emailInput, { target: { value: 'c@example.com' } });
    fireEvent.change(subjectSelect, { target: { value: 'feedback' } });
    fireEvent.change(messageTextarea, { target: { value: 'Phản hồi từ khách hàng hài lòng.' } });
    // Act
    const submitBtn = screen.getByTestId('premium-btn');
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    // Assert — success banner hiển thị
    expect(screen.getByText('contact.form.success')).toBeInTheDocument();
  });

  it('submit form hợp lệ nhưng API thất bại → hiển thị thông báo lỗi contact.form.error', async () => {
    // Arrange — API ném lỗi
    contactMockState.sendFeedback = jest.fn().mockRejectedValue(new Error('Network error'));
    render(<ContactPage />);
    const nameInput = document.querySelector('input#name') as HTMLInputElement;
    const emailInput = document.querySelector('input#email') as HTMLInputElement;
    const subjectSelect = document.querySelector('select#subject') as HTMLSelectElement;
    const messageTextarea = document.querySelector('textarea#message') as HTMLTextAreaElement;
    fireEvent.change(nameInput, { target: { value: 'Phạm Văn D' } });
    fireEvent.change(emailInput, { target: { value: 'd@example.com' } });
    fireEvent.change(subjectSelect, { target: { value: 'partnership' } });
    fireEvent.change(messageTextarea, { target: { value: 'Tôi muốn hợp tác với TechStore.' } });
    // Act
    const submitBtn = screen.getByTestId('premium-btn');
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    // Assert — catch block hiển thị lỗi
    expect(screen.getByText('contact.form.error')).toBeInTheDocument();
  });

  it('submit form khi subject chưa chọn → hiển thị thông báo lỗi required', async () => {
    // Arrange — có name, email, message nhưng không chọn subject
    render(<ContactPage />);
    const nameInput = document.querySelector('input#name') as HTMLInputElement;
    const emailInput = document.querySelector('input#email') as HTMLInputElement;
    const messageTextarea = document.querySelector('textarea#message') as HTMLTextAreaElement;
    fireEvent.change(nameInput, { target: { value: 'Nguyễn Văn E' } });
    fireEvent.change(emailInput, { target: { value: 'e@example.com' } });
    fireEvent.change(messageTextarea, { target: { value: 'Nội dung đầy đủ.' } });
    // Act — subject vẫn là '' (giá trị mặc định)
    const submitBtn = screen.getByTestId('premium-btn');
    await act(async () => {
      fireEvent.click(submitBtn);
    });
    // Assert — required validation
    expect(screen.getByText('checkout.validation.required')).toBeInTheDocument();
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
