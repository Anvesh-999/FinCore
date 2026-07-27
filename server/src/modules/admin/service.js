import adminRepository from './repository.js';
import { AppError } from '../../middleware/error.js';

export class AdminService {
  async getWallets() {
    const wallets = await adminRepository.getAllWallets();
    return wallets.map(w => ({
      id: w.id,
      userId: w.user_id,
      currency: w.currency,
      status: w.status,
      availableBalance: w.available_balance.toString(),
      pendingBalance: w.pending_balance.toString(),
      createdAt: w.created_at,
      updatedAt: w.updated_at,
      user: {
        firstName: w.first_name,
        lastName: w.last_name,
        email: w.email,
        role: w.role,
      }
    }));
  }

  async updateWalletStatus(walletId, status) {
    if (!['ACTIVE', 'FROZEN', 'CLOSED'].includes(status)) {
      throw new AppError('VALIDATION_ERROR', `Invalid wallet status: ${status}`, 400);
    }
    const wallet = await adminRepository.updateWalletStatus(walletId, status);
    if (!wallet) {
      throw new AppError('WALLET_NOT_FOUND', `Wallet ID ${walletId} not found`, 404);
    }
    return {
      id: wallet.id,
      userId: wallet.user_id,
      currency: wallet.currency,
      status: wallet.status,
      availableBalance: wallet.available_balance.toString(),
      pendingBalance: wallet.pending_balance.toString(),
    };
  }

  async getTransfers() {
    const transfers = await adminRepository.getAllTransfers();
    return transfers.map(t => ({
      id: t.id,
      senderWalletId: t.sender_wallet_id,
      recipientWalletId: t.recipient_wallet_id,
      amount: t.amount.toString(),
      currency: t.currency,
      status: t.status,
      description: t.description,
      createdAt: t.created_at,
      updatedAt: t.updated_at,
      sender: {
        firstName: t.sender_first_name,
        lastName: t.sender_last_name,
        email: t.sender_email,
      },
      recipient: {
        firstName: t.recipient_first_name,
        lastName: t.recipient_last_name,
        email: t.recipient_email,
      }
    }));
  }

  async getLedgerBook() {
    const entries = await adminRepository.getLedgerBook();
    return entries.map(e => ({
      entryId: e.entry_id,
      transactionId: e.ledger_transaction_id,
      direction: e.direction,
      amount: e.amount.toString(),
      currency: e.currency,
      entryCreatedAt: e.entry_created_at,
      accountId: e.ledger_account_id,
      holderType: e.holder_type,
      holderId: e.holder_id,
      holder: e.holder_first_name ? {
        firstName: e.holder_first_name,
        lastName: e.holder_last_name,
        email: e.holder_email,
      } : null,
      referenceType: e.reference_type,
      referenceId: e.reference_id,
      transactionStatus: e.transaction_status,
      transactionCreatedAt: e.transaction_created_at,
    }));
  }
}

export default new AdminService();
