import { useState, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Form, FormInstance, message } from 'antd';
import { ProductFormData } from '@/types';

interface UseProductFormProps {
  form: FormInstance;
  initialValues?: Partial<ProductFormData>;
  onSubmit: (values: ProductFormData) => Promise<void>;
  isSubmitting: boolean;
  onStepComplete?: (step: string, isComplete: boolean) => void;
  attributes?: Array<{ name: string; value?: string; values?: string[] }>;
  variants?: Array<{ name: string; price: number; stock?: number; stockQuantity?: number }>;

  isEditMode?: boolean; // Thêm prop để phân biệt edit vs create
}

export const useProductForm = ({
  form,
  initialValues,
  onSubmit,
  isSubmitting,
  onStepComplete,
  attributes = [],
  variants = [],
  isEditMode = false,
}: UseProductFormProps) => {
  const { t } = useTranslation();
  const [isFormValid, setIsFormValid] = useState(false);
  const [activeTab, setActiveTab] = useState('basic');

  // Hàm validation độc lập
  const performValidation = () => {
    const values = form.getFieldsValue();
    const errors = form.getFieldsError();

    // Validate và cập nhật completion cho từng step
    const validateStep = (step: string) => {
      let isStepValid = false;

      switch (step) {
        case 'basic': {
          const basicRequiredFields = [
            'name',
            'shortDescription',
            'description',
          ];
          isStepValid = basicRequiredFields.every((field) => {
            const value = values[field];
            const isValid =
              value !== undefined &&
              value !== null &&
              value !== '' &&
              (typeof value === 'string' ? value.trim() !== '' : true);
            return isValid;
          });
          break;
        }
        case 'specifications':
          // Specifications không bắt buộc, luôn valid
          isStepValid = true;
          break;
        case 'attributes':
          // Attributes không bắt buộc, luôn valid
          isStepValid = true;
          break;
        case 'variants':
          // Variants không bắt buộc, luôn valid
          isStepValid = true;
          break;
        case 'pricing': {
          // Nếu có variants, stockQuantity có thể = 0 (vì variants sẽ có stock riêng)
          // Nếu không có variants, cần kiểm tra cả price và stockQuantity
          const hasVariants = variants.length > 0;

          if (hasVariants) {
            // Nếu có variants, chỉ cần stockQuantity được định nghĩa (có thể = 0)
            const stockValue = values['stockQuantity'];
            isStepValid =
              stockValue !== undefined &&
              stockValue !== null &&
              stockValue !== '';
          } else {
            // Nếu không có variants, cần price > 0 và stockQuantity >= 0
            const priceValue = values['price'];
            const stockValue = values['stockQuantity'];

            const priceValid =
              priceValue !== undefined &&
              priceValue !== null &&
              priceValue !== '' &&
              parseFloat(priceValue.toString()) > 0;

            const stockValid =
              stockValue !== undefined &&
              stockValue !== null &&
              stockValue !== '' &&
              parseInt(stockValue.toString()) >= 0;

            isStepValid = priceValid && stockValid;
          }

          break;
        }
        case 'category': {
          const categoryValue = values['categoryIds'];
          isStepValid =
            categoryValue &&
            Array.isArray(categoryValue) &&
            categoryValue.length > 0;
          break;
        }
        case 'images':
          // Images không bắt buộc
          isStepValid = true;
          break;
        case 'warranty':
          // Warranty không bắt buộc
          isStepValid = true;
          break;
        case 'faqs':
          // FAQs không bắt buộc
          isStepValid = true;
          break;
        case 'seo':
          // SEO không bắt buộc
          isStepValid = true;
          break;
        default:
          isStepValid = false;
      }

      // Cập nhật completion status cho step
      if (onStepComplete) {
        onStepComplete(step, isStepValid);
      }

      return isStepValid;
    };

    // Validate tất cả các steps
    const allSteps = [
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
    allSteps.forEach((step) => validateStep(step));

    // Validate step hiện tại
    const currentStepValid = validateStep(activeTab);

    // Kiểm tra xem có lỗi validation nào không
    const hasErrors = errors.some(
      (error) => error.errors && error.errors.length > 0
    );

    // Form chỉ valid khi không có lỗi
    const isValid = !hasErrors;
    setIsFormValid(isValid);

    return currentStepValid;
  };

  // Theo dõi sự thay đổi của activeTab, attributes, variants
  useEffect(() => {
    // Khi tab thay đổi, kiểm tra tính hợp lệ của form
    performValidation();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- performValidation dùng form/onStepComplete qua closure, chỉ trigger khi tab/attributes/variants thay đổi
  }, [activeTab, attributes, variants]);

  // Đặt giá trị khởi tạo
  useEffect(() => {
    if (initialValues) {
      form.setFieldsValue(initialValues);
    }
  }, [initialValues, form]);

  // Theo dõi thay đổi giá trị form để cập nhật validation
  const watchFormValues = Form.useWatch([], form);

  // Sử dụng useRef để tránh vòng lặp vô hạn
  const isFirstRender = useRef(true);
  const validationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Bỏ qua validation ở lần render đầu tiên
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }

    // Xóa timeout trước đó để tránh validation nhiều lần
    if (validationTimeoutRef.current) {
      clearTimeout(validationTimeoutRef.current);
    }

    // Dùng hàm validation cục bộ thay vì gọi validateForm trực tiếp
    // để tránh vòng lặp dependency
    const validateFormValues = () => {
      const values = form.getFieldsValue();
      const errors = form.getFieldsError();

      // Kiểm tra xem tất cả trường bắt buộc đã được điền chưa
      const requiredFields = [
        'name',
        'shortDescription',
        'description',
        'price',
        'stockQuantity',
        'categoryIds',
        // Thêm thuộc tính và biến thể vào danh sách trường bắt buộc
        // 'attributes',
        // 'variants',
      ];

      const isFieldsFilled = requiredFields.every((field) => {
        const value = values[field];
        if (field === 'categoryIds') {
          return value && Array.isArray(value) && value.length > 0;
        }
        if (field === 'price' || field === 'stockQuantity') {
          return (
            value !== undefined && value !== null && value !== '' && value >= 0
          );
        }
        // Kiểm tra thuộc tính và biến thể nếu cần
        // if (field === 'attributes') {
        //   // Kiểm tra xem có thuộc tính nào không
        //   return value && Array.isArray(value) && value.length > 0;
        // }
        // if (field === 'variants') {
        //   // Kiểm tra xem có biến thể nào không
        //   return value && Array.isArray(value) && value.length > 0;
        // }
        return (
          value !== undefined &&
          value !== null &&
          value !== '' &&
          (typeof value === 'string' ? value.trim() !== '' : true)
        );
      });

      // Kiểm tra xem có lỗi validation nào không
      const hasErrors = errors.some(
        (error) => error.errors && error.errors.length > 0
      );

      const isValid = isFieldsFilled && !hasErrors;
      setIsFormValid(isValid);
    };

    // Sử dụng setTimeout để tránh quá nhiều validation liên tục
    validationTimeoutRef.current = setTimeout(() => {
      validateFormValues();
    }, 100);

    return () => {
      if (validationTimeoutRef.current) {
        clearTimeout(validationTimeoutRef.current);
      }
    };
  }, [watchFormValues, form]);

  // Validate form - hiện dùng cho validation thủ công
  // (ví dụ: được gọi từ bên ngoài hook)
  const validateForm = () => {
    return performValidation();
  };

  // Lấy danh sách trường bắt buộc còn thiếu để hiển thị
  const getMissingFields = () => {
    // Sử dụng watchFormValues nếu có để tránh cảnh báo form chưa kết nối khi render
    // Nếu không có (ví dụ: lần render đầu tiên), sử dụng giá trị rỗng
    const values = watchFormValues || {};

    const fieldLabels = {
      name: t('productForm.fieldName'),
      shortDescription: t('productForm.fieldShortDesc'),
      description: t('productForm.fieldDesc'),
      price: t('productForm.fieldPrice'),
      stockQuantity: t('productForm.fieldStock'),
      categoryIds: t('productForm.fieldCategory'),
      attributes: t('productForm.fieldAttributes'),
      variants: t('productForm.fieldVariants'),
    };

    // Chỉ kiểm tra các trường form cơ bản, không kiểm tra attributes và variants
    // vì chúng được quản lý trong state riêng biệt
    const requiredFields = [
      'name',
      'shortDescription',
      'description',
      'price',
      'stockQuantity',
      'categoryIds',
    ];

    const missingFields = requiredFields.filter((field) => {
      const value = values[field];

      if (field === 'categoryIds') {
        const isValid = value && Array.isArray(value) && value.length > 0;
        return !isValid;
      }
      if (field === 'price') {
        // Nếu có variants, price có thể = 0 hoặc undefined
        const hasVariants = variants.length > 0;
        if (hasVariants) {
          return false; // Không yêu cầu price khi có variants
        }
        const isValid =
          value !== undefined &&
          value !== null &&
          value !== '' &&
          parseFloat(value.toString()) > 0;
        return !isValid;
      }
      if (field === 'stockQuantity') {
        const isValid =
          value !== undefined &&
          value !== null &&
          value !== '' &&
          parseInt(value.toString()) >= 0;
        return !isValid;
      }
      const isValid =
        value !== undefined &&
        value !== null &&
        value !== '' &&
        (typeof value === 'string' ? value.trim() !== '' : true);
      return !isValid;
    });

    // Attributes và variants không bắt buộc nữa
    // Bỏ qua kiểm tra attributes và variants

    return missingFields.map(
      (field) => fieldLabels[field as keyof typeof fieldLabels]
    );
  };

  // Điền dữ liệu mẫu
  const fillExampleData = () => {
    form.setFieldsValue({
      name: t('productForm.sampleName'),
      description: t('productForm.sampleDescription'),
      shortDescription: t('productForm.sampleShortDesc'),
      price: 28990000,
      compareAtPrice: 31990000,
      stockQuantity: 50,
      status: 'active',
      featured: true,
      categoryIds: [],
      seoTitle: t('productForm.sampleSeoTitle'),
      seoDescription: t('productForm.sampleSeoDesc'),
      seoKeywords: t('productForm.sampleSeoKeywords'),
    });

    // Trigger validation sau khi fill data
    setTimeout(() => {
      performValidation();
    }, 100);
  };

  // Xử lý submit form
  const handleSubmit = async (values: ProductFormData) => {
    // Nếu đang ở chế độ chỉnh sửa (EditProductPage), cho phép submit mà không cần kiểm tra đầy đủ
    if (isEditMode) {
      try {
        await onSubmit(values);
      } catch (error) {
        message.error(t('productForm.saveError'));
      }
      return;
    }

    // Nếu đang ở chế độ tạo mới (CreateProductPage), kiểm tra các trường bắt buộc
    const missingFieldNames = getMissingFields();

    if (missingFieldNames.length > 0) {
      message.error(t('productForm.fillRequired', { fields: missingFieldNames.join(', ') }));
      return;
    }

    try {
      await onSubmit(values);
    } catch (error) {
      message.error(t('productForm.saveError'));
    }
  };

  return {
    isFormValid,
    setIsFormValid,
    activeTab,
    setActiveTab,
    validateForm,
    getMissingFields,
    fillExampleData,
    handleSubmit,
    isSubmitting,
  };
};

