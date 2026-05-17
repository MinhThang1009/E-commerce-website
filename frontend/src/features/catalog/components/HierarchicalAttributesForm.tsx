/**
 * @file HierarchicalAttributesForm.tsx
 * @layer Component
 * @feature catalog
 * @description UI component cho feature catalog
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Card,
  Typography,
  Button,
  Tree,
  Space,
  Modal,
  Form,
  Input,
  Select,
  InputNumber,
  message,
  Popconfirm,
  Alert,
  Spin,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FolderOutlined,
  TagOutlined,
  InfoCircleOutlined,
} from '@ant-design/icons';
import { attributeService, AttributeGroup, AttributeValue } from '../api/attributeApi';
import { getLocale } from '@/utils/format';
import { getErrorMsg } from '@/utils/errorUtils';

const { Title, Text } = Typography;
const { Option } = Select;

interface HierarchicalAttributesFormProps {
  onAttributeGroupsChange?: (groups: AttributeGroup[]) => void;
}

const HierarchicalAttributesForm: React.FC<HierarchicalAttributesFormProps> = ({
  onAttributeGroupsChange,
}) => {
  const { t } = useTranslation();
  const [form] = Form.useForm();
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalType, setModalType] = useState<'group' | 'value'>('group');
  const [editingItem, setEditingItem] = useState<AttributeGroup | AttributeValue | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<AttributeGroup | null>(null);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);

  // State nội bộ (attributeApi dùng class-based service, không phải TanStack Query hook)
  const [attributeGroups, setAttributeGroups] = useState<AttributeGroup[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await attributeService.getAttributeGroups();
      if (res.status === 'success') setAttributeGroups(res.data);
    } catch (err) {
      console.error('Lỗi tải nhóm thuộc tính:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  // Wrapper functions để giữ nguyên call-site (unwrap pattern)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- API payload
  const createAttributeGroup = (data: any) => ({
    unwrap: () => attributeService.createAttributeGroup(data).then((r) => r.data),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateAttributeGroup = (payload: { id: string; data: any }) => ({
    unwrap: () =>
      attributeService.updateAttributeGroup(payload.id, payload.data).then((r) => r.data),
  });
  const deleteAttributeGroup = (id: string) => ({
    unwrap: () => attributeService.deleteAttributeGroup(id).then((r) => r.data),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const addAttributeValue = (payload: { attributeGroupId: string; data: any }) => ({
    unwrap: () =>
      attributeService
        .addAttributeValue(payload.attributeGroupId, payload.data)
        .then((r) => r.data),
  });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const updateAttributeValue = (payload: { id: string; data: any }) => ({
    unwrap: () =>
      attributeService.updateAttributeValue(payload.id, payload.data).then((r) => r.data),
  });
  const deleteAttributeValue = (id: string) => ({
    unwrap: () => attributeService.deleteAttributeValue(id).then((r) => r.data),
  });

  // Xử lý tạo/chỉnh sửa nhóm
  const handleCreateGroup = () => {
    setModalType('group');
    setEditingItem(null);
    setIsModalVisible(true);
    form.resetFields();
  };

  const handleEditGroup = (group: AttributeGroup) => {
    setModalType('group');
    setEditingItem(group);
    setIsModalVisible(true);
    form.setFieldsValue({
      name: group.name,
      description: group.description,
      type: group.type,
      isRequired: group.isRequired,
      sortOrder: group.sortOrder,
    });
  };

  // Xử lý tạo/chỉnh sửa giá trị
  const handleCreateValue = (group: AttributeGroup) => {
    setModalType('value');
    setEditingItem(null);
    setSelectedGroup(group);
    setIsModalVisible(true);
    form.resetFields();
  };

  const handleEditValue = (value: AttributeValue, group: AttributeGroup) => {
    setModalType('value');
    setEditingItem(value);
    setSelectedGroup(group);
    setIsModalVisible(true);
    form.setFieldsValue({
      name: value.name,
      value: value.value,
      colorCode: value.colorCode,
      priceAdjustment: value.priceAdjustment,
      sortOrder: value.sortOrder,
    });
  };

  // Xử lý submit modal
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      if (modalType === 'group') {
        if (editingItem) {
          // Cập nhật nhóm
          await updateAttributeGroup({
            id: editingItem.id,
            data: values,
          });
          message.success(t('attr.groupUpdated'));
        } else {
          // Tạo nhóm
          await createAttributeGroup(values);
          message.success(t('attr.groupCreated'));
        }
      } else {
        if (editingItem) {
          // Cập nhật giá trị
          await updateAttributeValue({
            id: editingItem.id,
            data: values,
          });
          message.success(t('attr.valueUpdated'));
        } else {
          // Tạo giá trị
          await addAttributeValue({
            attributeGroupId: selectedGroup!.id,
            data: values,
          });
          message.success(t('attr.valueAdded'));
        }
      }

      setIsModalVisible(false);
      refetch();
      onAttributeGroupsChange?.(attributeGroups);
    } catch (error) {
      message.error(getErrorMsg(error, t('attr.error')));
    }
  };

  // Xử lý xóa
  const handleDeleteGroup = async (groupId: string) => {
    try {
      await deleteAttributeGroup(groupId);
      message.success(t('attr.groupDeleted'));
      refetch();
      onAttributeGroupsChange?.(attributeGroups);
    } catch (error) {
      message.error(getErrorMsg(error, t('attr.error')));
    }
  };

  const handleDeleteValue = async (valueId: string) => {
    try {
      await deleteAttributeValue(valueId);
      message.success(t('attr.valueDeleted'));
      refetch();
      onAttributeGroupsChange?.(attributeGroups);
    } catch (error) {
      message.error(getErrorMsg(error, t('attr.error')));
    }
  };

  // Xây dựng dữ liệu dạng cây
  const buildTreeData = () => {
    return attributeGroups.map((group) => ({
      key: `group-${group.id}`,
      title: (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Space>
            <FolderOutlined />
            <Text strong>{group.name}</Text>
            <Text type="secondary">({group.type})</Text>
            {group.isRequired && <Text type="danger">*</Text>}
          </Space>
          <Space>
            <Button
              size="small"
              icon={<PlusOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleCreateValue(group);
              }}
            >
              {t('attr.addValue')}
            </Button>
            <Button
              size="small"
              icon={<EditOutlined />}
              onClick={(e) => {
                e.stopPropagation();
                handleEditGroup(group);
              }}
            />
            <Popconfirm
              title={t('attr.deleteGroup')}
              description={t('attr.deleteGroupDesc')}
              onConfirm={(e) => {
                e?.stopPropagation();
                handleDeleteGroup(group.id);
              }}
              okText={t('attr.deleteConfirm')}
              cancelText={t('attr.cancelBtn')}
            >
              <Button
                size="small"
                danger
                icon={<DeleteOutlined />}
                onClick={(e) => e.stopPropagation()}
              />
            </Popconfirm>
          </Space>
        </div>
      ),
      children: group.values?.map((value) => ({
        key: `value-${value.id}`,
        title: (
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Space>
              <TagOutlined />
              <Text>{value.name}</Text>
              <Text type="secondary">({value.value})</Text>
              {value.colorCode && (
                <div
                  style={{
                    width: 16,
                    height: 16,
                    backgroundColor: value.colorCode,
                    border: '1px solid #d9d9d9',
                    borderRadius: 2,
                  }}
                />
              )}
              {(value.priceAdjustment ?? 0) !== 0 && (
                <Text type={(value.priceAdjustment ?? 0) > 0 ? 'success' : 'danger'}>
                  {(value.priceAdjustment ?? 0) > 0 ? '+' : ''}
                  {(value.priceAdjustment ?? 0).toLocaleString(getLocale())}
                  {t('common.currencySymbol')}
                </Text>
              )}
            </Space>
            <Space>
              <Button
                size="small"
                icon={<EditOutlined />}
                onClick={(e) => {
                  e.stopPropagation();
                  handleEditValue(value, group);
                }}
              />
              <Popconfirm
                title={t('attr.deleteValue')}
                description={t('attr.deleteValueDesc')}
                onConfirm={(e) => {
                  e?.stopPropagation();
                  handleDeleteValue(value.id);
                }}
                okText={t('attr.deleteConfirm')}
                cancelText={t('attr.cancelBtn')}
              >
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={(e) => e.stopPropagation()}
                />
              </Popconfirm>
            </Space>
          </div>
        ),
      })),
    }));
  };

  return (
    <Card>
      <Title level={4}>
        <FolderOutlined /> {t('attr.title')}
      </Title>

      <Alert
        message={t('attr.info')}
        description={t('attr.infoDesc')}
        type="info"
        showIcon
        icon={<InfoCircleOutlined />}
        style={{ marginBottom: 16 }}
      />

      <Button
        type="primary"
        icon={<PlusOutlined />}
        onClick={handleCreateGroup}
        style={{ marginBottom: 16 }}
      >
        {t('attr.createGroup')}
      </Button>

      <Spin spinning={isLoading}>
        {attributeGroups.length > 0 ? (
          <Tree
            showLine
            defaultExpandAll
            expandedKeys={expandedKeys}
            onExpand={setExpandedKeys}
            treeData={buildTreeData()}
          />
        ) : (
          <Card style={{ textAlign: 'center', padding: '40px 0' }}>
            <Text type="secondary">{t('attr.emptyText')}</Text>
          </Card>
        )}
      </Spin>

      {/* Modal tạo/chỉnh sửa */}
      <Modal
        title={
          modalType === 'group'
            ? editingItem
              ? t('attr.editGroupModal')
              : t('attr.createGroupModal')
            : editingItem
              ? t('attr.editValueModal')
              : t('attr.addValueModal')
        }
        open={isModalVisible}
        onOk={handleSubmit}
        onCancel={() => setIsModalVisible(false)}
        okText={editingItem ? t('attr.updateBtn') : t('attr.createBtn')}
        cancelText={t('attr.cancelBtn')}
      >
        <Form form={form} layout="vertical">
          {modalType === 'group' ? (
            // Form nhóm
            <>
              <Form.Item
                name="name"
                label={t('attr.groupName')}
                rules={[{ required: true, message: t('attr.groupNameRequired') }]}
              >
                <Input placeholder={t('attr.groupNamePlaceholder')} />
              </Form.Item>

              <Form.Item name="description" label={t('attr.groupDesc')}>
                <Input.TextArea placeholder={t('attr.groupDescPlaceholder')} />
              </Form.Item>

              <Form.Item
                name="type"
                label={t('attr.groupType')}
                rules={[{ required: true, message: t('attr.groupTypeRequired') }]}
              >
                <Select placeholder={t('attr.groupTypePlaceholder')}>
                  <Option value="color">{t('attr.typeColor')}</Option>
                  <Option value="config">{t('attr.typeConfig')}</Option>
                  <Option value="storage">{t('attr.typeStorage')}</Option>
                  <Option value="size">{t('attr.typeSize')}</Option>
                  <Option value="custom">{t('attr.typeCustom')}</Option>
                </Select>
              </Form.Item>

              <Form.Item name="isRequired" label={t('attr.isRequired')} initialValue={false}>
                <Select>
                  <Option value={true}>{t('attr.yes')}</Option>
                  <Option value={false}>{t('attr.no')}</Option>
                </Select>
              </Form.Item>

              <Form.Item name="sortOrder" label={t('attr.sortOrder')} initialValue={0}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </>
          ) : (
            // Form giá trị
            <>
              <Form.Item
                name="name"
                label={t('attr.valueName')}
                rules={[{ required: true, message: t('attr.valueNameRequired') }]}
              >
                <Input placeholder={t('attr.valueNamePlaceholder')} />
              </Form.Item>

              <Form.Item
                name="value"
                label={t('attr.valueField')}
                rules={[{ required: true, message: t('attr.valueRequired') }]}
              >
                <Input placeholder={t('attr.valuePlaceholder')} />
              </Form.Item>

              {selectedGroup?.type === 'color' && (
                <Form.Item name="colorCode" label={t('attr.colorCode')}>
                  <Input placeholder="#FF0000" />
                </Form.Item>
              )}

              <Form.Item name="priceAdjustment" label={t('attr.priceAdjustment')} initialValue={0}>
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="0"
                  formatter={(value) =>
                    value ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',') : ''
                  }
                  parser={(value) => Number(value?.replace(/\$\s?|(,*)/g, '') ?? '')}
                />
              </Form.Item>

              <Form.Item name="sortOrder" label={t('attr.sortOrder')} initialValue={0}>
                <InputNumber min={0} style={{ width: '100%' }} />
              </Form.Item>
            </>
          )}
        </Form>
      </Modal>
    </Card>
  );
};

export default HierarchicalAttributesForm;
