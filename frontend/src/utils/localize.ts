/**
 * @file localize.ts
 * @layer Utility
 * @feature global
 * @description Helper utility function
 */
export function localizeField(obj: object, field: string, lang: string): string {
  const rec = obj as Record<string, unknown>;
  if (lang === 'en') {
    return String(rec[`${field}En`] ?? rec[`${field}Vi`] ?? rec[field] ?? '');
  }
  return String(rec[`${field}Vi`] ?? rec[field] ?? '');
}
