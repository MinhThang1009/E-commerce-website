/**
 * @file TabNavigation.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Space, Alert } from 'antd';
import { ArrowRightOutlined, ArrowLeftOutlined, SaveOutlined } from '@ant-design/icons';

// Các step BẮT BUỘC phải điền (còn lại là tùy chọn)
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
    // Force fresh validation nếu có validateForm prop
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
        <div style={{ marginTop: 24, textAlign: 'right' }}>
          <Alert
            message={t('product.allStepsComplete')}
            description={t('product.canCreateNow')}
            type="success"
            showIcon
            style={{ marginBottom: 16 }}
          />
          <Space>
            {prevTab && (
              <Button onClick={handlePrev} icon={<ArrowLeftOutlined />} size="large">
                {t('common.back')}
              </Button>
            )}
            <Button
              type="primary"
              onClick={onSubmit}
              icon={<SaveOutlined />}
              size="large"
              loading={isSubmitting}
              disabled={isSubmitting}
              style={{ minWidth: 150 }}
            >
              {isSubmitting ? resolvedLoadingText : resolvedSubmitText}
            </Button>
          </Space>
        </div>
      );
    }
    return null;
  }

  const isCurrentStepCompleted = completedSteps[activeTab] || false;
  const isRequiredStep = REQUIRED_STEPS.includes(activeTab);
  const isOptionalStep = !isRequiredStep;

  const alertType = isCurrentStepCompleted ? 'success' : isOptionalStep ? 'info' : 'info';
  const alertMessage = isCurrentStepCompleted
    ? t('product.stepComplete')
    : isOptionalStep
      ? t('product.optionalStep') || 'Bước này không bắt buộc'
      : t('product.completeStepFirst');
  const alertDesc = isCurrentStepCompleted
    ? t('product.canContinueStep')
    : isOptionalStep
      ? t('product.optionalStepDesc') || 'Bạn có thể bỏ qua hoặc điền thêm thông tin.'
      : t('product.fillRequiredFirst');

  return (
    <div style={{ marginTop: 24, textAlign: 'right' }}>
      <Alert
        message={alertMessage}
        description={alertDesc}
        type={alertType}
        showIcon
        style={{ marginBottom: 16 }}
      />
      <Space>
        {prevTab && (
          <Button onClick={handlePrev} icon={<ArrowLeftOutlined />} size="large">
            {t('common.back')}
          </Button>
        )}
        <Button type="primary" onClick={handleNext} icon={<ArrowRightOutlined />} size="large">
          {t('common.nextStep')}
        </Button>
      </Space>
    </div>
  );
};

export default TabNavigation;
