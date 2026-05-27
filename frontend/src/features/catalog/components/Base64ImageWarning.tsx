/**
 * @file Base64ImageWarning.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Info } from 'lucide-react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { cn } from '@/utils/cn';
import { countBase64Images } from '@/utils/description-image-processor';

interface Base64ImageWarningProps {
  description: string;
  className?: string;
}

const Base64ImageWarning: React.FC<Base64ImageWarningProps> = ({ description, className }) => {
  const { t } = useTranslation();
  const base64Count = countBase64Images(description);

  if (base64Count === 0) {
    return null;
  }

  return (
    <Alert variant="info" className={cn('mb-4', className)}>
      <Info className="h-4 w-4" />
      <AlertTitle>{t('base64Warning.title')}</AlertTitle>
      <AlertDescription>
        <p>{t('base64Warning.found', { count: base64Count })}</p>
        <p>{t('base64Warning.autoConvert')}</p>
        <p>{t('base64Warning.recommendation')}</p>
      </AlertDescription>
    </Alert>
  );
};

export default Base64ImageWarning;
