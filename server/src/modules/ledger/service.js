import crypto from 'crypto';
import pool from '../../config/db.js';
import { AppError } from '../../middleware/error.js';
import logger from '../../middleware/logger.js';

export class LedgerService {
  /**
   * Retrieves or creates the global system treasury ledger account.
   */
  async getOrCreateSystemAccount(client) {
    const db = client || pool;
    
    // Find existing system account
    const selectQuery = `
      SELECT * FROM ledger_accounts 
      WHERE holder_type = 'SYSTEM' 
      LIMIT 1
    `;
    const result = await db.query(selectQuery);
    if (result.rows[0]) {
      return result.rows[0];
    }

    // Create system account if missing
    const insertQuery = `
      INSERT INTO ledger_accounts (holder_type, holder_id)
      VALUES ('SYSTEM', NULL)
      RETURNING *
    `;
    const insertResult = await db.query(insertQuery);
    logger.info('Global system treasury ledger account initialized');
    return insertResult.rows[0];
  }

  /**
   * Creates a ledger account for a specific user.
   */
  async createLedgerAccount(holderType, holderId, client) {
    const db = client || pool;
    const query = `
      INSERT INTO ledger_accounts (holder_type, holder_id)
      VALUES ($1, $2)
      RETURNING *
    `;
    const result = await db.query(query, [holderType, holderId]);
    return result.rows[0];
  }

  /**
   * Retrieves a ledger account by user/merchant ID and type.
   */
  async findLedgerAccount(holderType, holderId, client) {
    const db = client || pool;
    const query = `
      SELECT * FROM ledger_accounts 
      WHERE holder_type = $1 AND holder_id = $2
    `;
    const result = await db.query(query, [holderType, holderId]);
    return result.rows[0] || null;
  }

  /**
   * Posts a balanced double-entry transaction.
   * Every entry MUST balance: Sum(DEBIT) === Sum(CREDIT).
   */
  async postTransaction({ referenceType, referenceId, entries }, client) {
    const db = client || pool;
    
    // Validate entry balances
    let totalDebit = 0n;
    let totalCredit = 0n;
    
    for (const entry of entries) {
      const amount = BigInt(entry.amount);
      if (amount <= 0n) {
        throw new AppError('INVALID_LEDGER_ENTRY', 'Ledger entry amount must be greater than zero', 400);
      }
      if (entry.direction === 'DEBIT') {
        totalDebit += amount;
      } else if (entry.direction === 'CREDIT') {
        totalCredit += amount;
      } else {
        throw new AppError('INVALID_LEDGER_ENTRY', `Invalid entry direction: ${entry.direction}`, 400);
      }
    }

    if (totalDebit !== totalCredit) {
      throw new AppError(
        'UNBALANCED_LEDGER_TRANSACTION',
        `Ledger entries do not balance. Total debits: ${totalDebit}, Total credits: ${totalCredit}`,
        400
      );
    }

    const transactionId = crypto.randomUUID();

    // 1. Create Ledger Transaction
    const txQuery = `
      INSERT INTO ledger_transactions (id, reference_type, reference_id, status)
      VALUES ($1, $2, $3, 'POSTED')
      RETURNING *
    `;
    await db.query(txQuery, [transactionId, referenceType, referenceId]);

    // 2. Create Ledger Entries
    const entryQuery = `
      INSERT INTO ledger_entries (ledger_transaction_id, ledger_account_id, direction, amount, currency)
      VALUES ($1, $2, $3, $4, $5)
    `;

    for (const entry of entries) {
      await db.query(entryQuery, [
        transactionId,
        entry.accountId,
        entry.direction,
        BigInt(entry.amount),
        entry.currency || 'USD',
      ]);
    }

    logger.info(`Posted ledger transaction ${transactionId} (${referenceType})`);
    return transactionId;
  }
}

export default new LedgerService();
