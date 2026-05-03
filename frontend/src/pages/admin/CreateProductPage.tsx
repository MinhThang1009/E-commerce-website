import { ArrowLeftOutlined } from '@ant-design/icons';
import {
  Button,
  Card,
  Col,
  Divider,
  Form,
  message,
  Row,
  Tabs,
  Typography,
} from 'antd';
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import i18next from 'i18next';

// Custom hooks
import { useProductAttributes } from '@/hooks/useProductAttributes';
import { useProductForm } from '@/hooks/useProductForm';
import { useProductVariants } from '@/hooks/useProductVariants';

// C�c API hook
import { useCreateProductMutation } from '@/services/adminProductApi';
import { useGetCategoriesQuery } from '@/services/categoryApi';
import { useConvertBase64ToImageMutation, useDeleteImageMutation } from '@/services/imageApi';
import { useGetWarrantyPackagesQuery } from '@/services/warrantyApi';

// Components
import AttributeModal from '@/components/modals/AttributeModal';
import VariantModal from '@/components/modals/VariantModal';
import ProductAttributesSection from '@/components/product/ProductAttributesSection';
import ProductBasicInfoForm from '@/components/product/ProductBasicInfoForm';
import ProductCategoryForm from '@/components/product/ProductCategoryForm';
import ProductImagesForm from '@/components/product/ProductImagesForm';
import ProductPricingForm from '@/components/product/ProductPricingForm';
import ProductSeoForm from '@/components/product/ProductSeoForm';
import ProductSpecificationsForm from '@/components/product/ProductSpecificationsForm';
import ProductVariantsSection from '@/components/product/ProductVariantsSection';
import ProductWarrantyForm from '@/components/product/ProductWarrantyForm';
import TabNavigation from '@/components/product/TabNavigation';
import ValidationAlerts from '@/components/product/ValidationAlerts';
import ProductFAQForm from '@/components/product/ProductFAQForm';

// Types
import { AttributeGroup } from '@/services/attributeApi';
import { ProductFormData } from '@/types';

// Utils
import {
  hasBase64Images,
  processDescriptionImages,
} from '@/utils/descriptionImageProcessor';

const { Title, Text } = Typography;

const getDefaultFaqs = () => [
  { question: i18next.t('admin.products.faq.defaults.q1'), answer: i18next.t('admin.products.faq.defaults.a1') },
  { question: i18next.t('admin.products.faq.defaults.q2'), answer: i18next.t('admin.products.faq.defaults.a2') },
  { question: i18next.t('admin.products.faq.defaults.q3'), answer: i18next.t('admin.products.faq.defaults.a3') },
  { question: i18next.t('admin.products.faq.defaults.q4'), answer: i18next.t('admin.products.faq.defaults.a4') },
  { question: i18next.t('admin.products.faq.defaults.q5'), answer: i18next.t('admin.products.faq.defaults.a5') },
  { question: i18next.t('admin.products.faq.defaults.q6'), answer: i18next.t('admin.products.faq.defaults.a6') },
];

const CreateProductPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  // State d? theo d�i c�c bu?c d� ho�n th�nh
  const [completedSteps, setCompletedSteps] = useState<Record<string, boolean>>(
    {
      basic: false,
      specifications: false,
      attributes: false,
      variants: false,
      pricing: false,
      category: false,
      images: false,
      warranty: false,
      faqs: false,
      seo: false,
    }
  );

  // State cho hierarchical attributes v� variants
  const [attributeGroups, setAttributeGroups] = useState<AttributeGroup[]>([]);
  const [hierarchicalVariants, setHierarchicalVariants] = useState<any[]>([]);
  const [specifications, setSpecifications] = useState<any[]>([]);

  // C�c API hook
  const { data: categories, isLoading: isCategoriesLoading } =
    useGetCategoriesQuery();
  const { data: warrantyData, isLoading: isWarrantyLoading } =
    useGetWarrantyPackagesQuery({ isActive: true });
  const [createProduct, { isLoading: isCreating }] = useCreateProductMutation();
  const [convertBase64ToImage] = useConvertBase64ToImageMutation();
  const [deleteImage] = useDeleteImageMutation();

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

  // Debug: Log attributes whenever they change
  useEffect(() => {
  }, [attributes]);

  // Debug: Log variants whenever they change
  useEffect(() => {

    // T? d?ng set price = 0 khi c� variants
    if (variants.length > 0) {
      form.setFieldValue('price', 0);
    }
  }, [variants, form]);

  // �?t gi� tr? m?c d?nh cho form
  useEffect(() => {
    form.setFieldsValue({
      price: 0,
      stockQuantity: 0,
      status: 'active',
      featured: false,
      categoryIds: [],
      specifications: [],
      warrantyPackageIds: [],
      seoKeywords: '',
      images: '',
      thumbnail: '',
      condition: 'new',
      faqs: getDefaultFaqs(),
    });
  }, [form]);

  // Custom hooks
  const {
    isFormValid,
    activeTab,
    setActiveTab,
    validateForm,
    getMissingFields,
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
      // Theo d�i ID ?nh description d� upload d? rollback n?u createProduct th?t b?i
      const uploadedDescImageIds: string[] = [];

      try {
        // L?y t?t c? gi� tr? t? form d? d?m b?o kh�ng b? thi?u
        const allFormValues = form.getFieldsValue();

        const hasVariants = variants.length > 0;

        // X? l� m� t?: chuy?n ?nh base64 th�nh file d� upload
        let processedDescription =
          allFormValues.description || values.description || '';

        if (hasBase64Images(processedDescription)) {
          const result = await processDescriptionImages(processedDescription, {
            productId: undefined,
            category: 'product' as any,
            uploadImageFn: async ({ base64Data, options }) => {
              return await convertBase64ToImage({
                base64Data,
                options: options as any,
              }).unwrap();
            },
          });

          if (result.hasChanges) {
            processedDescription = result.processedDescription;
            // Luu l?i ID d? rollback n?u t?o s?n ph?m th?t b?i
            result.uploadedImages.forEach((img) => {
              if (img.imageId) uploadedDescImageIds.push(img.imageId);
            });
          }
        }

        const productData = {
          name: allFormValues.name || values.name,
          baseName:
            allFormValues.baseName ||
            values.baseName ||
            allFormValues.name ||
            values.name,
          shortDescription:
            allFormValues.shortDescription || values.shortDescription,
          description: processedDescription,
          // S?n ph?m c� bi?n th?: d?t gi� v? 0
          price: hasVariants
            ? 0
            : parseFloat(
              (allFormValues.price || values.price || '0').toString()
            ) || 0,
          comparePrice: hasVariants
            ? undefined
            : (() => {
              const compareAtPrice =
                allFormValues.compareAtPrice || values.compareAtPrice;
              return compareAtPrice &&
                parseFloat(compareAtPrice.toString()) > 0
                ? parseFloat(compareAtPrice.toString())
                : undefined;
            })(),
          compareAtPrice: hasVariants
            ? undefined
            : (() => {
              const compareAtPrice =
                allFormValues.compareAtPrice || values.compareAtPrice;
              return compareAtPrice &&
                parseFloat(compareAtPrice.toString()) > 0
                ? parseFloat(compareAtPrice.toString())
                : undefined;
            })(),
          // S?n ph?m c� bi?n th?: d?t t?n kho v? 0
          stock: hasVariants
            ? 0
            : parseInt(
              (
                allFormValues.stockQuantity ||
                values.stockQuantity ||
                '0'
              ).toString()
            ) || 0,
          stockQuantity: hasVariants
            ? 0
            : parseInt(
              (
                allFormValues.stockQuantity ||
                values.stockQuantity ||
                '0'
              ).toString()
            ) || 0,
          sku: hasVariants
            ? undefined
            : allFormValues.sku || (values as any).sku || `PROD-${Date.now()}`,
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
          thumbnail: (
            allFormValues.thumbnail ||
            values.thumbnail ||
            ''
          ).substring(0, 1000),
          // C�c tru?ng b? sung
          condition: allFormValues.condition || values.condition || 'new',
          inStock: hasVariants
            ? true
            : allFormValues.inStock !== undefined
              ? allFormValues.inStock
              : values.inStock !== undefined
                ? values.inStock
                : true,
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
          warrantyPackageIds:
            allFormValues.warrantyPackageIds || values.warrantyPackageIds || [],
          searchKeywords: (() => {
            const keywords =
              allFormValues.searchKeywords || values.searchKeywords;
            if (!keywords) return [];
            if (typeof keywords === 'string') {
              return keywords
                .split(',')
                .map((kw) => kw.trim())
                .filter((kw) => kw.length > 0);
            }
            if (Array.isArray(keywords)) {
              return keywords;
            }
            return [];
          })(),
          attributes:
            attributes.length > 0
              ? attributes.map((attr) => ({
                name: attr.name,
                value: Array.isArray((attr as any).values)
                  ? (attr as any).values.join(', ')
                  : (attr as any).value || (attr as any).values || '',
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
              stockQuantity: parseInt((variant as any).stockQuantity?.toString() || variant.stock?.toString() || '0') || 0,
              stock: parseInt(variant.stock?.toString() || (variant as any).stockQuantity?.toString() || '0') || 0,
              sku: variant.sku || `VAR-${Date.now()}-${index + 1}`,
              isDefault: index === 0, // Bi?n th? d?u ti�n l� m?c d?nh
              isAvailable: true,
              attributes: variant.attributes || {},
              specifications: variant.specifications || {},
              images: variant.images || [],
            }))
            : [],
          // Th�m c�c tru?ng SEO - ch? th�m n?u c� gi� tr?
          ...(allFormValues.seoTitle || values.seoTitle
            ? {
              seoTitle: (allFormValues.seoTitle || values.seoTitle).substring(
                0,
                500
              ),
            }
            : {}),
          ...(allFormValues.seoDescription || values.seoDescription
            ? {
              seoDescription:
                allFormValues.seoDescription || values.seoDescription,
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

        await createProduct(productData).unwrap();
        message.success(t('admin.products.messages.createSuccess'));
        navigate('/admin/products');
      } catch (error: any) {
        // Rollback: x�a ?nh description d� upload n?u t?o s?n ph?m th?t b?i
        // Tr�nh orphaned files khi form b? l?i validation sau khi ?nh d� du?c upload
        if (uploadedDescImageIds.length > 0) {
          await Promise.allSettled(
            uploadedDescImageIds.map((id) => deleteImage(id).unwrap().catch(() => {}))
          );
        }
        const errorMessage = formatErrorMessage(error);
        message.error(errorMessage);
      }
    },
    isSubmitting: isCreating,
  });

  // H�m h? tr? d?nh d?ng th�ng b�o l?i
  const formatErrorMessage = (error: any): string => {
    if (error?.data?.message) {
      return error.data.message;
    }

    if (error?.data?.errors && error.data.errors.length > 0) {
      if (error.data.errors.length === 1) {
        return (
          error.data.errors[0].message ||
          `${error.data.errors[0].field}: ${t('admin.products.messages.validationError')}`
        );
      }

      // Multiple errors - format nicely
      const errorList = error.data.errors
        .map((err: any) => err.message || `${err.field}: ${t('admin.products.messages.validationError')}`)
        .join('\n� ');
      return `${t('admin.products.messages.multipleErrors', { count: error.data.errors.length })}:\n� ${errorList}`;
    }

    if (error?.message) {
      return error.message;
    }

    return t('admin.products.messages.createFailed');
  };

  const categoriesList = categories || [];

  // Th? t? tab c? d?nh
  const TAB_ORDER = [
    'basic',
    'specifications',
    'attributes',
    'variants',
    'pricing',
    'category',
    'images',
    'warranty',
    'faqs',
    'seo',
  ];

  // H�m ki?m tra xem tab c� du?c ph�p truy c?p kh�ng
  const isTabAccessible = (tabKey: string): boolean => {
    const targetIndex = TAB_ORDER.indexOf(tabKey);

    // Tab d?u ti�n lu�n c� th? truy c?p
    if (targetIndex === 0) return true;

    // Ki?m tra xem t?t c? c�c tab tru?c d� d� ho�n th�nh chua
    for (let i = 0; i < targetIndex; i++) {
      const stepKey = TAB_ORDER[i];
      if (!completedSteps[stepKey]) {
        return false;
      }
    }

    return true;
  };

  // H�m x? l� khi thay d?i tab
  const handleTabChange = (key: string) => {
    if (!isTabAccessible(key)) {
      // Hi?n th? th�ng b�o n?u tab chua du?c ph�p truy c?p
      alert(t('admin.products.tabs.incompleteWarning'));
      return;
    }
    setActiveTab(key);
  };

  const tabItems = [
    {
      key: 'basic',
      label: (
        <span
          style={{
            color: completedSteps.basic
              ? '#52c41a'
              : isTabAccessible('basic')
                ? '#000'
                : '#999',
          }}
        >
          {t('admin.products.tabs.basic')} {completedSteps.basic ? '?' : ''}
        </span>
      ),
      disabled: !isTabAccessible('basic'),
      children: (
        <>
          <ProductBasicInfoForm
            fillExampleData={fillExampleData}
            productId={undefined}
          />
          <TabNavigation
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabOrder={TAB_ORDER}
            completedSteps={completedSteps}
          />
        </>
      ),
    },
    {
      key: 'specifications',
      label: (
        <span
          style={{
            color: completedSteps.specifications
              ? '#52c41a'
              : isTabAccessible('specifications')
                ? '#000'
                : '#999',
          }}
        >
          {t('admin.products.tabs.specifications')} <span style={{ color: '#ff4d4f' }}>*</span>{' '}
          {completedSteps.specifications ? '?' : ''}
        </span>
      ),
      disabled: !isTabAccessible('specifications'),
      children: (
        <>
          <ProductSpecificationsForm initialSpecifications={[]} />
          <TabNavigation
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabOrder={TAB_ORDER}
            completedSteps={completedSteps}
          />
        </>
      ),
    },
    {
      key: 'attributes',
      label: (
        <span
          style={{
            color: completedSteps.attributes
              ? '#52c41a'
              : isTabAccessible('attributes')
                ? '#000'
                : '#999',
          }}
        >
          {t('admin.products.tabs.attributes')} <span style={{ color: '#ff4d4f' }}>*</span>{' '}
          {completedSteps.attributes ? '?' : ''}
        </span>
      ),
      disabled: !isTabAccessible('attributes'),
      children: (
        <>
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
          />
        </>
      ),
    },
    {
      key: 'variants',
      label: (
        <span
          style={{
            color: completedSteps.variants
              ? '#52c41a'
              : isTabAccessible('variants')
                ? '#000'
                : '#999',
          }}
        >
          {t('admin.products.tabs.variants')} <span style={{ color: '#ff4d4f' }}>*</span>{' '}
          {completedSteps.variants ? '?' : ''}
        </span>
      ),
      disabled: !isTabAccessible('variants'),
      children: (
        <>
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
          />
        </>
      ),
    },
    {
      key: 'pricing',
      label: (
        <span
          style={{
            color: completedSteps.pricing
              ? '#52c41a'
              : isTabAccessible('pricing')
                ? '#000'
                : '#999',
          }}
        >
          {t('admin.products.tabs.pricing')} {completedSteps.pricing ? '?' : ''}
        </span>
      ),
      disabled: !isTabAccessible('pricing'),
      children: (
        <>
          <ProductPricingForm hasVariants={variants.length > 0} />
          <TabNavigation
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabOrder={TAB_ORDER}
            completedSteps={completedSteps}
          />
        </>
      ),
    },
    {
      key: 'category',
      label: (
        <span
          style={{
            color: completedSteps.category
              ? '#52c41a'
              : isTabAccessible('category')
                ? '#000'
                : '#999',
          }}
        >
          {t('admin.products.tabs.category')} {completedSteps.category ? '?' : ''}
        </span>
      ),
      disabled: !isTabAccessible('category'),
      children: (
        <>
          <ProductCategoryForm
            categories={categoriesList}
            isLoading={isCategoriesLoading}
          />
          <TabNavigation
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabOrder={TAB_ORDER}
            completedSteps={completedSteps}
          />
        </>
      ),
    },
    {
      key: 'images',
      label: (
        <span
          style={{
            color: completedSteps.images
              ? '#52c41a'
              : isTabAccessible('images')
                ? '#000'
                : '#999',
          }}
        >
          {t('admin.products.tabs.images')} {completedSteps.images ? '?' : ''}
        </span>
      ),
      disabled: !isTabAccessible('images'),
      children: (
        <>
          <ProductImagesForm />
          <TabNavigation
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabOrder={TAB_ORDER}
            completedSteps={completedSteps}
          />
        </>
      ),
    },
    {
      key: 'warranty',
      label: (
        <span
          style={{
            color: completedSteps.warranty
              ? '#52c41a'
              : isTabAccessible('warranty')
                ? '#000'
                : '#999',
          }}
        >
          {t('admin.products.tabs.warranty')} {completedSteps.warranty ? '?' : ''}
        </span>
      ),
      disabled: !isTabAccessible('warranty'),
      children: (
        <>
          <ProductWarrantyForm form={form} />
          <TabNavigation
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabOrder={TAB_ORDER}
            completedSteps={completedSteps}
          />
        </>
      ),
    },
    {
      key: 'faqs',
      label: (
        <span
          style={{
            color: completedSteps.faqs
              ? '#52c41a'
              : isTabAccessible('faqs')
                ? '#000'
                : '#999',
          }}
        >
          {t('admin.products.tabs.faqs')} {completedSteps.faqs ? '?' : ''}
        </span>
      ),
      disabled: !isTabAccessible('faqs'),
      children: (
        <>
          <ProductFAQForm />
          <TabNavigation
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabOrder={TAB_ORDER}
            completedSteps={completedSteps}
          />
        </>
      ),
    },
    {
      key: 'seo',
      label: (
        <span
          style={{
            color: completedSteps.seo
              ? '#52c41a'
              : isTabAccessible('seo')
                ? '#000'
                : '#999',
          }}
        >
          {t('admin.products.tabs.seo')} {completedSteps.seo ? '?' : ''}
        </span>
      ),
      disabled: !isTabAccessible('seo'),
      children: (
        <>
          <ProductSeoForm />
          <TabNavigation
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            tabOrder={TAB_ORDER}
            completedSteps={completedSteps}
            isLastTab={true}
            onSubmit={() => handleSubmit(form.getFieldsValue())}
            isSubmitting={isCreating}
            submitText={t('admin.products.submit.create')}
            loadingText={t('admin.products.submit.creating')}
          />
        </>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <Card style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} style={{ margin: 0 }}>
              {t('admin.products.create.title')}
            </Title>
            <Text type="secondary">
              {t('admin.products.create.subtitle')}
            </Text>
          </Col>
          <Col>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/admin/products')}
              style={{ marginRight: 8 }}
            >
              {t('admin.products.backButton')}
            </Button>
          </Col>
        </Row>
      </Card>

      {/* Form */}
      <Card>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          onFieldsChange={validateForm}
          initialValues={{
            status: 'active',
            featured: false,
            stockQuantity: 0,
            price: 0,
          }}
        >
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            items={tabItems}
            style={{ minHeight: 400 }}
          />

          <Divider />

          <ValidationAlerts
            isFormValid={isFormValid}
            missingFields={[]} // getMissingFields() hi?n kh�ng c?n thi?t v� ValidationAlerts tr? v? null
          />

          {/* FormActions b? ?n v� button t?o s?n ph?m d� du?c chuy?n v�o TabNavigation */}
        </Form>
      </Card>

      {/* Modals */}
      {attributeModalVisible && (
        <AttributeModal
          visible={attributeModalVisible}
          onClose={closeAttributeModal}
          attribute={editingAttribute}
          onSave={handleAddAttribute}
        />
      )}

      {variantModalVisible && (
        <VariantModal
          visible={variantModalVisible}
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

