import pool from '../../config/db.js';

export class MerchantRepository {
  async createMerchant({ userId, businessName, businessType = 'INDIVIDUAL', status = 'ACTIVE' }, client) {
    const db = client || pool;
    const query = `
      INSERT INTO merchants (user_id, business_name, business_type, status)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `;
    const result = await db.query(query, [userId, businessName, businessType, status]);
    return result.rows[0];
  }

  async findByUserId(userId, client) {
    const db = client || pool;
    const query = 'SELECT * FROM merchants WHERE user_id = $1';
    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }

  // API Key operations
  async createApiKey({ merchantId, publicKey, secretKeyHash }, client) {
    const db = client || pool;
    const query = `
      INSERT INTO merchant_api_keys (merchant_id, public_key, secret_key_hash, status)
      VALUES ($1, $2, $3, 'ACTIVE')
      RETURNING id, merchant_id, public_key, status, created_at
    `;
    const result = await db.query(query, [merchantId, publicKey, secretKeyHash]);
    return result.rows[0];
  }

  async getApiKeys(merchantId) {
    const query = `
      SELECT id, public_key, status, created_at 
      FROM merchant_api_keys 
      WHERE merchant_id = $1 AND status = 'ACTIVE'
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [merchantId]);
    return result.rows;
  }

  async revokeApiKey(keyId, merchantId) {
    const query = `
      UPDATE merchant_api_keys 
      SET status = 'REVOKED', updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND merchant_id = $2
      RETURNING id, public_key, status
    `;
    const result = await pool.query(query, [keyId, merchantId]);
    return result.rows[0] || null;
  }

  // Retrieve key by public key (used for authenticating server-to-server payments)
  async findKeyByPublicKey(publicKey) {
    const query = `
      SELECT * 
      FROM merchant_api_keys 
      WHERE public_key = $1 AND status = 'ACTIVE'
    `;
    const result = await pool.query(query, [publicKey]);
    return result.rows[0] || null;
  }
}

export default new MerchantRepository();
