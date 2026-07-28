import { Transfer } from '../../database/models.js';

export class TransferRepository {
  formatTransfer(transfer) {
    if (!transfer) return null;
    return {
      id: transfer._id,
      sender_wallet_id: transfer.senderWalletId,
      recipient_wallet_id: transfer.recipientWalletId,
      amount: transfer.amount,
      currency: transfer.currency,
      status: transfer.status,
      idempotency_key: transfer.idempotencyKey,
      description: transfer.description,
      created_at: transfer.createdAt,
      updated_at: transfer.updatedAt
    };
  }

  async createTransfer({ id, senderWalletId, recipientWalletId, amount, currency = 'USD', status = 'CREATED', idempotencyKey = null, description = '' }, session) {
    const transfer = await Transfer.create(
      [{
        _id: id,
        senderWalletId: Number(senderWalletId),
        recipientWalletId: Number(recipientWalletId),
        amount: Number(amount),
        currency,
        status,
        idempotencyKey,
        description
      }],
      { session }
    );
    return this.formatTransfer(transfer[0].toObject());
  }

  async updateTransferStatus(id, status, session) {
    const transfer = await Transfer.findByIdAndUpdate(
      id,
      { $set: { status, updatedAt: new Date() } },
      { new: true, session }
    );
    return this.formatTransfer(transfer ? transfer.toObject() : null);
  }

  async findById(id) {
    const transfer = await Transfer.findById(id).lean();
    return this.formatTransfer(transfer);
  }

  async findByIdempotencyKey(key) {
    const transfer = await Transfer.findOne({ idempotencyKey: key }).lean();
    return this.formatTransfer(transfer);
  }
}

export default new TransferRepository();
