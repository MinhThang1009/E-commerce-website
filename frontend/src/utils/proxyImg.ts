const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8888/api';

export function proxyImg(input: string | Record<string, unknown> | undefined | null): string {
  if (!input) return '';
  const url =
    typeof input === 'string' ? input : (input.url as string) || (input.imageUrl as string) || '';
  if (!url) return '';
  if (url.includes('tgdd.vn') || url.includes('cellphones.com.vn')) {
    return `${API_BASE}/img?url=${encodeURIComponent(url)}`;
  }
  return url;
}
