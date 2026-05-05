import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  SafetyOutlined,
  CheckCircleOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { WarrantyPackage } from '../types/product.types';
import { getLocale } from '@/utils/format';

interface WarrantySelectionProps {
  warrantyPackages: WarrantyPackage[];
  onWarrantyChange: (packageIds: string[]) => void;
  selectedPackages: string[];
}

const WarrantySelection: React.FC<WarrantySelectionProps> = ({
  warrantyPackages,
  onWarrantyChange,
  selectedPackages,
}) => {
  const { t } = useTranslation();
  const [expandedPackages, setExpandedPackages] = useState<string[]>([]);

  const formatPrice = (price: number) => {
    // Luôn dùng VND — dùng locale động để format dấu phân tách
    return `${price.toLocaleString(getLocale())}${t('common.currencySymbol')}`;
  };

  const togglePackage = (packageId: string) => {
    if (selectedPackages.includes(packageId)) {
      onWarrantyChange(selectedPackages.filter((id) => id !== packageId));
    } else {
      onWarrantyChange([...selectedPackages, packageId]);
    }
  };

  const toggleExpanded = (packageId: string) => {
    if (expandedPackages.includes(packageId)) {
      setExpandedPackages(expandedPackages.filter((id) => id !== packageId));
    } else {
      setExpandedPackages([...expandedPackages, packageId]);
    }
  };

  const calculateTotalWarrantyPrice = () => {
    return warrantyPackages
      .filter((pkg) => selectedPackages.includes(pkg.id))
      .reduce((total, pkg) => total + pkg.price, 0);
  };

  if (!warrantyPackages || warrantyPackages.length === 0) {
    return null;
  }

  return (
    <div className="mb-6 border border-neutral-200 dark:border-neutral-700 rounded-lg p-4">
      <div className="flex items-center mb-4">
        <SafetyOutlined className="text-primary-500 dark:text-primary-400 text-lg mr-2" />
        <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
          {t('product.warrantyTitle')}
        </h3>
      </div>

      <div className="space-y-3">
        {warrantyPackages.map((pkg) => (
          <div
            key={pkg.id}
            className={`border rounded-lg p-3 transition-all duration-200 ${
              selectedPackages.includes(pkg.id)
                ? 'border-primary-500 bg-primary-50 dark:border-primary-400 dark:bg-primary-900/20'
                : 'border-neutral-200 dark:border-neutral-700 hover:border-neutral-300 dark:hover:border-neutral-600'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-3 flex-1">
                <input
                  type="checkbox"
                  checked={selectedPackages.includes(pkg.id)}
                  onChange={() => togglePackage(pkg.id)}
                  className="mt-1 w-4 h-4 text-primary-600 bg-white border-neutral-300 rounded focus:ring-primary-500 dark:focus:ring-primary-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-neutral-800 dark:text-neutral-200">
                      {pkg.name}
                    </h4>
                    <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                      {pkg.price === 0 ? t('product.warrantyFree') : formatPrice(pkg.price)}
                    </span>
                  </div>

                  <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
                    {pkg.description}
                  </p>

                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      {t('product.warrantyDuration', { months: pkg.durationMonths })}
                    </span>
                  </div>

                  {pkg.coverage && pkg.coverage.length > 0 && (
                    <div className="mt-2">
                      <button
                        onClick={() => toggleExpanded(pkg.id)}
                        className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 flex items-center gap-1"
                      >
                        <InfoCircleOutlined />
                        {expandedPackages.includes(pkg.id)
                          ? t('product.warrantyCollapse')
                          : t('product.warrantyExpand')}
                      </button>

                      {expandedPackages.includes(pkg.id) && (
                        <div className="mt-2 space-y-1">
                          {pkg.coverage.map((item, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <CheckCircleOutlined className="text-green-500 text-xs" />
                              <span className="text-xs text-neutral-600 dark:text-neutral-400">
                                {item}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {calculateTotalWarrantyPrice() > 0 && (
        <div className="mt-4 pt-3 border-t border-neutral-200 dark:border-neutral-700">
          <div className="flex justify-between items-center">
            <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              {t('product.warrantyTotal')}
            </span>
            <span className="text-sm font-semibold text-primary-600 dark:text-primary-400">
              {formatPrice(calculateTotalWarrantyPrice())}
            </span>
          </div>
        </div>
      )}

      <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
        <div className="flex items-start gap-2">
          <InfoCircleOutlined className="text-blue-500 text-sm mt-0.5" />
          <p className="text-xs text-blue-700 dark:text-blue-300">
            {t('product.warrantyNote')}
          </p>
        </div>
      </div>
    </div>
  );
};

export default WarrantySelection;
