/**
 * @file CreateProductPage.tsx
 * @layer Page
 * @feature catalog
 * @description Page component của feature catalog
 */
import { ArrowLeft } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';

// Hooks tùy chỉnh cho form sản phẩm, attributes và variants
import { useProductAttributes } from '@features/catalog/hooks/use-product-attributes';
import { useProductForm } from '@features/catalog/hooks/use-product-form';
import { useProductVariants } from '@features/catalog/hooks/use-product-variants';
import { useFormAdapter } from '@features/catalog/hooks/use-form-adapter';

// Các API hook cần thiết
import { useCreateProductMutation } from '@/features/admin';
import { useGetCategoriesQuery } from '@features/catalog/api/category-api';
import { useConvertBase64ToImageMutation, useDeleteImageMutation } from '@/features/upload';

// Các component con cho từng phần của form
import AttributeModal from '@features/catalog/components/AttributeModal';
import VariantModal from '@features/catalog/components/VariantModal';
import ProductAttributesSection from '@features/catalog/components/ProductAttributesSection';
import ProductBasicInfoForm from '@features/catalog/components/ProductBasicInfoForm';
import ProductCategoryForm from '@features/catalog/components/ProductCategoryForm';
import ProductImagesForm from '@features/catalog/components/ProductImagesForm';
import ProductPricingForm from '@features/catalog/components/ProductPricingForm';
import ProductSeoForm from '@features/catalog/components/ProductSeoForm';
import ProductSpecificationsForm from '@features/catalog/components/ProductSpecificationsForm';
import ProductVariantsSection from '@features/catalog/components/ProductVariantsSection';
import TabNavigation from '@features/catalog/components/TabNavigation';
import ValidationAlerts from '@features/catalog/components/ValidationAlerts';
import ProductFAQForm from '@features/catalog/components/ProductFAQForm';

// Types và utils
import { AttributeGroup } from '@features/catalog/api/attribute-api';
import { ProductFormData, ProductAttribute, ProductVariant } from '@/types';
import { getErrorMsg } from '@/utils/error-utils';
import { useUiStore } from '@/stores/ui-store';

// Utils xử lý ảnh trong mô tả sản phẩm (base64 -> file đã upload)
import { hasBase64Images, processDescriptionImages } from '@/utils/description-image-processor';

// shadcn/ui
import {
  Button,
  Card,
  CardContent,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui';

// Tạo SKU ngẫu nhiên dạng PRD-XXXXXX (6 ký tự uppercase + số)
const generateSku = (prefix = 'PRD') => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ0123456789';
  const rand = Array.from(
    { length: 6 },
    () => chars[Math.floor(Math.random() * chars.length)],
  ).join('');
  return `${prefix}-${rand}`;
};

const getDefaultFaqs = () => [
  {
    question: i18next.t('admin.products.faq.defaults.q1'),
    answer: i18next.t('admin.products.faq.defaults.a1'),
  },
  {
    question: i18next.t('admin.products.faq.defaults.q2'),
    answer: i18next.t('admin.products.faq.defaults.a2'),
  },
  {
    question: i18next.t('admin.products.faq.defaults.q3'),
    answer: i18next.t('admin.products.faq.defaults.a3'),
  },
  {
    question: i18next.t('admin.products.faq.defaults.q4'),
    answer: i18next.t('admin.products.faq.defaults.a4'),
  },
  {
    question: i18next.t('admin.products.faq.defaults.q5'),
    answer: i18next.t('admin.products.faq.defaults.a5'),
  },
  {
    question: i18next.t('admin.products.faq.defaults.q6'),
    answer: i18next.t('admin.products.faq.defaults.a6'),
  },
];

const CreateProductPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const addNotification = useUiStore((s) => s.addNotification);
  const form = useFormAdapter({
    defaultValues: {
      price: 0,
      stockQuantity: 0,
      status: 'active',
      featured: false,
      categoryIds: [],
      specifications: [],
      seoKeywords: '',
      images: '',
      thumbnail: '',
      condition: 'new',
    },
  });

  // State để theo dõi các bước đã hoàn thành trong quy trình tạo sản phẩm
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>({
    basic: false,
    specifications: false,
    attributes: false,
    variants: false,
    pricing: false,
    category: false,
    images: false,
    faqs: false,
    seo: false,
  });

  // State cho hierarchical attributes và variants nếu cần thiết trong tương lai
  const [_attributeGroups, _setAttributeGroups] = useState<AttributeGroup[]>([]);
  const [_hierarchicalVariants, _setHierarchicalVariants] = useState<ProductVariant[]>([]);
  const [_specifications, _setSpecifications] = useState<
    Array<{ name: string; value: string; category?: string }>
  >([]);

  // Các API hook cần thiết
  const { data: categories, isLoading: isCategoriesLoading } = useGetCategoriesQuery();
  const { mutateAsync: createProduct, isPending: isCreating } = useCreateProductMutation();
  const { mutateAsync: convertBase64ToImage } = useConvertBase64ToImageMutation();
  const { mutateAsync: deleteImage } = useDeleteImageMutation();

  const {
    attributes,
    attributeModalVisible,
    editingAttribute,
    handleAddAttribute,
    handleDeleteAttribute,
    openAttributeModal,
    closeAttributeModal,
  } = useProductAttributes();

  const {
    variants,
    variantModalVisible,
    editingVariant,
    handleAddVariant,
    handleDeleteVariant,
    openVariantModal,
    closeVariantModal,
  } = useProductVariants([], form);

  // Debug: Log attributes whenever they change - đặc biệt là để theo dõi khi xóa thuộc tính (vì thuộc tính bị xóa sẽ ảnh hưởng đến biến thể)
  useEffect(() => {}, [attributes]);

  // Debug: Log variants whenever they change - đặc biệt là để theo dõi khi xóa biến thể
  useEffect(() => {
    // Tự động set price = 0 khi có variants để tránh lỗi validation khi tạo sản phẩm có variants mà chưa nhập giá cho variants
    if (variants.length > 0) {
      form.setFieldValue('price', 0);
    }
  }, [variants, form]);

  // Đặt FAQs mặc định sau mount (cần i18next đã sẵn sàng)
  useEffect(() => {
    form.setFieldsValue({ faqs: getDefaultFaqs() });
  }, [form]);

  // Custom hooks cho form sản phẩm sẽ trả về các trạng thái và hàm cần thiết để quản lý form, validation, và submit
  const {
    isFormValid,
    activeTab,
    setActiveTab,
    validateForm,
    getMissingFields: _getMissingFields,
    fillExampleData,
    handleSubmit,
  } = useProductForm({
    form,
    initialValues: {
      status: 'active',
      featured: false,
      stockQuantity: 0,
      price: 0,
    },
    attributes,
    variants,
    onStepComplete: (step, isComplete) => {
      setCompletedSteps((prev) => ({
        ...prev,
        [step]: isComplete,
      }));
    },
    onSubmit: async (values: ProductFormData) => {
      // Theo dõi ID ảnh description đã upload để rollback nếu createProduct thất bại
      const uploadedDescImageIds: string[] = [];

      try {
        // Lấy tất cả giá trị từ form để đảm bảo không bị thiếu
        const allFormValues = form.getFieldsValue();

        const hasVariants = variants.length > 0;

        // Xử lý mô tả: chuyển ảnh base64 thành file đã upload
        let processedDescription = allFormValues.description || values.description || '';

        if (hasBase64Images(processedDescription)) {
          const result = await processDescriptionImages(processedDescription, {
            productId: undefined,
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
            // Lưu lại ID để rollback nếu tạo sản phẩm thất bại
            result.uploadedImages.forEach((img) => {
              if (img.imageId) uploadedDescImageIds.push(img.imageId);
            });
          }
        }

        const productData = {
          name: allFormValues.name || values.name,
          baseName: allFormValues.baseName || values.baseName || allFormValues.name || values.name,
          shortDescription: allFormValues.shortDescription || values.shortDescription,
          description: processedDescription,
          // Sản phẩm có biến thể: đặt giá về 0
          price: hasVariants
            ? 0
            : parseFloat((allFormValues.price || values.price || '0').toString()) || 0,
          compareAtPrice: hasVariants
            ? undefined
            : (() => {
                const compareAtPrice = allFormValues.compareAtPrice || values.compareAtPrice;
                return compareAtPrice && parseFloat(compareAtPrice.toString()) > 0
                  ? parseFloat(compareAtPrice.toString())
                  : undefined;
              })(),
          // Sản phẩm có biến thể: đặt tồn kho về 0
          stock: hasVariants
            ? 0
            : parseInt((allFormValues.stockQuantity || values.stockQuantity || '0').toString()) ||
              0,
          stockQuantity: hasVariants
            ? 0
            : parseInt((allFormValues.stockQuantity || values.stockQuantity || '0').toString()) ||
              0,
          sku: hasVariants
            ? undefined
            : allFormValues.sku ||
              (values as ProductFormData & { sku?: string }).sku ||
              generateSku('PRD'),
          status: allFormValues.status || values.status || 'active',
          featured: allFormValues.featured || values.featured || false,
          categoryIds: allFormValues.categoryIds || values.categoryIds || [],
          images: (() => {
            const images = allFormValues.images || values.images;
            if (!images) return [];
            if (typeof images === 'string') {
              return images
                .split('\n')
                .map((img) => img.trim())
                .filter((img) => img);
            }
            if (Array.isArray(images)) {
              return images;
            }
            return [];
          })(),
          condition: allFormValues.condition || values.condition || 'new',
          specifications: (() => {
            const specs = allFormValues.specifications || values.specifications;
            if (!specs) return [];
            if (Array.isArray(specs)) {
              return specs.map((spec) => ({
                name: spec.name || '',
                value: spec.value || '',
                category: spec.category || 'General',
              }));
            }
            return [];
          })(),
          attributes:
            attributes.length > 0
              ? attributes.map((attr: ProductAttribute) => ({
                  name: attr.name,
                  value: Array.isArray(attr.values) ? attr.values.join(', ') : '',
                }))
              : [],
          variants: hasVariants
            ? variants.map((variant, index) => ({
                name: variant.name || `Variant ${index + 1}`,
                variantName: variant.name || `Variant ${index + 1}`,
                price: parseFloat(variant.price?.toString() || '0') || 0,
                compareAtPrice: variant.compareAtPrice
                  ? parseFloat(variant.compareAtPrice.toString())
                  : undefined,
                stockQuantity:
                  parseInt(variant.stockQuantity?.toString() || variant.stock?.toString() || '0') ||
                  0,
                stock:
                  parseInt(variant.stock?.toString() || variant.stockQuantity?.toString() || '0') ||
                  0,
                sku: variant.sku || generateSku('VAR'),
                isDefault: index === 0, // Biến thể đầu tiên là mặc định
                isAvailable: true,
                attributes: variant.attributes || {},
                specifications: variant.specifications || {},
                images: variant.images || [],
              }))
            : [],
          // Thêm các trường SEO - chỉ thêm nếu có giá trị
          ...(allFormValues.seoTitle || values.seoTitle
            ? {
                seoTitle: (allFormValues.seoTitle || values.seoTitle).substring(0, 500),
              }
            : {}),
          ...(allFormValues.seoDescription || values.seoDescription
            ? {
                seoDescription: allFormValues.seoDescription || values.seoDescription,
              }
            : {}),
          seoKeywords: (() => {
            const keywords = allFormValues.seoKeywords || values.seoKeywords;
            if (!keywords) return [];
            if (typeof keywords === 'string') {
              return keywords
                .split(',')
                .map((kw) => kw.trim())
                .filter((kw) => kw);
            }
            if (Array.isArray(keywords)) {
              return keywords;
            }
            return [];
          })(),
        };

        await createProduct(productData);
        addNotification({ message: t('admin.products.messages.createSuccess'), type: 'success' });
        navigate('/admin/products');
      } catch (error) {
        // Rollback: xóa ảnh description đã upload nếu tạo sản phẩm thất bại
        // Tránh orphaned files khi form bị lỗi validation sau khi ảnh đã được upload
        if (uploadedDescImageIds.length > 0) {
          await Promise.allSettled(
            uploadedDescImageIds.map((id) =>
              deleteImage(id).catch((err) => console.error('Lỗi xoá ảnh rollback:', err)),
            ),
          );
        }
        const errorMessage = formatErrorMessage(error);
        addNotification({ message: errorMessage, type: 'error' });
      }
    },
    isSubmitting: isCreating,
  });

  // Hàm hỗ trợ định dạng thông báo lỗi
  const formatErrorMessage = (error: unknown): string => {
    return getErrorMsg(error, t('admin.products.messages.createFailed'));
  };

  const categoriesList = categories || [];

  // Thứ tự tab cố định
  const TAB_ORDER = [
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

  // Hàm kiểm tra xem tab có được phép truy cập không
  const isTabAccessible = (tabKey: string): boolean => {
    const targetIndex = TAB_ORDER.indexOf(tabKey);

    // Tab đầu tiên luôn có thể truy cập
    if (targetIndex === 0) return true;

    // Kiểm tra xem tất cả các tab trước đó đã hoàn thành chưa
    for (let i = 0; i < targetIndex; i++) {
      const stepKey = TAB_ORDER[i];
      if (!completedSteps[stepKey]) {
        return false;
      }
    }

    return true;
  };

  // Hàm xử lý khi thay đổi tab
  const handleTabChange = (key: string) => {
    if (!isTabAccessible(key)) {
      // Hiển thị thông báo nếu tab chưa được phép truy cập
      alert(t('admin.products.tabs.incompleteWarning'));
      return;
    }
    setActiveTab(key);
  };

  const getTabLabelStyle = (tabKey: string) => {
    if (completedSteps[tabKey]) return 'text-green-600 dark:text-green-400';
    if (!isTabAccessible(tabKey)) return 'text-neutral-400 dark:text-neutral-500';
    return '';
  };

  return (
    <div className="p-6">
      {/* Header */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-semibold text-neutral-900 dark:text-white">
                {t('admin.products.create.title')}
              </h2>
              <p className="text-neutral-500 dark:text-neutral-400">
                {t('admin.products.create.subtitle')}
              </p>
            </div>
            <div>
              <Button
                variant="outline"
                onClick={() => navigate('/admin/products')}
                className="mr-2"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                {t('admin.products.backButton')}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <Card>
        <CardContent className="pt-6">
          <form
            onSubmit={form._rhf.handleSubmit((values) => handleSubmit(values as ProductFormData))}
            onChange={validateForm}
          >
            <Tabs value={activeTab} onValueChange={handleTabChange} className="min-h-[400px]">
              <TabsList className="flex flex-wrap h-auto gap-1 bg-transparent mb-4">
                {TAB_ORDER.map((tabKey) => (
                  <TabsTrigger
                    key={tabKey}
                    value={tabKey}
                    disabled={!isTabAccessible(tabKey)}
                    className={`${getTabLabelStyle(tabKey)} data-[state=active]:bg-primary-100 data-[state=active]:text-primary-700 dark:data-[state=active]:bg-primary-900/20 dark:data-[state=active]:text-primary-300`}
                  >
                    {t(`admin.products.tabs.${tabKey}`)} {completedSteps[tabKey] ? '?' : ''}
                  </TabsTrigger>
                ))}
              </TabsList>

              <TabsContent value="basic">
                <ProductBasicInfoForm
                  form={form._rhf}
                  fillExampleData={fillExampleData}
                  productId={undefined}
                />
                <TabNavigation
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  tabOrder={TAB_ORDER}
                  completedSteps={completedSteps}
                  validateForm={validateForm}
                />
              </TabsContent>

              <TabsContent value="specifications">
                <ProductSpecificationsForm form={form._rhf} initialSpecifications={[]} />
                <TabNavigation
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  tabOrder={TAB_ORDER}
                  completedSteps={completedSteps}
                  validateForm={validateForm}
                />
              </TabsContent>

              <TabsContent value="attributes">
                <ProductAttributesSection
                  attributes={attributes}
                  onAddAttribute={() => openAttributeModal()}
                  onEditAttribute={(attribute) => openAttributeModal(attribute)}
                  onDeleteAttribute={handleDeleteAttribute}
                />
                <TabNavigation
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  tabOrder={TAB_ORDER}
                  completedSteps={completedSteps}
                  validateForm={validateForm}
                />
              </TabsContent>

              <TabsContent value="variants">
                <ProductVariantsSection
                  variants={variants}
                  onAddVariant={() => openVariantModal()}
                  onEditVariant={(variant) => openVariantModal(variant)}
                  onDeleteVariant={handleDeleteVariant}
                />
                <TabNavigation
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  tabOrder={TAB_ORDER}
                  completedSteps={completedSteps}
                  validateForm={validateForm}
                />
              </TabsContent>

              <TabsContent value="pricing">
                <ProductPricingForm
                  form={form._rhf}
                  hasVariants={variants.length > 0}
                  variants={variants}
                />
                <TabNavigation
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  tabOrder={TAB_ORDER}
                  completedSteps={completedSteps}
                  validateForm={validateForm}
                />
              </TabsContent>

              <TabsContent value="category">
                <ProductCategoryForm
                  form={form._rhf}
                  categories={categoriesList}
                  isLoading={isCategoriesLoading}
                />
                <TabNavigation
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  tabOrder={TAB_ORDER}
                  completedSteps={completedSteps}
                  validateForm={validateForm}
                />
              </TabsContent>

              <TabsContent value="images">
                <ProductImagesForm form={form._rhf} />
                <TabNavigation
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  tabOrder={TAB_ORDER}
                  completedSteps={completedSteps}
                  validateForm={validateForm}
                />
              </TabsContent>

              <TabsContent value="faqs">
                <ProductFAQForm form={form._rhf} />
                <TabNavigation
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  tabOrder={TAB_ORDER}
                  completedSteps={completedSteps}
                  validateForm={validateForm}
                />
              </TabsContent>

              <TabsContent value="seo">
                <ProductSeoForm form={form._rhf} />
                <TabNavigation
                  activeTab={activeTab}
                  setActiveTab={setActiveTab}
                  tabOrder={TAB_ORDER}
                  completedSteps={completedSteps}
                  validateForm={validateForm}
                  isLastTab={true}
                  onSubmit={() => handleSubmit(form.getFieldsValue() as ProductFormData)}
                  isSubmitting={isCreating}
                  submitText={t('admin.products.submit.create')}
                  loadingText={t('admin.products.submit.creating')}
                />
              </TabsContent>
            </Tabs>

            <hr className="my-6 border-neutral-200 dark:border-neutral-700" />

            <ValidationAlerts
              isFormValid={isFormValid}
              missingFields={[]} // getMissingFields() hiện không cần thiết vì ValidationAlerts trả về null
            />

            {/* FormActions bị ẩn vì button tạo sản phẩm đã được chuyển vào TabNavigation */}
          </form>
        </CardContent>
      </Card>

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

export default CreateProductPage;
