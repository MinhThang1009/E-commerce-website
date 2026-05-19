/**
 * @file Grid.tsx
 * @layer Component
 * @feature shared
 * @description Shared UI component
 */
/**
 * Các component Grid System
 * Các component grid responsive cho bố cục nhất quán
 */

import React from 'react';

interface GridProps {
  children: React.ReactNode;
  cols?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    '2xl'?: number;
  };
  gap?: number;
  className?: string;
}

interface GridItemProps {
  children: React.ReactNode;
  span?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    '2xl'?: number;
  };
  className?: string;
}

/**
 * Component Grid Responsive
 */
export const Grid: React.FC<GridProps> = ({
  children,
  cols = { xs: 1, sm: 2, md: 3, lg: 4 },
  gap = 4,
  className = '',
}) => {
  const getGridClasses = () => {
    const classes = ['grid'];

    // Thêm class số cột
    if (cols.xs) classes.push(`grid-cols-${cols.xs}`);
    if (cols.sm) classes.push(`sm:grid-cols-${cols.sm}`);
    if (cols.md) classes.push(`md:grid-cols-${cols.md}`);
    if (cols.lg) classes.push(`lg:grid-cols-${cols.lg}`);
    if (cols.xl) classes.push(`xl:grid-cols-${cols.xl}`);
    if (cols['2xl']) classes.push(`2xl:grid-cols-${cols['2xl']}`);

    // Thêm class khoảng cách
    classes.push(`gap-${gap}`);

    return classes.join(' ');
  };

  return <div className={`${getGridClasses()} ${className}`}>{children}</div>;
};

/**
 * Component Grid Item
 */
export const GridItem: React.FC<GridItemProps> = ({ children, span, className = '' }) => {
  const getSpanClasses = () => {
    if (!span) return '';

    const classes = [];
    if (span.xs) classes.push(`col-span-${span.xs}`);
    if (span.sm) classes.push(`sm:col-span-${span.sm}`);
    if (span.md) classes.push(`md:col-span-${span.md}`);
    if (span.lg) classes.push(`lg:col-span-${span.lg}`);
    if (span.xl) classes.push(`xl:col-span-${span.xl}`);
    if (span['2xl']) classes.push(`2xl:col-span-${span['2xl']}`);

    return classes.join(' ');
  };

  return <div className={`${getSpanClasses()} ${className}`}>{children}</div>;
};

/**
 * Component Grid sản phẩm
 */
export const ProductGrid: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <Grid
      cols={{
        xs: 1,
        sm: 2,
        md: 3,
        lg: 4,
        xl: 4,
      }}
      gap={6}
      className={className}
    >
      {children}
    </Grid>
  );
};

/**
 * Component Grid danh mục
 */
export const CategoryGrid: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <Grid
      cols={{
        xs: 2,
        sm: 3,
        md: 5,
        lg: 5,
      }}
      gap={6}
      className={className}
    >
      {children}
    </Grid>
  );
};

/**
 * Component Grid tính năng
 */
export const FeatureGrid: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <Grid
      cols={{
        xs: 1,
        sm: 2,
        md: 3,
      }}
      gap={8}
      className={className}
    >
      {children}
    </Grid>
  );
};

/**
 * Component Grid đánh giá
 */
export const TestimonialGrid: React.FC<{
  children: React.ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <Grid
      cols={{
        xs: 1,
        sm: 2,
        lg: 3,
      }}
      gap={6}
      className={className}
    >
      {children}
    </Grid>
  );
};

/**
 * Component Masonry Grid (dùng cho các item có chiều cao khác nhau)
 */
export const MasonryGrid: React.FC<{
  children: React.ReactNode;
  columns?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
  };
  gap?: number;
  className?: string;
}> = ({ children, columns = { xs: 1, sm: 2, md: 3, lg: 4 }, gap = 4, className = '' }) => {
  const getColumnClasses = () => {
    const classes = ['columns-1'];

    if (columns.xs) classes.push(`columns-${columns.xs}`);
    if (columns.sm) classes.push(`sm:columns-${columns.sm}`);
    if (columns.md) classes.push(`md:columns-${columns.md}`);
    if (columns.lg) classes.push(`lg:columns-${columns.lg}`);

    return classes.join(' ');
  };

  return <div className={`${getColumnClasses()} gap-${gap} ${className}`}>{children}</div>;
};

/**
 * Component Flex Grid (dùng cho bố cục flexbox)
 */
export const FlexGrid: React.FC<{
  children: React.ReactNode;
  direction?: 'row' | 'col';
  wrap?: boolean;
  justify?: 'start' | 'center' | 'end' | 'between' | 'around' | 'evenly';
  align?: 'start' | 'center' | 'end' | 'stretch';
  gap?: number;
  className?: string;
}> = ({
  children,
  direction = 'row',
  wrap = true,
  justify = 'start',
  align = 'start',
  gap = 4,
  className = '',
}) => {
  const getFlexClasses = () => {
    const classes = ['flex'];

    // Hướng
    if (direction === 'col') classes.push('flex-col');
    else classes.push('flex-row');

    // Wrap
    if (wrap) classes.push('flex-wrap');

    // Căn ngang
    const justifyMap = {
      start: 'justify-start',
      center: 'justify-center',
      end: 'justify-end',
      between: 'justify-between',
      around: 'justify-around',
      evenly: 'justify-evenly',
    };
    classes.push(justifyMap[justify]);

    // Căn dọc
    const alignMap = {
      start: 'items-start',
      center: 'items-center',
      end: 'items-end',
      stretch: 'items-stretch',
    };
    classes.push(alignMap[align]);

    // Khoảng cách
    classes.push(`gap-${gap}`);

    return classes.join(' ');
  };

  return <div className={`${getFlexClasses()} ${className}`}>{children}</div>;
};

export default Grid;
