import pool from '../../config/db.js';

export class RefundRepository {
  async createRefund({ id, paymentId, amount, currency = 'USD', status = 'CREATED', description = null }, client) {
    const db = client || pool;
    const query = `
      INSERT INTO refunds (id, payment_id, amount, currency, status, description)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await db.query(query, [
      id,
      paymentId,
      BigInt(amount),
      currency,
      status,
      description
    ]);
    return result.rows[0];
  }

  async findById(id, client) {
    const db = client || pool;
    const query = 'SELECT * FROM refunds WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  async getRefundsByPaymentId(paymentId, client) {
    const db = client || pool;
    const query = 'SELECT * FROM refunds WHERE payment_id = $1 ORDER BY created_at DESC';
    const result = await db.query(query, [paymentId]);
    return result.rows;
  }

  async getRefundsSumForPayment(paymentId, client) {
    const db = client || pool;
    const query = `
      SELECT COALESCE(SUM(amount), 0) as total_refunded 
      FROM refunds 
      WHERE payment_id = $1 AND status = 'SUCCEEDED'
    `;
    const result = await db.query(query, [paymentId]);
    return BigInt(result.rows[0].total_refunded);
  }

  async getMerchantRefunds(merchantId) {
    const query = `
      SELECT r.*, p.reference, p.amount as payment_amount
      FROM refunds r
      JOIN payments p ON r.payment_id = p.id
      WHERE p.merchant_id = $1
      ORDER BY r.created_at DESC
    `;
    const result = await pool.query(query, [merchantId]);
    return result.rows;
  }

  async getAllRefunds() {
    const query = `
      SELECT r.*, p.amount as payment_amount, p.currency as payment_currency, p.reference,
             mu.first_name as merchant_first_name, mu.last_name as merchant_last_name, mu.email as merchant_email,
             cu.first_name as customer_first_name, cu.last_name as customer_last_name, cu.email as customer_email
      FROM refunds r
      JOIN payments p ON r.payment_id = p.id
      JOIN users mu ON p.merchant_id = mu.id
      LEFT JOIN wallets cw ON p.customer_wallet_id = cw.id
      LEFT JOIN users cu ON cw.user_id = cu.id
      ORDER BY r.created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  async updateRefundStatus(id, status, client) {
    const db = client || pool;
    const query = `
      UPDATE refunds
      SET status = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query(query, [id, status]);
    return result.rows[0];
  }
}

export default new RefundRepository();
