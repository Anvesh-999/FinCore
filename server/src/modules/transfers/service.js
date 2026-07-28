import crypto from 'crypto';
import { Wallet } from '../../database/models.js';
import walletRepository from '../wallets/repository.js';
import transferRepository from './repository.js';
import ledgerService from '../ledger/service.js';
import authRepository from '../auth/repository.js';
import riskService from '../risk/service.js';
import { emitToRoom } from '../../config/socket.js';
import { AppError } from '../../middleware/error.js';
import logger from '../../middleware/logger.js';

export class TransferService {
  /**
   * Processes an atomic customer-to-customer peer transfer.
   * Utilizes MongoDB atomic checks to prevent double-spending and ensure consistency.
   */
  async createTransfer({ senderUserId, recipientEmail, amount, description = '', idempotencyKey = null }) {
    const transferAmount = Number(amount);
    if (transferAmount <= 0) {
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

    // 2. Fetch wallets
    const senderWallet = await walletRepository.findByUserId(senderUser.id);
    const recipientWallet = await walletRepository.findByUserId(recipientUser.id);

    if (!senderWallet) {
      throw new AppError('WALLET_NOT_FOUND', 'Sender wallet could not be located', 404);
    }
    if (!recipientWallet) {
      throw new AppError('WALLET_NOT_FOUND', 'Recipient wallet could not be located', 404);
    }

    // 3. Validate statuses
    if (senderWallet.status !== 'ACTIVE') {
      throw new AppError('WALLET_FROZEN', `Sender wallet is currently ${senderWallet.status}`, 400);
    }
    if (recipientWallet.status !== 'ACTIVE') {
      throw new AppError('WALLET_FROZEN', `Recipient wallet is currently ${recipientWallet.status}`, 400);
    }

    // 4. Concurrency double-spend prevention using atomic conditional update
    const senderWalletUpdate = await Wallet.findOneAndUpdate(
      { _id: senderWallet.id, availableBalance: { $gte: transferAmount }, status: 'ACTIVE' },
      { $inc: { availableBalance: -transferAmount }, $set: { updatedAt: new Date() } },
      { new: true }
    );

    if (!senderWalletUpdate) {
      throw new AppError('INSUFFICIENT_FUNDS', 'Your wallet does not have sufficient available funds', 400);
    }

    let transferId = null;
    try {
      // 5. Create transfer record (status: PROCESSING)
      transferId = crypto.randomUUID();
      const transfer = await transferRepository.createTransfer({
        id: transferId,
        senderWalletId: senderWallet.id,
        recipientWalletId: recipientWallet.id,
        amount: transferAmount,
        currency: 'USD',
        status: 'PROCESSING',
        idempotencyKey,
        description,
      });

      // Run risk assessment check
      await riskService.checkTransactionRisk(senderWallet.id, 'TRANSFER', transferId, transferAmount.toString());

      // 6. Resolve double-entry ledger accounts
      const senderLedgerAccount = await ledgerService.findLedgerAccount('CUSTOMER', senderUser.id);
      const recipientLedgerAccount = await ledgerService.findLedgerAccount('CUSTOMER', recipientUser.id);

      if (!senderLedgerAccount || !recipientLedgerAccount) {
        throw new AppError('LEDGER_ACCOUNT_NOT_FOUND', 'Ledger accounts for transaction mapping could not be verified', 404);
      }

      // 7. Post to double-entry ledger
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
      });

      // 8. Update recipient wallet balance
      await walletRepository.updateBalances(recipientWallet.id, transferAmount, 0);

      // 9. Update transfer status (status: COMPLETED)
      const completedTransfer = await transferRepository.updateTransferStatus(transferId, 'COMPLETED');

      logger.info(`Transfer ${transferId} of ${transferAmount} cents completed from ${senderUser.email} to ${recipientUser.email}`);
      
      const payload = {
        id: completedTransfer.id,
        senderWalletId: completedTransfer.sender_wallet_id,
        recipientWalletId: completedTransfer.recipient_wallet_id,
        amount: completedTransfer.amount.toString(),
        status: completedTransfer.status,
        description: completedTransfer.description,
        createdAt: completedTransfer.created_at,
        sender: { firstName: senderUser.first_name, lastName: senderUser.last_name, email: senderUser.email },
        recipient: { firstName: recipientUser.first_name, lastName: recipientUser.last_name, email: recipientUser.email }
      };

      // Emit real-time updates
      emitToRoom(`customer_${senderUser.id}`, 'transfer.updated', payload);
      emitToRoom(`customer_${recipientUser.id}`, 'transfer.updated', payload);
      emitToRoom('admin', 'transfer.updated', payload);

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
      // Compensating action: revert the balance deduction from sender's wallet
      await Wallet.findByIdAndUpdate(senderWallet.id, {
        $inc: { availableBalance: transferAmount },
        $set: { updatedAt: new Date() }
      });
      if (transferId) {
        await transferRepository.updateTransferStatus(transferId, 'FAILED').catch(() => {});
      }
      throw err;
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
