import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
import { useProductForm } from '@/hooks/useProductForm';
import { useProductAttributes } from '@/hooks/useProductAttributes';
import { useProductVariants } from '@/hooks/useProductVariants';

// API hooks
import { useUpdateProductMutation, useGetAdminProductByIdQuery } from '@/services/adminProductApi';
import { useGetAllCategoriesQuery } from '@/services/categoryApi';
import { useConvertBase64ToImageMutation } from '@/services/imageApi';

// Components
import ProductBasicInfoForm from '@/components/product/ProductBasicInfoForm';
import ProductPricingForm from '@/components/product/ProductPricingForm';
import ProductCategoryForm from '@/components/product/ProductCategoryForm';
import ProductImagesForm from '@/components/product/ProductImagesForm';
import ProductAttributesSection from '@/components/product/ProductAttributesSection';
import ProductVariantsSection from '@/components/product/ProductVariantsSection';
import ProductWarrantyForm from '@/components/product/ProductWarrantyForm';
import ProductSeoForm from '@/components/product/ProductSeoForm';
import ProductSpecificationsForm from '@/components/product/ProductSpecificationsForm';
import ProductFAQForm from '@/components/product/ProductFAQForm';
import ValidationAlerts from '@/components/product/ValidationAlerts';
import FormActions from '@/components/product/FormActions';
import AttributeModal from '@/components/modals/AttributeModal';
import VariantModal from '@/components/modals/VariantModal';

// Types
import { ProductFormData, ProductAttribute, ProductVariant } from '@/types';

// Utils
import {
  processDescriptionImages,
  hasBase64Images,
} from '@/utils/descriptionImageProcessor';

const { Title, Text } = Typography;

const EditProductPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form] = Form.useForm();

  // API hooks
  const {
    data: productResponse,
    isLoading: isLoadingProduct,
    error: productError,
  } = useGetAdminProductByIdQuery(id || '', { skip: !id });

  const { data: categoriesResponse, isLoading: isCategoriesLoading } =
    useGetAllCategoriesQuery();
  const [updateProduct, { isLoading: isUpdating }] = useUpdateProductMutation();
  const [convertBase64ToImage] = useConvertBase64ToImageMutation();

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

  // State for specifications
  const [specifications, setSpecifications] = useState<any[]>([]);

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
    onSubmit: async (values: ProductFormData) => {
      if (!id) return;

      try {
        const formValues = form.getFieldsValue(true);
        const hasVariants = variants.length > 0;

        // Process description to convert base64 images if needed
        let processedDescription = formValues.description || '';
        if (hasBase64Images(processedDescription)) {
          const result = await processDescriptionImages(processedDescription, {
            productId: id,
            category: 'product' as const,
            uploadImageFn: async ({ base64Data, options }) => {
              return await convertBase64ToImage({
                base64Data,
                options: options as any,
              }).unwrap();
            },
          });
          if (result.hasChanges) {
            processedDescription = result.processedDescription;
          }
        }

        // Build the complete update object
        const productData: any = {
          id,
          name: formValues.name,
          baseName: formValues.baseName || formValues.name,
          shortDescription: formValues.shortDescription,
          description: processedDescription,
          status: formValues.status,
          featured: formValues.featured,
          categoryIds: formValues.categoryIds || [],
          searchKeywords: typeof formValues.searchKeywords === 'string'
            ? formValues.searchKeywords.split(',').map((kw: string) => kw.trim()).filter((kw: string) => kw)
            : formValues.searchKeywords || [],
          seoTitle: formValues.seoTitle,
          seoDescription: formValues.seoDescription,
          seoKeywords: typeof formValues.seoKeywords === 'string'
            ? formValues.seoKeywords.split(',').map((kw: string) => kw.trim()).filter((kw: string) => kw)
            : formValues.seoKeywords || [],
          warrantyPackageIds: formValues.warrantyPackageIds || [],
          faqs: formValues.faqs || [],
          thumbnail: formValues.thumbnail || '',
          images: typeof formValues.images === 'string'
            ? formValues.images.split('\n').filter((img: string) => img.trim())
            : Array.isArray(formValues.images) ? formValues.images : [],
          specifications: (formValues.specifications || []).map((spec: any) => ({
            name: spec.name,
            value: spec.value,
            category: spec.category || 'General',
          })),
        };

        // Price and Stock logic
        if (hasVariants) {
          productData.price = 0;
          productData.stock = 0;
          productData.stockQuantity = 0;
        } else {
          productData.price = parseFloat(formValues.price?.toString()) || 0;
          productData.stock = parseInt(formValues.stockQuantity?.toString()) || 0;
          productData.stockQuantity = parseInt(formValues.stockQuantity?.toString()) || 0;
        }

        // Compare price
        const compareAtPrice = parseFloat(formValues.compareAtPrice?.toString()) || 0;
        productData.compareAtPrice = compareAtPrice > 0 ? compareAtPrice : null;
        productData.comparePrice = compareAtPrice > 0 ? compareAtPrice : null;

        // Attributes and Variants - Always send if they exist to be safe, or do a shallow content check
        productData.attributes = attributes.map((attr: any) => ({
          name: attr.name,
          value: Array.isArray((attr as any).values) 
            ? (attr as any).values.join(', ') 
            : (attr as any).value || (attr as any).values || '',
        }));

        if (hasVariants) {
          productData.variants = variants.map((variant: any, index: number) => ({
            id: variant.id && !variant.id.startsWith('var-') ? variant.id : undefined,
            name: variant.name,
            price: parseFloat(variant.price?.toString()) || 0,
            sku: variant.sku || `VAR-${id}-${index}-${Date.now()}`,
            isAvailable: true,
            isDefault: variant.isDefault || index === 0,
            stockQuantity: parseInt((variant as any).stockQuantity?.toString() || variant.stock?.toString() || '0') || 0,
            stock: parseInt(variant.stock?.toString() || (variant as any).stockQuantity?.toString() || '0') || 0,
            attributes: variant.attributes || {},
          }));
        }

        console.log('Updating product with data:', productData);
        await updateProduct(productData).unwrap();
        message.success('Cập nhật sản phẩm thành công!');
        navigate('/admin/products');
      } catch (error: any) {
        console.error('Failed to update product:', error);
        const errorMessage = formatErrorMessage(error);
        message.error(errorMessage);
      }
    },
    isSubmitting: isUpdating,
  });

  // State để theo dõi quá trình tải dữ liệu
  const [isDataLoaded, setIsDataLoaded] = useState(false);

  // Load product data into form
  useEffect(() => {
    if (productResponse?.data) {
      // Handle both { product } and raw product formats
      const product = (productResponse.data as any).product || productResponse.data;

      // Process description to handle base64 images
      let processedDescription = product.description || '';

      // If description is a JSON string, parse it
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
          // If parsing fails, use as is
        }
      }

      // Alternative: If description is empty but we have images array, try to construct from images
      if (
        !processedDescription &&
        product.images &&
        Array.isArray(product.images)
      ) {
        const imageElements = product.images
          .filter((img: any) => img.includes('data:image'))
          .map(
            (img: any) =>
              `<img src="${img}" alt="Product image" style="max-width: 100%; height: auto;" />`
          )
          .join('<br/>');

        if (imageElements) {
          processedDescription = imageElements;
        }
      }

      // Set form values
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
        categoryIds: product.categories?.map((cat: any) => cat.id) || [],
        images: product.images?.join('\n') || '',
        thumbnail: product.thumbnail || '',
        searchKeywords: Array.isArray(product.searchKeywords)
          ? product.searchKeywords.join(', ')
          : product.searchKeywords || '',
        seoTitle: product.seoTitle || '',
        seoDescription: product.seoDescription || '',
        seoKeywords: product.seoKeywords || '',
        warrantyPackageIds:
          product.warrantyPackages?.map((wp: any) => wp.id) || [],
        faqs: product.faqs || [],
        specifications: (() => {
          // Load specifications from productSpecifications table
          if (
            product.productSpecifications &&
            Array.isArray(product.productSpecifications)
          ) {
            const specs = product.productSpecifications.map(
              (spec: any, index: number) => ({
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

      // Set specifications state
      if (
        product.productSpecifications &&
        product.productSpecifications.length > 0
      ) {
        setSpecifications(product.productSpecifications);
      }

      // Set attributes and variants
      if (product.attributes) {
        const formattedAttributes: ProductAttribute[] = product.attributes.map(
          (attr: any, index: number) => ({
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
          (variant: any, index: number) => ({
            id: variant.id || `var-${index}`,
            name: variant.name,
            price: parseFloat(variant.price) || 0,
            // Sử dụng stockQuantity thay vì stock để đúng với dữ liệu API
            stock: variant.stockQuantity || variant.stock || 0,
            sku: variant.sku || '',
            attributes: variant.attributes || {},
          })
        );
        setVariants(formattedVariants);
      }

      // Validate form after loading data - but don't include validateForm in dependencies
      setTimeout(() => {
        // Manually validate without using the validateForm function
        const values = form.getFieldsValue();
        const errors = form.getFieldsError();

        // Check if all required fields are filled
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

        // Check if there are any validation errors
        const hasErrors = errors.some(
          (error) => error.errors && error.errors.length > 0
        );

        const isValid = isFieldsFilled && !hasErrors;
        setIsFormValid(isValid);
      }, 100);
    }
  }, [productResponse, form, setAttributes, setVariants, setIsFormValid]);

  // Helper function to format error messages
  const formatErrorMessage = (error: any): string => {
    if (error?.data?.message) {
      return error.data.message;
    }

    if (error?.data?.errors && error.data.errors.length > 0) {
      if (error.data.errors.length === 1) {
        return (
          error.data.errors[0].message ||
          `${error.data.errors[0].field}: Lỗi validation`
        );
      }

      // Multiple errors - format nicely
      const errorList = error.data.errors
        .map((err: any) => err.message || `${err.field}: Lỗi validation`)
        .join('\n• ');
      return `Có ${error.data.errors.length} lỗi cần khắc phục:\n• ${errorList}`;
    }

    if (error?.message) {
      return error.message;
    }

    return 'Cập nhật sản phẩm thất bại. Vui lòng thử lại.';
  };

  const categories: any[] = Array.isArray(categoriesResponse?.data) 
    ? categoriesResponse.data 
    : categoriesResponse?.data 
      ? [categoriesResponse.data] 
      : [];

  // Handle loading and error states
  if (isLoadingProduct) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" tip="Đang tải thông tin sản phẩm..." />
      </div>
    );
  }

  if (productError || !id) {
    return (
      <Result
        status="error"
        title="Không thể tải thông tin sản phẩm"
        subTitle="Có lỗi xảy ra khi tải thông tin sản phẩm hoặc sản phẩm không tồn tại."
        extra={[
          <Button
            type="primary"
            key="back"
            onClick={() => navigate('/admin/products')}
          >
            Quay lại danh sách
          </Button>,
        ]}
      />
    );
  }

  const tabItems = [
    {
      key: 'basic',
      label: '1. Thông tin cơ bản',
      children: <ProductBasicInfoForm fillExampleData={fillExampleData} />,
    },
    {
      key: 'attributes',
      label: '2. Thuộc tính',
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
      label: '3. Biến thể',
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
      label: '4. Thông số kỹ thuật',
      children: (
        <ProductSpecificationsForm initialSpecifications={specifications} />
      ),
    },
    {
      key: 'pricing',
      label: '5. Giá & Kho hàng',
      children: <ProductPricingForm hasVariants={variants.length > 0} />,
    },
    {
      key: 'category',
      label: '6. Phân loại',
      children: (
        <ProductCategoryForm
          categories={categories}
          isLoading={isCategoriesLoading}
        />
      ),
    },
    {
      key: 'images',
      label: '7. Hình ảnh',
      children: <ProductImagesForm />,
    },
    {
      key: 'warranty',
      label: '8. Bảo hành',
      children: <ProductWarrantyForm form={form} />,
    },
    {
      key: 'seo',
      label: '9. SEO',
      children: <ProductSeoForm />,
    },
    {
      key: 'faqs',
      label: '10. FAQ',
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
              Chỉnh sửa sản phẩm
            </Title>
            <Text type="secondary">Cập nhật thông tin sản phẩm</Text>
          </Col>
          <Col>
            <Button
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/admin/products')}
              style={{ marginRight: 8 }}
            >
              Quay lại
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
            submitText="Cập nhật sản phẩm"
            loadingText="Đang cập nhật..."
            onCancel={() => navigate('/admin/products')}
          />
        </Form>
      </Card>

      {/* Modals */}
      {attributeModalVisible && (
        <AttributeModal
          visible={attributeModalVisible}
          onClose={closeAttributeModal}
          attribute={editingAttribute as any}
          onSave={handleAddAttribute}
        />
      )}

      {variantModalVisible && (
        <VariantModal
          visible={variantModalVisible}
          onClose={closeVariantModal}
          variant={editingVariant as any}
          onSave={handleAddVariant}
          attributes={attributes as any}
        />
      )}
    </div>
  );
};

export default EditProductPage;
