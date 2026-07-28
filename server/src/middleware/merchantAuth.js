import merchantService from '../modules/merchants/service.js';
import { AppError } from './error.js';

export const authenticateMerchantApiKey = async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'] || req.headers['authorization']?.replace('Bearer ', '');
    if (!apiKey) {
      return next(new AppError('UNAUTHORIZED', 'API key is required for merchant endpoints', 401));
    }

    const parts = apiKey.split(':');
    if (parts.length !== 2) {
      return next(new AppError('UNAUTHORIZED', 'Invalid API key format. Expected public_key:secret_key', 401));
    }

    const [publicKey, secretKey] = parts;
    const merchantId = await merchantService.authenticateApiKey(publicKey, secretKey);
    if (!merchantId) {
      return next(new AppError('UNAUTHORIZED', 'Invalid API key or secret', 401));
    }

    // Set merchantId in request context
    req.merchantId = merchantId;
    next();
  } catch (err) {
    next(err);
  }
};
