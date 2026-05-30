const fs = require('fs');
const path = require('path');

const cov = JSON.parse(fs.readFileSync(path.join(__dirname, '../coverage/coverage-final.json'), 'utf8'));
const targets = [
  'keyword-fallback.js', 'chatbot-service.js', 'vector-store.js', 'fuzzy-expander.js',
  'admin-product-service.js', 'orders-service.js', 'response-parser.js',
  'admin-analytics-service.js', 'sequelize-ai-repository.js', 'product.js'
];

for (const [filePath, data] of Object.entries(cov)) {
  const name = path.win32.basename(filePath);
  if (!targets.includes(name)) continue;

  const { b: branches, branchMap } = data;
  const uncovered = [];

  for (const [id, counts] of Object.entries(branches)) {
    const info = branchMap[id];
    counts.forEach((count, idx) => {
      if (count === 0) {
        const loc = info && info.locations && info.locations[idx];
        const line = loc ? loc.start.line : (info && info.loc ? info.loc.start.line : '?');
        uncovered.push({ id, idx, line, type: (info && info.type) || '?' });
      }
    });
  }

  if (uncovered.length > 0) {
    console.log('\n=== ' + name + ' (' + uncovered.length + ' uncovered) ===');
    uncovered.forEach(u => console.log('  Branch ' + u.id + '[' + u.idx + '] line ' + u.line + ' (' + u.type + ')'));
  }
}
