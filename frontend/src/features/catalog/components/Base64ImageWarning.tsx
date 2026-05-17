/**
 * @file Base64ImageWarning.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'antd';
import { InfoCircleOutlined } from '@ant-design/icons';
import { countBase64Images } from '@/utils/descriptionImageProcessor';

interface Base64ImageWarningProps {
  description: string;
  className?: string;
}

const Base64ImageWarning: React.FC<Base64ImageWarningProps> = ({
  description,
  className,
}) => {
  const { t } = useTranslation();
  const base64Count = countBase64Images(description);

  if (base64Count === 0) {
    return null;
  }

  return (
    <Alert
      message={t('base64Warning.title')}
      description={
        <div>
          <p>{t('base64Warning.found', { count: base64Count })}</p>
          <p>{t('base64Warning.autoConvert')}</p>
          <p>{t('base64Warning.recommendation')}</p>
        </div>
      }
      type="info"
      icon={<InfoCircleOutlined />}
      showIcon
      className={className}
      style={{
        marginBottom: '16px',
        border: '1px solid #1890ff',
        backgroundColor: '#f6ffed',
      }}
    />
  );
};

export default Base64ImageWarning;
