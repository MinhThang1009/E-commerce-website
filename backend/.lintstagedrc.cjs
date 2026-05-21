// Dùng function syntax để tránh "command line too long" trên Windows khi có nhiều staged files
module.exports = {
  'src/**/*.js': () => [
    'eslint --max-warnings 0 src/',
    'prettier --write src/',
  ],
};
