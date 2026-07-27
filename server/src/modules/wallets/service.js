import walletRepository from './repository.js';
import { AppError } from '../../middleware/error.js';

export class WalletService {
  async getWalletByUserId(userId) {
    const wallet = await walletRepository.findByUserId(userId);
    if (!wallet) {
      throw new AppError('WALLET_NOT_FOUND', 'Active sandbox wallet could not be found', 404);
    }
    return {
      id: wallet.id,
      currency: wallet.currency,
      status: wallet.status,
      // Format balances to strings/numbers if needed, but return BigInt strings
      availableBalance: wallet.available_balance.toString(),
      pendingBalance: wallet.pending_balance.toString(),
      createdAt: wallet.created_at,
    };
  }

  async getTransactions(userId, limit = 20, offset = 0) {
    const wallet = await walletRepository.findByUserId(userId);
    if (!wallet) {
      throw new AppError('WALLET_NOT_FOUND', 'Active sandbox wallet could not be found', 404);
    }

    const txs = await walletRepository.getTransactions(wallet.id, limit, offset);
    return txs.map((tx) => ({
      id: tx.id,
      type: tx.type,
      direction: tx.sender_wallet_id === wallet.id ? 'SENT' : 'RECEIVED',
      amount: tx.amount.toString(),
      currency: tx.currency,
      status: tx.status,
      description: tx.description,
      createdAt: tx.created_at,
    }));
  }
}

export default new WalletService();
