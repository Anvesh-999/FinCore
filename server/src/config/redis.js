import { createClient } from 'redis';
import config from './config.js';
import logger from '../middleware/logger.js';

export const redisClient = createClient({
  url: config.redis.url,
});

redisClient.on('error', (err) => {
  logger.error('Redis client runtime connection error', err);
});

redisClient.on('connect', () => {
  logger.info('Successfully connected to Redis cache database');
});

export const connectRedis = async () => {
  try {
    if (!redisClient.isOpen) {
      await redisClient.connect();
    }
    return true;
  } catch (err) {
    logger.error(`Redis Connection Failure: ${err.message}`);
    return false;
  }
};

export const testRedisConnection = async () => {
  try {
    if (!redisClient.isOpen) {
      return false;
    }
    await redisClient.ping();
    return true;
  } catch (err) {
    return false;
  }
};

export default redisClient;
