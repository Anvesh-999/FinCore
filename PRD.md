# ============================================================
# FINCORE — PRODUCT REQUIREMENTS DOCUMENT
# ============================================================

Project: FinCore
Subtitle: Digital Wallet & Payment Infrastructure Simulator
Version: 1.0
Development Plan: 5 Major Steps
Language: JavaScript ONLY
Project Type: Production-Grade Full-Stack Software Engineering Project
Primary Stack: MERN + Redis + RabbitMQ + Socket.IO
Version Control: Git + GitHub

============================================================
0. MASTER OBJECTIVE
============================================================

Build FinCore as a production-style SANDBOX payment infrastructure
platform for software-engineering portfolio and interview demonstration.

FinCore is NOT:

- a Paytm clone
- a PhonePe clone
- a banking application
- a basic wallet CRUD project
- a real-money payment processor
- a cryptocurrency project
- a UI-only fintech dashboard

FinCore IS:

A simulated payment infrastructure platform that demonstrates:

- wallets
- customer-to-customer transfers
- merchant payments
- payment orders
- double-entry ledger
- transaction consistency
- concurrency control
- idempotency
- refunds
- webhook delivery
- retries
- reconciliation
- risk rules
- audit trails
- real-time operations
- testing
- load testing
- CI/CD
- observability
- professional Git history

All funds are simulated.

Never integrate real banking credentials, card numbers, CVVs,
UPI PINs, or real-money movement.

============================================================
1. PRODUCT VISION
============================================================

FinCore should answer engineering questions such as:

"What happens if a payment request is submitted twice?"

"What happens if two withdrawals try to spend the same balance?"

"What happens if the server crashes halfway through a transfer?"

"What happens if payment succeeds but webhook delivery fails?"

"How can every balance change be audited?"

"How do refunds preserve transaction history?"

"How do we detect inconsistencies between payments and ledger entries?"

The platform should demonstrate correctness and reliability,
not simply feature count.

============================================================
2. TECHNOLOGY STACK
============================================================

FRONTEND

React
Vite
JavaScript
JSX
Redux Toolkit
React Router
Axios
Socket.IO Client
Recharts
Tailwind CSS OR a carefully implemented component system


BACKEND

Node.js
Express.js
JavaScript


TRANSACTIONAL DATABASE

PostgreSQL

Use PostgreSQL for:

accounts
wallets
payments
transfers
ledger
refunds
merchant balances
reconciliation

Reason:

The financial core requires strong relational constraints and
transaction semantics.


MONGODB

Use MongoDB only where document/event-oriented storage makes sense:

audit events
operational logs
webhook logs
risk events

Do NOT force MongoDB into the financial ledger just because the
developer knows MERN.


REDIS

Use for:

idempotency
rate limiting
temporary locks
caching
sessions/temporary state
real-time metrics


RABBITMQ

Use for:

webhooks
notifications
analytics events
reconciliation jobs where appropriate


REAL-TIME

Socket.IO


TESTING

Jest
Supertest

Use database integration tests for financial workflows.


LOAD TESTING

k6


INFRASTRUCTURE

Docker
Docker Compose


CI/CD

GitHub Actions


LANGUAGE RULE:

JAVASCRIPT ONLY.

Do NOT:

- migrate to TypeScript
- create .ts
- create .tsx
- install TypeScript unnecessarily
- create tsconfig.json

============================================================
3. USER ROLES
============================================================

CUSTOMER

Can:

- register
- login
- create/access sandbox wallet
- view balance
- transfer simulated funds
- view transaction history
- make sandbox merchant payments
- inspect payment status
- view refunds
- manage profile
- view notifications


MERCHANT

Can:

- register merchant account
- manage merchant profile
- access sandbox dashboard
- generate API credentials
- create payment orders
- inspect payments
- request refunds
- configure webhook endpoint
- inspect webhook attempts
- view transaction analytics
- view simulated settlement/reconciliation information


OPERATIONS ADMIN

Can:

- inspect users
- inspect merchants
- inspect payments
- inspect transfers
- inspect refunds
- inspect ledger transactions
- view failed transactions
- view risk alerts
- freeze/unfreeze sandbox wallets
- investigate reconciliation mismatches
- inspect webhook failures
- inspect audit history
- view system health and metrics


AUDITOR

Read-only access.

Can inspect:

- transactions
- ledger entries
- refunds
- reconciliation results
- audit trails

Cannot:

- transfer funds
- modify balances
- refund payments
- freeze wallets
- modify merchants

============================================================
4. FINANCIAL MODEL
============================================================

Never treat wallet.balance as the only financial truth.

Every movement of simulated money must produce balanced ledger entries.

Example:

Alice sends Bob $100.

Ledger transaction:

Alice Wallet       DEBIT       $100
Bob Wallet         CREDIT      $100

Total debit:

$100

Total credit:

$100

Invariant:

TOTAL DEBITS = TOTAL CREDITS

Every completed financial transaction must preserve this invariant.

Never delete completed ledger entries.

Corrections should use compensating/reversal transactions.

============================================================
5. DOUBLE-ENTRY LEDGER
============================================================

Core entities:

LedgerAccount
LedgerTransaction
LedgerEntry

LedgerTransaction example:

{
    transactionId,
    referenceType,
    referenceId,
    status,
    createdAt
}

LedgerEntry:

{
    ledgerTransactionId,
    accountId,
    direction,
    amount,
    currency,
    createdAt
}

direction:

DEBIT
CREDIT

Every ledger transaction MUST contain balanced entries.

