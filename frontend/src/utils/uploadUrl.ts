/**
 * Helper tạo URL đầy đủ cho file upload (ảnh, banner, logo...).
 *
 * VITE_API_URL thường có suffix "/api" (ví dụ http://localhost:8888/api).
 * File upload được serve tại root domain (http://localhost:8888/uploads/...).
 * Hàm này strip "/api" suffix để tạo đúng base URL cho static files.
 */
export function getUploadUrl(path: string | undefined | null): string {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = (import.meta.env.VITE_API_URL || 'http://localhost:8888/api')
    .replace(/\/api\/?$/, '');
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`;
}
