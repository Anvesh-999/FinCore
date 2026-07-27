import pool from '../../config/db.js';

export class WalletRepository {
  async createWallet({ userId, currency = 'USD', status = 'ACTIVE', availableBalance = 0, pendingBalance = 0 }, client) {
    const db = client || pool;
    const query = `
      INSERT INTO wallets (user_id, currency, status, available_balance, pending_balance)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await db.query(query, [
      userId,
      currency,
      status,
      BigInt(availableBalance),
      BigInt(pendingBalance),
    ]);
    return result.rows[0];
  }

  async findByUserId(userId, client) {
    const db = client || pool;
    const query = 'SELECT * FROM wallets WHERE user_id = $1';
    const result = await db.query(query, [userId]);
    return result.rows[0] || null;
  }

  async findById(id, client) {
    const db = client || pool;
    const query = 'SELECT * FROM wallets WHERE id = $1';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Locks a wallet row for update to prevent concurrent double-spending modifications.
   */
  async lockWallet(id, client) {
    const db = client || pool;
    const query = 'SELECT * FROM wallets WHERE id = $1 FOR UPDATE';
    const result = await db.query(query, [id]);
    return result.rows[0] || null;
  }

  /**
   * Safely adds or deducts funds from a wallet using custom amounts.
   */
  async updateBalances(id, availableChange, pendingChange, client) {
    const db = client || pool;
    const query = `
      UPDATE wallets 
      SET available_balance = available_balance + $2, 
          pending_balance = pending_balance + $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await db.query(query, [
      id,
      BigInt(availableChange),
      BigInt(pendingChange),
    ]);
    return result.rows[0];
  }

  /**
   * Fetches unified transaction activity history for a wallet, covering peer transfers.
   */
  async getTransactions(walletId, limit = 20, offset = 0) {
    // Find all transfers where this wallet is sender or recipient
    const query = `
      SELECT 
        id,
        'TRANSFER' as type,
        sender_wallet_id,
        recipient_wallet_id,
        amount,
        currency,
        status,
        description,
        created_at
      FROM transfers
      WHERE sender_wallet_id = $1 OR recipient_wallet_id = $1
      ORDER BY created_at DESC
      LIMIT $2 OFFSET $3
    `;
    const result = await pool.query(query, [walletId, limit, offset]);
    return result.rows;
  }
}

export default new WalletRepository();
