import pool from '../../config/db.js';

export class RiskRepository {
  async createAssessment({ id, transactionType, transactionId, riskScore, decision, rulesTriggered }) {
    const query = `
      INSERT INTO risk_assessments (id, transaction_type, transaction_id, risk_score, decision, rules_triggered)
      VALUES ($1, $2, $3, $4, $5, $6::jsonb)
      RETURNING *
    `;
    const params = [id, transactionType, transactionId, riskScore, decision, JSON.stringify(rulesTriggered)];
    const { rows } = await pool.query(query, params);
    return rows[0];
  }

  async getAllAssessments() {
    const query = `
      SELECT r.*, 
             -- If transfer, retrieve sender and recipient email
             t.amount as transfer_amount,
             t.currency as transfer_currency,
             u_send.email as sender_email,
             u_rec.email as recipient_email,
             -- If payment, retrieve amount and merchant email
             p.amount as payment_amount,
             p.currency as payment_currency,
             u_merch.email as merchant_email,
             u_cust.email as customer_email
      FROM risk_assessments r
      LEFT JOIN peer_transfers t ON r.transaction_type = 'TRANSFER' AND r.transaction_id = t.id
      LEFT JOIN wallets w_send ON t.sender_wallet_id = w_send.id
      LEFT JOIN users u_send ON w_send.user_id = u_send.id
      LEFT JOIN wallets w_rec ON t.recipient_wallet_id = w_rec.id
      LEFT JOIN users u_rec ON w_rec.user_id = u_rec.id
      
      LEFT JOIN payments p ON r.transaction_type = 'PAYMENT' AND r.transaction_id = p.id
      LEFT JOIN users u_merch ON p.merchant_id = u_merch.id
      LEFT JOIN wallets w_cust ON p.customer_wallet_id = w_cust.id
      LEFT JOIN users u_cust ON w_cust.user_id = u_cust.id
      ORDER BY r.created_at DESC
    `;
    const { rows } = await pool.query(query);
    return rows;
  }
}

const riskRepository = new RiskRepository();
export default riskRepository;
