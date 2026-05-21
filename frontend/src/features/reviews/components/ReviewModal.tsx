/**
 * @file ReviewModal.tsx
 * @layer Component
 * @feature reviews
 * @description UI component cho feature reviews
 */
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import Modal from '@/components/common/Modal';
import { Rating } from '@/components/common/Rating';
import { PremiumButton } from '@/components/common';
import { useCreateReviewMutation } from '../api/review-api';
import { useNotifications } from '@/hooks/use-notifications';
import { getErrorMsg } from '@/utils/error-utils';

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
  const { t } = useTranslation();
  const { showNotification } = useNotifications();
  const [rating, setRating] = useState<number>(5);
  const [title, setTitle] = useState<string>('');
  const [comment, setComment] = useState<string>('');
  const [images, _setImages] = useState<string[]>([]);

  const { mutateAsync: createReview, isPending: isLoading } = useCreateReviewMutation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (rating < 1) {
      showNotification({ message: t('review.modal.ratingRequired'), type: 'error' });
      return;
    }

    if (!comment.trim()) {
      showNotification({ message: t('review.modal.commentRequired'), type: 'error' });
      return;
    }

    try {
      await createReview({
        productId,
        rating,
        title: title.trim() || t('review.modal.defaultTitle'),
        comment: comment.trim(),
        images: images.length > 0 ? images : undefined,
      });

      showNotification({ message: t('review.modal.submitSuccess'), type: 'success' });
      if (onSuccess) onSuccess();
      onClose();
      setRating(5);
      setTitle('');
      setComment('');
    } catch (error) {
      console.error('Review submission failed:', error);
      showNotification({
        message: getErrorMsg(error, t('review.modal.submitError')),
        type: 'error',
      });
    }
  };

  const footer = (
    <div className="flex gap-2 justify-end w-full">
      <PremiumButton variant="outline" onClick={onClose} disabled={isLoading}>
        {t('common.cancel')}
      </PremiumButton>
      <PremiumButton
        variant="primary"
        onClick={handleSubmit}
        isProcessing={isLoading}
        processingText={t('review.modal.submitting')}
      >
        {t('review.modal.submit')}
      </PremiumButton>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={t('review.modal.title')}
      size="md"
      footer={footer}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            {t('review.modal.productLabel')}
          </label>
          <p className="text-neutral-800 dark:text-neutral-100 font-semibold truncate">
            {productName}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
            {t('review.modal.ratingLabel')}
          </label>
          <Rating value={rating} onChange={setRating} interactive={true} size="large" />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            {t('review.modal.titleOptional')}
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={t('review.modal.titlePlaceholder')}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1">
            {t('review.modal.commentLabel')} <span className="text-red-500">*</span>
          </label>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            rows={4}
            required
            placeholder={t('review.modal.commentPlaceholder')}
            className="w-full px-3 py-2 border border-neutral-300 dark:border-neutral-600 rounded-md shadow-sm focus:ring-primary-500 focus:border-primary-500 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder-neutral-400"
          />
        </div>
      </form>
    </Modal>
  );
};

export default ReviewModal;
