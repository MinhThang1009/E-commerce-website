import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';
import {
  ArrowRightOutlined,
  CheckCircleOutlined,
  LoadingOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { Button, Modal, Table } from 'antd';

import CustomButton from '@/components/common/Button';
import PremiumButton from '@/components/common/PremiumButton';
import Input from '@/components/common/Input';
import Select from '@/components/common/Select';
import AddressPicker from '@/components/common/AddressPicker';
import CartItem from '@/components/shared/CartItem';
import StripePaymentForm from '@/components/payment/StripePaymentForm';
import BankTransferQR from '@/components/payment/BankTransferQR';
import { RootState } from '@/store';
import { clearCart, initializeCart, addItem } from '@/features/cart/cartSlice';
import { addNotification } from '@/features/ui/uiSlice';
import { formatPrice } from '@/utils/format';
import { useCreateOrderMutation, useApplyDiscountCodeMutation } from '@/services/orderApi';
import { cartApi, useGetCartCountQuery } from '@/services/cartApi';
import { useCreateMomoUrlMutation } from '@/services/momoApi';
import { useCreateVNPayUrlMutation } from '@/services/vnpayApi';
import { useGetLoyaltyInfoQuery } from '@/services/loyaltyApi';

const CheckoutPage: React.FC = () => {
  const { t, i18n } = useTranslation();
  const { items: cartItems } = useSelector((state: RootState) => state.cart);
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const [isBuyNow, setIsBuyNow] = useState(() => {
    const searchParams = new URLSearchParams(window.location.search);
    return searchParams.get('buyNow') === 'true' || sessionStorage.getItem('buyNowAction') === 'true';
  });
  const [buyNowItem, setBuyNowItem] = useState<any>(() => {
    const itemStr = sessionStorage.getItem('buyNowItem');
    const searchParams = new URLSearchParams(window.location.search);
    const isBuyNowFlow = searchParams.get('buyNow') === 'true' || sessionStorage.getItem('buyNowAction') === 'true';
    return isBuyNowFlow && itemStr ? JSON.parse(itemStr) : null;
  });

  // Th?ng nh?t danh sách items hi?n th?
  const items = isBuyNow && buyNowItem ? [buyNowItem] : cartItems;

  // Ð?m b?o gi? hàng du?c kh?i t?o khi trang du?c t?i
  useEffect(() => {
    // Ki?m tra xem URL có ch?a tham s?
    const searchParams = new URLSearchParams(window.location.search);
    const isBuyNow = searchParams.get('buyNow') === 'true';

    // Ki?m tra c? hai lo?i URL (cu và m?i)
    const repayOrderId =
      searchParams.get('repayOrder') || searchParams.get('orderId');
    const repayAmount = searchParams.get('amount');

    // Ki?m tra xem URL có ph?i là URL cu không (/checkout/payment)
    const isOldPaymentUrl =
      window.location.pathname.includes('/checkout/payment');

    // N?u là URL cu, chuy?n hu?ng d?n URL m?i
    if (isOldPaymentUrl && repayOrderId && repayAmount) {
      navigate(`/checkout?repayOrder=${repayOrderId}&amount=${repayAmount}`, {
        replace: true,
      });
      return;
    }

    // Ki?m tra xem ngu?i dùng dang thanh toán l?i don hàng hay không
    if (repayOrderId && repayAmount) {
      // Ð?t thông tin don hàng hi?n t?i d? thanh toán
      setCurrentOrder({
        id: repayOrderId,
        total: parseFloat(repayAmount),
        isRepay: true,
      });

      // V?i don hàng thanh toán l?i, m?c d?nh dùng stripe
      // Sau này có th? d?t theo phuong th?c thanh toán g?c c?a don hàng
      setFormData((prev) => ({
        ...prev,
        paymentMethod: 'stripe',
      }));

      return;
    }

    // Ki?m tra xem ngu?i dùng v?a th?c hi?n hành d?ng "Mua ngay" hay không
    const isBuyNowAction = sessionStorage.getItem('buyNowAction') === 'true';

    // N?u ngu?i dùng v?a th?c hi?n hành d?ng "Mua ngay", không chuy?n hu?ng
    if (isBuyNow || isBuyNowAction) {
      setIsBuyNow(true);
      // Xóa c? sau khi dã s? d?ng
      sessionStorage.removeItem('buyNowAction');

      // Ð?m b?o gi? hàng du?c kh?i t?o
      dispatch(initializeCart());

      // L?y thông tin s?n ph?m mua ngay t? sessionStorage
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

    // Kh?i t?o gi? hàng
    dispatch(initializeCart());

    // Ki?m tra localStorage tr?c ti?p d? d?m b?o không có d? li?u gi? hàng cu
    // Ch? chuy?n hu?ng n?u không ph?i dang thanh toán l?i don hàng
    const cartItemsStore = localStorage.getItem('cartItems');
    if ((!cartItemsStore || cartItemsStore === '[]') && !repayOrderId && !isBuyNow) {
      navigate('/shop');
      dispatch(
        addNotification({
          type: 'info',
          message: t('checkout.emptyCart.redirectMessage'),
        })
      );
    }
  }, [dispatch, navigate, t]);

  const [createOrder] = useCreateOrderMutation();
  const [createMomoUrl] = useCreateMomoUrlMutation();
  const [createVNPayUrl] = useCreateVNPayUrlMutation();

  // L?y s? lu?ng gi? hàng t? server
  const { data: serverCartCount } = useGetCartCountQuery();

  // D? li?u di?m tích luy
  const { data: loyaltyData } = useGetLoyaltyInfoQuery(undefined, {
    skip: !user,
  });
  const availablePoints = loyaltyData?.data?.points || 0;
  const [pointsToUse, setPointsToUse] = useState<number>(0);
  const [pointsError, setPointsError] = useState('');

  // Các phuong th?c thanh toán
  const paymentMethods = [
    { value: 'cod', label: t('checkout.paymentMethod.cod') },
    { value: 'vnpay', label: t('checkout.paymentMethod.vnpay') },
    { value: 'momo', label: t('checkout.paymentMethod.momo') },
    { value: 'installment', label: t('checkout.paymentMethod.installment') },
  ];

  // Các phuong th?c v?n chuy?n
  const shippingMethods = [
    {
      value: 'standard',
      label: t('checkout.shippingMethod.standard'),
      price: 30000,
    },
    {
      value: 'express',
      label: t('checkout.shippingMethod.express'),
      price: 50000,
    },
    {
      value: 'free',
      label: t('checkout.shippingMethod.free'),
      price: 0,
    },
  ];

  // Tr?ng thái form
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '', // S? d?ng s? di?n tho?i c?a ngu?i dùng n?u có
    addressDetail: '', // S? nhà, tên du?ng
    ward: '',
    district: '', // Luu tên qu?n/huy?n
    province: '', // Luu tên t?nh/thành
    address: '', // = addressDetail + ward
    city: '', // = district
    state: '', // = province
    zipCode: '',
    country: 'VN',
    shippingMethod: 'standard',
    paymentMethod: 'cod', // M?c d?nh thanh toán khi nh?n hàng
    notes: '',
    // Ð?a ch? thanh toán (m?c d?nh gi?ng d?a ch? giao hàng)
    billingFirstName: user?.firstName || '',
    billingLastName: user?.lastName || '',
    billingAddress: '',
    billingCity: '',
    billingState: '',
    billingZipCode: '',
    billingCountry: 'VN',
    billingPhone: user?.phone || '', // S? d?ng s? di?n tho?i c?a ngu?i dùng n?u có
    sameAsShipping: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);

  // Ðã xóa hook l?y danh sách t?nh/thành

  // Tr?ng thái mã gi?m giá
  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number } | null>(null);
  const [discountError, setDiscountError] = useState('');
  const [applyDiscountCode, { isLoading: isValidatingCode }] = useApplyDiscountCodeMutation();

  // C?t b?ng tr? góp
  const installmentColumns = [
    {
      title: t('checkout.installment.bankColumn'),
      dataIndex: 'bank',
      key: 'bank',
      render: (text: string) => <span className="font-medium">{text}</span>,
    },
    {
      title: t('checkout.installment.termsColumn'),
      dataIndex: 'terms',
      key: 'terms',
    },
    {
      title: t('checkout.installment.feeColumn'),
      dataIndex: 'fee',
      key: 'fee',
      render: () => <span className="text-green-600 font-medium">{t('checkout.installment.freeLabel')}</span>,
    },
  ];

  const mo = t('checkout.installment.monthsUnit');
  const installmentData = [
    { key: '1', bank: 'Techcombank', terms: `3, 6, 9, 12 ${mo}`, fee: '0%' },
    { key: '2', bank: 'VPBank', terms: `3, 6, 9, 12 ${mo}`, fee: '0%' },
    { key: '3', bank: 'Sacombank', terms: `6, 12 ${mo}`, fee: '0%' },
    { key: '4', bank: 'VIB', terms: `3, 6, 9, 12 ${mo}`, fee: '0%' },
    { key: '5', bank: 'HSBC', terms: `3, 6, 9, 12 ${mo}`, fee: '0%' },
    { key: '6', bank: 'TPBank', terms: `3, 6, 9, 12 ${mo}`, fee: '0%' },
  ];

  // M? modal khi ch?n thanh toán tr? góp
  useEffect(() => {
    if (formData.paymentMethod === 'installment') {
      setIsInstallmentModalOpen(true);
    }
  }, [formData.paymentMethod]);

  // Danh sách qu?c gia
  const countries = [
    { value: 'VN', label: t('checkout.countries.VN') },
    { value: 'US', label: t('checkout.countries.US') },
    { value: 'CA', label: t('checkout.countries.CA') },
    { value: 'UK', label: t('checkout.countries.UK') },
    { value: 'AU', label: t('checkout.countries.AU') },
    { value: 'DE', label: t('checkout.countries.DE') },
    { value: 'FR', label: t('checkout.countries.FR') },
  ];

  const subtotal = items.reduce(
    (sum, item) => sum + item.price * item.quantity,
    0
  );

  // Tính t?ng phí b?o hành
  const warrantyTotal = items.reduce((sum: number, item: any) => {
    const itemWarrantyPrice = item.warrantyPackages?.reduce((wSum: number, pkg: any) => wSum + pkg.price, 0) || 0;
    return sum + (itemWarrantyPrice * item.quantity);
  }, 0);

  // Tính phí v?n chuy?n t? d?ng theo kho?ng cách tuy?n tính s? d?ng API LocationIQ
  let shippingCost = 0;
  let finalDistance = 0;

  if (formData.address) {
    const lat = (formData as any).lat;
    const lon = (formData as any).lon;
    
    if (lat && lon) {
      const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
        const deg2rad = (deg: number) => deg * (Math.PI / 180);
        const R = 6371; 
        const dLat = deg2rad(lat2 - lat1);
        const dLon = deg2rad(lon2 - lon1); 
        const a = 
          Math.sin(dLat/2) * Math.sin(dLat/2) +
          Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * 
          Math.sin(dLon/2) * Math.sin(dLon/2); 
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
        return R * c;
      };

      const calculateShippingFee = (distanceInKm: number) => {
        if (distanceInKm <= 3) return 15000; // 3km d?u tiên d?ng giá 15k
        const fee = 15000 + Math.ceil(distanceInKm - 3) * 5000; // km th? 4 tr? di c?ng thêm 5k/km
        return Math.min(fee, 100000); // max 100k
      };

      // T?a d? g?c c?a hàng: 144 Ð. Xuân Th?y, C?u Gi?y, HN (21.0378, 105.7827)
      finalDistance = calculateDistance(21.0378, 105.7827, parseFloat(lat), parseFloat(lon));
      shippingCost = calculateShippingFee(finalDistance);
    }
  }

  const tax = 0; // Thu? 0% - không áp d?ng thu? theo yêu c?u
  const discountAmount = appliedDiscount ? appliedDiscount.amount : 0;
  
  // Tính gi?m giá theo di?m (1 di?m = 1.000 VND)
  const pointsDiscount = pointsToUse * 1000;
  
  const total = subtotal + warrantyTotal + shippingCost + tax - discountAmount - pointsDiscount;

  // X? lý thay d?i input trong form
  const handleInputChange = (name: string, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      // T? d?ng di?n các tru?ng ph? d? vu?t qua validation phía backend
      if (name === 'address') {
        let parts = value.split(',');
        updated.state = parts.length > 2 ? parts[parts.length - 2].trim() : t('checkout.defaultState');
        updated.city = parts.length > 3 ? parts[parts.length - 3].trim() : t('checkout.defaultCity');
      }

      // T? d?ng di?n d?a ch? thanh toán n?u gi?ng d?a ch? giao hàng
      if (updated.sameAsShipping && name.startsWith('shipping')) {
        const billingField = name.replace('shipping', 'billing');
        updated[billingField as keyof typeof updated] = value as never;
      }

      return updated;
    });

    // Xóa l?i khi ngu?i dùng b?t d?u nh?p
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  // Ðã xóa các handler t?nh/thành cu

  // X? lý checkbox "gi?ng d?a ch? giao hàng"
  const handleSameAsShipping = (checked: boolean) => {
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

  // Validate form d?u vào
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Các tru?ng b?t bu?c
    const requiredFields = [
      'firstName',
      'lastName',
      'email',
      'phone',
      'address',
    ];

    requiredFields.forEach((field) => {
      if (!formData[field as keyof typeof formData]) {
        newErrors[field] = t('checkout.validation.required');
      }
    });

    // Ki?m tra d?nh d?ng email
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('checkout.validation.emailInvalid');
    }

    // Ki?m tra d?nh d?ng s? di?n tho?i VN: 0XXXXXXXXX ho?c +84XXXXXXXXX
    if (formData.phone && !/^(0|\+84)[0-9]{9}$/.test(formData.phone.trim())) {
      newErrors.phone = t('checkout.validation.phoneInvalid');
    }

    // Ki?m tra d?a ch? thanh toán n?u khác d?a ch? giao hàng
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

  // X? lý áp d?ng mã gi?m giá
  const handleApplyDiscount = async () => {
    if (!discountCodeInput.trim()) {
      setDiscountError(t('checkout.discountCode.required'));
      return;
    }

    try {
      const res = await applyDiscountCode({
        code: discountCodeInput,
        orderAmount: subtotal,
      }).unwrap();

      setAppliedDiscount({
        code: res.data.code,
        amount: res.data.discountAmount,
      });
      setDiscountError('');
      dispatch(
        addNotification({
          type: 'success',
          message: t('checkout.discountCode.success'),
        })
      );
    } catch (error: any) {
      setDiscountError(error.data?.message || t('checkout.discountCode.invalid'));
    }
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCodeInput('');
    setDiscountError('');
  };

  const handleApplyPoints = (val: number) => {
    if (val < 0) {
      setPointsError(t('checkout.loyaltyPoints.invalidPoints'));
      setPointsToUse(0);
      return;
    }
    if (val > availablePoints) {
      setPointsError(t('checkout.loyaltyPoints.maxExceeded', { max: availablePoints }));
      setPointsToUse(availablePoints);
      return;
    }

    if (val * 1000 > subtotal - discountAmount) {
      const maxPoints = Math.floor((subtotal - discountAmount) / 1000);
      setPointsToUse(maxPoints);
      setPointsError(t('checkout.loyaltyPoints.exceeds'));
      return;
    }

    setPointsToUse(val);
    setPointsError('');
  };

  // T?o don hàng
  const handleCreateOrder = async () => {
    if (!validateForm()) {
      const firstError = document.querySelector('[aria-invalid="true"]');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return null;
    }

    setIsProcessing(true); // B?t tr?ng thái loading

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
        billingFirstName: formData.sameAsShipping
          ? formData.firstName
          : formData.billingFirstName,
        billingLastName: formData.sameAsShipping
          ? formData.lastName
          : formData.billingLastName,
        billingAddress1: formData.sameAsShipping
          ? formData.address
          : formData.billingAddress,
        billingCity: formData.sameAsShipping
          ? formData.city
          : formData.billingCity,
        billingState: formData.sameAsShipping
          ? formData.state
          : formData.billingState,
        billingZip: formData.sameAsShipping
          ? formData.zipCode
          : formData.billingZipCode,
        billingCountry: formData.sameAsShipping
          ? formData.country
          : formData.billingCountry,
        billingPhone: formData.sameAsShipping
          ? formData.phone
          : formData.billingPhone,
        paymentMethod: formData.paymentMethod,
        notes: formData.notes,
        discountCode: appliedDiscount ? appliedDiscount.code : undefined,
        pointsToUse: pointsToUse,
        // shippingCost KHÔNG g?i lên backend — backend t? tính theo Phase 7.3
        items: isBuyNow && buyNowItem ? [{
          productId: buyNowItem.productId,
          variantId: buyNowItem.variantId,
          quantity: buyNowItem.quantity,
          warrantyPackageIds: buyNowItem.warrantyPackageIds
        }] : undefined,
      };

      const response = await createOrder(orderData).unwrap();
      return response.data.order;
    } catch (error) {
      console.error('T?o don hàng th?t b?i:', error);
      dispatch(
        addNotification({
          type: 'error',
          message: t('checkout.errors.orderCreationFailed'),
          duration: 5000,
        })
      );
      return null;
    } finally {
      setIsProcessing(false); // T?t tr?ng thái loading
    }
  };

  // X? lý thanh toán thành công
  const handlePaymentSuccess = async (paymentIntent: any) => {
    dispatch(
      addNotification({
        type: 'success',
        message: t('checkout.success.message'),
        duration: 5000,
      })
    );

    // Xóa gi? hàng
    dispatch(clearCart());

    // Làm m?i s? lu?ng gi? hàng d? c?p nh?t badge trên header
    dispatch(cartApi.util.invalidateTags(['CartCount']));

    // Chuy?n hu?ng d?n trang don hàng
    navigate('/orders');
  };

  // X? lý l?i thanh toán
  const handlePaymentError = (error: string) => {
    dispatch(
      addNotification({
        type: 'error',
        message: error,
        duration: 5000,
      })
    );
  };

  // X? lý tr?ng thái dang thanh toán
  const handlePaymentProcessing = (processing: boolean) => {
    setIsProcessing(processing);
  };

  // T?o don hàng cho thanh toán Stripe
  const handleStripeOrderCreation = async () => {
    const order = await handleCreateOrder();
    if (order) {
      setCurrentOrder(order);
    }
  };

  // X? lý submit form cho t?t c? các phuong th?c thanh toán
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.paymentMethod === 'stripe') {
      // V?i Stripe, t?o don hàng tru?c r?i hi?n th? form thanh toán
      await handleStripeOrderCreation();
      return;
    }

    if (formData.paymentMethod === 'bank_transfer') {
      // V?i chuy?n kho?n ngân hàng, t?o don hàng và chuy?n hu?ng d?n trang thanh toán QR
      const order = await handleCreateOrder();
      if (order) {
        dispatch(clearCart());
        dispatch(cartApi.util.invalidateTags(['CartCount']));

        // Chuy?n hu?ng d?n trang thanh toán QR kèm thông tin don hàng
        navigate(
          `/payment-qr?orderId=${order.id}&amount=${order.total}&numberOrder=${order.number}`
        );
        return;
      }
    }

    if (formData.paymentMethod === 'vnpay') {
      let order = currentOrder;

      // N?u chua có order (thanh toán m?i), t?o order m?i
      if (!order) {
        order = await handleCreateOrder();
      }

      if (order) {
        try {
          const res = await createVNPayUrl({
            orderId: order.id
          }).unwrap();

          if (res.data) {
            window.location.href = res.data;
            return;
          }
        } catch (error) {
          console.error('T?o URL thanh toán VNPay th?t b?i', error);
          dispatch(
            addNotification({
              type: 'error',
              message: t('checkout.errors.vnpayFailed'),
              duration: 5000,
            })
          );
        }
      }
      return;
    }

    if (formData.paymentMethod === 'momo') {
      let order = currentOrder;

      // N?u chua có order (thanh toán m?i), t?o order m?i
      if (!order) {
        order = await handleCreateOrder();
      }

      if (order) {
        try {
          const res = await createMomoUrl({
            orderId: order.id
          }).unwrap();

          if (res.data?.payUrl) {
            window.location.href = res.data.payUrl;
            return;
          }
        } catch (error) {
          console.error('T?o URL thanh toán MoMo th?t b?i', error);
          dispatch(
            addNotification({
              type: 'error',
              message: t('checkout.errors.momoFailed'),
              duration: 5000,
            })
          );
        }
      }
      return;
    }

    // V?i các phuong th?c thanh toán khác, t?o don hàng và chuy?n hu?ng
    const order = await handleCreateOrder();
    if (order) {
      dispatch(
        addNotification({
          type: 'success',
          message: t('checkout.success.message'),
          duration: 5000,
        })
      );
      dispatch(clearCart());
      sessionStorage.removeItem('buyNowItem');
      sessionStorage.removeItem('buyNowAction');

      // Làm m?i s? lu?ng gi? hàng d? c?p nh?t badge trên header
      dispatch(cartApi.util.invalidateTags(['CartCount']));

      navigate('/orders');
    }
  };

  // Tr?ng thái loading cho gi? hàng
  const [isCartLoading, setIsCartLoading] = useState(true);

  // Ki?m tra gi? hàng sau khi dã kh?i t?o
  useEffect(() => {
    // Ki?m tra xem URL có ch?a tham s?
    const searchParams = new URLSearchParams(window.location.search);
    const isBuyNow = searchParams.get('buyNow') === 'true';
    const repayOrderId =
      searchParams.get('repayOrder') || searchParams.get('orderId');

    // Ki?m tra xem ngu?i dùng v?a th?c hi?n hành d?ng "Mua ngay" hay không
    const isBuyNowAction = sessionStorage.getItem('buyNowAction') === 'true';

    // Ð?t m?t timeout dài hon d? d?m b?o gi? hàng dã du?c kh?i t?o và API dã c?p nh?t
    const timer = setTimeout(() => {
      setIsCartLoading(false);

      // N?u ngu?i dùng v?a th?c hi?n hành d?ng "Mua ngay" ho?c dang thanh toán l?i don hàng, không chuy?n hu?ng
      if (isBuyNow || isBuyNowAction || repayOrderId) {
        setIsBuyNow(true);
        // Xóa c? sau khi dã s? d?ng
        sessionStorage.removeItem('buyNowAction');

        // L?y thông tin s?n ph?m mua ngay t? sessionStorage
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

      // Ki?m tra c? serverCartCount và items trong Redux store
      // Ch? chuy?n hu?ng n?u c? hai d?u tr?ng và không ph?i dang thanh toán l?i don hàng
      if (
        serverCartCount === 0 &&
        (!items || items.length === 0) &&
        !repayOrderId
      ) {
        // Xóa d? li?u gi? hàng trong localStorage d? d?m b?o không có d? li?u cu
        localStorage.removeItem('cartItems');

        // C?p nh?t state Redux
        dispatch(initializeCart());

        // Chuy?n hu?ng v? trang shop
        navigate('/shop');
        dispatch(
          addNotification({
            type: 'info',
            message: t('checkout.emptyCart.redirectMessage'),
          })
        );
      }
    }, 800); // Tang th?i gian ch? d? d?m b?o API có d? th?i gian c?p nh?t

    return () => clearTimeout(timer);
  }, [items, serverCartCount, navigate, dispatch, t]);

  // Hi?n th? loading trong khi ki?m tra gi? hàng
  if (isCartLoading) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-500 mx-auto mb-4"></div>
        <p className="text-neutral-600 dark:text-neutral-400">
          {t('common.loading')}
        </p>
      </div>
    );
  }

  // Không c?n ki?m tra gi? hàng tr?ng ? dây n?a vì dã chuy?n hu?ng trong useEffect

  // Ki?m tra xem có ph?i dang thanh toán l?i don hàng không
  const isRepayingOrder = currentOrder && currentOrder.isRepay;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-neutral-800 dark:text-neutral-100 mb-8">
        {isRepayingOrder ? t('checkout.repayTitle') : t('checkout.title')}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* C?t trái - Các form */}
        <div className="space-y-8">
          {/* Shipping Information - ?n khi thanh toán l?i */}
          {!isRepayingOrder && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100 mb-6">
                {t('checkout.shippingInfo.title')}
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label={t('checkout.shippingInfo.firstName')}
                  value={formData.firstName}
                  onChange={(e) =>
                    handleInputChange('firstName', e.target.value)
                  }
                  error={errors.firstName}
                  required
                />
                <Input
                  label={t('checkout.shippingInfo.lastName')}
                  value={formData.lastName}
                  onChange={(e) =>
                    handleInputChange('lastName', e.target.value)
                  }
                  error={errors.lastName}
                  required
                />
                <Input
                  label={t('checkout.shippingInfo.email')}
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  error={errors.email}
                  required
                />
                <Input
                  label={t('checkout.shippingInfo.phone')}
                  value={formData.phone}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  error={errors.phone}
                  required
                />
                <div className="md:col-span-2">
                  <AddressPicker
                    label={t('checkout.shippingInfo.address')}
                    value={formData.address}
                    onChange={(val, lat, lon) => {
                      handleInputChange('address', val);
                      if (lat && lon) {
                        setFormData(prev => ({ ...prev, lat, lon }));
                      }
                    }}
                    error={errors.address}
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Ðã xóa phuong th?c giao hàng tinh theo yêu c?u, phí giao hàng du?c tính t? d?ng. */}

          {/* Ch?n phuong th?c thanh toán */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100 mb-4">
              {t('checkout.paymentMethod.title')}
            </h2>

            <div className="space-y-3">
              {paymentMethods.map((method) => (
                <label
                  key={method.value}
                  className="flex items-center p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg cursor-pointer hover:bg-neutral-50 dark:hover:bg-neutral-700"
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={method.value}
                    checked={formData.paymentMethod === method.value}
                    onChange={(e) =>
                      handleInputChange('paymentMethod', e.target.value)
                    }
                    className="mr-3"
                  />
                  <div className="flex-grow">
                    <div className="font-medium text-neutral-800 dark:text-neutral-100">
                      {method.label}
                    </div>
                  </div>
                </label>
              ))}
            </div>

            {/* Modal thông tin tr? góp */}
            <Modal
              title={
                <div className="flex items-center space-x-2 text-xl text-primary-600">
                  <InfoCircleOutlined />
                  <span>{t('checkout.installment.title')}</span>
                </div>
              }
              open={isInstallmentModalOpen}
              onCancel={() => setIsInstallmentModalOpen(false)}
              footer={[
                <Button key="close" type="primary" onClick={() => setIsInstallmentModalOpen(false)}>
                  {t('checkout.installment.understood')}
                </Button>,
              ]}
              width={700}
              centered
            >
              <div className="space-y-4 py-2">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-blue-800">
                  <h4 className="font-semibold mb-2">{t('checkout.installment.process')}</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>{t('checkout.installment.step1')}</li>
                    <li>{t('checkout.installment.step2')}</li>
                    <li>{t('checkout.installment.step3')}</li>
                  </ol>
                </div>

                <h4 className="font-semibold text-gray-700 mt-4">{t('checkout.installment.bankList')}</h4>
                <Table
                  columns={installmentColumns}
                  dataSource={installmentData}
                  pagination={false}
                  size="small"
                  bordered
                />

                <p className="text-xs text-gray-500 italic mt-2">
                  {t('checkout.installment.note')}
                </p>
              </div>
            </Modal>
          </div>

          {/* Ghi chú don hàng */}
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
        </div>

        {/* C?t ph?i - Tóm t?t don hàng */}
        <div className="space-y-6">
          {/* Tóm t?t don hàng */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6 sticky top-4">
            <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100 mb-6">
              {t('checkout.orderSummary.title')}
            </h2>

            {/* S?n ph?m trong gi? ho?c don hàng thanh toán l?i */}
            {isRepayingOrder ? (
              <div className="space-y-4 mb-6">
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                  <div className="text-blue-800 dark:text-blue-200">
                    <div className="font-semibold mb-2">
                      {t('checkout.repayOrder.title')}
                    </div>
                    <div className="text-sm mb-1">
                      {t('checkout.repayOrder.id')}: {currentOrder.id}
                    </div>
                    <div className="text-lg font-semibold">
                      {t('checkout.repayOrder.amount')}:{' '}
                      {formatPrice(currentOrder.total)}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 mb-6">
                {items.map((item) => (
                  <CartItem
                    key={`${item.id}-${item.variantId || 'default'}`}
                    item={item}
                    isCheckout={true}
                  />
                ))}
              </div>
            )}

            {/* Ph?n mã gi?m giá */}
            {!isRepayingOrder && (
              <div className="mb-6 border-t border-neutral-200 dark:border-neutral-700 pt-4">
                <div className="flex space-x-2 items-end">
                  <div className="flex-grow">
                    <Input
                      placeholder={t('checkout.discountCode.placeholder')}
                      value={discountCodeInput}
                      onChange={(e) => setDiscountCodeInput(e.target.value.toUpperCase())}
                      disabled={!!appliedDiscount}
                    />
                  </div>
                  <CustomButton
                    variant={appliedDiscount ? "danger" : "primary"}
                    onClick={appliedDiscount ? handleRemoveDiscount : handleApplyDiscount}
                    isLoading={isValidatingCode}
                    className="h-[42px] px-4"
                  >
                    {appliedDiscount ? t('checkout.discountCode.cancel') : t('common.apply')}
                  </CustomButton>
                </div>
                {discountError && (
                  <p className="text-red-500 text-xs mt-1">{discountError}</p>
                )}
                {appliedDiscount && (
                  <p className="text-green-600 text-sm mt-1 flex items-center">
                    <CheckCircleOutlined className="mr-1" />
                    {t('checkout.discountCode.discountInfo', { code: appliedDiscount.code, amount: formatPrice(appliedDiscount.amount) })}
                  </p>
                )}
              </div>
            )}

            {/* Ph?n di?m tích luy */}
            {user && availablePoints > 0 && !isRepayingOrder && (
              <div className="mb-6 border-t border-neutral-200 dark:border-neutral-700 pt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    {t('checkout.loyaltyPoints.pointsHeader', { points: availablePoints })}
                  </span>
                  <span className="text-xs text-neutral-500">{t('checkout.loyaltyPoints.rate')}</span>
                </div>
                <div className="flex space-x-2 items-end">
                  <div className="flex-grow">
                    <Input
                      type="number"
                      placeholder={t('checkout.loyaltyPoints.inputPlaceholder')}
                      value={pointsToUse.toString()}
                      min={0}
                      max={availablePoints}
                      onChange={(e) => handleApplyPoints(parseInt(e.target.value) || 0)}
                    />
                  </div>
                  <CustomButton
                    variant="secondary"
                    onClick={() => handleApplyPoints(availablePoints)}
                    className="h-[42px] px-4 text-xs"
                  >
                    {t('checkout.loyaltyPoints.useAll')}
                  </CustomButton>
                </div>
                {pointsError && (
                  <p className="text-red-500 text-xs mt-1">{pointsError}</p>
                )}
                {pointsToUse > 0 && !pointsError && (
                  <p className="text-green-600 text-sm mt-1 flex items-center">
                    <CheckCircleOutlined className="mr-1" />
                    {t('checkout.loyaltyPoints.appliedInfo', { points: pointsToUse, amount: formatPrice(pointsToUse * 1000) })}
                  </p>
                )}
              </div>
            )}

            {/* T?ng c?ng */}
            <div className="border-t border-neutral-200 dark:border-neutral-700 pt-4 space-y-2">
              {!isRepayingOrder ? (
                <>
                  <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                    <span>{t('checkout.orderSummary.subtotal')}</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                    <div className="flex flex-col">
                      <span>{t('checkout.orderSummary.shipping')}</span>
                      {finalDistance > 0 && (
                        <span className="text-base font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1.5 rounded-md mt-1.5 shadow-sm border border-emerald-100 dark:border-emerald-800 inline-flex items-center">
                          {t('checkout.orderSummary.distanceInfo', { distance: finalDistance.toFixed(1), fee: formatPrice(shippingCost) })}
                        </span>
                      )}
                    </div>
                    <span>
                      {shippingCost === 0
                        ? t('checkout.orderSummary.freeShipping')
                        : formatPrice(shippingCost)}
                    </span>
                  </div>
                  {warrantyTotal > 0 && (
                    <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                      <span>{t('checkout.orderSummary.warrantyFee')}</span>
                      <span>{formatPrice(warrantyTotal)}</span>
                    </div>
                  )}
                  {appliedDiscount && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>{t('checkout.orderSummary.discountCodeLabel', { code: appliedDiscount.code })}</span>
                      <span>-{formatPrice(appliedDiscount.amount)}</span>
                    </div>
                  )}
                  {pointsToUse > 0 && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>{t('checkout.orderSummary.loyaltyDiscount')}</span>
                      <span>-{formatPrice(pointsToUse * 1000)}</span>
                    </div>
                  )}
                  {tax > 0 && (
                    <div className="flex justify-between text-neutral-600 dark:text-neutral-400">
                      <span>{t('checkout.orderSummary.tax')}</span>
                      <span>{formatPrice(tax)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-semibold text-neutral-800 dark:text-neutral-100 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                    <span>{t('checkout.orderSummary.total')}</span>
                    <span>{formatPrice(total)}</span>
                  </div>
                </>
              ) : (
                <div className="flex justify-between text-lg font-semibold text-neutral-800 dark:text-neutral-100">
                  <span>{t('checkout.orderSummary.total')}</span>
                  <span>{formatPrice(currentOrder.total)}</span>
                </div>
              )}
            </div>

            {/* Nút tuong ?ng v?i t?ng phuong th?c thanh toán */}
            {formData.paymentMethod === 'stripe' && !currentOrder && (
              <PremiumButton
                variant="primary"
                size="large"
                iconType="arrow-right"
                isProcessing={isProcessing}
                processingText={t('common.processing')}
                onClick={handleStripeOrderCreation}
                className="w-full mt-6 h-14 text-lg font-semibold"
              >
                {t('checkout.buttons.processPayment')}
              </PremiumButton>
            )}

            {(['bank_transfer', 'vnpay', 'momo', 'installment', 'cod'].includes(formData.paymentMethod)) && (!currentOrder || ['vnpay', 'momo'].includes(formData.paymentMethod)) && (
              <PremiumButton
                variant="primary"
                size="large"
                iconType="arrow-right"
                isProcessing={isProcessing}
                processingText={t('common.processing')}
                onClick={handleSubmit}
                className="w-full mt-6 h-14 text-lg font-semibold"
              >
                {t('checkout.buttons.continueToPayment')}
              </PremiumButton>
            )}

            {/* Form thanh toán Stripe (hi?n th? sau khi t?o don hàng) */}
            {formData.paymentMethod === 'stripe' && currentOrder && (
              <div className="mt-6">
                <StripePaymentForm
                  amount={currentOrder.total}
                  orderId={currentOrder.id}
                  onSuccess={handlePaymentSuccess}
                  onError={handlePaymentError}
                  onProcessing={handlePaymentProcessing}
                />
              </div>
            )}

            {/* Ph?n thanh toán QR chuy?n kho?n (hi?n th? sau khi t?o don hàng) - Chuy?n hu?ng d?n trang QR */}
            {formData.paymentMethod === 'bank_transfer' && currentOrder && (
              <div className="mt-6">
                {/* T? d?ng chuy?n hu?ng d?n trang thanh toán QR */}
                <div className="text-center py-4">
                  <p className="text-lg text-neutral-700 dark:text-neutral-300">
                    {t('checkout.redirectingToPayment')}
                  </p>

                </div>
              </div>
            )}

            {/* Thông báo b?o m?t */}
            <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="flex items-center text-green-800 dark:text-green-200">
                <svg
                  className="w-5 h-5 mr-2"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  />
                </svg>
                <div>
                  <div className="font-semibold">
                    {t('checkout.securityNotice.title')}
                  </div>
                  <div className="text-sm">
                    {t('checkout.securityNotice.message')}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;

