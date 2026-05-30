/**
 * @file useProductAttributes.ts
 * @layer Hook
 * @feature catalog
 * @description Custom React hook cho feature catalog
 */
import { useState } from 'react';
import { ProductAttribute } from '@/types';
import { useUiStore } from '@/stores/ui-store';
import { useTranslation } from 'react-i18next';

export const useProductAttributes = (initialAttributes: ProductAttribute[] = []) => {
  const { t } = useTranslation();
  const addNotification = useUiStore((s) => s.addNotification);
  const [attributes, setAttributes] = useState<ProductAttribute[]>(initialAttributes);
  const [attributeModalVisible, setAttributeModalVisible] = useState(false);
  const [editingAttribute, setEditingAttribute] = useState<ProductAttribute | null>(null);

  // Các handler cho thuộc tính
  const handleAddAttribute = (attribute: ProductAttribute) => {
    if (editingAttribute) {
      const updatedAttributes = attributes.map((attr) =>
        attr.id === editingAttribute.id ? { ...attribute, id: editingAttribute.id } : attr,
      );
      setAttributes(updatedAttributes);
      addNotification({ message: t('admin.products.attributes.updateSuccess'), type: 'success' });
    } else {
      const newId = `attr-${attributes.length}-${Math.random().toString(36).substring(2, 9)}`;
      setAttributes([...attributes, { ...attribute, id: attribute.id || newId }]);
      addNotification({ message: t('admin.products.attributes.addSuccess'), type: 'success' });
    }

    setAttributeModalVisible(false);
    setEditingAttribute(null);
  };

  const handleDeleteAttribute = (id: string) => {
    setAttributes(attributes.filter((attr) => attr.id !== id));
    addNotification({ message: t('admin.products.attributes.deleteSuccess'), type: 'info' });
  };

  const openAttributeModal = (attribute?: ProductAttribute) => {
    setEditingAttribute(attribute || null);
    setAttributeModalVisible(true);
  };

  const closeAttributeModal = () => {
    setAttributeModalVisible(false);
    setEditingAttribute(null);
  };

  return {
    attributes,
    setAttributes,
    attributeModalVisible,
    editingAttribute,
    handleAddAttribute,
    handleDeleteAttribute,
    openAttributeModal,
    closeAttributeModal,
  };
};
