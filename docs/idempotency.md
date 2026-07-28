# API Idempotency

Idempotency is a critical requirement in financial technology to prevent duplicate transaction charges.

## Mechanism
Clients submit transaction requests (like `/api/transfers` or `/api/payments`) with an `Idempotency-Key` HTTP header. 

```
Idempotency-Key: <unique-uuid-or-token>
```

FinCore uses a multi-tier idempotency resolver strategy:
1. **Redis Cache Lookup**: When a request with an idempotency key arrives, the system queries Redis to see if the key has been processed recently.
2. **PostgreSQL Database Lookup**: The server checks database records (`transfers` and `payments` tables) to see if a transaction with that key has already been stored.
3. **Payload Verification**:
   - If the key exists and the request payload **matches** the original request: Return the cached/previously stored transaction response.
   - If the key exists but the request payload **differs**: Reject with a `400 IDEMPOTENCY_CONFLICT` warning.
   - If the key does not exist: Execute the request, commit records, and cache the response under the key.
