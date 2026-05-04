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
import { useGetAddressesQuery } from '@/services/userApi';
import { Address } from '@/types/user.types';

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

  // Thống nhất danh sách items hiển thị trong checkout - nếu là mua ngay thì chỉ hiển thị 1 item, còn lại hiển thị toàn bộ giỏ hàng
  const items = isBuyNow && buyNowItem ? [buyNowItem] : cartItems;

  // Kiểm tra giỏ hàng khi component mount để đảm bảo không có dữ liệu cũ hoặc người dùng truy cập sai cách
  useEffect(() => {
    // Kiểm tra xem URL có chứa tham số buyNow hay không
    const searchParams = new URLSearchParams(window.location.search);
    const isBuyNow = searchParams.get('buyNow') === 'true';

    // Kiểm tra xem URL có chứa tham số repayOrder hay orderId (cho trường hợp thanh toán lại đơn hàng thất bại) và amount
    const repayOrderId =
      searchParams.get('repayOrder') || searchParams.get('orderId');
    const repayAmount = searchParams.get('amount');

    // Kiểm tra xem URL có phải là URL cũ của trang thanh toán hay không (ví dụ: /checkout/payment?orderId=xxx&amount=yyy)
    const isOldPaymentUrl =
      window.location.pathname.includes('/checkout/payment');

    // Nếu là URL cũ và có tham số repayOrder và amount, chuyển hướng sang URL mới chuẩn với thông tin thanh toán lại đơn hàng
    if (isOldPaymentUrl && repayOrderId && repayAmount) {
      navigate(`/checkout?repayOrder=${repayOrderId}&amount=${repayAmount}`, {
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

      // Đặt phương thức thanh toán mặc định là Stripe cho trường hợp thanh toán lại đơn hàng để tận dụng form thanh toán tích hợp sẵn, có thể thay đổi sau nếu muốn hỗ trợ các phương thức khác
      // Nếu muốn giữ nguyên phương thức thanh toán cũ, có thể cần gọi API để lấy thông tin đơn hàng và thiết lập formData.paymentMethod tương ứng
      setFormData((prev) => ({
        ...prev,
        paymentMethod: 'stripe',
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
      dispatch(initializeCart());

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
    dispatch(initializeCart());

    // Kiểm tra nếu giỏ hàng trống cả ở localStorage và Redux store, đồng thời không phải đang thanh toán lại đơn hàng hoặc mua ngay, thì chuyển
    // Chỉ chuyển hướng nếu cả hai đều trống để tránh trường hợp dữ liệu chưa kịp cập nhật từ localStorage lên Redux store
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

  // Lấy số lượng giỏ hàng từ server để đảm bảo đồng bộ và tránh trường hợp người dùng có thể truy cập trang checkout với giỏ hàng trống do dữ liệu cũ chưa được xóa hoặc truy cập sai cách
  const { data: serverCartCount } = useGetCartCountQuery();

  // Dữ liệu khách hàng và thông tin tích điểm nếu người dùng đã đăng nhập để hiển thị phần sử dụng điểm tích lũy và các ưu đãi liên quan
  const { data: loyaltyData } = useGetLoyaltyInfoQuery(undefined, {
    skip: !user,
  });
  const availablePoints = loyaltyData?.data?.points || 0;

  // Địa chỉ đã lưu để tự động điền vào form khi người dùng chọn
  const { data: savedAddresses } = useGetAddressesQuery(undefined, {
    skip: !user,
  });
  const [pointsToUse, setPointsToUse] = useState<number>(0);
  const [pointsError, setPointsError] = useState('');

  // Các phương thức thanh toán được hỗ trợ, có thể dễ dàng mở rộng hoặc chỉnh sửa sau này, đồng thời sử dụng i18n để hỗ trợ đa ngôn ngữ
  const paymentMethods = [
    { value: 'cod', label: t('checkout.paymentMethod.cod') },
    { value: 'vnpay', label: t('checkout.paymentMethod.vnpay') },
    { value: 'momo', label: t('checkout.paymentMethod.momo') },
    { value: 'installment', label: t('checkout.paymentMethod.installment') },
  ];

  // Các phương thức vận chuyển được hỗ trợ, có thể dễ dàng mở rộng hoặc chỉnh sửa sau này, đồng thời sử dụng i18n để hỗ trợ đa ngôn ngữ
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
  const [currentOrder, setCurrentOrder] = useState<any>(null);
  const [isInstallmentModalOpen, setIsInstallmentModalOpen] = useState(false);

  // Đã xóa hook lấy danh sách tỉnh/thành

  // Trạng thái mã giảm giá
  const [discountCodeInput, setDiscountCodeInput] = useState('');
  const [appliedDiscount, setAppliedDiscount] = useState<{ code: string; amount: number } | null>(null);
  const [discountError, setDiscountError] = useState('');
  const [applyDiscountCode, { isLoading: isValidatingCode }] = useApplyDiscountCodeMutation();

  // Cột bảng trả góp
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

  // Mở modal khi chọn thanh toán trả góp
  useEffect(() => {
    if (formData.paymentMethod === 'installment') {
      setIsInstallmentModalOpen(true);
    }
  }, [formData.paymentMethod]);

  // Danh sách quốc gia
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

  // Tính tổng phí bảo hành
  const warrantyTotal = items.reduce((sum: number, item: any) => {
    const itemWarrantyPrice = item.warrantyPackages?.reduce((wSum: number, pkg: any) => wSum + pkg.price, 0) || 0;
    return sum + (itemWarrantyPrice * item.quantity);
  }, 0);

  // Tính phí vận chuyển tự động theo khoảng cách tuyến tính sử dụng API LocationIQ
  let shippingCost = 0;
  let finalDistance = 0;

  if (formData.address) {
    const lat = formData.lat;
    const lon = formData.lon;
    
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
        if (distanceInKm <= 3) return 15000; // 3km đầu tiên dùng giá 15k
        const fee = 15000 + Math.ceil(distanceInKm - 3) * 5000; // km thứ 4 trở đi cộng thêm 5k/km
        return Math.min(fee, 100000); // max 100k
      };

      // Tọa độ gốc của hàng: 144 Đ. Xuân Thủy, Cầu Giấy, HN (21.0378, 105.7827)
      finalDistance = calculateDistance(21.0378, 105.7827, Number(lat), Number(lon));
      shippingCost = calculateShippingFee(finalDistance);
    }
  }

  const tax = 0; // Thuế 0% - không áp dụng thuế theo yêu cầu
  const discountAmount = appliedDiscount ? appliedDiscount.amount : 0;
  
  // Tính giảm giá theo điểm (1 điểm = 1.000 VND)
  const pointsDiscount = pointsToUse * 1000;
  
  const total = subtotal + warrantyTotal + shippingCost + tax - discountAmount - pointsDiscount;

  // Xử lý thay đổi input trong form
  const handleInputChange = (name: string, value: string) => {
    setFormData((prev) => {
      const updated = { ...prev, [name]: value };

      // Tự động điền các trường phụ để vượt qua validation phía backend
      if (name === 'address') {
        const parts = value.split(',');
        // Dùng chuỗi rỗng thay vì t() — giá trị dịch sẽ gây backend validation fail khi ngôn ngữ EN
        updated.state = parts.length > 2 ? parts[parts.length - 2].trim() : '';
        updated.city = parts.length > 3 ? parts[parts.length - 3].trim() : '';
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

  // Xử lý checkbox "giống địa chỉ giao hàng"
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

  // Validate form đầu vào
  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    // Các trường bắt buộc
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

    // Kiểm tra định dạng email
    if (formData.email && !/\S+@\S+\.\S+/.test(formData.email)) {
      newErrors.email = t('checkout.validation.emailInvalid');
    }

    // Kiểm tra định dạng số điện thoại VN: 0XXXXXXXXX hoặc +84XXXXXXXXX
    if (formData.phone && !/^(0|\+84)[0-9]{9}$/.test(formData.phone.trim())) {
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
        // shippingCost KHÔNG gửi lên backend — backend tự tính theo Phase 7.3
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
      console.error('Tạo đơn hàng thất bại:', error);
      dispatch(
        addNotification({
          type: 'error',
          message: t('checkout.errors.orderCreationFailed'),
          duration: 5000,
        })
      );
      return null;
    } finally {
      setIsProcessing(false); // Tắt trạng thái loading
    }
  };

  // Xử lý thanh toán thành công
  const handlePaymentSuccess = async (paymentIntent: any) => {
    dispatch(
      addNotification({
        type: 'success',
        message: t('checkout.success.message'),
        duration: 5000,
      })
    );

    // Xóa giỏ hàng
    dispatch(clearCart());

    // Làm mới số lượng giỏ hàng để cập nhật badge trên header
    dispatch(cartApi.util.invalidateTags(['CartCount']));

    // Chuyển hướng đến trang đơn hàng
    navigate('/orders');
  };

  // Xử lý lỗi thanh toán
  const handlePaymentError = (error: string) => {
    dispatch(
      addNotification({
        type: 'error',
        message: error,
        duration: 5000,
      })
    );
  };

  // Xử lý trạng thái đang thanh toán
  const handlePaymentProcessing = (processing: boolean) => {
    setIsProcessing(processing);
  };

  // Tạo đơn hàng cho thanh toán Stripe
  const handleStripeOrderCreation = async () => {
    const order = await handleCreateOrder();
    if (order) {
      setCurrentOrder(order);
    }
  };

  // Xử lý submit form cho tất cả các phương thức thanh toán
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (formData.paymentMethod === 'stripe') {
      // Với Stripe, tạo đơn hàng trước rồi hiển thị form thanh toán
      await handleStripeOrderCreation();
      return;
    }

    if (formData.paymentMethod === 'bank_transfer') {
      // Với chuyển khoản ngân hàng, tạo đơn hàng và chuyển hướng đến trang thanh toán QR
      const order = await handleCreateOrder();
      if (order) {
        dispatch(clearCart());
        dispatch(cartApi.util.invalidateTags(['CartCount']));

        // Chuyển hướng đến trang thanh toán QR kèm thông tin đơn hàng
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
          console.error('Tạo URL thanh toán VNPay thất bại', error);
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
          console.error('Tạo URL thanh toán MoMo thất bại', error);
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

    // Với các phương thức thanh toán khác, tạo đơn hàng và chuyển hướng
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

      // Làm mới số lượng giỏ hàng để cập nhật badge trên header
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
        {/* Cột trái - Các form */}
        <div className="space-y-8">
          {/* Shipping Information - Ẩn khi thanh toán lại */}
          {!isRepayingOrder && (
            <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100 mb-6">
                {t('checkout.shippingInfo.title')}
              </h2>

              {/* Chọn địa chỉ đã lưu để tự động điền vào form */}
              {savedAddresses && savedAddresses.length > 0 && (
                <div className="mb-6">
                  <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                    {t('checkout.shippingInfo.savedAddresses')}
                  </label>
                  <select
                    className="w-full px-4 py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none"
                    defaultValue=""
                    onChange={(e) => {
                      const addrId = e.target.value;
                      if (!addrId) return;
                      const addr = savedAddresses.find((a: Address) => a.id === addrId);
                      if (!addr) return;
                      // Tự động điền form từ địa chỉ đã chọn
                      setFormData(prev => ({
                        ...prev,
                        firstName: addr.firstName || prev.firstName,
                        lastName: addr.lastName || prev.lastName,
                        phone: addr.phone || prev.phone,
                        address: addr.address1 + (addr.address2 ? `, ${addr.address2}` : ''),
                      }));
                    }}
                  >
                    <option value="">{t('checkout.shippingInfo.selectSaved')}</option>
                    {savedAddresses.map((addr: Address) => (
                      <option key={addr.id} value={addr.id}>
                        {addr.isDefault ? `★ ` : ''}{addr.name ? `${addr.name}: ` : ''}{addr.firstName} {addr.lastName} — {addr.address1}, {addr.city}
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">{t('checkout.shippingInfo.orEnterNew')}</p>
                </div>
              )}

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
                  autoComplete="email"
                  value={formData.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  error={errors.email}
                  required
                />
                <Input
                  label={t('checkout.shippingInfo.phone')}
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
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

          {/* Đã xóa phương thức giao hàng tính theo yêu cầu, phí giao hàng được tính tự động. */}

          {/* Chọn phương thức thanh toán */}
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

            {/* Modal thông tin trả góp */}
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

          {/* Ghi chú đơn hàng */}
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

        {/* Cột phải - Tóm tắt đơn hàng */}
        <div className="space-y-6">
          {/* Tóm tắt đơn hàng */}
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6 sticky top-4">
            <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100 mb-6">
              {t('checkout.orderSummary.title')}
            </h2>

            {/* Sản phẩm trong giỏ hoặc đơn hàng thanh toán lại */}
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

            {/* Phần mã giảm giá */}
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

            {/* Phần điểm tích lũy */}
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

            {/* Tổng cộng */}
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

            {/* Nút tương ứng với từng phương thức thanh toán */}
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

            {/* Form thanh toán Stripe (hiển thị sau khi tạo đơn hàng) */}
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

            {/* Phần thanh toán QR chuyển khoản (hiển thị sau khi tạo đơn hàng) - Chuyển hướng đến trang QR */}
            {formData.paymentMethod === 'bank_transfer' && currentOrder && (
              <div className="mt-6">
                {/* Tự động chuyển hướng đến trang thanh toán QR */}
                <div className="text-center py-4">
                  <p className="text-lg text-neutral-700 dark:text-neutral-300">
                    {t('checkout.redirectingToPayment')}
                  </p>

                </div>
              </div>
            )}

            {/* Thông báo bảo mật */}
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

