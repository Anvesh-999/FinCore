import pool from '../../config/db.js';

export class PaymentRepository {
  async createPayment({ id, merchantId, amount, currency = 'USD', reference, metadata = {}, status = 'CREATED', idempotencyKey = null }, client) {
    const db = client || pool;
    const query = `
      INSERT INTO payments (id, merchant_id, amount, currency, reference, metadata, status, idempotency_key)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const result = await db.query(query, [
      id,
      merchantId,
      BigInt(amount),
      currency,
      reference,
      JSON.stringify(metadata),
      status,
      idempotencyKey
    ]);
    return result.rows[0];
  }

  async findById(id, client) {
    const db = client || pool;
    const query = `
      SELECT p.*, u.first_name as business_name
      FROM payments p
      JOIN users u ON p.merchant_id = u.id
      WHERE p.id = $1
    `;
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  async findByIdempotencyKey(merchantId, idempotencyKey, client) {
    const db = client || pool;
    const query = 'SELECT * FROM payments WHERE merchant_id = $1 AND idempotency_key = $2';
    const result = await db.query(query, [merchantId, idempotencyKey]);
    return result.rows[0] || null;
  }

  async lockPayment(id, client) {
    const db = client || pool;
    const query = 'SELECT * FROM payments WHERE id = $1 FOR UPDATE';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  async updatePaymentStatus(id, status, customerWalletId = null, client) {
    const db = client || pool;
    const query = `
      UPDATE payments
      SET status = $2, 
          customer_wallet_id = COALESCE($3, customer_wallet_id),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query(query, [id, status, customerWalletId]);
    return result.rows[0];
  }

  async getMerchantPayments(merchantId) {
    const query = `
      SELECT * FROM payments 
      WHERE merchant_id = $1 
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [merchantId]);
    return result.rows;
  }

  async getAllPayments() {
    const query = `
      SELECT p.*, mu.first_name as merchant_first_name, mu.last_name as merchant_last_name, mu.email as merchant_email,
             cu.first_name as customer_first_name, cu.last_name as customer_last_name, cu.email as customer_email
      FROM payments p
      JOIN users mu ON p.merchant_id = mu.id
      LEFT JOIN wallets cw ON p.customer_wallet_id = cw.id
      LEFT JOIN users cu ON cw.user_id = cu.id
      ORDER BY p.created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  async getMerchantStats(merchantId) {
    // Total Volume, success rate, failed count, refund volume
    const query = `
      SELECT 
        COALESCE(SUM(CASE WHEN status = 'SUCCEEDED' OR status = 'PARTIALLY_REFUNDED' OR status = 'REFUNDED' THEN amount ELSE 0 END), 0) as total_volume,
        COUNT(CASE WHEN status = 'SUCCEEDED' OR status = 'PARTIALLY_REFUNDED' OR status = 'REFUNDED' THEN 1 END) as success_count,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_count,
        COUNT(*) as total_count,
        COALESCE(SUM(
          CASE 
            WHEN status = 'REFUNDED' THEN amount
            ELSE 0
          END
        ), 0) as full_refund_volume
      FROM payments
      WHERE merchant_id = $1
    `;
    const result = await pool.query(query, [merchantId]);
    return result.rows[0];
  }
}

export default new PaymentRepository();
