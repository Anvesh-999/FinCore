import { jest, describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import request from 'supertest';

// Local simulated database state for testing concurrency and invariants
let localWallets = {
  1: { id: 1, user_id: 1, available_balance: 100000n, status: 'ACTIVE', currency: 'USD' }, // Sender ($1000)
  2: { id: 2, user_id: 2, available_balance: 50000n, status: 'ACTIVE', currency: 'USD' },  // Recipient ($500)
  3: { id: 3, user_id: 3, available_balance: 10000n, status: 'FROZEN', currency: 'USD' },  // Frozen ($100)
};

let localUsers = {
  1: { id: 1, email: 'sender@example.com', role: 'CUSTOMER', first_name: 'Sender', last_name: 'User' },
  2: { id: 2, email: 'recipient@example.com', role: 'CUSTOMER', first_name: 'Recipient', last_name: 'User' },
  3: { id: 3, email: 'frozen@example.com', role: 'CUSTOMER', first_name: 'Frozen', last_name: 'User' },
};

let mockTransfers = [];
let mockLedgerTransactions = [];
let mockLedgerEntries = [];
let lockedWallets = new Set();

const mockQuery = jest.fn(async (text, params) => {
  // 1. SELECT users BY email
  if (text.includes('SELECT * FROM users WHERE email = $1')) {
    const email = params[0];
    const user = Object.values(localUsers).find((u) => u.email === email);
    return { rows: user ? [user] : [] };
  }

  // 2. SELECT users BY id
  if (text.includes('SELECT id, first_name, last_name, email, role, created_at FROM users WHERE id = $1')) {
    const id = params[0];
    const user = localUsers[id];
    return { rows: user ? [user] : [] };
  }

  // 3. SELECT wallets BY user_id
  if (text.includes('SELECT * FROM wallets WHERE user_id = $1')) {
    const userId = params[0];
    const wallet = Object.values(localWallets).find((w) => w.user_id === userId);
    return { rows: wallet ? [wallet] : [] };
  }

  // 4. SELECT wallets FOR UPDATE (Simulating PostgreSQL Row Locking)
  if (text.includes('SELECT * FROM wallets WHERE id = $1 FOR UPDATE')) {
    const id = params[0];
    // If already locked by another concurrent process, wait
    while (lockedWallets.has(id)) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    lockedWallets.add(id);
    return { rows: [localWallets[id]] };
  }

  // 5. UPDATE wallets balance
  if (text.includes('UPDATE wallets')) {
    const id = params[0];
    const change = BigInt(params[1]);
    localWallets[id].available_balance += change;
    return { rows: [localWallets[id]] };
  }

  // 6. SELECT ledger_accounts
  if (text.includes('SELECT * FROM ledger_accounts')) {
    const holderId = params[1];
    return { rows: [{ id: holderId, holder_type: 'CUSTOMER', holder_id: holderId }] };
  }

  // 7. INSERT transfers
  if (text.includes('INSERT INTO transfers')) {
    const transfer = {
      id: params[0],
      sender_wallet_id: params[1],
      recipient_wallet_id: params[2],
      amount: params[3],
      currency: params[4],
      status: params[5],
      idempotency_key: params[6],
      description: params[7],
      created_at: new Date().toISOString(),
    };
    mockTransfers.push(transfer);
    return { rows: [transfer] };
  }

  // 8. UPDATE transfers status
  if (text.includes('UPDATE transfers') && text.includes('status = $2')) {
    const id = params[0];
    const status = params[1];
    const transfer = mockTransfers.find((t) => t.id === id);
    if (transfer) {
      transfer.status = status;
    }
    return { rows: [transfer] };
  }

  // 9. INSERT ledger_transactions
  if (text.includes('INSERT INTO ledger_transactions')) {
    const tx = { id: params[0], reference_type: params[1], reference_id: params[2] };
    mockLedgerTransactions.push(tx);
    return { rows: [tx] };
  }

  // 10. INSERT ledger_entries
  if (text.includes('INSERT INTO ledger_entries')) {
    const entry = {
      ledger_transaction_id: params[0],
      ledger_account_id: params[1],
      direction: params[2],
      amount: params[3],
      currency: params[4],
    };
    mockLedgerEntries.push(entry);
    return { rows: [entry] };
  }

  // Transaction control helper hooks
  if (text.includes('COMMIT') || text.includes('ROLLBACK')) {
    lockedWallets.clear();
    return { rows: [] };
  }

  return { rows: [] };
});

// Mock pg library before importing app
jest.unstable_mockModule('pg', () => ({
  __esModule: true,
  Pool: jest.fn(() => ({
    query: mockQuery,
    connect: jest.fn().mockResolvedValue({
      query: mockQuery,
      release: jest.fn(),
    }),
    on: jest.fn(),
  })),
  default: {
    Pool: jest.fn(() => ({
      query: mockQuery,
      connect: jest.fn().mockResolvedValue({
        query: mockQuery,
        release: jest.fn(),
      }),
      on: jest.fn(),
    })),
  },
}));

// Mock mongo and redis config connections
jest.unstable_mockModule('../config/mongodb.js', () => ({
  __esModule: true,
  connectMongoDB: jest.fn().mockResolvedValue(true),
  testMongoConnection: jest.fn().mockReturnValue(true),
  default: jest.fn().mockResolvedValue(true),
}));

// Mock Redis client cache for Idempotency
let localRedisCache = {};
const mockRedisClient = {
  isOpen: true,
  connect: jest.fn().mockResolvedValue(true),
  ping: jest.fn().mockResolvedValue('PONG'),
  on: jest.fn(),
  get: jest.fn(async (key) => localRedisCache[key] || null),
  set: jest.fn(async (key, value) => {
    localRedisCache[key] = value;
    return 'OK';
  }),
  del: jest.fn(async (key) => {
    delete localRedisCache[key];
    return 1;
  }),
};

jest.unstable_mockModule('../config/redis.js', () => ({
  __esModule: true,
  redisClient: mockRedisClient,
  connectRedis: jest.fn().mockResolvedValue(true),
  testRedisConnection: jest.fn().mockResolvedValue(true),
  default: mockRedisClient,
}));

// Dynamic import placeholders
let app;
let config;

describe('Transfer & Financial Core Integration Tests', () => {
  let senderToken;

  beforeAll(async () => {
    const appModule = await import('../app.js');
    app = appModule.app;

    const configModule = await import('../config/config.js');
    config = configModule.config;

    senderToken = jwt.sign(
      { id: 1, email: 'sender@example.com', role: 'CUSTOMER' },
      config.jwt.accessSecret
    );
  });

  afterEach(() => {
    mockTransfers = [];
    mockLedgerTransactions = [];
    mockLedgerEntries = [];
    localRedisCache = {};
    lockedWallets.clear();
    // Reset balances
    localWallets[1].available_balance = 100000n;
    localWallets[2].available_balance = 50000n;
    localWallets[3].available_balance = 10000n;
  });

  describe('POST /api/transfers (P2P Transfers Flow)', () => {
    it('should successfully complete transfer and post balanced ledger entries', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          recipientEmail: 'recipient@example.com',
          amount: 20000, // $200
          description: 'Rent sharing payment',
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toEqual('COMPLETED');
      expect(res.body.data.amount).toEqual('20000');

      // Verify wallet balances updated
      expect(localWallets[1].available_balance).toEqual(80000n); // $1000 - $200 = $800
      expect(localWallets[2].available_balance).toEqual(70000n); // $500 + $200 = $700

      // Verify double-entry ledger postings are balanced
      const entries = mockLedgerEntries.filter(
        (e) => e.ledger_transaction_id === mockLedgerTransactions[0].id
      );
      expect(entries).toHaveLength(2);
      expect(entries.find((e) => e.direction === 'DEBIT').amount).toEqual(20000n);
      expect(entries.find((e) => e.direction === 'CREDIT').amount).toEqual(20000n);
    });

    it('should fail transfer if sender wallet has insufficient balance', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          recipientEmail: 'recipient@example.com',
          amount: 150000, // $1500 (sender only has $1000)
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toEqual('INSUFFICIENT_FUNDS');
    });

    it('should fail transfer if recipient wallet is frozen', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          recipientEmail: 'frozen@example.com',
          amount: 5000,
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toEqual('WALLET_FROZEN');
    });
  });

  describe('API Idempotency Controls', () => {
    it('should execute transfer exactly once and return cached response on duplicates', async () => {
      const idempotencyKey = 'unique-key-12345';

      // 1. Submit first request
      const res1 = await request(app)
        .post('/api/transfers')
        .set('Authorization', `Bearer ${senderToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          recipientEmail: 'recipient@example.com',
          amount: 10000, // $100
        });

      expect(res1.statusCode).toEqual(201);
      expect(res1.body.success).toBe(true);
      expect(localWallets[1].available_balance).toEqual(90000n); // Deducted once

      // 2. Submit second duplicate request with same key
      const res2 = await request(app)
        .post('/api/transfers')
        .set('Authorization', `Bearer ${senderToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          recipientEmail: 'recipient@example.com',
          amount: 10000,
        });

      expect(res2.statusCode).toEqual(201);
      expect(res2.headers['x-cache-lookup']).toEqual('HIT - Idempotent');
      expect(res2.body.data.id).toEqual(res1.body.data.id);
      
      // Balance MUST remain $900 (not double deducted!)
      expect(localWallets[1].available_balance).toEqual(90000n);
    });

    it('should reject requests using same key with different payloads', async () => {
      const idempotencyKey = 'unique-key-54321';

      await request(app)
        .post('/api/transfers')
        .set('Authorization', `Bearer ${senderToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          recipientEmail: 'recipient@example.com',
          amount: 10000,
        });

      // Submit request with same key but different amount
      const res = await request(app)
        .post('/api/transfers')
        .set('Authorization', `Bearer ${senderToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          recipientEmail: 'recipient@example.com',
          amount: 20000,
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toEqual('IDEMPOTENCY_CONFLICT');
    });
  });

  describe('Safe Concurrency & Double-Spending Prevention', () => {
    it('should serialize concurrent transactions and prevent overspending', async () => {
      // Set balance to exactly $100 (10000 cents)
      localWallets[1].available_balance = 10000n;

      // Send two concurrent transfer requests ($80 and $70) in parallel
      const req1 = request(app)
        .post('/api/transfers')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          recipientEmail: 'recipient@example.com',
          amount: 8000,
        });

      const req2 = request(app)
        .post('/api/transfers')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          recipientEmail: 'recipient@example.com',
          amount: 7000,
        });

      const [res1, res2] = await Promise.all([req1, req2]);

      // Verify that exactly one succeeds and one fails with INSUFFICIENT_FUNDS
      const statuses = [res1.statusCode, res2.statusCode];
      expect(statuses).toContain(201);
      expect(statuses).toContain(400);

      const successfulRes = res1.statusCode === 201 ? res1 : res2;
      const failedRes = res1.statusCode === 400 ? res1 : res2;

      expect(failedRes.body.error.code).toEqual('INSUFFICIENT_FUNDS');
      
      // Balance must decrease by the successful amount only (either $80 or $70)
      const expectedBalance = 10000n - BigInt(successfulRes.body.data.amount);
      expect(localWallets[1].available_balance).toEqual(expectedBalance);
    });
  });
});
