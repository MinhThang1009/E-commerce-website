/**
 * @file ProductFAQSection.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, Minus } from 'lucide-react';

interface FAQ {
  question: string;
  answer: string;
}

interface ProductFAQSectionProps {
  faqs: FAQ[];
}

const ProductFAQSection: React.FC<ProductFAQSectionProps> = ({ faqs }) => {
  const { t } = useTranslation();
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  if (!faqs || faqs.length === 0) return null;

  const toggle = (index: number) => {
    setActiveIndex((prev) => (prev === index ? null : index));
  };

  return (
    <div className="mt-12 bg-white dark:bg-neutral-900 rounded-2xl p-6 md:p-8">
      <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6">
        {t('product.faq')}
      </h2>

      <div className="space-y-3">
        {faqs.map((faq, index) => {
          const isActive = activeIndex === index;
          return (
            <div
              key={index}
              className="mb-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg overflow-hidden"
            >
              <button
                type="button"
                onClick={() => toggle(index)}
                className="w-full flex items-center justify-between py-4 px-5 text-left cursor-pointer"
              >
                <span className="text-base font-semibold text-neutral-800 dark:text-neutral-200 hover:text-primary-600 transition-colors pr-4">
                  {faq.question}
                </span>
                {isActive ? (
                  <Minus className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                ) : (
                  <Plus className="w-4 h-4 text-neutral-500 flex-shrink-0" />
                )}
              </button>
              <div
                className={`grid transition-all duration-300 ease-in-out ${
                  isActive ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
                }`}
              >
                <div className="overflow-hidden">
                  <div className="px-5 pb-5 text-neutral-600 dark:text-neutral-400 leading-relaxed whitespace-pre-line break-words">
                    {faq.answer}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default ProductFAQSection;
