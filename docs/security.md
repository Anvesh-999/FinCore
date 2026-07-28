# Security Architecture

FinCore implements premium fintech security controls to defend system boundaries.

## 1. Authentication & Session Control
* **Dual JWT tokens**: Custom short-lived Access Tokens (passed in HTTP headers) and longer-lived Refresh Tokens (passed in secure, HTTP-only, SameSite cookies to protect against Cross-Site Scripting (XSS) and Cross-Site Request Forgery (CSRF)).
* **Password Hashing**: Uses `bcryptjs` with a work factor of 10 for storing login user credentials.

## 2. API Key Management
* Merchant API Keys are generated in pairs: a public key identifier (`pk_sandbox_...`) and a secret key (`sk_sandbox_...`).
* The server hashes the secret key using `bcryptjs` and stores only the hash in `merchant_api_keys`.
* Secrets are displayed to the merchant only once upon creation, preventing credential leaks.

## 3. Operations Controls (RBAC)
* Route-level middlewares enforce Role-Based Access Control (RBAC) gates:
  - `CUSTOMER`: Can perform peer transfers and complete checkouts.
  - `MERCHANT`: Can generate API keys, view statistics, trigger refunds, and define webhooks.
  - `ADMIN`: Full read access, status updates (wallets freezing), and manual reconciliation triggers.
  - `AUDITOR`: Read-only views of ledger, risk logs, and reconciliation tables.

## 4. Rate Limiting & Networking Headers
* Redis rate limiter defends login/registration and checkout routes from brute-force attempts.
* **Helmet.js** attaches standard security headers to API responses to prevent mime-sniffing, clickjacking, and XSS.