Validate:

sum(debits) === sum(credits)

before commit.

Ledger entries become immutable after posting.

============================================================
6. WALLET MODEL
============================================================

Wallet:

{
    id,
    userId,
    currency,
    status,
    availableBalance,
    pendingBalance,
    createdAt,
    updatedAt
}

Wallet status:

ACTIVE
FROZEN
CLOSED

For V1:

USD only.

Do not introduce multi-currency complexity until the financial core
is stable.

All money values must use integer minor units internally.

Example:

$10.50

store:

1050

NEVER use floating-point arithmetic for financial values.

============================================================
7. PAYMENT STATE MACHINE
============================================================

Payment states:

CREATED
PENDING
PROCESSING
SUCCEEDED
FAILED
CANCELLED
PARTIALLY_REFUNDED
REFUNDED

Valid example:

CREATED
→ PENDING
→ PROCESSING
→ SUCCEEDED

Failure:

PROCESSING
→ FAILED

Refund:

SUCCEEDED
→ PARTIALLY_REFUNDED

or:

SUCCEEDED
→ REFUNDED

PARTIALLY_REFUNDED
→ REFUNDED

Illegal transitions must be rejected.

============================================================
8. TRANSFER STATE MACHINE
============================================================

Transfer:

CREATED
→ PROCESSING
→ COMPLETED

or:

CREATED
→ PROCESSING
→ FAILED

Completed transfers cannot simply be deleted or rewritten.

Reversal must create new financial records.

============================================================
9. IDEMPOTENCY
============================================================

CRITICAL REQUIREMENT.

Example request:

POST /api/transfers

Header:

Idempotency-Key: 98b26f0...

Suppose customer transfers $50.

Server completes transfer.

Network response is lost.

Client retries same request with same key.

FinCore MUST return the original result.

It MUST NOT create another $50 transfer.

Store:

idempotency key
request fingerprint
result
status
expiry

Same key + same request:

return original result.

Same key + different request:

reject.

Write dedicated idempotency tests.

============================================================
10. CONCURRENCY / DOUBLE-SPEND PREVENTION
============================================================

CRITICAL REQUIREMENT.

Wallet balance:

$100

Two requests arrive simultaneously:

Transfer A = $80
Transfer B = $70

Both MUST NOT succeed.

Use PostgreSQL transactions and an appropriate locking/concurrency
strategy.

Financial mutation should conceptually execute:

BEGIN

lock relevant wallet/account

validate status

validate available funds

create financial transaction

create balanced ledger entries

update derived/cached balance if architecture uses one

COMMIT

If any operation fails:

ROLLBACK

No partial financial state may remain.

Write concurrency integration tests.

============================================================
11. MERCHANT PAYMENT FLOW
============================================================

Merchant creates order.

Merchant
   ↓
Create Payment Order
   ↓
Customer Checkout
   ↓
Payment Authorization
   ↓
Risk Validation
   ↓
Processing
   ↓
Ledger Posting
   ↓
Payment Succeeded
   ↓
Merchant Balance Updated
   ↓
Webhook Event Queued
   ↓
Merchant Notified

No real card processor required.

Payment processing is sandbox simulation.

============================================================
12. REFUNDS
============================================================

Support:

FULL REFUND

and

PARTIAL REFUND

Example:

Original payment:

$100

Refund:

$30

Payment becomes:

PARTIALLY_REFUNDED

Refund remaining:

$70

A later $70 refund results in:

REFUNDED

Never allow:

refund total > captured/succeeded payment amount

Refunds must create compensating ledger transactions.

Never delete original payment entries.

============================================================
13. WEBHOOK INFRASTRUCTURE
============================================================

Merchant configures sandbox webhook endpoint.

Events:

payment.created
payment.processing
payment.succeeded
payment.failed
refund.created
refund.succeeded
transfer.completed

Webhook payload should include:

eventId
eventType
createdAt
data

Sign webhook payloads.

Example:

X-FinCore-Signature

Merchant should be able to verify authenticity.

============================================================
14. WEBHOOK DELIVERY
============================================================

Do NOT send important webhooks only from the HTTP request thread.

Use queue + worker.

Flow:

Payment Succeeded
       ↓
Create Event
       ↓
RabbitMQ
       ↓
Webhook Worker
       ↓
Merchant Endpoint

If delivery fails:

retry.

Use configurable exponential backoff.

Example:

attempt 1
attempt 2
attempt 3
...

After maximum attempts:

DEAD / FAILED

Store each attempt:

attempt number
HTTP status
timestamp
response metadata
duration

Merchant dashboard should display delivery history.

Allow manual retry of failed sandbox webhook deliveries.

============================================================
15. RECONCILIATION
============================================================

Build reconciliation engine.

Compare:

payment records

vs

ledger records

Detect:

payment SUCCEEDED but ledger missing
ledger transaction exists but payment state inconsistent
refund amount mismatch
merchant balance mismatch
unbalanced ledger transaction

Create:

reconciliation_runs
reconciliation_issues

Admin dashboard should display mismatches.

Provide:

issue type
reference
expected value
actual value
severity
status

Never silently "fix" financial inconsistencies.

Flag them for investigation or use explicit repair workflows.

============================================================
16. RISK ENGINE
============================================================

V1 uses deterministic rules.

Do NOT call this AI.

Possible rules:

- unusually large transfer
- excessive transfers in short period
- repeated payment failures
- newly created account with high transaction volume
- rapid transfers between multiple accounts
- velocity threshold exceeded

Risk levels:

