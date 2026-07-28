import { Refund, Payment, User, Wallet } from '../../database/models.js';

export class RefundRepository {
  formatRefund(refund) {
    if (!refund) return null;
    return {
      id: refund._id,
      payment_id: refund.paymentId,
      paymentId: refund.paymentId,
      amount: refund.amount,
      currency: refund.currency,
      status: refund.status,
      description: refund.description,
      created_at: refund.createdAt,
      createdAt: refund.createdAt,
      updated_at: refund.updatedAt,
      updatedAt: refund.updatedAt
    };
  }

  async createRefund({ id, paymentId, amount, currency = 'USD', status = 'CREATED', description = null }, session) {
    const refund = await Refund.create(
      [{
        _id: id,
        paymentId,
        amount: Number(amount),
        currency,
        status,
        description
      }],
      { session }
    );
    return this.formatRefund(refund[0].toObject());
  }

  async findById(id) {
    const refund = await Refund.findById(id).lean();
    return this.formatRefund(refund);
  }

  async getRefundsByPaymentId(paymentId) {
    const refunds = await Refund.find({ paymentId }).sort({ createdAt: -1 }).lean();
    return refunds.map(r => this.formatRefund(r));
  }

  async getRefundsSumForPayment(paymentId) {
    const refunds = await Refund.find({ paymentId, status: 'SUCCEEDED' }).lean();
    const sum = refunds.reduce((acc, curr) => acc + curr.amount, 0);
    return BigInt(sum);
  }

  async getMerchantRefunds(merchantId) {
    const payments = await Payment.find({ merchantId: Number(merchantId) }).lean();
    const paymentIds = payments.map(p => p._id);
    const refunds = await Refund.find({ paymentId: { $in: paymentIds } }).sort({ createdAt: -1 }).lean();
    
    return refunds.map(r => {
      const p = payments.find(pay => pay._id === r.paymentId);
      return {
        ...this.formatRefund(r),
        reference: p ? p.reference : null,
        payment_amount: p ? p.amount : 0
      };
    });
  }

  async getAllRefunds() {
    const refunds = await Refund.find().sort({ createdAt: -1 }).lean();
    const formatted = [];

    for (const r of refunds) {
      const item = this.formatRefund(r);
      const p = await Payment.findById(r.paymentId).lean();
      if (p) {
        item.payment_amount = p.amount;
        item.payment_currency = p.currency;
        item.reference = p.reference;

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
      }
      formatted.push(item);
    }
    return formatted;
  }

  async updateRefundStatus(id, status, session) {
    const refund = await Refund.findByIdAndUpdate(
      id,
      { $set: { status, updatedAt: new Date() } },
      { new: true, session }
    );
    return this.formatRefund(refund ? refund.toObject() : null);
  }
}

export default new RefundRepository();
