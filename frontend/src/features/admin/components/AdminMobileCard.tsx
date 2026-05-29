/**
 * @file AdminMobileCard.tsx
 * @layer Component
 * @feature admin
 * @description Card hiển thị 1 dòng dữ liệu trên mobile (<768px), thay cho table row.
 *   Khung glass đồng bộ với các bảng admin; mỗi trang tự compose nội dung qua slots
 *   (media/title/subtitle/status/fields/actions) để giữ nhất quán visual mà vẫn linh hoạt.
 *   Desktop (≥768px) vẫn dùng <table>; mobile dùng danh sách card này.
 */
import React from 'react';
import { cn } from '@/utils/cn';

export interface AdminMobileCardField {
  /** Nhãn field (đã i18n) */
  label: React.ReactNode;
  /** Giá trị field */
  value: React.ReactNode;
}

interface AdminMobileCardProps {
  /** Visual dẫn đầu: avatar/ảnh/icon (tùy chọn) */
  media?: React.ReactNode;
  /** Tiêu đề chính (tên/mã) */
  title: React.ReactNode;
  /** Phụ đề dưới title (sku/email/slug) */
  subtitle?: React.ReactNode;
  /** Badge trạng thái, hiển thị góc phải header (vd StatusPill) */
  status?: React.ReactNode;
  /** Các field phụ — render label trái / value phải */
  fields?: AdminMobileCardField[];
  /** Cụm nút thao tác, render ở footer */
  actions?: React.ReactNode;
  /** Thụt lề trái (px) cho tree depth — dùng ở Categories */
  indent?: number;
  className?: string;
  /** Nội dung tùy biến chèn trước footer (variants expand, inline edit...) */
  children?: React.ReactNode;
}

const AdminMobileCard: React.FC<AdminMobileCardProps> = ({
  media,
  title,
  subtitle,
  status,
  fields,
  actions,
  indent,
  className,
  children,
}) => {
  return (
    <div
      className={cn(
        'rounded-xl border border-[var(--border-default)] bg-[var(--bg-base)] p-3.5 shadow-sm dark:bg-white/[0.03]',
        className,
      )}
      style={indent ? { marginLeft: indent } : undefined}
    >
      {/* Header: media + title/subtitle + status */}
      <div className="flex items-start gap-3">
        {media && <div className="shrink-0">{media}</div>}
        <div className="min-w-0 flex-1">
          <div className="truncate font-semibold text-[var(--text-primary)]">{title}</div>
          {subtitle && (
            <div className="mt-0.5 truncate text-xs text-[var(--text-tertiary)]">{subtitle}</div>
          )}
        </div>
        {status && <div className="shrink-0">{status}</div>}
      </div>

      {/* Fields: label trái — value phải */}
      {fields && fields.length > 0 && (
        <dl className="mt-3 space-y-1.5">
          {fields.map((field, idx) => (
            <div key={`field-${idx}`} className="flex items-center justify-between gap-3 text-sm">
              <dt className="shrink-0 text-[var(--text-tertiary)]">{field.label}</dt>
              <dd className="min-w-0 truncate text-right text-[var(--text-secondary)]">
                {field.value}
              </dd>
            </div>
          ))}
        </dl>
      )}

      {children}

      {/* Footer: cụm nút thao tác */}
      {actions && (
        <div className="mt-3 flex items-center justify-end gap-1 border-t border-[var(--border-default)] pt-3">
          {actions}
        </div>
      )}
    </div>
  );
};

export default AdminMobileCard;
