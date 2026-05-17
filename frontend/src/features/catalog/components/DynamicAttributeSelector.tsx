/**
 * @file DynamicAttributeSelector.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { getLocale } from '@/utils/format';
import {
  Form,
  Select,
  Row,
  Col,
  Card,
  Typography,
  Space,
  Tag,
  Alert,
  Skeleton,
  Button,
  Switch,
  Tooltip,
} from 'antd';
import {
  BulbOutlined,
  SettingOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { attributeService, AttributeValue, AttributeGroup as BaseAttributeGroup } from '../api/attributeApi';
import DynamicProductName from './DynamicProductName';

const { Option } = Select;
const { Text } = Typography;

interface AttributeGroup extends BaseAttributeGroup {
  values?: AttributeValue[];
}

interface DynamicAttributeSelectorProps {
  productId?: string;
  baseName?: string;
  onAttributeChange?: (
    attributeValues: Record<string, string>,
    affectingNameOnly: Record<string, string>
  ) => void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- AI response details
  onNameGenerated?: (name: string, details: any) => void;
  disabled?: boolean;
  showNamePreview?: boolean;
}

const DynamicAttributeSelector: React.FC<DynamicAttributeSelectorProps> = ({
  productId,
  baseName,
  onAttributeChange,
  onNameGenerated,
  disabled = false,
  showNamePreview = true,
}) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [attributeGroups, setAttributeGroups] = useState<AttributeGroup[]>([]);
  const [selectedAttributes, setSelectedAttributes] = useState<
    Record<string, string>
  >({});
  const [nameAffectingAttributes, setNameAffectingAttributes] = useState<
    AttributeValue[]
  >([]);
  const [showOnlyNameAffecting, setShowOnlyNameAffecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const _form = Form.useFormInstance();

  useEffect(() => {
    loadAttributeGroups();
    loadNameAffectingAttributes();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Tải dữ liệu một lần khi mount
  }, []);

  const loadAttributeGroups = async () => {
    try {
      setLoading(true);
      const response = await attributeService.getAttributeGroups();
      if (response.status === 'success') {
        setAttributeGroups(response.data);
      }
    } catch (err) {
      setError(t('attr.loadError'));
      console.error('Lỗi tải nhóm thuộc tính:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadNameAffectingAttributes = async () => {
    try {
      const response =
        await attributeService.getNameAffectingAttributes(productId);
      if (response.status === 'success') {
        setNameAffectingAttributes(response.data);
      }
    } catch (err) {
      console.error('Lỗi tải thuộc tính ảnh hưởng đến tên:', err);
    }
  };

  const handleAttributeChange = (groupId: string, valueId: string) => {
    const newSelectedAttributes = {
      ...selectedAttributes,
      [groupId]: valueId,
    };

    setSelectedAttributes(newSelectedAttributes);

    const affectingNameOnly: Record<string, string> = {};
    Object.entries(newSelectedAttributes).forEach(([gId, vId]) => {
      if (vId) {
        const isAffectingName = nameAffectingAttributes.some(
          (attr) => attr.id === vId
        );
        if (isAffectingName) {
          affectingNameOnly[gId] = vId;
        }
      }
    });

    if (onAttributeChange) {
      onAttributeChange(newSelectedAttributes, affectingNameOnly);
    }
  };

  const getVisibleAttributeGroups = () => {
    if (showOnlyNameAffecting) {
      return attributeGroups.filter((group) =>
        group.values?.some((value) => value.affectsName)
      );
    }
    return attributeGroups;
  };

  const getAttributeValueInfo = (valueId: string) => {
    for (const group of attributeGroups) {
      const value = group.values?.find((v) => v.id === valueId);
      if (value) {
        return { value, group };
      }
    }
    return null;
  };

  const renderAttributeValue = (value: AttributeValue, _groupType: string) => {
    const isNameAffecting = value.affectsName;

    return (
      <Option key={value.id} value={value.id}>
        <Space style={{ width: '100%', justifyContent: 'space-between' }}>
          <span>
            {value.name}
            {(value.priceAdjustment ?? 0) !== 0 && (
              <Text type="secondary" style={{ marginLeft: 8 }}>
                {(value.priceAdjustment ?? 0) > 0 ? '+' : ''}
                {(value.priceAdjustment ?? 0).toLocaleString(getLocale())}{t('common.currencySymbol')}
              </Text>
            )}
          </span>
          {isNameAffecting && (
            <Tooltip
              title={t('product.affectsNameTemplate', { template: value.nameTemplate || value.name })}
            >
              <Tag color="blue">
                {value.nameTemplate || 'NAME'}
              </Tag>
            </Tooltip>
          )}
        </Space>
      </Option>
    );
  };

  if (loading) {
    return (
      <Card title={t('attr.configTitle')}>
        <Skeleton active paragraph={{ rows: 4 }} />
      </Card>
    );
  }

  if (error) {
    return (
      <Alert
        message={t('attr.loadError')}
        description={error}
        type="error"
        closable
        action={
          <Button size="small" onClick={loadAttributeGroups}>
            {t('attr.retry')}
          </Button>
        }
      />
    );
  }

  const visibleGroups = getVisibleAttributeGroups();
  const nameAffectingCount = nameAffectingAttributes.length;
  const selectedNameAffecting = Object.values(selectedAttributes).filter(
    (valueId) => nameAffectingAttributes.some((attr) => attr.id === valueId)
  ).length;

  return (
    <div>
      <Card
        size="small"
        style={{ marginBottom: 16 }}
        title={
          <Space>
            <SettingOutlined />
            <span>{t('attr.configTitle')}</span>
            <Tag color="blue">
              {t('attr.nameAffectingCount', { count: nameAffectingCount })}
            </Tag>
          </Space>
        }
        extra={
          <Space>
            <span style={{ fontSize: '12px', color: '#666' }}>
              {t('attr.showNameAffecting')}
            </span>
            <Switch
              size="small"
              checked={showOnlyNameAffecting}
              onChange={setShowOnlyNameAffecting}
            />
          </Space>
        }
      >
        {nameAffectingCount > 0 && (
          <Alert
            message={t('attr.foundNameAffecting', { count: nameAffectingCount })}
            description={t('attr.selectedNameAffecting', { count: selectedNameAffecting })}
            type="info"
            icon={<BulbOutlined />}
            style={{ marginBottom: 12 }}
          />
        )}
      </Card>

      {showNamePreview && baseName && (
        <DynamicProductName
          baseName={baseName}
          selectedAttributes={selectedAttributes}
          productId={productId}
          onNameGenerated={onNameGenerated}
          disabled={disabled}
        />
      )}

      <Card title={t('attr.selectTitle', { count: visibleGroups.length })}>
        <Row gutter={[16, 16]}>
          {visibleGroups.map((group) => (
            <Col span={12} key={group.id}>
              <Form.Item
                label={
                  <Space>
                    <span>{group.name}</span>
                    {group.isRequired && <Text type="danger">*</Text>}
                    {group.values?.some((v) => v.affectsName) && (
                      <Tooltip title={t('product.affectsNameTooltip')}>
                        <Tag color="blue">
                          <BulbOutlined style={{ fontSize: 10 }} />
                        </Tag>
                      </Tooltip>
                    )}
                  </Space>
                }
                extra={
                  group.description && (
                    <Tooltip title={group.description}>
                      <InfoCircleOutlined style={{ color: '#1890ff' }} />
                    </Tooltip>
                  )
                }
              >
                <Select
                  placeholder={t('attr.selectGroupPlaceholder', { name: group.name.toLowerCase() })}
                  allowClear
                  value={selectedAttributes[group.id]}
                  onChange={(value) => handleAttributeChange(group.id, value)}
                  disabled={disabled}
                  style={{ width: '100%' }}
                  showSearch
                  optionFilterProp="children"
                  notFoundContent={t('common.noResults')}
                >
                  {(group.values ?? [])
                    .filter((value) => value.isActive)
                    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
                    .map((value) => renderAttributeValue(value, group.type))}
                </Select>
              </Form.Item>
            </Col>
          ))}
        </Row>

        {visibleGroups.length === 0 && (
          <Alert
            message={t('attr.emptyText')}
            description={t('attr.noGroupsDesc')}
            type="warning"
            showIcon
          />
        )}
      </Card>

      {Object.keys(selectedAttributes).length > 0 && (
        <Card
          title={t('attr.selectedTitle')}
          size="small"
          style={{ marginTop: 16 }}
          extra={
            <Button
              type="link"
              size="small"
              onClick={() => setSelectedAttributes({})}
            >
              {t('common.clear')}
            </Button>
          }
        >
          <Space wrap>
            {Object.entries(selectedAttributes).map(([groupId, valueId]) => {
              if (!valueId) return null;
              const info = getAttributeValueInfo(valueId);
              if (!info) return null;

              const isNameAffecting = info.value.affectsName;

              return (
                <Tag
                  key={`${groupId}-${valueId}`}
                  color={isNameAffecting ? 'blue' : 'default'}
                  closable
                  onClose={() => handleAttributeChange(groupId, '')}
                >
                  <Space size="small">
                    <span>{info.group.name}:</span>
                    <strong>{info.value.name}</strong>
                    {isNameAffecting && info.value.nameTemplate && (
                      <Text code style={{ fontSize: 10 }}>
                        {info.value.nameTemplate}
                      </Text>
                    )}
                  </Space>
                </Tag>
              );
            })}
          </Space>
        </Card>
      )}
    </div>
  );
};

export default DynamicAttributeSelector;
