// Dùng function config để tránh "command line too long" trên Windows
// khi có nhiều staged files (đường dẫn tiếng Việt dài).
// Arrow function không nhận args → lint chạy trên toàn src/ thay vì từng file.
module.exports = {
  'src/**/*.{ts,tsx}': () => [
    'eslint --ext .ts,.tsx --max-warnings 0 src/',
    'prettier --write src/',
  ],
  'src/**/*.{css,scss}': () => [
    'prettier --write src/',
  ],
};
