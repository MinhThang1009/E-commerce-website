/**
 * @file CheckoutPage.tsx
 * @layer Page
 * @feature checkout
 * @description Page component của feature checkout
 */
import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ROUTES, buildRoute } from '@/routes/paths';
import { SHIPPING } from '@/constants';
import { useQueryClient } from '@tanstack/react-query';
import {
  CheckoutOrderSummary,
  CheckoutPaymentMethod,
  CheckoutShippingForm,
} from '@/features/checkout';
import CheckoutStepIndicator from '../components/CheckoutStepIndicator';
import { motion, AnimatePresence } from 'framer-motion';
import { PremiumButton } from '@/components/common';
import { useCartStore } from '@/stores/cart-store';
import { useAuthStore } from '@/stores/auth-store';
import { useUiStore } from '@/stores/ui-store';
import {
  useCreateOrderMutation,
  useApplyDiscountCodeMutation,
  useGetAvailableDiscountCodesQuery,
} from '@/features/orders';
import { cartKeys, useGetCartCountQuery } from '@/features/cart';
import { useCreateMomoUrlMutation } from '@/features/payment';
import { useCreateVNPayUrlMutation } from '@/features/payment';
import { useGetAddressesQuery } from '@/features/users';
import { getErrorMsg } from '@/utils/error-utils';

