/**
 * @file ProductFAQForm.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React from 'react';
import { UseFormReturn } from 'react-hook-form';
import { MinusCircle, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

interface FAQ {
  question: string;
  answer: string;
}

interface ProductFAQFormProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
}

const ProductFAQForm: React.FC<ProductFAQFormProps> = ({ form }) => {
  const { t } = useTranslation();
  const faqs: FAQ[] = form.watch('faqs') || [];

  const addFaq = () => {
    form.setValue('faqs', [...faqs, { question: '', answer: '' }]);
  };

  const removeFaq = (index: number) => {
    const updated = faqs.filter((_, i) => i !== index);
    form.setValue('faqs', updated);
  };

  const updateFaq = (index: number, field: keyof FAQ, value: string) => {
    const updated = faqs.map((faq, i) => (i === index ? { ...faq, [field]: value } : faq));
    form.setValue('faqs', updated);
  };

  return (
    <div className="p-4">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('admin.products.faq.title')}</CardTitle>
          <CardDescription className="text-xs">{t('admin.products.faq.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="mb-6 p-4 border border-gray-100 dark:border-gray-800 rounded-lg bg-gray-50 dark:bg-gray-900/50 relative"
            >
              <div className="flex flex-col gap-3 w-full">
                <div>
                  <Label className="mb-1.5 block">{t('admin.products.faq.questionLabel')}</Label>
                  <Input
                    placeholder={t('admin.products.faq.questionPlaceholder')}
                    value={faq.question}
                    onChange={(e) => updateFaq(index, 'question', e.target.value)}
                  />
                </div>
                <div>
                  <Label className="mb-1.5 block">{t('admin.products.faq.answerLabel')}</Label>
                  <textarea
                    className="flex w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 shadow-sm transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]/40 focus-visible:border-[var(--accent)] disabled:cursor-not-allowed disabled:opacity-50"
                    rows={3}
                    placeholder={t('admin.products.faq.answerPlaceholder')}
                    value={faq.answer}
                    onChange={(e) => updateFaq(index, 'answer', e.target.value)}
                  />
                </div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="absolute top-2 right-2 text-[var(--admin-error)] hover:opacity-80"
                onClick={() => removeFaq(index)}
              >
                <MinusCircle className="size-4" />
              </Button>
            </div>
          ))}
          <Button variant="outline" onClick={addFaq} className="w-full border-dashed">
            <Plus className="size-4" />
            {t('admin.products.faq.addButton')}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductFAQForm;
