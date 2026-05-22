/**
 * @file BannerDisplay.tsx
 * @layer Component
 * @feature shared
 * @description Banner display component — banners feature đã bị xóa, component này là stub
 */
import React from 'react';

interface BannerDisplayProps {
  position: 'home_hero' | 'home_middle' | 'sidebar';
  className?: string;
}

// Banner feature đã bị xóa hoàn toàn. Component này giữ lại để không break
// imports hiện có nhưng không render gì cả.
const BannerDisplay: React.FC<BannerDisplayProps> = () => null;

export default BannerDisplay;
