/**
 * @file EditProductPage.tsx
 * @layer Page
 * @feature catalog
 * @description Page component của feature catalog
 */
import React, { useEffect, useRef, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/routes/paths';
import { ArrowLeft, AlertCircle } from 'lucide-react';
import LoadingSpinner from '@/components/common/LoadingSpinner';
import { useUiStore } from '@/stores/ui-store';

// Custom hooks
import { useProductForm } from '@features/catalog/hooks/use-product-form';
import { useProductAttributes } from '@features/catalog/hooks/use-product-attributes';
import { useProductVariants } from '@features/catalog/hooks/use-product-variants';
import { useFormAdapter } from '@features/catalog/hooks/use-form-adapter';

// Các API hook
import { useUpdateProductMutation, useGetAdminProductByIdQuery } from '@/features/admin';
import { useGetAllCategoriesQuery } from '@features/catalog/api/category-api';
import { useConvertBase64ToImageMutation } from '@/features/upload';

// Components
import ProductBasicInfoForm from '@features/catalog/components/ProductBasicInfoForm';
import ProductPricingForm from '@features/catalog/components/ProductPricingForm';
import ProductCategoryForm from '@features/catalog/components/ProductCategoryForm';
import ProductImagesForm from '@features/catalog/components/ProductImagesForm';
import ProductAttributesSection from '@features/catalog/components/ProductAttributesSection';
import ProductVariantsSection from '@features/catalog/components/ProductVariantsSection';
import ProductSeoForm from '@features/catalog/components/ProductSeoForm';
import ProductSpecificationsForm from '@features/catalog/components/ProductSpecificationsForm';
import ProductFAQForm from '@features/catalog/components/ProductFAQForm';
import ValidationAlerts from '@features/catalog/components/ValidationAlerts';
import ProductFormStepper from '@features/catalog/components/ProductFormStepper';
import ProductFormSaveBar from '@features/catalog/components/ProductFormSaveBar';
import AttributeModal from '@features/catalog/components/AttributeModal';
import VariantModal from '@features/catalog/components/VariantModal';
import AdminPageHeader from '../../components/AdminPageHeader';

// Types
import { ProductFormData, ProductAttribute, ProductVariant } from '@/types';
import type { UpdateProductRequest } from '@/features/admin';

// Utils
import { processDescriptionImages, hasBase64Images } from '@/utils/description-image-processor';
import { getErrorMsg } from '@/utils/error-utils';

// shadcn/ui
import { Button, Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui';

// Map raw DB spec keys → tên tiếng Việt
const SPEC_NAME_LABELS: Record<string, string> = {
  display_specs: 'Thông số màn hình',
  display: 'Màn hình',
  screen: 'Màn hình',
  processor_chipset: 'Vi xử lý (Chipset)',
  cpu: 'Vi xử lý (CPU)',
  chipset: 'Chipset',
  ram: 'Bộ nhớ (RAM)',
  ram_capacity: 'Bộ nhớ (RAM)',
  storage: 'Dung lượng (Storage)',
  storage_capacity: 'Dung lượng (Storage)',
  rom: 'Bộ nhớ trong (ROM)',
  battery: 'Dung lượng PIN',
  battery_capacity: 'Dung lượng PIN',
  charging_speed: 'Tốc độ sạc',
  charger: 'Công nghệ sạc',
  charging_tech: 'Công nghệ sạc',
  operating_system: 'Hệ điều hành',
  os: 'Hệ điều hành',
  network_connectivity: 'Kết nối mạng / Không dây',
  connectivity: 'Kết nối không dây',
  water_resistance: 'Chống nước',
  build_material: 'Chất liệu vỏ',
  material: 'Chất liệu thiết kế',
  dimensions_weight: 'Kích thước & Trọng lượng',
  dimensions: 'Kích thước',
  weight: 'Trọng lượng',
  sensors: 'Cảm biến',
  camera: 'Hệ thống Camera',
  gpu: 'Đồ họa (GPU)',
  graphics_processor: 'Đồ họa (GPU)',
  bluetooth: 'Bluetooth',
  wifi: 'Wi-Fi',
  security: 'Tính năng bảo mật',
  color: 'Màu sắc',
  warranty: 'Chế độ bảo hành',
  battery_life: 'Thời lượng pin',
  features: 'Tính năng',
  other_features: 'Tiện ích khác',
  health_features: 'Tính năng sức khỏe',
  sports_modes: 'Chế độ thể thao',
  positioning: 'Định vị',
  sim_slots: 'Khe cắm SIM',
  sim: 'Loại SIM',
  compatibility: 'Tương thích',
  release_year: 'Năm ra mắt',
  network: 'Kết nối mạng',
  mobile_network: 'Hỗ trợ mạng di động',
  ports: 'Cổng kết nối',
  port: 'Cổng kết nối',
  audio: 'Công nghệ âm thanh',
  audio_jack: 'Cổng tai nghe 3.5mm',
  speaker: 'Loa / Âm thanh',
  dial_size: 'Đường kính mặt số',
  band_material: 'Chất liệu dây',
  case_material: 'Chất liệu vỏ',
  glass_material: 'Chất liệu mặt kính',
  band_width: 'Bề rộng dây',
  case_thickness: 'Độ dày vỏ',
  power_source: 'Nguồn năng lượng',
  power_reserve: 'Dự trữ năng lượng',
  charging_port: 'Cổng sạc',
  collection: 'Bộ sưu tập',
  movement_name: 'Bộ máy',
  movement_type: 'Loại máy',
  made_in: 'Xuất xứ',
  brand_origin: 'Thương hiệu của',
  accessories: 'Phụ kiện đi kèm',
  special_features: 'Tính năng đặc biệt',
  rear_camera: 'Camera sau',
  front_camera: 'Camera trước',
  video: 'Quay phim',
  gps: 'Định vị GPS',
  card_reader: 'Khe cắm thẻ nhớ',
  keyboard: 'Bàn phím',
  touchpad: 'Bàn di chuột',
  keyboard_backlight: 'Đèn bàn phím',
  webcam: 'Webcam / Camera',
  cooling_system: 'Hệ thống tản nhiệt',
  panel_type: 'Loại tấm nền',
  contrast_ratio: 'Tỷ lệ tương phản',
  color_gamut: 'Độ phủ màu',
  refresh_rate: 'Tần số quét',
  brightness: 'Độ sáng',
  resolution: 'Độ phân giải',
  target_user: 'Đối tượng sử dụng',
};
const mapSpecName = (key: string): string => SPEC_NAME_LABELS[key] ?? key;

const generateSku = (prefix = 'PRD') => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  const rand = Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join('');
  return `${prefix}-${rand}`;
};

const EditProductPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const addNotification = useUiStore((s) => s.addNotification);
  const form = useFormAdapter();
  // Ref lưu product data qua các lần effect re-run — tránh mất data khi React Strict Mode
  // remount component và TanStack Query tạm thời trả về undefined
  const productDataRef = useRef<ReturnType<typeof Object.assign> | null>(null);

  // Các API hook
  const {
    data: productResponse,
    isLoading: isLoadingProduct,
    error: productError,
  } = useGetAdminProductByIdQuery(id || '', { enabled: !!id });

  const { data: categoriesResponse, isLoading: isCategoriesLoading } = useGetAllCategoriesQuery();
  const { mutateAsync: updateProduct, isPending: isUpdating } = useUpdateProductMutation();
  const { mutateAsync: convertBase64ToImage } = useConvertBase64ToImageMutation();

  // Custom hooks
  const {
    attributes,
    setAttributes,
    attributeModalVisible,
    editingAttribute,
    handleAddAttribute,
    handleDeleteAttribute,
    openAttributeModal,
    closeAttributeModal,
  } = useProductAttributes();

  const {
    variants,
    setVariants,
    variantModalVisible,
    editingVariant,
    handleAddVariant,
    handleDeleteVariant,
    openVariantModal,
    closeVariantModal,
  } = useProductVariants([], form);

  // State thông số kỹ thuật
  const [specifications, setSpecifications] = useState<
    Array<{ id: string; name: string; value: string; category?: string }>
  >([]);

  const {
    isFormValid,
    setIsFormValid,
    activeTab,
    setActiveTab,
    validateForm,
    getMissingFields,
    fillExampleData,
    handleSubmit,
  } = useProductForm({
    form,
    isEditMode: true, // Thêm prop để báo là edit mode
    attributes,
    variants,
    onSubmit: async (_values: ProductFormData) => {
      if (!id) return;

      try {
        const formValues = form.getFieldsValue(true);
        const hasVariants = variants.length > 0;

        // Xử lý mô tả: chuyển ảnh base64 nếu cần
        let processedDescription = formValues.description || '';
        if (hasBase64Images(processedDescription)) {
          const result = await processDescriptionImages(processedDescription, {
            productId: id,
            category: 'product' as const,
            uploadImageFn: async ({ base64Data, options }) => {
              return await convertBase64ToImage({
                base64Data,
                options: options as Record<string, unknown>,
              });
            },
          });
          if (result.hasChanges) {
            processedDescription = result.processedDescription;
          }
        }

        // Xây dựng đối tượng cập nhật đầy đủ
        const productData: UpdateProductRequest & Record<string, unknown> = {
          id,
          name: formValues.name,
          baseName: formValues.baseName || formValues.name,
          shortDescription: formValues.shortDescription,
          description: processedDescription,
          status: formValues.status,
          featured: formValues.featured,
          categoryIds: formValues.categoryIds || [],
          seoTitle: formValues.seoTitle,
          seoDescription: formValues.seoDescription,
          seoKeywords:
            typeof formValues.seoKeywords === 'string'
              ? formValues.seoKeywords
                  .split(',')
                  .map((kw: string) => kw.trim())
                  .filter((kw: string) => kw)
              : formValues.seoKeywords || [],
          faqs: formValues.faqs || [],
          images:
            typeof formValues.images === 'string'
              ? formValues.images.split('\n').filter((img: string) => img.trim())
              : Array.isArray(formValues.images)
                ? formValues.images
                : [],
          specifications: (formValues.specifications || []).map(
            (spec: { name: string; value: string; valueEn?: string; category?: string }) => ({
              name: spec.name,
              value: spec.value,
              valueEn: spec.valueEn || null,
              category: spec.category || 'General',
            }),
          ),
        };

        // Logic giá và tồn kho
        if (hasVariants) {
          productData.price = 0;
          productData.stock = 0;
          productData.stockQuantity = 0;
        } else {
          productData.price = parseFloat(formValues.price?.toString()) || 0;
          productData.stock = parseInt(formValues.stockQuantity?.toString()) || 0;
          productData.stockQuantity = parseInt(formValues.stockQuantity?.toString()) || 0;
        }

        // Giá so sánh
        const compareAtPrice = parseFloat(formValues.compareAtPrice?.toString()) || 0;
        productData.compareAtPrice = compareAtPrice > 0 ? compareAtPrice : undefined;

        // Thuộc tính và biến thể - luôn gửi nếu có để an toàn
        productData.attributes = attributes.map((attr: ProductAttribute) => ({
          name: attr.name,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          value: Array.isArray(attr.values) ? attr.values.join(', ') : (attr as any).value || '',
        }));

        if (hasVariants) {
          productData.variants = variants.map((variant: ProductVariant, index: number) => ({
            id: variant.id && !String(variant.id).startsWith('var-') ? variant.id : undefined,
            name: variant.name,
            price: parseFloat(variant.price?.toString()) || 0,
            sku: variant.sku || generateSku('VAR'),
            isAvailable: true,
            isDefault: variant.isDefault || index === 0,
            compareAtPrice:
              (variant as unknown as { compareAtPrice?: number | null }).compareAtPrice ?? null,
            stockQuantity:
              parseInt(variant.stockQuantity?.toString() || variant.stock?.toString() || '0') || 0,
            stock:
              parseInt(variant.stock?.toString() || variant.stockQuantity?.toString() || '0') || 0,
            attributes: variant.attributes || {},
            images: (variant as unknown as { images?: string[] }).images || [],
          }));
        }

        await updateProduct(productData);
        addNotification({ message: t('admin.products.messages.updateSuccess'), type: 'success' });
        navigate(ROUTES.ADMIN_PRODUCTS);
      } catch (error) {
        console.error('Failed to update product:', error);
        const errorMessage = formatErrorMessage(error);
        addNotification({ message: errorMessage, type: 'error' });
      }
    },
    isSubmitting: isUpdating,
  });

  // State để theo dõi quá trình tải dữ liệu
  const [_isDataLoaded, _setIsDataLoaded] = useState(false);

  // Nạp dữ liệu sản phẩm vào form
  useEffect(() => {
    // Cập nhật ref khi có data mới (ref tồn tại qua Strict Mode remount, khác React state)
    if (productResponse?.data) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API response shape phức tạp, cần dynamic access cho nhiều trường
      const rawData = productResponse.data as any;
      productDataRef.current = rawData.product || rawData;
    }

    // Dùng ref để đảm bảo luôn có data ngay cả khi TanStack Query
    // tạm thời trở về loading state trong Strict Mode double-invocation
    const product = productDataRef.current;
    if (!product) return;

    // Xử lý mô tả: xử lý ảnh base64
    let processedDescription = product.description || '';

    // Nếu mô tả là chuỗi JSON, parse trước
    if (typeof processedDescription === 'string' && processedDescription.startsWith('[')) {
      try {
        const parsedDescription = JSON.parse(processedDescription);
        if (Array.isArray(parsedDescription)) {
          processedDescription = parsedDescription.join('');
        }
      } catch (_e) {
        // Nếu parse thất bại, giữ nguyên
      }
    }

    // Nếu description không có HTML tags (plain text từ backend) →
    // convert sang HTML paragraphs để TipTap hiển thị đúng
    if (processedDescription && !/<[a-z][\s\S]*>/i.test(processedDescription)) {
      processedDescription = processedDescription
        .split('\n')
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0)
        .map((line: string) => `<p>${line}</p>`)
        .join('');
    }

    // Trường hợp khác: mô tả rỗng nhưng có mảng images, thử tạo từ images
    if (!processedDescription && product.images && Array.isArray(product.images)) {
      const imageElements = (product.images as string[])
        .filter((img: string) => img.includes('data:image'))
        .map(
          (img: string) =>
            `<img src="${img}" alt="${t('product.imageAlt')}" style="max-width: 100%; height: auto;" />`,
        )
        .join('<br/>');

      if (imageElements) {
        processedDescription = imageElements;
      }
    }

    // Gán giá trị cho form
    // Dùng reset() làm nguồn gốc để tránh bị Strict Mode xóa; setFieldsValue để các
    // child component nhận subscription update.
    const baseValues = {
      name: product.baseName || product.name,
      description: processedDescription,
      shortDescription: product.shortDescription,
      price: parseFloat(product.price) || 0,
      compareAtPrice: parseFloat(product.compareAtPrice) || 0,
      stockQuantity: product.stockQuantity || 0,
      sku: product.sku,
      status: product.status || '',
      // statusOverride được set riêng bên dưới (React state, bền hơn RHF với Strict Mode)
      featured: product.isFeatured ?? product.featured ?? false,
      categoryIds: product.categories?.map((cat: { id: string }) => cat.id) || [],
      images: (() => {
        // Thử product.images trước (catalog API — objects {url})
        const imgs = product.images as Array<{ url?: string } | string> | undefined;
        if (imgs?.length) {
          const urls = imgs
            .map((img) => (typeof img === 'string' ? img : img?.url))
            .filter(Boolean);
          if (urls.length) return urls.join('\n');
        }
        // Fallback: product.productImages (admin API) — chỉ lấy ảnh chung (variantId = null)
        const pImgs = product.productImages as
          | Array<{ imageUrl?: string; url?: string; variantId?: string | null }>
          | undefined;
        if (pImgs?.length) {
          return pImgs
            .filter((img) => !img?.variantId)
            .map((img) => img?.imageUrl || img?.url)
            .filter(Boolean)
            .join('\n');
        }
        return '';
      })(),
      thumbnail:
        product.thumbnail ||
        (product.productImages as Array<{ imageUrl?: string; isThumbnail?: boolean }>)?.find(
          (img) => img.isThumbnail,
        )?.imageUrl ||
        '',
      seoTitle: product.seoTitle || '',
      seoDescription: product.seoDescription || '',
      seoKeywords: product.seoKeywords || '',
      faqs: product.faqs || [],
      specifications: (() => {
        // Ưu tiên bảng productSpecifications (normalized)
        if (
          product.productSpecifications &&
          Array.isArray(product.productSpecifications) &&
          product.productSpecifications.length > 0
        ) {
          return product.productSpecifications.map(
            (
              spec: { id?: string; name: string; value: string; category?: string },
              index: number,
            ) => ({
              id: spec.id || `spec-${index}`,
              name: spec.name,
              value: spec.value,
              category: spec.category || 'General',
            }),
          );
        }
        // Fallback: parse từ JSON column specifications
        if (
          product.specifications &&
          typeof product.specifications === 'object' &&
          !Array.isArray(product.specifications)
        ) {
          return Object.entries(product.specifications).map(([name, value], index) => ({
            id: `spec-json-${index}`,
            name: mapSpecName(name),
            value: String(value ?? ''),
            category: 'General',
          }));
        }
        return [];
      })(),
    };

    form._rhf.reset(baseValues, { keepDirtyValues: false });

    // Cập nhật state thông số kỹ thuật
    const specsFromTable =
      product.productSpecifications &&
      Array.isArray(product.productSpecifications) &&
      product.productSpecifications.length > 0
        ? product.productSpecifications
        : null;
    const specsFromJson =
      !specsFromTable &&
      product.specifications &&
      typeof product.specifications === 'object' &&
      !Array.isArray(product.specifications)
        ? Object.entries(product.specifications).map(([name, value], index) => ({
            id: `spec-json-${index}`,
            name: mapSpecName(name),
            value: String(value ?? ''),
            category: 'General',
          }))
        : null;
    const resolvedSpecs = specsFromTable || specsFromJson;
    if (resolvedSpecs && resolvedSpecs.length > 0) {
      setSpecifications(resolvedSpecs);
    }

    // Gán thuộc tính và biến thể
    // Ưu tiên productAttributes (association) nếu attributes JSON column không phải array
    const rawAttrs = Array.isArray(product.attributes)
      ? product.attributes
      : Array.isArray(product.productAttributes)
        ? product.productAttributes
        : [];
    if (rawAttrs.length > 0) {
      const formattedAttributes: ProductAttribute[] = rawAttrs.map(
        (
          attr: { id?: string; name: string; values?: string[]; value?: string },
          index: number,
        ) => ({
          id: attr.id || `attr-${index}`,
          name: attr.name,
          value: Array.isArray(attr.values) ? attr.values.join(', ') : attr.value || '',
        }),
      );
      setAttributes(formattedAttributes);
    }

    if (product.variants) {
      const allProductImages = product.productImages as
        | Array<{ imageUrl?: string; variantId?: string | number | null; color?: string | null }>
        | undefined;
      const formattedVariants: ProductVariant[] = product.variants.map(
        (
          variant: {
            id?: string;
            name?: string;
            variantName?: string;
            displayName?: string;
            price: number | string;
            compareAtPrice?: number | string | null;
            stockQuantity?: number;
            stock?: number;
            sku?: string;
            attributes?: Record<string, string>;
            images?: string[];
          },
          index: number,
        ) => {
          // Ưu tiên filter theo variantId, fallback theo color attribute
          const byVariantId =
            variant.id && allProductImages
              ? allProductImages.filter(
                  (img) => img.variantId && String(img.variantId) === String(variant.id),
                )
              : [];
          const variantColor =
            (variant.attributes as Record<string, string>)?.color ||
            (variant.attributes as Record<string, string>)?.['Màu sắc'];
          const byColor =
            variantColor && allProductImages
              ? allProductImages.filter(
                  (img) =>
                    !img.variantId &&
                    img.color?.toLowerCase().trim() === variantColor.toLowerCase().trim(),
                )
              : [];
          const variantImages = (byVariantId.length ? byVariantId : byColor)
            .map((img) => img.imageUrl || '')
            .filter(Boolean);
          return {
            id: variant.id || `var-${index}`,
            // variantName = tên đầy đủ, displayName = tên ngắn (VD: "Trắng")
            name: variant.variantName || variant.name || '',
            displayName: variant.displayName || '',
            price: parseFloat(String(variant.price)) || 0,
            compareAtPrice: variant.compareAtPrice
              ? parseFloat(String(variant.compareAtPrice))
              : null,
            stock: variant.stockQuantity || variant.stock || 0,
            sku: variant.sku || '',
            attributes: variant.attributes || {},
            images: variantImages,
          };
        },
      );
      setVariants(formattedVariants);
    }

    // Validate form sau khi tải dữ liệu (không thêm validateForm vào dependencies)
    setTimeout(() => {
      // Validate thủ công, không dùng hàm validateForm
      const values = form.getFieldsValue();
      const errors = form.getFieldsError();

      // Kiểm tra tất cả trường bắt buộc đã điền chưa
      const requiredFields = [
        'name',
        'shortDescription',
        'description',
        'price',
        'stockQuantity',
        'categoryIds',
      ];

      const isFieldsFilled = requiredFields.every((field) => {
        const value = values[field];
        if (field === 'categoryIds') {
          return value && Array.isArray(value) && value.length > 0;
        }
        if (field === 'price' || field === 'stockQuantity') {
          return value !== undefined && value !== null && value !== '' && value >= 0;
        }
        return (
          value !== undefined && value !== null && value !== '' && value.toString().trim() !== ''
        );
      });

      // Kiểm tra có lỗi validation nào không
      const hasErrors = errors.some((error) => error.errors && error.errors.length > 0);

      const isValid = isFieldsFilled && !hasErrors;
      setIsFormValid(isValid);
    }, 100);
  }, [productResponse, form, setAttributes, setVariants, setIsFormValid, t]);

  // Hàm hỗ trợ định dạng thông báo lỗi
  const formatErrorMessage = (error: unknown): string => {
    return getErrorMsg(error, t('admin.products.messages.updateFailed'));
  };

  const categories = Array.isArray(categoriesResponse?.data)
    ? categoriesResponse.data
    : categoriesResponse?.data
      ? [categoriesResponse.data]
      : [];

  // Watch reactive values cho stepper (phải khai báo trước early return)
  const watchName = form._rhf.watch('name') as string;
  const watchDesc = form._rhf.watch('description') as string;
  const watchShortDesc = form._rhf.watch('shortDescription') as string;
  const watchPrice = form._rhf.watch('price');
  const watchCategoryIds = form._rhf.watch('categoryIds') as string[];
  const watchSpecs = form._rhf.watch('specifications') as unknown[];
  const watchFaqs = form._rhf.watch('faqs') as unknown[];
  const watchSeoTitle = form._rhf.watch('seoTitleVi') as string;

  // Xử lý trạng thái loading và error
  if (isLoadingProduct) {
    return (
      <div className="py-16 text-center">
        <LoadingSpinner size="lg" />
        <p className="mt-4 text-sm text-[var(--text-tertiary)]">
          {t('admin.products.loadingText')}
        </p>
      </div>
    );
  }

  if (productError || !id) {
    return (
      <div className="py-16 text-center">
        <div className="max-w-md mx-auto">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[var(--color-danger)]/10 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-[var(--color-danger)]" strokeWidth={1.5} />
          </div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-2">
            {t('admin.products.errors.loadFailed')}
          </h3>
          <p className="text-sm text-[var(--text-tertiary)] mb-6">
            {t('admin.products.errors.loadFailedDesc')}
          </p>
          <Button className="admin-btn-primary" onClick={() => navigate(ROUTES.ADMIN_PRODUCTS)}>
            {t('admin.products.backToList')}
          </Button>
        </div>
      </div>
    );
  }

  const TAB_KEYS = [
    'basic',
    'specifications',
    'attributes',
    'variants',
    'pricing',
    'category',
    'images',
    'faqs',
    'seo',
  ];

  const steps = TAB_KEYS.map((key) => ({ key, label: t(`admin.products.tabs.${key}`) }));

  // Submit với status chỉ định (Lưu nháp = draft, Xuất bản = active)
  const submitWithStatus = (status: 'draft' | 'active') => {
    form.setFieldValue('status', status);
    handleSubmit({ ...(form.getFieldsValue(true) as ProductFormData), status });
  };

  return (
    <div>
      {/* Page header */}
      <AdminPageHeader
        sectionNumber="02 / CHỈNH SỬA SẢN PHẨM"
        title={t('admin.products.edit.title')}
        gradientTitle
        sparkle
        subtitle={t('admin.products.edit.subtitle')}
        actions={
          <Button variant="outline" onClick={() => navigate(ROUTES.ADMIN_PRODUCTS)}>
            <ArrowLeft className="w-4 h-4 mr-2" strokeWidth={2.25} />
            {t('admin.products.backButton')}
          </Button>
        }
      />

      {/* Form container */}
      <div className="rounded-2xl bg-[var(--bg-base)] dark:bg-white/[0.03] border border-[var(--border-default)] p-5 shadow-sm">
        <form
          onSubmit={form._rhf.handleSubmit((values) => handleSubmit(values as ProductFormData))}
          onChange={validateForm}
        >
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            {/* TabsList ẩn — giữ cho Radix Tabs + a11y; điều hướng thật qua stepper */}
            <TabsList className="sr-only">
              {TAB_KEYS.map((tabKey) => (
                <TabsTrigger key={tabKey} value={tabKey}>
                  {t(`admin.products.tabs.${tabKey}`)}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr] gap-6">
              {/* Vertical stepper trái */}
              <aside className="lg:sticky lg:top-[88px] lg:self-start">
                <ProductFormStepper
                  steps={steps}
                  activeStep={activeTab}
                  completedSteps={
                    !isLoadingProduct
                      ? {
                          basic:
                            !!watchName?.trim() && !!watchDesc?.trim() && !!watchShortDesc?.trim(),
                          attributes: attributes.length > 0,
                          variants: variants.length > 0,
                          specifications: Array.isArray(watchSpecs) && watchSpecs.length > 0,
                          pricing: variants.length > 0 || Number(watchPrice) > 0,
                          category: Array.isArray(watchCategoryIds) && watchCategoryIds.length > 0,
                          images: true,
                          seo: true,
                          faqs: true,
                        }
                      : undefined
                  }
                  filledSteps={
                    !isLoadingProduct
                      ? {
                          specifications: Array.isArray(watchSpecs) && watchSpecs.length > 0,
                          attributes: attributes.length > 0,
                          variants: variants.length > 0,
                          images: true,
                          faqs: Array.isArray(watchFaqs) && watchFaqs.length > 0,
                          seo: !!watchSeoTitle?.trim(),
                        }
                      : undefined
                  }
                  optionalSteps={
                    new Set(['specifications', 'attributes', 'variants', 'images', 'faqs', 'seo'])
                  }
                  onSelect={setActiveTab}
                />
              </aside>

              {/* Nội dung bước phải */}
              <div className="min-h-[420px]">
                <TabsContent value="basic">
                  <ProductBasicInfoForm
                    form={form._rhf}
                    fillExampleData={fillExampleData}
                    productId={id}
                  />
                </TabsContent>

                <TabsContent value="attributes">
                  <ProductAttributesSection
                    attributes={attributes}
                    onAddAttribute={() => openAttributeModal()}
                    onEditAttribute={(attribute) => openAttributeModal(attribute)}
                    onDeleteAttribute={handleDeleteAttribute}
                  />
                </TabsContent>

                <TabsContent value="variants">
                  <ProductVariantsSection
                    variants={variants}
                    onAddVariant={() => openVariantModal()}
                    onEditVariant={(variant) => openVariantModal(variant)}
                    onDeleteVariant={handleDeleteVariant}
                  />
                </TabsContent>

                <TabsContent value="specifications">
                  <ProductSpecificationsForm
                    form={form._rhf}
                    initialSpecifications={specifications}
                  />
                </TabsContent>

                <TabsContent value="pricing">
                  <ProductPricingForm
                    form={form._rhf}
                    hasVariants={variants.length > 0}
                    variants={variants}
                  />
                </TabsContent>

                <TabsContent value="category">
                  <ProductCategoryForm
                    form={form._rhf}
                    categories={categories}
                    isLoading={isCategoriesLoading}
                  />
                </TabsContent>

                <TabsContent value="images">
                  <ProductImagesForm form={form._rhf} />
                </TabsContent>

                <TabsContent value="seo">
                  <ProductSeoForm form={form._rhf} />
                </TabsContent>

                <TabsContent value="faqs">
                  <ProductFAQForm form={form._rhf} />
                </TabsContent>
              </div>
            </div>
          </Tabs>

          <ValidationAlerts isFormValid={isFormValid} missingFields={getMissingFields()} />

          <ProductFormSaveBar
            isSubmitting={isUpdating}
            onSaveDraft={() => submitWithStatus('draft')}
            onPublish={() => submitWithStatus('active')}
            onCancel={() => navigate(ROUTES.ADMIN_PRODUCTS)}
            draftText={t('admin.products.submit.saveDraft')}
            publishText={t('admin.products.submit.publish')}
          />
        </form>
      </div>

      {/* Modals */}
      {attributeModalVisible && (
        <AttributeModal
          open={attributeModalVisible}
          onClose={closeAttributeModal}
          attribute={editingAttribute}
          onSave={handleAddAttribute}
        />
      )}

      {variantModalVisible && (
        <VariantModal
          open={variantModalVisible}
          onClose={closeVariantModal}
          variant={editingVariant}
          onSave={handleAddVariant}
          attributes={attributes}
        />
      )}
    </div>
  );
};

export default EditProductPage;
