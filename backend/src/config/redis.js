const { createClient } = require('redis');
const logger = require('../utils/logger');

// Fallback in-memory khi Redis không khả dụng (môi trường dev)
const memStore = new Map();
const memClient = {
  setEx: (key, ttl, val) => {
    memStore.set(key, val);
    setTimeout(() => memStore.delete(key), ttl * 1000);
    return Promise.resolve();
  },
  get: (key) => Promise.resolve(memStore.get(key) ?? null),
  del: (key) => { memStore.delete(key); return Promise.resolve(); },
  set: (key, val, opts) => {
    memStore.set(key, val);
    if (opts?.EX) setTimeout(() => memStore.delete(key), opts.EX * 1000);
    return Promise.resolve();
  },
  // Hỗ trợ pattern glob đơn giản (chỉ dùng * làm wildcard)
  keys: (pattern) => {
    const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
    return Promise.resolve([...memStore.keys()].filter(k => regex.test(k)));
  },
};

// Singleton dạng Promise — mọi caller await cùng một lần khởi tạo
let initPromise = null;

const getRedisClient = () => {
  if (!initPromise) {
    initPromise = (async () => {
      const client = createClient({
        url: process.env.REDIS_URL,
        socket: {
          connectTimeout: 1500,
          reconnectStrategy: false, // không retry — fail nhanh để dùng fallback
        },
      });
      client.on('error', () => {});
      try {
        await client.connect();
        logger.info('Redis connected — JWT blacklist using Redis');
        return client;
      } catch {
        logger.warn('Redis unavailable — JWT blacklist using in-memory fallback');
        try { client.disconnect(); } catch {}
        return memClient;
      }
    })();
  }
  return initPromise;
};

module.exports = { getRedisClient };
