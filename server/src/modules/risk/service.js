import crypto from 'crypto';
import pool from '../../config/db.js';
import riskRepository from './repository.js';
import { emitToRoom } from '../../config/socket.js';
import { AppError } from '../../middleware/error.js';
import logger from '../../middleware/logger.js';

export class RiskService {
  async checkTransactionRisk(walletId, transactionType, transactionId, amountStr) {
    const amount = BigInt(amountStr);
    const rulesTriggered = [];
    let riskScore = 0;

    // 1. Velocity check (peer transfers and succeeded payment checkouts in past 1 minute)
    const velocityQuery = `
      SELECT (
        (SELECT COUNT(*) FROM peer_transfers WHERE sender_wallet_id = $1 AND created_at >= NOW() - INTERVAL '1 minute') +
        (SELECT COUNT(*) FROM payments WHERE customer_wallet_id = $1 AND status = 'SUCCEEDED' AND created_at >= NOW() - INTERVAL '1 minute')
      ) AS count
    `;
    const { rows: velocityRows } = await pool.query(velocityQuery, [walletId]);
    const recentCount = velocityRows && velocityRows[0] ? parseInt(velocityRows[0].count, 10) : 0;
    
    if (recentCount >= 3) {
      rulesTriggered.push('HIGH_VELOCITY');
      riskScore += 70;
    }

    // 2. Suspicious Amount check (> $10,000.00 / 1,000,000 cents)
    if (amount > 1000000n) {
      rulesTriggered.push('EXCESSIVE_AMOUNT');
      riskScore += 70;
    }

    // 3. Balance Drain check (> 90% of wallet's available balance)
    const walletQuery = `SELECT available_balance FROM wallets WHERE id = $1`;
    const { rows: walletRows } = await pool.query(walletQuery, [walletId]);
    if (walletRows.length > 0) {
      const availableBalance = BigInt(walletRows[0].available_balance);
      if (availableBalance > 0n && (amount * 100n) / availableBalance > 90n) {
        rulesTriggered.push('RAPID_DRAIN');
        riskScore += 45;
      }
    }

    // Determine decision
    let decision = 'APPROVE';
    if (riskScore >= 70) {
      decision = 'BLOCK';
    } else if (riskScore >= 40) {
      decision = 'REVIEW';
    }

    const assessmentId = `risk_${crypto.randomUUID()}`;
    const assessment = await riskRepository.createAssessment({
      id: assessmentId,
      transactionType,
      transactionId,
      riskScore,
      decision,
      rulesTriggered
    });

    if (decision === 'BLOCK' || decision === 'REVIEW') {
      emitToRoom('admin', 'risk.alert', assessment);
    }

    if (decision === 'BLOCK') {
      logger.warn(`Risk Engine vetoed transaction [${transactionType}] ${transactionId}. Rules: ${rulesTriggered.join(', ')}. Score: ${riskScore}`);
      throw new AppError('RISK_BLOCKED', `Transaction rejected by automated risk safeguards (Score: ${riskScore}). Rules: ${rulesTriggered.join(', ')}`, 400);
    }

    if (decision === 'REVIEW') {
      logger.info(`Risk Engine flagged transaction [${transactionType}] ${transactionId} for operational review. Score: ${riskScore}`);
    }

    return assessment;
  }

  async getAllAssessments() {
    return riskRepository.getAllAssessments();
  }
}

const riskService = new RiskService();
export default riskService;
