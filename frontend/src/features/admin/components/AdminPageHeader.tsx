/**
 * @file AdminPageHeader.tsx
 * @layer Component
 * @feature admin
 * @description Header chuẩn cho mọi trang admin — section number + title + actions, nền gradient mesh.
 *              Dùng chung để các trang list/detail có cùng nhịp đầu trang.
 */
import React from 'react';
import { Sparkles } from 'lucide-react';

interface AdminPageHeaderProps {
  /** Nhãn section dạng "02 / SẢN PHẨM" */
  sectionNumber: string;
  title: string;
  subtitle?: string;
  /** Hiện icon Sparkles cạnh title */
  sparkle?: boolean;
  /** Title dùng gradient signature teal→coral (flagship) */
  gradientTitle?: boolean;
  /** Cụm nút hành động bên phải (Thêm, Xuất...) */
  actions?: React.ReactNode;
}

const AdminPageHeader: React.FC<AdminPageHeaderProps> = ({
  sectionNumber,
  title,
  subtitle,
  sparkle = false,
  gradientTitle = false,
  actions,
}) => (
  <div className="relative rounded-3xl bg-[var(--bg-base)] dark:bg-white/[0.03] border border-[var(--border-default)] p-6 mb-5 overflow-hidden">
    {/* Gradient mesh nền — chiều sâu nhẹ, không chói */}
    <div
      className="absolute inset-0 -z-10 opacity-60 pointer-events-none"
      style={{
        background: `radial-gradient(circle at 100% 0%, rgba(42, 172, 167, 0.12) 0%, transparent 42%), radial-gradient(circle at 0% 100%, rgba(24, 144, 255, 0.09) 0%, transparent 38%)`,
      }}
    />
    <div className="relative flex flex-col sm:flex-row items-start sm:items-end justify-between gap-3">
      <div className="min-w-0">
        <span className="section-number">{sectionNumber}</span>
        <div className="flex items-center gap-2.5 mt-2">
          <h1 className={`display-heading ${gradientTitle ? 'gradient-text-brand' : ''}`}>
            {title}
          </h1>
          {sparkle && <Sparkles className="w-5 h-5 text-[var(--accent)]/60" aria-hidden="true" />}
        </div>
        {subtitle && <p className="text-sm text-[var(--text-tertiary)] mt-1.5">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </div>
    <div className="admin-hairline relative mt-5" />
  </div>
);

export default AdminPageHeader;
