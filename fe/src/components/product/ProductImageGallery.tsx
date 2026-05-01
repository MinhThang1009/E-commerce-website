import React, { useState } from 'react';
import { Image } from 'antd';
import { LeftOutlined, RightOutlined, EyeOutlined } from '@ant-design/icons';

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
  const [selectedImage, setSelectedImage] = useState(0);

  // Combine thumbnail and images, filtering out duplicates and empty strings
  const images = React.useMemo(() => {
    const rawImages = [thumbnail, ...(propImages || [])].filter(Boolean) as string[];
    // Remove duplicates
    return [...new Set(rawImages)];
  }, [thumbnail, propImages]);

  const handlePrevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImage((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedImage((prev) => (prev === images.length - 1 ? 0 : prev + 1));
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
      {/* Main Image Container */}
      <div className="relative group rounded-xl overflow-hidden bg-white dark:bg-neutral-800 border border-gray-100 dark:border-neutral-700">
        {/* Full width/height container without padding, maintaining aspect ratio but allowing fill */}
        <div className="w-full aspect-[4/3] flex items-center justify-center bg-white dark:bg-neutral-900 relative">
             <Image
                src={images[selectedImage]}
                alt={`${productName} - View ${selectedImage + 1}`}
                className="object-contain max-h-full max-w-full !h-auto !w-auto"
                style={{ maxHeight: '100%', maxWidth: '100%' }} // Ensure strict containment
                rootClassName="flex items-center justify-center w-full h-full" // Center content
                preview={{
                  mask: (
                    <div className="flex items-center justify-center bg-black/30 backdrop-blur-[2px] w-full h-full text-white transition-opacity">
                      <EyeOutlined className="text-xl mr-2" />
                      <span className="font-medium">Xem ảnh lớn</span>
                    </div>
                  ),
                }}
              />
        </div>

        {/* Navigation Buttons for Main Image */}
        {images.length > 1 && (
          <>
            <button
              onClick={handlePrevImage}
              className="absolute left-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/90 hover:bg-white dark:bg-neutral-800/90 dark:hover:bg-neutral-800 rounded-full shadow-lg border border-gray-100 dark:border-neutral-700 text-gray-700 dark:text-neutral-200 opacity-0 group-hover:opacity-100 transition-all duration-300 transform hover:scale-110 z-10"
              aria-label="Previous image"
            >
              <LeftOutlined style={{ fontSize: '14px' }} />
            </button>
            <button
              onClick={handleNextImage}
              className="absolute right-4 top-1/2 -translate-y-1/2 w-10 h-10 flex items-center justify-center bg-white/90 hover:bg-white dark:bg-neutral-800/90 dark:hover:bg-neutral-800 rounded-full shadow-lg border border-gray-100 dark:border-neutral-700 text-gray-700 dark:text-neutral-200 opacity-0 group-hover:opacity-100 transition-all duration-300 transform hover:scale-110 z-10"
              aria-label="Next image"
            >
              <RightOutlined style={{ fontSize: '14px' }} />
            </button>
          </>
        )}
      </div>

      {/* Thumbnail List */}
      {images.length > 1 && (
        <div className="grid grid-cols-5 sm:grid-cols-6 gap-2 sm:gap-3">
          {images.map((img, index) => (
            <div
              key={index}
              onClick={() => setSelectedImage(index)}
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
                    className="max-w-full max-h-full object-contain"
                  />
              </div>
              {/* Overlay for non-selected items to dim them slightly - optional, requested 'clean' style usually implies no dimming or subtle dimming */}
               {selectedImage !== index && (
                <div className="absolute inset-0 bg-black/5 hover:bg-transparent transition-colors duration-200" />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProductImageGallery;
