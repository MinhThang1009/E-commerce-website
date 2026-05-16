import React from 'react';
import { useTranslation } from 'react-i18next';

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  siblingCount?: number;
}

const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
}) => {
  const { t } = useTranslation();
  // Tạo danh sách số trang để hiển thị
  const generatePagination = () => {
    // Luôn hiển thị trang đầu và trang cuối
    const firstPage = 1;
    const lastPage = totalPages;

    // Tính khoảng trang hiển thị xung quanh trang hiện tại
    const leftSiblingIndex = Math.max(currentPage - siblingCount, firstPage);
    const rightSiblingIndex = Math.min(currentPage + siblingCount, lastPage);

    // Xác định có cần hiển thị dấu "..." không
    const shouldShowLeftDots = leftSiblingIndex > firstPage + 1;
    const shouldShowRightDots = rightSiblingIndex < lastPage - 1;

    // Tạo mảng số trang để hiển thị
    const pageNumbers = [];

    // Luôn thêm trang đầu
    if (totalPages > 0) {
      pageNumbers.push(firstPage);
    }

    // Thêm dấu "..." bên trái nếu cần
    if (shouldShowLeftDots) {
      pageNumbers.push(-1); // Dùng -1 để biểu thị dấu "..."
    }

    // Thêm các trang xung quanh trang hiện tại
    for (let i = leftSiblingIndex; i <= rightSiblingIndex; i++) {
      if (i !== firstPage && i !== lastPage) {
        pageNumbers.push(i);
      }
    }

    // Thêm dấu "..." bên phải nếu cần
    if (shouldShowRightDots) {
      pageNumbers.push(-2); // Dùng -2 để biểu thị dấu "..." (key khác phía trái)
    }

    // Luôn thêm trang cuối nếu khác trang đầu
    if (totalPages > 1) {
      pageNumbers.push(lastPage);
    }

    return pageNumbers;
  };

  const pageNumbers = generatePagination();

  if (totalPages <= 1) return null;

  return (
    <nav className="flex justify-center mt-8" aria-label={t('common.pagination')}>
      <ul className="flex space-x-1">
        {/* Nút trang trước */}
        <li>
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className={`px-3 py-2 rounded-md ${
              currentPage === 1
                ? 'text-neutral-400 cursor-not-allowed'
                : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
            }`}
            aria-label={t('common.prevPage')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </li>

        {/* Số trang */}
        {pageNumbers.map((pageNumber, _index) => {
          // Render dấu "..."
          if (pageNumber < 0) {
            return (
              <li key={pageNumber}>
                <span className="px-4 py-2 text-neutral-500">...</span>
              </li>
            );
          }

          // Render số trang
          return (
            <li key={pageNumber}>
              <button
                onClick={() => onPageChange(pageNumber)}
                className={`px-4 py-2 rounded-md ${
                  currentPage === pageNumber
                    ? 'bg-primary-500 text-white dark:bg-primary-600'
                    : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
                }`}
                aria-current={currentPage === pageNumber ? 'page' : undefined}
              >
                {pageNumber}
              </button>
            </li>
          );
        })}

        {/* Nút trang sau */}
        <li>
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className={`px-3 py-2 rounded-md ${
              currentPage === totalPages
                ? 'text-neutral-400 cursor-not-allowed'
                : 'text-neutral-700 hover:bg-neutral-100 dark:text-neutral-300 dark:hover:bg-neutral-800'
            }`}
            aria-label={t('common.nextPage')}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </li>
      </ul>
    </nav>
  );
};

export default Pagination;

