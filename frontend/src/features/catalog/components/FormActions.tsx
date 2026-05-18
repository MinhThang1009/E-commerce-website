/**
 * @file FormActions.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React from 'react';
import { Button, Space } from 'antd';
import { SaveOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';

interface FormActionsProps {
  isFormValid: boolean;
  isSubmitting: boolean;
  submitText: string;
  loadingText: string;
  onCancel: () => void;
  visible?: boolean; // Thêm prop để kiểm soát hiển thị
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
    <div style={{ textAlign: 'right' }}>
      <Space>
        <Button onClick={onCancel} size="large" style={{ minWidth: 120 }}>
          {t('common.cancel')}
        </Button>
        <Button
          type="primary"
          htmlType="submit"
          icon={<SaveOutlined />}
          size="large"
          loading={isSubmitting}
          disabled={isSubmitting}
          style={{
            minWidth: 150,
          }}
        >
          {isSubmitting ? loadingText : submitText}
        </Button>
      </Space>
    </div>
  );
};

export default FormActions;