LOW
MEDIUM
HIGH

Actions:

LOW:
allow

MEDIUM:
flag

HIGH:
hold/reject depending on configured sandbox rule

Store:

risk event
triggered rules
risk score
decision
timestamp

============================================================
17. AUTHENTICATION & SECURITY
============================================================

Implement:

registration
login
logout
JWT access token
refresh token
password hashing
RBAC
forgot password
reset password
session/device management if practical

Merchant authentication:

API key

Generate:

public identifier
secret

Store secret securely.

Never display secret again after creation unless architecture safely
supports regeneration.

Support API-key revocation.

============================================================
18. AUDIT TRAIL
============================================================

Important actions must create immutable audit events.

Examples:

USER_REGISTERED
LOGIN_SUCCEEDED
LOGIN_FAILED
WALLET_CREATED
WALLET_FROZEN
TRANSFER_CREATED
TRANSFER_COMPLETED
PAYMENT_CREATED
PAYMENT_SUCCEEDED
REFUND_CREATED
REFUND_SUCCEEDED
API_KEY_CREATED
WEBHOOK_CONFIGURED
RECONCILIATION_ISSUE_FOUND

Store:

actor
action
resource
resourceId
timestamp
metadata

Never store secrets inside audit metadata.

============================================================
19. RATE LIMITING
============================================================

Use Redis.

Protect:

login
registration
transfer creation
payment creation
refund endpoints
merchant API
webhook manual retry

Return appropriate HTTP status when limits are exceeded.

============================================================
20. REAL-TIME OPERATIONS
============================================================

Use Socket.IO where real-time UX adds value.

Admin dashboard can receive:

payment:new
payment:succeeded
payment:failed
transfer:completed
refund:succeeded
risk:alert
webhook:failed
reconciliation:issue

Customer can receive:

wallet:updated
transfer:completed
payment:updated
refund:updated

============================================================
21. CUSTOMER UI
============================================================

Customer application should include:

Dashboard
Wallet
Send Money
Payment Checkout
Transactions
Transaction Details
Refund Status
Notifications
Profile
Security

Dashboard:

wallet balance
recent activity
money sent
payments
refunds

Send Money:

recipient
amount
note
review
confirmation

Use clear confirmation before simulated financial action.

============================================================
22. MERCHANT UI
============================================================

Merchant dashboard:

Overview
Payments
Payment Details
Refunds
API Keys
Webhooks
Webhook Attempts
Analytics
Developers
Settings

Overview:

payment volume
successful payments
failed payments
refunds
success rate
recent transactions

Developer section should make FinCore feel like payment infrastructure,
not a consumer wallet clone.

============================================================
23. ADMIN UI
============================================================

Operations dashboard:

Overview
Customers
Merchants
Wallets
Payments
Transfers
Refunds
Ledger
Risk
Webhooks
Reconciliation
Audit Logs
System Health

Admin must be able to inspect a transaction timeline.

Example:

Payment Created
      ↓
Risk Check Passed
      ↓
Processing
      ↓
Ledger Posted
      ↓
Succeeded
      ↓
Webhook Queued
      ↓
Webhook Delivered

============================================================
24. UI / VISUAL DESIGN — CRITICAL
============================================================

The application must NOT look like a generic AI-generated dashboard.

Avoid:

- purple gradient everywhere
- giant gradient hero headings
- random glassmorphism
- excessive rounded cards
- every section placed inside a card
- excessive shadows
- glowing buttons
- emoji-based navigation
- meaningless illustrations
- random animated blobs
- overly large text
- excessive gradients
- inconsistent spacing
- identical layouts on every page
- generic "AI SaaS" appearance

The visual direction should feel like:

modern fintech
premium financial infrastructure
professional developer platform
high-trust operations software

============================================================
25. DESIGN SYSTEM
============================================================

Create a deliberate design system BEFORE building all pages.

COLOR DIRECTION:

Primary:
Deep navy / near-black

Suggested:
#0B1220
#111827

Accent:
Emerald

Suggested:
#10B981

Secondary Accent:
Blue

Suggested:
#3B82F6

Background:
#F8FAFC

Surface:
#FFFFFF

Primary text:
#0F172A

Secondary text:
#64748B

Border:
#E2E8F0

Success:
#16A34A

Warning:
#D97706

Danger:
#DC2626

Info:
#2563EB


DARK MODE OPTIONAL:

Background:
#090E17

Surface:
#111827

Elevated surface:
#182233

Text:
#F8FAFC


IMPORTANT:

Do not mechanically use every listed color.

Use neutral surfaces heavily.

Accent colors should communicate action/status.

Financial data should remain highly readable.

============================================================
26. TYPOGRAPHY
============================================================

Use a clean professional sans-serif font.

Examples:

Inter
Geist

Use one primary font family.

Typography hierarchy:

Page title
Section heading
Body
Label
Caption

Do not use 50+ pixel headings inside dashboards.

Use tabular numerals for financial values where supported.

============================================================
27. UI QUALITY
============================================================

Implement:

responsive design
desktop navigation
mobile navigation
accessible forms
keyboard focus
loading states
skeletons
empty states
error states
success states
confirmation dialogs
tooltips where useful
pagination
search
filtering
sorting
date filters

Every important action must have feedback.

Buttons must not exist without functionality.

No fake dropdowns.

No dead navigation.

No placeholder charts in final version.

No fake analytics numbers.

No "coming soon" items in primary navigation at final completion.

============================================================
28. FRONTEND ARCHITECTURE
============================================================

Example:

client/src/

