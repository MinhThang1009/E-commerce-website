import { PremiumButton } from '@/components/common';
import Badge from '@/components/common/Badge';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { Rating } from '@/components/common/Rating';
import ProductCard from '@/components/features/ProductCard';
import ProductReviews from '@/components/features/ProductReviews';
import WarrantySelection from '@/components/product/WarrantySelection';
import ProductVariantSelector from '@/components/product/ProductVariantSelector';
import DynamicProductTitle from '@/components/product/DynamicProductTitle';
import SimpleDynamicTitle from '@/components/product/SimpleDynamicTitle';
import ProductDetailsSection from '@/components/product/ProductDetailsSection';
import ProductFAQSection from '@/components/product/ProductFAQSection';
import { productApi } from '@/services/productApi';
import { useGetWarrantyPackagesQuery } from '@/services/warrantyApi';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useDispatch, useSelector } from 'react-redux';
import {
  Link,
  useNavigate,
  useParams,
  useSearchParams,
} from 'react-router-dom';
import { RootState } from '@/store';
import { v4 as uuidv4 } from 'uuid';
import ProductImageGallery from '@/components/product/ProductImageGallery';
import RecentlyViewedProducts from '@/components/products/RecentlyViewedProducts';

import { addItem, setServerCart } from '@/features/cart/cartSlice';
import { addNotification } from '@/features/ui/uiSlice';
import { useAddToCartMutation } from '@/services/cartApi';
import {
  getVariantStock,
  findVariantByAttributes,
  getAttributeValuesWithStock,
  areAllAttributesSelected,
  getVariantPrice,
  formatStockText,
  getStockStatusColor,
  hasVariants,
} from '@/utils/productHelpers';

