/**
 * @file FormActions.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React from 'react';
import { Save, Loader2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';

interface FormActionsProps {
  isFormValid: boolean;
  isSubmitting: boolean;
  submitText: string;
  loadingText: string;
  onCancel: () => void;
  visible?: boolean; // Thm prop  kim sot hin th
}

const FormActions: React.FC<FormActionsProps> = ({
  isFormValid: _isFormValid,
  isSubmitting,
  submitText,
  loadingText,
  onCancel,
  visible = true,
}) => {
  const { t } = useTranslation();

  if (!visible) {
    return null;
  }

  return (
    <div className="text-right">
      <div className="inline-flex items-center gap-2">
        <Button variant="outline" size="lg" onClick={onCancel} className="min-w-[120px]">
          {t('common.cancel')}
        </Button>
        <Button type="submit" size="lg" disabled={isSubmitting} className="min-w-[150px]">
          {isSubmitting ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {isSubmitting ? loadingText : submitText}
        </Button>
      </div>
    </div>
  );
};

export default FormActions;
