/// <reference types="jest" />
/**
 * PremiumButton component tests — variants, icons, sizes, handlers.
 * File riêng vì PremiumButton bị mock trong nhiều test files khác.
 */
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('lucide-react', () => {
  const R = require('react');
  const Icon = ({ className }: { className?: string }) =>
    R.createElement('svg', { className, 'data-testid': 'icon' });
  return new Proxy({}, { get: () => Icon });
});

import PremiumButton from '@/components/common/PremiumButton';

describe('PremiumButton', () => {
  it('render children', () => {
    render(<PremiumButton>Click me</PremiumButton>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('isProcessing=true → hiển thị processingText + spinner', () => {
    render(
      <PremiumButton isProcessing processingText="Đang xử lý...">
        Submit
      </PremiumButton>,
    );
    expect(screen.getByText('Đang xử lý...')).toBeInTheDocument();
    expect(document.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('isProcessing=true → button disabled', () => {
    render(<PremiumButton isProcessing>Submit</PremiumButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('disabled=true → button disabled', () => {
    render(<PremiumButton disabled>Submit</PremiumButton>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('onClick được gọi khi click', () => {
    const onClick = jest.fn();
    render(<PremiumButton onClick={onClick}>Click</PremiumButton>);
    fireEvent.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalled();
  });

  // Variants
  it.each([
    'primary',
    'secondary',
    'success',
    'info',
    'warning',
    'danger',
    'ghost',
    'outline',
  ] as const)('variant=%s → render không crash', (variant) => {
    render(<PremiumButton variant={variant}>Btn</PremiumButton>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  // Sizes
  it.each(['small', 'middle', 'large'] as const)('size=%s → render không crash', (size) => {
    render(<PremiumButton size={size}>Btn</PremiumButton>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  // Icons
  it.each(['check', 'arrow-right', 'cart', 'heart', 'user', 'settings'] as const)(
    'iconType=%s → render icon',
    (iconType) => {
      render(<PremiumButton iconType={iconType}>Btn</PremiumButton>);
      expect(screen.getByTestId('icon')).toBeInTheDocument();
    },
  );

  it('iconType=none → không render icon', () => {
    render(<PremiumButton iconType="none">Btn</PremiumButton>);
    expect(screen.queryByTestId('icon')).not.toBeInTheDocument();
  });

  it('iconType không hợp lệ (undefined type cast) → default case → không crash', () => {
    // Trigger default branch trong getIcon switch
    render(<PremiumButton iconType={'unknown-icon' as any}>Btn</PremiumButton>);
    expect(screen.getByRole('button')).toBeInTheDocument();
  });

  it('isProcessing=true + iconType=check → hiển thị processingText thay vì children', () => {
    render(
      <PremiumButton isProcessing processingText="Processing" iconType="check">
        Btn
      </PremiumButton>,
    );
    expect(screen.getByText('Processing')).toBeInTheDocument();
    expect(screen.queryByText('Btn')).not.toBeInTheDocument();
  });

  it('htmlType=submit → button type=submit', () => {
    render(<PremiumButton htmlType="submit">Btn</PremiumButton>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('className được gắn vào button', () => {
    render(<PremiumButton className="my-custom-class">Btn</PremiumButton>);
    expect(screen.getByRole('button').className).toContain('my-custom-class');
  });

  it('onMouseEnter được gọi khi hover', () => {
    const onMouseEnter = jest.fn();
    render(<PremiumButton onMouseEnter={onMouseEnter}>Btn</PremiumButton>);
    fireEvent.mouseEnter(screen.getByRole('button'));
    expect(onMouseEnter).toHaveBeenCalled();
  });

  it('onMouseLeave được gọi khi leave', () => {
    const onMouseLeave = jest.fn();
    render(<PremiumButton onMouseLeave={onMouseLeave}>Btn</PremiumButton>);
    fireEvent.mouseLeave(screen.getByRole('button'));
    expect(onMouseLeave).toHaveBeenCalled();
  });

  it('gradientHover=false → không transform khi hover', () => {
    render(<PremiumButton gradientHover={false}>Btn</PremiumButton>);
    const btn = screen.getByRole('button');
    fireEvent.mouseEnter(btn);
    // Không crash + button vẫn ở DOM
    expect(btn).toBeInTheDocument();
  });

  it('disabled=true + mouseEnter → không transform', () => {
    render(<PremiumButton disabled>Btn</PremiumButton>);
    fireEvent.mouseEnter(screen.getByRole('button'));
    fireEvent.mouseLeave(screen.getByRole('button'));
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('isProcessing=true + mouseEnter → không transform', () => {
    render(
      <PremiumButton isProcessing processingText="...">
        Btn
      </PremiumButton>,
    );
    fireEvent.mouseEnter(screen.getByRole('button'));
    fireEvent.mouseLeave(screen.getByRole('button'));
    expect(screen.getByRole('button')).toBeDisabled();
  });
});
