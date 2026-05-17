/**
 * @file ProductDetailPage.tsx
 * @layer Page
 * @feature catalog
 * @description Page component của feature catalog
 */
import { Helmet } from 'react-helmet-async';
import { PremiumButton } from '@/components/common';
import Badge from '@/components/common/Badge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { Rating } from '@/components/common/Rating';
import { ProductCard } from '@/features/catalog';
import { ProductReviews } from '@/features/reviews';
import WarrantySelection from '../components/WarrantySelection';
import ProductDetailsSection from '../components/ProductDetailsSection';
import ProductFAQSection from '../components/ProductFAQSection';
import { productApi } from '../api/productApi';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useCartStore } from '@/stores/cartStore';
import { useAuthStore } from '@/stores/authStore';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ROUTES, buildRoute } from '@/routes/paths';
import { v4 as uuidv4 } from 'uuid';
import ProductImageGallery from '../components/ProductImageGallery';
import RecentlyViewedProducts from '../components/RecentlyViewedProducts';

import { useUiStore } from '@/stores/uiStore';
import { useAddToCartMutation } from '@/features/cart';
import {
  getVariantStock,
  findVariantByAttributes,
  getAttributeValuesWithStock,
  areAllAttributesSelected,
  getVariantPrice,
  formatStockText,
  getStockStatusColor,
  hasVariants,
} from '../utils/productHelpers';
import { getErrorMsg } from '@/utils/errorUtils';
import { localizeField } from '@/utils/localize';

const ProductDetailPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { productId } = useParams<{ productId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const addNotification = useUiStore((s) => s.addNotification);
  const addItem = useCartStore((s) => s.addItem);
  const setServerCart = useCartStore((s) => s.setServerCart);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  // Lấy skuId từ URL params
  const skuId = searchParams.get('skuId') || undefined;

  const [quantity, setQuantity] = useState(1);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [selectedWarranties, setSelectedWarranties] = useState<string[]>([]);
  const [_dynamicProductName, setDynamicProductName] = useState<string>('');
  const [_mappedAttributes, setMappedAttributes] = useState<Record<string, string>>({});

  const colorParam =
    selectedAttributes.color ||
    selectedAttributes['Màu sắc'] ||
    selectedAttributes['màu sắc'] ||
    undefined;

  // Các API hooks
  const {
    data: productData,
    isLoading,
    error,
    refetch,
  } = productApi.useGetProductByIdQuery(
    { id: productId || '', skuId, color: colorParam },
    {
      enabled: !!productId,
      placeholderData: (prev: unknown) => prev,
    },
  );

  const { mutateAsync: addToCart, isPending: isAddingToCart } = useAddToCartMutation();

  const { data: relatedProductsData } = productApi.useGetRelatedProductsQuery(
    productData?.data?.id || '',
    {
      enabled: !!productData?.data?.id,
    },
  );

  const product = productData?.data;
  const relatedProducts = relatedProductsData?.data || [];
  const warrantyPackages = product?.warrantyPackages || [];

  useEffect(() => {
    if (error) {
      navigate('/404');
    }
  }, [error, navigate]);

  // Đã bỏ tự động chọn biến thể đầu tiên theo yêu cầu để bắt buộc chọn thủ công
  // NHƯNG vẫn cần đồng bộ state nếu biến thể đã được chọn sẵn qua URL (skuId)
  useEffect(() => {
    if (
      product &&
      product.isVariantProduct &&
      product.currentVariant &&
      product.currentVariant.attributes
    ) {
      if (Object.keys(selectedAttributes).length === 0) {
        setSelectedAttributes(product.currentVariant.attributes);
        setMappedAttributes(product.currentVariant.attributes);
      }
    }
  }, [product, selectedAttributes]);

  // Đặt biến thể mặc định và reset state khi sản phẩm thay đổi
  useEffect(() => {
    if (product) {
      // Xóa các gói bảo hành đã chọn trước đó
      setSelectedWarranties([]);

      // Tự động chọn thuộc tính biến thể mặc định nếu là sản phẩm có biến thể
      if (product.isVariantProduct && product.currentVariant && product.currentVariant.attributes) {
        setSelectedAttributes(product.currentVariant.attributes);
        setMappedAttributes(product.currentVariant.attributes);
      } else {
        // Reset thuộc tính cho sản phẩm không có biến thể
        setSelectedAttributes({});
        setMappedAttributes({});
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Reset state khi sản phẩm thay đổi, chỉ phụ thuộc vào product.id
  }, [product?.id]);

  // Xử lý thay đổi số lượng
  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity >= 1 && newQuantity <= (product?.stock ?? 99)) {
      setQuantity(newQuantity);
    }
  };

  // Xử lý chọn thuộc tính với chức năng bật/tắt
  const handleAttributeChange = (name: string, value: string) => {
    if (selectedAttributes[name] === value) {
      return;
    }

    const newAttributes = { ...selectedAttributes, [name]: value };

    setSelectedAttributes(newAttributes);
    setMappedAttributes(newAttributes);

    if (product && hasVariants(product) && product.attributes) {
      const allSelected = areAllAttributesSelected(product.attributes, newAttributes);
      if (allSelected) {
        const matchingVariant = findVariantByAttributes(product.variants || [], newAttributes);
        if (matchingVariant) {
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.set('skuId', matchingVariant.id);
          setSearchParams(newSearchParams);
        }
      } else if (skuId) {
        const newSearchParams = new URLSearchParams(searchParams);
        newSearchParams.delete('skuId');
        setSearchParams(newSearchParams);
      }
    }

    setQuantity(1);
  };

  const _handleDynamicNameUpdate = (newName: string, _details: Record<string, unknown>) => {
    setDynamicProductName(newName);
  };

  // Xử lý chọn gói bảo hành
  const handleWarrantyChange = (packageIds: string[]) => {
    setSelectedWarranties(packageIds);
  };

  // Xử lý chọn biến thể
  const _handleVariantChange = (variantId: string) => {
    // Cập nhật URL với skuId mới
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('skuId', variantId);
    setSearchParams(newSearchParams);

    // Reset số lượng và lựa chọn ảnh
    setQuantity(1);

    // Tải lại dữ liệu sản phẩm với biến thể mới
    refetch();
  };

  // Thêm vào giỏ hàng
  const handleAddToCart = async () => {
    if (!product) return;

    // Với sản phẩm có biến thể, sử dụng biến thể hiện tại
    let variantId: string | undefined;
    let availableStock: number;

    if (product.isVariantProduct && product.currentVariant) {
      // Sử dụng biến thể hiện tại từ response API
      variantId = product.currentVariant.id;
      availableStock = product.currentVariant.stockQuantity;
    } else {
      // Chọn biến thể theo thuộc tính kiểu cũ (legacy)
      if (product.attributes && product.attributes.length > 0) {
        const allSelected = areAllAttributesSelected(product.attributes, selectedAttributes);
        if (!allSelected) {
          const missingAttributes = product.attributes
            .filter((attr: { name: string }) => !selectedAttributes[attr.name])
            .map((attr: { name: string }) => attr.name);

          addNotification({
            type: 'error',
            message: t('productDetail.selectVariant', { attributes: missingAttributes.join(', ') }),
          });
          return;
        }
      }

      // Kiểm tra tồn kho cho sản phẩm kiểu cũ (legacy)
      availableStock = getVariantStock(product, selectedAttributes);

      if (hasVariants(product) && Object.keys(selectedAttributes).length > 0) {
        const selectedVariant = findVariantByAttributes(product.variants!, selectedAttributes);
        variantId = selectedVariant?.id;
      }
    }

    // Kiểm tra tồn kho
    if (availableStock === 0) {
      addNotification({
        type: 'error',
        message: t('productDetail.stock.outOfStock'),
      });
      return;
    }

    if (quantity > availableStock) {
      addNotification({
        type: 'error',
        message: t('product.stockLimited', { count: availableStock }),
      });
      return;
    }

    if (isAuthenticated) {
      // Nếu đã đăng nhập, sử dụng API
      try {
        const serverCartData = await addToCart({
          productId: product.id,
          variantId,
          quantity,
          warrantyPackageIds: selectedWarranties,
        });

        // Cập nhật Zustand store với response từ server
        setServerCart(serverCartData);

        addNotification({
          message: t('cart.addedToCart', { name: productName }),
          type: 'success',
          duration: 3000,
        });
      } catch (error) {
        console.error('❌ API thất bại:', error);

        // Dự phòng lưu localStorage nếu API thất bại
        const newItem = {
          id: uuidv4(),
          productId: product.id,
          name: productName,
          price:
            product.isVariantProduct && product.currentVariant
              ? product.currentVariant.price
              : getVariantPrice(product, selectedAttributes),
          quantity,
          image:
            product.isVariantProduct && product.currentVariant?.thumbnail
              ? product.currentVariant.thumbnail
              : product.thumbnail,
          variantId,
          attributes: Object.keys(selectedAttributes).length > 0 ? selectedAttributes : undefined,
          warrantyPackageIds: selectedWarranties,
          warrantyPackages:
            product.warrantyPackages?.filter((p) => selectedWarranties.includes(p.id)) || [],
        };

        addItem(newItem);

        addNotification({
          message: getErrorMsg(error, t('cart.notifications.serverError')),
          type: 'error',
          duration: 3000,
        });
      }
    } else {
      // Nếu chưa đăng nhập, KHÔNG gọi API, chỉ lưu vào localStorage
      const newItem = {
        id: uuidv4(),
        productId: product.id,
        name: product.name,
        price:
          product.isVariantProduct && product.currentVariant
            ? product.currentVariant.price
            : getVariantPrice(product, selectedAttributes),
        quantity,
        image:
          product.isVariantProduct && product.currentVariant?.thumbnail
            ? product.currentVariant.thumbnail
            : product.thumbnail,
        variantId,
        attributes: Object.keys(selectedAttributes).length > 0 ? selectedAttributes : undefined,
        warrantyPackageIds: selectedWarranties,
        warrantyPackages:
          product.warrantyPackages?.filter((p) => selectedWarranties.includes(p.id)) || [],
      };

      // Chỉ thêm vào Zustand store, cartStore sẽ tự động cập nhật localStorage
      addItem(newItem);

      addNotification({
        message: t('cart.notifications.addedSuccess'),
        type: 'success',
        duration: 3000,
      });
    }
  };

  const [isBuying, setIsBuying] = useState(false);

  // Mua ngay
  const handleBuyNow = async () => {
    try {
      if (!product) return;
      setIsBuying(true);

      // Tìm variant ID dựa trên thuộc tính đã chọn
      let variantId: string | undefined;
      if (product.variants && Object.keys(selectedAttributes).length > 0) {
        const selectedVariant = // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Variant matching cần dynamic attribute access
          product.variants.find((variant: any) => {
            if (!variant.attributes) return false;
            return Object.entries(selectedAttributes).every(
              ([key, value]) => variant.attributes[key] === value,
            );
          });
        variantId = selectedVariant?.id;
      }

      // Tạo đối tượng sản phẩm để mua ngay
      const price =
        product.isVariantProduct && product.currentVariant
          ? product.currentVariant.price
          : getVariantPrice(product, selectedAttributes);

      const image =
        product.isVariantProduct && product.currentVariant?.thumbnail
          ? product.currentVariant.thumbnail
          : product.thumbnail;

      const buyNowItem = {
        id: uuidv4(),
        productId: product.id,
        variantId: variantId,
        name: product.name,
        price,
        quantity,
        image,
        attributes: Object.keys(selectedAttributes).length > 0 ? selectedAttributes : undefined,
        warrantyPackageIds: selectedWarranties,
        warrantyPackages:
          product.warrantyPackages?.filter((p) => selectedWarranties.includes(p.id)) || [],
      };

      // 3. Lưu thông tin sản phẩm vào sessionStorage để CheckoutPage sử dụng
      // Không gọi addToCart để tránh đi qua giỏ hàng chính
      sessionStorage.setItem('buyNowItem', JSON.stringify(buyNowItem));
      sessionStorage.setItem('buyNowAction', 'true');

      // 4. Chuyển hướng ngay lập tức đến checkout
      navigate('/checkout?buyNow=true');
    } catch (error) {
      console.error('Lỗi khi mua ngay:', error);
      addNotification({
        message: getErrorMsg(error, t('productDetail.buyNow.error')),
        type: 'error',
        duration: 3000,
      });
    } finally {
      setIsBuying(false);
    }
  };

  if (isLoading && !productData) {
    return (
      <div className="container mx-auto px-4 py-16 flex justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-4">
          {t('productDetail.notFound.title')}
        </h1>
        <p className="text-neutral-600 dark:text-neutral-400 mb-8">
          {t('productDetail.notFound.message')}
        </p>
        <PremiumButton
          variant="primary"
          size="large"
          iconType="arrow-right"
          onClick={() => navigate('/shop')}
        >
          {t('productDetail.notFound.continueShopping')}
        </PremiumButton>
      </div>
    );
  }

  // Tra cứu EN value cho attribute từ attributesEn của variant tương ứng
  const getEnAttrValue = (attrName: string, viValue: string): string => {
    if (i18n.language !== 'en') return viValue;
    const match = (product.variants || []).find(
      (v: { attributes?: Record<string, string>; attributesEn?: Record<string, string> }) =>
        v.attributes?.[attrName] === viValue,
    );
    return match?.attributesEn?.[attrName] || viValue;
  };

  // Giá hiển thị: ưu tiên biến thể đang chọn, fallback sang giá cơ sở
  const displayPrice = product.currentVariant?.price ?? product.price;
  const stockCount = product.currentVariant?.stockQuantity ?? product.stock ?? 0;
  const productName = localizeField(product, 'name', i18n.language);
  const productDesc = localizeField(product, 'description', i18n.language);
  const productShortDesc = localizeField(product, 'shortDescription', i18n.language);
  const seoTitleText = product.seoTitle || `${productName} | TechStore`;
  const seoDescText = product.seoDescription || productShortDesc || '';
  const jsonLd = {
    '@context': 'https://schema.org/',
    '@type': 'Product',
    name: productName,
    image: product.thumbnail,
    description: seoDescText,
    ...(product.currentVariant?.sku ? { sku: product.currentVariant.sku } : {}),
    offers: {
      '@type': 'Offer',
      price: displayPrice,
      priceCurrency: 'VND',
      availability: stockCount > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock',
    },
    // aggregateRating chỉ đưa vào khi có ít nhất 1 đánh giá — schema.org yêu cầu reviewCount ≥ 1
    ...((product.ratings?.count ?? 0) > 0
      ? {
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: product.ratings!.average,
            reviewCount: product.ratings!.count,
          },
        }
      : {}),
  };

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Thẻ meta SEO — react-helmet-async */}
      <Helmet>
        <title>{seoTitleText}</title>
        <meta name="description" content={seoDescText} />
        <meta property="og:title" content={productName} />
        <meta property="og:description" content={seoDescText} />
        <meta property="og:image" content={product.thumbnail} />
        <meta property="og:type" content="product" />
        <link
          rel="canonical"
          href={`${import.meta.env.VITE_SITE_URL || 'https://techstore.vn'}/products/${product.slug}`}
        />
        <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
      </Helmet>
      {/* Đường dẫn điều hướng */}
      <nav className="mb-8">
        <ol className="flex text-sm">
          <li className="flex items-center">
            <Link
              to={ROUTES.HOME}
              className="text-neutral-500 dark:text-neutral-400 hover:text-primary-500 dark:hover:text-primary-400"
            >
              {t('productDetail.breadcrumb.home')}
            </Link>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mx-2 text-neutral-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </li>
          <li className="flex items-center">
            <Link
              to={buildRoute.category(
                product.category?.slug || product.categorySlug || product.categoryId,
              )}
              className="text-neutral-500 dark:text-neutral-400 hover:text-primary-500 dark:hover:text-primary-400"
            >
              {localizeField(product.category || product, 'name', i18n.language) ||
                product.categoryName}
            </Link>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mx-2 text-neutral-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </li>
          <li className="text-neutral-800 dark:text-neutral-200 truncate">{productName}</li>
        </ol>
      </nav>

      {/* Chi tiết sản phẩm */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        {/* Hình ảnh sản phẩm */}
        <div>
          <ProductImageGallery
            images={product.images ? product.images.filter(Boolean) : []}
            thumbnail={
              // Ưu tiên thumbnail của variant đang chọn để gallery switch đúng ảnh khi đổi variant
              product.isVariantProduct && product.currentVariant?.thumbnail
                ? product.currentVariant.thumbnail
                : product.thumbnail
            }
            productName={productName}
          />
        </div>

        {/* Thông tin sản phẩm */}
        <div>
          {/* Tiêu đề sản phẩm tiêu chuẩn */}
          <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
            {productName}
          </h1>

          {/* Giá */}
          <div className="flex items-center mb-4">
            {(() => {
              // Dùng giá biến thể hiện tại nếu có, ngược lại dùng logic cũ
              let currentPrice: number;
              let comparePrice: number | null = null;

              if (product.isVariantProduct && product.currentVariant) {
                currentPrice = product.currentVariant.price;
                comparePrice = product.currentVariant.compareAtPrice || null;
              } else {
                currentPrice = getVariantPrice(product, selectedAttributes);
                comparePrice = product.compareAtPrice || null;
              }

              return (
                <>
                  <span className="text-2xl font-bold text-neutral-900 dark:text-white">
                    {parseFloat(currentPrice.toString()).toLocaleString('vi-VN')}
                    {t('common.currencySymbol')}
                  </span>

                  {comparePrice && comparePrice > currentPrice && (
                    <span className="ml-3 text-lg text-neutral-500 dark:text-neutral-400 line-through">
                      {parseFloat(comparePrice.toString()).toLocaleString('vi-VN')}
                      {t('common.currencySymbol')}
                    </span>
                  )}

                  {comparePrice && comparePrice > currentPrice && (
                    <Badge variant="secondary" className="ml-3">
                      {t('product.discountOff', {
                        percent: Math.round(((comparePrice - currentPrice) / comparePrice) * 100),
                      })}
                    </Badge>
                  )}
                </>
              );
            })()}
          </div>

          {/* Đánh giá */}
          {product.ratings && (
            <div className="flex items-center mb-4">
              <Rating
                value={product.ratings.average}
                showCount={true}
                count={product.ratings.count}
              />
              <Link
                to="#reviews"
                className="ml-2 text-sm text-primary-500 hover:text-primary-600 dark:hover:text-primary-400"
              >
                {t('productDetail.viewReviews')}
              </Link>
            </div>
          )}

          {/* Trạng thái tồn kho */}
          <div className="mb-4">
            {(() => {
              // Dùng tồn kho biến thể hiện tại nếu có, nếu không thì fallback sang logic cũ
              let availableStock: number;

              if (product.isVariantProduct && product.currentVariant) {
                availableStock = product.currentVariant.stockQuantity;
              } else {
                availableStock = getVariantStock(product, selectedAttributes);
              }

              const stockText = formatStockText(availableStock);
              const stockColor = getStockStatusColor(availableStock);

              return (
                <div className="flex items-center gap-2">
                  <Badge variant={availableStock > 0 ? 'success' : 'error'}>
                    {availableStock > 0
                      ? t('productDetail.stock.inStock')
                      : t('productDetail.stock.outOfStock')}
                  </Badge>
                  <span className={`text-sm font-medium ${stockColor}`}>{stockText}</span>
                  {product.isVariantProduct && product.currentVariant && (
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      SKU: {product.currentVariant.sku}
                    </span>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Mô tả ngắn */}
          <p className="text-neutral-600 dark:text-neutral-400 mb-6">
            {productShortDesc || productDesc.substring(0, 150) + '...'}
          </p>

          {/* Bộ chọn biến thể sản phẩm - Đã xóa theo yêu cầu vì trùng lặp với bộ chọn thuộc tính */}
          {/* {product.isVariantProduct && (
            <div className="mb-6">
              <ProductVariantSelector
                product={product}
                selectedVariantId={skuId}
                onVariantChange={handleVariantChange}
              />
            </div>
          )} */}

          {/* Bộ chọn thuộc tính động */}
          {product.attributes && product.attributes.length > 0 && (
            <div className="mb-6">
              {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- Attribute shape varies */}
              {product.attributes.map((attribute: any, index: number) => {
                const attributeValuesWithStock = getAttributeValuesWithStock(
                  product,
                  attribute.name,
                  selectedAttributes,
                );

                return (
                  <div key={attribute.id || attribute.name || index} className="mb-4">
                    <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      {t(`productDetail.attributes.${attribute.name.toLowerCase()}`, {
                        defaultValue: attribute.name,
                      })}
                    </h3>

                    <div className="flex flex-wrap gap-2">
                      {attributeValuesWithStock.map(({ value, stock: _stock, available }) => {
                        const isSelected = selectedAttributes[attribute.name] === value;

                        return (
                          <button
                            key={value}
                            onClick={() => handleAttributeChange(attribute.name, value)}
                            disabled={!available}
                            className={`
                                px-4 py-2 text-sm border rounded-lg transition-all duration-200 font-medium
                                ${
                                  isSelected
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-md dark:bg-blue-500 dark:border-blue-500'
                                    : available
                                      ? 'bg-white border-gray-300 text-gray-800 hover:border-blue-500 hover:text-blue-600 hover:shadow-sm dark:bg-neutral-800 dark:border-neutral-600 dark:text-neutral-200 dark:hover:border-blue-400 dark:hover:text-blue-400'
                                      : 'bg-gray-100 border-gray-200 text-gray-400 cursor-not-allowed dark:bg-neutral-700 dark:border-neutral-600 dark:text-neutral-500'
                                }
                              `}
                          >
                            {getEnAttrValue(attribute.name, value)}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Số lượng */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              {t('productDetail.quantityLabel')}
            </h3>
            {(() => {
              const maxStock = getVariantStock(product, selectedAttributes);

              return (
                <div className="flex items-center">
                  <button
                    onClick={() => handleQuantityChange(quantity - 1)}
                    className="w-10 h-10 flex items-center justify-center rounded-l-md border border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={quantity <= 1}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M20 12H4"
                      />
                    </svg>
                  </button>
                  <input
                    type="number"
                    min="1"
                    max={maxStock}
                    value={quantity}
                    onChange={(e) => handleQuantityChange(parseInt(e.target.value) || 1)}
                    className="w-16 h-10 border-t border-b border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 text-center focus:outline-none focus:ring-0"
                  />
                  <button
                    onClick={() => handleQuantityChange(quantity + 1)}
                    className="w-10 h-10 flex items-center justify-center rounded-r-md border border-neutral-300 dark:border-neutral-600 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={quantity >= maxStock}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Chọn gói bảo hành */}
          <WarrantySelection
            warrantyPackages={warrantyPackages}
            onWarrantyChange={handleWarrantyChange}
            selectedPackages={selectedWarranties}
          />

          {/* Các nút hành động */}
          <div className="flex flex-col gap-4 mb-8">
            {(() => {
              const allSelected =
                product && areAllAttributesSelected(product.attributes || [], selectedAttributes);
              const isOutOfStock =
                product.stock <= 0 ||
                (product.isVariantProduct &&
                  product.currentVariant &&
                  product.currentVariant.stockQuantity <= 0);

              const isDisabled = !allSelected || isOutOfStock;

              return (
                <>
                  {!allSelected &&
                    product &&
                    product.attributes &&
                    product.attributes.length > 0 && (
                      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-3 rounded-lg mb-2">
                        <p className="text-sm text-orange-700 dark:text-orange-400 font-medium flex items-center">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 mr-2"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                          </svg>
                          {t('product.selectAttributesRequired')}
                        </p>
                      </div>
                    )}

                  {/* Nút mua ngay */}
                  <PremiumButton
                    variant="secondary"
                    size="large"
                    isProcessing={isBuying}
                    processingText={t('common.processing')}
                    onClick={handleBuyNow}
                    disabled={isDisabled}
                    className={`w-full h-14 ${isDisabled ? 'opacity-60 grayscale-[0.5]' : ''}`}
                  >
                    {isOutOfStock
                      ? t('productDetail.stock.outOfStock')
                      : t('productDetail.buyNow.label')}
                  </PremiumButton>

                  <PremiumButton
                    variant="primary"
                    size="large"
                    iconType="cart"
                    isProcessing={isAddingToCart}
                    processingText={t('common.processing')}
                    onClick={handleAddToCart}
                    disabled={isDisabled}
                    className={`w-full h-14 ${isDisabled ? 'opacity-60 grayscale-[0.5]' : ''}`}
                  >
                    {t('productDetail.addToCart')}
                  </PremiumButton>
                </>
              );
            })()}
          </div>
        </div>

        {/* Thông tin bổ sung */}
        {/* <div className="border-t border-neutral-200 dark:border-neutral-700 pt-6 space-y-4">
            <div className="flex">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-primary-500 dark:text-primary-400 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
                />
              </svg>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                Secure payment
              </span>
            </div>
            <div className="flex">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-primary-500 dark:text-primary-400 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z"
                />
              </svg>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                Free shipping on orders over $50
              </span>
            </div>
            <div className="flex">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-primary-500 dark:text-primary-400 mr-2"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span className="text-sm text-neutral-600 dark:text-neutral-400">
                30-day return policy
              </span>
            </div>
          </div> */}
      </div>

      {/* Phần chi tiết sản phẩm */}
      <ProductDetailsSection
        description={productDesc}
        specifications={
          product.currentVariant?.productSpecifications || product.productSpecifications || []
        }
      />

      {/* Phần câu hỏi thường gặp */}
      <ProductFAQSection faqs={product.faqs || []} />

      {/* Phần đánh giá */}
      <div id="reviews" className="mb-16 mt-20 scroll-mt-24">
        <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-6">
          {t('productDetail.customerReviews')}
        </h2>

        {/* Phần đánh giá */}
        {product?.id && (
          <ProductReviews
            productId={product.id}
            averageRating={product.ratings?.average || 0}
            totalReviews={product.ratings?.count || 0}
          />
        )}
      </div>

      {/* Sản phẩm liên quan */}
      {relatedProducts && relatedProducts.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-6">
            {t('productDetail.relatedProducts')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any -- ProductCard cần full product type */}
            {relatedProducts.slice(0, 4).map((product: any) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>
        </div>
      )}

      {/* Sản phẩm đã xem gần đây */}
      {isAuthenticated && (
        <div className="mt-16">
          <RecentlyViewedProducts limit={5} />
        </div>
      )}
    </div>
  );
};

export default ProductDetailPage;
