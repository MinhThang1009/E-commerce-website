import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES } from '@/routes/paths';
import {
  Form,
  Card,
  Tabs,
  Divider,
  Typography,
  Row,
  Col,
  Button,
  message,
  Spin,
  Result,
} from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';

// Custom hooks
import { useProductForm } from '../../hooks/useProductForm';
import { useProductAttributes } from '../../hooks/useProductAttributes';
import { useProductVariants } from '../../hooks/useProductVariants';

// Các API hook
import { useUpdateProductMutation, useGetAdminProductByIdQuery } from '@/features/admin';
import { useGetAllCategoriesQuery } from '../../api/categoryApi';
import { useConvertBase64ToImageMutation } from '@/features/upload';

// Components
import ProductBasicInfoForm from '../../components/ProductBasicInfoForm';
import ProductPricingForm from '../../components/ProductPricingForm';
import ProductCategoryForm from '../../components/ProductCategoryForm';
import ProductImagesForm from '../../components/ProductImagesForm';
import ProductAttributesSection from '../../components/ProductAttributesSection';
import ProductVariantsSection from '../../components/ProductVariantsSection';
import ProductWarrantyForm from '../../components/ProductWarrantyForm';
import ProductSeoForm from '../../components/ProductSeoForm';
import ProductSpecificationsForm from '../../components/ProductSpecificationsForm';
import ProductFAQForm from '../../components/ProductFAQForm';
import ValidationAlerts from '../../components/ValidationAlerts';
import FormActions from '../../components/FormActions';
import AttributeModal from '../../components/AttributeModal';
import VariantModal from '../../components/VariantModal';

// Types
import { ProductFormData, ProductAttribute, ProductVariant } from '@/types';
import type { UpdateProductRequest } from '@/features/admin/api/adminProductApi';

// Utils
import {
  processDescriptionImages,
  hasBase64Images,
} from '@/utils/descriptionImageProcessor';
import { getErrorMsg } from '@/utils/errorMessage';

const { Title, Text } = Typography;

