import { Order } from '@/types/order.types';

const sharedAddress = {
  id: 'addr-home',
  firstName: 'John',
  lastName: 'Doe',
  address1: '123 Main St',
  city: 'New York',
  state: 'NY',
  zip: '10001',
  country: 'US',
  phone: '555-123-4567',
  isDefault: true,
};

export const mockOrders: Order[] = [
  {
    id: 'ORD-001',
    number: 'ORD-001',
    userId: 'user1',
    status: 'delivered',
    items: [
      {
        productId: 'prod-001',
        name: 'Premium Wireless Headphones',
        price: 129.99,
        quantity: 1,
        subtotal: 129.99,
        image: 'https://placehold.co/600x400?text=Headphones',
      },
      {
        productId: 'prod-003',
        name: 'Portable Bluetooth Speaker',
        price: 99.99,
        quantity: 1,
        subtotal: 99.99,
        image: 'https://placehold.co/600x400?text=Bluetooth+Speaker',
      },
    ],
    shipping: sharedAddress,
    billing: sharedAddress,
    paymentMethod: 'credit_card',
    paymentStatus: 'paid',
    subtotal: 229.98,
    tax: 16.1,
    shippingCost: 5.99,
    discount: 0,
    total: 252.07,
    notes: '',
    createdAt: '2023-05-15T10:30:00Z',
    updatedAt: '2023-05-20T14:20:00Z',
  },
  {
    id: 'ORD-002',
    number: 'ORD-002',
    userId: 'user1',
    status: 'shipped',
    items: [
      {
        productId: 'prod-004',
        name: 'Ultra-Slim Laptop',
        price: 899.99,
        quantity: 1,
        subtotal: 899.99,
        image: 'https://placehold.co/600x400?text=Laptop',
      },
    ],
    shipping: { ...sharedAddress, id: 'addr-office', isDefault: false },
    billing: sharedAddress,
    paymentMethod: 'paypal',
    paymentStatus: 'paid',
    subtotal: 899.99,
    tax: 63.0,
    shippingCost: 12.99,
    discount: 0,
    total: 975.98,
    notes: 'Please leave at the front door',
    createdAt: '2023-06-10T15:45:00Z',
    updatedAt: '2023-06-11T09:30:00Z',
  },
  {
    id: 'ORD-003',
    number: 'ORD-003',
    userId: 'user1',
    status: 'processing',
    items: [
      {
        productId: 'prod-002',
        name: 'Smart Fitness Watch',
        price: 149.99,
        quantity: 1,
        subtotal: 149.99,
        image: 'https://placehold.co/600x400?text=Fitness+Watch',
      },
      {
        productId: 'prod-005',
        name: 'Wireless Charging Pad',
        price: 49.99,
        quantity: 2,
        subtotal: 99.98,
        image: 'https://placehold.co/600x400?text=Charging+Pad',
      },
    ],
    shipping: sharedAddress,
    billing: sharedAddress,
    paymentMethod: 'credit_card',
    paymentStatus: 'pending',
    subtotal: 249.97,
    tax: 17.5,
    shippingCost: 0,
    discount: 0,
    total: 267.47,
    notes: '',
    createdAt: '2023-06-18T11:20:00Z',
    updatedAt: '2023-06-18T11:20:00Z',
  },
];

export const getOrdersByUserId = (userId: string): Order[] =>
  mockOrders.filter((order) => order.userId === userId);

export const getOrderById = (orderId: string): Order | undefined =>
  mockOrders.find((order) => order.id === orderId);

export const createOrder = (
  order: Omit<Order, 'id' | 'number' | 'createdAt' | 'updatedAt'>
): Order => {
  const newOrder: Order = {
    ...order,
    id: `ORD-${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(3, '0')}`,
    number: `ORD-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  mockOrders.unshift(newOrder);
  return newOrder;
};
