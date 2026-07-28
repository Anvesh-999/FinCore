import { Merchant, MerchantApiKey, Counter } from '../../database/models.js';

export class MerchantRepository {
  formatMerchant(m) {
    if (!m) return null;
    return {
      id: m._id,
      user_id: m.userId,
      business_name: m.businessName,
      business_type: m.businessType,
      status: m.status,
      created_at: m.createdAt,
      updated_at: m.updatedAt
    };
  }

  formatApiKey(k) {
    if (!k) return null;
    return {
      id: k._id,
      merchant_id: k.merchantId,
      public_key: k.publicKey,
      secret_key_hash: k.secretKeyHash,
      status: k.status,
      created_at: k.createdAt,
      updated_at: k.updatedAt
    };
  }

  async createMerchant({ userId, businessName, businessType = 'INDIVIDUAL', status = 'ACTIVE' }, session) {
    const nextId = await Counter.getNextSequence('merchants');
    const merchant = await Merchant.create(
      [{
        _id: nextId,
        userId: Number(userId),
        businessName,
        businessType,
        status
      }],
      { session }
    );
    return this.formatMerchant(merchant[0].toObject());
  }

  async findByUserId(userId, session) {
    const query = Merchant.findOne({ userId: Number(userId) });
    if (session) {
      query.session(session);
    }
    const merchant = await query.lean();
    return this.formatMerchant(merchant);
  }

  // API Key operations
  async createApiKey({ merchantId, publicKey, secretKeyHash }, session) {
    const nextId = await Counter.getNextSequence('merchant_api_keys');
    const key = await MerchantApiKey.create(
      [{
        _id: nextId,
        merchantId: Number(merchantId),
        publicKey,
        secretKeyHash,
        status: 'ACTIVE'
      }],
      { session }
    );
    return this.formatApiKey(key[0].toObject());
  }

  async getApiKeys(merchantId) {
    const keys = await MerchantApiKey.find({ merchantId: Number(merchantId), status: 'ACTIVE' }).sort({ createdAt: -1 }).lean();
    return keys.map(k => this.formatApiKey(k));
  }

  async revokeApiKey(keyId, merchantId) {
    const key = await MerchantApiKey.findOneAndUpdate(
      { _id: Number(keyId), merchantId: Number(merchantId) },
      { $set: { status: 'REVOKED', updatedAt: new Date() } },
      { new: true }
    );
    return this.formatApiKey(key ? key.toObject() : null);
  }

  async findKeyByPublicKey(publicKey) {
    const key = await MerchantApiKey.findOne({ publicKey, status: 'ACTIVE' }).lean();
    return this.formatApiKey(key);
  }
}

export default new MerchantRepository();
