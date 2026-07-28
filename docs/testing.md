# Reliability Testing Suite

FinCore is backed by a thorough suite of mock-based integration tests.

## Test Harness Strategy
Because FinCore relies on various backend engines (PostgreSQL, MongoDB, Redis, RabbitMQ), setting up local test databases on developer workstations can be error-prone. 

To solve this, FinCore mocks database adapters dynamically during test execution:
1. **PostgreSQL Mocking**: Mocks the `pg` client connection pool and query functions using `jest.unstable_mockModule` to intercept queries and execute them against an in-memory mock database state.
2. **Redis Mocking**: Intercepts `redis` client commands, simulating caching, token storage, and key verification.
3. **MongoDB Mocking**: Intercepts `mongoose` event log queries to test write events.

This design enables tests to run in under 25 seconds with zero external database dependencies, making it suitable for clean CI pipelines.

## Test Categories
* `auth.test.js`: Checks user registration, token validation, RBAC route gates, and refresh operations.
* `transfer.test.js`: Tests atomic peer transfers, insufficient funds warnings, frozen wallets, and transfer idempotency key collisions.
* `payment.test.js`: Verifies payment orders, checkout state transitions, refund sum checks, and concurrent checkout safety.
* `operations.test.js`: Tests webhook HMAC validations, exponential backoff, risk rules (excissive transfers, velocity limits), and reconciliation runs.

## Running Tests
Run the test suite using:
```bash
cd server
npm test
```