const ProductDetailPage: React.FC = () => {
  const { t } = useTranslation();
  const { productId } = useParams<{ productId: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Lấy thông tin đăng nhập từ Redux store
  const isAuthenticated = useSelector(
    (state: RootState) => state.auth.isAuthenticated
  );

  // Get skuId from URL params
  const skuId = searchParams.get('skuId') || undefined;

  const [quantity, setQuantity] = useState(1);
  const [selectedAttributes, setSelectedAttributes] = useState<
    Record<string, string>
  >({});
  const [selectedWarranties, setSelectedWarranties] = useState<string[]>([]);
  const [dynamicProductName, setDynamicProductName] = useState<string>('');
  const [mappedAttributes, setMappedAttributes] = useState<
    Record<string, string>
  >({});

  const colorParam = (selectedAttributes.color || selectedAttributes['Màu sắc'] || selectedAttributes['màu sắc']) || undefined;

  // API hooks
  const {
    data: productData,
    isLoading,
    error,
    refetch,
  } = productApi.useGetProductByIdQuery(
    { id: productId || '', skuId, color: colorParam },
    {
      skip: !productId,
    }
  );

  const [addToCart, { isLoading: isAddingToCart }] = useAddToCartMutation();

  const { data: relatedProductsData } = productApi.useGetRelatedProductsQuery(
    productData?.data?.id || '',
    {
      skip: !productData?.data?.id,
    }
  );

  const product = productData?.data;
  const relatedProducts = relatedProductsData?.data || [];
  const warrantyPackages = product?.warrantyPackages || [];

  useEffect(() => {
    if (error) {
      navigate('/404');
    }
  }, [error, navigate]);

  // Removed auto-select first variant per user request to force manual selection
  // BUT we still need to sync state if a variant is pre-selected via URL (skuId)
  useEffect(() => {
    if (product && product.isVariantProduct && product.currentVariant && product.currentVariant.attributes) {
      if (Object.keys(selectedAttributes).length === 0) {
        setSelectedAttributes(product.currentVariant.attributes);
        setMappedAttributes(product.currentVariant.attributes);
      }
    }
  }, [product, selectedAttributes]);

  // Set default variant and reset state when product changes
  useEffect(() => {
    if (product) {
      // Clear previous warranties
      setSelectedWarranties([]);
      
      // Auto-select default variant attributes if it's a variant product
      if (product.isVariantProduct && product.currentVariant && product.currentVariant.attributes) {
        setSelectedAttributes(product.currentVariant.attributes);
        setMappedAttributes(product.currentVariant.attributes);
      } else {
        // Reset attributes for non-variant products
        setSelectedAttributes({});
        setMappedAttributes({});
      }
    }
  }, [product?.id]); // Trigger when product ID changes (initial load or navigation)

  // Handle quantity change
  const handleQuantityChange = (newQuantity: number) => {
    if (newQuantity >= 1 && newQuantity <= (product?.stock || 99)) {
      setQuantity(newQuantity);
    }
  };


  // Handle attribute selection with toggle functionality
  const handleAttributeChange = (name: string, value: string) => {
    setSelectedAttributes((prev) => {
      const newAttributes = { ...prev };

      // If clicking on the same value, unselect it
      if (newAttributes[name] === value) {
        delete newAttributes[name];
      } else {
        // Otherwise, select the new value
        newAttributes[name] = value;
      }

      setMappedAttributes(newAttributes);

      // Automatically resolve and update skuId if all attributes are selected
      if (product && hasVariants(product) && product.attributes) {
        const allSelected = areAllAttributesSelected(product.attributes, newAttributes);
        if (allSelected) {
          const matchingVariant = findVariantByAttributes(product.variants || [], newAttributes);
          if (matchingVariant) {
            // Update URL with new skuId (sync with handleVariantChange logic)
            const newSearchParams = new URLSearchParams(searchParams);
            newSearchParams.set('skuId', matchingVariant.id);
            setSearchParams(newSearchParams);
          }
        } else if (skuId) {
          // Clear skuId if selection becomes incomplete
          const newSearchParams = new URLSearchParams(searchParams);
          newSearchParams.delete('skuId');
          setSearchParams(newSearchParams);
        }
      }

      return newAttributes;
    });

    // Reset quantity to 1 when changing attributes
    setQuantity(1);
  };

  const handleDynamicNameUpdate = (newName: string, details: any) => {
    setDynamicProductName(newName);
  };

  // Handle warranty selection
  const handleWarrantyChange = (packageIds: string[]) => {
    setSelectedWarranties(packageIds);
  };

  // Handle variant selection
  const handleVariantChange = (variantId: string) => {
    // Update URL with new skuId
    const newSearchParams = new URLSearchParams(searchParams);
    newSearchParams.set('skuId', variantId);
    setSearchParams(newSearchParams);

    // Reset quantity and image selection
    setQuantity(1);

    // Refetch product data with new variant
    refetch();
  };

  // Add to cart
  const handleAddToCart = async () => {
    if (!product) return;

    // For variant products, use current variant
    let variantId: string | undefined;
    let availableStock: number;

    if (product.isVariantProduct && product.currentVariant) {
      // Use current variant from API response
      variantId = product.currentVariant.id;
      availableStock = product.currentVariant.stockQuantity;
    } else {
      // Legacy attribute-based variant selection
      if (product.attributes && product.attributes.length > 0) {
        const allSelected = areAllAttributesSelected(
          product.attributes,
          selectedAttributes
        );
        if (!allSelected) {
          const missingAttributes = product.attributes
            .filter((attr: any) => !selectedAttributes[attr.name])
            .map((attr: any) => attr.name);

          dispatch(
            addNotification({
              type: 'error',
              message: t('productDetail.selectVariant', { attributes: missingAttributes.join(', ') }),
            })
          );
          return;
        }
      }

      // Check stock availability for legacy products
      availableStock = getVariantStock(product, selectedAttributes);

      if (hasVariants(product) && Object.keys(selectedAttributes).length > 0) {
        const selectedVariant = findVariantByAttributes(
          product.variants!,
          selectedAttributes
        );
        variantId = selectedVariant?.id;
      }
    }

    // Check stock availability
    if (availableStock === 0) {
      dispatch(
        addNotification({
          type: 'error',
          message: t('productDetail.stock.outOfStock'),
        })
      );
      return;
    }

    if (quantity > availableStock) {
      dispatch(
        addNotification({
          type: 'error',
          message: `Chỉ còn ${availableStock} sản phẩm trong kho`,
        })
      );
      return;
    }

    console.log('🔐 isAuthenticated trong handleAddToCart:', isAuthenticated);

    if (isAuthenticated) {
      // Nếu đã đăng nhập, sử dụng API
      try {
        console.log('🚀 Đã đăng nhập, gọi API để thêm vào giỏ hàng:', {
          productId: product.id,
          variantId,
          quantity,
        });

        const serverCart = await addToCart({
          productId: product.id,
          variantId,
          quantity,
          warrantyPackageIds: selectedWarranties,
        }).unwrap();

        console.log('✅ API success, server cart:', serverCart);

        // Update Redux store with server response
        dispatch(setServerCart(serverCart));

        dispatch(
          addNotification({
            message: `${product.name} đã được thêm vào giỏ hàng`,
            type: 'success',
            duration: 3000,
          })
        );
      } catch (error: any) {
        console.error('❌ API thất bại:', error);

        // Fallback to localStorage if API fails
        const newItem = {
          id: uuidv4(),
          productId: product.id,
          name: product.name,
          price: product.isVariantProduct && product.currentVariant
            ? product.currentVariant.price
            : getVariantPrice(product, selectedAttributes),
          quantity,
          image: product.isVariantProduct && product.currentVariant?.thumbnail
            ? product.currentVariant.thumbnail
            : product.thumbnail,
          variantId,
          attributes:
            Object.keys(selectedAttributes).length > 0
              ? selectedAttributes
              : undefined,
          warrantyPackageIds: selectedWarranties,
          warrantyPackages: product.warrantyPackages?.filter((p: any) => selectedWarranties.includes(p.id)) || [],
        };

        dispatch(addItem(newItem));

        dispatch(
          addNotification({
            message:
              error?.data?.message ||
              t('cart.notifications.serverError'),
            type: error?.data?.message ? 'error' : 'success',
            duration: 3000,
          })
        );
      }
    } else {
      // Nếu chưa đăng nhập, KHÔNG gọi API, chỉ lưu vào localStorage
      console.log('🔐 Chưa đăng nhập, chỉ lưu vào localStorage');

      const newItem = {
        id: uuidv4(),
        productId: product.id,
        name: product.name,
        price: product.isVariantProduct && product.currentVariant
          ? product.currentVariant.price
          : getVariantPrice(product, selectedAttributes),
        quantity,
        image: product.isVariantProduct && product.currentVariant?.thumbnail
          ? product.currentVariant.thumbnail
          : product.thumbnail,
        variantId,
        attributes:
          Object.keys(selectedAttributes).length > 0
            ? selectedAttributes
            : undefined,
        warrantyPackageIds: selectedWarranties,
        warrantyPackages: product.warrantyPackages?.filter((p: any) => selectedWarranties.includes(p.id)) || [],
      };

      // Chỉ thêm vào Redux store, cartSlice sẽ tự động cập nhật localStorage
      dispatch(addItem(newItem));

      // Debug: Check if localStorage was updated
      console.log(
        '🔍 localStorage after add:',
        localStorage.getItem('cartItems')
      );

      dispatch(
        addNotification({
          message: t('cart.notifications.cleared'), // Reusing cleared msg or similar. Wait I should use "Added to cart"
          type: 'success',
          duration: 3000,
        })
      );
    }
  };

  const [isBuying, setIsBuying] = useState(false);

  // Buy now
  const handleBuyNow = async () => {
    try {
      if (!product) return;
      setIsBuying(true);

      // Tìm variant ID dựa trên thuộc tính đã chọn
      let variantId: string | undefined;
      if (product.variants && Object.keys(selectedAttributes).length > 0) {
        const selectedVariant = product.variants.find((variant: any) => {
          if (!variant.attributes) return false;
          return Object.entries(selectedAttributes).every(
            ([key, value]) => variant.attributes[key] === value
          );
        });
        variantId = selectedVariant?.id;
      }

      // Tạo đối tượng sản phẩm để mua ngay
      const price = product.isVariantProduct && product.currentVariant
        ? product.currentVariant.price
        : getVariantPrice(product, selectedAttributes);
      
      const image = product.isVariantProduct && product.currentVariant?.thumbnail
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
        warrantyPackages: product.warrantyPackages?.filter((p: any) => selectedWarranties.includes(p.id)) || [],
      };

      // 3. Lưu thông tin sản phẩm vào sessionStorage để CheckoutPage sử dụng
      // Không gọi addToCart hay dispatch(addItem) để tránh đi qua giỏ hàng chính
      sessionStorage.setItem('buyNowItem', JSON.stringify(buyNowItem));
      sessionStorage.setItem('buyNowAction', 'true');

      // 4. Chuyển hướng ngay lập tức đến checkout
      navigate('/checkout?buyNow=true');
    } catch (error: any) {
      console.error('Error buying now:', error);
      dispatch(
        addNotification({
          message: error?.data?.message || 'Có lỗi xảy ra khi mua ngay',
          type: 'error',
          duration: 3000,
        })
      );
    } finally {
      setIsBuying(false);
    }
  };

  if (isLoading) {
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

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Breadcrumbs */}
      <nav className="mb-8">
        <ol className="flex text-sm">
          <li className="flex items-center">
            <Link
              to="/"
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
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </li>
          <li className="flex items-center">
            <Link
              to={`/categories/${product.category?.slug || product.categorySlug || product.categoryId}`}
              className="text-neutral-500 dark:text-neutral-400 hover:text-primary-500 dark:hover:text-primary-400"
            >
              {product.category?.name || product.categoryName}
            </Link>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4 mx-2 text-neutral-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </li>
          <li className="text-neutral-800 dark:text-neutral-200 truncate">
            {product.name}
          </li>
        </ol>
      </nav>

      {/* Product details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
        {/* Product images */}
        <div>
          <ProductImageGallery
            images={product.images ? product.images.map((img: any) => typeof img === 'string' ? img : img.url).filter(Boolean) : []}
            thumbnail={product.thumbnail}
            productName={product.name}
          />
        </div>

        {/* Product info */}
        <div>
            {/* Standard Product Title */}
            <h1 className="text-3xl font-bold text-neutral-900 dark:text-white mb-2">
              {product.name}
            </h1>

            {/* Price */}
            <div className="flex items-center mb-4">
              {(() => {
                // Use current variant price if available, otherwise fallback to legacy logic
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
                      {parseFloat(currentPrice.toString()).toLocaleString(
                        'vi-VN'
                      )}
                      đ
                    </span>

                    {comparePrice && comparePrice > currentPrice && (
                      <span className="ml-3 text-lg text-neutral-500 dark:text-neutral-400 line-through">
                        {parseFloat(comparePrice.toString()).toLocaleString(
                          'vi-VN'
                        )}
                        đ
                      </span>
                    )}

                    {comparePrice && comparePrice > currentPrice && (
                      <Badge variant="secondary" className="ml-3">
                        {Math.round(
                          ((comparePrice - currentPrice) / comparePrice) * 100
                        )}
                        % OFF
                      </Badge>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Ratings */}
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

            {/* Stock status */}
            <div className="mb-4">
              {(() => {
                // Use current variant stock if available, otherwise fallback to legacy logic
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
                      {availableStock > 0 ? t('productDetail.stock.inStock') : t('productDetail.stock.outOfStock')}
                    </Badge>
                    <span className={`text-sm font-medium ${stockColor}`}>
                      {stockText}
                    </span>
                    {product.isVariantProduct && product.currentVariant && (
                      <span className="text-xs text-neutral-500 dark:text-neutral-400">
                        SKU: {product.currentVariant.sku}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            {/* Short description */}
            <p className="text-neutral-600 dark:text-neutral-400 mb-6">
              {product.shortDescription ||
                product.description.substring(0, 150) + '...'}
            </p>


          {/* Product Variant Selector - Removed per user request as it's redundant with attribute selector */}
          {/* {product.isVariantProduct && (
            <div className="mb-6">
              <ProductVariantSelector
                product={product}
                selectedVariantId={skuId}
                onVariantChange={handleVariantChange}
              />
            </div>
          )} */}

          {/* Dynamic Attributes Selector */}
          {product.attributes && product.attributes.length > 0 && (
            <div className="mb-6">
              {product.attributes.map((attribute: any, index: number) => {
                const attributeValuesWithStock = getAttributeValuesWithStock(
                  product,
                  attribute.name,
                  selectedAttributes
                );

                return (
                  <div key={attribute.id || attribute.name || index} className="mb-4">
                    <h3 className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                      {attribute.name.toLowerCase() === 'storage' ? 'Dung lượng' : 
                       attribute.name.toLowerCase() === 'color' ? 'Màu sắc' : 
                       attribute.name.toLowerCase() === 'ram' ? 'Bộ nhớ (RAM)' :
                       attribute.name}
                    </h3>

                    <div className="flex flex-wrap gap-2">
                      {attributeValuesWithStock.map(
                        ({ value, stock, available }) => {
                          const isSelected =
                            selectedAttributes[attribute.name] === value;

                          return (
                            <button
                              key={value}
                              onClick={() =>
                                handleAttributeChange(attribute.name, value)
                              }
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
                              {value}
                            </button>
                          );
                        }
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Quantity */}
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
                    onChange={(e) =>
                      handleQuantityChange(parseInt(e.target.value) || 1)
                    }
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

          {/* Warranty Selection */}
          <WarrantySelection
            warrantyPackages={warrantyPackages}
            onWarrantyChange={handleWarrantyChange}
            selectedPackages={selectedWarranties}
          />

          {/* Actions */}
          <div className="flex flex-col gap-4 mb-8">
            {(() => {
              const allSelected = product && areAllAttributesSelected(product.attributes || [], selectedAttributes);
              const isOutOfStock = product.stock <= 0 || (product.isVariantProduct && product.currentVariant && product.currentVariant.stockQuantity <= 0);
              
              const isDisabled = !allSelected || isOutOfStock;

              return (
                <>
                  {!allSelected && product && product.attributes && product.attributes.length > 0 && (
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-3 rounded-lg mb-2">
                      <p className="text-sm text-orange-700 dark:text-orange-400 font-medium flex items-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        Vui lòng chọn đầy đủ các thuộc tính để mua hàng
                      </p>
                    </div>
                  )}

                  {/* Buy now button */}
                  <PremiumButton
                    variant="secondary"
                    size="large"
                    isProcessing={isBuying}
                    processingText={t('common.processing')}
                    onClick={handleBuyNow}
                    disabled={isDisabled}
                    className={`w-full h-14 ${!allSelected ? 'opacity-60 grayscale-[0.5]' : ''}`}
                  >
                    MUA NGAY
                  </PremiumButton>

                  <PremiumButton
                    variant="primary"
                    size="large"
                    iconType="cart"
                    isProcessing={isAddingToCart}
                    processingText={t('common.processing')}
                    onClick={handleAddToCart}
                    disabled={isDisabled}
                    className={`w-full h-14 ${!allSelected ? 'opacity-60 grayscale-[0.5]' : ''}`}
                  >
                    {t('productDetail.addToCart')}
                  </PremiumButton>
                </>
              );
            })()}
          </div>
        </div>

          {/* Additional info */}
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
        
      {/* Product Details Section */}
      <ProductDetailsSection
        description={product.description}
        specifications={product.currentVariant?.productSpecifications || product.productSpecifications || []}
      />

      {/* FAQ Section */}
      <ProductFAQSection faqs={product.faqs || []} />

      {/* Reviews section */}
      <div id="reviews" className="mb-16 mt-20 scroll-mt-24">
        <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-6">
          {t('productDetail.customerReviews')}
        </h2>

        {/* Reviews section */}
        {product?.id && (
          <ProductReviews
            productId={product.id}
            averageRating={product.ratings?.average || 0}
            totalReviews={product.ratings?.count || 0}
          />
        )}
      </div>

      {/* Related products */}
      {relatedProducts && relatedProducts.length > 0 && (
        <div>
          <h2 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100 mb-6">
            {t('productDetail.relatedProducts')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {relatedProducts.slice(0, 4).map((product: any) => (
              <ProductCard key={product.id} {...product} />
            ))}
          </div>
        </div>
      )}

      {/* Recently viewed products */}
      {isAuthenticated && (
        <div className="mt-16">
          <RecentlyViewedProducts limit={5} />
        </div>
      )}
    </div>
  );
};

export default ProductDetailPage;
