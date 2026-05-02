import React from 'react';
import { Collapse } from 'antd';
import { PlusOutlined, MinusOutlined } from '@ant-design/icons';

const { Panel } = Collapse;

interface FAQ {
  question: string;
  answer: string;
}

interface ProductFAQSectionProps {
  faqs: FAQ[];
}

const ProductFAQSection: React.FC<ProductFAQSectionProps> = ({ faqs }) => {
  if (!faqs || faqs.length === 0) return null;

  return (
    <div className="mt-12 bg-white dark:bg-neutral-900 rounded-2xl p-6 md:p-8">
      <h2 className="text-2xl font-bold text-neutral-900 dark:text-white mb-6">
        Câu hỏi thường gặp
      </h2>
      
      <Collapse
        accordion
        expandIconPosition="end"
        ghost
        expandIcon={({ isActive }) => (
          isActive ? 
            <MinusOutlined className="text-neutral-500 text-sm" /> : 
            <PlusOutlined className="text-neutral-500 text-sm" />
        )}
        className="product-faq-collapse"
      >
        {faqs.map((faq, index) => (
          <Panel
            header={
              <span className="text-base font-semibold text-neutral-800 dark:text-neutral-200 hover:text-primary-600 transition-colors py-2 block pr-4">
                {faq.question}
              </span>
            }
            key={index}
            className="mb-3 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg border-0 overflow-hidden"
          >
            <div className="px-2 pb-4 text-neutral-600 dark:text-neutral-400 leading-relaxed whitespace-pre-line break-words">
              {faq.answer}
            </div>
          </Panel>
        ))}
      </Collapse>

      <style>{`
        .product-faq-collapse .ant-collapse-item {
          margin-bottom: 12px;
          border-radius: 8px;
        }
        .product-faq-collapse .ant-collapse-header {
          align-items: center !important;
          padding: 16px 20px !important;
        }
        .product-faq-collapse .ant-collapse-content-box {
          padding: 0 20px 20px 20px !important;
        }
      `}</style>
    </div>
  );
};

export default ProductFAQSection;
