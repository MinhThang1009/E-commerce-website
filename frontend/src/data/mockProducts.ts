import { Product, ProductAttribute, ProductVariant } from '@/types/product.types';

const createAttribute = (
  productId: string,
  name: string,
  values: string[]
): ProductAttribute => ({
  id: `${productId}-${name.toLowerCase()}`,
  productId,
  name,
  values,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

const createVariant = (
  productId: string,
  name: string,
  sku: string,
  price: number,
  stockQuantity: number,
  attributes: Record<string, string>
): ProductVariant => ({
  id: `${productId}-${sku}`,
  name,
  sku,
  price,
  stockQuantity,
  attributes,
  images: [],
});

export const mockProducts: Product[] = [
  {
    id: 'prod-001',
    name: 'Premium Wireless Headphones',
    slug: 'premium-wireless-headphones',
    price: 129.99,
    compareAtPrice: 159.99,
    thumbnail:
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80',
    images: [
      'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?auto=format&fit=crop&w=1000&q=80',
    ],
    description:
      'Experience exceptional audio with advanced noise cancellation and 30-hour battery life.',
    shortDescription:
      'High-fidelity wireless headphones with ANC and long battery life.',
    categoryId: '1',
    categoryName: 'Audio',
    stock: 25,
    ratings: { average: 4.7, count: 128 },
    attributes: [
      createAttribute('prod-001', 'Color', ['Black', 'Silver']),
      createAttribute('prod-001', 'Connectivity', ['Bluetooth 5.0']),
    ],
    variants: [
      createVariant('prod-001', 'Black', 'HD-BLK', 129.99, 15, {
        Color: 'Black',
      }),
      createVariant('prod-001', 'Silver', 'HD-SLV', 134.99, 10, {
        Color: 'Silver',
      }),
    ],
    isNew: true,
    isFeatured: true,
    brand: 'SoundMax',
    model: 'HX-900',
    condition: 'new',
    warrantyMonths: 12,
    specifications: {
      batteryLife: '30 hours',
      weight: '250g',
      frequencyResponse: '20Hz - 20kHz',
    },
    createdAt: '2024-01-10T08:00:00Z',
    updatedAt: '2024-05-12T10:15:00Z',
  },
  {
    id: 'prod-002',
    name: 'Smart Fitness Watch',
    slug: 'smart-fitness-watch',
    price: 149.99,
    compareAtPrice: 179.99,
    thumbnail:
      'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?auto=format&fit=crop&w=1000&q=80',
    images: [
      'https://images.unsplash.com/photo-1575311373937-040b8e1fd5b6?auto=format&fit=crop&w=1000&q=80',
    ],
    description:
      'Track your health with heart-rate monitoring, GPS, sleep tracking, and water resistance up to 50m.',
    shortDescription:
      'Advanced fitness tracking with AMOLED display and 7-day battery life.',
    categoryId: '2',
    categoryName: 'Wearables',
    stock: 18,
    ratings: { average: 4.5, count: 96 },
    attributes: [
      createAttribute('prod-002', 'Color', ['Black', 'Rose Gold']),
      createAttribute('prod-002', 'Size', ['40mm', '44mm']),
    ],
    variants: [
      createVariant(
        'prod-002',
        'Black 44mm',
        'FW-BLK-44',
        149.99,
        9,
        {
          Color: 'Black',
          Size: '44mm',
        }
      ),
      createVariant(
        'prod-002',
        'Rose Gold 40mm',
        'FW-RGLD-40',
        154.99,
        9,
        {
          Color: 'Rose Gold',
          Size: '40mm',
        }
      ),
    ],
    isNew: true,
    isFeatured: false,
    brand: 'ActiveLife',
    model: 'Pulse Pro',
    condition: 'new',
    warrantyMonths: 18,
    specifications: {
      waterResistance: '50m',
      batteryLife: '7 days',
      compatibility: 'iOS & Android',
    },
    createdAt: '2024-02-02T08:30:00Z',
    updatedAt: '2024-06-01T12:45:00Z',
  },
  {
    id: 'prod-003',
    name: 'Portable Bluetooth Speaker',
    slug: 'portable-bluetooth-speaker',
    price: 99.99,
    compareAtPrice: 129.99,
    thumbnail:
      'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=1000&q=80',
    images: [
      'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?auto=format&fit=crop&w=1000&q=80',
    ],
    description:
      'Compact speaker with 360° sound, deep bass, and 12-hour battery life. Water-resistant IPX6 rating.',
    shortDescription: 'Powerful portable speaker for indoor and outdoor use.',
    categoryId: '1',
    categoryName: 'Audio',
    stock: 30,
    ratings: { average: 4.6, count: 210 },
    attributes: [
      createAttribute('prod-003', 'Color', ['Blue', 'Graphite']),
      createAttribute('prod-003', 'Features', ['Water-resistant', 'NFC']),
    ],
    variants: [
      createVariant('prod-003', 'Blue', 'SP-BLU', 99.99, 15, {
        Color: 'Blue',
      }),
      createVariant('prod-003', 'Graphite', 'SP-GRP', 109.99, 15, {
        Color: 'Graphite',
      }),
    ],
    isNew: false,
    isFeatured: true,
    brand: 'SoundSphere',
    model: 'Wave Mini',
    condition: 'new',
    warrantyMonths: 12,
    specifications: {
      batteryLife: '12 hours',
      weight: '450g',
      connectivity: ['Bluetooth 5.1', 'Aux-in'],
    },
    createdAt: '2023-11-18T09:00:00Z',
    updatedAt: '2024-04-25T16:05:00Z',
  },
  {
    id: 'prod-004',
    name: 'Ultra-Slim Productivity Laptop',
    slug: 'ultra-slim-productivity-laptop',
    price: 1199.99,
    compareAtPrice: 1299.99,
    thumbnail:
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1000&q=80',
    images: [
      'https://images.unsplash.com/photo-1517336714731-489689fd1ca8?auto=format&fit=crop&w=1000&q=80',
    ],
    description:
      '14-inch ultra-slim laptop with Intel Core i7, 16GB RAM, 1TB SSD, and 12-hour battery life. Ideal for professionals.',
    shortDescription:
      'Lightweight performance laptop for work and creativity.',
    categoryId: '3',
    categoryName: 'Computers',
    stock: 12,
    ratings: { average: 4.8, count: 64 },
    attributes: [
      createAttribute('prod-004', 'Memory', ['16GB']),
      createAttribute('prod-004', 'Storage', ['1TB SSD']),
      createAttribute('prod-004', 'Display', ['14" QHD']),
    ],
    variants: [],
    isNew: false,
    isFeatured: true,
    brand: 'TechNova',
    model: 'ZenBook X14',
    condition: 'new',
    warrantyMonths: 24,
    specifications: {
      cpu: 'Intel Core i7-1360P',
      gpu: 'Intel Iris Xe',
      weight: '1.1kg',
    },
    createdAt: '2024-03-05T11:10:00Z',
    updatedAt: '2024-05-28T15:20:00Z',
  },
  {
    id: 'prod-005',
    name: '4K Smart OLED TV 55-inch',
    slug: '4k-smart-oled-tv-55-inch',
    price: 1499.99,
    compareAtPrice: 1699.99,
    thumbnail:
      'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=1000&q=80',
    images: [
      'https://images.unsplash.com/photo-1587825140708-dfaf72ae4b04?auto=format&fit=crop&w=1000&q=80',
    ],
    description:
      'Stunning 55-inch OLED panel with Dolby Vision, HDR10+, 120Hz refresh rate, and built-in voice assistant.',
    shortDescription: 'Immersive OLED display with smart home integration.',
    categoryId: '5',
    categoryName: 'Televisions',
    stock: 9,
    ratings: { average: 4.9, count: 38 },
    attributes: [
      createAttribute('prod-005', 'Size', ['55 inch']),
      createAttribute('prod-005', 'Resolution', ['4K UHD']),
    ],
    variants: [],
    isNew: false,
    isFeatured: true,
    brand: 'VisionPro',
    model: 'OLED55',
    condition: 'new',
    warrantyMonths: 24,
    specifications: {
      refreshRate: '120Hz',
      smartPlatform: 'Google TV',
      hdmiPorts: 4,
    },
    createdAt: '2024-01-22T07:55:00Z',
    updatedAt: '2024-04-12T14:18:00Z',
  },
  {
    id: 'prod-006',
    name: 'Professional Mirrorless Camera',
    slug: 'professional-mirrorless-camera',
    price: 1899.99,
    compareAtPrice: 2099.99,
    thumbnail:
      'https://images.unsplash.com/photo-1519183071298-a2962be96c85?auto=format&fit=crop&w=1000&q=80',
    images: [
      'https://images.unsplash.com/photo-1519183071298-a2962be96c85?auto=format&fit=crop&w=1000&q=80',
    ],
    description:
      'Full-frame mirrorless camera with 45MP sensor, 8K video recording, and dual card slots.',
    shortDescription:
      'Capture stunning photos and videos with pro-grade mirrorless camera.',
    categoryId: '6',
    categoryName: 'Cameras',
    stock: 6,
    ratings: { average: 4.8, count: 52 },
    attributes: [
      createAttribute('prod-006', 'Sensor', ['Full-frame']),
      createAttribute('prod-006', 'Video', ['8K 30fps']),
    ],
    variants: [],
    isNew: false,
    isFeatured: false,
    brand: 'Photonix',
    model: 'Aurora FX',
    condition: 'new',
    warrantyMonths: 24,
    specifications: {
      stabilization: 'In-body 5-axis',
      viewfinder: 'OLED 5.6M dots',
      weight: '820g',
    },
    createdAt: '2024-02-14T13:40:00Z',
    updatedAt: '2024-05-01T09:25:00Z',
  },
];

export const getProductBySlug = (slug: string): Product | undefined =>
  mockProducts.find((product) => product.slug === slug);

export const getProductById = (id: string): Product | undefined =>
  mockProducts.find((product) => product.id === id);

export const getFeaturedProducts = (): Product[] =>
  mockProducts.filter((product) => product.isFeatured);

export const getNewArrivals = (): Product[] =>
  mockProducts.filter((product) => product.isNew);
