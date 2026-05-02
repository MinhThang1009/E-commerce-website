/**
 * Các tiện ích xử lý HTML
 */

export const processHtmlForEditor = (content: string): string => {
  if (!content || typeof content !== 'string') return '';

  let processedContent = content;

  // Giải mã các HTML entity
  const textarea = document.createElement('textarea');
  textarea.innerHTML = processedContent;
  processedContent = textarea.value;

  return processedContent;
};
