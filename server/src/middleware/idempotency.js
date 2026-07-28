import crypto from 'crypto';
import { IdempotencyRecord } from '../database/models.js';
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

  // Generate request fingerprint: combines path, stringified body, and user ID
  const userId = req.user?.id || 'anonymous';
  const bodyString = JSON.stringify(req.body || {});
  const fingerprint = crypto
    .createHash('sha256')
    .update(`${req.originalUrl}:${bodyString}:${userId}`)
    .digest('hex');

  try {
    const record = await IdempotencyRecord.findOne({ idempotencyKey: key });
    
    if (record) {
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
        if (record.requestHash !== fingerprint) {
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
          .status(record.responseStatus)
          .set('X-Cache-Lookup', 'HIT - Idempotent')
          .json(record.responseBody);
      }
    }

    // Attempt to atomically register the processing key
    try {
      await IdempotencyRecord.create({
        idempotencyKey: key,
        requestHash: fingerprint,
        status: 'PROCESSING'
      });
    } catch (err) {
      // Handle MongoDB duplicate key error (code 11000)
      if (err.code === 11000) {
        return next(
          new AppError(
            'IDEMPOTENCY_CONFLICT',
            'A request with this idempotency key is already being processed or completed',
            409
          )
        );
      }
      throw err;
    }

    // Override res.json to capture response on successful completion
    const originalJson = res.json;
    res.json = function (body) {
      res.json = originalJson;

      if (res.statusCode >= 200 && res.statusCode < 300) {
        IdempotencyRecord.findOneAndUpdate(
          { idempotencyKey: key },
          {
            $set: {
              status: 'COMPLETED',
              responseStatus: res.statusCode,
              responseBody: body,
              requestHash: fingerprint
            }
          }
        ).catch((err) => {
          logger.error('Failed to save completed idempotency cache in MongoDB:', err);
        });
      } else {
        // If request failed, remove the lock so they can retry with same key
        IdempotencyRecord.deleteOne({ idempotencyKey: key }).catch((err) => {
          logger.error('Failed to clean up failed idempotency key in MongoDB:', err);
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
