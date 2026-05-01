import { Review } from '@/types/review.types';

const now = new Date();

const createReview = (overrides: Partial<Review>): Review => ({
  id: Math.random().toString(36).slice(2),
  productId: 'prod-001',
  userId: 'user1',
  userName: 'John Doe',
  userAvatar: undefined,
  rating: 5,
  title: 'Tuyệt vời!',
  comment: 'Sản phẩm rất tốt và đúng như mô tả.',
  images: [],
  isVerifiedPurchase: true,
  likes: 0,
  dislikes: 0,
  createdAt: now.toISOString(),
  updatedAt: now.toISOString(),
  ...overrides,
});

export const mockReviews: Record<string, Review[]> = {
  'prod-001': [
    createReview({
      id: 'rev-101',
      userId: 'user1',
      userName: 'Nguyễn Minh',
      rating: 5,
      title: 'Âm thanh đỉnh cao',
      comment:
        'Âm thanh rất hay, bass khỏe, đeo lâu không bị đau tai. Pin dùng cả ngày.',
      likes: 18,
      createdAt: '2024-05-15T14:30:00Z',
      updatedAt: '2024-05-15T14:30:00Z',
    }),
    createReview({
      id: 'rev-102',
      userId: 'user2',
      userName: 'Trần Anh',
      rating: 4,
      title: 'Đáng tiền',
      comment:
        'Chất lượng hoàn thiện tốt, chất âm ổn. Giá hơi cao nhưng xứng đáng.',
      likes: 9,
      createdAt: '2024-04-22T09:45:00Z',
      updatedAt: '2024-04-22T09:45:00Z',
    }),
  ],
  'prod-002': [
    createReview({
      id: 'rev-201',
      productId: 'prod-002',
      userId: 'user3',
      userName: 'Lê Hồng',
      rating: 5,
      title: 'Bạn đồng hành luyện tập',
      comment:
        'Đồng hồ theo dõi sức khỏe chính xác, pin bền. Ứng dụng dễ dùng.',
      likes: 12,
      createdAt: '2024-03-12T08:30:00Z',
      updatedAt: '2024-03-12T08:30:00Z',
    }),
  ],
};

export const getReviewsByProductId = (productId: string): Review[] =>
  mockReviews[productId] || [];

export const addReview = (
  review: Omit<Review, 'id' | 'createdAt' | 'updatedAt' | 'likes' | 'dislikes'>
): Review => {
  const newReview = createReview({
    ...review,
    id: `rev-${Date.now()}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    likes: 0,
    dislikes: 0,
  });

  if (!mockReviews[review.productId]) {
    mockReviews[review.productId] = [];
  }

  mockReviews[review.productId].unshift(newReview);
  return newReview;
};

export const markReviewHelpful = (reviewId: string): void => {
  Object.values(mockReviews).forEach((reviews) => {
    const review = reviews.find((item) => item.id === reviewId);
    if (review) {
      review.likes += 1;
    }
  });
};
