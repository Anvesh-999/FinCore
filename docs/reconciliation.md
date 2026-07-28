# Financial Reconciliation Engine

The Reconciliation Engine is an audit utility built to discover discrepancies in transactional balances.

## Audit Scenarios
The reconciliation runner executes scheduled checks or manually triggered admin consistency checks:
1. **Missing Ledger Entries**: Scans the `payments` and `transfers` tables to check if a corresponding `ledger_transaction` exists for every transaction marked as `SUCCEEDED` or `COMPLETED`.
2. **Inconsistent Transaction States**: Detects payments where state is `SUCCEEDED` but ledger transaction is missing, or vice versa.
3. **Refund Mismatches**: Matches the sum of refund ledger values against the total refunded amount recorded in payment entities.
4. **Balance Verification**: Cross-checks wallet available balances against the sum of all double-entry ledger lines posted to their respective accounts.

## Operations Handling
* Reconciliation runs do not silently "fix" errors to avoid muddying audit trails.
* Instead, runs create logs in the `reconciliation_runs` table detailing exactly what inconsistencies were detected.
* Discrepancies trigger a real-time socket alert to the Operations Admin dashboard for operator investigation.
