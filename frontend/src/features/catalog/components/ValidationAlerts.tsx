/**
 * @file ValidationAlerts.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React from 'react';

interface ValidationAlertsProps {
  isFormValid: boolean;
  missingFields: string[];
}

const ValidationAlerts: React.FC<ValidationAlertsProps> = ({
  isFormValid: _isFormValid,
  missingFields: _missingFields,
}) => {
  // Không hiển thị bất kỳ thông báo nào
  return null;
};

export default ValidationAlerts;

