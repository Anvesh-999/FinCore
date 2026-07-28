import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import merchantRepository from './repository.js';
import { AppError } from '../../middleware/error.js';

export class MerchantService {
  async getMerchantByUserId(userId) {
    const merchant = await merchantRepository.findByUserId(userId);
    if (!merchant) {
      throw new AppError('MERCHANT_NOT_FOUND', 'Active sandbox merchant profile could not be found', 404);
    }
    return merchant;
  }

  async generateApiKey(merchantId) {
    // Generate secure keys
    const publicKey = 'pk_sandbox_' + crypto.randomBytes(16).toString('hex');
    const secretKey = 'sk_sandbox_' + crypto.randomBytes(24).toString('hex');
    
    // Hash the secret
    const salt = await bcrypt.genSalt(10);
    const secretKeyHash = await bcrypt.hash(secretKey, salt);

    const keyRecord = await merchantRepository.createApiKey({
      merchantId,
      publicKey,
      secretKeyHash
    });

    return {
      id: keyRecord.id,
      publicKey: keyRecord.public_key,
      secretKey, // Return plaintext secret EXACTLY once to show to user
      status: keyRecord.status,
      createdAt: keyRecord.created_at
    };
  }

  async listApiKeys(merchantId) {
    const keys = await merchantRepository.getApiKeys(merchantId);
    return keys.map(k => ({
      id: k.id,
      publicKey: k.public_key,
      status: k.status,
      createdAt: k.created_at
    }));
  }

  async revokeApiKey(keyId, merchantId) {
    const result = await merchantRepository.revokeApiKey(keyId, merchantId);
    if (!result) {
      throw new AppError('API_KEY_NOT_FOUND', 'API Key not found or belongs to another merchant', 404);
    }
    return result;
  }

  // Validates API credentials for payment checkouts (returns the user/merchant ID if successful)
  async authenticateApiKey(publicKey, secretKey) {
    const keyRecord = await merchantRepository.findKeyByPublicKey(publicKey);
    if (!keyRecord) {
      return null;
    }

    const isMatch = await bcrypt.compare(secretKey, keyRecord.secret_key_hash);
    if (!isMatch) {
      return null;
    }

    return keyRecord.merchant_id;
  }
}

export default new MerchantService();
