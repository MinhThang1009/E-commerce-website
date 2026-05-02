import React, {
  createContext,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';

export type ProductFormData = Record<string, any>;

export interface ProductFormContextValue {
  formData: ProductFormData;
  updateFormData: (updates: Partial<ProductFormData>) => void;
  resetFormData: (nextData?: ProductFormData) => void;
}

const ProductFormContext = createContext<ProductFormContextValue | undefined>(
  undefined
);

interface ProductFormProviderProps {
  initialData?: ProductFormData;
  children: React.ReactNode;
}

export const ProductFormProvider: React.FC<ProductFormProviderProps> = ({
  initialData = {},
  children,
}) => {
  const initialRef = useRef<ProductFormData>(initialData);
  const [formData, setFormData] = useState<ProductFormData>(initialData);

  const value = useMemo<ProductFormContextValue>(
    () => ({
      formData,
      updateFormData: (updates) => {
        setFormData((prev) => ({
          ...prev,
          ...updates,
        }));
      },
      resetFormData: (nextData) => {
        const data = nextData ?? initialRef.current;
        initialRef.current = data;
        setFormData(data);
      },
    }),
    [formData]
  );

  return (
    <ProductFormContext.Provider value={value}>
      {children}
    </ProductFormContext.Provider>
  );
};

export const useProductFormContext = (): ProductFormContextValue => {
  const context = useContext(ProductFormContext);
  if (!context) {
    throw new Error(
      'useProductFormContext must be used within a ProductFormProvider'
    );
  }
  return context;
};

export default ProductFormContext;
