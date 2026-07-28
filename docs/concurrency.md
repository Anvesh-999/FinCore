# Concurrency & Double-Spend Prevention

Preventing balance overdrawing under concurrent request volume is a core technical requirement.

## The Problem
Suppose a user has an active balance of $100.00 (10000 cents). Two concurrent requests arrive at the same time:
* Request A: Transfer $80.00
* Request B: Transfer $70.00

If both processes check the balance simultaneously, they will both read $100.00 and proceed to write modifications. This results in the user overdrawing their account to -$50.00 (a financial leakage).

## The FinCore Solution
FinCore uses PostgreSQL transaction isolation and row locking (`SELECT FOR UPDATE`) to serialise balance checkouts.

The execution sequence is:
1. **BEGIN**: Initialize database transaction.
2. **Lock row**: Query the customer's wallet using `SELECT ... FROM wallets WHERE id = $1 FOR UPDATE`. This locks the row and blocks any other query trying to read or write to it until the current transaction commits or rolls back.
3. **Lock recipient**: Lock the recipient's wallet row using `SELECT ... FOR UPDATE` (ordered by ID to prevent deadlocks).
4. **Validate**: Check that the sender wallet status is `ACTIVE` and that `available_balance >= amount`.
5. **Update Balances**: Debit sender, credit recipient.
6. **Post Ledger**: Create ledger entries.
7. **COMMIT**: Release locks. If any step fails, a `ROLLBACK` is issued.
