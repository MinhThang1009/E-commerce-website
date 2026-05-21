/**
 * @file ImageUpload.tsx
 * @layer Component
 * @feature shared
 * @description Shared UI component
 */
import React, { useState, useRef } from 'react';
import { XMarkIcon, CloudArrowUpIcon, LinkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { useNotifications } from '@/hooks/use-notifications';
import { getUploadUrl } from '@/utils/upload-url';
import { getErrorMsg } from '@/utils/error-utils';

interface ImageUploadProps {
  value?: string | string[];
  onChange: (value: string | string[]) => void;
  multiple?: boolean;
  type?:
    | 'products'
    | 'categories'
    | 'users'
    | 'reviews'
    | 'collections'
    | 'brands'
    | 'banners'
    | 'news';
  label?: string;
  maxFiles?: number;
  id?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  value = '',
  onChange,
  multiple = false,
  type = 'products',
  label,
  maxFiles = 5,
  id: _id,
}) => {
  const { t } = useTranslation();
  const { showNotification } = useNotifications();
  const [isUploading, setIsUploading] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const images = Array.isArray(value) ? value : value ? value.split(',').map((s) => s.trim()) : [];

  const getFullUrl = getUploadUrl;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (!multiple && files.length > 1) {
      showNotification({ message: t('imageUpload.singleOnly'), type: 'error' });
      return;
    }

    if (multiple && images.length + files.length > maxFiles) {
      showNotification({ message: t('imageUpload.maxFiles', { max: maxFiles }), type: 'error' });
      return;
    }

    setIsUploading(true);
    const formData = new FormData();

    // Chọn endpoint phù hợp
    const endpoint = multiple ? 'multiple' : 'single';
    if (multiple) {
      for (let i = 0; i < files.length; i++) {
        formData.append('files', files[i]);
      }
    } else {
      formData.append('file', files[0]);
    }

    try {
      const { getValidToken } = await import('@/utils/token-manager');
      const authToken = await getValidToken();
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:8888/api'}/uploads/${type}/${endpoint}`,
        {
          method: 'POST',
          headers: {
            ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
          },
          credentials: 'include',
          body: formData,
        },
      );

      const result = await response.json();

      if (result.status === 'success') {
        const newUrls = multiple
          ? result.data.files.map((f: { url: string }) => f.url)
          : [result.data.url];

        const finalUrls = [...images, ...newUrls];
        onChange(multiple ? finalUrls : finalUrls[0]);
        showNotification({ message: t('imageUpload.uploadSuccess'), type: 'success' });
      } else {
        throw new Error(result.message || 'Upload failed');
      }
    } catch (error) {
      console.error('Lỗi tải ảnh lên server:', error);
      showNotification({
        message: getErrorMsg(error, t('imageUpload.uploadError')),
        type: 'error',
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemove = (url: string) => {
    const newUrls = images.filter((img) => img !== url);
    onChange(multiple ? newUrls : '');
  };

  const handleUrlSubmit = () => {
    if (!urlInput.trim()) return;
    if (multiple) {
      onChange([...images, urlInput.trim()]);
    } else {
      onChange(urlInput.trim());
    }
    setUrlInput('');
    setShowUrlInput(false);
  };

  return (
    <div className="space-y-4">
      {label && (
        <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300">
          {label}
        </label>
      )}

      {/* Preview Area */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
        {images.map((img, idx) => (
          <div
            key={idx}
            className="relative aspect-square rounded-xl overflow-hidden border-2 border-neutral-100 dark:border-neutral-800 shadow-sm group"
          >
            <img
              src={getFullUrl(img)}
              alt={`Preview ${idx + 1}`}
              className="w-full h-full object-cover"
              onError={(e) => {
                (e.target as HTMLImageElement).src = 'https://placehold.co/400x400?text=Error';
              }}
            />
            <button
              onClick={() => handleRemove(img)}
              className="absolute top-1 right-1 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
            >
              <XMarkIcon className="w-4 h-4" />
            </button>
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
              <span className="text-[10px] text-white font-medium px-2 py-1 bg-black/60 rounded-full">
                {t('imageUpload.imageLabel', { index: idx + 1 })}
              </span>
            </div>
          </div>
        ))}

        {/* Upload Button */}
        {(multiple ? images.length < maxFiles : images.length === 0) && (
          <div
            onClick={() => fileInputRef.current?.click()}
            className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-all
              ${
                isUploading
                  ? 'border-neutral-200 bg-neutral-50 animate-pulse cursor-wait'
                  : 'border-neutral-300 dark:border-neutral-700 hover:border-primary-500 hover:bg-primary-50 dark:hover:bg-primary-900/10'
              }`}
          >
            {isUploading ? (
              <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
            ) : (
              <>
                <CloudArrowUpIcon className="w-8 h-8 text-neutral-400 mb-2" />
                <span className="text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  {t('imageUpload.uploadButton')}
                </span>
              </>
            )}
          </div>
        )}
      </div>

      {/* URL Input Toggle */}
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setShowUrlInput(!showUrlInput)}
          className="text-sm text-primary-600 dark:text-primary-400 flex items-center gap-1.5 hover:underline font-medium"
        >
          <LinkIcon className="w-4 h-4" />
          {showUrlInput ? t('imageUpload.hideUrl') : t('imageUpload.showUrl')}
        </button>

        <span className="text-xs text-neutral-500">{t('imageUpload.acceptedFormats')}</span>
      </div>

      {showUrlInput && (
        <div className="flex gap-2 p-3 bg-neutral-50 dark:bg-neutral-800/40 rounded-xl border border-neutral-100 dark:border-neutral-700/50">
          <input
            type="text"
            value={urlInput}
            onChange={(e) => setUrlInput(e.target.value)}
            placeholder={t('imageUpload.urlPlaceholder')}
            className="flex-1 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 rounded-lg px-3 py-1.5 text-sm focus:ring-2 focus:ring-primary-500 outline-none transition-all dark:text-white"
            onKeyDown={(e) => e.key === 'Enter' && handleUrlSubmit()}
          />
          <button
            type="button"
            onClick={handleUrlSubmit}
            className="px-4 py-1.5 bg-neutral-800 dark:bg-neutral-700 text-white text-sm font-semibold rounded-lg hover:bg-neutral-900 transition-colors"
          >
            {t('imageUpload.addButton')}
          </button>
        </div>
      )}

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        multiple={multiple}
        accept="image/*"
        className="hidden"
      />
    </div>
  );
};

export default ImageUpload;
