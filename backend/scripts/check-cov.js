const fs = require('fs'), path = require('path');
const cov = JSON.parse(fs.readFileSync('coverage/coverage-final.json', 'utf8'));
const keys = Object.keys(cov);
console.log('Total files in coverage-final.json:', keys.length);
const hasOrders = keys.filter(k => k.includes('orders'));
console.log('orders files:', hasOrders.length);
if (hasOrders.length === 0) {
  console.log('Sample keys:');
  keys.slice(0, 5).forEach(k => console.log(' ', k.slice(-60)));
}