app/
components/
features/
    auth/
    wallet/
    transfers/
    payments/
    refunds/
    merchant/
    webhooks/
    admin/
    reconciliation/
pages/
layouts/
hooks/
services/
store/
utils/
styles/

Create reusable:

Button
Input
Select
Modal
Dialog
Table
Badge
Pagination
Tabs
Toast
Skeleton
EmptyState
ErrorState
Stat
MoneyDisplay

Avoid creating one giant component library before features require it.

============================================================
29. BACKEND ARCHITECTURE
============================================================

Use modular monolith.

server/src/

config/

modules/
    auth/
    users/
    wallets/
    transfers/
    ledger/
    merchants/
    payments/
    refunds/
    webhooks/
    risk/
    reconciliation/
    audit/

middleware/
queues/
workers/
events/
sockets/
utils/
tests/

Each module may contain:

controller.js
service.js
repository.js
routes.js
validator.js
model/schema files

Keep controllers thin.

Financial business logic belongs in services/domain layer.

Database transaction boundaries must be explicit.

============================================================
30. API DESIGN
============================================================

Example endpoints.

AUTH

POST /api/auth/register
POST /api/auth/login
POST /api/auth/refresh
POST /api/auth/logout


WALLET

GET /api/wallet
GET /api/wallet/transactions


TRANSFERS

POST /api/transfers
GET /api/transfers
GET /api/transfers/:id


MERCHANTS

POST /api/merchants
GET /api/merchants/me


PAYMENTS

POST /api/payments
GET /api/payments
GET /api/payments/:id


REFUNDS

POST /api/payments/:id/refunds
GET /api/refunds/:id


API KEYS

POST /api/merchant/api-keys
GET /api/merchant/api-keys
DELETE /api/merchant/api-keys/:id


WEBHOOKS

POST /api/merchant/webhooks
GET /api/merchant/webhooks
GET /api/merchant/webhook-attempts
POST /api/merchant/webhook-attempts/:id/retry


ADMIN

GET /api/admin/metrics
GET /api/admin/payments
GET /api/admin/transfers
GET /api/admin/ledger
GET /api/admin/risk-events
GET /api/admin/reconciliation
GET /api/admin/audit

============================================================
31. API RESPONSE DESIGN
============================================================

Success:

{
    "success": true,
    "data": {}
}

Failure:

{
    "success": false,
    "error": {
        "code": "INSUFFICIENT_FUNDS",
        "message": "The wallet does not have sufficient available funds."
    }
}

Use domain-specific error codes.

Examples:

INSUFFICIENT_FUNDS
WALLET_FROZEN
PAYMENT_NOT_REFUNDABLE
REFUND_EXCEEDS_PAYMENT
IDEMPOTENCY_CONFLICT
INVALID_PAYMENT_STATE
RATE_LIMIT_EXCEEDED

============================================================
32. TESTING REQUIREMENTS
============================================================

Financial logic requires serious testing.

Required:

unit tests
API integration tests
database integration tests
concurrency tests
idempotency tests
authorization tests
ledger invariant tests
webhook tests
refund tests
reconciliation tests


CRITICAL TEST #1

Wallet:

$100

Concurrent:

$80 transfer
$70 transfer

Expected:

Only a valid subset may succeed.

Final wallet state must remain valid.


CRITICAL TEST #2

Send identical transfer request 10 times using same idempotency key.

Expected:

Exactly ONE financial transfer.


CRITICAL TEST #3

Every completed financial transaction:

total debit == total credit


CRITICAL TEST #4

$100 payment

refund $70
refund $40

Second refund must fail.


CRITICAL TEST #5

Webhook endpoint fails.

Verify:

retries occur
attempts recorded
payment remains SUCCEEDED

Webhook failure must NOT reverse successful payment.

============================================================
33. LOAD TESTING
============================================================

Use k6.

Benchmark:

authentication
balance reads
transfer creation
payment creation
merchant payment queries

Measure:

requests/sec
p50
p95
p99
failure rate

Run concurrency scenarios specifically for transfers.

Never put fabricated numbers in README or resume.

============================================================
34. OBSERVABILITY
============================================================

Structured logs should include when relevant:

requestId
userId
merchantId
paymentId
transferId
refundId
event
duration
timestamp

Do NOT log:

password
JWT
API secret
sensitive credentials

Track:

API latency
payment success rate
payment failure rate
webhook success rate
queue depth
reconciliation issues
risk alerts

============================================================
35. DOCKER
============================================================

Dockerize:

frontend
backend
workers

Docker Compose local environment:

frontend
backend
PostgreSQL
MongoDB
Redis
RabbitMQ
workers

Provide health checks where practical.

============================================================
36. CI/CD
============================================================

GitHub Actions:

checkout
↓
install
↓
lint
↓
tests
↓
build
↓
integration verification

CI must run for:

push
pull request

Do not ignore failing CI.

============================================================
37. SECURITY REQUIREMENTS
============================================================

Implement:

Helmet
CORS
input validation
password hashing
JWT security
refresh token handling
RBAC
API key hashing/storage strategy
rate limiting
request-size limits
secure error handling
audit trails

Do not expose internal stack traces in production.

============================================================
38. GIT RULES — MANDATORY
============================================================

Git is part of development.

If Git is already initialized:

DO NOT run git init again.

Inspect:

git status
git branch --show-current
git remote -v

If origin exists:

use it.

If origin does not exist:

STOP and request repository URL.

Never invent a GitHub URL.

============================================================
39. GIT SECURITY
============================================================

Never commit:

