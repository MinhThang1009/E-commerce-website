/**
 * @file CheckoutShippingForm.tsx
 * @layer Component
 * @feature checkout
 * @description Form thông tin giao hàng + chọn địa chỉ đã lưu
 */
import { useTranslation } from 'react-i18next';
import Input from '@/components/common/Input';
import AddressPicker from '@/components/common/AddressPicker';
import { Address } from '@/types/user.types';

interface CheckoutShippingFormProps {
  formData: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    address: string;
    sameAsShipping: boolean;
    [key: string]: unknown;
  };
  errors: Record<string, string>;
  savedAddresses: Address[] | undefined;
  onInputChange: (name: string, value: string) => void;
  onAddressChange: (
    val: string,
    lat?: string | number,
    lon?: string | number,
    detail?: { city?: string; state?: string; country?: string },
  ) => void;
}

const CheckoutShippingForm: React.FC<CheckoutShippingFormProps> = ({
  formData,
  errors,
  savedAddresses,
  onInputChange,
  onAddressChange,
}) => {
  const { t } = useTranslation();

  return (
    <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-sm p-6">
      <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-100 mb-6">
        {t('checkout.shippingInfo.title')}
      </h2>

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
              onInputChange('firstName', addr.firstName || formData.firstName);
              onInputChange('lastName', addr.lastName || formData.lastName);
              onInputChange('phone', addr.phone || formData.phone);
              onInputChange('address', addr.address1 + (addr.address2 ? `, ${addr.address2}` : ''));
            }}
          >
            <option value="">{t('checkout.shippingInfo.selectSaved')}</option>
            {savedAddresses.map((addr: Address) => (
              <option key={addr.id} value={addr.id}>
                {addr.isDefault ? `★ ` : ''}
                {addr.name ? `${addr.name}: ` : ''}
                {addr.firstName} {addr.lastName} — {addr.address1}, {addr.city}
              </option>
            ))}
          </select>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
            {t('checkout.shippingInfo.orEnterNew')}
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Input
          label={t('checkout.shippingInfo.firstName')}
          value={formData.firstName}
          onChange={(e) => onInputChange('firstName', e.target.value)}
          error={errors.firstName}
          required
        />
        <Input
          label={t('checkout.shippingInfo.lastName')}
          value={formData.lastName}
          onChange={(e) => onInputChange('lastName', e.target.value)}
          error={errors.lastName}
          required
        />
        <Input
          label={t('checkout.shippingInfo.email')}
          type="email"
          autoComplete="email"
          value={formData.email}
          onChange={(e) => onInputChange('email', e.target.value)}
          error={errors.email}
          required
        />
        <Input
          label={t('checkout.shippingInfo.phone')}
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          maxLength={10}
          value={formData.phone}
          onChange={(e) => onInputChange('phone', e.target.value.replace(/[^0-9]/g, ''))}
          error={errors.phone}
          required
        />
        <div className="md:col-span-2">
          <AddressPicker
            label={t('checkout.shippingInfo.address')}
            value={formData.address}
            onChange={onAddressChange}
            error={errors.address}
            required
          />
        </div>
      </div>
    </div>
  );
};

export default CheckoutShippingForm;
