import { User } from './user.types';

export interface News {
  id: string;
  title: string;
  slug: string;
  content: string;
  thumbnail?: string;
  description?: string;
  category: string;
  viewCount: number;
  tags?: string;
  isPublished: boolean;
  userId: string;
  author?: User;
  createdAt: string;
  updatedAt: string;
}

export interface NewsFilters {
  page?: number;
  limit?: number;
  search?: string;
  category?: string;
  isPublished?: boolean;
}

export interface NewsResponse {
  success: boolean;
  count: number;
  totalPages: number;
  currentPage: number;
  news: News[];
}

export interface SingleNewsResponse {
  success: boolean;
  news: News;
}
