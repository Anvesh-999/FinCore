import crypto from 'crypto';
import refundRepository from './repository.js';
import paymentRepository from '../payments/repository.js';
import walletRepository from '../wallets/repository.js';
import ledgerService from '../ledger/service.js';
import webhookService from '../webhooks/service.js';
import { emitToRoom } from '../../config/socket.js';
import pool from '../../config/db.js';
import { AppError } from '../../middleware/error.js';
import logger from '../../middleware/logger.js';

export class RefundService {
  async createRefund({ paymentId, amount, description = null, merchantId }) {
    if (!amount || parseInt(amount, 10) <= 0) {
      throw new AppError('VALIDATION_ERROR', 'Refund amount must be greater than zero', 400);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch & lock original payment order
      const payment = await paymentRepository.lockPayment(paymentId, client);
      if (!payment) {
        throw new AppError('PAYMENT_NOT_FOUND', 'Original payment order not found', 404);
      }

      // 2. Validate merchant ownership
      if (payment.merchant_id !== merchantId) {
        throw new AppError('UNAUTHORIZED', 'Merchant does not own this payment order', 401);
      }

      // 3. Verify payment is in refundable state
      if (!['SUCCEEDED', 'PARTIALLY_REFUNDED'].includes(payment.status)) {
        throw new AppError('PAYMENT_NOT_REFUNDABLE', `Payment in status ${payment.status} cannot be refunded`, 400);
      }

      // 4. Validate refund limits
      const refundAmount = BigInt(amount);
      const paymentAmount = BigInt(payment.amount);
      const totalRefundedSoFar = await refundRepository.getRefundsSumForPayment(paymentId, client);

      if (totalRefundedSoFar + refundAmount > paymentAmount) {
        throw new AppError(
          'REFUND_EXCEEDS_PAYMENT',
          `Refund amount exceeds captured payment limit. Max refundable remaining: ${paymentAmount - totalRefundedSoFar}`,
          400
        );
      }

      // 5. Fetch and lock wallets
      const merchantWallet = await walletRepository.findByUserId(merchantId);
      if (!merchantWallet) {
        throw new AppError('WALLET_NOT_FOUND', 'Merchant wallet not found', 404);
      }
      await walletRepository.lockWallet(merchantWallet.id, client);

      // Verify merchant has sufficient funds to issue the refund
      if (BigInt(merchantWallet.available_balance) < refundAmount) {
        throw new AppError('INSUFFICIENT_FUNDS', 'Merchant wallet does not have sufficient available funds to issue refund', 400);
      }

      const customerWallet = await walletRepository.findById(payment.customer_wallet_id);
      if (!customerWallet) {
        throw new AppError('WALLET_NOT_FOUND', 'Customer wallet not found', 404);
      }
      await walletRepository.lockWallet(customerWallet.id, client);

      // 6. Fetch ledger accounts
      const merchantLedgerAccount = await ledgerService.findLedgerAccount('MERCHANT', merchantId, client);
      const customerLedgerAccount = await ledgerService.findLedgerAccount('CUSTOMER', customerWallet.user_id, client);
      if (!merchantLedgerAccount || !customerLedgerAccount) {
        throw new AppError('LEDGER_ACCOUNT_NOT_FOUND', 'Ledger accounts are not initialized', 400);
      }

      const refundId = 'ref_' + crypto.randomUUID();
      
      // 7. Create processing refund record
      await refundRepository.createRefund({
        id: refundId,
        paymentId,
        amount: refundAmount,
        currency: payment.currency,
        status: 'PROCESSING',
        description
      }, client);

      // 8. Revert balances: Debit Merchant, Credit Customer
      await walletRepository.updateBalances(merchantWallet.id, -refundAmount, 0n, client);
      await walletRepository.updateBalances(customerWallet.id, refundAmount, 0n, client);

      // 9. Post compensating balanced ledger transaction
      await ledgerService.postTransaction({
        referenceType: 'REFUND',
        referenceId: refundId,
        entries: [
          {
            accountId: merchantLedgerAccount.id,
            direction: 'DEBIT',
            amount: refundAmount,
            currency: payment.currency,
          },
          {
            accountId: customerLedgerAccount.id,
            direction: 'CREDIT',
            amount: refundAmount,
            currency: payment.currency,
          }
        ]
      }, client);

      // 10. Update refund status to SUCCEEDED
      const succeededRefund = await refundRepository.updateRefundStatus(refundId, 'SUCCEEDED', client);

      // 11. Calculate new payment status (REFUNDED vs PARTIALLY_REFUNDED)
      const newStatus = (totalRefundedSoFar + refundAmount === paymentAmount) ? 'REFUNDED' : 'PARTIALLY_REFUNDED';
      await paymentRepository.updatePaymentStatus(paymentId, newStatus, null, client);

      await client.query('COMMIT');
      logger.info(`Refund succeeded for payment ${paymentId}. ID: ${refundId}. Merchant wallet debited ${refundAmount}, Customer wallet credited.`);

      // Trigger webhook event
      webhookService.triggerWebhook(merchantId, 'refund.succeeded', this.formatRefund(succeededRefund)).catch((err) => {
        logger.error(`Failed to trigger webhook for refund ${refundId}:`, err);
      });

      // Emit to Socket rooms
      const formatted = this.formatRefund(succeededRefund);
      emitToRoom(`merchant_${merchantId}`, 'refund.updated', formatted);
      emitToRoom(`customer_${customerWallet.user_id}`, 'refund.updated', formatted);
      emitToRoom('admin', 'refund.updated', formatted);

      return formatted;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getRefund(id) {
    const refund = await refundRepository.findById(id);
    if (!refund) {
      throw new AppError('REFUND_NOT_FOUND', 'Refund order could not be found', 404);
    }
    return this.formatRefund(refund);
  }

  async getMerchantRefunds(merchantId) {
    const list = await refundRepository.getMerchantRefunds(merchantId);
    return list.map(r => ({
      ...this.formatRefund(r),
      reference: r.reference,
      paymentAmount: r.payment_amount.toString()
    }));
  }

  async getAllRefunds() {
    const list = await refundRepository.getAllRefunds();
    return list.map(r => ({
      ...this.formatRefund(r),
      paymentAmount: r.payment_amount.toString(),
      paymentCurrency: r.payment_currency,
      reference: r.reference,
      merchant: {
        firstName: r.merchant_first_name,
        lastName: r.merchant_last_name,
        email: r.merchant_email,
      },
      customer: r.customer_email ? {
        firstName: r.customer_first_name,
        lastName: r.customer_last_name,
        email: r.customer_email,
      } : null
    }));
  }

  formatRefund(r) {
    return {
      id: r.id,
      paymentId: r.payment_id,
      amount: r.amount.toString(),
      currency: r.currency,
      status: r.status,
      description: r.description,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
  }
}

export default new RefundService();
