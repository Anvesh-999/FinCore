import { Payment, Refund, Transfer, Wallet, User, LedgerAccount, LedgerEntry, LedgerTransaction, ReconciliationRun } from '../../database/models.js';
import { emitToRoom } from '../../config/socket.js';
import logger from '../../middleware/logger.js';

export class ReconciliationService {
  async runConsistencyCheck() {
    logger.info('Starting platform-wide financial reconciliation check...');
    const discrepancies = [];

    // 1. Gather counts of records checked
    const totalPayments = await Payment.countDocuments({ status: 'SUCCEEDED' });
    const totalRefunds = await Refund.countDocuments({ status: 'SUCCEEDED' });
    const totalTransfers = await Transfer.countDocuments({ status: 'COMPLETED' });

    // 2. Check 1: Wallet vs Ledger Balance Mismatch
    const wallets = await Wallet.find().lean();
    for (const w of wallets) {
      const user = await User.findById(w.userId).lean();
      if (!user) continue;
      
      const la = await LedgerAccount.findOne({ holderId: w.userId, holderType: user.role }).lean();
      let ledgerBalance = 0;
      if (la) {
        const entries = await LedgerEntry.find({ ledgerAccountId: la._id }).lean();
        for (const e of entries) {
          if (e.direction === 'CREDIT') {
            ledgerBalance += e.amount;
          } else {
            ledgerBalance -= e.amount;
          }
        }
      }
      
      const dbBalance = w.availableBalance + w.pendingBalance;
      if (dbBalance !== ledgerBalance) {
        discrepancies.push({
          type: 'BALANCE_MISMATCH',
          description: `Wallet ID ${w._id} balance does not match ledger logs. Wallet: ${dbBalance} Cents. Ledger: ${ledgerBalance} Cents.`,
          details: {
            walletId: w._id,
            email: user.email,
            dbBalance: dbBalance.toString(),
            ledgerBalance: ledgerBalance.toString()
          }
        });
      }
    }

    // 3. Check 2: Unbalanced Ledger Transactions (Credits != Debits)
    const txs = await LedgerTransaction.find().lean();
    for (const tx of txs) {
      const entries = await LedgerEntry.find({ ledgerTransactionId: tx._id }).lean();
      let creditSum = 0;
      let debitSum = 0;
      for (const e of entries) {
        if (e.direction === 'CREDIT') {
          creditSum += e.amount;
        } else {
          debitSum += e.amount;
        }
      }
      if (creditSum !== debitSum) {
        discrepancies.push({
          type: 'UNBALANCED_LEDGER_TRANSACTION',
          description: `Ledger transaction ID ${tx._id} is unbalanced. Credits: ${creditSum}. Debits: ${debitSum}.`,
          details: {
            transactionId: tx._id,
            referenceType: tx.referenceType,
            referenceId: tx.referenceId,
            creditSum: creditSum.toString(),
            debitSum: debitSum.toString()
          }
        });
      }
    }

    // 4. Check 3: Succeeded Payments Missing Ledger Records
    const succeededPayments = await Payment.find({ status: 'SUCCEEDED' }).lean();
    for (const p of succeededPayments) {
      const exists = await LedgerTransaction.findOne({ referenceType: 'PAYMENT', referenceId: p._id }).lean();
      if (!exists) {
        discrepancies.push({
          type: 'MISSING_PAYMENT_LEDGER',
          description: `Succeeded Payment ${p._id} does not have a registered ledger entry.`,
          details: {
            paymentId: p._id,
            amount: p.amount.toString()
          }
        });
      }
    }

    // 5. Check 4: Succeeded Refunds Missing Ledger Records
    const succeededRefunds = await Refund.find({ status: 'SUCCEEDED' }).lean();
    for (const r of succeededRefunds) {
      const exists = await LedgerTransaction.findOne({ referenceType: 'REFUND', referenceId: r._id }).lean();
      if (!exists) {
        discrepancies.push({
          type: 'MISSING_REFUND_LEDGER',
          description: `Succeeded Refund ${r._id} does not have a registered ledger entry.`,
          details: {
            refundId: r._id,
            amount: r.amount.toString(),
            paymentId: r.paymentId
          }
        });
      }
    }

    // 6. Check 5: Completed Transfers Missing Ledger Records
    const completedTransfers = await Transfer.find({ status: 'COMPLETED' }).lean();
    for (const t of completedTransfers) {
      const exists = await LedgerTransaction.findOne({ referenceType: 'TRANSFER', referenceId: t._id }).lean();
      if (!exists) {
        discrepancies.push({
          type: 'MISSING_TRANSFER_LEDGER',
          description: `Succeeded Transfer ${t._id} does not have a registered ledger entry.`,
          details: {
            transferId: t._id,
            amount: t.amount.toString()
          }
        });
      }
    }

    // Save run audit log
    const inconsistenciesFound = discrepancies.length;
    const runStatus = 'COMPLETED';

    const run = await ReconciliationRun.create({
      status: runStatus,
      totalPaymentsChecked: totalPayments,
      totalRefundsChecked: totalRefunds,
      totalTransfersChecked: totalTransfers,
      inconsistenciesFound,
      results: discrepancies
    });

    const runObj = {
      id: run._id,
      runDate: run.runDate,
      run_date: run.runDate,
      status: run.status,
      totalPaymentsChecked: run.totalPaymentsChecked,
      total_payments_checked: run.totalPaymentsChecked,
      totalRefundsChecked: run.totalRefundsChecked,
      total_refunds_checked: run.totalRefundsChecked,
      totalTransfersChecked: run.totalTransfersChecked,
      total_transfers_checked: run.totalTransfersChecked,
      inconsistenciesFound: run.inconsistenciesFound,
      inconsistencies_found: run.inconsistenciesFound,
      results: run.results,
      createdAt: run.createdAt,
      created_at: run.createdAt
    };

    logger.info(`Reconciliation run complete. status: ${runStatus}, Inconsistencies found: ${inconsistenciesFound}`);

    if (inconsistenciesFound > 0) {
      emitToRoom('admin', 'reconciliation.alert', runObj);
    }

    return runObj;
  }

  async getRuns() {
    const list = await ReconciliationRun.find().sort({ createdAt: -1 }).lean();
    return list.map(run => ({
      id: run._id,
      runDate: run.runDate,
      run_date: run.runDate,
      status: run.status,
      totalPaymentsChecked: run.totalPaymentsChecked,
      total_payments_checked: run.totalPaymentsChecked,
      totalRefundsChecked: run.totalRefundsChecked,
      total_refunds_checked: run.totalRefundsChecked,
      totalTransfersChecked: run.totalTransfersChecked,
      total_transfers_checked: run.totalTransfersChecked,
      inconsistenciesFound: run.inconsistenciesFound,
      inconsistencies_found: run.inconsistenciesFound,
      results: run.results,
      createdAt: run.createdAt,
      created_at: run.createdAt
    }));
  }
}

const reconciliationService = new ReconciliationService();
export default reconciliationService;
