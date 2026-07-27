import crypto from 'crypto';
import redisClient from '../config/redis.js';
import { AppError } from './error.js';
import logger from './logger.js';

export const idempotency = async (req, res, next) => {
  // Only apply to mutating requests
  if (!['POST', 'PUT', 'PATCH'].includes(req.method)) {
    return next();
  }

  const key = req.headers['idempotency-key'];
  if (!key) {
    return next();
  }

  // Ensure Redis client is connected
  if (!redisClient.isOpen) {
    logger.warn('Redis client disconnected. Bypassing idempotency middleware.');
    return next();
  }

  // Generate request fingerprint: combines path, stringified body, and user ID
  const userId = req.user?.id || 'anonymous';
  const bodyString = JSON.stringify(req.body || {});
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${req.originalUrl}:${bodyString}:${userId}`)
    .digest('hex');

  const redisKey = `idempotency:${key}`;

  try {
    const cachedRecord = await redisClient.get(redisKey);
    
    if (cachedRecord) {
      const record = JSON.parse(cachedRecord);
      
      if (record.status === 'PROCESSING') {
        return next(
          new AppError(
            'IDEMPOTENCY_CONFLICT',
            'A request with this idempotency key is already being processed',
            409
          )
        );
      }

      if (record.status === 'COMPLETED') {
        // Enforce: Same key + different request -> reject
        if (record.fingerprint !== fingerprint) {
          return next(
            new AppError(
              'IDEMPOTENCY_CONFLICT',
              'Idempotency key has already been used for a different request payload',
              400
            )
          );
        }

        // Return cached result
        logger.info(`Idempotent cache hit for key: ${key}`);
        return res
          .status(record.statusCode)
          .set('X-Cache-Lookup', 'HIT - Idempotent')
          .json(record.responseBody);
      }
    }

    // Save key in Redis with state 'PROCESSING'
    await redisClient.set(
      redisKey,
      JSON.stringify({
        status: 'PROCESSING',
        fingerprint,
      }),
      {
        EX: 86400, // 24 hours expiry
      }
    );

    // Override res.json to capture response on successful completion
    const originalJson = res.json;
    res.json = function (body) {
      // Revert function to avoid issues
      res.json = originalJson;

      // Async save to Redis
      if (res.statusCode >= 200 && res.statusCode < 300) {
        redisClient.set(
          redisKey,
          JSON.stringify({
            status: 'COMPLETED',
            fingerprint,
            statusCode: res.statusCode,
            responseBody: body,
          }),
          {
            EX: 86400, // 24 hours
          }
        ).catch((err) => {
          logger.error('Failed to save completed idempotency cache in Redis:', err);
        });
      } else {
        // If request failed, remove the lock so they can try again with same key
        redisClient.del(redisKey).catch((err) => {
          logger.error('Failed to clean up failed idempotency key in Redis:', err);
        });
      }

      return originalJson.call(this, body);
    };

    next();
  } catch (err) {
    logger.error('Idempotency middleware error:', err);
    next(err);
  }
};

export default idempotency;
