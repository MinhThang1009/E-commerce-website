/**
 * Helper tạo URL đầy đủ cho file upload (ảnh, banner, logo...).
 *
 * VITE_API_URL thường có suffix "/api" (ví dụ http://localhost:8888/api).
 * File upload được serve tại root domain (http://localhost:8888/uploads/...).
 * Hàm này strip "/api" suffix để tạo đúng base URL cho static files.
 */
export function getUploadUrl(path: string | undefined | null): string {
  if (!path) return '';
  // CDN URLs cần proxy qua backend để bypass hotlink protection trên localhost
  if (path.startsWith('http') && (path.includes('tgdd.vn') || path.includes('cellphones.com.vn'))) {
    const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:8888/api';
    return `${apiBase}/img?url=${encodeURIComponent(path)}`;
  }
  if (path.startsWith('http')) return path;
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:8888/api').replace(
    /\/api\/?$/,
    '',
  );
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}
