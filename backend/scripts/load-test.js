/**
 * @file load-test.js
 * @description Kiểm thử hiệu năng (load test) API CRUD đọc — đo độ trễ và thông lượng
 *   với N kết nối đồng thời. Tự chứa, không cần thư viện ngoài.
 *
 *   Tổng số request giữ DƯỚI ngưỡng rate limit dev (1000 req/15 phút) để đo được
 *   độ trễ xử lý thật thay vì độ trễ trả 429.
 *
 * Usage: node scripts/load-test.js [url] [connections] [totalRequests]
 */
const http = require('http');

const TARGET = process.argv[2] || 'http://127.0.0.1:8888/api/products?limit=20';
const CONNECTIONS = parseInt(process.argv[3] || '100', 10);
const TOTAL = parseInt(process.argv[4] || '950', 10);

const u = new URL(TARGET);
const opts = {
  hostname: u.hostname,
  port: u.port,
  path: u.pathname + u.search,
  method: 'GET',
};

const latencies = [];
const status = {};
let sent = 0;
let done = 0;
let startTime;

function once() {
  if (sent >= TOTAL) return;
  sent++;
  const t0 = process.hrtime.bigint();
  const req = http.request(opts, (res) => {
    res.on('data', () => {});
    res.on('end', () => {
      const ms = Number(process.hrtime.bigint() - t0) / 1e6;
      latencies.push(ms);
      status[res.statusCode] = (status[res.statusCode] || 0) + 1;
      done++;
      if (done >= TOTAL) return finish();
      once(); // worker gửi request tiếp theo
    });
  });
  req.on('error', (e) => {
    status['ERR:' + e.code] = (status['ERR:' + e.code] || 0) + 1;
    done++;
    if (done >= TOTAL) return finish();
    once();
  });
  req.end();
}

function pct(arr, p) {
  const i = Math.ceil((p / 100) * arr.length) - 1;
  return arr[Math.max(0, i)];
}

function finish() {
  const totalSec = Number(process.hrtime.bigint() - startTime) / 1e9;
  latencies.sort((a, b) => a - b);
  console.log('\n=== KẾT QUẢ LOAD TEST ===');
  console.log('Endpoint     :', TARGET);
  console.log('Kết nối đồng thời:', CONNECTIONS);
  console.log('Tổng request :', TOTAL);
  console.log('Thời gian    :', totalSec.toFixed(2) + 's');
  console.log('Throughput   :', (done / totalSec).toFixed(1) + ' req/s');
  console.log('Status codes :', JSON.stringify(status));
  console.log('--- Độ trễ (ms) ---');
  console.log('  min  :', latencies[0]?.toFixed(1));
  console.log('  p50  :', pct(latencies, 50)?.toFixed(1));
  console.log('  p95  :', pct(latencies, 95)?.toFixed(1));
  console.log('  p99  :', pct(latencies, 99)?.toFixed(1));
  console.log('  max  :', latencies[latencies.length - 1]?.toFixed(1));
  console.log('  avg  :', (latencies.reduce((s, x) => s + x, 0) / latencies.length).toFixed(1));
  process.exit(0);
}

console.log(`Bắt đầu load test: ${CONNECTIONS} kết nối, ${TOTAL} request → ${TARGET}`);
startTime = process.hrtime.bigint();
for (let i = 0; i < CONNECTIONS; i++) once();
