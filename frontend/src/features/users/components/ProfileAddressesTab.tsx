/**
 * @file ProfileAddressesTab.tsx
 * @layer Component
 * @feature users
 * @description Tab quản lý địa chỉ giao hàng trong ProfilePage
 */
import { useTranslation } from 'react-i18next';
import Button from '@/components/common/Button';
import { Address } from '@/types/user.types';

interface AddressFormData {
  name: string;
  firstName: string;
  lastName: string;
  phone: string;
  address1: string;
  address2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface ProfileAddressesTabProps {
  showAddressForm: boolean;
  editingAddressId: string | null;
  addressForm: AddressFormData;
  onAddressFormChange: (updater: (prev: AddressFormData) => AddressFormData) => void;
  onOpenAddAddress: () => void;
  onOpenEditAddress: (addr: Address) => void;
  onSaveAddress: (e: React.FormEvent) => void;
  onDeleteAddress: (id: string) => void;
  onSetDefault: (id: string) => void;
  onCancelForm: () => void;
  isAddingAddress: boolean;
  isUpdatingAddress: boolean;
  isLoadingAddresses: boolean;
  addressesData: Address[] | undefined;
}

const ProfileAddressesTab: React.FC<ProfileAddressesTabProps> = ({
  showAddressForm,
  editingAddressId,
  addressForm,
  onAddressFormChange,
  onOpenAddAddress,
  onSaveAddress,
  onDeleteAddress,
  onSetDefault,
  onOpenEditAddress,
  onCancelForm,
  isAddingAddress,
  isUpdatingAddress,
  isLoadingAddresses,
  addressesData,
}) => {
  const { t } = useTranslation();

  const inputClass =
    'w-full px-4 py-2.5 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 text-sm focus:ring-2 focus:ring-primary-500/20 focus:border-primary-500 outline-none';

  return (
    <div className="bg-white dark:bg-neutral-900 rounded-2xl shadow-sm border border-neutral-100 dark:border-neutral-800 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-white">
            {t('profile.addresses.title')}
          </h2>
          <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t('profile.addresses.subtitle')}
          </p>
        </div>
        {!showAddressForm && (
          <Button variant="primary" size="sm" onClick={onOpenAddAddress}>
            {t('profile.addresses.addNew')}
          </Button>
        )}
      </div>

      {showAddressForm && (
        <form
          onSubmit={onSaveAddress}
          className="mb-8 p-5 bg-neutral-50 dark:bg-neutral-800 rounded-xl border border-neutral-200 dark:border-neutral-700"
        >
          <h3 className="text-base font-semibold text-neutral-800 dark:text-neutral-100 mb-5">
            {editingAddressId ? t('profile.addresses.editTitle') : t('profile.addresses.addTitle')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('profile.addresses.labelName')}
              </label>
              <input
                value={addressForm.name}
                onChange={(e) => onAddressFormChange((p) => ({ ...p, name: e.target.value }))}
                placeholder={t('profile.addresses.labelName')}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('profile.addresses.labelFirstName')} *
              </label>
              <input
                required
                value={addressForm.firstName}
                onChange={(e) => onAddressFormChange((p) => ({ ...p, firstName: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('profile.addresses.labelLastName')} *
              </label>
              <input
                required
                value={addressForm.lastName}
                onChange={(e) => onAddressFormChange((p) => ({ ...p, lastName: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('profile.addresses.labelPhone')}
              </label>
              <input
                type="tel"
                inputMode="numeric"
                maxLength={10}
                value={addressForm.phone}
                onChange={(e) =>
                  onAddressFormChange((p) => ({
                    ...p,
                    phone: e.target.value.replace(/[^0-9]/g, ''),
                  }))
                }
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('profile.addresses.labelCity')} *
              </label>
              <input
                required
                value={addressForm.city}
                onChange={(e) => onAddressFormChange((p) => ({ ...p, city: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('profile.addresses.labelAddress')} *
              </label>
              <input
                required
                value={addressForm.address1}
                onChange={(e) => onAddressFormChange((p) => ({ ...p, address1: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('profile.addresses.labelState')}
              </label>
              <input
                value={addressForm.state}
                onChange={(e) => onAddressFormChange((p) => ({ ...p, state: e.target.value }))}
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t('profile.addresses.labelZip')}
              </label>
              <input
                value={addressForm.zip}
                onChange={(e) => onAddressFormChange((p) => ({ ...p, zip: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-5 pt-4 border-t border-neutral-200 dark:border-neutral-700">
            <button
              type="button"
              onClick={onCancelForm}
              className="px-4 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 text-sm font-medium hover:bg-neutral-50 dark:hover:bg-neutral-800 transition-colors"
            >
              {t('profile.addresses.cancel')}
            </button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={isAddingAddress || isUpdatingAddress}
              isLoading={isAddingAddress || isUpdatingAddress}
            >
              {t('profile.addresses.saveBtn')}
            </Button>
          </div>
        </form>
      )}

      {isLoadingAddresses ? (
        <div className="py-8 flex justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-200 border-t-primary-600" />
        </div>
      ) : !addressesData || addressesData.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-neutral-100 dark:bg-neutral-800 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <svg
              className="w-8 h-8 text-neutral-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
          <p className="text-neutral-500 dark:text-neutral-400 mb-1">
            {t('profile.addresses.empty')}
          </p>
          <p className="text-neutral-400 dark:text-neutral-500 text-xs">
            {t('profile.addresses.emptyHint')}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {addressesData.map((addr: Address) => (
            <div
              key={addr.id}
              className={`relative p-4 rounded-xl border transition-colors ${
                addr.isDefault
                  ? 'border-primary-400 dark:border-primary-600 bg-primary-50 dark:bg-primary-900/10'
                  : 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/50'
              }`}
            >
              {addr.isDefault && (
                <span className="absolute top-3 right-3 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300">
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {t('profile.addresses.labelDefault')}
                </span>
              )}
              {addr.name && (
                <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500 mb-1">
                  {addr.name}
                </p>
              )}
              <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                {addr.firstName} {addr.lastName}
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-0.5">
                {addr.address1}
                {addr.address2 ? `, ${addr.address2}` : ''}
              </p>
              <p className="text-sm text-neutral-600 dark:text-neutral-400">
                {[addr.city, addr.state, addr.zip, addr.country].filter(Boolean).join(', ')}
              </p>
              {addr.phone && (
                <p className="text-sm text-neutral-500 dark:text-neutral-500 mt-0.5">
                  {addr.phone}
                </p>
              )}
              <div className="flex gap-3 mt-3 pt-3 border-t border-neutral-100 dark:border-neutral-700">
                {!addr.isDefault && (
                  <button
                    onClick={() => onSetDefault(addr.id)}
                    className="text-xs text-primary-600 dark:text-primary-400 hover:underline font-medium"
                  >
                    {t('profile.addresses.setDefault')}
                  </button>
                )}
                <button
                  onClick={() => onOpenEditAddress(addr)}
                  className="text-xs text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white font-medium"
                >
                  {t('profile.addresses.edit')}
                </button>
                <button
                  onClick={() => onDeleteAddress(addr.id)}
                  className="text-xs text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 font-medium"
                >
                  {t('profile.addresses.delete')}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ProfileAddressesTab;
