/**
 * @file use-form-adapter.ts
 * @layer Hook
 * @feature catalog
 * @description Adapter hook wrapping react-hook-form với stable FormAdapter interface.
 */
import { useForm, FieldValues } from 'react-hook-form';
import type { UseFormReturn } from 'react-hook-form';
import { useCallback, useRef } from 'react';

/**
 * Form fields là dynamic (child components thêm fields, không biết trước tại compile time).
 */
export interface FormAdapter {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getFieldsValue: (all?: boolean) => Record<string, any>;
  getFieldValue: (name: string) => unknown;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setFieldsValue: (values: Record<string, any>) => void;
  setFieldValue: (name: string, value: unknown) => void;
  getFieldsError: () => Array<{ name: string[]; errors: string[] }>;
  resetFields: (fields?: string[]) => void;
  /** react-hook-form native instance, để AntdFormBridge đồng bộ và use-product-form watch */
  _rhf: UseFormReturn<FieldValues>;
  /** Listener registry cho change events (thay thế Form.useWatch) */
  _listeners: Set<() => void>;
}

interface UseFormAdapterOptions {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultValues?: Record<string, any>;
}

export function useFormAdapter(options?: UseFormAdapterOptions): FormAdapter {
  const rhf = useForm<FieldValues>({
    defaultValues: options?.defaultValues,
    mode: 'onChange',
  });

  const listenersRef = useRef(new Set<() => void>());

  const notifyListeners = useCallback(() => {
    listenersRef.current.forEach((fn) => fn());
  }, []);

  const getFieldsValue = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_all?: boolean): Record<string, any> => {
      return rhf.getValues();
    },
    [rhf],
  );

  const getFieldValue = useCallback(
    (name: string): unknown => {
      return rhf.getValues(name);
    },
    [rhf],
  );

  const setFieldsValue = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (values: Record<string, any>) => {
      Object.entries(values).forEach(([key, value]) => {
        rhf.setValue(key, value, { shouldDirty: true, shouldValidate: false });
      });
      notifyListeners();
    },
    [rhf, notifyListeners],
  );

  const setFieldValue = useCallback(
    (name: string, value: unknown) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rhf.setValue(name, value as any, { shouldDirty: true, shouldValidate: false });
      notifyListeners();
    },
    [rhf, notifyListeners],
  );

  const getFieldsError = useCallback((): Array<{ name: string[]; errors: string[] }> => {
    const { errors } = rhf.formState;
    return Object.entries(errors).map(([name, error]) => ({
      name: [name],
      errors: error?.message ? [String(error.message)] : [],
    }));
  }, [rhf]);

  const resetFields = useCallback(
    (fields?: string[]) => {
      if (fields) {
        fields.forEach((field) => {
          rhf.resetField(field);
        });
      } else {
        rhf.reset();
      }
      notifyListeners();
    },
    [rhf, notifyListeners],
  );

  // Trả về stable reference bằng useRef để tránh re-create mỗi render
  const adapterRef = useRef<FormAdapter | null>(null);

  // Luôn update methods (vì chúng capture rhf mới nhất qua closure)
  if (!adapterRef.current) {
    adapterRef.current = {
      getFieldsValue,
      getFieldValue,
      setFieldsValue,
      setFieldValue,
      getFieldsError,
      resetFields,
      _rhf: rhf,
      _listeners: listenersRef.current,
    };
  } else {
    adapterRef.current.getFieldsValue = getFieldsValue;
    adapterRef.current.getFieldValue = getFieldValue;
    adapterRef.current.setFieldsValue = setFieldsValue;
    adapterRef.current.setFieldValue = setFieldValue;
    adapterRef.current.getFieldsError = getFieldsError;
    adapterRef.current.resetFields = resetFields;
    adapterRef.current._rhf = rhf;
    adapterRef.current._listeners = listenersRef.current;
  }

  return adapterRef.current;
}
