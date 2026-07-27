import pool from '../../config/db.js';

export class AdminRepository {
  async getAllWallets() {
    const query = `
      SELECT 
        w.id,
        w.user_id,
        w.currency,
        w.status,
        w.available_balance,
        w.pending_balance,
        w.created_at,
        w.updated_at,
        u.first_name,
        u.last_name,
        u.email,
        u.role
      FROM wallets w
      JOIN users u ON w.user_id = u.id
      ORDER BY w.id ASC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  async updateWalletStatus(walletId, status) {
    const query = `
      UPDATE wallets
      SET status = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    const result = await pool.query(query, [walletId, status]);
    return result.rows[0] || null;
  }

  async getAllTransfers() {
    const query = `
      SELECT 
        t.id,
        t.sender_wallet_id,
        t.recipient_wallet_id,
        t.amount,
        t.currency,
        t.status,
        t.description,
        t.created_at,
        t.updated_at,
        su.first_name as sender_first_name,
        su.last_name as sender_last_name,
        su.email as sender_email,
        ru.first_name as recipient_first_name,
        ru.last_name as recipient_last_name,
        ru.email as recipient_email
      FROM transfers t
      JOIN wallets sw ON t.sender_wallet_id = sw.id
      JOIN users su ON sw.user_id = su.id
      JOIN wallets rw ON t.recipient_wallet_id = rw.id
      JOIN users ru ON rw.user_id = ru.id
      ORDER BY t.created_at DESC
    `;
    const result = await pool.query(query);
    return result.rows;
  }

  async getLedgerBook() {
    const query = `
      SELECT 
        le.id as entry_id,
        le.ledger_transaction_id,
        le.direction,
        le.amount,
        le.currency,
        le.created_at as entry_created_at,
        la.id as ledger_account_id,
        la.holder_type,
        la.holder_id,
        u.first_name as holder_first_name,
        u.last_name as holder_last_name,
        u.email as holder_email,
        lt.reference_type,
        lt.reference_id,
        lt.status as transaction_status,
        lt.created_at as transaction_created_at
      FROM ledger_entries le
      JOIN ledger_transactions lt ON le.ledger_transaction_id = lt.id
      JOIN ledger_accounts la ON le.ledger_account_id = la.id
      LEFT JOIN users u ON la.holder_id = u.id AND la.holder_type = 'CUSTOMER'
      ORDER BY lt.created_at DESC, le.id ASC
    `;
    const result = await pool.query(query);
    return result.rows;
  }
}

export default new AdminRepository();