const EditProductPage: React.FC = () => {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  // Các API hook
  const {
    data: productResponse,
    isLoading: isLoadingProduct,
    error: productError,
  } = useGetAdminProductByIdQuery(id || '', { enabled: !!id });

  const { data: categoriesResponse, isLoading: isCategoriesLoading } =
    useGetAllCategoriesQuery();
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
  const [specifications, setSpecifications] = useState<Array<{ id: string; name: string; value: string; category?: string }>>([]);

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
          seoKeywords: typeof formValues.seoKeywords === 'string'
            ? formValues.seoKeywords.split(',').map((kw: string) => kw.trim()).filter((kw: string) => kw)
            : formValues.seoKeywords || [],
          warrantyPackageIds: formValues.warrantyPackageIds || [],
          faqs: formValues.faqs || [],
          images: typeof formValues.images === 'string'
            ? formValues.images.split('\n').filter((img: string) => img.trim())
            : Array.isArray(formValues.images) ? formValues.images : [],
          specifications: (formValues.specifications || []).map((spec: { name: string; value: string; category?: string }) => ({
            name: spec.name,
            value: spec.value,
            category: spec.category || 'General',
          })),
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
        productData.compareAtPrice = compareAtPrice > 0 ? compareAtPrice : null;
        productData.comparePrice = compareAtPrice > 0 ? compareAtPrice : null;

        // Thuộc tính và biến thể - luôn gửi nếu có để an toàn
        productData.attributes = attributes.map((attr: ProductAttribute) => ({
          name: attr.name,
          value: Array.isArray(attr.values)
            ? attr.values.join(', ')
            : '',
        }));

        if (hasVariants) {
          productData.variants = variants.map((variant: ProductVariant, index: number) => ({
            id: variant.id && !variant.id.startsWith('var-') ? variant.id : undefined,
            name: variant.name,
            price: parseFloat(variant.price?.toString()) || 0,
            sku: variant.sku || `VAR-${id}-${index}-${Date.now()}`,
            isAvailable: true,
            isDefault: variant.isDefault || index === 0,
            stockQuantity: parseInt(variant.stockQuantity?.toString() || variant.stock?.toString() || '0') || 0,
            stock: parseInt(variant.stock?.toString() || variant.stockQuantity?.toString() || '0') || 0,
            attributes: variant.attributes || {},
          }));
        }

        await updateProduct(productData);
        message.success(t('admin.products.messages.updateSuccess'));
        navigate(ROUTES.ADMIN_PRODUCTS);
      } catch (error) {
        console.error('Failed to update product:', error);
        const errorMessage = formatErrorMessage(error);
        message.error(errorMessage);
      }
    },
    isSubmitting: isUpdating,
  });

  // State để theo dõi quá trình tải dữ liệu
  const [_isDataLoaded, _setIsDataLoaded] = useState(false);

  // Nạp dữ liệu sản phẩm vào form
  useEffect(() => {
    if (productResponse?.data) {
      // Xử lý cả format { product } và raw product
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API response shape phức tạp, cần dynamic access cho nhiều trường
      const rawData = productResponse.data as any;
      const product = rawData.product || rawData;

      // Xử lý mô tả: xử lý ảnh base64
      let processedDescription = product.description || '';

      // Nếu mô tả là chuỗi JSON, parse trước
      if (
        typeof processedDescription === 'string' &&
        processedDescription.startsWith('[')
      ) {
        try {
          const parsedDescription = JSON.parse(processedDescription);
          if (Array.isArray(parsedDescription)) {
            processedDescription = parsedDescription.join('');
          }
        } catch (e) {
          // Nếu parse thất bại, giữ nguyên
        }
      }

      // Trường hợp khác: mô tả rỗng nhưng có mảng images, thử tạo từ images
      if (
        !processedDescription &&
        product.images &&
        Array.isArray(product.images)
      ) {
        const imageElements = (product.images as string[])
          .filter((img: string) => img.includes('data:image'))
          .map(
            (img: string) =>
              `<img src="${img}" alt="${t('product.imageAlt')}" style="max-width: 100%; height: auto;" />`
          )
          .join('<br/>');

        if (imageElements) {
          processedDescription = imageElements;
        }
      }

      // Gán giá trị cho form
      form.setFieldsValue({
        name: product.baseName || product.name,
        description: processedDescription,
        shortDescription: product.shortDescription,
        price: parseFloat(product.price) || 0,
        compareAtPrice: parseFloat(product.compareAtPrice) || 0,
        stockQuantity: product.stockQuantity || 0,
        sku: product.sku,
        status: product.status,
        featured: product.featured,
        categoryIds: product.categories?.map((cat: { id: string }) => cat.id) || [],
        images: product.images?.join('\n') || '',
        thumbnail: product.thumbnail || '',
        seoTitle: product.seoTitle || '',
        seoDescription: product.seoDescription || '',
        seoKeywords: product.seoKeywords || '',
        warrantyPackageIds:
          product.warrantyPackages?.map((wp: { id: string }) => wp.id) || [],
        faqs: product.faqs || [],
        specifications: (() => {
          // Tải thông số từ bảng productSpecifications
          if (
            product.productSpecifications &&
            Array.isArray(product.productSpecifications)
          ) {
            const specs = product.productSpecifications.map(
              (spec: { id?: string; name: string; value: string; category?: string }, index: number) => ({
                id: spec.id || `spec-${index}`,
                name: spec.name,
                value: spec.value,
                category: spec.category || 'General',
              })
            );

            return specs;
          }
          return [];
        })(),
      });

      // Cập nhật state thông số kỹ thuật
      if (
        product.productSpecifications &&
        product.productSpecifications.length > 0
      ) {
        setSpecifications(product.productSpecifications);
      }

      // Gán thuộc tính và biến thể
      if (product.attributes) {
        const formattedAttributes: ProductAttribute[] = product.attributes.map(
          (attr: { id?: string; name: string; values?: string[]; value?: string }, index: number) => ({
            id: attr.id || `attr-${index}`,
            name: attr.name,
          // Nếu values là mảng, chuyển thành chuỗi ngăn cách bởi dấu phẩy
            value: Array.isArray(attr.values)
              ? attr.values.join(', ')
              : attr.value || '',
          })
        );
        setAttributes(formattedAttributes);
      }

      if (product.variants) {
        const formattedVariants: ProductVariant[] = product.variants.map(
          (variant: { id?: string; name: string; price: number | string; stockQuantity?: number; stock?: number; sku?: string; attributes?: Record<string, string> }, index: number) => ({
            id: variant.id || `var-${index}`,
            name: variant.name,
            price: parseFloat(String(variant.price)) || 0,
        // Sử dụng stockQuantity thay vì stock để dùng với dữ liệu API
            stock: variant.stockQuantity || variant.stock || 0,
            sku: variant.sku || '',
            attributes: variant.attributes || {},
          })
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
            return (
              value !== undefined &&
              value !== null &&
              value !== '' &&
              value >= 0
            );
          }
          return (
            value !== undefined &&
            value !== null &&
            value !== '' &&
            value.toString().trim() !== ''
          );
        });

        // Kiểm tra có lỗi validation nào không
        const hasErrors = errors.some(
          (error) => error.errors && error.errors.length > 0
        );

        const isValid = isFieldsFilled && !hasErrors;
        setIsFormValid(isValid);
      }, 100);
    }
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

  // Xử lý trạng thái loading và error
  if (isLoadingProduct) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" tip={t('admin.products.loadingText')} />
      </div>
    );
  }

  if (productError || !id) {
    return (
      <Result
        status="error"
        title={t('admin.products.errors.loadFailed')}
        subTitle={t('admin.products.errors.loadFailedDesc')}
        extra={[
          <Button
            type="primary"
            key="back"
            onClick={() => navigate(ROUTES.ADMIN_PRODUCTS)}
          >
            {t('admin.products.backToList')}
          </Button>,
        ]}
      />
    );
  }

  const tabItems = [
    {
      key: 'basic',
      label: t('admin.products.editTabs.basic'),
      children: <ProductBasicInfoForm fillExampleData={fillExampleData} />,
    },
    {
      key: 'attributes',
      label: t('admin.products.editTabs.attributes'),
      children: (
        <ProductAttributesSection
          attributes={attributes}
          onAddAttribute={() => openAttributeModal()}
          onEditAttribute={(attribute) => openAttributeModal(attribute)}
          onDeleteAttribute={handleDeleteAttribute}
        />
      ),
    },
    {
      key: 'variants',
      label: t('admin.products.editTabs.variants'),
      children: (
        <ProductVariantsSection
          variants={variants}
          onAddVariant={() => openVariantModal()}
          onEditVariant={(variant) => openVariantModal(variant)}
          onDeleteVariant={handleDeleteVariant}
        />
      ),
    },
    {
      key: 'specifications',
      label: t('admin.products.editTabs.specifications'),
      children: (
        <ProductSpecificationsForm initialSpecifications={specifications} />
      ),
    },
    {
      key: 'pricing',
      label: t('admin.products.editTabs.pricing'),
      children: <ProductPricingForm hasVariants={variants.length > 0} />,
    },
    {
      key: 'category',
      label: t('admin.products.editTabs.category'),
      children: (
        <ProductCategoryForm
          categories={categories}
          isLoading={isCategoriesLoading}
        />
      ),
    },
    {
      key: 'images',
      label: t('admin.products.editTabs.images'),
      children: <ProductImagesForm />,
    },
    {
      key: 'warranty',
      label: t('admin.products.editTabs.warranty'),
      children: <ProductWarrantyForm form={form} />,
    },
    {
      key: 'seo',
      label: t('admin.products.editTabs.seo'),
      children: <ProductSeoForm />,
    },
    {
      key: 'faqs',
      label: t('admin.products.tabs.faqs'),
      children: <ProductFAQForm />,
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <Card style={{ marginBottom: 24 }}>
        <Row justify="space-between" align="middle">
          <Col>
            <Title level={2} style={{ margin: 0 }}>
              {t('admin.products.edit.title')}
            </Title>
            <Text type="secondary">{t('admin.products.edit.subtitle')}</Text>
          </Col>
          <Col>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate(ROUTES.ADMIN_PRODUCTS)}
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
        >
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            items={tabItems}
            style={{ minHeight: 400 }}
          />

          <Divider />

          <ValidationAlerts
            isFormValid={isFormValid}
            missingFields={getMissingFields()}
          />

          <FormActions
            isFormValid={isFormValid}
            isSubmitting={isUpdating}
            submitText={t('admin.products.submit.update')}
            loadingText={t('admin.products.submit.updating')}
            onCancel={() => navigate(ROUTES.ADMIN_PRODUCTS)}
          />
        </Form>
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

export default EditProductPage;

