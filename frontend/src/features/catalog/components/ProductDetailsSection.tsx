/**
 * @file ProductDetailsSection.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import DOMPurify from 'dompurify';
import { Card, Button, Modal } from 'antd';
import { CaretDownOutlined, CloseOutlined } from '@ant-design/icons';
import '@/styles/product-description.css';

interface Specification {
  name: string;
  value: string;
  valueEn?: string;
}

const getSpecValue = (spec: Specification, lang: string): string => {
  if (lang === 'en') return spec.valueEn || spec.value;
  return spec.value;
};

interface ProductDetailsSectionProps {
  description: string;
  specifications: Specification[];
}

const ProductDetailsSection: React.FC<ProductDetailsSectionProps> = ({
  description,
  specifications,
}) => {
  const { t, i18n } = useTranslation();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSpecModalOpen, setIsSpecModalOpen] = useState(false);

  const cleanDescription = DOMPurify.sanitize(
    description
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&amp;/g, '&')
      .replace(/&nbsp;/g, ' ')
      .replace(/http:\/\/localhost:8888\/api\/uploads/g, 'http://localhost:8888/uploads'),
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-12">
      <div className="lg:col-span-2">
        <Card
          title={
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold text-gray-800 dark:text-neutral-200">📝</span>
              <span className="text-lg font-semibold text-gray-800 dark:text-neutral-200">
                {t('product.description')}
              </span>
            </div>
          }
          className="h-fit shadow-sm border-0"
          styles={{ body: { padding: '24px' } }}
        >
          <div className="relative">
            <div
              className="description-content overflow-hidden transition-all duration-300 relative"
              style={{ maxHeight: '500px' }}
              dangerouslySetInnerHTML={{ __html: cleanDescription }}
            />
            <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-white via-white/80 to-transparent flex items-end justify-center pb-4 pt-12 dark:from-[#141414] dark:via-[#141414]/80">
              <Button
                type="default"
                shape="round"
                size="large"
                icon={<CaretDownOutlined />}
                onClick={() => setIsModalOpen(true)}
                className="shadow-lg border-primary-500 text-primary-600 hover:text-primary-500 hover:border-primary-400 font-medium px-8 flex items-center bg-white dark:bg-neutral-800 dark:text-white dark:border-neutral-600"
              >
                {t('product.viewDescription')}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <div className="lg:col-span-1">
        <Card
          title={
            <div className="flex items-center space-x-2">
              <span className="text-xl font-bold text-gray-800 dark:text-neutral-200">⚙️</span>
              <span className="text-lg font-semibold text-gray-800 dark:text-neutral-200">
                {t('product.specifications')}
              </span>
            </div>
          }
          className="h-fit sticky top-16 sm:top-20 lg:top-24 shadow-sm hover:shadow-lg border-0 transition-all duration-300"
          styles={{ body: { padding: '16px' } }}
        >
          {specifications && specifications.length > 0 ? (
            <div className="relative">
              <div className="space-y-0 overflow-hidden relative" style={{ maxHeight: '500px' }}>
                {specifications.map((spec, index) => (
                  <div
                    key={index}
                    className={`
                      flex justify-between items-start py-4 px-4 border-b border-gray-100 dark:border-white/[0.06] last:border-b-0
                      ${index % 2 === 0 ? 'bg-neutral-50 dark:bg-[#181818]' : 'bg-white dark:bg-[#141414]'}
                      transition-colors hover:bg-primary-50/30 dark:hover:bg-primary-900/15
                    `}
                  >
                    <span className="text-sm font-semibold text-gray-700 dark:text-neutral-300 min-w-0 flex-shrink-0 mr-4">
                      {t(`product.specNames.${spec.name.toLowerCase()}`, {
                        defaultValue: spec.name,
                      })}
                    </span>
                    <span className="text-sm text-gray-900 dark:text-neutral-100 text-right break-words font-medium">
                      {getSpecValue(spec, i18n.language)}
                    </span>
                  </div>
                ))}
              </div>

              {specifications.length > 5 && (
                <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-white via-white/80 to-transparent flex items-end justify-center pb-4 pt-12 dark:from-[#141414] dark:via-[#141414]/80">
                  <Button
                    type="default"
                    shape="round"
                    size="large"
                    icon={<CaretDownOutlined />}
                    onClick={() => setIsSpecModalOpen(true)}
                    className="shadow-lg border-primary-500 text-primary-600 hover:text-primary-500 hover:border-primary-400 font-medium px-8 flex items-center bg-white dark:bg-neutral-800 dark:text-white dark:border-neutral-600"
                  >
                    {t('product.viewSpecs')}
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-neutral-400 py-12">
              <div className="text-5xl mb-4">📋</div>
              <p className="text-base font-medium text-gray-600 dark:text-neutral-300">
                {t('product.noSpecs')}
              </p>
              <p className="text-sm text-gray-400 dark:text-neutral-500 mt-2">
                {t('product.specsComingSoon')}
              </p>
            </div>
          )}
        </Card>
      </div>

      <Modal
        title={
          <div className="text-lg font-bold text-gray-800 dark:text-white pb-2 border-b dark:border-white/[0.06]">
            {t('product.detailsTitle')}
          </div>
        }
        open={isModalOpen}
        onCancel={() => setIsModalOpen(false)}
        footer={null}
        width={1000}
        style={{ top: 20 }}
        classNames={{
          body: 'max-h-[85vh] overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600',
          content: 'rounded-xl overflow-hidden p-0 dark:bg-[#141414]',
          header: 'mb-0 p-4 pb-0 bg-white dark:bg-[#141414] rounded-t-xl',
        }}
        closeIcon={
          <div className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-[#1f1f1f] transition-colors">
            <CloseOutlined className="text-gray-500 dark:text-neutral-400 text-lg" />
          </div>
        }
        centered
      >
        <div className="p-6 md:p-8">
          <div
            className="description-content max-w-none"
            dangerouslySetInnerHTML={{ __html: cleanDescription }}
          />
        </div>
      </Modal>

      <Modal
        title={
          <div className="text-lg font-bold text-gray-800 dark:text-white pb-2 border-b dark:border-white/[0.06]">
            {t('product.specifications')}
          </div>
        }
        open={isSpecModalOpen}
        onCancel={() => setIsSpecModalOpen(false)}
        footer={null}
        width={800}
        style={{ top: 20 }}
        classNames={{
          body: 'max-h-[85vh] overflow-y-auto p-0 scrollbar-thin scrollbar-thumb-gray-300 dark:scrollbar-thumb-gray-600',
          content: 'rounded-xl overflow-hidden p-0 dark:bg-[#141414]',
          header: 'mb-0 p-4 pb-0 bg-white dark:bg-[#141414] rounded-t-xl',
        }}
        closeIcon={
          <div className="p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-[#1f1f1f] transition-colors">
            <CloseOutlined className="text-gray-500 dark:text-neutral-400 text-lg" />
          </div>
        }
        centered
      >
        <div className="p-6">
          {specifications && specifications.length > 0 ? (
            <div className="space-y-0 border rounded-lg overflow-hidden dark:border-white/[0.06]">
              {specifications.map((spec, index) => (
                <div
                  key={index}
                  className={`
                    flex justify-between items-center py-4 px-6 border-b border-gray-100 dark:border-white/[0.06] last:border-b-0
                    ${index % 2 === 0 ? 'bg-neutral-50 dark:bg-[#181818]' : 'bg-white dark:bg-[#141414]'}
                    hover:bg-primary-50/30 dark:hover:bg-primary-900/15 transition-colors
                  `}
                >
                  <span className="text-base font-semibold text-gray-700 dark:text-neutral-300 capitalize min-w-0 flex-shrink-0 mr-8 w-1/3">
                    {t(`product.specNames.${spec.name.toLowerCase()}`, { defaultValue: spec.name })}
                  </span>
                  <span className="text-base text-gray-900 dark:text-neutral-100 text-left break-words font-medium w-2/3">
                    {getSpecValue(spec, i18n.language)}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-gray-500 dark:text-neutral-400 py-12">
              {t('common.noData')}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};

export default ProductDetailsSection;
