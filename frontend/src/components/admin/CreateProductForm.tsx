import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useCreateProductMutation } from '@/services/adminProductApi';
import { useGetCategoriesQuery } from '@/services/categoryApi';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import Modal from '@/components/common/Modal';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import {
  PlusIcon,
  TrashIcon,
  TagIcon,
  CurrencyDollarIcon,
  PhotoIcon,
  DocumentTextIcon,
  MagnifyingGlassIcon,
  SwatchIcon,
  Square2StackIcon,
} from '@heroicons/react/24/outline';

interface CreateProductFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Attribute {
  id: string;
  name: string;
  value: string;
}

interface Variant {
  id: string;
  name: string;
  price: number;
  stock: number;
}

const CreateProductForm: React.FC<CreateProductFormProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { t } = useTranslation();
  const [createProduct, { isLoading }] = useCreateProductMutation();
  const { data: categories, isLoading: isCategoriesLoading } =
    useGetCategoriesQuery();
  const [activeTab, setActiveTab] = useState('basic');

  const statusOptions = [
    { value: 'active', label: t('createProduct.statusActive') },
    { value: 'inactive', label: t('createProduct.statusInactive') },
    { value: 'draft', label: t('createProduct.statusDraft') },
  ];

  // Trạng thái form
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    shortDescription: '',
    price: '',
    comparePrice: '',
    stock: '',
    sku: '',
    status: 'active',
    categoryIds: [] as string[],
    images: '',
    thumbnail: '',
    featured: false,
    searchKeywords: '',
    seoTitle: '',
    seoDescription: '',
    seoKeywords: '',
  });

  const [attributes, setAttributes] = useState<Attribute[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Tự động điền các trường SEO khi tên và mô tả thay đổi
  useEffect(() => {
    if (formData.name && !formData.seoTitle) {
      setFormData((prev) => ({ ...prev, seoTitle: prev.name }));
    }
    if (formData.description && !formData.seoDescription) {
      setFormData((prev) => ({
        ...prev,
        seoDescription: prev.description.substring(0, 160),
      }));
    }
    if (formData.description && !formData.shortDescription) {
      setFormData((prev) => ({
        ...prev,
        shortDescription: prev.description.substring(0, 200),
      }));
    }
  }, [formData.name, formData.description]);

  // Các hàm xử lý form
  const handleInputChange = (
    field: string,
    value: string | string[] | boolean
  ) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  // Các hàm xử lý thuộc tính
  const addAttribute = () => {
    setAttributes([
      ...attributes,
      { id: Date.now().toString(), name: '', value: '' },
    ]);
  };

  const updateAttribute = (id: string, field: string, value: string) => {
    setAttributes(
      attributes.map((attr) =>
        attr.id === id ? { ...attr, [field]: value } : attr
      )
    );
  };

  const removeAttribute = (id: string) => {
    setAttributes(attributes.filter((attr) => attr.id !== id));
  };

  // Các hàm xử lý biến thể
  const addVariant = () => {
    setVariants([
      ...variants,
      { id: Date.now().toString(), name: '', price: 0, stock: 0 },
    ]);
  };

  const updateVariant = (id: string, field: string, value: string | number) => {
    setVariants(
      variants.map((variant) =>
        variant.id === id ? { ...variant, [field]: value } : variant
      )
    );
  };

  const removeVariant = (id: string) => {
    setVariants(variants.filter((variant) => variant.id !== id));
  };

  // Xác thực form
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = t('createProduct.nameRequired');
    }

    if (!formData.description.trim()) {
      newErrors.description = t('createProduct.descRequired');
    }

    if (!formData.shortDescription.trim()) {
      newErrors.shortDescription = t('createProduct.shortDescRequired');
    }

    if (!formData.price || Number(formData.price) <= 0) {
      newErrors.price = t('createProduct.priceRequired');
    }

    if (!formData.stock || Number(formData.stock) < 0) {
      newErrors.stock = t('createProduct.stockRequired');
    }

    if (!formData.sku.trim()) {
      newErrors.sku = t('createProduct.skuRequired');
    }

    if (formData.categoryIds.length === 0) {
      newErrors.categoryIds = t('createProduct.categoryRequired');
    }

    setErrors(newErrors);

    // Nếu có lỗi, chuyển sang tab chứa lỗi đầu tiên
    if (Object.keys(newErrors).length > 0) {
      if (
        newErrors.name ||
        newErrors.sku ||
        newErrors.description ||
        newErrors.shortDescription
      ) {
        setActiveTab('basic');
      } else if (newErrors.price || newErrors.stock) {
        setActiveTab('pricing');
      } else if (newErrors.categoryIds) {
        setActiveTab('categories');
      }
    }

    return Object.keys(newErrors).length === 0;
  };

  // Gửi form
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const productData = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        shortDescription: formData.shortDescription.trim(),
        price: Number(formData.price),
        comparePrice: formData.comparePrice
          ? Number(formData.comparePrice)
          : undefined,
        stockQuantity: Number(formData.stock),
        sku: formData.sku.trim(),
        status: formData.status as 'active' | 'inactive' | 'draft',
        categoryIds: formData.categoryIds,
        images: formData.images
          ? formData.images.split(',').map((img) => img.trim())
          : [],
        thumbnail:
          formData.thumbnail ||
          (formData.images ? formData.images.split(',')[0]?.trim() : ''),
        featured: formData.featured,
        searchKeywords: formData.searchKeywords
          ? formData.searchKeywords.split(',').map((kw) => kw.trim())
          : [],
        seoTitle: formData.seoTitle || formData.name.trim(),
        seoDescription:
          formData.seoDescription || formData.shortDescription.trim(),
        seoKeywords: formData.seoKeywords
          ? formData.seoKeywords.split(',').map((kw) => kw.trim())
          : [],
        attributes: attributes
          .filter((attr) => attr.name.trim() && attr.value.trim())
          .map((attr) => ({
            name: attr.name.trim(),
            value: attr.value.trim(),
          })),
        variants: variants
          .filter((variant) => variant.name.trim())
          .map((variant) => ({
            name: variant.name.trim(),
            price: variant.price,
            stock: variant.stock,
          })),
      };

      await createProduct(productData).unwrap();

      // Đặt lại form về trạng thái ban đầu
      setFormData({
        name: '',
        description: '',
        shortDescription: '',
        price: '',
        comparePrice: '',
        stock: '',
        sku: '',
        status: 'active',
        categoryIds: [],
        images: '',
        thumbnail: '',
        featured: false,
        searchKeywords: '',
        seoTitle: '',
        seoDescription: '',
        seoKeywords: '',
      });
      setAttributes([]);
      setVariants([]);
      setErrors({});
      setActiveTab('basic');

      onSuccess?.();
      onClose();
    } catch (error: any) {
      console.error('Tạo sản phẩm thất bại:', error);
      if (error?.data?.errors) {
        const apiErrors: Record<string, string> = {};
        error.data.errors.forEach((err: any) => {
          apiErrors[err.field] = err.message;
        });
        setErrors(apiErrors);
      }
    }
  };

  // Định nghĩa các tab
  const tabs = [
    {
      id: 'basic',
      label: t('createProduct.tabBasic'),
      icon: <DocumentTextIcon className="w-5 h-5" />,
    },
    {
      id: 'pricing',
      label: t('createProduct.tabPricing'),
      icon: <CurrencyDollarIcon className="w-5 h-5" />,
    },
    {
      id: 'categories',
      label: t('createProduct.tabCategories'),
      icon: <TagIcon className="w-5 h-5" />,
    },
    {
      id: 'images',
      label: t('createProduct.tabImages'),
      icon: <PhotoIcon className="w-5 h-5" />,
    },
    {
      id: 'seo',
      label: t('createProduct.tabSeo'),
      icon: <MagnifyingGlassIcon className="w-5 h-5" />,
    },
    {
      id: 'attributes',
      label: t('createProduct.tabAttributes'),
      icon: <SwatchIcon className="w-5 h-5" />,
    },
    {
      id: 'variants',
      label: t('createProduct.tabVariants'),
      icon: <Square2StackIcon className="w-5 h-5" />,
    },
  ];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('createProduct.modalTitle')}
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            disabled={isLoading}
            className="text-neutral-700 dark:text-neutral-300"
          >
            <span className="inline-block">{t('common.cancel')}</span>
          </Button>
          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={isLoading}
            className="bg-primary-500 text-white dark:bg-primary-400 dark:text-neutral-900"
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <LoadingSpinner size="small" />
                <span className="inline-block">{t('createProduct.processing')}</span>
              </div>
            ) : (
              <span className="inline-block">{t('createProduct.createBtn')}</span>
            )}
          </Button>
        </div>
      }
    >
      <div className="overflow-y-auto max-h-[70vh]">
        {/* Điều hướng tab */}
        <div className="flex overflow-x-auto mb-6 border-b border-gray-200 dark:border-gray-700 pb-1 gap-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center px-4 py-2 text-sm font-medium rounded-t-lg whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border-b-2 border-primary-500 dark:border-primary-400'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <span className="mr-2">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        <form className="space-y-6 px-1">
          {/* Thông tin cơ bản */}
          <div
            className={`space-y-6 ${activeTab === 'basic' ? 'block' : 'hidden'}`}
          >
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-lg mb-4 text-neutral-800 dark:text-neutral-200 flex items-center">
                <DocumentTextIcon className="w-5 h-5 mr-2 text-primary-500" />
                {t('createProduct.basicTitle')}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                    {t('createProduct.nameLabel')} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    error={errors.name}
                    placeholder={t('createProduct.namePlaceholder')}
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                    {t('createProduct.skuLabel')} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    value={formData.sku}
                    onChange={(e) => handleInputChange('sku', e.target.value)}
                    error={errors.sku}
                    placeholder={t('createProduct.skuPlaceholder')}
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                    {t('createProduct.shortDescLabel')} <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <textarea
                      value={formData.shortDescription}
                      onChange={(e) =>
                        handleInputChange('shortDescription', e.target.value)
                      }
                      rows={2}
                      maxLength={200}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white text-neutral-800 dark:text-neutral-200"
                      placeholder={t('createProduct.shortDescPlaceholder')}
                    />
                    <div className="absolute bottom-2 right-2 text-xs text-gray-500 dark:text-gray-400">
                      {formData.shortDescription.length}/200
                    </div>
                  </div>
                  {errors.shortDescription && (
                    <p className="mt-1 text-sm text-red-500">
                      {errors.shortDescription}
                    </p>
                  )}
                </div>

                <div>
                  <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                    {t('createProduct.detailDescLabel')} <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      handleInputChange('description', e.target.value)
                    }
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white text-neutral-800 dark:text-neutral-200"
                    placeholder={t('createProduct.detailDescPlaceholder')}
                  />
                  {errors.description && (
                    <p className="mt-1 text-sm text-red-500">
                      {errors.description}
                    </p>
                  )}
                </div>

                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="featured"
                    checked={formData.featured as boolean}
                    onChange={(e) =>
                      handleInputChange('featured', e.target.checked)
                    }
                    className="h-4 w-4 text-primary-500 focus:ring-primary-400 border-gray-300 rounded"
                  />
                  <label
                    htmlFor="featured"
                    className="ml-2 block text-sm text-gray-700 dark:text-gray-300"
                  >
                    {t('createProduct.featuredLabel')}
                  </label>
                </div>
              </div>
            </div>
          </div>

          {/* Giá & Kho hàng */}
          <div
            className={`space-y-6 ${activeTab === 'pricing' ? 'block' : 'hidden'}`}
          >
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-lg mb-4 text-neutral-800 dark:text-neutral-200 flex items-center">
                <CurrencyDollarIcon className="w-5 h-5 mr-2 text-primary-500" />
                {t('createProduct.pricingTitle')}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                    {t('createProduct.salePriceLabel')} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    value={formData.price}
                    onChange={(e) => handleInputChange('price', e.target.value)}
                    error={errors.price}
                    placeholder="0"
                    min="0"
                  />
                </div>

                <div>
                  <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                    {t('createProduct.originalPriceLabel')}
                  </label>
                  <Input
                    type="number"
                    value={formData.comparePrice}
                    onChange={(e) =>
                      handleInputChange('comparePrice', e.target.value)
                    }
                    placeholder="0"
                    min="0"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('createProduct.originalPriceHint')}
                  </p>
                </div>

                <div>
                  <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                    {t('createProduct.qtyLabel')} <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="number"
                    value={formData.stock}
                    onChange={(e) => handleInputChange('stock', e.target.value)}
                    error={errors.stock}
                    placeholder="0"
                    min="0"
                  />
                </div>
              </div>

              {/* Mẹo về giá */}
              <div className="mt-6 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/50">
                <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-2 flex items-center">
                  <svg
                    className="w-4 h-4 mr-1"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2h-1V9z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {t('createProduct.priceTipTitle')}
                </h4>
                <ul className="text-sm text-blue-600 dark:text-blue-300 space-y-1">
                  <li className="flex items-start">
                    <span className="text-green-500 mr-1">✓</span>
                    <span>{t('createProduct.priceTip1')}</span>
                  </li>
                  <li className="flex items-start">
                    <span className="text-green-500 mr-1">✓</span>
                    <span>{t('createProduct.priceTip2')}</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Phân loại & Trạng thái */}
          <div
            className={`space-y-6 ${activeTab === 'categories' ? 'block' : 'hidden'}`}
          >
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-lg mb-4 text-neutral-800 dark:text-neutral-200 flex items-center">
                <TagIcon className="w-5 h-5 mr-2 text-primary-500" />
                {t('createProduct.catSectionTitle')}
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                    {t('createProduct.catLabel')} <span className="text-red-500">*</span>
                  </label>
                  <select
                    multiple
                    value={formData.categoryIds}
                    onChange={(e) => {
                      const values = Array.from(
                        e.target.selectedOptions,
                        (option) => option.value
                      );
                      handleInputChange('categoryIds', values);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white text-neutral-800 dark:text-neutral-200"
                    size={5}
                  >
                    {isCategoriesLoading ? (
                      <option disabled>{t('createProduct.catLoading')}</option>
                    ) : categories && categories.length > 0 ? (
                      categories.map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))
                    ) : (
                      <option disabled>{t('createProduct.catEmpty')}</option>
                    )}
                  </select>
                  {errors.categoryIds && (
                    <p className="mt-1 text-sm text-red-500">
                      {errors.categoryIds}
                    </p>
                  )}
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('createProduct.catHint')}
                  </p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                      {t('createProduct.statusLabel')}
                    </label>
                    <Select
                      options={statusOptions}
                      value={formData.status}
                      onChange={(value) => handleInputChange('status', value)}
                    />
                  </div>

                  <div>
                    <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                      {t('createProduct.searchKwLabel')}
                    </label>
                    <Input
                      value={formData.searchKeywords}
                      onChange={(e) =>
                        handleInputChange('searchKeywords', e.target.value)
                      }
                      placeholder={t('createProduct.searchKwPlaceholder')}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t('createProduct.searchKwHint')}
                    </p>
                  </div>
                </div>
              </div>

              {/* Danh mục đã chọn */}
              {formData.categoryIds.length > 0 && (
                <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-100 dark:border-blue-800/50">
                  <h4 className="font-medium text-blue-700 dark:text-blue-300 mb-2">
                    {t('createProduct.catSelectedLabel')}
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {formData.categoryIds.map((categoryId) => {
                      const category = categories?.find(
                        (c) => c.id === categoryId
                      );
                      return category ? (
                        <span
                          key={categoryId}
                          className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300"
                        >
                          {category.name}
                        </span>
                      ) : null;
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Hình ảnh */}
          <div
            className={`space-y-6 ${activeTab === 'images' ? 'block' : 'hidden'}`}
          >
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-lg mb-4 text-neutral-800 dark:text-neutral-200 flex items-center">
                <PhotoIcon className="w-5 h-5 mr-2 text-primary-500" />
                {t('createProduct.imagesSectionTitle')}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                    {t('createProduct.imageUrlsLabel')}
                  </label>
                  <textarea
                    value={formData.images}
                    onChange={(e) =>
                      handleInputChange('images', e.target.value)
                    }
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white text-neutral-800 dark:text-neutral-200"
                    placeholder="https://example.com/image1.jpg, https://example.com/image2.jpg"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('createProduct.imageUrlsHint')}
                  </p>
                </div>

                <div>
                  <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                    {t('createProduct.thumbnailLabel')}
                  </label>
                  <Input
                    value={formData.thumbnail}
                    onChange={(e) =>
                      handleInputChange('thumbnail', e.target.value)
                    }
                    placeholder="https://example.com/thumbnail.jpg"
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('createProduct.thumbnailHint')}
                  </p>
                </div>
              </div>

              {/* Xem trước ảnh */}
              {formData.images && (
                <div className="mt-4 p-3 bg-gray-100 dark:bg-gray-700 rounded-lg">
                  <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-2">
                    {t('createProduct.imagePreviewLabel')}
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {formData.images.split(',').map((url, index) => (
                      <div
                        key={index}
                        className="relative aspect-square bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600 overflow-hidden"
                      >
                        <img
                          src={url.trim()}
                          alt={`Preview ${index + 1}`}
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src =
                              'https://via.placeholder.com/150?text=Error';
                          }}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SEO Tab */}
          <div
            className={`space-y-6 ${activeTab === 'seo' ? 'block' : 'hidden'}`}
          >
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h3 className="font-medium text-lg mb-4 text-neutral-800 dark:text-neutral-200 flex items-center">
                <MagnifyingGlassIcon className="w-5 h-5 mr-2 text-primary-500" />
                {t('createProduct.seoSectionTitle')}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                    {t('createProduct.seoTitleLabel')}
                  </label>
                  <div className="relative">
                    <Input
                      value={formData.seoTitle}
                      onChange={(e) =>
                        handleInputChange('seoTitle', e.target.value)
                      }
                      placeholder={t('createProduct.seoTitlePlaceholder')}
                      maxLength={60}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t('createProduct.seoTitleHint', { count: formData.seoTitle.length })}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                    {t('createProduct.seoDescLabel')}
                  </label>
                  <div className="relative">
                    <textarea
                      value={formData.seoDescription}
                      onChange={(e) =>
                        handleInputChange('seoDescription', e.target.value)
                      }
                      rows={3}
                      maxLength={160}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500 dark:bg-gray-700 dark:text-white text-neutral-800 dark:text-neutral-200"
                      placeholder={t('createProduct.seoDescPlaceholder')}
                    />
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {t('createProduct.seoDescHint', { count: formData.seoDescription.length })}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                    {t('createProduct.seoKwLabel')}
                  </label>
                  <Input
                    value={formData.seoKeywords}
                    onChange={(e) =>
                      handleInputChange('seoKeywords', e.target.value)
                    }
                    placeholder={t('createProduct.seoKwPlaceholder')}
                  />
                  <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                    {t('createProduct.seoKwHint')}
                  </p>
                </div>
              </div>

              {/* Xem trước SEO */}
              <div className="mt-6 p-4 bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <h4 className="font-medium text-gray-700 dark:text-gray-300 mb-3">
                  {t('createProduct.seoPreviewLabel')}
                </h4>
                <div className="space-y-1">
                  <div className="text-blue-600 dark:text-blue-400 text-lg font-medium line-clamp-1">
                    {formData.seoTitle || formData.name || t('createProduct.seoDefaultTitle')}
                  </div>
                  <div className="text-green-700 dark:text-green-500 text-sm">
                    www.yourdomain.com/products/
                    {formData.name
                      ? formData.name
                          .toLowerCase()
                          .replace(/[^\w\s]/gi, '')
                          .replace(/\s+/g, '-')
                      : 'ten-san-pham'}
                  </div>
                  <div className="text-gray-600 dark:text-gray-400 text-sm line-clamp-2">
                    {formData.seoDescription ||
                      formData.shortDescription ||
                      formData.description ||
                      t('createProduct.seoDefaultDesc')}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Thuộc tính */}
          <div
            className={`space-y-6 ${activeTab === 'attributes' ? 'block' : 'hidden'}`}
          >
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-lg text-neutral-800 dark:text-neutral-200 flex items-center">
                  <SwatchIcon className="w-5 h-5 mr-2 text-primary-500" />
                  {t('createProduct.attrSectionTitle')}
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addAttribute}
                  className="text-primary-500 dark:text-primary-400 border-primary-500 dark:border-primary-400"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  <span className="inline-block">{t('createProduct.addAttrBtn')}</span>
                </Button>
              </div>

              {attributes.length === 0 ? (
                <div className="text-center py-6 text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-md border border-dashed border-gray-300 dark:border-gray-600">
                  <p>{t('createProduct.attrsEmpty')}</p>
                  <button
                    type="button"
                    onClick={addAttribute}
                    className="mt-2 text-primary-500 dark:text-primary-400 hover:underline text-sm font-medium"
                  >
                    {t('createProduct.addAttrLink')}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {attributes.map((attribute) => (
                    <div key={attribute.id} className="flex gap-3 items-end">
                      <div className="flex-1">
                        <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                          {t('createProduct.attrNameLabel')}
                        </label>
                        <Input
                          placeholder={t('createProduct.attrNamePlaceholder')}
                          value={attribute.name}
                          onChange={(e) =>
                            updateAttribute(
                              attribute.id,
                              'name',
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                          {t('createProduct.attrValueLabel')}
                        </label>
                        <Input
                          placeholder={t('createProduct.attrValuePlaceholder')}
                          value={attribute.value}
                          onChange={(e) =>
                            updateAttribute(
                              attribute.id,
                              'value',
                              e.target.value
                            )
                          }
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeAttribute(attribute.id)}
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800"
                      >
                        <TrashIcon className="h-4 w-4" />
                        <span className="sr-only">{t('createProduct.removeAttrSr')}</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Biến thể */}
          <div
            className={`space-y-6 ${activeTab === 'variants' ? 'block' : 'hidden'}`}
          >
            <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-medium text-lg text-neutral-800 dark:text-neutral-200 flex items-center">
                  <Square2StackIcon className="w-5 h-5 mr-2 text-primary-500" />
                  {t('createProduct.variantSectionTitle')}
                </h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addVariant}
                  className="text-primary-500 dark:text-primary-400 border-primary-500 dark:border-primary-400"
                >
                  <PlusIcon className="h-4 w-4 mr-1" />
                  <span className="inline-block">{t('createProduct.addVariantBtn')}</span>
                </Button>
              </div>

              {variants.length === 0 ? (
                <div className="text-center py-6 text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700 rounded-md border border-dashed border-gray-300 dark:border-gray-600">
                  <p>{t('createProduct.variantsEmpty')}</p>
                  <button
                    type="button"
                    onClick={addVariant}
                    className="mt-2 text-primary-500 dark:text-primary-400 hover:underline text-sm font-medium"
                  >
                    {t('createProduct.addVariantLink')}
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {variants.map((variant) => (
                    <div
                      key={variant.id}
                      className="grid grid-cols-1 md:grid-cols-4 gap-3 items-end"
                    >
                      <div>
                        <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                          {t('createProduct.variantNameLabel')}
                        </label>
                        <Input
                          placeholder={t('createProduct.variantNamePlaceholder')}
                          value={variant.name}
                          onChange={(e) =>
                            updateVariant(variant.id, 'name', e.target.value)
                          }
                        />
                      </div>
                      <div>
                        <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                          {t('createProduct.variantPriceLabel')}
                        </label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={variant.price}
                          onChange={(e) =>
                            updateVariant(
                              variant.id,
                              'price',
                              Number(e.target.value)
                            )
                          }
                          min="0"
                        />
                      </div>
                      <div>
                        <label className="block font-medium mb-1 text-neutral-700 dark:text-neutral-300">
                          {t('createProduct.variantStockLabel')}
                        </label>
                        <Input
                          type="number"
                          placeholder="0"
                          value={variant.stock}
                          onChange={(e) =>
                            updateVariant(
                              variant.id,
                              'stock',
                              Number(e.target.value)
                            )
                          }
                          min="0"
                        />
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeVariant(variant.id)}
                        className="text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-800"
                      >
                        <TrashIcon className="h-4 w-4" />
                        <span className="sr-only">{t('createProduct.removeVariantSr')}</span>
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </form>
      </div>
    </Modal>
  );
};

export default CreateProductForm;
