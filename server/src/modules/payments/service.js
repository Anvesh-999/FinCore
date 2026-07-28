import crypto from 'crypto';
import paymentRepository from './repository.js';
import walletRepository from '../wallets/repository.js';
import ledgerService from '../ledger/service.js';
import riskService from '../risk/service.js';
import webhookService from '../webhooks/service.js';
import { emitToRoom } from '../../config/socket.js';
import pool from '../../config/db.js';
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
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Lock payment record
      const payment = await paymentRepository.lockPayment(paymentId, client);
      if (!payment) {
        throw new AppError('PAYMENT_NOT_FOUND', 'Payment order not found', 404);
      }

      if (payment.status === 'SUCCEEDED') {
        await client.query('COMMIT');
        return this.formatPayment(payment);
      }

      if (!['CREATED', 'PENDING', 'PROCESSING'].includes(payment.status)) {
        throw new AppError('INVALID_PAYMENT_STATE', `Payment cannot be processed from state: ${payment.status}`, 400);
      }

      // 2. Fetch customer wallet & lock
      const customerWallet = await walletRepository.findByUserId(customerUserId);
      if (!customerWallet) {
        throw new AppError('WALLET_NOT_FOUND', 'Customer sandbox wallet not found', 404);
      }
      await walletRepository.lockWallet(customerWallet.id, client);

      if (customerWallet.status === 'FROZEN') {
        throw new AppError('WALLET_FROZEN', 'Your wallet is currently FROZEN', 400);
      }

      // 3. Check sufficient funds
      const paymentAmount = BigInt(payment.amount);
      if (BigInt(customerWallet.available_balance) < paymentAmount) {
        throw new AppError('INSUFFICIENT_FUNDS', 'Your wallet does not have sufficient available funds', 400);
      }

      // Run risk assessment check
      await riskService.checkTransactionRisk(customerWallet.id, 'PAYMENT', payment.id, paymentAmount.toString());

      // 4. Fetch merchant wallet & lock
      const merchantWallet = await walletRepository.findByUserId(payment.merchant_id);
      if (!merchantWallet) {
        throw new AppError('WALLET_NOT_FOUND', 'Merchant wallet not found', 404);
      }
      await walletRepository.lockWallet(merchantWallet.id, client);

      // 5. Fetch ledger accounts for double-entry
      const customerLedgerAccount = await ledgerService.findLedgerAccount('CUSTOMER', customerUserId, client);
      const merchantLedgerAccount = await ledgerService.findLedgerAccount('MERCHANT', payment.merchant_id, client);
      if (!customerLedgerAccount || !merchantLedgerAccount) {
        throw new AppError('LEDGER_ACCOUNT_NOT_FOUND', 'Ledger accounts are not initialized for customer or merchant', 400);
      }

      // 6. Update balances
      await walletRepository.updateBalances(customerWallet.id, -paymentAmount, 0n, client);
      await walletRepository.updateBalances(merchantWallet.id, paymentAmount, 0n, client);

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
      }, client);

      // 8. Update payment status to SUCCEEDED
      const updatedPayment = await paymentRepository.updatePaymentStatus(payment.id, 'SUCCEEDED', customerWallet.id, client);

      await client.query('COMMIT');
      logger.info(`Payment checkout succeeded for ${payment.id}. Customer wallet ${customerWallet.id} debited, Merchant wallet ${merchantWallet.id} credited.`);

      // Trigger webhook event
      webhookService.triggerWebhook(payment.merchant_id, 'payment.succeeded', this.formatPayment(updatedPayment)).catch((err) => {
        logger.error(`Failed to trigger webhook for payment ${payment.id}:`, err);
      });

      // Emit to Socket rooms
      const formatted = this.formatPayment(updatedPayment);
      emitToRoom(`merchant_${payment.merchant_id}`, 'payment.updated', formatted);
      emitToRoom(`customer_${customerUserId}`, 'payment.updated', formatted);
      emitToRoom('admin', 'payment.updated', formatted);

      return formatted;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
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
    
    // Calculate success rate percentage
    const totalCount = parseInt(stats.total_count, 10);
    const successCount = parseInt(stats.success_count, 10);
    const successRate = totalCount === 0 ? 100 : Math.round((successCount / totalCount) * 100);

    return {
      totalVolume: stats.total_volume.toString(),
      successCount,
      failedCount: parseInt(stats.failed_count, 10),
      totalCount,
      successRate,
      refundVolume: stats.full_refund_volume.toString() // we will add refund stats detailed in refunds repository
    };
  }

  formatPayment(p) {
    return {
      id: p.id,
      merchantId: p.merchant_id,
      customerWalletId: p.customer_wallet_id,
      amount: p.amount.toString(),
      currency: p.currency,
      status: p.status,
      reference: p.reference,
      metadata: typeof p.metadata === 'string' ? JSON.parse(p.metadata) : p.metadata,
      idempotencyKey: p.idempotency_key,
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      businessName: p.business_name || null
    };
  }
}

export default new PaymentService();
