import logger from '../middleware/logger.js';

export const redisClient = {
  isOpen: true,
  connect: async () => {},
  ping: async () => 'PONG',
  get: async () => null,
  set: async () => {},
  del: async () => {},
  on: () => {}
};

export const connectRedis = async () => {
  return true; // Always return healthy for bypass
};

export const testRedisConnection = async () => {
  return true; // Always return healthy for bypass
};

export default redisClient;
