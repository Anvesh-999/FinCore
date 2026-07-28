import { RiskAssessment, Transfer, Payment, Wallet, User } from '../../database/models.js';

export class RiskRepository {
  formatAssessment(assessment) {
    if (!assessment) return null;
    return {
      id: assessment._id,
      transaction_type: assessment.transactionType,
      transaction_id: assessment.transactionId,
      risk_score: assessment.riskScore,
      decision: assessment.decision,
      rules_triggered: assessment.rulesTriggered || [],
      created_at: assessment.createdAt
    };
  }

  async createAssessment({ id, transactionType, transactionId, riskScore, decision, rulesTriggered }) {
    const assessment = await RiskAssessment.create({
      _id: id,
      transactionType,
      transactionId,
      riskScore,
      decision,
      rulesTriggered
    });
    return this.formatAssessment(assessment.toObject());
  }

  async getAllAssessments() {
    const assessments = await RiskAssessment.find().sort({ createdAt: -1 }).lean();
    const formatted = [];
    
    for (const r of assessments) {
      const item = this.formatAssessment(r);
      
      if (r.transactionType === 'TRANSFER') {
        const t = await Transfer.findById(r.transactionId).lean();
        if (t) {
          item.transfer_amount = t.amount;
          item.transfer_currency = t.currency;
          
          const senderWallet = await Wallet.findById(t.senderWalletId).lean();
          if (senderWallet) {
            const senderUser = await User.findById(senderWallet.userId).lean();
            if (senderUser) {
              item.sender_email = senderUser.email;
            }
          }
          
          const recipientWallet = await Wallet.findById(t.recipientWalletId).lean();
          if (recipientWallet) {
            const recipientUser = await User.findById(recipientWallet.userId).lean();
            if (recipientUser) {
              item.recipient_email = recipientUser.email;
            }
          }
        }
      } else if (r.transactionType === 'PAYMENT') {
        const p = await Payment.findById(r.transactionId).lean();
        if (p) {
          item.payment_amount = p.amount;
          item.payment_currency = p.currency;
          
          const merchantUser = await User.findById(p.merchantId).lean();
          if (merchantUser) {
            item.merchant_email = merchantUser.email;
          }
          
          if (p.customerWalletId) {
            const customerWallet = await Wallet.findById(p.customerWalletId).lean();
            if (customerWallet) {
              const customerUser = await User.findById(customerWallet.userId).lean();
              if (customerUser) {
                item.customer_email = customerUser.email;
              }
            }
          }
        }
      }
      formatted.push(item);
    }
    return formatted;
  }
}

const riskRepository = new RiskRepository();
export default riskRepository;
