import crypto from 'crypto';
import { Wallet, Transfer, Payment } from '../../database/models.js';
import riskRepository from './repository.js';
import { emitToRoom } from '../../config/socket.js';
import { AppError } from '../../middleware/error.js';
import logger from '../../middleware/logger.js';

export class RiskService {
  async checkTransactionRisk(walletId, transactionType, transactionId, amountStr) {
    const amount = Number(amountStr);
    const rulesTriggered = [];
    let riskScore = 0;

    // 1. Velocity check (peer transfers and succeeded payment checkouts in past 1 minute)
    const oneMinuteAgo = new Date(Date.now() - 60000);
    const transferCount = await Transfer.countDocuments({
      senderWalletId: Number(walletId),
      createdAt: { $gte: oneMinuteAgo }
    });
    const paymentCount = await Payment.countDocuments({
      customerWalletId: Number(walletId),
      status: 'SUCCEEDED',
      createdAt: { $gte: oneMinuteAgo }
    });
    
    const recentCount = transferCount + paymentCount;
    
    if (recentCount >= 3) {
      rulesTriggered.push('HIGH_VELOCITY');
      riskScore += 70;
    }

    // 2. Suspicious Amount check (> $10,000.00 / 1,000,000 cents)
    if (amount > 1000000) {
      rulesTriggered.push('EXCESSIVE_AMOUNT');
      riskScore += 70;
    }

    // 3. Balance Drain check (> 90% of wallet's available balance)
    const wallet = await Wallet.findById(Number(walletId)).lean();
    if (wallet) {
      const availableBalance = wallet.availableBalance;
      if (availableBalance > 0 && (amount * 100) / availableBalance > 90) {
        rulesTriggered.push('RAPID_DRAIN');
        riskScore += 45;
      }
    }

    // Determine decision
    let decision = 'ALLOW';
    if (riskScore >= 70) {
      decision = 'VETO';
    } else if (riskScore >= 40) {
      decision = 'FLAG';
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

    if (decision === 'VETO' || decision === 'FLAG') {
      emitToRoom('admin', 'risk.alert', assessment);
    }

    if (decision === 'VETO') {
      logger.warn(`Risk Engine vetoed transaction [${transactionType}] ${transactionId}. Rules: ${rulesTriggered.join(', ')}. Score: ${riskScore}`);
      throw new AppError('RISK_BLOCKED', `Transaction rejected by automated risk safeguards (Score: ${riskScore}). Rules: ${rulesTriggered.join(', ')}`, 400);
    }

    if (decision === 'FLAG') {
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
