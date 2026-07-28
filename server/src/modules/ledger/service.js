import crypto from 'crypto';
import { LedgerAccount, LedgerTransaction, LedgerEntry, Counter } from '../../database/models.js';
import { AppError } from '../../middleware/error.js';
import logger from '../../middleware/logger.js';

export class LedgerService {
  /**
   * Helper to format ledger accounts to match database row format.
   */
  formatLedgerAccount(account) {
    if (!account) return null;
    return {
      id: account._id,
      holder_type: account.holderType,
      holder_id: account.holderId,
      created_at: account.createdAt
    };
  }

  /**
   * Retrieves or creates the global system treasury ledger account.
   */
  async getOrCreateSystemAccount(session) {
    // Find existing system account
    let account = await LedgerAccount.findOne({ holderType: 'SYSTEM' });
    if (account) {
      return this.formatLedgerAccount(account.toObject());
    }

    // Create system account if missing
    const nextId = await Counter.getNextSequence('ledger_accounts');
    const newAccountList = await LedgerAccount.create(
      [{ _id: nextId, holderType: 'SYSTEM', holderId: null }],
      { session }
    );
    logger.info('Global system treasury ledger account initialized');
    return this.formatLedgerAccount(newAccountList[0].toObject());
  }

  /**
   * Creates a ledger account for a specific user.
   */
  async createLedgerAccount(holderType, holderId, session) {
    const nextId = await Counter.getNextSequence('ledger_accounts');
    const account = await LedgerAccount.create(
      [{ _id: nextId, holderType, holderId: Number(holderId) }],
      { session }
    );
    return this.formatLedgerAccount(account[0].toObject());
  }

  /**
   * Retrieves a ledger account by user/merchant ID and type.
   */
  async findLedgerAccount(holderType, holderId) {
    const account = await LedgerAccount.findOne({ holderType, holderId: Number(holderId) }).lean();
    return this.formatLedgerAccount(account);
  }

  /**
   * Posts a balanced double-entry transaction.
   * Every entry MUST balance: Sum(DEBIT) === Sum(CREDIT).
   */
  async postTransaction({ referenceType, referenceId, entries }, session) {
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
    await LedgerTransaction.create(
      [{
        _id: transactionId,
        referenceType,
        referenceId,
        status: 'POSTED'
      }],
      { session }
    );

    // 2. Create Ledger Entries
    const entriesData = entries.map(entry => ({
      ledgerTransactionId: transactionId,
      ledgerAccountId: Number(entry.accountId),
      direction: entry.direction,
      amount: Number(entry.amount),
      currency: entry.currency || 'USD'
    }));

    await LedgerEntry.create(entriesData, { session });

    logger.info(`Posted ledger transaction ${transactionId} (${referenceType})`);
    return transactionId;
  }
}

export default new LedgerService();
