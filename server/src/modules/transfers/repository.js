import pool from '../../config/db.js';

export class TransferRepository {
  async createTransfer({ id, senderWalletId, recipientWalletId, amount, currency = 'USD', status = 'CREATED', idempotencyKey = null, description = '' }, client) {
    const db = client || pool;
    const query = `
      INSERT INTO transfers (id, sender_wallet_id, recipient_wallet_id, amount, currency, status, idempotency_key, description)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    const result = await db.query(query, [
      id,
      senderWalletId,
      recipientWalletId,
      BigInt(amount),
      currency,
      status,
      idempotencyKey,
      description,
    ]);
    return result.rows[0];
  }

  async updateTransferStatus(id, status, client) {
    const db = client || pool;
    const query = `
      UPDATE transfers 
      SET status = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query(query, [id, status]);
    return result.rows[0];
  }

  async findById(id, client) {
    const db = client || pool;
    const query = 'SELECT * FROM transfers WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  async findByIdempotencyKey(key, client) {
    const db = client || pool;
    const query = 'SELECT * FROM transfers WHERE idempotency_key = $1';
    const result = await db.query(query, [key]);
    return result.rows[0] || null;
  }
}

export default new TransferRepository();
