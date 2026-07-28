import { Wallet, User, Transfer, LedgerEntry, LedgerTransaction, LedgerAccount } from '../../database/models.js';

export class AdminRepository {
  async getAllWallets() {
    const wallets = await Wallet.find().sort({ _id: 1 }).lean();
    const result = [];
    for (const w of wallets) {
      const user = await User.findById(w.userId).lean();
      result.push({
        id: w._id,
        user_id: w.userId,
        currency: w.currency,
        status: w.status,
        available_balance: w.availableBalance,
        pending_balance: w.pendingBalance,
        created_at: w.createdAt,
        updated_at: w.updatedAt,
        first_name: user ? user.firstName : 'unknown',
        last_name: user ? user.lastName : 'unknown',
        email: user ? user.email : 'unknown',
        role: user ? user.role : 'unknown'
      });
    }
    return result;
  }

  async updateWalletStatus(walletId, status) {
    const wallet = await Wallet.findByIdAndUpdate(
      Number(walletId),
      { $set: { status, updatedAt: new Date() } },
      { new: true }
    );
    if (!wallet) return null;
    return {
      id: wallet._id,
      user_id: wallet.userId,
      currency: wallet.currency,
      status: wallet.status,
      available_balance: wallet.availableBalance,
      pending_balance: wallet.pendingBalance,
      created_at: wallet.createdAt,
      updated_at: wallet.updatedAt
    };
  }

  async getAllTransfers() {
    const transfers = await Transfer.find().sort({ createdAt: -1 }).lean();
    const result = [];
    for (const t of transfers) {
      const senderWallet = await Wallet.findById(t.senderWalletId).lean();
      const recipientWallet = await Wallet.findById(t.recipientWalletId).lean();
      
      const su = senderWallet ? await User.findById(senderWallet.userId).lean() : null;
      const ru = recipientWallet ? await User.findById(recipientWallet.userId).lean() : null;
      
      result.push({
        id: t._id,
        sender_wallet_id: t.senderWalletId,
        recipient_wallet_id: t.recipientWalletId,
        amount: t.amount,
        currency: t.currency,
        status: t.status,
        description: t.description,
        created_at: t.createdAt,
        updated_at: t.updatedAt,
        sender_first_name: su ? su.firstName : 'unknown',
        sender_last_name: su ? su.lastName : 'unknown',
        sender_email: su ? su.email : 'unknown',
        recipient_first_name: ru ? ru.firstName : 'unknown',
        recipient_last_name: ru ? ru.lastName : 'unknown',
        recipient_email: ru ? ru.email : 'unknown'
      });
    }
    return result;
  }

  async getLedgerBook() {
    const entries = await LedgerEntry.find().lean();
    const result = [];
    
    const txMap = new Map();
    const accMap = new Map();
    
    for (const e of entries) {
      if (!txMap.has(e.ledgerTransactionId)) {
        const tx = await LedgerTransaction.findById(e.ledgerTransactionId).lean();
        txMap.set(e.ledgerTransactionId, tx);
      }
      if (!accMap.has(e.ledgerAccountId)) {
        const acc = await LedgerAccount.findById(e.ledgerAccountId).lean();
        accMap.set(e.ledgerAccountId, acc);
      }
      
      const lt = txMap.get(e.ledgerTransactionId);
      const la = accMap.get(e.ledgerAccountId);
      
      let holderUser = null;
      if (la && la.holderId) {
        holderUser = await User.findById(la.holderId).lean();
      }
      
      result.push({
        entry_id: e._id,
        ledger_transaction_id: e.ledgerTransactionId,
        direction: e.direction,
        amount: e.amount,
        currency: e.currency,
        entry_created_at: e.createdAt,
        ledger_account_id: e.ledgerAccountId,
        holder_type: la ? la.holderType : 'unknown',
        holder_id: la ? la.holderId : null,
        holder_first_name: holderUser ? holderUser.firstName : (la && la.holderType === 'SYSTEM' ? 'SYSTEM' : 'unknown'),
        holder_last_name: holderUser ? holderUser.lastName : (la && la.holderType === 'SYSTEM' ? 'TREASURY' : 'unknown'),
        holder_email: holderUser ? holderUser.email : (la && la.holderType === 'SYSTEM' ? 'system@fincore.internal' : 'unknown'),
        reference_type: lt ? lt.referenceType : 'unknown',
        reference_id: lt ? lt.referenceId : 'unknown',
        transaction_status: lt ? lt.status : 'POSTED',
        transaction_created_at: lt ? lt.createdAt : e.createdAt
      });
    }
    
    result.sort((a, b) => {
      const dateA = new Date(a.transaction_created_at).getTime();
      const dateB = new Date(b.transaction_created_at).getTime();
      if (dateB !== dateA) return dateB - dateA;
      return String(a.entry_id).localeCompare(String(b.entry_id));
    });
    
    return result;
  }
}

export default new AdminRepository();
