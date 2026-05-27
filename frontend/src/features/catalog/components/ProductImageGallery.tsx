/**
 * @file ProductImageGallery.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCw,
  FlipHorizontal2,
  Maximize2,
  X,
} from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { proxyImg } from '@/utils/proxy-img';
import { motion, AnimatePresence } from 'framer-motion';

interface ProductImageGalleryProps {
  images: string[];
  thumbnail?: string;
  productName: string;
}

const ProductImageGallery: React.FC<ProductImageGalleryProps> = ({
  images: propImages,
  thumbnail,
  productName,
}) => {
  const { t } = useTranslation();
  const [selectedImage, setSelectedImage] = useState(0);
  const [slideDirection, setSlideDirection] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [zoomPos, setZoomPos] = useState({ x: 50, y: 50 });
  const [isZooming, setIsZooming] = useState(false);
  const [lbZoom, setLbZoom] = useState(1);
  const [lbRotate, setLbRotate] = useState(0);
  const [lbFlip, setLbFlip] = useState(false);

  const resetLightbox = () => {
    setLbZoom(1);
    setLbRotate(0);
    setLbFlip(false);
  };
  const constraintsRef = useRef<HTMLDivElement>(null);
  const mainImageRef = useRef<HTMLDivElement>(null);

  const images = React.useMemo(() => {
    const rawImages = [thumbnail, ...(propImages || [])].filter(Boolean) as string[];
    return [...new Set(rawImages)].map(proxyImg);
  }, [thumbnail, propImages]);

  const goToImage = useCallback(
    (index: number) => {
      setSlideDirection(index > selectedImage ? 1 : -1);
      setSelectedImage(index);
    },
    [selectedImage],
  );

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft')
        goToImage(selectedImage === 0 ? images.length - 1 : selectedImage - 1);
      if (e.key === 'ArrowRight')
        goToImage(selectedImage === images.length - 1 ? 0 : selectedImage + 1);
      if (e.key === 'Escape' && previewOpen) setPreviewOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedImage, images.length, previewOpen, goToImage]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!mainImageRef.current) return;
    const rect = mainImageRef.current.getBoundingClientRect();
    setZoomPos({
      x: ((e.clientX - rect.left) / rect.width) * 100,
      y: ((e.clientY - rect.top) / rect.height) * 100,
    });
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleDragEnd = (_e: any, info: { offset: { x: number }; velocity: { x: number } }) => {
    const swipeThreshold = 50;
    if (info.offset.x < -swipeThreshold || info.velocity.x < -500) {
      setSlideDirection(1);
      setSelectedImage((prev) => (prev === images.length - 1 ? 0 : prev + 1));
    } else if (info.offset.x > swipeThreshold || info.velocity.x > 500) {
      setSlideDirection(-1);
      setSelectedImage((prev) => (prev === 0 ? images.length - 1 : prev - 1));
    }
  };

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    goToImage(selectedImage === 0 ? images.length - 1 : selectedImage - 1);
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    goToImage(selectedImage === images.length - 1 ? 0 : selectedImage + 1);
  };

  if (images.length === 0) {
    return (
      <div className="w-full aspect-square bg-neutral-100 dark:bg-neutral-800 rounded-xl flex items-center justify-center text-neutral-400">
        No Image Available
      </div>
    );
  }

  return (
    <div className="space-y-4 select-none">
      {/* Khung ảnh chính — swipe trên mobile */}
      <div
        ref={constraintsRef}
        className="relative group rounded-xl overflow-hidden bg-white dark:bg-neutral-800 border border-neutral-100/60 dark:border-white/[0.06]"
      >
        <div className="w-full aspect-[4/3] relative">
          <AnimatePresence mode="wait" custom={slideDirection}>
            <motion.div
              key={selectedImage}
              custom={slideDirection}
              initial={{ x: slideDirection * 100, opacity: 0 }}
              animate={{ x: 0, opacity: 1, transition: { duration: 0.3, ease: [0.16, 1, 0.3, 1] } }}
              exit={{ x: slideDirection * -100, opacity: 0, transition: { duration: 0.15 } }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.3}
              onDragEnd={handleDragEnd}
              className="absolute inset-0 cursor-grab active:cursor-grabbing"
            >
              <div
                ref={mainImageRef}
                className="relative w-full h-full overflow-hidden"
                onMouseEnter={() => setIsZooming(true)}
                onMouseLeave={() => setIsZooming(false)}
                onMouseMove={handleMouseMove}
                onClick={() => setPreviewOpen(true)}
                role="button"
                tabIndex={0}
                aria-label={t('product.viewLargeImage')}
              >
                <img
                  src={images[selectedImage]}
                  alt={`${productName} - View ${selectedImage + 1}`}
                  referrerPolicy="no-referrer"
                  className="absolute inset-0 w-full h-full object-contain transition-transform duration-200"
                  style={
                    isZooming
                      ? {
                          transform: 'scale(2)',
                          transformOrigin: `${zoomPos.x}% ${zoomPos.y}%`,
                        }
                      : undefined
                  }
                />
                <div
                  className={`absolute inset-0 flex items-center justify-center bg-black/20 text-white transition-opacity duration-200 cursor-zoom-in ${isZooming ? 'opacity-0' : 'opacity-0 group-hover:opacity-100'}`}
                >
                  <ZoomIn className="w-5 h-5 mr-2" />
                  <span className="font-medium text-sm">{t('product.viewLargeImage')}</span>
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Nút điều hướng cho ảnh chính */}
        {images.length > 1 && (
          <>
            <button
              onClick={handlePrevImage}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/90 hover:bg-white dark:bg-neutral-800/90 dark:hover:bg-neutral-800 rounded-full shadow-lg border border-gray-100 dark:border-neutral-700 text-gray-700 dark:text-neutral-200 opacity-0 group-hover:opacity-100 transition-all duration-300 transform hover:scale-110 z-10"
              aria-label={t('product.prevImage')}
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleNextImage}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/90 hover:bg-white dark:bg-neutral-800/90 dark:hover:bg-neutral-800 rounded-full shadow-lg border border-gray-100 dark:border-neutral-700 text-gray-700 dark:text-neutral-200 opacity-0 group-hover:opacity-100 transition-all duration-300 transform hover:scale-110 z-10"
              aria-label={t('product.nextImage')}
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </>
        )}

        {/* Image counter + pagination dots */}
        {images.length > 1 && (
          <>
            <div className="absolute top-3 right-3 z-10 px-2.5 py-1 rounded-full bg-black/50 backdrop-blur-sm text-white text-xs font-medium">
              {selectedImage + 1} / {images.length}
            </div>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 z-10 sm:hidden">
              {images.map((_, idx) => (
                <button
                  key={idx}
                  onClick={() => goToImage(idx)}
                  className={`w-2 h-2 rounded-full transition-all duration-300 ${
                    idx === selectedImage ? 'bg-primary-500 w-5' : 'bg-white/60'
                  }`}
                  aria-label={`Image ${idx + 1}`}
                />
              ))}
            </div>
          </>
        )}
      </div>

      {/* Danh sách thumbnail */}
      {images.length > 1 && (
        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 sm:gap-3">
          {images.map((img, index) => (
            <div
              key={index}
              onClick={() => goToImage(index)}
              className={`
                relative aspect-square cursor-pointer rounded-lg overflow-hidden border-2 transition-all duration-200
                ${
                  selectedImage === index
                    ? 'border-primary-500 ring-2 ring-primary-100 dark:ring-primary-900/30'
                    : 'border-transparent hover:border-gray-300 dark:hover:border-neutral-600'
                }
              `}
            >
              <div className="w-full h-full bg-white dark:bg-neutral-800 flex items-center justify-center p-1">
                <img
                  src={img}
                  alt={`${productName} thumbnail ${index + 1}`}
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-full object-contain"
                />
              </div>
              {/* Lớp phủ làm tối nhẹ các ảnh không được chọn - tùy chọn */}
              {selectedImage !== index && (
                <div className="absolute inset-0 bg-black/5 hover:bg-transparent transition-colors duration-200" />
              )}
            </div>
          ))}
        </div>
      )}
      {/* Lightbox preview with navigation + controls */}
      <Dialog
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) resetLightbox();
        }}
      >
        <DialogContent className="!max-w-none !w-screen !h-screen !rounded-none p-0 bg-black border-none flex items-center justify-center">
          <img
            src={images[selectedImage]}
            alt={`${productName} - Full view`}
            referrerPolicy="no-referrer"
            className="max-w-[90vw] max-h-[85vh] object-contain select-none transition-transform duration-200"
            style={{
              transform: `scale(${lbZoom}) rotate(${lbRotate}deg) scaleX(${lbFlip ? -1 : 1})`,
            }}
          />

          {/* Navigation arrows */}
          {images.length > 1 && (
            <>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handlePrevImage(e);
                  resetLightbox();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                aria-label={t('product.prevImage')}
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleNextImage(e);
                  resetLightbox();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
                aria-label={t('product.nextImage')}
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </>
          )}

          {/* Bottom toolbar — zoom, rotate, flip, counter */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-2 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10">
            <button
              onClick={() => setLbZoom((z) => Math.max(0.5, z - 0.25))}
              className="w-9 h-9 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Zoom out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-white/60 text-xs font-mono w-10 text-center">
              {Math.round(lbZoom * 100)}%
            </span>
            <button
              onClick={() => setLbZoom((z) => Math.min(3, z + 0.25))}
              className="w-9 h-9 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Zoom in"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
            <div className="w-px h-5 bg-white/20 mx-1" />
            <button
              onClick={() => setLbRotate((r) => r + 90)}
              className="w-9 h-9 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Rotate"
            >
              <RotateCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setLbFlip((f) => !f)}
              className="w-9 h-9 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Flip"
            >
              <FlipHorizontal2 className="w-4 h-4" />
            </button>
            <button
              onClick={resetLightbox}
              className="w-9 h-9 flex items-center justify-center rounded-full text-white/80 hover:text-white hover:bg-white/10 transition-colors"
              aria-label="Reset"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
            {images.length > 1 && (
              <>
                <div className="w-px h-5 bg-white/20 mx-1" />
                <span className="text-white/60 text-xs font-medium px-2">
                  {selectedImage + 1} / {images.length}
                </span>
              </>
            )}
          </div>

          {/* Close button */}
          <button
            onClick={() => {
              setPreviewOpen(false);
              resetLightbox();
            }}
            className="absolute top-4 right-4 w-10 h-10 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors"
            aria-label={t('common.close')}
          >
            <X className="w-5 h-5" />
          </button>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ProductImageGallery;
