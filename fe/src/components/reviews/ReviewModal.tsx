import React, { useState } from 'react';
import Modal from '@/components/common/Modal';
import { Rating } from '@/components/common/Rating';
import { PremiumButton } from '@/components/common';
import { useCreateReviewMutation } from '@/services/reviewApi';
import { toast } from '@/utils/toast';

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  onSuccess?: () => void;
}

const ReviewModal: React.FC<ReviewModalProps> = ({
  isOpen,
  onClose,
  productId,
  productName,
  onSuccess,
}) => {
  const [rating, setRating] = useState<number>(5);
  const [title, setTitle] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [images, setImages] = useState<string[]>([]);
  
  const [createReview, { isLoading }] = useCreateReviewMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating < 1) {
      toast.error('Vui lòng chọn số sao đánh giá');
      return;
    }

    if (!comment.trim()) {
      toast.error('Vui lòng nhập nội dung nhận xét');
      return;
    }

    try {
      await createReview({
        productId,
        rating,
        title: title.trim() || 'Đánh giá sản phẩm',
        comment: comment.trim(),
        images: images.length > 0 ? images : undefined,
      }).unwrap();

      toast.success('Gửi đánh giá thành công!');
      if (onSuccess) onSuccess();
      onClose();
      // Reset form
      setRating(5);
      setTitle('');
      setComment('');
    } catch (error: any) {
      console.error('Failed to create review:', error);
      toast.error(error?.data?.message || 'Không thể gửi đánh giá lúc này');
    }
  };

  const footer = (
    <div className="flex gap-2 justify-end w-full">
      <PremiumButton 
        variant="outline" 
        onClick={onClose}
        disabled={isLoading}
      >
        Hủy
      </PremiumButton>
      <PremiumButton
        variant="primary"
        onClick={handleSubmit}
        isProcessing={isLoading}
        processingText="Đang gửi..."
      >
        Gửi đánh giá
      </PremiumButton>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Đánh giá sản phẩm"
      size="md"
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Sản phẩm
          </label>
          <p className="text-neutral-800 dark:text-neutral-100 font-semibold truncate">
            {productName}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            Xếp hạng của bạn
          </label>
          <Rating 
            value={rating} 
            onChange={setRating} 
            interactive={true} 
            size="large"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Tiêu đề (Tùy chọn)
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="VD: Sản phẩm rất tuyệt, Giao hàng nhanh"
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            Nội dung nhận xét <span className="text-red-500">*</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            required
            placeholder="Hãy chia sẻ cảm nhận của bạn về sản phẩm này..."
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
          />
        </div>
      </form>
    </Modal>
  );
};

export default ReviewModal;
