import pool from '../../config/db.js';
import { emitToRoom } from '../../config/socket.js';
import logger from '../../middleware/logger.js';

export class ReconciliationService {
  async runConsistencyCheck() {
    logger.info('Starting platform-wide financial reconciliation check...');
    const discrepancies = [];

    // 1. Gather counts of records checked
    const { rows: countsRows } = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM payments WHERE status = 'SUCCEEDED') AS payments_count,
        (SELECT COUNT(*) FROM refunds WHERE status = 'SUCCEEDED') AS refunds_count,
        (SELECT COUNT(*) FROM peer_transfers WHERE status = 'SUCCEEDED') AS transfers_count
    `);
    const totalPayments = parseInt(countsRows[0].payments_count, 10);
    const totalRefunds = parseInt(countsRows[0].refunds_count, 10);
    const totalTransfers = parseInt(countsRows[0].transfers_count, 10);

    // 2. Check 1: Wallet vs Ledger Balance Mismatch
    const walletBalanceQuery = `
      SELECT w.id AS wallet_id, w.user_id, w.available_balance, w.pending_balance, u.email, u.role,
             (
               SELECT COALESCE(SUM(CASE WHEN e.direction = 'CREDIT' THEN e.amount ELSE -e.amount END), 0)
               FROM ledger_entries e
               JOIN ledger_accounts la ON e.ledger_account_id = la.id
               WHERE la.holder_id = w.user_id AND la.holder_type = u.role
             ) AS ledger_balance
      FROM wallets w
      JOIN users u ON w.user_id = u.id
    `;
    const { rows: walletBalances } = await pool.query(walletBalanceQuery);
    for (const row of walletBalances) {
      const dbBalance = BigInt(row.available_balance) + BigInt(row.pending_balance);
      const ledgerBalance = BigInt(row.ledger_balance);
      if (dbBalance !== ledgerBalance) {
        discrepancies.push({
          type: 'BALANCE_MISMATCH',
          description: `Wallet ID ${row.wallet_id} balance does not match ledger ledger logs. Wallet: ${dbBalance.toString()} Cents. Ledger: ${ledgerBalance.toString()} Cents.`,
          details: {
            walletId: row.wallet_id,
            email: row.email,
            dbBalance: dbBalance.toString(),
            ledgerBalance: ledgerBalance.toString()
          }
        });
      }
    }

    // 3. Check 2: Unbalanced Ledger Transactions (Credits != Debits)
    const unbalancedTransactionsQuery = `
      SELECT t.id AS transaction_id, t.reference_type, t.reference_id,
             COALESCE(SUM(CASE WHEN e.direction = 'CREDIT' THEN e.amount ELSE 0 END), 0) AS credit_sum,
             COALESCE(SUM(CASE WHEN e.direction = 'DEBIT' THEN e.amount ELSE 0 END), 0) AS debit_sum
      FROM ledger_transactions t
      JOIN ledger_entries e ON t.id = e.ledger_transaction_id
      GROUP BY t.id, t.reference_type, t.reference_id
      HAVING COALESCE(SUM(CASE WHEN e.direction = 'CREDIT' THEN e.amount ELSE 0 END), 0) != 
             COALESCE(SUM(CASE WHEN e.direction = 'DEBIT' THEN e.amount ELSE 0 END), 0)
    `;
    const { rows: unbalancedTxs } = await pool.query(unbalancedTransactionsQuery);
    for (const tx of unbalancedTxs) {
      discrepancies.push({
        type: 'UNBALANCED_LEDGER_TRANSACTION',
        description: `Ledger transaction ID ${tx.transaction_id} is unbalanced. Credits: ${tx.credit_sum}. Debits: ${tx.debit_sum}.`,
        details: {
          transactionId: tx.transaction_id,
          referenceType: tx.reference_type,
          referenceId: tx.reference_id,
          creditSum: tx.credit_sum.toString(),
          debitSum: tx.debit_sum.toString()
        }
      });
    }

    // 4. Check 3: Succeeded Payments Missing Ledger Records
    const missingPaymentLedgerQuery = `
      SELECT p.id AS payment_id, p.amount, p.merchant_id
      FROM payments p
      WHERE p.status = 'SUCCEEDED' AND NOT EXISTS (
        SELECT 1 FROM ledger_transactions t 
        WHERE t.reference_type = 'PAYMENT' AND t.reference_id = p.id
      )
    `;
    const { rows: missingPaymentLedgers } = await pool.query(missingPaymentLedgerQuery);
    for (const pay of missingPaymentLedgers) {
      discrepancies.push({
        type: 'MISSING_PAYMENT_LEDGER',
        description: `Succeeded Payment ${pay.payment_id} does not have a registered ledger entry.`,
        details: {
          paymentId: pay.payment_id,
          amount: pay.amount.toString()
        }
      });
    }

    // 5. Check 4: Succeeded Refunds Missing Ledger Records
    const missingRefundLedgerQuery = `
      SELECT r.id AS refund_id, r.amount, r.payment_id
      FROM refunds r
      WHERE r.status = 'SUCCEEDED' AND NOT EXISTS (
        SELECT 1 FROM ledger_transactions t 
        WHERE t.reference_type = 'REFUND' AND t.reference_id = r.id
      )
    `;
    const { rows: missingRefundLedgers } = await pool.query(missingRefundLedgerQuery);
    for (const ref of missingRefundLedgers) {
      discrepancies.push({
        type: 'MISSING_REFUND_LEDGER',
        description: `Succeeded Refund ${ref.refund_id} does not have a registered ledger entry.`,
        details: {
          refundId: ref.refund_id,
          amount: ref.amount.toString(),
          paymentId: ref.payment_id
        }
      });
    }

    // 6. Check 5: Succeeded Transfers Missing Ledger Records
    const missingTransferLedgerQuery = `
      SELECT pt.id AS transfer_id, pt.amount
      FROM peer_transfers pt
      WHERE pt.status = 'SUCCEEDED' AND NOT EXISTS (
        SELECT 1 FROM ledger_transactions t 
        WHERE t.reference_type = 'TRANSFER' AND t.reference_id = pt.id
      )
    `;
    const { rows: missingTransferLedgers } = await pool.query(missingTransferLedgerQuery);
    for (const tf of missingTransferLedgers) {
      discrepancies.push({
        type: 'MISSING_TRANSFER_LEDGER',
        description: `Succeeded Transfer ${tf.transfer_id} does not have a registered ledger entry.`,
        details: {
          transferId: tf.transfer_id,
          amount: tf.amount.toString()
        }
      });
    }

    // Save run audit log
    const inconsistenciesFound = discrepancies.length;
    const runStatus = 'COMPLETED';

    const insertQuery = `
      INSERT INTO reconciliation_runs (run_date, status, total_payments_checked, total_refunds_checked, total_transfers_checked, inconsistencies_found, results)
      VALUES (CURRENT_DATE, $1, $2, $3, $4, $5, $6::jsonb)
      RETURNING *
    `;
    const { rows: runResult } = await pool.query(insertQuery, [
      runStatus,
      totalPayments,
      totalRefunds,
      totalTransfers,
      inconsistenciesFound,
      JSON.stringify(discrepancies)
    ]);

    logger.info(`Reconciliation run complete. status: ${runStatus}, Inconsistencies found: ${inconsistenciesFound}`);

    if (inconsistenciesFound > 0) {
      emitToRoom('admin', 'reconciliation.alert', runResult[0]);
    }

    return runResult[0];
  }

  async getRuns() {
    const { rows } = await pool.query('SELECT * FROM reconciliation_runs ORDER BY created_at DESC');
    return rows;
  }
}

const reconciliationService = new ReconciliationService();
export default reconciliationService;
