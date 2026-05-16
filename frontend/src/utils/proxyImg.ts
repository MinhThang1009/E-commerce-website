const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8888/api';

export function proxyImg(url: string | undefined | null): string {
  if (!url) return '';
  if (url.includes('tgdd.vn') || url.includes('cellphones.com.vn')) {
    return `${API_BASE}/img?url=${encodeURIComponent(url)}`;
  }
  return url;
}
