/**
 * @file ViewOnlyBanner.tsx
 * @layer Component
 * @feature admin
 * @description Banner thông báo chế độ xem-only cho admin trên các trang nghiệp vụ.
 *
 * Hiển thị khi user là admin (xem-only) ở back-office: admin chỉ giám sát,
 * thao tác nghiệp vụ (tạo/sửa/xóa) dành cho staff. Render có điều kiện ở
 * cấp trang — không tự kiểm tra role để giữ component thuần (caller quyết định).
 */
import { Eye } from 'lucide-react';
import { useTranslation } from 'react-i18next';

const ViewOnlyBanner: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div
      role="status"
      className="mb-4 flex items-start gap-3 rounded-xl border border-[var(--color-info)]/25 bg-[var(--color-info)]/8 px-4 py-3"
    >
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[var(--color-info)]/15 text-[var(--color-info)]">
        <Eye className="h-4 w-4" strokeWidth={2.25} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-[var(--text-primary)]">
          {t('admin.viewOnly.title')}
        </p>
        <p className="text-xs text-[var(--text-secondary)]">{t('admin.viewOnly.description')}</p>
      </div>
    </div>
  );
};

export default ViewOnlyBanner;
