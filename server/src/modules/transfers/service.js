import crypto from 'crypto';
import pool from '../../config/db.js';
import walletRepository from '../wallets/repository.js';
import transferRepository from './repository.js';
import ledgerService from '../ledger/service.js';
import authRepository from '../auth/repository.js';
import { AppError } from '../../middleware/error.js';
import logger from '../../middleware/logger.js';

export class TransferService {
  /**
   * Processes an atomic customer-to-customer peer transfer.
   * Utilizes postgres transactions and ordered row locks to prevent deadlocks and double-spending.
   */
  async createTransfer({ senderUserId, recipientEmail, amount, description = '', idempotencyKey = null }) {
    const transferAmount = BigInt(amount);
    if (transferAmount <= 0n) {
      throw new AppError('INVALID_AMOUNT', 'Transfer amount must be greater than zero', 400);
    }

    const normalizedEmail = recipientEmail.toLowerCase().trim();
    
    // 1. Resolve sender and recipient accounts
    const senderUser = await authRepository.findById(senderUserId);
    const recipientUser = await authRepository.findByEmail(normalizedEmail);

    if (!recipientUser) {
      throw new AppError('RECIPIENT_NOT_FOUND', `Recipient user with email ${recipientEmail} could not be found`, 404);
    }

    if (senderUser.id === recipientUser.id) {
      throw new AppError('INVALID_RECIPIENT', 'You cannot transfer funds to your own account', 400);
    }

    // Connect DB client
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // 2. Fetch wallets
      const senderWallet = await walletRepository.findByUserId(senderUser.id, client);
      const recipientWallet = await walletRepository.findByUserId(recipientUser.id, client);

      if (!senderWallet) {
        throw new AppError('WALLET_NOT_FOUND', 'Sender wallet could not be located', 404);
      }
      if (!recipientWallet) {
        throw new AppError('WALLET_NOT_FOUND', 'Recipient wallet could not be located', 404);
      }

      // 3. Acquire locks in ascending order of ID to prevent deadlock
      const lockOrder = [senderWallet, recipientWallet].sort((a, b) => a.id - b.id);
      
      const lockedWallets = {};
      for (const w of lockOrder) {
        lockedWallets[w.id] = await walletRepository.lockWallet(w.id, client);
      }

      const lockedSenderWallet = lockedWallets[senderWallet.id];
      const lockedRecipientWallet = lockedWallets[recipientWallet.id];

      // 4. Validate statuses
      if (lockedSenderWallet.status !== 'ACTIVE') {
        throw new AppError('WALLET_FROZEN', `Sender wallet is currently ${lockedSenderWallet.status}`, 400);
      }
      if (lockedRecipientWallet.status !== 'ACTIVE') {
        throw new AppError('WALLET_FROZEN', `Recipient wallet is currently ${lockedRecipientWallet.status}`, 400);
      }

      // 5. Check available balance
      if (BigInt(lockedSenderWallet.available_balance) < transferAmount) {
        throw new AppError('INSUFFICIENT_FUNDS', 'Your wallet does not have sufficient available funds', 400);
      }

      // 6. Create transfer record (status: PROCESSING)
      const transferId = crypto.randomUUID();
      const transfer = await transferRepository.createTransfer({
        id: transferId,
        senderWalletId: senderWallet.id,
        recipientWalletId: recipientWallet.id,
        amount: transferAmount,
        currency: 'USD',
        status: 'PROCESSING',
        idempotencyKey,
        description,
      }, client);

      // 7. Resolve double-entry ledger accounts
      const senderLedgerAccount = await ledgerService.findLedgerAccount('CUSTOMER', senderUser.id, client);
      const recipientLedgerAccount = await ledgerService.findLedgerAccount('CUSTOMER', recipientUser.id, client);

      if (!senderLedgerAccount || !recipientLedgerAccount) {
        throw new AppError('LEDGER_ACCOUNT_NOT_FOUND', 'Ledger accounts for transaction mapping could not be verified', 404);
      }

      // 8. Post to double-entry ledger
      await ledgerService.postTransaction({
        referenceType: 'TRANSFER',
        referenceId: transferId,
        entries: [
          {
            accountId: senderLedgerAccount.id,
            direction: 'DEBIT',
            amount: transferAmount,
            currency: 'USD',
          },
          {
            accountId: recipientLedgerAccount.id,
            direction: 'CREDIT',
            amount: transferAmount,
            currency: 'USD',
          }
        ]
      }, client);

      // 9. Update wallet balances
      await walletRepository.updateBalances(senderWallet.id, -transferAmount, 0n, client);
      await walletRepository.updateBalances(recipientWallet.id, transferAmount, 0n, client);

      // 10. Update transfer status (status: COMPLETED)
      const completedTransfer = await transferRepository.updateTransferStatus(transferId, 'COMPLETED', client);

      await client.query('COMMIT');
      logger.info(`Transfer ${transferId} of ${transferAmount} cents completed from ${senderUser.email} to ${recipientUser.email}`);
      
      return {
        id: completedTransfer.id,
        senderWalletId: completedTransfer.sender_wallet_id,
        recipientWalletId: completedTransfer.recipient_wallet_id,
        amount: completedTransfer.amount.toString(),
        status: completedTransfer.status,
        description: completedTransfer.description,
        createdAt: completedTransfer.created_at,
      };
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getTransferById(id) {
    const transfer = await transferRepository.findById(id);
    if (!transfer) {
      throw new AppError('TRANSFER_NOT_FOUND', 'Transfer entry could not be found', 404);
    }
    return transfer;
  }
}

export default new TransferService();
