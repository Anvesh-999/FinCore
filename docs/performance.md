# Performance Benchmarks

FinCore is designed to achieve high throughput and low latency under peak transaction volumes.

## Concurrency Optimizations
1. **Connection Pooling**: PostgreSQL connections are pooled (`pg.Pool`) with a max size of 20 to limit socket overhead.
2. **Redis Caching**: Idempotency checks bypass heavy SQL queries by checking Redis values.
3. **Database Indexing**: Relational tables include explicit compound and single indexes:
   - `idx_users_email` on `users(email)`
   - `idx_wallets_user_id` on `wallets(user_id)`
   - `idx_ledger_entries_transaction` on `ledger_entries(ledger_transaction_id)`
   - `idx_merchant_api_keys_pubkey` on `merchant_api_keys(public_key)`
   - `idx_payments_idempotency` on `payments(merchant_id, idempotency_key)`

## Load Testing Configuration
The load-testing suite can be executed using `k6`.
Example test script (`k6_script.js`):
* Warm-up: 50 virtual users read wallet balances.
* Peak: 200 virtual users perform peer transfers.
* Target Metrics:
  - Throughput: > 500 requests/sec.
  - Latency (p95): < 150ms.
  - Failure Rate: < 0.1%.
