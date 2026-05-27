/**
 * @file CheckoutPaymentMethod.tsx
 * @layer Component
 * @feature checkout
 * @description Chọn phương thức thanh toán + modal trả góp
 */
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import {
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui';

interface PaymentMethod {
  value: string;
  label: string;
}

interface CheckoutPaymentMethodProps {
  paymentMethods: PaymentMethod[];
  selectedMethod: string;
  onMethodChange: (value: string) => void;
  isInstallmentModalOpen: boolean;
  onCloseInstallmentModal: () => void;
}

const CheckoutPaymentMethod: React.FC<CheckoutPaymentMethodProps> = ({
  paymentMethods,
  selectedMethod,
  onMethodChange,
  isInstallmentModalOpen,
  onCloseInstallmentModal,
}) => {
  const { t } = useTranslation();

  const mo = t('checkout.installment.monthsUnit');
  const installmentData = [
    { key: '1', bank: 'Techcombank', terms: `3, 6, 9, 12 ${mo}`, fee: '0%' },
    { key: '2', bank: 'VPBank', terms: `3, 6, 9, 12 ${mo}`, fee: '0%' },
    { key: '3', bank: 'Sacombank', terms: `6, 12 ${mo}`, fee: '0%' },
    { key: '4', bank: 'VIB', terms: `3, 6, 9, 12 ${mo}`, fee: '0%' },
    { key: '5', bank: 'HSBC', terms: `3, 6, 9, 12 ${mo}`, fee: '0%' },
    { key: '6', bank: 'TPBank', terms: `3, 6, 9, 12 ${mo}`, fee: '0%' },
  ];

  return (
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
              checked={selectedMethod === method.value}
              onChange={(e) => onMethodChange(e.target.value)}
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

      <Dialog
        open={isInstallmentModalOpen}
        onOpenChange={(open) => !open && onCloseInstallmentModal()}
      >
        <DialogContent className="max-w-[700px]">
          <DialogHeader>
            <DialogTitle className="flex items-center space-x-2 text-xl text-primary-600">
              <Info className="size-5" />
              <span>{t('checkout.installment.title')}</span>
            </DialogTitle>
            <DialogDescription className="sr-only">
              {t('checkout.installment.title')}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-100 dark:border-blue-800 text-blue-800 dark:text-blue-300">
              <h4 className="font-semibold mb-2">{t('checkout.installment.process')}</h4>
              <ol className="list-decimal list-inside space-y-1 text-sm">
                <li>{t('checkout.installment.step1')}</li>
                <li>{t('checkout.installment.step2')}</li>
                <li>{t('checkout.installment.step3')}</li>
              </ol>
            </div>

            <h4 className="font-semibold text-gray-700 dark:text-neutral-300 mt-4">
              {t('checkout.installment.bankList')}
            </h4>
            <table className="w-full text-sm border-collapse border border-neutral-200 dark:border-neutral-700">
              <thead>
                <tr className="bg-neutral-50 dark:bg-neutral-800">
                  <th className="border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-left font-medium">
                    {t('checkout.installment.bankColumn')}
                  </th>
                  <th className="border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-left font-medium">
                    {t('checkout.installment.termsColumn')}
                  </th>
                  <th className="border border-neutral-200 dark:border-neutral-700 px-3 py-2 text-left font-medium">
                    {t('checkout.installment.feeColumn')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {installmentData.map((row) => (
                  <tr key={row.key} className="hover:bg-neutral-50 dark:hover:bg-neutral-800/50">
                    <td className="border border-neutral-200 dark:border-neutral-700 px-3 py-2 font-medium">
                      {row.bank}
                    </td>
                    <td className="border border-neutral-200 dark:border-neutral-700 px-3 py-2">
                      {row.terms}
                    </td>
                    <td className="border border-neutral-200 dark:border-neutral-700 px-3 py-2">
                      <span className="text-green-600 font-medium">
                        {t('checkout.installment.freeLabel')}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <p className="text-xs text-gray-500 dark:text-neutral-400 italic mt-2">
              {t('checkout.installment.note')}
            </p>
          </div>

          <DialogFooter>
            <Button onClick={onCloseInstallmentModal}>
              {t('checkout.installment.understood')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CheckoutPaymentMethod;