.env
.env.local
.env.production
database passwords
JWT secrets
Redis credentials
RabbitMQ credentials
API secrets
private keys
node_modules
logs
coverage
unnecessary build output

Maintain:

.env.example

with variable names only.

============================================================
40. COMMIT POLICY
============================================================

Development has EXACTLY FIVE MAJOR STEPS.

Each step contains smaller portions.

Commit each meaningful tested portion.

At the END of each major step:

- run all relevant tests
- run lint
- run build
- inspect git status
- push all completed commits
- verify remote sync
- create a milestone commit if there are final step-level changes
- STOP

Do NOT begin the next major step automatically.

Wait for explicit instruction to continue.

This allows each major step to be reviewed before proceeding.

============================================================
41. CONVENTIONAL COMMITS
============================================================

Use:

feat:
fix:
test:
docs:
refactor:
perf:
chore:
ci:
build:

Examples:

chore(repo): initialize FinCore workspace

feat(auth): implement customer authentication

feat(wallet): add sandbox wallet management

feat(ledger): implement double-entry posting

feat(transfer): add atomic wallet transfers

feat(payment): implement merchant payment flow

feat(refund): add partial and full refunds

feat(webhook): implement reliable delivery worker

feat(reconciliation): detect ledger inconsistencies

test(transfer): verify concurrent spending safety

test(ledger): enforce balanced transaction invariant

perf(payment): optimize payment queries

ci(github): add FinCore CI pipeline

docs(readme): document financial architecture

============================================================
42. FIVE-STEP DEVELOPMENT PLAN
============================================================


############################################################
# STEP 1 — FOUNDATION + DESIGN SYSTEM + AUTH
############################################################

GOAL:

Create the complete technical and visual foundation.

At the end of Step 1 the application should:

- run
- connect to required databases
- authenticate users
- support roles
- have professional layouts
- have a reusable design system
- be committed and pushed


STEP 1A — REPOSITORY

Inspect Git.

Create:

client/
server/
docs/

Configure:

.gitignore
.env.example
README.md

Suggested commit:

chore(repo): configure FinCore workspace


STEP 1B — FRONTEND

Initialize:

React
Vite
JavaScript

Configure:

routing
Redux Toolkit
API client
global styling

Suggested commit:

chore(frontend): initialize FinCore React application


STEP 1C — DESIGN SYSTEM

Implement:

color tokens
typography
spacing
buttons
inputs
selects
badges
dialogs
tables
toasts
loading states
navigation

Build:

PublicLayout
CustomerLayout
MerchantLayout
AdminLayout

Create responsive navigation.

Suggested commit:

feat(ui): implement FinCore design system


STEP 1D — BACKEND

Initialize:

Node.js
Express
JavaScript

Implement:

environment validation
central errors
logging
health endpoint
security middleware

Suggested commit:

chore(backend): initialize FinCore API


STEP 1E — DATABASE INFRASTRUCTURE

Configure:

PostgreSQL
MongoDB
Redis

Add health verification.

Suggested commit:

feat(infra): configure FinCore data infrastructure


STEP 1F — AUTHENTICATION

Implement:

registration
login
logout
refresh token
password hashing
RBAC

Roles:

CUSTOMER
MERCHANT
ADMIN
AUDITOR

Build frontend auth pages.

Suggested commit:

feat(auth): implement role-based authentication


STEP 1G — TESTS

Test:

registration
login
invalid credentials
refresh
protected routes
role restrictions

Suggested commit:

test(auth): add authentication integration tests


STEP 1 COMPLETION CHECK:

[ ] App runs
[ ] Frontend builds
[ ] Backend runs
[ ] Databases connect
[ ] Redis connects
[ ] Authentication works
[ ] RBAC works
[ ] UI is responsive
[ ] No TypeScript
[ ] Tests pass
[ ] No secrets staged
[ ] All commits pushed


END STEP 1.

STOP.

Do NOT begin Step 2 until instructed.


############################################################
# STEP 2 — WALLET + LEDGER + TRANSFER ENGINE
############################################################

GOAL:

Build FinCore's financial foundation.

This is the most important correctness phase.


STEP 2A — WALLET

Create sandbox wallet automatically or through defined onboarding.

Support:

balance
status
transaction history

Wallet statuses:

ACTIVE
FROZEN
CLOSED

Suggested commit:

feat(wallet): implement sandbox wallet management


STEP 2B — LEDGER

Implement:

LedgerAccount
LedgerTransaction
LedgerEntry

Enforce:

total debit === total credit

Use integer minor units.

Make posted ledger entries immutable.

Suggested commit:

feat(ledger): implement double-entry ledger


STEP 2C — TRANSFERS

Implement customer-to-customer transfer.

Flow:

validate
↓
lock
↓
check funds
↓
create transfer
↓
post ledger
↓
update balance projection
↓
commit

Suggested commit:

feat(transfer): implement atomic wallet transfers


STEP 2D — IDEMPOTENCY

Support:

Idempotency-Key

Prevent duplicate transfer execution.

Suggested commit:

feat(transfer): add idempotent transfer processing


STEP 2E — CONCURRENCY

Implement safe concurrent spending.

Test:

wallet = $100

concurrent:
$80
$70

Invalid overspending must never occur.

Suggested commit:

test(transfer): verify concurrent spending safety


STEP 2F — CUSTOMER UI

Build:

Customer Dashboard
Wallet
Send Money
Transfer Confirmation
Transaction History
Transaction Details

Every UI action must call real backend functionality.

Suggested commit:

feat(customer-ui): build wallet and transfer experience


STEP 2G — ADMIN LEDGER VIEW

Admin can inspect:

wallets
transfers
ledger transactions
ledger entries

Suggested commit:

feat(admin): add financial ledger explorer


STEP 2 COMPLETION CHECK:

[ ] Wallet works
[ ] Ledger works
[ ] Ledger balances
[ ] Transfers work
[ ] Insufficient funds handled
[ ] Frozen wallet handled
[ ] Idempotency works
[ ] Concurrent overspending prevented
[ ] Customer UI functional
[ ] Admin ledger functional
[ ] Tests pass
[ ] Build passes
[ ] All commits pushed


END STEP 2.

STOP.


############################################################
# STEP 3 — MERCHANT PAYMENTS + REFUNDS + DEVELOPER PLATFORM
############################################################

GOAL:

Transform FinCore from wallet application into payment infrastructure.


STEP 3A — MERCHANT ACCOUNTS

Implement:

merchant profile
business information
merchant status

Suggested commit:

feat(merchant): implement merchant accounts


STEP 3B — API KEYS

Merchant can:

create API key
view key metadata
revoke key

Secret should be shown securely on creation.

Suggested commit:

feat(merchant): add sandbox API key management


STEP 3C — PAYMENT ORDERS

Merchant creates payment order.

Store:

merchant
amount
currency
reference
metadata
status

Suggested commit:

feat(payment): implement payment order creation


STEP 3D — CHECKOUT

Build professional FinCore sandbox checkout.

Customer sees:

merchant
amount
wallet
payment summary
confirm button

Process simulated payment.

Suggested commit:

feat(checkout): implement sandbox payment checkout


STEP 3E — PAYMENT ENGINE

Implement state machine:

CREATED
PENDING
PROCESSING
SUCCEEDED
FAILED
CANCELLED

Successful payment must post balanced ledger entries atomically.

Suggested commit:

feat(payment): implement transactional payment processing


STEP 3F — REFUNDS

Implement:

partial refund
full refund

Enforce refund limits.

Create compensating ledger entries.

Suggested commit:

feat(refund): implement payment refunds


STEP 3G — MERCHANT DASHBOARD

Build:

Overview
Payments
Payment Details
Refunds
API Keys
Developer Settings

Charts must use real application data.

Suggested commit:

feat(merchant-ui): build merchant payment dashboard


STEP 3H — TESTING

Test:

payment state machine
merchant authorization
API key authentication
payment ledger posting
full refund
partial refund
refund overflow
concurrent refund attempts

Suggested commit:

test(payment): add payment and refund integration tests


STEP 3 COMPLETION CHECK:

[ ] Merchant onboarding works
[ ] API keys work
[ ] Payment orders work
[ ] Checkout works
[ ] Payments post ledger entries
[ ] Refunds work
[ ] Refund limits enforced
[ ] Merchant dashboard works
[ ] Developer section works
[ ] Tests pass
[ ] Build passes
[ ] All commits pushed


END STEP 3.

STOP.


############################################################
# STEP 4 — WEBHOOKS + RISK + RECONCILIATION + OPERATIONS
############################################################

GOAL:

Add production-style reliability and operations engineering.


STEP 4A — RABBITMQ

Configure:

RabbitMQ
queues
workers
retry strategy

Suggested commit:

feat(queue): configure asynchronous processing


STEP 4B — WEBHOOK CONFIGURATION

Merchant can:

register endpoint
enable/disable endpoint
select events
rotate webhook secret if supported

Suggested commit:

feat(webhook): add merchant webhook configuration


STEP 4C — WEBHOOK DELIVERY

Implement:

signed events
queue
worker
delivery
attempt logging
retry
failed state

Suggested commit:

feat(webhook): implement reliable webhook delivery


STEP 4D — WEBHOOK UI

Merchant sees:

event
endpoint
status
attempts
HTTP response
timestamp

Allow eligible failed events to retry.

Suggested commit:

feat(merchant-ui): add webhook delivery console


STEP 4E — RISK ENGINE

Implement deterministic risk rules.

Store:

rules triggered
risk score
decision

Admin dashboard:

risk alerts
filters
transaction details

Suggested commit:

feat(risk): implement transaction risk rules


STEP 4F — RECONCILIATION

Create reconciliation engine.

Detect:

missing ledger
payment mismatch
refund mismatch
balance mismatch
unbalanced transaction

Suggested commit:

feat(reconciliation): implement financial consistency checks


STEP 4G — OPERATIONS DASHBOARD

Build high-quality Admin Operations UI.

Overview:

transaction volume
payment success rate
failed payments
refund volume
webhook failures
risk alerts
reconciliation issues

Pages:

Payments
Transfers
Refunds
Ledger
Risk
Webhooks
Reconciliation
Audit

Suggested commit:

feat(admin): build FinCore operations console


STEP 4H — REAL-TIME

Socket.IO:

payment updates
transfer updates
risk alerts
webhook failures
reconciliation alerts

Suggested commit:

feat(realtime): add live operations events


STEP 4I — TESTING

Test:

webhook signing
webhook retries
webhook failure isolation
risk rules
reconciliation detection
admin RBAC

Suggested commit:

test(operations): verify reliability workflows


STEP 4 COMPLETION CHECK:

[ ] RabbitMQ works
[ ] Webhook configuration works
[ ] Signed webhook works
[ ] Retry works
[ ] Failed attempts recorded
[ ] Risk engine works
[ ] Reconciliation works
[ ] Admin operations UI works
[ ] Real-time events work
[ ] Tests pass
[ ] Build passes
[ ] All commits pushed