const CheckoutPage: React.FC = () => {
  const { t } = useTranslation();
  const cartItems = useCartStore((s) => s.items);
  const clearLocalCart = useCartStore((s) => s.clearLocalCart);
  const initializeCart = useCartStore((s) => s.initializeCart);
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const location = useLocation();
  const addNotification = useUiStore((s) => s.addNotification);
  const queryClient = useQueryClient();

  const [isBuyNow, setIsBuyNow] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return (
      searchParams.get('buyNow') === 'true' || sessionStorage.getItem('buyNowAction') === 'true'
    );
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [buyNowItem, setBuyNowItem] = useState<any>(() => {
    const itemStr = sessionStorage.getItem('buyNowItem');
    const searchParams = new URLSearchParams(window.location.search);
    const isBuyNowFlow =
      searchParams.get('buyNow') === 'true' || sessionStorage.getItem('buyNowAction') === 'true';
    return isBuyNowFlow && itemStr ? JSON.parse(itemStr) : null;
  });

  // Thống nhất danh sách items hiển thị trong checkout - nếu là mua ngay thì chỉ hiển thị 1 item, còn lại hiển thị toàn bộ giỏ hàng
  const items = useMemo(
    () => (isBuyNow && buyNowItem ? [buyNowItem] : cartItems),
    [isBuyNow, buyNowItem, cartItems],
  );

  // Kiểm tra giỏ hàng khi component mount để đảm bảo không có dữ liệu cũ hoặc người dùng truy cập sai cách
  useEffect(() => {
    // Kiểm tra xem URL có chứa tham số buyNow hay không
    const searchParams = new URLSearchParams(window.location.search);
    const isBuyNow = searchParams.get('buyNow') === 'true';

    // Kiểm tra xem URL có chứa tham số repayOrder hay orderId (cho trường hợp thanh toán lại đơn hàng thất bại) và amount
    const repayOrderId = searchParams.get('repayOrder') || searchParams.get('orderId');
    const repayAmount = searchParams.get('amount');

    // Kiểm tra xem URL có phải là URL cũ của trang thanh toán hay không (ví dụ: /checkout/payment?orderId=xxx&amount=yyy)
    const isOldPaymentUrl = window.location.pathname.includes('/checkout/payment');

    // Nếu là URL cũ và có tham số repayOrder và amount, chuyển hướng sang URL mới chuẩn với thông tin thanh toán lại đơn hàng
    if (isOldPaymentUrl && repayOrderId && repayAmount) {
      navigate(buildRoute.checkoutRepay(repayOrderId, repayAmount), {
        replace: true,
      });
      return;
    }

    // Kiểm tra nếu có tham số repayOrder và amount, thiết lập thông tin đơn hàng hiện tại để thanh toán lại
    if (repayOrderId && repayAmount) {
      // Thiết lập thông tin đơn hàng hiện tại với ID và tổng tiền từ tham số URL, đồng thời đánh dấu là đang thanh toán lại đơn hàng
      setCurrentOrder({
        id: repayOrderId,
        total: parseFloat(repayAmount),
        isRepay: true,
      });

      setFormData((prev) => ({
        ...prev,
        paymentMethod: 'vnpay',
      }));

      return;
    }

    // Kiểm tra xem người dùng vừa thực hiện hành động "Mua ngay" hay không thông qua sessionStorage (trường hợp chuyển hướng từ trang sản phẩm)
    const isBuyNowAction = sessionStorage.getItem('buyNowAction') === 'true';

    // Nếu là hành động "Mua ngay", thiết lập trạng thái mua ngay và lấy thông tin sản phẩm từ sessionStorage, đồng thời xóa dữ liệu này sau khi sử dụng để tránh ảnh hưởng đến các lần truy cập sau
    if (isBuyNow || isBuyNowAction) {
      setIsBuyNow(true);
      // Xóa dữ liệu "Mua ngay" sau khi đã sử dụng để đảm bảo không ảnh hưởng đến các lần truy cập sau
      sessionStorage.removeItem('buyNowAction');

      // Khởi tạo giỏ hàng để đảm bảo trạng thái nhất quán, dù trong trường hợp mua ngay thường sẽ không sử dụng giỏ hàng nhưng vẫn cần đảm bảo không có dữ liệu cũ nào ảnh hưởng
      initializeCart();

      // Lấy thông tin sản phẩm mua ngay từ sessionStorage để hiển thị trong checkout, đồng thời xử lý lỗi nếu có vấn đề với dữ liệu này
      const buyNowItemStr = sessionStorage.getItem('buyNowItem');
      if (buyNowItemStr) {
        try {
          const item = JSON.parse(buyNowItemStr);
          setBuyNowItem(item);
        } catch (error) {
          console.error('Error parsing buyNowItem:', error);
        }
      }

      return;
    }

    // Khởi tạo giỏ hàng để đảm bảo không có dữ liệu cũ nào ảnh hưởng nếu người dùng truy cập trực tiếp vào trang checkout mà không qua các bước hợp lệ
    initializeCart();

    // Kiểm tra nếu giỏ hàng trống cả ở localStorage và Zustand store, đồng thời không phải đang thanh toán lại đơn hàng hoặc mua ngay, thì chuyển
    // Chỉ chuyển hướng nếu cả hai đều trống để tránh trường hợp dữ liệu chưa kịp cập nhật từ localStorage lên Zustand store
    const cartItemsStore = localStorage.getItem('cartItems');
    if ((!cartItemsStore || cartItemsStore === '[]') && !repayOrderId && !isBuyNow) {
      navigate(ROUTES.SHOP);
      addNotification({
        type: 'info',
        message: t('checkout.emptyCart.redirectMessage'),
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Kiểm tra giỏ hàng và redirect chỉ khi mount, initializeCart là stable ref
  }, [addNotification, navigate, t]);

  const { mutateAsync: createOrder } = useCreateOrderMutation();
  const { mutateAsync: createMomoUrl } = useCreateMomoUrlMutation();
  const { mutateAsync: createVNPayUrl } = useCreateVNPayUrlMutation();

  // Lấy số lượng giỏ hàng từ server để đảm bảo đồng bộ và tránh trường hợp người dùng có thể truy cập trang checkout với giỏ hàng trống do dữ liệu cũ chưa được xóa hoặc truy cập sai cách
  const { data: serverCartCount } = useGetCartCountQuery();

  // Địa chỉ đã lưu để tự động điền vào form khi người dùng chọn
  const { data: savedAddresses } = useGetAddressesQuery({
    enabled: !!user,
  });
  // Các phương thức thanh toán được hỗ trợ, có thể dễ dàng mở rộng hoặc chỉnh sửa sau này, đồng thời sử dụng i18n để hỗ trợ đa ngôn ngữ
  const paymentMethods = [
    { value: 'cod', label: t('checkout.paymentMethod.cod') },
    { value: 'vnpay', label: t('checkout.paymentMethod.vnpay') },
    { value: 'momo', label: t('checkout.paymentMethod.momo') },
    { value: 'installment', label: t('checkout.paymentMethod.installment') },
  ];

  // Trạng thái form và lỗi validation, có thể dễ dàng mở rộng hoặc chỉnh sửa sau này để thêm các trường mới hoặc thay đổi logic validation
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '', // Sử dụng số điện thoại của người dùng nếu có để tiết kiệm thời gian nhập liệu, đồng thời vẫn cho phép chỉnh sửa nếu cần
    addressDetail: '', // Sử dụng trường này để người dùng nhập phần chi tiết địa chỉ, sau đó sẽ kết hợp với các trường khác để tạo thành địa chỉ đầy đủ, giúp tăng tính linh hoạt và dễ dàng tích hợp với các API định vị nếu cần
    ward: '',
    district: '', // Lưu tên quận/huyện để có thể hiển thị riêng biệt và dễ dàng tích hợp với các API định vị hoặc bản đồ nếu cần, đồng thời giúp người dùng dễ dàng chọn lựa khi nhập địa chỉ
    province: '', // Lưu tên tỉnh/thành phố để có thể hiển thị riêng biệt và dễ dàng tích hợp với các API định vị hoặc bản đồ nếu cần, đồng thời giúp người dùng dễ dàng chọn lựa khi nhập địa chỉ
    address: '', // = addressDetail + ward
    city: '', // = district
    state: '', // = province
    zipCode: '',
    country: 'VN',
    shippingMethod: 'standard',
    paymentMethod: 'cod', // Mặc định thanh toán khi nhận hàng
    notes: '',
    // Địa chỉ thanh toán (mặc định giống địa chỉ giao hàng)
    billingFirstName: user?.firstName || '',
    billingLastName: user?.lastName || '',
    billingAddress: '',
    billingCity: '',
    billingState: '',
    billingZipCode: '',
    billingCountry: 'VN',
    billingPhone: user?.phone || '', // Sử dụng số điện thoại của người dùng nếu có
    sameAsShipping: true,
    lat: null as number | string | null,
    lon: null as number | string | null,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stepDirection, setStepDirection] = useState(1);

  const wizardSteps = [
    { key: 'shipping', labelKey: 'checkout.step.shipping' },
    { key: 'payment', labelKey: 'checkout.step.payment' },
    { key: 'confirm', labelKey: 'checkout.step.confirm' },
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stepSlide: any = {
    enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
    center: { x: 0, opacity: 1, transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] } },
    exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0, transition: { duration: 0.2 } }),
  };

  const goNext = () => {
    if (currentStep === 0 && !isRepayingOrder) {
      const missing = ['firstName', 'lastName', 'email', 'phone'].filter(
        (f) => !formData[f as keyof typeof formData],
      );
      if (missing.length > 0) {
        const newErrors: Record<string, string> = {};
        missing.forEach((f) => {
          newErrors[f] = t('checkout.validation.required');
        });
        setErrors(newErrors);
        return;
      }
    }
    if (currentStep === 1 && !formData.paymentMethod) {
      addNotification({ type: 'warning', message: t('checkout.validation.paymentRequired') });
      return;
    }
    setStepDirection(1);
    setCurrentStep((s) => Math.min(s + 1, wizardSteps.length - 1));
  };
  const goBack = () => {
    setStepDirection(-1);
    setCurrentStep((s) => Math.max(s - 1, 0));
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);

  // Đã xóa hook lấy danh sách tỉnh/thành

  // Trạng thái mã giảm giá
  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number } | null>(
    null,
  );
  const [discountError, setDiscountError] = useState('');
  const { mutateAsync: applyDiscountCode, isPending: isValidatingCode } =
    useApplyDiscountCodeMutation();
  const { data: availableCodes = [] } = useGetAvailableDiscountCodesQuery();

  useEffect(() => {
    const state = location.state as { voucherCode?: string; discountAmount?: number } | null;
    if (state?.voucherCode && !appliedDiscount) {
      setDiscountCodeInput(state.voucherCode);
      setAppliedDiscount({ code: state.voucherCode, amount: state.discountAmount ?? 0 });
      navigate(location.pathname + location.search, { replace: true, state: undefined });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Chỉ apply voucher từ navigation state khi state thay đổi, appliedDiscount/navigate/location dùng qua closure
  }, [location.state]);

  // Mở modal khi chọn thanh toán trả góp
  useEffect(() => {
    if (formData.paymentMethod === 'installment') {
      setIsInstallmentModalOpen(true);
    }
  }, [formData.paymentMethod]);

  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

  // Tính phí vận chuyển theo khoảng cách, nhưng miễn phí nếu subtotal >= ngưỡng (đồng bộ backend)
  let shippingCost = 0;
  let finalDistance = 0;

  if (subtotal < SHIPPING.FREE_THRESHOLD && formData.address) {
    const lat = formData.lat;
    const lon = formData.lon;

    if (lat && lon) {
      // Hàm tính khoảng cách giữa 2 điểm dựa trên tọa độ địa lý (Haversine formula)
      const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const deg2rad = (deg: number) => deg * (Math.PI / 180);
        const R = 6371;
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1);
        const a =
          Math.sin(dLat / 2) * Math.sin(dLat / 2) +
          Math.cos(deg2rad(lat1)) *
            Math.cos(deg2rad(lat2)) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
      };

      const calculateShippingFee = (distanceInKm: number) => {
        if (distanceInKm <= 3) return 15000;
        const fee = 15000 + Math.ceil(distanceInKm - 3) * 5000;
        return Math.min(fee, SHIPPING.MAX_FEE);
      };

      // Tọa độ gốc của hàng: 144 Đ. Xuân Thủy, Cầu Giấy, HN (21.0378, 105.7827)
      finalDistance = calculateDistance(21.0378, 105.7827, Number(lat), Number(lon));
      shippingCost = calculateShippingFee(finalDistance);
    }
  }

  const tax = 0; // Thuế 0% - không áp dụng thuế theo yêu cầu
  const discountAmount = appliedDiscount ? appliedDiscount.amount : 0;

  const total = subtotal + shippingCost + tax - discountAmount;

  // Xử lý thay đổi input trong form
  const handleInputChange = (name: string, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      // Tự động điền city/state từ address cho backend validation
      if (name === 'address') {
        const parts = value
          .split(',')
          .map((p) => p.trim())
          .filter(Boolean);
        // Fallback: dùng phần cuối nếu không đủ parts, tránh gửi chuỗi rỗng gây 400
        const fallback = parts.length > 0 ? parts[parts.length - 1] : value.trim();
        updated.state = parts.length > 2 ? parts[parts.length - 2] : fallback;
        updated.city = parts.length > 3 ? parts[parts.length - 3] : fallback;
      }

      // Tự động điền địa chỉ thanh toán nếu giống địa chỉ giao hàng
      if (updated.sameAsShipping && name.startsWith('shipping')) {
        const billingField = name.replace('shipping', 'billing');
        updated[billingField as keyof typeof updated] = value as never;
      }

      return updated;
    });

    // Xóa lỗi khi người dùng bắt đầu nhập
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  // Đã xóa các handler tỉnh/thành cũ

  const handleAddressChange = (
    val: string,
    lat?: string | number,
    lon?: string | number,
    detail?: { city?: string; state?: string; country?: string },
  ) => {
    setFormData((prev) => {
      const updated = { ...prev, address: val };
      const parts = val
        .split(',')
        .map((p) => p.trim())
        .filter(Boolean);
      const fallback = parts.length > 0 ? parts[parts.length - 1] : val.trim();
      updated.state = parts.length > 2 ? parts[parts.length - 2] : fallback;
      updated.city = parts.length > 3 ? parts[parts.length - 3] : fallback;

      if (lat && lon) {
        updated.lat = lat;
        updated.lon = lon;
      }
      if (detail?.city) updated.city = detail.city;
      if (detail?.state) updated.state = detail.state;
      if (detail?.country) updated.country = detail.country;

      if (updated.sameAsShipping) {
        updated.billingCity = updated.city;
        updated.billingState = updated.state;
        updated.billingCountry = updated.country;
      }

      return updated;
    });
    if (errors.address) {
      setErrors((prev) => ({ ...prev, address: '' }));
    }
  };

  // Xử lý checkbox "giống địa chỉ giao hàng"
  const _handleSameAsShipping = (checked: boolean) => {
    setFormData((prev) => ({
      ...prev,
      sameAsShipping: checked,
      ...(checked && {
        billingFirstName: prev.firstName,
        billingLastName: prev.lastName,
        billingAddress: prev.address,
        billingCity: prev.city,
        billingState: prev.state,
        billingZipCode: prev.zipCode,
        billingCountry: prev.country,
        billingPhone: prev.phone,
      }),
    }));
  };

  // Validate form đầu vào
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Các trường bắt buộc
    const requiredFields = ['firstName', 'lastName', 'email', 'phone'];

    requiredFields.forEach((field) => {
      if (!formData[field as keyof typeof formData]) {
        newErrors[field] = t('checkout.validation.required');
      }
    });

    // Validate địa chỉ đầy đủ — cần tỉnh + quận + số nhà (address phải có ít nhất 2 dấu phẩy)
    const addressParts = (formData.address || '')
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);
    if (!formData.address || addressParts.length < 3) {
      newErrors.address = t('checkout.validation.addressRequired');
    }
    if (!formData.city) newErrors.city = t('checkout.validation.required');
    if (!formData.state) newErrors.state = t('checkout.validation.required');

    // Kiểm tra định dạng email
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('checkout.validation.emailInvalid');
    }

    const phoneDigits = formData.phone?.trim().replace(/[\s.-]/g, '') || '';
    if (phoneDigits && !/^(0|\+84)[0-9]{9}$/.test(phoneDigits)) {
      newErrors.phone = t('checkout.validation.phoneInvalid');
    }

    // Kiểm tra địa chỉ thanh toán nếu khác địa chỉ giao hàng
    if (!formData.sameAsShipping) {
      const billingFields = [
        'billingFirstName',
        'billingLastName',
        'billingAddress',
        'billingCity',
        'billingState',
        'billingZipCode',
        'billingCountry',
      ];

      billingFields.forEach((field) => {
        if (!formData[field as keyof typeof formData]) {
          newErrors[field] = t('checkout.validation.required');
        }
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Xử lý áp dụng mã giảm giá
  const handleApplyDiscount = async () => {
    if (!discountCodeInput.trim()) {
      setDiscountError(t('checkout.discountCode.required'));
      return;
    }

    try {
      const res = await applyDiscountCode({
        code: discountCodeInput,
        orderAmount: subtotal,
      });

      setAppliedDiscount({
        code: res.data.code,
        amount: res.data.discountAmount,
      });
      setDiscountError('');
      addNotification({
        type: 'success',
        message: t('checkout.discountCode.success'),
      });
    } catch (error) {
      setDiscountError(getErrorMsg(error, t('checkout.discountCode.invalid')));
    }
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCodeInput('');
    setDiscountError('');
  };

  // Tạo đơn hàng
  const handleCreateOrder = async () => {
    if (!validateForm()) {
      const firstError = document.querySelector('[aria-invalid="true"]');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return null;
    }

    setIsProcessing(true); // Bật trạng thái loading

    try {
      const orderData = {
        shippingFirstName: formData.firstName,
        shippingLastName: formData.lastName,
        shippingAddress1: formData.address,
        shippingCity: formData.city,
        shippingState: formData.state,
        shippingZip: formData.zipCode,
        shippingCountry: formData.country,
        shippingPhone: formData.phone,
        billingFirstName: formData.sameAsShipping ? formData.firstName : formData.billingFirstName,
        billingLastName: formData.sameAsShipping ? formData.lastName : formData.billingLastName,
        billingAddress1: formData.sameAsShipping ? formData.address : formData.billingAddress,
        billingCity: formData.sameAsShipping ? formData.city : formData.billingCity,
        billingState: formData.sameAsShipping ? formData.state : formData.billingState,
        billingZip: formData.sameAsShipping ? formData.zipCode : formData.billingZipCode,
        billingCountry: formData.sameAsShipping ? formData.country : formData.billingCountry,
        billingPhone: formData.sameAsShipping ? formData.phone : formData.billingPhone,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes,
        discountCode: appliedDiscount ? appliedDiscount.code : undefined,
        shippingCost, // Phí ship tính theo khoảng cách km từ kho hàng
        items:
          isBuyNow && buyNowItem
            ? [
                {
                  productId: buyNowItem.productId,
                  variantId: buyNowItem.variantId,
                  quantity: buyNowItem.quantity,
                },
              ]
            : undefined,
      };

      const response = await createOrder(orderData);
      return response.data.order;
    } catch (error) {
      console.error('Tạo đơn hàng thất bại:', error);
      addNotification({
        type: 'error',
        message: t('checkout.errors.orderCreationFailed'),
        duration: 5000,
      });
      return null;
    } finally {
      setIsProcessing(false); // Tắt trạng thái loading
    }
  };

  // Xử lý thanh toán thành công
  const _handlePaymentSuccess = async (_paymentIntent: unknown) => {
    addNotification({
      type: 'success',
      message: t('checkout.success.message'),
      duration: 5000,
    });

    // Xóa giỏ hàng
    clearLocalCart();

    // Làm mới số lượng giỏ hàng để cập nhật badge trên header
    queryClient.invalidateQueries({ queryKey: cartKeys.count });

    // Chuyển hướng đến trang đơn hàng (replace để Back không quay lại checkout)
    navigate(ROUTES.ORDERS, { replace: true });
  };

  // Xử lý lỗi thanh toán
  const _handlePaymentError = (error: string) => {
    addNotification({
      type: 'error',
      message: error,
      duration: 5000,
    });
  };

  // Xử lý trạng thái đang thanh toán
  const _handlePaymentProcessing = (processing: boolean) => {
    setIsProcessing(processing);
  };

  // Xử lý submit form cho tất cả các phương thức thanh toán
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.paymentMethod === 'bank_transfer') {
      // Với chuyển khoản ngân hàng, tạo đơn hàng và chuyển hướng đến trang thanh toán QR
      const order = await handleCreateOrder();
      if (order) {
        clearLocalCart();
        queryClient.invalidateQueries({ queryKey: cartKeys.count });

        // Chuyển hướng đến trang thanh toán QR kèm thông tin đơn hàng
        navigate(
          `/payment-qr?orderId=${order.id}&amount=${order.total}&numberOrder=${order.number}`,
        );
        return;
      }
    }

    if (formData.paymentMethod === 'vnpay') {
      let order = currentOrder;

      // Nếu chưa có order (thanh toán mới), tạo order mới
      if (!order) {
        order = await handleCreateOrder();
      }

      if (order) {
        try {
          const res = await createVNPayUrl({
            orderId: order.id,
          });

          if (res.data?.paymentUrl) {
            window.location.href = res.data.paymentUrl;
            return;
          }
        } catch (error) {
          console.error('Tạo URL thanh toán VNPay thất bại', error);
          addNotification({
            type: 'error',
            message: t('checkout.errors.vnpayFailed'),
            duration: 5000,
          });
        }
      }
      return;
    }

    if (formData.paymentMethod === 'momo') {
      let order = currentOrder;

      // Nếu chưa có order (thanh toán mới), tạo order mới
      if (!order) {
        order = await handleCreateOrder();
      }

      if (order) {
        try {
          const res = await createMomoUrl({
            orderId: order.id,
          });

          if (res.data?.payUrl) {
            window.location.href = res.data.payUrl;
            return;
          }
        } catch (error) {
          console.error('Tạo URL thanh toán MoMo thất bại', error);
          addNotification({
            type: 'error',
            message: t('checkout.errors.momoFailed'),
            duration: 5000,
          });
        }
      }
      return;
    }

    // Với các phương thức thanh toán khác, tạo đơn hàng và chuyển hướng
    const order = await handleCreateOrder();
    if (order) {
      addNotification({
        type: 'success',
        message: t('checkout.success.message'),
        duration: 5000,
      });
      clearLocalCart();
      sessionStorage.removeItem('buyNowItem');
      sessionStorage.removeItem('buyNowAction');

      // Làm mới số lượng giỏ hàng để cập nhật badge trên header
      queryClient.invalidateQueries({ queryKey: cartKeys.count });

      navigate(ROUTES.ORDERS, { replace: true });
    }
  };

  // Trạng thái loading cho giỏ hàng
  const [isCartLoading, setIsCartLoading] = useState(true);

  // Kiểm tra giỏ hàng sau khi đã khởi tạo
  useEffect(() => {
    // Kiểm tra xem URL có chứa tham số
    const searchParams = new URLSearchParams(window.location.search);
    const isBuyNow = searchParams.get('buyNow') === 'true';
    const repayOrderId = searchParams.get('repayOrder') || searchParams.get('orderId');

    // Kiểm tra xem người dùng vừa thực hiện hành động "Mua ngay" hay không
    const isBuyNowAction = sessionStorage.getItem('buyNowAction') === 'true';

    // Đặt một timeout dài hơn để đảm bảo giỏ hàng đã được khởi tạo và API đã cập nhật
    const timer = setTimeout(() => {
      setIsCartLoading(false);

      // Nếu người dùng vừa thực hiện hành động "Mua ngay" hoặc đang thanh toán lại đơn hàng, không chuyển hướng
      if (isBuyNow || isBuyNowAction || repayOrderId) {
        setIsBuyNow(true);
        // Xóa cờ sau khi đã sử dụng
        sessionStorage.removeItem('buyNowAction');

        // Lấy thông tin sản phẩm mua ngay từ sessionStorage
        const buyNowItemStr = sessionStorage.getItem('buyNowItem');
        if (buyNowItemStr) {
          try {
            const item = JSON.parse(buyNowItemStr);
            setBuyNowItem(item);
          } catch (error) {
            console.error('Error parsing buyNowItem:', error);
          }
        }

        return;
      }

      // Kiểm tra cả serverCartCount và items trong Zustand store
      // Chỉ chuyển hướng nếu cả hai đều trống và không phải đang thanh toán lại đơn hàng
      if (serverCartCount === 0 && (!items || items.length === 0) && !repayOrderId) {
        // Xóa dữ liệu giỏ hàng trong localStorage để đảm bảo không có dữ liệu cũ
        localStorage.removeItem('cartItems');

        // Cập nhật state Zustand
        initializeCart();

        // Chuyển hướng về trang shop
        navigate(ROUTES.SHOP);
        addNotification({
          type: 'info',
          message: t('checkout.emptyCart.redirectMessage'),
        });
      }
    }, 800); // Tăng thời gian chờ để đảm bảo API có đủ thời gian cập nhật

    return () => clearTimeout(timer);
  }, [items, serverCartCount, navigate, initializeCart, addNotification, t]);

  // Hiển thị loading trong khi kiểm tra giỏ hàng
  if (isCartLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
        <p className="text-neutral-600 dark:text-neutral-400">{t('common.loading')}</p>
      </div>
    );
  }

  // Không cần kiểm tra giỏ hàng trống ở đây nữa vì đã chuyển hướng trong useEffect

  // Kiểm tra xem có phải đang thanh toán lại đơn hàng không
  const isRepayingOrder = currentOrder && currentOrder.isRepay;

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="container mx-auto px-4 py-6 pb-24 lg:pb-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-neutral-800 dark:text-neutral-100">
            {isRepayingOrder ? t('checkout.repayTitle') : t('checkout.title')}
          </h1>
          <div className="hidden sm:flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
            <svg
              className="w-4 h-4 text-green-500"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
            {t('checkout.secureCheckout')}
          </div>
        </div>

        {!isRepayingOrder && (
          <CheckoutStepIndicator currentStep={currentStep} steps={wizardSteps} />
        )}

        <div className={`grid grid-cols-1 ${currentStep !== 2 ? 'lg:grid-cols-2' : ''} gap-8`}>
          {/* Cột trái - Wizard steps */}
          <div className="min-h-[400px]">
            <AnimatePresence mode="wait" custom={stepDirection}>
              {currentStep === 0 && !isRepayingOrder && (
                <motion.div
                  key="step-shipping"
                  custom={stepDirection}
                  variants={stepSlide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-8"
                >
                  <CheckoutShippingForm
                    formData={formData}
                    errors={errors}
                    savedAddresses={savedAddresses}
                    onInputChange={handleInputChange}
                    onAddressChange={handleAddressChange}
                  />
                  <div className="flex justify-end">
                    <PremiumButton variant="primary" size="large" onClick={goNext}>
                      {t('checkout.step.next')}
                    </PremiumButton>
                  </div>
                </motion.div>
              )}

              {(currentStep === 1 || isRepayingOrder) && (
                <motion.div
                  key="step-payment"
                  custom={stepDirection}
                  variants={stepSlide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  className="space-y-8"
                >
                  <CheckoutPaymentMethod
                    paymentMethods={paymentMethods}
                    selectedMethod={formData.paymentMethod}
                    onMethodChange={(value) => handleInputChange('paymentMethod', value)}
                    isInstallmentModalOpen={isInstallmentModalOpen}
                    onCloseInstallmentModal={() => setIsInstallmentModalOpen(false)}
                  />

                  <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
                    <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100 mb-4">
                      {t('checkout.orderNotes.title')}
                    </h2>
                    <textarea
                      value={formData.notes}
                      onChange={(e) => handleInputChange('notes', e.target.value)}
                      placeholder={t('checkout.orderNotes.placeholder')}
                      className="w-full p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100"
                      rows={3}
                    />
                  </div>

                  <div className="flex justify-between">
                    {!isRepayingOrder && (
                      <PremiumButton variant="outline" size="large" onClick={goBack}>
                        {t('checkout.step.back')}
                      </PremiumButton>
                    )}
                    <PremiumButton
                      variant="primary"
                      size="large"
                      onClick={goNext}
                      className="ml-auto"
                    >
                      {t('checkout.step.next')}
                    </PremiumButton>
                  </div>
                </motion.div>
              )}

              {currentStep === 2 && (
                <motion.div
                  key="step-confirm"
                  custom={stepDirection}
                  variants={stepSlide}
                  initial="enter"
                  animate="center"
                  exit="exit"
                >
                  <CheckoutOrderSummary
                    items={items}
                    isRepayingOrder={isRepayingOrder}
                    currentOrder={currentOrder}
                    subtotal={subtotal}
                    shippingCost={shippingCost}
                    finalDistance={finalDistance}
                    tax={tax}
                    total={total}
                    appliedDiscount={appliedDiscount}
                    discountCodeInput={discountCodeInput}
                    onDiscountCodeChange={setDiscountCodeInput}
                    discountError={discountError}
                    isValidatingCode={isValidatingCode}
                    availableCodes={availableCodes}
                    onApplyDiscount={handleApplyDiscount}
                    onRemoveDiscount={handleRemoveDiscount}
                    onSelectDiscountCode={(code) => {
                      setDiscountCodeInput(code);
                      setDiscountError('');
                    }}
                    paymentMethod={formData.paymentMethod}
                    isProcessing={isProcessing}
                    onSubmit={() => handleSubmit({ preventDefault: () => {} } as React.FormEvent)}
                  />

                  <div className="flex justify-between mt-6">
                    <PremiumButton variant="outline" size="large" onClick={goBack}>
                      {t('checkout.step.back')}
                    </PremiumButton>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Cột phải - Order summary (ẩn ở step confirm vì đã là nội dung chính) */}
          {currentStep !== 2 && (
            <div className="hidden lg:block sticky top-20">
              <CheckoutOrderSummary
                items={items}
                isRepayingOrder={isRepayingOrder}
                currentOrder={currentOrder}
                subtotal={subtotal}
                shippingCost={shippingCost}
                finalDistance={finalDistance}
                tax={tax}
                total={total}
                appliedDiscount={appliedDiscount}
                discountCodeInput={discountCodeInput}
                onDiscountCodeChange={setDiscountCodeInput}
                discountError={discountError}
                isValidatingCode={isValidatingCode}
                availableCodes={availableCodes}
                onApplyDiscount={handleApplyDiscount}
                onRemoveDiscount={handleRemoveDiscount}
                onSelectDiscountCode={(code) => {
                  setDiscountCodeInput(code);
                  setDiscountError('');
                }}
                paymentMethod={formData.paymentMethod}
                isProcessing={false}
                onSubmit={goNext}
                hideSubmitButton
              />
            </div>
          )}
        </div>

        {/* Sticky mobile CTA — chỉ hiện trên mobile khi chưa ở step confirm */}
        {currentStep < 2 && (
          <div
            className="fixed bottom-0 left-0 right-0 lg:hidden bg-white dark:bg-neutral-800 border-t border-neutral-200 dark:border-neutral-700 p-4 z-40 shadow-[0_-4px_20px_rgba(0,0,0,0.1)]"
            aria-hidden="true"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="text-sm">
                <span className="text-neutral-500 dark:text-neutral-400">{t('common.total')}:</span>
                <span className="ml-2 text-lg font-bold text-neutral-900 dark:text-white">
                  {total.toLocaleString('vi-VN', { maximumFractionDigits: 0 })}
                  {t('common.currencySymbol')}
                </span>
              </div>
              <PremiumButton
                variant="primary"
                size="middle"
                onClick={goNext}
                className="shrink-0"
                tabIndex={-1}
              >
                {t('checkout.buttons.continueToPayment')}
              </PremiumButton>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckoutPage;
