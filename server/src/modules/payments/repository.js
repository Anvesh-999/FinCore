import { Payment, User, Wallet } from '../../database/models.js';

export class PaymentRepository {
  formatPayment(payment) {
    if (!payment) return null;
    return {
      id: payment._id,
      merchant_id: payment.merchantId,
      merchantId: payment.merchantId,
      customer_wallet_id: payment.customerWalletId,
      customerWalletId: payment.customerWalletId,
      amount: payment.amount,
      currency: payment.currency,
      reference: payment.reference,
      metadata: payment.metadata || {},
      status: payment.status,
      idempotency_key: payment.idempotencyKey,
      idempotencyKey: payment.idempotencyKey,
      created_at: payment.createdAt,
      createdAt: payment.createdAt,
      updated_at: payment.updatedAt,
      updatedAt: payment.updatedAt
    };
  }

  async createPayment({ id, merchantId, amount, currency = 'USD', reference, metadata = {}, status = 'CREATED', idempotencyKey = null }, session) {
    const payment = await Payment.create(
      [{
        _id: id,
        merchantId: Number(merchantId),
        amount: Number(amount),
        currency,
        reference,
        metadata,
        status,
        idempotencyKey
      }],
      { session }
    );
    return this.formatPayment(payment[0].toObject());
  }

  async findById(id) {
    const payment = await Payment.findById(id).lean();
    if (!payment) return null;
    const formatted = this.formatPayment(payment);
    const user = await User.findById(payment.merchantId).lean();
    if (user) {
      formatted.business_name = `${user.firstName}'s Sandbox Business`;
    }
    return formatted;
  }

  async findByIdempotencyKey(merchantId, idempotencyKey) {
    const payment = await Payment.findOne({ merchantId: Number(merchantId), idempotencyKey }).lean();
    return this.formatPayment(payment);
  }

  async lockPayment(id, session) {
    const query = Payment.findById(id);
    if (session) {
      query.session(session);
    }
    const payment = await query.lean();
    return this.formatPayment(payment);
  }

  async updatePaymentStatus(id, status, customerWalletId = null, session) {
    const updateObj = { status, updatedAt: new Date() };
    if (customerWalletId !== null) {
      updateObj.customerWalletId = Number(customerWalletId);
    }
    const payment = await Payment.findByIdAndUpdate(
      id,
      { $set: updateObj },
      { new: true, session }
    );
    return this.formatPayment(payment ? payment.toObject() : null);
  }

  async getMerchantPayments(merchantId) {
    const payments = await Payment.find({ merchantId: Number(merchantId) }).sort({ createdAt: -1 }).lean();
    return payments.map(p => this.formatPayment(p));
  }

  async getAllPayments() {
    const payments = await Payment.find().sort({ createdAt: -1 }).lean();
    const formatted = [];
    for (const p of payments) {
      const item = this.formatPayment(p);
      const merchant = await User.findById(p.merchantId).lean();
      if (merchant) {
        item.merchant_first_name = merchant.firstName;
        item.merchant_last_name = merchant.lastName;
        item.merchant_email = merchant.email;
      }
      if (p.customerWalletId) {
        const wallet = await Wallet.findById(p.customerWalletId).lean();
        if (wallet) {
          const customer = await User.findById(wallet.userId).lean();
          if (customer) {
            item.customer_first_name = customer.firstName;
            item.customer_last_name = customer.lastName;
            item.customer_email = customer.email;
          }
        }
      }
      formatted.push(item);
    }
    return formatted;
  }

  async getMerchantStats(merchantId) {
    const payments = await Payment.find({ merchantId: Number(merchantId) }).lean();
    let totalVolume = 0;
    let successCount = 0;
    let failedCount = 0;
    let totalCount = payments.length;
    let fullRefundVolume = 0;

    for (const p of payments) {
      if (['SUCCEEDED', 'PARTIALLY_REFUNDED', 'REFUNDED'].includes(p.status)) {
        totalVolume += p.amount;
        successCount++;
      }
      if (p.status === 'FAILED') {
        failedCount++;
      }
      if (p.status === 'REFUNDED') {
        fullRefundVolume += p.amount;
      }
    }

    return {
      total_volume: totalVolume.toString(),
      success_count: successCount.toString(),
      failed_count: failedCount.toString(),
      total_count: totalCount.toString(),
      full_refund_volume: fullRefundVolume.toString()
    };
  }
}

export default new PaymentRepository();