END STEP 4.

STOP.


############################################################
# STEP 5 — PRODUCTION QUALITY + PERFORMANCE + DEPLOYMENT
############################################################

GOAL:

Turn the working application into a polished portfolio product.


STEP 5A — COMPLETE UI REVIEW

Review EVERY page.

Fix:

spacing
typography
responsive behavior
loading
empty states
errors
forms
tables
dialogs
navigation
mobile layouts

Verify:

No dead buttons.

No fake forms.

No placeholder charts.

No broken navigation.

No generic AI-generated visual patterns.

Suggested commit:

refactor(ui): polish FinCore product experience


STEP 5B — SECURITY REVIEW

Verify:

authentication
authorization
RBAC
rate limiting
validation
API key security
CORS
Helmet
secret handling
error handling
audit logging

Suggested commit:

fix(security): harden FinCore application security


STEP 5C — COMPLETE TEST SUITE

Run and expand:

unit
integration
financial invariant
idempotency
concurrency
refund
webhook
reconciliation
authorization

Suggested commit:

test(core): complete FinCore reliability test suite


STEP 5D — LOAD TESTING

Configure k6.

Test:

balance reads
transfers
payment creation
merchant queries

Record:

throughput
p50
p95
p99
failure rate

Suggested commit:

test(load): benchmark FinCore payment APIs


STEP 5E — PERFORMANCE

Optimize ONLY measured bottlenecks.

Possible:

database indexes
query optimization
Redis caching
connection pooling
worker concurrency

Suggested commit example:

perf(payment): optimize transaction query performance


STEP 5F — DOCKER

Create:

frontend Dockerfile
backend Dockerfile
worker Dockerfile
docker-compose.yml

Local stack:

frontend
backend
PostgreSQL
MongoDB
Redis
RabbitMQ
worker

Suggested commit:

build(docker): containerize FinCore platform


STEP 5G — CI/CD

GitHub Actions:

lint
tests
build

Suggested commit:

ci(github): add FinCore validation pipeline


STEP 5H — DEPLOYMENT

Deploy appropriate components.

Never commit production secrets.

Verify:

frontend
API
database
Redis
workers
WebSockets
webhooks

Fix production-specific problems individually.


STEP 5I — DOCUMENTATION

Complete:

README.md

docs/architecture.md
docs/ledger.md
docs/payments.md
docs/idempotency.md
docs/concurrency.md
docs/webhooks.md
docs/reconciliation.md
docs/security.md
docs/testing.md
docs/performance.md


README must include:

FinCore overview
Problem
Architecture diagram
Features
Tech stack
Screenshots
Setup
Environment variables
Docker
API documentation
Ledger design
Payment lifecycle
Concurrency strategy
Idempotency
Webhook architecture
Reconciliation
Security
Testing
Measured benchmarks
Deployment
Known limitations
Future work


Suggested commit:

docs(readme): complete FinCore documentation


STEP 5J — FINAL FUNCTIONAL AUDIT

Manually verify complete flows:

CUSTOMER:

register
login
wallet
send money
history
merchant checkout
refund visibility


MERCHANT:

register
API key
payment order
payment details
refund
webhook configuration
webhook history
analytics


ADMIN:

payments
transfers
ledger
risk
reconciliation
audit


FINANCIAL:

ledger balanced
no overspending
idempotency
refund limits
immutable history


SYSTEM:

Redis
RabbitMQ
Socket.IO
Docker
CI
deployment


STEP 5 COMPLETION CHECK:

[ ] UI polished
[ ] Responsive
[ ] No dead functionality
[ ] Security reviewed
[ ] Tests pass
[ ] Concurrency tests pass
[ ] Ledger invariants pass
[ ] Load tests completed
[ ] Docker works
[ ] CI passes
[ ] Deployment works
[ ] Documentation complete
[ ] All Git commits pushed
[ ] No secrets in repository
[ ] Working tree clean


END STEP 5.

FINCORE COMPLETE.


============================================================
43. GIT WORKFLOW FOR EVERY PORTION
============================================================

For every coherent portion:

INSPECT
↓
PLAN
↓
IMPLEMENT
↓
LINT
↓
TEST
↓
BUILD IF RELEVANT
↓
MANUAL FUNCTIONAL CHECK
↓
git status
↓
git diff
↓
REVIEW CHANGES
↓
STAGE RELEVANT FILES
↓
COMMIT
↓
PUSH
↓
VERIFY PUSH

Do not blindly stage unrelated files.

Do not use:

git add .

without reviewing what changed.

Never:

git push --force

unless explicitly authorized.


============================================================
44. STEP BOUNDARY RULE
============================================================

After each of the FIVE major steps:

1. Run all relevant tests.
2. Run frontend build.
3. Verify backend.
4. Review Git status.
5. Verify no secrets.
6. Push remaining commits.
7. Verify remote repository contains the commits.
8. Generate step report.
9. STOP.

Report:

STEP:
1 / 2 / 3 / 4 / 5

STATUS:
PASS / FAIL

IMPLEMENTED:
- ...

TESTS:
- ...

BUILD:
PASS / FAIL

COMMITS:
- hash — message

PUSH:
SUCCESS / FAILED

KNOWN ISSUES:
- ...

NEXT STEP:
...

Do NOT begin the next step without user instruction.


============================================================
45. FUNCTIONALITY RULE
============================================================

A feature is NOT complete because:

