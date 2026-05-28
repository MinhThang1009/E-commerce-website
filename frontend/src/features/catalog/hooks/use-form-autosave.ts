/**
 * @file use-form-autosave.ts
 * @layer Hook
 * @feature catalog
 * @description Tự động lưu nháp form vào localStorage (debounce) + khôi phục lại khi quay lại.
 *              KHÔNG ghi DB — chỉ backup cục bộ để không mất công nhập dở. Chỉ lưu field của form
 *              (variants/attributes quản lý ở state riêng, không nằm trong phạm vi autosave).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { FormAdapter } from './use-form-adapter';
import type { AutosaveStatus } from '../components/ProductFormSaveBar';

interface UseFormAutosaveOptions {
  form: FormAdapter;
  /** Key localStorage, vd 'product-draft:create' */
  storageKey: string;
  enabled?: boolean;
  debounceMs?: number;
}

interface DraftEnvelope {
  savedAt: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  values: Record<string, any>;
}

export function useFormAutosave({
  form,
  storageKey,
  enabled = true,
  debounceMs = 1500,
}: UseFormAutosaveOptions) {
  const [status, setStatus] = useState<AutosaveStatus>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const subscription = form._rhf.watch(() => {
      setStatus((prev) => (prev === 'saving' ? prev : 'saving'));
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        try {
          const envelope: DraftEnvelope = {
            savedAt: new Date().toISOString(),
            values: form.getFieldsValue(),
          };
          localStorage.setItem(storageKey, JSON.stringify(envelope));
          setLastSavedAt(new Date());
          setStatus('saved');
        } catch {
          // Best-effort: quota đầy hoặc serialize lỗi → bỏ qua, không chặn người dùng.
          setStatus('idle');
        }
      }, debounceMs);
    });
    return () => {
      subscription.unsubscribe();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, form, storageKey, debounceMs]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const getDraft = useCallback((): Record<string, any> | null => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as DraftEnvelope;
      return parsed?.values ?? null;
    } catch {
      return null;
    }
  }, [storageKey]);

  const clearDraft = useCallback(() => {
    try {
      localStorage.removeItem(storageKey);
    } catch {
      // ignore
    }
    setStatus('idle');
    setLastSavedAt(null);
  }, [storageKey]);

  return { status, lastSavedAt, getDraft, clearDraft };
}
