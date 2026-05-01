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
import CartItem from '@/components/features/CartItem';
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
  const { t } = useTranslation();
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

  // Thống nhất danh sách items hiển thị
  const items = isBuyNow && buyNowItem ? [buyNowItem] : cartItems;

  // Đảm bảo giỏ hàng được khởi tạo khi trang được tải
  useEffect(() => {
    // Kiểm tra xem URL có chứa tham số
    const searchParams = new URLSearchParams(window.location.search);
    const isBuyNow = searchParams.get('buyNow') === 'true';

    // Kiểm tra cả hai loại URL (cũ và mới)
    const repayOrderId =
      searchParams.get('repayOrder') || searchParams.get('orderId');
    const repayAmount = searchParams.get('amount');

    // Kiểm tra xem URL có phải là URL cũ không (/checkout/payment)
    const isOldPaymentUrl =
      window.location.pathname.includes('/checkout/payment');

    // Nếu là URL cũ, chuyển hướng đến URL mới
    if (isOldPaymentUrl && repayOrderId && repayAmount) {
      navigate(`/checkout?repayOrder=${repayOrderId}&amount=${repayAmount}`, {
        replace: true,
      });
      return;
    }

    // Kiểm tra xem người dùng đang thanh toán lại đơn hàng hay không
    if (repayOrderId && repayAmount) {
      console.log('Repaying order:', repayOrderId, 'amount:', repayAmount);

      // Đặt thông tin đơn hàng hiện tại để thanh toán
      setCurrentOrder({
        id: repayOrderId,
        total: parseFloat(repayAmount),
        isRepay: true,
      });

      // For repay orders, default to stripe for now
      // In the future, this could be set based on the original order's payment method
      setFormData((prev) => ({
        ...prev,
        paymentMethod: 'stripe',
      }));

      return;
    }

    // Kiểm tra xem người dùng vừa thực hiện hành động "Mua ngay" hay không
    const isBuyNowAction = sessionStorage.getItem('buyNowAction') === 'true';

    // Nếu người dùng vừa thực hiện hành động "Mua ngay", không chuyển hướng
    if (isBuyNow || isBuyNowAction) {
      setIsBuyNow(true);
      // Xóa cờ sau khi đã sử dụng
      sessionStorage.removeItem('buyNowAction');

      // Đảm bảo giỏ hàng được khởi tạo
      dispatch(initializeCart());

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

    // Khởi tạo giỏ hàng
    dispatch(initializeCart());

    // Kiểm tra localStorage trực tiếp để đảm bảo không có dữ liệu giỏ hàng cũ
    // Chỉ chuyển hướng nếu không phải đang thanh toán lại đơn hàng
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

  // Lấy số lượng giỏ hàng từ server
  const { data: serverCartCount } = useGetCartCountQuery();

  // Loyalty points data
  const { data: loyaltyData } = useGetLoyaltyInfoQuery(undefined, {
    skip: !user,
  });
  const availablePoints = loyaltyData?.data?.points || 0;
  const [pointsToUse, setPointsToUse] = useState<number>(0);
  const [pointsError, setPointsError] = useState('');

  // Payment methods with i18n
  const paymentMethods = [
    { value: 'cod', label: 'Thanh toán khi nhận hàng (COD)' },
    { value: 'vnpay', label: t('checkout.paymentMethod.vnpay') },
    { value: 'momo', label: 'Thanh toán MoMo' },
    { value: 'installment', label: 'Trả góp 0% qua thẻ tín dụng' },
  ];

  // Shipping methods with i18n
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

  // Form state
  const [formData, setFormData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    email: user?.email || '',
    phone: user?.phone || '', // Sử dụng số điện thoại của người dùng nếu có
    addressDetail: '', // Số nhà, tên đường
    ward: '',
    district: '', // Lưu tên quận/huyện
    province: '', // Lưu tên tỉnh/thành
    address: '', // = addressDetail + ward
    city: '', // = district
    state: '', // = province
    zipCode: '',
    country: 'VN',
    shippingMethod: 'standard',
    paymentMethod: 'cod', // Default to COD
    notes: '',
    // Billing address (same as shipping by default)
    billingFirstName: user?.firstName || '',
    billingLastName: user?.lastName || '',
    billingAddress: '',
    billingCity: '',
    billingState: '',
    billingZipCode: '',
    billingCountry: 'VN',
    billingPhone: user?.phone || '', // Sử dụng số điện thoại của người dùng nếu có
    sameAsShipping: true,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isProcessing, setIsProcessing] = useState(false);
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);

  // Removed Provinces hook

  // Discount code states
  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number } | null>(null);
  const [discountError, setDiscountError] = useState('');
  const [applyDiscountCode, { isLoading: isValidatingCode }] = useApplyDiscountCodeMutation();

  // Installment Table Columns
  const installmentColumns = [
    {
      title: 'Ngân hàng',
      dataIndex: 'bank',
      key: 'bank',
      render: (text: string) => <span className="font-medium">{text}</span>,
    },
    {
      title: 'Kỳ hạn',
      dataIndex: 'terms',
      key: 'terms',
    },
    {
      title: 'Phí chuyển đổi',
      dataIndex: 'fee',
      key: 'fee',
      render: () => <span className="text-green-600 font-medium">Miễn phí</span>,
    },
  ];

  const installmentData = [
    { key: '1', bank: 'Techcombank', terms: '3, 6, 9, 12 tháng', fee: '0%' },
    { key: '2', bank: 'VPBank', terms: '3, 6, 9, 12 tháng', fee: '0%' },
    { key: '3', bank: 'Sacombank', terms: '6, 12 tháng', fee: '0%' },
    { key: '4', bank: 'VIB', terms: '3, 6, 9, 12 tháng', fee: '0%' },
    { key: '5', bank: 'HSBC', terms: '3, 6, 9, 12 tháng', fee: '0%' },
    { key: '6', bank: 'TPBank', terms: '3, 6, 9, 12 tháng', fee: '0%' },
  ];

  // Open modal when installment is selected
  useEffect(() => {
    if (formData.paymentMethod === 'installment') {
      setIsInstallmentModalOpen(true);
    }
  }, [formData.paymentMethod]);

  // Debug log
  console.log('CheckoutPage render - currentOrder:', currentOrder);
  console.log('CheckoutPage render - paymentMethod:', formData.paymentMethod);

  // Countries list
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

  // Calculate warranty total
  const warrantyTotal = items.reduce((sum: number, item: any) => {
    const itemWarrantyPrice = item.warrantyPackages?.reduce((wSum: number, pkg: any) => wSum + pkg.price, 0) || 0;
    return sum + (itemWarrantyPrice * item.quantity);
  }, 0);

  // Tính phí vận chuyển tự động theo khoảng cách tuyến tính sử dụng API LocationIQ
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
        if (distanceInKm <= 3) return 15000; // 3km đầu tiên đồng giá 15k
        const fee = 15000 + Math.ceil(distanceInKm - 3) * 5000; // km thứ 4 trở đi cộng thêm 5k/km
        return Math.min(fee, 100000); // max 100k
      };

      // Tọa độ gốc cửa hàng: 144 Đ. Xuân Thủy, Cầu Giấy, HN (21.0378, 105.7827)
      finalDistance = calculateDistance(21.0378, 105.7827, parseFloat(lat), parseFloat(lon));
      shippingCost = calculateShippingFee(finalDistance);
    }
  }

  const tax = 0; // 0% tax - taxes are not applied per request
  const discountAmount = appliedDiscount ? appliedDiscount.amount : 0;
  
  // Point discount calculation (1 point = 1,000 VND)
  const pointsDiscount = pointsToUse * 1000;
  
  const total = subtotal + warrantyTotal + shippingCost + tax - discountAmount - pointsDiscount;

  // Handle form input changes
  const handleInputChange = (name: string, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      // Auto-fill mock fields to bypass backend validation
      if (name === 'address') {
        let parts = value.split(',');
        updated.state = parts.length > 2 ? parts[parts.length - 2].trim() : 'Việt Nam';
        updated.city = parts.length > 3 ? parts[parts.length - 3].trim() : 'Thành phố';
      }

      // Auto-fill billing address if same as shipping
      if (updated.sameAsShipping && name.startsWith('shipping')) {
        const billingField = name.replace('shipping', 'billing');
        updated[billingField as keyof typeof updated] = value as never;
      }

      return updated;
    });

    // Clear error when user starts typing
    if (errors[name]) {
      setErrors((prev) => ({
        ...prev,
        [name]: '',
      }));
    }
  };

  // Removed old province handlers

  // Handle same as shipping checkbox
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

  // Validate form
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Required fields
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

    // Email validation
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('checkout.validation.emailInvalid');
    }

    // Phone validation
    if (formData.phone && !/^\d{10}$/.test(formData.phone.replace(/\D/g, ''))) {
      newErrors.phone = t('checkout.validation.phoneInvalid');
    }

    // Billing address validation if not same as shipping
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

  // Handle apply discount code
  const handleApplyDiscount = async () => {
    if (!discountCodeInput.trim()) {
      setDiscountError('Vui lòng nhập mã giảm giá');
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
          message: 'Áp dụng mã giảm giá thành công!',
        })
      );
    } catch (error: any) {
      setDiscountError(error.data?.message || 'Mã giảm giá không hợp lệ');
    }
  };

  const handleRemoveDiscount = () => {
    setAppliedDiscount(null);
    setDiscountCodeInput('');
    setDiscountError('');
  };

  const handleApplyPoints = (val: number) => {
    if (val < 0) {
      setPointsError('Số điểm không hợp lệ');
      setPointsToUse(0);
      return;
    }
    if (val > availablePoints) {
      setPointsError(`Bạn chỉ có tối đa ${availablePoints} điểm`);
      setPointsToUse(availablePoints);
      return;
    }
    
    // Check if points discount exceeds subtotal
    if (val * 1000 > subtotal - discountAmount) {
      const maxPoints = Math.floor((subtotal - discountAmount) / 1000);
      setPointsToUse(maxPoints);
      setPointsError(`Giảm giá bằng điểm không được vượt quá giá trị đơn hàng`);
      return;
    }

    setPointsToUse(val);
    setPointsError('');
  };

  // Create order
  const handleCreateOrder = async () => {
    if (!validateForm()) {
      const firstError = document.querySelector('[aria-invalid="true"]');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return null;
    }

    setIsProcessing(true); // Set loading state

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
        shippingCost: shippingCost,
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
      console.error('Failed to create order:', error);
      dispatch(
        addNotification({
          type: 'error',
          message: t('checkout.errors.orderCreationFailed'),
          duration: 5000,
        })
      );
      return null;
    } finally {
      setIsProcessing(false); // Reset loading state
    }
  };

  // Handle payment success
  const handlePaymentSuccess = async (paymentIntent: any) => {
    dispatch(
      addNotification({
        type: 'success',
        message: t('checkout.success.message'),
        duration: 5000,
      })
    );

    // Clear cart
    dispatch(clearCart());

    // Refetch cart count to update header badge
    dispatch(cartApi.util.invalidateTags(['CartCount']));

    // Redirect to orders page
    navigate('/orders');
  };

  // Handle payment error
  const handlePaymentError = (error: string) => {
    dispatch(
      addNotification({
        type: 'error',
        message: error,
        duration: 5000,
      })
    );
  };

  // Handle payment processing state
  const handlePaymentProcessing = (processing: boolean) => {
    setIsProcessing(processing);
  };

  // Handle creating order for Stripe payment
  const handleStripeOrderCreation = async () => {
    console.log('Creating order for Stripe payment...');
    const order = await handleCreateOrder();
    console.log('Order created:', order);
    if (order) {
      setCurrentOrder(order);
      console.log('Current order set:', order);
    }
  };

  // Handle form submission for all payment methods
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.paymentMethod === 'stripe') {
      // For Stripe, create order first then show payment form
      await handleStripeOrderCreation();
      return;
    }

    if (formData.paymentMethod === 'bank_transfer') {
      // For bank transfer, create order and redirect to QR payment page
      const order = await handleCreateOrder();
      if (order) {
        dispatch(clearCart());
        dispatch(cartApi.util.invalidateTags(['CartCount']));

        // Navigate to payment QR page with order information
        navigate(
          `/payment-qr?orderId=${order.id}&amount=${order.total}&numberOrder=${order.number}`
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
            orderId: order.id
          }).unwrap();

          if (res.data) {
            window.location.href = res.data;
            return;
          }
        } catch (error) {
          console.error('Failed to create VNPay payment URL', error);
          dispatch(
            addNotification({
              type: 'error',
              message: 'Không thể tạo mã thanh toán VNPay',
              duration: 5000,
            })
          );
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
            orderId: order.id
          }).unwrap();

          if (res.data?.payUrl) {
            window.location.href = res.data.payUrl;
            return;
          }
        } catch (error) {
          console.error('Failed to create MoMo payment URL', error);
          dispatch(
            addNotification({
              type: 'error',
              message: 'Không thể tạo mã thanh toán MoMo',
              duration: 5000,
            })
          );
        }
      }
      return;
    }

    // For other payment methods, create order and redirect
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

      // Refetch cart count to update header badge
      dispatch(cartApi.util.invalidateTags(['CartCount']));

      navigate('/orders');
    }
  };

  // Trạng thái loading cho giỏ hàng
  const [isCartLoading, setIsCartLoading] = useState(true);

  // Kiểm tra giỏ hàng sau khi đã khởi tạo
  useEffect(() => {
    // Kiểm tra xem URL có chứa tham số
    const searchParams = new URLSearchParams(window.location.search);
    const isBuyNow = searchParams.get('buyNow') === 'true';
    const repayOrderId =
      searchParams.get('repayOrder') || searchParams.get('orderId');

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

      // Kiểm tra cả serverCartCount và items trong Redux store
      // Chỉ chuyển hướng nếu cả hai đều trống và không phải đang thanh toán lại đơn hàng
      if (
        serverCartCount === 0 &&
        (!items || items.length === 0) &&
        !repayOrderId
      ) {
        // Xóa dữ liệu giỏ hàng trong localStorage để đảm bảo không có dữ liệu cũ
        localStorage.removeItem('cartItems');

        // Cập nhật state Redux
        dispatch(initializeCart());

        // Chuyển hướng về trang shop
        navigate('/shop');
        dispatch(
          addNotification({
            type: 'info',
            message: t('checkout.emptyCart.redirectMessage'),
          })
        );
      }
    }, 800); // Tăng thời gian chờ để đảm bảo API có đủ thời gian cập nhật

    return () => clearTimeout(timer);
  }, [items, serverCartCount, navigate, dispatch, t]);

  // Hiển thị loading trong khi kiểm tra giỏ hàng
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

  // Không cần kiểm tra giỏ hàng trống ở đây nữa vì đã chuyển hướng trong useEffect

  // Kiểm tra xem có phải đang thanh toán lại đơn hàng không
  const isRepayingOrder = currentOrder && currentOrder.isRepay;

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-neutral-800 dark:text-neutral-100 mb-8">
        {isRepayingOrder ? t('checkout.repayTitle') : t('checkout.title')}
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column - Forms */}
        <div className="space-y-8">
          {/* Shipping Information - Ẩn khi thanh toán lại */}
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
                    label="Địa chỉ giao hàng"
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

          {/* Đã xóa phương thức giao hàng tĩnh theo yêu cầu, phí giao hàng được tính tự động. */}

          {/* Payment Method Selection */}
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

            {/* Installment Info Modal */}
            <Modal
              title={
                <div className="flex items-center space-x-2 text-xl text-primary-600">
                  <InfoCircleOutlined />
                  <span>Hướng dẫn Trả góp 0%</span>
                </div>
              }
              open={isInstallmentModalOpen}
              onCancel={() => setIsInstallmentModalOpen(false)}
              footer={[
                <Button key="close" type="primary" onClick={() => setIsInstallmentModalOpen(false)}>
                  Đã hiểu
                </Button>,
              ]}
              width={700}
              centered
            >
              <div className="space-y-4 py-2">
                <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-blue-800">
                  <h4 className="font-semibold mb-2">Quy trình trả góp:</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Chọn ngân hàng và kỳ hạn trả góp phù hợp trong bảng dưới đây.</li>
                    <li>Hoàn tất đặt hàng với phương thức "Trả góp 0%".</li>
                    <li>Nhân viên tư vấn sẽ liên hệ lại để hướng dẫn quý khách thực hiện chuyển đổi trả góp.</li>
                  </ol>
                </div>

                <h4 className="font-semibold text-gray-700 mt-4">Danh sách ngân hàng hỗ trợ:</h4>
                <Table
                  columns={installmentColumns}
                  dataSource={installmentData}
                  pagination={false}
                  size="small"
                  bordered
                />

                <p className="text-xs text-gray-500 italic mt-2">
                  * Lưu ý: Chương trình trả góp 0% chỉ áp dụng cho thẻ tín dụng (Credit Card). Không áp dụng cho thẻ ATM/Debit.
                </p>
              </div>
            </Modal>
          </div>

          {/* Order Notes */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
            <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100 mb-4">
              Order Notes (Optional)
            </h2>
            <textarea
              value={formData.notes}
              onChange={(e) => handleInputChange('notes', e.target.value)}
              placeholder="Any special instructions for your order..."
              className="w-full p-3 border border-neutral-200 dark:border-neutral-700 rounded-lg bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100"
              rows={3}
            />
          </div>
        </div>

        {/* Right Column - Order Summary */}
        <div className="space-y-6">
          {/* Order Summary */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6 sticky top-4">
            <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100 mb-6">
              {t('checkout.orderSummary.title')}
            </h2>

            {/* Cart Items or Repay Order */}
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

            {/* Discount Code Section */}
            {!isRepayingOrder && (
              <div className="mb-6 border-t border-neutral-200 dark:border-neutral-700 pt-4">
                <div className="flex space-x-2 items-end">
                  <div className="flex-grow">
                    <Input
                      placeholder="Mã giảm giá"
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
                    {appliedDiscount ? "Hủy" : "Áp dụng"}
                  </CustomButton>
                </div>
                {discountError && (
                  <p className="text-red-500 text-xs mt-1">{discountError}</p>
                )}
                {appliedDiscount && (
                  <p className="text-green-600 text-sm mt-1 flex items-center">
                    <CheckCircleOutlined className="mr-1" />
                    Đã áp dụng mã <strong>{appliedDiscount.code}</strong>. Giảm {formatPrice(appliedDiscount.amount)}
                  </p>
                )}
              </div>
            )}

            {/* Loyalty Points Section */}
            {user && availablePoints > 0 && !isRepayingOrder && (
              <div className="mb-6 border-t border-neutral-200 dark:border-neutral-700 pt-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
                    Sử dụng điểm tích lũy (Có {availablePoints} điểm)
                  </span>
                  <span className="text-xs text-neutral-500">1 điểm = 1,000đ</span>
                </div>
                <div className="flex space-x-2 items-end">
                  <div className="flex-grow">
                    <Input
                      type="number"
                      placeholder="Số điểm muốn dùng"
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
                    Dùng hết
                  </CustomButton>
                </div>
                {pointsError && (
                  <p className="text-red-500 text-xs mt-1">{pointsError}</p>
                )}
                {pointsToUse > 0 && !pointsError && (
                  <p className="text-green-600 text-sm mt-1 flex items-center">
                    <CheckCircleOutlined className="mr-1" />
                    Đã áp dụng {pointsToUse} điểm. Giảm {formatPrice(pointsToUse * 1000)}
                  </p>
                )}
              </div>
            )}

            {/* Totals */}
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
                          📍 Khoảng cách: {finalDistance.toFixed(1)} km - Phí: {formatPrice(shippingCost)}
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
                      <span>Phí gói bảo hành</span>
                      <span>{formatPrice(warrantyTotal)}</span>
                    </div>
                  )}
                  {appliedDiscount && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>Mã giảm giá ({appliedDiscount.code})</span>
                      <span>-{formatPrice(appliedDiscount.amount)}</span>
                    </div>
                  )}
                  {pointsToUse > 0 && (
                    <div className="flex justify-between text-green-600 font-medium">
                      <span>Giảm giá bằng điểm</span>
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

            {/* Payment Method Specific Buttons */}
            {formData.paymentMethod === 'stripe' && !currentOrder && (
              <PremiumButton
                variant="primary"
                size="large"
                iconType="arrow-right"
                isProcessing={isProcessing}
                processingText="Processing..."
                onClick={handleStripeOrderCreation}
                className="w-full mt-6 h-14 text-lg font-semibold"
              >
                Continue to Payment
              </PremiumButton>
            )}

            {(['bank_transfer', 'vnpay', 'momo', 'installment', 'cod'].includes(formData.paymentMethod)) && (!currentOrder || ['vnpay', 'momo'].includes(formData.paymentMethod)) && (
              <PremiumButton
                variant="primary"
                size="large"
                iconType="arrow-right"
                isProcessing={isProcessing}
                processingText={t('common.processing') || 'Processing...'}
                onClick={handleSubmit}
                className="w-full mt-6 h-14 text-lg font-semibold"
              >
                {t('checkout.buttons.continueToPayment') ||
                  'Continue to Payment'}
              </PremiumButton>
            )}

            {/* Stripe Payment Form (appears after order creation) */}
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

            {/* Bank Transfer QR Section (appears after order creation) - Redirect to QR page */}
            {formData.paymentMethod === 'bank_transfer' && currentOrder && (
              <div className="mt-6">
                {/* Automatically redirect to payment QR page */}
                <div className="text-center py-4">
                  <p className="text-lg text-neutral-700 dark:text-neutral-300">
                    {t('checkout.redirectingToPayment')}
                  </p>
                </div>
              </div>
            )}

            {/* Security Notice */}
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
