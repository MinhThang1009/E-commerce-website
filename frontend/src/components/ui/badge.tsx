import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/utils/cn';

const badgeVariants = cva(
  'inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary-500 text-white',
        secondary:
          'border-transparent bg-neutral-100 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100',
        destructive: 'border-transparent bg-red-500 text-white',
        outline:
          'border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300',
        success: 'border-transparent bg-emerald-500 text-white',
        warning: 'border-transparent bg-amber-500 text-white',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
);

function Badge({
  className,
  variant,
  ...props
}: React.ComponentProps<'div'> & VariantProps<typeof badgeVariants>) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

// eslint-disable-next-line react-refresh/only-export-components
export { Badge, badgeVariants };
