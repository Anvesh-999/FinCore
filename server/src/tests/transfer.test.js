import { jest, describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import request from 'supertest';

// Local simulated database state for testing concurrency and invariants
let localWallets = {
  1: { _id: 1, userId: 1, availableBalance: 100000, status: 'ACTIVE', currency: 'USD', available_balance: 100000n, pending_balance: 0n }, // Sender ($1000)
  2: { _id: 2, userId: 2, availableBalance: 50000, status: 'ACTIVE', currency: 'USD', available_balance: 50000n, pending_balance: 0n },  // Recipient ($500)
  3: { _id: 3, userId: 3, availableBalance: 10000, status: 'FROZEN', currency: 'USD', available_balance: 10000n, pending_balance: 0n },  // Frozen ($100)
};

let localUsers = {
  1: { _id: 1, email: 'sender@example.com', role: 'CUSTOMER', firstName: 'Sender', lastName: 'User' },
  2: { _id: 2, email: 'recipient@example.com', role: 'CUSTOMER', firstName: 'Recipient', lastName: 'User' },
  3: { _id: 3, email: 'frozen@example.com', role: 'CUSTOMER', firstName: 'Frozen', lastName: 'User' },
};

let mockTransfers = [];
let mockLedgerTransactions = [];
let mockLedgerEntries = [];
let localRedisCache = {};

const makeQueryChain = (result) => {
  const chain = {
    lean: jest.fn(() => chain),
    session: jest.fn(() => chain),
    sort: jest.fn(() => chain),
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
    catch: (reject) => Promise.resolve(result).catch(reject)
  };
  return chain;
};

const dummyModel = {
  create: jest.fn(async (data) => {
    if (Array.isArray(data)) {
      return data.map(d => ({ toObject: () => d, ...d }));
    }
    return { toObject: () => data, ...data };
  }),
  find: jest.fn(() => makeQueryChain([])),
  findOne: jest.fn(() => makeQueryChain(null)),
  findById: jest.fn(() => makeQueryChain(null)),
  findByIdAndUpdate: jest.fn(async () => null),
  findByIdAndDelete: jest.fn(async () => null),
  findOneAndUpdate: jest.fn(async () => null),
  countDocuments: jest.fn(async () => 0)
};

const User = {
  findOne: jest.fn((q) => {
    const email = q.email;
    const user = Object.values(localUsers).find((u) => u.email === email);
    return makeQueryChain(user ? { toObject: () => user, ...user } : null);
  }),
  findById: jest.fn((id) => {
    const user = localUsers[id];
    return makeQueryChain(user ? { toObject: () => user, ...user } : null);
  }),
};

const Wallet = {
  findOne: jest.fn((q) => {
    const userId = q.userId;
    const wallet = Object.values(localWallets).find((w) => w.userId === userId);
    return makeQueryChain(wallet ? { toObject: () => wallet, ...wallet } : null);
  }),
  findById: jest.fn((id) => {
    const wallet = localWallets[id];
    return makeQueryChain(wallet ? { toObject: () => wallet, ...wallet } : null);
  }),
  findOneAndUpdate: jest.fn(async (query, update) => {
    const id = query._id;
    const minBalance = query.availableBalance ? query.availableBalance.$gte : 0;
    const wallet = localWallets[id];
    if (wallet && wallet.status === 'ACTIVE' && wallet.availableBalance >= minBalance) {
      if (update.$inc) {
        wallet.availableBalance += (update.$inc.availableBalance || 0);
        wallet.available_balance = BigInt(wallet.availableBalance);
      }
      return { toObject: () => wallet, ...wallet };
    }
    return null;
  }),
  findByIdAndUpdate: jest.fn(async (id, update) => {
    const wallet = localWallets[id];
    if (wallet) {
      if (update.$inc) {
        wallet.availableBalance += (update.$inc.availableBalance || 0);
        wallet.available_balance = BigInt(wallet.availableBalance);
      }
      return { toObject: () => wallet, ...wallet };
    }
    return null;
  })
};

const LedgerAccount = {
  findOne: jest.fn((q) => {
    const holderId = q.holderId;
    return makeQueryChain({ _id: holderId, holderType: 'CUSTOMER', holderId });
  })
};

const LedgerTransaction = {
  create: jest.fn(async (data) => {
    const tx = data[0];
    mockLedgerTransactions.push(tx);
    return [{ toObject: () => tx, ...tx }];
  }),
  findOne: jest.fn((q) => {
    const tx = mockLedgerTransactions.find(t => t.referenceId === q.referenceId);
    return makeQueryChain(tx ? { toObject: () => tx, ...tx } : null);
  })
};

const LedgerEntry = {
  create: jest.fn(async (data) => {
    for (const entry of data) {
      mockLedgerEntries.push({
        ledger_transaction_id: entry.ledgerTransactionId,
        ledger_account_id: entry.ledgerAccountId,
        direction: entry.direction,
        amount: BigInt(entry.amount),
        currency: entry.currency
      });
    }
    return data;
  })
};

const Transfer = {
  create: jest.fn(async (data) => {
    const t = data[0];
    const transfer = {
      _id: t._id,
      senderWalletId: t.senderWalletId,
      recipientWalletId: t.recipientWalletId,
      amount: t.amount,
      currency: t.currency,
      status: t.status,
      idempotencyKey: t.idempotencyKey,
      description: t.description,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockTransfers.push({
      id: transfer._id,
      sender_wallet_id: transfer.senderWalletId,
      recipient_wallet_id: transfer.recipientWalletId,
      amount: BigInt(transfer.amount),
      currency: transfer.currency,
      status: transfer.status,
      idempotency_key: transfer.idempotencyKey,
      description: transfer.description,
      created_at: transfer.createdAt
    });
    return [{ toObject: () => transfer, ...transfer }];
  }),
  findByIdAndUpdate: jest.fn(async (id, update) => {
    const transfer = mockTransfers.find((t) => t.id === id);
    if (transfer && update.$set) {
      transfer.status = update.$set.status;
    }
    return transfer ? { toObject: () => transfer, ...transfer } : null;
  }),
  findOne: jest.fn((q) => {
    const transfer = mockTransfers.find((t) => t.idempotency_key === q.idempotencyKey);
    return makeQueryChain(transfer ? { toObject: () => transfer, ...transfer } : null);
  }),
  countDocuments: jest.fn(async () => mockTransfers.length)
};

const IdempotencyRecord = {
  findOne: jest.fn((q) => {
    const key = q.idempotencyKey;
    const record = localRedisCache[key];
    return makeQueryChain(record ? {
      idempotencyKey: key,
      requestHash: record.fingerprint,
      responseStatus: record.statusCode,
      responseBody: record.responseBody,
      status: record.status
    } : null);
  }),
  create: jest.fn(async (data) => {
    const key = data.idempotencyKey;
    localRedisCache[key] = {
      status: data.status,
      fingerprint: data.requestHash
    };
    return data;
  }),
  findOneAndUpdate: jest.fn(async (query, update) => {
    const key = query.idempotencyKey;
    const record = localRedisCache[key];
    if (record && update.$set) {
      record.status = update.$set.status;
      record.statusCode = update.$set.responseStatus;
      record.responseBody = update.$set.responseBody;
    }
    return record;
  }),
  deleteOne: jest.fn(async (query) => {
    delete localRedisCache[query.idempotencyKey];
    return { deletedCount: 1 };
  })
};

const Counter = {
  getNextSequence: jest.fn(async () => 1)
};

const mockModels = {
  __esModule: true,
  User,
  Wallet,
  LedgerAccount,
  LedgerTransaction,
  LedgerEntry,
  Transfer,
  Merchant: dummyModel,
  MerchantApiKey: dummyModel,
  Payment: dummyModel,
  Refund: dummyModel,
  WebhookEndpoint: dummyModel,
  WebhookDelivery: dummyModel,
  WebhookEvent: dummyModel,
  IdempotencyRecord,
  ReconciliationRun: dummyModel,
  RiskAssessment: dummyModel,
  Counter,
  default: {
    User,
    Wallet,
    LedgerAccount,
    LedgerTransaction,
    LedgerEntry,
    Transfer,
    Merchant: dummyModel,
    MerchantApiKey: dummyModel,
    Payment: dummyModel,
    Refund: dummyModel,
    WebhookEndpoint: dummyModel,
    WebhookDelivery: dummyModel,
    WebhookEvent: dummyModel,
    IdempotencyRecord,
    ReconciliationRun: dummyModel,
    RiskAssessment: dummyModel,
    Counter
  }
};

// Mock modules to bypass DB
jest.unstable_mockModule('../database/models.js', () => mockModels);

jest.unstable_mockModule('../config/mongodb.js', () => ({
  __esModule: true,
  connectMongoDB: jest.fn().mockResolvedValue(true),
  testMongoConnection: jest.fn().mockReturnValue(true),
  default: jest.fn().mockResolvedValue(true),
}));

let app;
let config;
let senderToken;

describe('Transfer Integration Tests', () => {
  beforeAll(async () => {
    const appModule = await import('../app.js');
    app = appModule.app;

    const configModule = await import('../config/config.js');
    config = configModule.config;

    senderToken = jwt.sign(
      { id: 1, email: 'sender@example.com', role: 'CUSTOMER', firstName: 'Sender', lastName: 'User' },
      config.jwt.accessSecret
    );
  });

  afterEach(() => {
    mockTransfers = [];
    mockLedgerTransactions = [];
    mockLedgerEntries = [];
    localRedisCache = {};
    // Reset balances
    localWallets[1].availableBalance = 100000;
    localWallets[1].available_balance = 100000n;
    localWallets[2].availableBalance = 50000;
    localWallets[2].available_balance = 50000n;
    localWallets[3].availableBalance = 10000;
    localWallets[3].available_balance = 10000n;
  });

  describe('POST /api/transfers (P2P Transfers Flow)', () => {
    it('should successfully complete transfer and post balanced ledger entries', async () => {
      const res = await request(app)
        .post('/api/transfers')
        .set('Authorization', `Bearer ${senderToken}`)
        .send({
          recipientEmail: 'recipient@example.com',
          amount: 20000,
          description: 'Rent sharing payment',
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toEqual('COMPLETED');
      expect(res.body.data.amount).toEqual('20000');

      expect(localWallets[1].available_balance).toEqual(80000n);
      expect(localWallets[2].available_balance).toEqual(70000n);

      const entries = mockLedgerEntries.filter(
        (e) => e.ledger_transaction_id === mockLedgerTransactions[0]._id
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
          amount: 150000,
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

      const res1 = await request(app)
        .post('/api/transfers')
        .set('Authorization', `Bearer ${senderToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          recipientEmail: 'recipient@example.com',
          amount: 10000,
        });

      expect(res1.statusCode).toEqual(201);
      expect(res1.body.success).toBe(true);
      expect(localWallets[1].available_balance).toEqual(90000n);

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
      localWallets[1].availableBalance = 10000;
      localWallets[1].available_balance = 10000n;

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

      const statuses = [res1.statusCode, res2.statusCode];
      expect(statuses).toContain(201);
      expect(statuses).toContain(400);

      const successfulRes = res1.statusCode === 201 ? res1 : res2;
      const failedRes = res1.statusCode === 400 ? res1 : res2;

      expect(failedRes.body.error.code).toEqual('INSUFFICIENT_FUNDS');
      
      const expectedBalance = 10000 - Number(successfulRes.body.data.amount);
      expect(localWallets[1].availableBalance).toEqual(expectedBalance);
    });
  });
});
