const { createClient } = require('redis');
const logger = require('../utils/logger');

// In-memory fallback when Redis is unavailable (dev environment)
const memBlacklist = new Map();
const memClient = {
  setEx: (key, ttl, val) => {
    memBlacklist.set(key, val);
    setTimeout(() => memBlacklist.delete(key), ttl * 1000);
    return Promise.resolve();
  },
  get: (key) => Promise.resolve(memBlacklist.get(key) || null),
};

// Promise-based singleton — all callers await the same initialization
let initPromise = null;

const getRedisClient = () => {
  if (!initPromise) {
    initPromise = (async () => {
      const client = createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        socket: {
          connectTimeout: 1500,
          reconnectStrategy: false, // no retries — fail fast
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
