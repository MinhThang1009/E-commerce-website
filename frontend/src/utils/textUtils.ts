/**
 * Các hàm tiện ích xử lý văn bản
 */

/**
 * Xóa thẻ HTML và trích xuất văn bản thuần
 */
export const stripHtml = (html: string): string => {
  if (!html) return '';

  // Tạo phần tử div tạm để parse HTML
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;

  // Xóa các phần tử script và style
  const scripts = tempDiv.querySelectorAll('script, style');
  scripts.forEach((el) => el.remove());

  // Lấy nội dung văn bản và làm sạch
  const text = tempDiv.textContent || tempDiv.innerText || '';

  // Xóa khoảng trắng thừa và ký tự xuống dòng
  return text.replace(/\s+/g, ' ').replace(/\n+/g, ' ').trim();
};

/**
 * Trích xuất từ khóa từ văn bản
 */
export const extractKeywords = (
  text: string,
  maxKeywords: number = 10
): string[] => {
  if (!text) return [];

  // Chuyển thành chữ thường và loại bỏ ký tự đặc biệt
  const cleanText = text
    .toLowerCase()
    .replace(
      /[^\w\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g,
      ' '
    )
    .replace(/\s+/g, ' ')
    .trim();

  // Tách thành các từ
  const words = cleanText.split(' ');

  // Các stop word phổ biến tiếng Việt và tiếng Anh
  const stopWords = new Set([
    'và',
    'của',
    'có',
    'là',
    'được',
    'cho',
    'với',
    'từ',
    'trong',
    'trên',
    'dưới',
    'về',
    'để',
    'khi',
    'nếu',
    'như',
    'sẽ',
    'đã',
    'đang',
    'các',
    'những',
    'này',
    'đó',
    'một',
    'hai',
    'ba',
    'bốn',
    'năm',
    'sáu',
    'bảy',
    'tám',
    'chín',
    'mười',
    'the',
    'and',
    'or',
    'but',
    'in',
    'on',
    'at',
    'to',
    'for',
    'of',
    'with',
    'by',
    'from',
    'up',
    'about',
    'into',
    'through',
    'during',
    'before',
    'after',
    'above',
    'below',
    'between',
    'among',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'must',
    'can',
    'this',
    'that',
    'these',
    'those',
    'a',
    'an',
  ]);

  // Lọc bỏ stop word và từ quá ngắn
  const filteredWords = words.filter(
    (word) => word.length >= 3 && !stopWords.has(word) && !/^\d+$/.test(word) // Loại bỏ chuỗi số thuần túy
  );

  // Đếm tần suất từ
  const wordCount = new Map<string, number>();
  filteredWords.forEach((word) => {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  });

  // Sắp xếp theo tần suất và lấy từ khóa hàng đầu
  const sortedWords = Array.from(wordCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word]) => word);

  return sortedWords;
};

/**
 * Tạo từ khóa tìm kiếm từ dữ liệu sản phẩm
 */
export const generateSearchKeywords = (
  name: string,
  description: string,
  shortDescription?: string,
  maxKeywords: number = 15
): string[] => {
  const allText = [
    name || '',
    shortDescription || '',
    stripHtml(description || ''),
  ].join(' ');

  const keywords = extractKeywords(allText, maxKeywords);

  // Thêm các từ trong tên sản phẩm làm từ khóa ưu tiên
  if (name) {
    const nameWords = name
      .toLowerCase()
      .replace(
        /[^\w\sàáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ]/g,
        ' '
      )
      .split(' ')
      .filter((word) => word.length >= 2);

    // Gộp và loại bỏ trùng lặp
    const allKeywords = [...nameWords, ...keywords];
    const uniqueKeywords = Array.from(new Set(allKeywords));

    return uniqueKeywords.slice(0, maxKeywords);
  }

  return keywords;
};
