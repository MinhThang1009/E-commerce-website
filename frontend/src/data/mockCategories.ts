import { Category } from '@/types/category.types';

export const mockCategories: Category[] = [
  {
    id: '1',
    name: 'Điện thoại',
    slug: 'dien-thoai',
    description: 'Tất cả các dòng điện thoại di động thông minh',
    image:
      'https://cdn.tgdd.vn/Files/2023/07/14/1523185/cach-chup-anh-phong-canh-bang-dien-thoai-dep-14.jpg',
    parentId: null,
    level: 0,
    isActive: true,
    productCount: 12,
  },
  {
    id: '2',
    name: 'Tablet',
    slug: 'tablet',
    description: 'Tất cả các dòng máy tính bảng',
    image:
      'https://cdn.tgdd.vn/Files/2022/12/27/1493756/top-5-may-tinh-bang-duoi-5-trieu-dong-dang-mua-nhat-hien-nay-202212271057010133.jpg',
    parentId: null,
    level: 0,
    isActive: true,
    productCount: 11,
  },
  {
    id: '3',
    name: 'Laptop',
    slug: 'laptop',
    description: 'Tất cả các dòng máy tính xách tay',
    image:
      'https://cdn.tgdd.vn/Files/2024/03/28/1569666/top-5-laptop-mong-nhe-tot-nhat-hien-nay-202403281120180709.jpg',
    parentId: null,
    level: 0,
    isActive: true,
    productCount: 22,
  },
];

export const getCategories = (): Category[] => {
  return mockCategories;
};

export const getCategoryById = (id: string): Category | undefined => {
  return mockCategories.find((category) => category.id === id);
};

export const getCategoryBySlug = (slug: string): Category | undefined => {
  return mockCategories.find((category) => category.slug === slug);
};
