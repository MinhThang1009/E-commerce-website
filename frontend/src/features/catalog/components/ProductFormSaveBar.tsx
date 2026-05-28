/**
 * @file ProductFormSaveBar.tsx
 * @layer Component
 * @feature catalog
 * @description Thanh lưu dính đáy cho form sản phẩm (spec §7.4): chỉ báo autosave +
 *              nút Lưu nháp / Xuất bản. Token-driven, dùng chung create/edit.
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2, CloudOff, CheckCircle2, Save, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type AutosaveStatus = 'idle' | 'saving' | 'saved';

interface ProductFormSaveBarProps {
  /** Trạng thái autosave (chỉ truyền ở create — edit đã lưu DB nên bỏ qua) */
  autosaveStatus?: AutosaveStatus;
  lastSavedAt?: Date | null;
  isSubmitting?: boolean;
  onSaveDraft: () => void;
  onPublish: () => void;
  onCancel: () => void;
  draftText: string;
  publishText: string;
}

const ProductFormSaveBar: React.FC<ProductFormSaveBarProps> = ({
  autosaveStatus,
  lastSavedAt,
  isSubmitting = false,
  onSaveDraft,
  onPublish,
  onCancel,
  draftText,
  publishText,
}) => {
  const { t, i18n } = useTranslation();

  const renderAutosave = () => {
    if (!autosaveStatus) return <span />;
    if (autosaveStatus === 'saving') {
      return (
        <span className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2.25} />
          {t('admin.products.autosave.saving')}
        </span>
      );
    }
    if (autosaveStatus === 'saved' && lastSavedAt) {
      const time = lastSavedAt.toLocaleTimeString(i18n.language === 'vi' ? 'vi-VN' : 'en-US', {
        hour: '2-digit',
        minute: '2-digit',
      });
      return (
        <span className="flex items-center gap-1.5 text-xs text-[var(--admin-success)]">
          <CheckCircle2 className="h-3.5 w-3.5" strokeWidth={2.25} />
          {t('admin.products.autosave.saved', { time })}
        </span>
      );
    }
    return (
      <span className="flex items-center gap-1.5 text-xs text-[var(--text-tertiary)]">
        <CloudOff className="h-3.5 w-3.5" strokeWidth={2.25} />
        {t('admin.products.autosave.idle')}
      </span>
    );
  };

  return (
    <div className="sticky bottom-0 z-20 -mx-5 -mb-5 mt-6 flex flex-col items-center justify-between gap-3 border-t border-[var(--border-default)] bg-[var(--bg-base)]/90 px-5 py-3.5 backdrop-blur-md sm:flex-row dark:bg-white/[0.04]">
      {renderAutosave()}
      <div className="flex items-center gap-2">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={isSubmitting}>
          {t('common.cancel')}
        </Button>
        <Button type="button" variant="outline" onClick={onSaveDraft} disabled={isSubmitting}>
          <Save className="mr-2 h-4 w-4" strokeWidth={2.25} />
          {draftText}
        </Button>
        <Button
          type="button"
          className="admin-btn-primary"
          onClick={onPublish}
          disabled={isSubmitting}
        >
          <Send className="mr-2 h-4 w-4" strokeWidth={2.25} />
          {publishText}
        </Button>
      </div>
    </div>
  );
};

export default ProductFormSaveBar;
