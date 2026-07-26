# FinCore — Digital Wallet & Payment Infrastructure Simulator

FinCore is a production-style sandbox payment infrastructure platform demonstrating core fintech engineering principles: double-entry ledgers, transactional safety, idempotency, rate limiting, and real-time operations.

## Tech Stack
- **Frontend**: React, Vite, Redux Toolkit, Tailwind CSS, Socket.IO Client
- **Backend**: Node.js, Express.js
- **Databases**: PostgreSQL (transactions & wallets), MongoDB (audit & logs), Redis (idempotency, rate limiting, cache)
- **Queues**: RabbitMQ (webhooks & asynchronous tasks)

## Project Structure
- `client/` - React frontend application
- `server/` - Node.js Express backend API
- `docs/` - Technical specification & design docs

## Getting Started

### Prerequisites
Ensure you have the following running locally:
- Node.js (v18+)
- PostgreSQL
- MongoDB
- Redis
- RabbitMQ

### Installation

1. Clone the repository
2. Set up environment files:
   ```bash
   cp .env.example server/.env
   ```
3. Install dependencies and start servers:
   Refer to directories `client/` and `server/` for specific run instructions.
