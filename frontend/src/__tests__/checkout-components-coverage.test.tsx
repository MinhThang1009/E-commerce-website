// @ts-nocheck
/// <reference types="jest" />
/**
 * Coverage bổ sung cho 3 checkout sub-components:
 *  - CheckoutOrderSummary: khối availableCodes.map (lines 113-122) eligible/ineligible
 *  - CheckoutPaymentMethod: Dialog onOpenChange (!open → onCloseInstallmentModal, line 82)
 *  - CheckoutStepIndicator: STEP_ICONS[idx] || Check fallback khi >3 bước (line 20)
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'vi' } }),
}));

jest.mock('framer-motion', () => {
  const R = require('react');
  const motion = new Proxy(
    {},
    {
      get:
        (_: unknown, tag: string) =>
        ({ children, ...rest }: Record<string, unknown>) => {
          const {
            initial,
            animate,
            exit,
            variants,
            whileHover,
            whileInView,
            whileTap,
            viewport,
            transition,
            layout,
            layoutId,
            ...dom
          } = rest;
          return R.createElement(tag, dom, children);
        },
    },
  );
  return {
    __esModule: true,
    motion,
    AnimatePresence: ({ children }: { children: unknown }) => children,
  };
});

jest.mock('lucide-react', () => {
  const R = require('react');
  const Icon = (p: Record<string, unknown>) =>
    R.createElement('svg', { 'data-testid': p['data-testid'] || 'icon' });
  return new Proxy({}, { get: () => Icon });
});

jest.mock('@/utils/format', () => ({ formatPrice: (p: number) => `${p}đ` }));

// CartItem dùng trong CheckoutOrderSummary — mock tối giản
jest.mock('@/features/cart', () => {
  const R = require('react');
  return {
    CartItem: ({ item }: { item: { id: string } }) =>
      R.createElement('div', { 'data-testid': `cart-item-${item.id}` }),
  };
});

// PremiumButton + Input dùng trong CheckoutOrderSummary
jest.mock('@/components/common/PremiumButton', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: ({ children, onClick }: { children: unknown; onClick?: () => void }) =>
      R.createElement('button', { onClick, 'data-testid': 'premium-btn' }, children),
  };
});
jest.mock('@/components/common/Input', () => {
  const R = require('react');
  return {
    __esModule: true,
    default: ({
      value,
      onChange,
      placeholder,
    }: {
      value?: string;
      onChange?: (e: unknown) => void;
      placeholder?: string;
    }) =>
      R.createElement('input', {
        value: value ?? '',
        onChange,
        placeholder,
        'data-testid': 'discount-input',
      }),
  };
});

// shadcn Dialog — Root gọi onOpenChange để test nhánh !open
jest.mock('@/components/ui', () => {
  const R = require('react');
  return {
    Button: ({ children, onClick }: { children: unknown; onClick?: () => void }) =>
      R.createElement('button', { onClick }, children),
    Dialog: ({
      children,
      open,
      onOpenChange,
    }: {
      children: unknown;
      open?: boolean;
      onOpenChange?: (o: boolean) => void;
    }) =>
      R.createElement(
        'div',
        { 'data-testid': 'dialog', 'data-open': String(!!open) },
        // Nút giả lập đóng dialog (onOpenChange(false)) và mở (onOpenChange(true))
        R.createElement('button', {
          'data-testid': 'dialog-close',
          onClick: () => onOpenChange && onOpenChange(false),
        }),
        R.createElement('button', {
          'data-testid': 'dialog-open',
          onClick: () => onOpenChange && onOpenChange(true),
        }),
        open ? children : null,
      ),
    DialogContent: ({ children }: { children: unknown }) =>
      R.createElement('div', { role: 'dialog' }, children),
    DialogHeader: ({ children }: { children: unknown }) => R.createElement('div', {}, children),
    DialogTitle: ({ children }: { children: unknown }) => R.createElement('h2', {}, children),
    DialogDescription: ({ children }: { children: unknown }) => R.createElement('p', {}, children),
    DialogFooter: ({ children }: { children: unknown }) => R.createElement('div', {}, children),
  };
});

import CheckoutOrderSummary from '@/features/checkout/components/CheckoutOrderSummary';
import CheckoutPaymentMethod from '@/features/checkout/components/CheckoutPaymentMethod';
import CheckoutStepIndicator from '@/features/checkout/components/CheckoutStepIndicator';

// ═══════════════════════════════════════════════════════════════
// CheckoutOrderSummary — availableCodes chips (lines 113-122)
// ═══════════════════════════════════════════════════════════════
describe('CheckoutOrderSummary — mã giảm giá khả dụng', () => {
  const baseProps = {
    items: [{ id: 'it1', variantId: 'v1' }],
    isRepayingOrder: false,
    currentOrder: null,
    subtotal: 500000,
    shippingCost: 0,
    finalDistance: 0,
    tax: 0,
    total: 500000,
    appliedDiscount: null,
    discountCodeInput: '',
    onDiscountCodeChange: jest.fn(),
    discountError: '',
    isValidatingCode: false,
    availableCodes: [],
    onApplyDiscount: jest.fn(),
    onRemoveDiscount: jest.fn(),
    onSelectDiscountCode: jest.fn(),
    paymentMethod: 'cod',
    isProcessing: false,
    onSubmit: jest.fn(),
  };

  it('hiển thị chip mã percent đủ điều kiện (subtotal >= minOrderAmount) → click gọi onSelectDiscountCode', () => {
    const onSelectDiscountCode = jest.fn();
    render(
      <CheckoutOrderSummary
        {...baseProps}
        onSelectDiscountCode={onSelectDiscountCode}
        availableCodes={
          [
            {
              id: 'c1',
              code: 'SALE10',
              type: 'percent',
              value: 10,
              maxDiscountAmount: 100000,
              minOrderAmount: 100000,
            },
          ] as any
        }
      />,
    );
    const chip = screen.getByText('SALE10');
    const btn = chip.closest('button')!;
    expect(btn).not.toBeDisabled();
    fireEvent.click(btn);
    expect(onSelectDiscountCode).toHaveBeenCalledWith('SALE10');
  });

  it('chip percent không có maxDiscountAmount → label không có phần "(tối đa ...)"', () => {
    render(
      <CheckoutOrderSummary
        {...baseProps}
        availableCodes={
          [
            {
              id: 'c2',
              code: 'PCT5',
              type: 'percent',
              value: 5,
              maxDiscountAmount: null,
              minOrderAmount: null,
            },
          ] as any
        }
      />,
    );
    expect(screen.getByText('PCT5')).toBeInTheDocument();
    expect(screen.getByText(/-5%/)).toBeInTheDocument();
  });

  it('chip fixed (type khác percent) → label formatPrice(value)', () => {
    render(
      <CheckoutOrderSummary
        {...baseProps}
        availableCodes={
          [
            {
              id: 'c3',
              code: 'FIX50',
              type: 'fixed',
              value: 50000,
              maxDiscountAmount: null,
              minOrderAmount: null,
            },
          ] as any
        }
      />,
    );
    expect(screen.getByText('FIX50')).toBeInTheDocument();
    expect(screen.getByText(/-50000đ/)).toBeInTheDocument();
  });

  it('chip không đủ điều kiện (subtotal < minOrderAmount) → nút disabled', () => {
    render(
      <CheckoutOrderSummary
        {...baseProps}
        subtotal={50000}
        availableCodes={
          [
            {
              id: 'c4',
              code: 'BIG',
              type: 'fixed',
              value: 30000,
              maxDiscountAmount: null,
              minOrderAmount: 1000000,
            },
          ] as any
        }
      />,
    );
    const btn = screen.getByText('BIG').closest('button')!;
    expect(btn).toBeDisabled();
  });

  it('đã có appliedDiscount → không hiển thị danh sách mã khả dụng', () => {
    render(
      <CheckoutOrderSummary
        {...baseProps}
        appliedDiscount={{ code: 'SALE10', amount: 50000 }}
        availableCodes={
          [
            {
              id: 'c5',
              code: 'OTHER',
              type: 'fixed',
              value: 10000,
              maxDiscountAmount: null,
              minOrderAmount: null,
            },
          ] as any
        }
      />,
    );
    expect(screen.queryByText('OTHER')).not.toBeInTheDocument();
    // appliedDiscount info hiển thị
    expect(screen.getByText('checkout.discountCode.discountInfo')).toBeInTheDocument();
  });

  it('isRepayingOrder=true → hiển thị thông tin repay, không hiển thị items/discount', () => {
    render(
      <CheckoutOrderSummary
        {...baseProps}
        isRepayingOrder
        currentOrder={{ id: 'ord-9', total: 800000 }}
        paymentMethod="vnpay"
      />,
    );
    expect(screen.getByText('checkout.repayOrder.title')).toBeInTheDocument();
    expect(screen.queryByTestId('discount-input')).not.toBeInTheDocument();
  });

  it('isValidatingCode=true → nút áp mã hiển thị "..." (line 161)', () => {
    render(<CheckoutOrderSummary {...baseProps} isValidatingCode />);
    expect(screen.getByText('...')).toBeInTheDocument();
  });

  it('tax > 0 → hiển thị dòng thuế (line 216)', () => {
    render(<CheckoutOrderSummary {...baseProps} tax={45000} />);
    expect(screen.getByText('checkout.orderSummary.tax')).toBeInTheDocument();
    expect(screen.getByText('45000đ')).toBeInTheDocument();
  });

  it('finalDistance > 0 → hiển thị thông tin khoảng cách + phí ship', () => {
    render(<CheckoutOrderSummary {...baseProps} finalDistance={3.5} shippingCost={20000} />);
    expect(screen.getByText('checkout.orderSummary.distanceInfo')).toBeInTheDocument();
  });

  it('paymentMethod=bank_transfer + có currentOrder → hiển thị thông báo redirect (line 251)', () => {
    render(
      <CheckoutOrderSummary
        {...baseProps}
        paymentMethod="bank_transfer"
        currentOrder={{ id: 'ord-bt', total: 500000 }}
      />,
    );
    expect(screen.getByText('checkout.redirectingToPayment')).toBeInTheDocument();
  });

  it('appliedDiscount → hiển thị dòng giảm giá trong tổng kết + nút Hủy', () => {
    render(
      <CheckoutOrderSummary {...baseProps} appliedDiscount={{ code: 'SALE10', amount: 50000 }} />,
    );
    expect(screen.getByText('checkout.orderSummary.discountCodeLabel')).toBeInTheDocument();
    expect(screen.getByText('checkout.discountCode.cancel')).toBeInTheDocument();
  });

  it('discountError → hiển thị thông báo lỗi', () => {
    render(<CheckoutOrderSummary {...baseProps} discountError="checkout.discountCode.invalid" />);
    expect(screen.getByText('checkout.discountCode.invalid')).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════
// CheckoutPaymentMethod — Dialog onOpenChange (line 82)
// ═══════════════════════════════════════════════════════════════
describe('CheckoutPaymentMethod — modal trả góp', () => {
  const methods = [
    { value: 'cod', label: 'COD' },
    { value: 'installment', label: 'Trả góp' },
  ];

  it('Dialog đóng (onOpenChange(false)) → gọi onCloseInstallmentModal', () => {
    const onClose = jest.fn();
    render(
      <CheckoutPaymentMethod
        paymentMethods={methods}
        selectedMethod="installment"
        onMethodChange={jest.fn()}
        isInstallmentModalOpen
        onCloseInstallmentModal={onClose}
      />,
    );
    fireEvent.click(screen.getByTestId('dialog-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('Dialog mở lại (onOpenChange(true)) → KHÔNG gọi onCloseInstallmentModal (nhánh !open false)', () => {
    const onClose = jest.fn();
    render(
      <CheckoutPaymentMethod
        paymentMethods={methods}
        selectedMethod="installment"
        onMethodChange={jest.fn()}
        isInstallmentModalOpen
        onCloseInstallmentModal={onClose}
      />,
    );
    fireEvent.click(screen.getByTestId('dialog-open'));
    expect(onClose).not.toHaveBeenCalled();
  });

  it('chọn radio → gọi onMethodChange', () => {
    const onMethodChange = jest.fn();
    render(
      <CheckoutPaymentMethod
        paymentMethods={methods}
        selectedMethod="cod"
        onMethodChange={onMethodChange}
        isInstallmentModalOpen={false}
        onCloseInstallmentModal={jest.fn()}
      />,
    );
    const radio = document.querySelector('input[type="radio"][value="installment"]')!;
    fireEvent.click(radio);
    expect(onMethodChange).toHaveBeenCalledWith('installment');
  });
});

// ═══════════════════════════════════════════════════════════════
// CheckoutStepIndicator — STEP_ICONS fallback (line 20)
// ═══════════════════════════════════════════════════════════════
describe('CheckoutStepIndicator', () => {
  it('3 bước chuẩn → render đủ label', () => {
    const steps = [
      { key: 's1', labelKey: 'step.shipping' },
      { key: 's2', labelKey: 'step.payment' },
      { key: 's3', labelKey: 'step.confirm' },
    ];
    render(<CheckoutStepIndicator currentStep={1} steps={steps} />);
    expect(screen.getByText('step.shipping')).toBeInTheDocument();
    expect(screen.getByText('step.confirm')).toBeInTheDocument();
  });

  it('hơn 3 bước → bước thứ 4 dùng fallback icon Check (line 20: STEP_ICONS[idx] || Check)', () => {
    const steps = [
      { key: 's1', labelKey: 'step.1' },
      { key: 's2', labelKey: 'step.2' },
      { key: 's3', labelKey: 'step.3' },
      { key: 's4', labelKey: 'step.4' }, // idx=3 → STEP_ICONS[3] undefined → || Check
    ];
    render(<CheckoutStepIndicator currentStep={0} steps={steps} />);
    // Bước 4 render không crash với fallback icon
    expect(screen.getByText('step.4')).toBeInTheDocument();
  });
});
