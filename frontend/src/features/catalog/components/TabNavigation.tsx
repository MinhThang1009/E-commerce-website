/**
 * @file TabNavigation.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { ArrowRight, ArrowLeft, Save, Loader2, CheckCircle, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

// Cc step BT BUC phi in (cn li l ty chn)
const REQUIRED_STEPS = ['basic', 'pricing', 'category'];

interface TabNavigationProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  tabOrder: string[];
  isLastTab?: boolean;
  completedSteps?: Record<string, boolean>;
  onSubmit?: () => void;
  isSubmitting?: boolean;
  submitText?: string;
  loadingText?: string;
  validateForm?: () => boolean;
}

const TabNavigation: React.FC<TabNavigationProps> = ({
  activeTab,
  setActiveTab,
  tabOrder,
  isLastTab = false,
  completedSteps = {},
  onSubmit,
  isSubmitting = false,
  submitText,
  loadingText,
  validateForm,
}) => {
  const { t } = useTranslation();
  const resolvedSubmitText = submitText ?? t('product.createProduct');
  const resolvedLoadingText = loadingText ?? t('product.creating');

  const currentIndex = tabOrder.indexOf(activeTab);
  const nextTab = currentIndex < tabOrder.length - 1 ? tabOrder[currentIndex + 1] : null;
  const prevTab = currentIndex > 0 ? tabOrder[currentIndex - 1] : null;

  const handleNext = () => {
    if (!nextTab) return;
    // Force fresh validation nu c validateForm prop
    const isValid = validateForm ? validateForm() : completedSteps[activeTab];
    if (isValid) {
      setActiveTab(nextTab);
    } else {
      alert(t('product.completeCurrentStep'));
    }
  };

  const handlePrev = () => {
    if (prevTab) {
      setActiveTab(prevTab);
    }
  };

  const allStepsCompleted = Object.values(completedSteps).every((step) => step);

  if (isLastTab || !nextTab) {
    if (isLastTab && allStepsCompleted && onSubmit) {
      return (
        <div className="mt-6 text-right">
          <Alert variant="success" className="mb-4 text-left">
            <CheckCircle className="size-4" />
            <AlertTitle>{t('product.allStepsComplete')}</AlertTitle>
            <AlertDescription>{t('product.canCreateNow')}</AlertDescription>
          </Alert>
          <div className="inline-flex items-center gap-2">
            {prevTab && (
              <Button variant="outline" size="lg" onClick={handlePrev}>
                <ArrowLeft className="size-4" />
                {t('common.back')}
              </Button>
            )}
            <Button size="lg" onClick={onSubmit} disabled={isSubmitting} className="min-w-[150px]">
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Save className="size-4" />
              )}
              {isSubmitting ? resolvedLoadingText : resolvedSubmitText}
            </Button>
          </div>
        </div>
      );
    }
    return null;
  }

  const isCurrentStepCompleted = completedSteps[activeTab] || false;
  const isRequiredStep = REQUIRED_STEPS.includes(activeTab);
  const isOptionalStep = !isRequiredStep;

  const alertVariant = isCurrentStepCompleted ? 'success' : 'info';
  const alertMessage = isCurrentStepCompleted
    ? t('product.stepComplete')
    : isOptionalStep
      ? t('product.optionalStep') || 'Bc ny khng bt buc'
      : t('product.completeStepFirst');
  const alertDesc = isCurrentStepCompleted
    ? t('product.canContinueStep')
    : isOptionalStep
      ? t('product.optionalStepDesc') || 'Bn c th b qua hoc in thm thng tin.'
      : t('product.fillRequiredFirst');

  const AlertIcon = isCurrentStepCompleted ? CheckCircle : Info;

  return (
    <div className="mt-6 text-right">
      <Alert variant={alertVariant} className="mb-4 text-left">
        <AlertIcon className="size-4" />
        <AlertTitle>{alertMessage}</AlertTitle>
        <AlertDescription>{alertDesc}</AlertDescription>
      </Alert>
      <div className="inline-flex items-center gap-2">
        {prevTab && (
          <Button variant="outline" size="lg" onClick={handlePrev}>
            <ArrowLeft className="size-4" />
            {t('common.back')}
          </Button>
        )}
        <Button size="lg" onClick={handleNext}>
          {t('common.nextStep')}
          <ArrowRight className="size-4" />
        </Button>
      </div>
    </div>
  );
};

export default TabNavigation;
