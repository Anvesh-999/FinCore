# Double-Entry Ledger Design

FinCore uses a strict double-entry ledger system to enforce accounting correctness.

## Ledger Invariant
The master invariant of the ledger is:
$$\sum \text{Debits} = \sum \text{Credits}$$

For every financial movement of simulated funds (onboarding grant, peer transfer, payment checkout, refund transaction), a ledger record is posted with balanced line entries. If the sum of debits does not match the sum of credits, the database transaction is aborted and rolled back.

## Database Schema

```sql
-- Ledger Accounts Table
CREATE TABLE IF NOT EXISTS ledger_accounts (
    id SERIAL PRIMARY KEY,
    holder_type VARCHAR(50) NOT NULL CHECK (holder_type IN ('CUSTOMER', 'MERCHANT', 'SYSTEM')),
    holder_id INTEGER, -- References users.id (null for system pools)
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ledger Transactions Table
CREATE TABLE IF NOT EXISTS ledger_transactions (
    id VARCHAR(100) PRIMARY KEY, -- uuid
    reference_type VARCHAR(50) NOT NULL, -- 'TRANSFER', 'PAYMENT', 'REFUND', 'ONBOARDING_GRANT'
    reference_id VARCHAR(100), -- ID of business entity
    status VARCHAR(50) NOT NULL DEFAULT 'POSTED',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ledger Entries Table
CREATE TABLE IF NOT EXISTS ledger_entries (
    id SERIAL PRIMARY KEY,
    ledger_transaction_id VARCHAR(100) NOT NULL REFERENCES ledger_transactions(id) ON DELETE CASCADE,
    ledger_account_id INTEGER NOT NULL REFERENCES ledger_accounts(id),
    direction VARCHAR(20) NOT NULL CHECK (direction IN ('DEBIT', 'CREDIT')),
    amount BIGINT NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
```

## Immutability Rule
Once posted, ledger entries are strictly immutable. They cannot be modified, deleted, or rewritten. Any corrections (such as customer refunds) must be posted as new compensating reversal entries.
For example, a **Refund** of $10.00 will debit the Merchant's Ledger Account and credit the Customer's Ledger Account.
