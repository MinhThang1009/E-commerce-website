import React, { useState, useEffect } from 'react';
import { Typography } from 'antd';
import { simpleNamingService } from '../utils/productNaming';

const { Title } = Typography;

interface SimpleDynamicTitleProps {
  baseName: string;
  selectedAttributes: Record<string, string>;
  level?: 1 | 2 | 3 | 4 | 5;
  showAddedParts?: boolean;
  onNameChange?: (newName: string) => void;
  style?: React.CSSProperties;
}

const SimpleDynamicTitle: React.FC<SimpleDynamicTitleProps> = ({
  baseName,
  selectedAttributes,
  level = 1,
  showAddedParts: _showAddedParts = true,
  onNameChange,
  style,
}) => {
  const [currentName, setCurrentName] = useState<string>(baseName);
  const [_addedParts, setAddedParts] = useState<string[]>([]);
  const [_hasChanges, setHasChanges] = useState(false);

  // Cập nhật tên khi thuộc tính thay đổi
  useEffect(() => {
    const result = simpleNamingService.generateName({
      baseName,
      selectedAttributes,
    });

    setCurrentName(result.generatedName);
    setAddedParts(result.addedParts);
    setHasChanges(result.hasChanges);

    // Thông báo cho component cha nếu có callback
    if (onNameChange) {
      onNameChange(result.generatedName);
    }
  }, [baseName, selectedAttributes, onNameChange]);

  const _resetToBaseName = () => {
    setCurrentName(baseName);
    setAddedParts([]);
    setHasChanges(false);
    if (onNameChange) {
      onNameChange(baseName);
    }
  };

  return (
    <div style={style}>
      <Title
        level={level}
        style={{
          margin: 0,
          transition: 'all 0.3s ease',
        }}
        className='dark:text-white'
      >
        {currentName}
      </Title>
    </div>
  );
};

export default SimpleDynamicTitle;
