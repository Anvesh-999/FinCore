import { Wallet, Counter, Transfer } from '../../database/models.js';

export class WalletRepository {
  formatWallet(wallet) {
    if (!wallet) return null;
    return {
      id: wallet._id,
      user_id: wallet.userId,
      userId: wallet.userId,
      currency: wallet.currency,
      status: wallet.status,
      available_balance: wallet.availableBalance,
      availableBalance: wallet.availableBalance,
      pending_balance: wallet.pendingBalance,
      pendingBalance: wallet.pendingBalance,
      created_at: wallet.createdAt,
      createdAt: wallet.createdAt,
      updated_at: wallet.updatedAt,
      updatedAt: wallet.updatedAt
    };
  }

  async createWallet({ userId, currency = 'USD', status = 'ACTIVE', availableBalance = 0, pendingBalance = 0 }, session) {
    const nextId = await Counter.getNextSequence('wallets');
    const walletData = {
      _id: nextId,
      userId,
      currency,
      status,
      availableBalance: Number(availableBalance),
      pendingBalance: Number(pendingBalance)
    };

    const wallet = await Wallet.create([walletData], { session });
    return this.formatWallet(wallet[0].toObject());
  }

  async findByUserId(userId, session) {
    const query = Wallet.findOne({ userId });
    if (session) {
      query.session(session);
    }
    const wallet = await query.lean();
    return this.formatWallet(wallet);
  }

  async findById(id, session) {
    const query = Wallet.findById(id);
    if (session) {
      query.session(session);
    }
    const wallet = await query.lean();
    return this.formatWallet(wallet);
  }

  /**
   * Locks a wallet row for update. In MongoDB, we simulate this by returning the document.
   */
  async lockWallet(id, session) {
    const query = Wallet.findById(id);
    if (session) {
      query.session(session);
    }
    const wallet = await query.lean();
    return this.formatWallet(wallet);
  }

  /**
   * Safely adds or deducts funds from a wallet using atomic $inc operation.
   */
  async updateBalances(id, availableChange, pendingChange, session) {
    const query = Wallet.findByIdAndUpdate(
      id,
      {
        $inc: {
          availableBalance: Number(availableChange),
          pendingBalance: Number(pendingChange)
        },
        $set: { updatedAt: new Date() }
      },
      { new: true }
    );
    if (session) {
      query.session(session);
    }
    const wallet = await query;
    return this.formatWallet(wallet ? wallet.toObject() : null);
  }

  /**
   * Fetches unified transaction activity history for a wallet, covering peer transfers.
   */
  async getTransactions(walletId, limit = 20, offset = 0) {
    const transfers = await Transfer.find({
      $or: [{ senderWalletId: Number(walletId) }, { recipientWalletId: Number(walletId) }]
    })
      .sort({ createdAt: -1 })
      .skip(Number(offset))
      .limit(Number(limit))
      .lean();

    return transfers.map(t => ({
      id: t._id,
      type: 'TRANSFER',
      sender_wallet_id: t.senderWalletId,
      recipient_wallet_id: t.recipientWalletId,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      description: t.description,
      created_at: t.createdAt
    }));
  }
}

export default new WalletRepository();
