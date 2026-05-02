// Các kiểu dữ liệu người dùng
export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  name?: string; // Họ tên đầy đủ (firstName + lastName)
  phone?: string;
  avatar?: string;
  role: 'customer' | 'admin' | 'manager';
  addresses?: Address[];
  defaultAddressId?: string;
  wishlist?: string[]; // Mảng ID sản phẩm
  isEmailVerified?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface Address {
  id: string;
  name?: string; // Nhãn địa chỉ (ví dụ: "Nhà", "Công ty")
  firstName: string;
  lastName: string;
  company?: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  phone?: string;
  isDefault: boolean;
}
