/**
 * @file AttributeModal.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React, { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { Save, X, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { formatAttributeKey } from '../utils/product-naming';

interface Attribute {
  id?: string;
  name: string;
  value?: string;
  values?: string[];
}

interface AttributeModalProps {
  open: boolean;
  onClose: () => void;
  attribute?: Attribute | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Caller passes different attribute types
  onSave: (attribute: any) => void;
}

const AttributeModal: React.FC<AttributeModalProps> = ({ open, onClose, attribute, onSave }) => {
  const { t } = useTranslation();
  const form = useForm<{ name: string; value: string }>({
    defaultValues: { name: '', value: '' },
  });

  useEffect(() => {
    if (attribute) {
      form.reset({
        name: formatAttributeKey(attribute.name || ''),
        value: Array.isArray(attribute.values)
          ? attribute.values.join(', ')
          : attribute.value || '',
      });
    } else {
      form.reset({ name: '', value: '' });
    }
  }, [attribute, form, open]);

  const handleSubmit = form.handleSubmit((values) => {
    const attributeData: Attribute = {
      id: attribute?.id,
      name: values.name.trim(),
      value: values.value.trim(),
    };

    const savedAttributes = JSON.parse(localStorage.getItem('debug_attributes') || '[]');
    savedAttributes.push(attributeData);
    localStorage.setItem('debug_attributes', JSON.stringify(savedAttributes));

    onSave(attributeData);
    handleClose();
  });

  const handleClose = () => {
    form.reset({ name: '', value: '' });
    onClose();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleClose();
      }}
    >
      <DialogContent className="max-w-[700px]">
        <DialogHeader>
          <DialogTitle>
            {attribute ? t('attrModal.editTitle') : t('attrModal.addTitle')}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div>
              <Label className="mb-1.5 block">
                {t('attrModal.nameLabel')}
                <span className="ml-1 text-xs text-neutral-500" title={t('attrModal.nameTooltip')}>
                  (?)
                </span>
              </Label>
              <Input
                placeholder={t('attrModal.namePlaceholder')}
                {...form.register('name', { required: t('attrModal.nameRequired') })}
              />
              {form.formState.errors.name?.message && (
                <p className="text-sm text-red-500 mt-1">
                  {String(form.formState.errors.name.message)}
                </p>
              )}
            </div>

            <div>
              <Label className="mb-1.5 block">
                {t('attrModal.valueLabel')}
                <span className="ml-1 text-xs text-neutral-500" title={t('attrModal.valueTooltip')}>
                  (?)
                </span>
              </Label>
              <textarea
                className="flex w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 shadow-sm transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:border-primary-500"
                rows={3}
                placeholder={t('attrModal.valuePlaceholder')}
                {...form.register('value', { required: t('attrModal.valueRequired') })}
              />
              {form.formState.errors.value?.message && (
                <p className="text-sm text-red-500 mt-1">
                  {String(form.formState.errors.value.message)}
                </p>
              )}
            </div>
          </div>

          <hr className="my-4 border-neutral-200 dark:border-neutral-700" />

          {/* Huong dan */}
          <Alert variant="info" className="mb-4">
            <Info className="size-4" />
            <AlertTitle>{t('attrModal.tipTitle')}</AlertTitle>
            <AlertDescription>
              <ul className="mb-0 pl-5 list-disc">
                <li>
                  <strong>{t('attrModal.tipNameLabel')}</strong> {t('attrModal.tipNameDesc')}
                </li>
                <li>
                  <strong>{t('attrModal.tipValueLabel')}</strong> {t('attrModal.tipValueDesc')}
                </li>
                <li>
                  <strong>{t('attrModal.tipCommaLabel')}</strong> {t('attrModal.tipCommaDesc')}
                </li>
                <li>{t('attrModal.tipUsage')}</li>
              </ul>
            </AlertDescription>
          </Alert>

          {/* Vi du minh hoa */}
          <Alert variant="success" className="mb-4">
            <AlertTitle>{t('attrModal.exampleTitle')}</AlertTitle>
            <AlertDescription>
              <div>
                <div>
                  <strong>{t('attrModal.exNameLabel')}</strong> &ldquo;{t('attrModal.ex1name')}
                  &rdquo; &rarr; <strong>{t('attrModal.exValueLabel')}</strong> &ldquo;
                  {t('attrModal.ex1value')}
                  &rdquo;
                </div>
                <div>
                  <strong>{t('attrModal.exNameLabel')}</strong> &ldquo;{t('attrModal.ex2name')}
                  &rdquo; &rarr; <strong>{t('attrModal.exValueLabel')}</strong> &ldquo;
                  {t('attrModal.ex2value')}
                  &rdquo;
                </div>
                <div>
                  <strong>{t('attrModal.exNameLabel')}</strong> &ldquo;{t('attrModal.ex3name')}
                  &rdquo; &rarr; <strong>{t('attrModal.exValueLabel')}</strong> &ldquo;
                  {t('attrModal.ex3value')}
                  &rdquo;
                </div>
              </div>
            </AlertDescription>
          </Alert>

          {/* Nut submit */}
          <div className="text-right">
            <div className="inline-flex items-center gap-2">
              <Button variant="outline" type="button" onClick={handleClose}>
                <X className="size-4" />
                {t('common.cancel')}
              </Button>
              <Button type="submit">
                <Save className="size-4" />
                {attribute ? t('attrModal.updateBtn') : t('attrModal.addBtn')}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AttributeModal;
