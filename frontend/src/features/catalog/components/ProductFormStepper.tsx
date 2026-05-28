/**
 * @file ProductFormStepper.tsx
 * @layer Component
 * @feature catalog
 * @description Vertical stepper cho form tạo/sửa sản phẩm (spec §7.4) — thay tab ngang cramped.
 *              Hiển thị trạng thái từng bước: đang chọn / đã xong (✓) / bị khoá. Token-driven.
 */
import React from 'react';
import { Check, Lock } from 'lucide-react';
import { cn } from '@/utils/cn';

export interface FormStep {
  key: string;
  label: string;
}

interface ProductFormStepperProps {
  steps: FormStep[];
  activeStep: string;
  /** Map bước → đã hoàn thành (hiện ✓). Bỏ trống nếu không gate. */
  completedSteps?: Record<string, boolean>;
  /** Bước có được phép truy cập không (gate ở create). Mặc định: luôn truy cập được. */
  isStepAccessible?: (key: string) => boolean;
  onSelect: (key: string) => void;
}

const ProductFormStepper: React.FC<ProductFormStepperProps> = ({
  steps,
  activeStep,
  completedSteps,
  isStepAccessible,
  onSelect,
}) => (
  <nav className="flex flex-col" aria-label="Các bước nhập sản phẩm">
    {steps.map((step, index) => {
      const isActive = step.key === activeStep;
      const isDone = completedSteps?.[step.key] ?? false;
      const accessible = isStepAccessible ? isStepAccessible(step.key) : true;
      const isLast = index === steps.length - 1;
      return (
        <button
          key={step.key}
          type="button"
          disabled={!accessible}
          aria-current={isActive ? 'step' : undefined}
          onClick={() => accessible && onSelect(step.key)}
          className={cn(
            'group relative flex items-stretch gap-3 rounded-xl py-2.5 pl-3 pr-3 text-left transition',
            isActive ? 'bg-[var(--accent)]/10' : 'hover:bg-[var(--accent)]/5',
            !accessible && 'cursor-not-allowed opacity-45 hover:bg-transparent',
          )}
        >
          {isActive && (
            <span
              className="absolute left-0 top-1/2 h-6 w-1 -translate-y-1/2 rounded-full bg-[var(--accent)]"
              aria-hidden="true"
            />
          )}
          {/* Rail timeline: vòng tròn bước + đường nối dọc xuống bước kế */}
          <div className="relative flex w-7 shrink-0 flex-col items-center justify-center self-stretch">
            {!isLast && (
              <span
                className={cn(
                  'absolute left-1/2 top-1/2 h-[calc(100%+1.25rem)] w-0.5 -translate-x-1/2',
                  isDone ? 'bg-[var(--admin-success)]' : 'bg-[var(--border-default)]',
                )}
                aria-hidden="true"
              />
            )}
            <span
              className={cn(
                'relative z-10 flex h-7 w-7 items-center justify-center rounded-full border text-xs font-bold tabular-nums transition',
                isDone
                  ? 'border-[var(--admin-success)] bg-[var(--admin-success)] text-white'
                  : isActive
                    ? 'border-[var(--accent)] bg-[var(--accent)] text-white'
                    : 'border-[var(--border-default)] bg-[var(--bg-base)] text-[var(--text-tertiary)]',
              )}
            >
              {isDone ? (
                <Check className="h-4 w-4" strokeWidth={3} />
              ) : !accessible ? (
                <Lock className="h-3.5 w-3.5" strokeWidth={2.25} />
              ) : (
                index + 1
              )}
            </span>
          </div>
          <span
            className={cn(
              'flex items-center truncate text-sm font-medium',
              isActive
                ? 'text-[var(--text-primary)]'
                : isDone
                  ? 'text-[var(--text-secondary)]'
                  : 'text-[var(--text-tertiary)]',
            )}
          >
            {step.label}
          </span>
        </button>
      );
    })}
  </nav>
);

export default ProductFormStepper;
