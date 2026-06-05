/// <reference types="jest" />
/**
 * Bổ sung coverage cho shared common components:
 *  - ErrorState / EmptyState (ErrorState.tsx)
 *  - Rating hover handlers (Rating.tsx)
 *  - Button as={Link}/as=custom branches (Button.tsx)
 *  - LoadingSpinner fullScreen branch (LoadingSpinner.tsx)
 *  - PageHero default gradient branch (PageHero.tsx)
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

// ── Mock i18n: t(key) trả về key thô ───────────────────────────
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'vi' } }),
  Trans: ({ children }: { children: unknown }) => children,
}));

// ── Mock lucide-react: mỗi icon là svg có data-testid theo tên ──
jest.mock('lucide-react', () => {
  const R = require('react');
  const makeIcon =
    (name: string) =>
    ({ className }: { className?: string }) =>
      R.createElement('svg', { 'data-testid': name, className: className || '' });
  return {
    ShoppingCart: makeIcon('cart-icon'),
    Search: makeIcon('search-icon'),
    Heart: makeIcon('heart-icon'),
    Package: makeIcon('package-icon'),
    Inbox: makeIcon('inbox-icon'),
  };
});

// ── Mock framer-motion: render thẻ HTML thường ─────────────────
jest.mock('framer-motion', () => {
  const R = require('react');
  const motion = new Proxy(
    {},
    {
      get:
        (_: unknown, tag: string) =>
        ({ children, ...rest }: Record<string, unknown>) => {
          // Bỏ các prop animation không hợp lệ trên DOM
          const {
            initial: _i,
            animate: _a,
            exit: _e,
            variants: _v,
            whileHover: _wh,
            whileInView: _wi,
            whileTap: _wt,
            viewport: _vp,
            transition: _tr,
            ...domProps
          } = rest;
          return R.createElement(tag, domProps, children);
        },
    },
  );
  return {
    __esModule: true,
    motion,
    AnimatePresence: ({ children }: { children: unknown }) => children,
  };
});

// ── Mock getErrorMessage để kiểm soát message hiển thị ─────────
jest.mock('@/utils/error-utils', () => ({
  getErrorMessage: (error: unknown) =>
    typeof error === 'string' ? error : 'Đã xảy ra lỗi không xác định',
}));

// ── Mock motion utils (PageHero import viewportOnce) ───────────
jest.mock('@/utils/motion', () => ({ viewportOnce: { once: true } }));

import { ErrorState, EmptyState } from '@/components/common/ErrorState';
import { Rating } from '@/components/common/Rating';
import Button from '@/components/common/Button';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import PageHero from '@/components/common/PageHero';
import { Link } from 'react-router-dom';
import { MemoryRouter } from 'react-router-dom';

// ═══════════════════════════════════════════════════════════════
// ErrorState
// ═══════════════════════════════════════════════════════════════
describe('ErrorState', () => {
  it('render tiêu đề lỗi + message từ getErrorMessage', () => {
    render(<ErrorState error="Lỗi mạng" />);
    expect(screen.getByText('common.errorTitle')).toBeInTheDocument();
    expect(screen.getByText('Lỗi mạng')).toBeInTheDocument();
  });

  it('mặc định showRetryButton=true nhưng không onRetry → không render nút', () => {
    render(<ErrorState error="x" />);
    expect(screen.queryByText('common.tryAgain')).not.toBeInTheDocument();
  });

  it('có onRetry → render nút thử lại với text mặc định, click gọi onRetry', () => {
    const onRetry = jest.fn();
    render(<ErrorState error="x" onRetry={onRetry} />);
    const btn = screen.getByText('common.tryAgain');
    fireEvent.click(btn);
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('retryText tùy chỉnh → hiển thị thay cho mặc định', () => {
    render(<ErrorState error="x" onRetry={jest.fn()} retryText="Tải lại trang" />);
    expect(screen.getByText('Tải lại trang')).toBeInTheDocument();
    expect(screen.queryByText('common.tryAgain')).not.toBeInTheDocument();
  });

  it('showRetryButton=false → không render nút dù có onRetry', () => {
    render(<ErrorState error="x" onRetry={jest.fn()} showRetryButton={false} />);
    expect(screen.queryByText('common.tryAgain')).not.toBeInTheDocument();
  });

  it.each(['sm', 'md', 'lg'] as const)('size=%s → áp class container tương ứng', (size) => {
    const expectedPy = { sm: 'py-8', md: 'py-12', lg: 'py-16' }[size];
    const { container } = render(<ErrorState error="x" size={size} />);
    expect(container.firstChild).toHaveClass(expectedPy);
  });

  it('className tùy chỉnh được nối vào container', () => {
    const { container } = render(<ErrorState error="x" className="custom-cls" />);
    expect(container.firstChild).toHaveClass('custom-cls');
  });
});

// ═══════════════════════════════════════════════════════════════
// EmptyState
// ═══════════════════════════════════════════════════════════════
describe('EmptyState', () => {
  it('render title', () => {
    render(<EmptyState title="Giỏ hàng trống" />);
    expect(screen.getByText('Giỏ hàng trống')).toBeInTheDocument();
  });

  it('có description → render description', () => {
    render(<EmptyState title="Trống" description="Chưa có sản phẩm nào" />);
    expect(screen.getByText('Chưa có sản phẩm nào')).toBeInTheDocument();
  });

  it('không description → không render đoạn mô tả', () => {
    const { container } = render(<EmptyState title="Trống" />);
    expect(container.querySelector('p')).not.toBeInTheDocument();
  });

  it.each([
    ['cart', 'cart-icon'],
    ['search', 'search-icon'],
    ['wishlist', 'heart-icon'],
    ['orders', 'package-icon'],
    ['generic', 'inbox-icon'],
  ] as const)('variant=%s → render đúng icon mặc định', (variant, testId) => {
    render(<EmptyState title="x" variant={variant} />);
    expect(screen.getByTestId(testId)).toBeInTheDocument();
  });

  it('mặc định variant=generic → render Inbox icon', () => {
    render(<EmptyState title="x" />);
    expect(screen.getByTestId('inbox-icon')).toBeInTheDocument();
  });

  it('truyền icon tùy chỉnh → dùng icon đó thay illustration mặc định', () => {
    render(<EmptyState title="x" icon={<span data-testid="custom-icon">★</span>} />);
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
    expect(screen.queryByTestId('inbox-icon')).not.toBeInTheDocument();
  });

  it('có actionLabel + onAction → render nút và click gọi onAction', () => {
    const onAction = jest.fn();
    render(<EmptyState title="x" actionLabel="Mua sắm ngay" onAction={onAction} />);
    const btn = screen.getByText('Mua sắm ngay');
    fireEvent.click(btn);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('có actionLabel nhưng thiếu onAction → không render nút', () => {
    render(<EmptyState title="x" actionLabel="Mua sắm ngay" />);
    expect(screen.queryByText('Mua sắm ngay')).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// Rating — hover handlers (lines 52-53, 59-60, 82)
// ═══════════════════════════════════════════════════════════════
describe('Rating hover', () => {
  it('interactive + mouseEnter ngôi sao thứ 4 → 4 sao filled (hoverValue)', () => {
    const { container } = render(<Rating value={1} interactive onChange={jest.fn()} />);
    const stars = container.querySelectorAll('svg');
    fireEvent.mouseEnter(stars[3]); // index 4
    const filled = container.querySelectorAll('svg.text-yellow-400');
    expect(filled).toHaveLength(4);
  });

  it('interactive + mouseLeave → reset về value gốc', () => {
    const { container } = render(<Rating value={2} interactive onChange={jest.fn()} />);
    const stars = container.querySelectorAll('svg');
    const starsRow = stars[0].parentElement!;
    fireEvent.mouseEnter(stars[4]); // hover sao 5
    expect(container.querySelectorAll('svg.text-yellow-400')).toHaveLength(5);
    fireEvent.mouseLeave(starsRow);
    // Sau khi rời chuột → quay lại value=2
    expect(container.querySelectorAll('svg.text-yellow-400')).toHaveLength(2);
  });

  it('không interactive + mouseEnter → không đổi hover (giữ nguyên value)', () => {
    const { container } = render(<Rating value={3} />);
    const stars = container.querySelectorAll('svg');
    fireEvent.mouseEnter(stars[4]);
    expect(container.querySelectorAll('svg.text-yellow-400')).toHaveLength(3);
  });

  it('readOnly ghi đè interactive → click không gọi onChange', () => {
    const onChange = jest.fn();
    const { container } = render(<Rating value={2} interactive readOnly onChange={onChange} />);
    const stars = container.querySelectorAll('svg');
    fireEvent.click(stars[4]);
    fireEvent.mouseEnter(stars[4]);
    expect(onChange).not.toHaveBeenCalled();
    // hover bị chặn vì isInteractive=false
    expect(container.querySelectorAll('svg.text-yellow-400')).toHaveLength(2);
  });

  it('readonly (lowercase) alias cũng vô hiệu hóa interactive', () => {
    const onChange = jest.fn();
    const { container } = render(<Rating value={2} interactive readonly onChange={onChange} />);
    const stars = container.querySelectorAll('svg');
    fireEvent.click(stars[0]);
    expect(onChange).not.toHaveBeenCalled();
  });
});

// ═══════════════════════════════════════════════════════════════
// Button — as={Link} và as=custom (lines 82, 95-96)
// ═══════════════════════════════════════════════════════════════
describe('Button polymorphic', () => {
  it('as={Link} + to → render thẻ <a> với href và class', () => {
    render(
      <MemoryRouter>
        <Button as={Link} to="/shop" variant="primary">
          Đến cửa hàng
        </Button>
      </MemoryRouter>,
    );
    const link = screen.getByText('Đến cửa hàng').closest('a');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/shop');
    expect(link).toHaveClass('btn-primary');
  });

  it('as=custom component → render component đó với class', () => {
    const Custom = ({
      children,
      className,
    }: {
      children?: React.ReactNode;
      className?: string;
    }) => (
      <section data-testid="custom-el" className={className}>
        {children}
      </section>
    );
    render(
      <Button as={Custom} variant="danger">
        Nội dung
      </Button>,
    );
    const el = screen.getByTestId('custom-el');
    expect(el).toBeInTheDocument();
    expect(el).toHaveClass('btn-danger');
    expect(el).toHaveTextContent('Nội dung');
  });

  it('as=custom + isLoading → render spinner trong component tùy chỉnh', () => {
    const Custom = ({ children }: { children?: React.ReactNode }) => <div>{children}</div>;
    const { container } = render(
      <Button as={Custom} isLoading>
        Tải
      </Button>,
    );
    expect(container.querySelector('svg.animate-spin')).toBeInTheDocument();
  });

  it('as={Link} nhưng thiếu to → fallback về button thường', () => {
    render(
      <MemoryRouter>
        <Button as={Link}>Không có to</Button>
      </MemoryRouter>,
    );
    // Không có to → bỏ qua nhánh Link, rơi vào nhánh as=custom (Link component)
    expect(screen.getByText('Không có to')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// LoadingSpinner — fullScreen (line 48)
// ═══════════════════════════════════════════════════════════════
describe('LoadingSpinner fullScreen', () => {
  it('fullScreen=true → render overlay cố định + text loading', () => {
    const { container } = render(<LoadingSpinner fullScreen />);
    expect(container.querySelector('.fixed.inset-0')).toBeInTheDocument();
    expect(screen.getByText('common.loading')).toBeInTheDocument();
  });

  it('fullScreen=false → chỉ render svg spinner, không overlay', () => {
    const { container } = render(<LoadingSpinner />);
    expect(container.querySelector('.fixed.inset-0')).not.toBeInTheDocument();
    expect(container.querySelector('svg.animate-spin')).toBeInTheDocument();
  });

  it('size alias large → áp w-12 (lg)', () => {
    const { container } = render(<LoadingSpinner size="large" />);
    expect(container.querySelector('svg.w-12')).toBeInTheDocument();
  });

  it('color không hợp lệ → fallback về primary', () => {
    const { container } = render(<LoadingSpinner color="khong-ton-tai" />);
    expect(container.querySelector('svg.text-primary-500')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// PageHero — default gradient branch (branch 47)
// ═══════════════════════════════════════════════════════════════
describe('PageHero', () => {
  it('không truyền gradient → dùng gradient primary mặc định', () => {
    const { container } = render(
      <PageHero icon={<span data-testid="hero-icon">i</span>} title="Tiêu đề" />,
    );
    expect(screen.getByText('Tiêu đề')).toBeInTheDocument();
    expect(screen.getByTestId('hero-icon')).toBeInTheDocument();
    // gradient primary chứa class from-primary-700
    expect(container.querySelector('.from-primary-700')).toBeInTheDocument();
  });

  it('gradient=warm → áp gradient warm', () => {
    const { container } = render(<PageHero icon={<span>i</span>} title="T" gradient="warm" />);
    expect(container.querySelector('.from-amber-600')).toBeInTheDocument();
  });

  it('có subtitle/badge/children → render đầy đủ', () => {
    render(
      <PageHero icon={<span>i</span>} title="T" subtitle="Phụ đề" badge="Mới">
        <button>CTA</button>
      </PageHero>,
    );
    expect(screen.getByText('Phụ đề')).toBeInTheDocument();
    expect(screen.getByText('Mới')).toBeInTheDocument();
    expect(screen.getByText('CTA')).toBeInTheDocument();
  });

  it('không subtitle/badge/children → chỉ render title', () => {
    render(<PageHero icon={<span>i</span>} title="Chỉ tiêu đề" />);
    expect(screen.getByText('Chỉ tiêu đề')).toBeInTheDocument();
  });
});
