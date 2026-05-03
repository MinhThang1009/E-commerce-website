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

  // Th?ng nh?t danh s�ch items hi?n th?
  const items = isBuyNow && buyNowItem ? [buyNowItem] : cartItems;

  // �?m b?o gi? h�ng du?c kh?i t?o khi trang du?c t?i
  useEffect(() => {
    // Ki?m tra xem URL c� ch?a tham s?
    const searchParams = new URLSearchParams(window.location.search);
    const isBuyNow = searchParams.get('buyNow') === 'true';

    // Ki?m tra c? hai lo?i URL (cu v� m?i)
    const repayOrderId =
      searchParams.get('repayOrder') || searchParams.get('orderId');
    const repayAmount = searchParams.get('amount');

    // Ki?m tra xem URL c� ph?i l� URL cu kh�ng (/checkout/payment)
    const isOldPaymentUrl =
      window.location.pathname.includes('/checkout/payment');

    // N?u l� URL cu, chuy?n hu?ng d?n URL m?i
    if (isOldPaymentUrl && repayOrderId && repayAmount) {
      navigate(`/checkout?repayOrder=${repayOrderId}&amount=${repayAmount}`, {
        replace: true,
      });
      return;
    }

    // Ki?m tra xem ngu?i d�ng dang thanh to�n l?i don h�ng hay kh�ng
    if (repayOrderId && repayAmount) {
      // �?t th�ng tin don h�ng hi?n t?i d? thanh to�n
      setCurrentOrder({
        id: repayOrderId,
        total: parseFloat(repayAmount),
        isRepay: true,
      });

      // V?i don h�ng thanh to�n l?i, m?c d?nh d�ng stripe
      // Sau n�y c� th? d?t theo phuong th?c thanh to�n g?c c?a don h�ng
      setFormData((prev) => ({
        ...prev,
        paymentMethod: 'stripe',
      }));

      return;
    }

    // Ki?m tra xem ngu?i d�ng v?a th?c hi?n h�nh d?ng "Mua ngay" hay kh�ng
    const isBuyNowAction = sessionStorage.getItem('buyNowAction') === 'true';

    // N?u ngu?i d�ng v?a th?c hi?n h�nh d?ng "Mua ngay", kh�ng chuy?n hu?ng
    if (isBuyNow || isBuyNowAction) {
      setIsBuyNow(true);
      // X�a c? sau khi d� s? d?ng
      sessionStorage.removeItem('buyNowAction');

      // �?m b?o gi? h�ng du?c kh?i t?o
      dispatch(initializeCart());

      // L?y th�ng tin s?n ph?m mua ngay t? sessionStorage
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

    // Kh?i t?o gi? h�ng
    dispatch(initializeCart());

    // Ki?m tra localStorage tr?c ti?p d? d?m b?o kh�ng c� d? li?u gi? h�ng cu
    // Ch? chuy?n hu?ng n?u kh�ng ph?i dang thanh to�n l?i don h�ng
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

  // L?y s? lu?ng gi? h�ng t? server
  const { data: serverCartCount } = useGetCartCountQuery();

  // D? li?u di?m t�ch luy
  const { data: loyaltyData } = useGetLoyaltyInfoQuery(undefined, {
    skip: !user,
  });
  const availablePoints = loyaltyData?.data?.points || 0;
  const [pointsToUse, setPointsToUse] = useState<number>(0);
  const [pointsError, setPointsError] = useState('');

  // C�c phuong th?c thanh to�n
  const paymentMethods = [
    { value: 'cod', label: t('checkout.paymentMethod.cod') },
    { value: 'vnpay', label: t('checkout.paymentMethod.vnpay') },
    { value: 'momo', label: t('checkout.paymentMethod.momo') },
    { value: 'installment', label: t('checkout.paymentMethod.installment') },
  ];

  // C�c phuong th?c v?n chuy?n
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

  // Tr?ng th�i form
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '', // S? d?ng s? di?n tho?i c?a ngu?i d�ng n?u c�
    addressDetail: '', // S? nh�, t�n du?ng
    ward: '',
    district: '', // Luu t�n qu?n/huy?n
    province: '', // Luu t�n t?nh/th�nh
    address: '', // = addressDetail + ward
    city: '', // = district
    state: '', // = province
    zipCode: '',
    country: 'VN',
    shippingMethod: 'standard',
    paymentMethod: 'cod', // M?c d?nh thanh to�n khi nh?n h�ng
    notes: '',
    // �?a ch? thanh to�n (m?c d?nh gi?ng d?a ch? giao h�ng)
    billingFirstName: user?.firstName || '',
    billingLastName: user?.lastName || '',
    billingAddress: '',
    billingCity: '',
    billingState: '',
    billingZipCode: '',
    billingCountry: 'VN',
    billingPhone: user?.phone || '', // S? d?ng s? di?n tho?i c?a ngu?i d�ng n?u c�
    sameAsShipping: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);

  // �� x�a hook l?y danh s�ch t?nh/th�nh

  // Tr?ng th�i m� gi?m gi�
  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number } | null>(null);
  const [discountError, setDiscountError] = useState('');
  const [applyDiscountCode, { isLoading: isValidatingCode }] = useApplyDiscountCodeMutation();

  // C?t b?ng tr? g�p
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

  // M? modal khi ch?n thanh to�n tr? g�p
  useEffect(() => {
    if (formData.paymentMethod === 'installment') {
      setIsInstallmentModalOpen(true);
    }
  }, [formData.paymentMethod]);

  // Danh s�ch qu?c gia
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

  // T�nh t?ng ph� b?o h�nh
  const warrantyTotal = items.reduce((sum: number, item: any) => {
    const itemWarrantyPrice = item.warrantyPackages?.reduce((wSum: number, pkg: any) => wSum + pkg.price, 0) || 0;
    return sum + (itemWarrantyPrice * item.quantity);
  }, 0);

  // T�nh ph� v?n chuy?n t? d?ng theo kho?ng c�ch tuy?n t�nh s? d?ng API LocationIQ
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
        if (distanceInKm <= 3) return 15000; // 3km d?u ti�n d?ng gi� 15k
        const fee = 15000 + Math.ceil(distanceInKm - 3) * 5000; // km th? 4 tr? di c?ng th�m 5k/km
        return Math.min(fee, 100000); // max 100k
      };

      // T?a d? g?c c?a h�ng: 144 �. Xu�n Th?y, C?u Gi?y, HN (21.0378, 105.7827)
      finalDistance = calculateDistance(21.0378, 105.7827, parseFloat(lat), parseFloat(lon));
      shippingCost = calculateShippingFee(finalDistance);
    }
  }

  const tax = 0; // Thu? 0% - kh�ng �p d?ng thu? theo y�u c?u
  const discountAmount = appliedDiscount ? appliedDiscount.amount : 0;
  
  // T�nh gi?m gi� theo di?m (1 di?m = 1.000 VND)
  const pointsDiscount = pointsToUse * 1000;
  
  const total = subtotal + warrantyTotal + shippingCost + tax - discountAmount - pointsDiscount;

  // X? l� thay d?i input trong form
  const handleInputChange = (name: string, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      // T? d?ng di?n c�c tru?ng ph? d? vu?t qua validation ph�a backend
      if (name === 'address') {
        let parts = value.split(',');
        // Dùng chuỗi rỗng thay vì t() — giá trị dịch sẽ gây backend validation fail khi ngôn ngữ EN
        updated.state = parts.length > 2 ? parts[parts.length - 2].trim() : '';
        updated.city = parts.length > 3 ? parts[parts.length - 3].trim() : '';
      }

      // T? d?ng di?n d?a ch? thanh to�n n?u gi?ng d?a ch? giao h�ng
      if (updated.sameAsShipping && name.startsWith('shipping')) {
        const billingField = name.replace('shipping', 'billing');
        updated[billingField as keyof typeof updated] = value as never;
      }

      return updated;
    });

    // X�a l?i khi ngu?i d�ng b?t d?u nh?p
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  // �� x�a c�c handler t?nh/th�nh cu

  // X? l� checkbox "gi?ng d?a ch? giao h�ng"
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

  // Validate form d?u v�o
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // C�c tru?ng b?t bu?c
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

    // Ki?m tra d?a ch? thanh to�n n?u kh�c d?a ch? giao h�ng
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

  // X? l� �p d?ng m� gi?m gi�
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

  // T?o don h�ng
  const handleCreateOrder = async () => {
    if (!validateForm()) {
      const firstError = document.querySelector('[aria-invalid="true"]');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return null;
    }

    setIsProcessing(true); // B?t tr?ng th�i loading

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
        // shippingCost KH�NG g?i l�n backend � backend t? t�nh theo Phase 7.3
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
      console.error('T?o don h�ng th?t b?i:', error);
      dispatch(
        addNotification({
          type: 'error',
          message: t('checkout.errors.orderCreationFailed'),
          duration: 5000,
        })
      );
      return null;
    } finally {
      setIsProcessing(false); // T?t tr?ng th�i loading
    }
  };

  // X? l� thanh to�n th�nh c�ng
  const handlePaymentSuccess = async (paymentIntent: any) => {
    dispatch(
      addNotification({
        type: 'success',
        message: t('checkout.success.message'),
        duration: 5000,
      })
    );

    // X�a gi? h�ng
    dispatch(clearCart());

    // L�m m?i s? lu?ng gi? h�ng d? c?p nh?t badge tr�n header
    dispatch(cartApi.util.invalidateTags(['CartCount']));

    // Chuy?n hu?ng d?n trang don h�ng
    navigate('/orders');
  };

  // X? l� l?i thanh to�n
  const handlePaymentError = (error: string) => {
    dispatch(
      addNotification({
        type: 'error',
        message: error,
        duration: 5000,
      })
    );
  };

  // X? l� tr?ng th�i dang thanh to�n
  const handlePaymentProcessing = (processing: boolean) => {
    setIsProcessing(processing);
  };

  // T?o don h�ng cho thanh to�n Stripe
  const handleStripeOrderCreation = async () => {
    const order = await handleCreateOrder();
    if (order) {
      setCurrentOrder(order);
    }
  };

  // X? l� submit form cho t?t c? c�c phuong th?c thanh to�n
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.paymentMethod === 'stripe') {
      // V?i Stripe, t?o don h�ng tru?c r?i hi?n th? form thanh to�n
      await handleStripeOrderCreation();
      return;
    }

    if (formData.paymentMethod === 'bank_transfer') {
      // V?i chuy?n kho?n ng�n h�ng, t?o don h�ng v� chuy?n hu?ng d?n trang thanh to�n QR
      const order = await handleCreateOrder();
      if (order) {
        dispatch(clearCart());
        dispatch(cartApi.util.invalidateTags(['CartCount']));

        // Chuy?n hu?ng d?n trang thanh to�n QR k�m th�ng tin don h�ng
        navigate(
          `/payment-qr?orderId=${order.id}&amount=${order.total}&numberOrder=${order.number}`
        );
        return;
      }
    }

    if (formData.paymentMethod === 'vnpay') {
      let order = currentOrder;

      // N?u chua c� order (thanh to�n m?i), t?o order m?i
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
          console.error('T?o URL thanh to�n VNPay th?t b?i', error);
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

      // N?u chua c� order (thanh to�n m?i), t?o order m?i
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
          console.error('T?o URL thanh to�n MoMo th?t b?i', error);
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

    // V?i c�c phuong th?c thanh to�n kh�c, t?o don h�ng v� chuy?n hu?ng
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

      // L�m m?i s? lu?ng gi? h�ng d? c?p nh?t badge tr�n header
      dispatch(cartApi.util.invalidateTags(['CartCount']));

      navigate('/orders');
    }
  };

  // Tr?ng th�i loading cho gi? h�ng
  const [isCartLoading, setIsCartLoading] = useState(true);

  // Ki?m tra gi? h�ng sau khi d� kh?i t?o
  useEffect(() => {
    // Ki?m tra xem URL c� ch?a tham s?
    const searchParams = new URLSearchParams(window.location.search);
    const isBuyNow = searchParams.get('buyNow') === 'true';
    const repayOrderId =
      searchParams.get('repayOrder') || searchParams.get('orderId');

    // Ki?m tra xem ngu?i d�ng v?a th?c hi?n h�nh d?ng "Mua ngay" hay kh�ng
    const isBuyNowAction = sessionStorage.getItem('buyNowAction') === 'true';

    // �?t m?t timeout d�i hon d? d?m b?o gi? h�ng d� du?c kh?i t?o v� API d� c?p nh?t
    const timer = setTimeout(() => {
      setIsCartLoading(false);

      // N?u ngu?i d�ng v?a th?c hi?n h�nh d?ng "Mua ngay" ho?c dang thanh to�n l?i don h�ng, kh�ng chuy?n hu?ng
      if (isBuyNow || isBuyNowAction || repayOrderId) {
        setIsBuyNow(true);
        // X�a c? sau khi d� s? d?ng
        sessionStorage.removeItem('buyNowAction');

        // L?y th�ng tin s?n ph?m mua ngay t? sessionStorage
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

      // Ki?m tra c? serverCartCount v� items trong Redux store
      // Ch? chuy?n hu?ng n?u c? hai d?u tr?ng v� kh�ng ph?i dang thanh to�n l?i don h�ng
      if (
        serverCartCount === 0 &&
        (!items || items.length === 0) &&
        !repayOrderId
      ) {
        // X�a d? li?u gi? h�ng trong localStorage d? d?m b?o kh�ng c� d? li?u cu
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
    }, 800); // Tang th?i gian ch? d? d?m b?o API c� d? th?i gian c?p nh?t

    return () => clearTimeout(timer);
  }, [items, serverCartCount, navigate, dispatch, t]);

  // Hi?n th? loading trong khi ki?m tra gi? h�ng
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

  // Kh�ng c?n ki?m tra gi? h�ng tr?ng ? d�y n?a v� d� chuy?n hu?ng trong useEffect

  // Ki?m tra xem c� ph?i dang thanh to�n l?i don h�ng kh�ng
  const isRepayingOrder = currentOrder && currentOrder.isRepay;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-neutral-800 dark:text-neutral-100 mb-8">
        {isRepayingOrder ? t('checkout.repayTitle') : t('checkout.title')}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* C?t tr�i - C�c form */}
        <div className="space-y-8">
          {/* Shipping Information - ?n khi thanh to�n l?i */}
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

          {/* �� x�a phuong th?c giao h�ng tinh theo y�u c?u, ph� giao h�ng du?c t�nh t? d?ng. */}

          {/* Ch?n phuong th?c thanh to�n */}
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

            {/* Modal th�ng tin tr? g�p */}
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

          {/* Ghi ch� don h�ng */}
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

        {/* C?t ph?i - T�m t?t don h�ng */}
        <div className="space-y-6">
          {/* T�m t?t don h�ng */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6 sticky top-4">
            <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100 mb-6">
              {t('checkout.orderSummary.title')}
            </h2>

            {/* S?n ph?m trong gi? ho?c don h�ng thanh to�n l?i */}
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

            {/* Ph?n m� gi?m gi� */}
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

            {/* Ph?n di?m t�ch luy */}
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

            {/* N�t tuong ?ng v?i t?ng phuong th?c thanh to�n */}
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

            {/* Form thanh to�n Stripe (hi?n th? sau khi t?o don h�ng) */}
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

            {/* Ph?n thanh to�n QR chuy?n kho?n (hi?n th? sau khi t?o don h�ng) - Chuy?n hu?ng d?n trang QR */}
            {formData.paymentMethod === 'bank_transfer' && currentOrder && (
              <div className="mt-6">
                {/* T? d?ng chuy?n hu?ng d?n trang thanh to�n QR */}
                <div className="text-center py-4">
                  <p className="text-lg text-neutral-700 dark:text-neutral-300">
                    {t('checkout.redirectingToPayment')}
                  </p>

                </div>
              </div>
            )}

            {/* Th�ng b�o b?o m?t */}
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

