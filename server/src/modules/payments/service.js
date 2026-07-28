import crypto from 'crypto';
import { Wallet } from '../../database/models.js';
import paymentRepository from './repository.js';
import walletRepository from '../wallets/repository.js';
import ledgerService from '../ledger/service.js';
import riskService from '../risk/service.js';
import webhookService from '../webhooks/service.js';
import { emitToRoom } from '../../config/socket.js';
import { AppError } from '../../middleware/error.js';
import logger from '../../middleware/logger.js';

export class PaymentService {
  async createPaymentOrder({ merchantId, amount, currency = 'USD', reference, metadata = {}, idempotencyKey = null }) {
    if (!amount || parseInt(amount, 10) <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Payment amount must be greater than zero', 400);
    }

    // Handle Idempotency Key
    if (idempotencyKey) {
      const existing = await paymentRepository.findByIdempotencyKey(merchantId, idempotencyKey);
      if (existing) {
        logger.info(`Idempotent payment creation hit for key: ${idempotencyKey}`);
        return this.formatPayment(existing);
      }
    }

    const paymentId = 'pay_' + crypto.randomUUID();
    const payment = await paymentRepository.createPayment({
      id: paymentId,
      merchantId,
      amount,
      currency,
      reference,
      metadata,
      idempotencyKey
    });

    logger.info(`Created payment order ${paymentId} for merchant ${merchantId} of amount ${amount}`);
    return this.formatPayment(payment);
  }

  async getPayment(id) {
    const payment = await paymentRepository.findById(id);
    if (!payment) {
      throw new AppError('PAYMENT_NOT_FOUND', 'Simulated payment order could not be found', 404);
    }
    return this.formatPayment(payment);
  }