- UI exists
- API route exists
- button exists
- database schema exists

A feature is complete only when the entire workflow works.

Example:

"Send Money" complete means:

form
↓
validation
↓
API request
↓
authentication
↓
idempotency
↓
financial validation
↓
database transaction
↓
ledger posting
↓
successful response
↓
UI update
↓
transaction history
↓
tests

Every primary UI action must have real behavior.


============================================================
46. UI QUALITY RULE
============================================================

Before marking a page complete, inspect it visually.

Ask:

Does it look intentionally designed?

Is hierarchy obvious?

Is spacing consistent?

Are financial numbers easy to scan?

Are statuses visually clear?

Does it work on mobile?

Does it work on desktop?

Are loading/error/empty states present?

Are forms understandable?

Does every button work?

Does this look like a serious fintech product rather than a generated
template?

Fix issues before committing the page as complete.


============================================================
47. PROHIBITED SHORTCUTS
============================================================

DO NOT:

- fake backend responses in final implementation
- hardcode analytics
- hardcode transaction history
- fake balance changes only in frontend state
- bypass ledger for financial mutations
- use floats for money
- ignore failed tests
- remove tests just to make CI pass
- hide backend errors
- disable security middleware to fix bugs
- disable validation to make requests work
- commit secrets
- fabricate load-test results
- fabricate Git pushes
- mark broken functionality complete
- introduce unnecessary microservices
- introduce AI without a genuine requirement
- migrate JavaScript to TypeScript


============================================================
48. PROJECT DOCUMENTATION DURING DEVELOPMENT
============================================================

Create:

docs/PROJECT_SPEC.md
docs/PROGRESS.md

PROJECT_SPEC.md:

Permanent version of FinCore requirements and architecture.

PROGRESS.md:

Track:

STEP 1 — [COMPLETE / IN PROGRESS / NOT STARTED]
STEP 2 — [...]
STEP 3 — [...]
STEP 4 — [...]
STEP 5 — [...]

Within each step:

[COMPLETE]
[IN PROGRESS]
[NOT STARTED]
[BLOCKED]

Record relevant commit hashes.

Update progress after each major step.


============================================================
49. FINAL DEMO
============================================================

A strong final demo should show:

1. Customer login.

2. Wallet balance.

3. Send $100 to another sandbox customer.

4. Show transaction.

5. Open ledger.

6. Demonstrate debit/credit entries.

7. Merchant creates $75 payment order.

8. Customer completes checkout.

9. Merchant dashboard updates.

10. Show payment timeline.

11. Merchant refunds $25.

12. Show PARTIALLY_REFUNDED.

13. Show compensating ledger entries.

14. Configure webhook.

15. Trigger payment.

16. Show webhook delivery.

17. Demonstrate failed webhook retry.

18. Open operations dashboard.

19. Show risk events.

20. Run reconciliation.

21. Show clean reconciliation or deliberately seeded sandbox mismatch.

22. Show automated tests.

23. Show concurrency test.

24. Show idempotency test.

25. Show load-test results.

26. Show GitHub commit history.

27. Show CI pipeline.

28. Show deployed application.


============================================================
50. RESUME POSITIONING
============================================================

Project Name:

FinCore — Payment Infrastructure Simulator


Do NOT write:

"Built a digital wallet using MERN."


Target final resume description after verified implementation:

"Engineered a sandbox payment infrastructure platform with atomic
wallet transfers, double-entry ledger accounting, idempotent payment
APIs, partial/full refunds, reliable webhook delivery and automated
reconciliation."


Second bullet can eventually use measured results:

"Designed concurrency-safe transaction processing and benchmarked the
system at [ACTUAL RESULT] while preserving ledger invariants under
concurrent payment workloads."

Replace [ACTUAL RESULT] ONLY with measured data.


============================================================
51. FINAL QUALITY TARGET
============================================================

FinCore should demonstrate:

FRONTEND ENGINEERING
BACKEND ENGINEERING
DATABASE ENGINEERING
CONCURRENCY
FINANCIAL CORRECTNESS
API DESIGN
SECURITY
EVENT-DRIVEN SYSTEMS
RELIABILITY
TESTING
PERFORMANCE
DEVOPS
SYSTEM DESIGN

The project should be sufficiently deep that an interviewer can ask
about it for 20–30 minutes and the implementation contains real
engineering decisions to discuss.


============================================================
52. FIRST AGENT INSTRUCTION
============================================================

Read this entire PRD.

Treat it as the source of truth.

DO NOT implement all five steps at once.

FIRST:

Inspect the current directory.

Run:

git status
git branch --show-current
git remote -v

Determine whether the folder already contains code.

If Git is already initialized:

DO NOT run git init.

If GitHub origin exists:

use it.

If origin does not exist:

STOP and ask for repository URL.

Then implement ONLY:

STEP 1 — FOUNDATION + DESIGN SYSTEM + AUTH

Within Step 1:

work portion by portion.

After every coherent portion:

TEST
→ REVIEW
→ COMMIT
→ PUSH
→ VERIFY

After Step 1 is completely functional:

run all Step 1 tests
run frontend build
verify backend
verify GitHub sync

Then STOP.

Report:

STEP 1 STATUS
IMPLEMENTED FEATURES
FILES/AREAS CREATED
TEST RESULTS
BUILD RESULTS
COMMIT HASHES
PUSH STATUS
KNOWN ISSUES

Do NOT start Step 2.

Use JavaScript only.

Do not sacrifice functionality for speed.

Do not mark something complete unless it actually works.

# END OF FINCORE PRD