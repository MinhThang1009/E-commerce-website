/**
 * @file FeedbackModal.tsx
 * @layer Component
 * @feature shared
 * @description Shared UI component
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  Button,
  Input,
  Label,
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui';
import { useSendFeedbackMutation } from '@/features/content';
import { getErrorMsg } from '@/utils/error-utils';
import { useUiStore } from '@/stores/ui-store';

interface FeedbackModalProps {
  visible: boolean;
  onClose: () => void;
}

interface FormErrors {
  name?: string;
  email?: string;
  phone?: string;
  subject?: string;
  content?: string;
}

const INITIAL_FORM = { name: '', email: '', phone: '', subject: 'Support', content: '' };

const FeedbackModal: React.FC<FeedbackModalProps> = ({ visible, onClose }) => {
  const { t } = useTranslation();
  const { mutateAsync: sendFeedback, isPending: isLoading } = useSendFeedbackMutation();
  const addNotification = useUiStore((s) => s.addNotification);

  const [formData, setFormData] = useState(INITIAL_FORM);
  const [errors, setErrors] = useState<FormErrors>({});

  const validate = (): boolean => {
    const newErrors: FormErrors = {};
    if (!formData.name.trim()) newErrors.name = t('feedback.form.nameRequired');
    if (!formData.email.trim()) {
      newErrors.email = t('feedback.form.emailRequired');
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = t('feedback.form.emailInvalid');
    }
    if (formData.phone && !/^(0|\+84)[0-9]{9}$/.test(formData.phone)) {
      newErrors.phone = t('validation.phone.invalid');
    }
    if (!formData.subject) newErrors.subject = t('feedback.form.subjectRequired');
    if (!formData.content.trim()) newErrors.content = t('feedback.form.contentRequired');
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;
    try {
      await sendFeedback(formData);
      addNotification({ message: t('feedback.successMessage'), type: 'success' });
      setFormData(INITIAL_FORM);
      setErrors({});
      onClose();
    } catch (error) {
      addNotification({ message: getErrorMsg(error, t('feedback.errorMessage')), type: 'error' });
    }
  };

  const updateField = (field: keyof typeof formData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  return (
    <Dialog open={visible} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-[600px]">
        <DialogHeader>
          <DialogTitle>{t('feedback.title')}</DialogTitle>
          <DialogDescription className="sr-only">{t('feedback.title')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="feedback-name">{t('feedback.form.name')}</Label>
              <Input
                id="feedback-name"
                placeholder={t('feedback.form.namePlaceholder')}
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
              />
              {errors.name && <p className="text-xs text-red-500">{errors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="feedback-email">{t('feedback.form.email')}</Label>
              <Input
                id="feedback-email"
                type="email"
                placeholder={t('feedback.form.emailPlaceholder')}
                value={formData.email}
                onChange={(e) => updateField('email', e.target.value)}
              />
              {errors.email && <p className="text-xs text-red-500">{errors.email}</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="feedback-phone">{t('feedback.form.phone')}</Label>
              <Input
                id="feedback-phone"
                placeholder={t('feedback.form.phonePlaceholder')}
                maxLength={10}
                inputMode="numeric"
                value={formData.phone}
                onChange={(e) => updateField('phone', e.target.value)}
              />
              {errors.phone && <p className="text-xs text-red-500">{errors.phone}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>{t('feedback.form.subject')}</Label>
              <Select value={formData.subject} onValueChange={(v) => updateField('subject', v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Support">{t('feedback.form.subjects.support')}</SelectItem>
                  <SelectItem value="Sales">{t('feedback.form.subjects.sales')}</SelectItem>
                  <SelectItem value="Complaint">{t('feedback.form.subjects.complaint')}</SelectItem>
                  <SelectItem value="Suggestion">
                    {t('feedback.form.subjects.suggestion')}
                  </SelectItem>
                  <SelectItem value="Other">{t('feedback.form.subjects.other')}</SelectItem>
                </SelectContent>
              </Select>
              {errors.subject && <p className="text-xs text-red-500">{errors.subject}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="feedback-content">{t('feedback.form.content')}</Label>
            <textarea
              id="feedback-content"
              rows={5}
              placeholder={t('feedback.form.contentPlaceholder')}
              value={formData.content}
              onChange={(e) => updateField('content', e.target.value)}
              className="flex w-full rounded-xl border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 shadow-sm transition-colors placeholder:text-neutral-400 dark:placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/30 focus-visible:border-primary-500 disabled:cursor-not-allowed disabled:opacity-50 resize-none"
            />
            {errors.content && <p className="text-xs text-red-500">{errors.content}</p>}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? t('feedback.submit') + '...' : t('feedback.submit')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default FeedbackModal;