  async processCheckout(paymentId, customerUserId) {
    // 1. Fetch payment
    const payment = await paymentRepository.findById(paymentId);
    if (!payment) {
      throw new AppError('PAYMENT_NOT_FOUND', 'Payment order not found', 404);
    }

    if (payment.status === 'SUCCEEDED') {
      return this.formatPayment(payment);
    }

    if (!['CREATED', 'PENDING', 'PROCESSING'].includes(payment.status)) {
      throw new AppError('INVALID_PAYMENT_STATE', `Payment cannot be processed from state: ${payment.status}`, 400);
    }

    // 2. Fetch customer wallet
    const customerWallet = await walletRepository.findByUserId(customerUserId);
    if (!customerWallet) {
      throw new AppError('WALLET_NOT_FOUND', 'Customer sandbox wallet not found', 404);
    }

    if (customerWallet.status === 'FROZEN') {
      throw new AppError('WALLET_FROZEN', 'Your wallet is currently FROZEN', 400);
    }

    const paymentAmount = Number(payment.amount);

    // 3. Concurrency-safe atomic debit of customer wallet
    const customerWalletUpdate = await Wallet.findOneAndUpdate(
      { _id: customerWallet.id, availableBalance: { $gte: paymentAmount }, status: 'ACTIVE' },
      { $inc: { availableBalance: -paymentAmount }, $set: { updatedAt: new Date() } },
      { new: true }
    );

    if (!customerWalletUpdate) {
      throw new AppError('INSUFFICIENT_FUNDS', 'Your wallet does not have sufficient available funds', 400);
    }

    let updatedPayment = null;
    try {
      // Run risk assessment check
      await riskService.checkTransactionRisk(customerWallet.id, 'PAYMENT', payment.id, paymentAmount.toString());

      // 4. Fetch merchant wallet
      const merchantWallet = await walletRepository.findByUserId(payment.merchantId);
      if (!merchantWallet) {
        throw new AppError('WALLET_NOT_FOUND', 'Merchant wallet not found', 404);
      }

      // 5. Fetch ledger accounts for double-entry
      const customerLedgerAccount = await ledgerService.findLedgerAccount('CUSTOMER', customerUserId);
      const merchantLedgerAccount = await ledgerService.findLedgerAccount('MERCHANT', payment.merchantId);
      if (!customerLedgerAccount || !merchantLedgerAccount) {
        throw new AppError('LEDGER_ACCOUNT_NOT_FOUND', 'Ledger accounts are not initialized for customer or merchant', 400);
      }

      // 6. Update merchant wallet balance
      await walletRepository.updateBalances(merchantWallet.id, paymentAmount, 0);

      // 7. Post ledger transaction
      await ledgerService.postTransaction({
        referenceType: 'PAYMENT',
        referenceId: payment.id,
        entries: [
          {
            accountId: customerLedgerAccount.id,
            direction: 'DEBIT',
            amount: paymentAmount,
            currency: payment.currency,
          },
          {
            accountId: merchantLedgerAccount.id,
            direction: 'CREDIT',
            amount: paymentAmount,
            currency: payment.currency,
          }
        ]
      });

      // 8. Update payment status to SUCCEEDED
      updatedPayment = await paymentRepository.updatePaymentStatus(payment.id, 'SUCCEEDED', customerWallet.id);

      logger.info(`Payment checkout succeeded for ${payment.id}. Customer wallet ${customerWallet.id} debited, Merchant wallet ${merchantWallet.id} credited.`);

      // Trigger webhook event
      webhookService.triggerWebhook(payment.merchantId, 'payment.succeeded', this.formatPayment(updatedPayment)).catch((err) => {
        logger.error(`Failed to trigger webhook for payment ${payment.id}:`, err);
      });

      // Emit to Socket rooms
      const formatted = this.formatPayment(updatedPayment);
      emitToRoom(`merchant_${payment.merchantId}`, 'payment.updated', formatted);
      emitToRoom(`customer_${customerUserId}`, 'payment.updated', formatted);
      emitToRoom('admin', 'payment.updated', formatted);

      return formatted;
    } catch (err) {
      // Reversal compensating update: credit back the customer wallet
      await Wallet.findByIdAndUpdate(customerWallet.id, {
        $inc: { availableBalance: paymentAmount },
        $set: { updatedAt: new Date() }
      });
      await paymentRepository.updatePaymentStatus(payment.id, 'FAILED').catch(() => {});
      throw err;
    }
  }

  async getMerchantPayments(merchantId) {
    const list = await paymentRepository.getMerchantPayments(merchantId);
    return list.map(p => this.formatPayment(p));
  }

  async getAllPayments() {
    const list = await paymentRepository.getAllPayments();
    return list.map(p => ({
      ...this.formatPayment(p),
      merchant: {
        firstName: p.merchant_first_name,
        lastName: p.merchant_last_name,
        email: p.merchant_email,
      },
      customer: p.customer_email ? {
        firstName: p.customer_first_name,
        lastName: p.customer_last_name,
        email: p.customer_email,
      } : null
    }));
  }

  async getMerchantStats(merchantId) {
    const stats = await paymentRepository.getMerchantStats(merchantId);
    
    const totalCount = parseInt(stats.total_count, 10);
    const successCount = parseInt(stats.success_count, 10);
    const successRate = totalCount === 0 ? 100 : Math.round((successCount / totalCount) * 100);

    return {
      totalVolume: stats.total_volume.toString(),
      successCount,
      failedCount: parseInt(stats.failed_count, 10),
      totalCount,
      successRate,
      refundVolume: stats.full_refund_volume.toString()
    };
  }

  formatPayment(p) {
    return {
      id: p.id,
      merchantId: p.merchantId,
      customerWalletId: p.customerWalletId,
      amount: p.amount.toString(),
      currency: p.currency,
      status: p.status,
      reference: p.reference,
      metadata: typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata,
      idempotencyKey: p.idempotencyKey,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
      businessName: p.businessName || p.business_name || null
    };
  }
}

export default new PaymentService();
