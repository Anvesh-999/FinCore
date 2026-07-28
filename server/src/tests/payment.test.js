import { jest, describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import bcrypt from 'bcryptjs';

// Local mock database state
let localUsers = {
  1: { _id: 1, email: 'customer@example.com', role: 'CUSTOMER', firstName: 'Customer', lastName: 'User', first_name: 'Customer', last_name: 'User' },
  2: { _id: 2, email: 'merchant@example.com', role: 'MERCHANT', firstName: 'Merchant', lastName: 'User', first_name: 'Merchant', last_name: 'User' },
  3: { _id: 3, email: 'admin@example.com', role: 'ADMIN', firstName: 'Admin', lastName: 'User', first_name: 'Admin', last_name: 'User' },
};

let localMerchants = {
  2: { _id: 1, userId: 2, businessName: "Merchant's Sandbox Business", businessType: 'INDIVIDUAL', status: 'ACTIVE' }
};

let localWallets = {
  1: { _id: 1, userId: 1, availableBalance: 100000, pendingBalance: 0, status: 'ACTIVE', currency: 'USD', available_balance: 100000n, pending_balance: 0n },
  2: { _id: 2, userId: 2, availableBalance: 0, pendingBalance: 0, status: 'ACTIVE', currency: 'USD', available_balance: 0n, pending_balance: 0n },
};

let localLedgerAccounts = {
  10: { _id: 10, holderType: 'CUSTOMER', holderId: 1, holder_type: 'CUSTOMER', holder_id: 1 },
  20: { _id: 20, holderType: 'MERCHANT', holderId: 2, holder_type: 'MERCHANT', holder_id: 2 },
  99: { _id: 99, holderType: 'SYSTEM', holderId: null, holder_type: 'SYSTEM', holder_id: null },
};

let mockApiKeys = [];
let mockPayments = [];
let mockRefunds = [];
let mockLedgerTransactions = [];
let mockLedgerEntries = [];
let localCounters = { merchants: 1, merchant_api_keys: 0, wallets: 2, ledger_accounts: 3 };

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

const Merchant = {
  create: jest.fn(async (data) => {
    const m = data[0];
    localMerchants[m.userId] = m;
    return [{ toObject: () => m, ...m }];
  }),
  findOne: jest.fn((q) => {
    const userId = q.userId;
    const merchant = localMerchants[userId];
    return makeQueryChain(merchant ? { toObject: () => merchant, ...merchant } : null);
  })
};

const MerchantApiKey = {
  create: jest.fn(async (data) => {
    const key = {
      _id: data[0]._id,
      merchantId: data[0].merchantId,
      publicKey: data[0].publicKey,
      secretKeyHash: data[0].secretKeyHash,
      status: data[0].status,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockApiKeys.push({
      id: key._id,
      merchant_id: key.merchantId,
      public_key: key.publicKey,
      secret_key_hash: key.secretKeyHash,
      status: key.status,
      created_at: key.createdAt
    });
    return [{ toObject: () => key, ...key }];
  }),
  find: jest.fn(() => makeQueryChain(mockApiKeys.map(k => ({
    _id: k.id,
    merchantId: k.merchant_id,
    publicKey: k.public_key,
    secretKeyHash: k.secret_key_hash,
    status: k.status,
    createdAt: k.created_at
  })).filter(k => k.status === 'ACTIVE'))),
  findOneAndUpdate: jest.fn(async (query, update) => {
    const id = query._id;
    const key = mockApiKeys.find(k => k.id === id);
    if (key && update.$set) {
      key.status = update.$set.status;
    }
    return key ? {
      toObject: () => ({
        _id: key.id,
        merchantId: key.merchant_id,
        publicKey: key.public_key,
        status: key.status
      }),
      _id: key.id,
      merchantId: key.merchant_id,
      publicKey: key.public_key,
      status: key.status
    } : null;
  }),
  findOne: jest.fn((q) => {
    const key = mockApiKeys.find(k => k.public_key === q.publicKey && k.status === 'ACTIVE');
    return makeQueryChain(key ? {
      toObject: () => ({
        _id: key.id,
        merchantId: key.merchant_id,
        publicKey: key.public_key,
        secretKeyHash: key.secret_key_hash,
        status: key.status
      }),
      _id: key.id,
      merchantId: key.merchant_id,
      publicKey: key.public_key,
      secretKeyHash: key.secret_key_hash,
      status: key.status
    } : null);
  })
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
    if (wallet && update.$inc) {
      wallet.availableBalance += (update.$inc.availableBalance || 0);
      wallet.available_balance = BigInt(wallet.availableBalance);
    }
    return wallet ? { toObject: () => wallet, ...wallet } : null;
  })
};

const LedgerAccount = {
  findOne: jest.fn((q) => {
    const holderType = q.holderType;
    const holderId = q.holderId;
    const account = Object.values(localLedgerAccounts).find(
      a => a.holderType === holderType && (holderId === undefined || a.holderId === holderId)
    );
    return makeQueryChain(account ? { _id: account._id, holderType: account.holderType, holderId: account.holderId, id: account._id } : null);
  }),
  create: jest.fn(async (data) => {
    const account = data[0];
    localLedgerAccounts[account._id] = account;
    return [{ toObject: () => account, ...account }];
  })
};

const LedgerTransaction = {
  create: jest.fn(async (data) => {
    const tx = data[0];
    mockLedgerTransactions.push({
      id: tx._id,
      reference_type: tx.referenceType,
      reference_id: tx.referenceId
    });
    return [{ toObject: () => tx, ...tx }];
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

const Payment = {
  create: jest.fn(async (data) => {
    const p = data[0];
    const payment = {
      _id: p._id,
      merchantId: p.merchantId,
      amount: p.amount,
      currency: p.currency,
      reference: p.reference,
      metadata: p.metadata,
      status: p.status || 'CREATED',
      idempotencyKey: p.idempotencyKey,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockPayments.push({
      id: payment._id,
      merchant_id: payment.merchantId,
      amount: BigInt(payment.amount),
      currency: payment.currency,
      reference: payment.reference,
      metadata: payment.metadata,
      status: payment.status,
      idempotency_key: payment.idempotencyKey,
      created_at: payment.createdAt,
      updated_at: payment.updatedAt
    });
    return [{ toObject: () => payment, ...payment }];
  }),
  findById: jest.fn((id) => {
    const p = mockPayments.find(pay => pay.id === id);
    if (!p) return makeQueryChain(null);
    const payment = {
      _id: p.id,
      merchantId: p.merchant_id,
      amount: Number(p.amount),
      currency: p.currency,
      reference: p.reference,
      metadata: p.metadata,
      status: p.status,
      idempotencyKey: p.idempotency_key,
      customerWalletId: p.customer_wallet_id,
      createdAt: p.created_at,
      updatedAt: p.updated_at
    };
    return makeQueryChain(payment);
  }),
  findOne: jest.fn((q) => {
    const p = mockPayments.find(pay => pay.merchant_id === q.merchantId && pay.idempotency_key === q.idempotencyKey);
    if (!p) return makeQueryChain(null);
    const payment = {
      _id: p.id,
      merchantId: p.merchant_id,
      amount: Number(p.amount),
      currency: p.currency,
      reference: p.reference,
      metadata: p.metadata,
      status: p.status,
      idempotencyKey: p.idempotency_key,
      customerWalletId: p.customer_wallet_id,
      createdAt: p.created_at,
      updatedAt: p.updated_at
    };
    return makeQueryChain(payment);
  }),
  findByIdAndUpdate: jest.fn(async (id, update) => {
    const p = mockPayments.find(pay => pay.id === id);
    if (p && update.$set) {
      p.status = update.$set.status;
      if (update.$set.customerWalletId !== undefined) {
        p.customer_wallet_id = update.$set.customerWalletId;
      }
    }
    if (!p) return null;
    const payment = {
      _id: p.id,
      merchantId: p.merchant_id,
      amount: Number(p.amount),
      currency: p.currency,
      reference: p.reference,
      metadata: p.metadata,
      status: p.status,
      idempotencyKey: p.idempotency_key,
      customerWalletId: p.customer_wallet_id,
      createdAt: p.created_at,
      updatedAt: p.updated_at
    };
    return { toObject: () => payment, ...payment };
  }),
  countDocuments: jest.fn(async () => mockPayments.length)
};

const Refund = {
  create: jest.fn(async (data) => {
    const r = data[0];
    const refund = {
      _id: r._id,
      paymentId: r.paymentId,
      amount: r.amount,
      currency: r.currency,
      status: r.status || 'CREATED',
      description: r.description,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockRefunds.push({
      id: refund._id,
      payment_id: refund.paymentId,
      amount: BigInt(refund.amount),
      currency: refund.currency,
      status: refund.status,
      description: refund.description,
      created_at: refund.createdAt,
      updated_at: refund.updatedAt
    });
    return [{ toObject: () => refund, ...refund }];
  }),
  find: jest.fn((q) => {
    let result = mockRefunds.map(r => ({
      _id: r.id,
      paymentId: r.payment_id,
      amount: Number(r.amount),
      currency: r.currency,
      status: r.status,
      description: r.description,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    }));
    if (q && q.paymentId) {
      result = result.filter(r => r.paymentId === q.paymentId && (q.status === undefined || r.status === q.status));
    }
    return makeQueryChain(result);
  }),
  findByIdAndUpdate: jest.fn(async (id, update) => {
    const r = mockRefunds.find(ref => ref.id === id);
    if (r && update.$set) {
      r.status = update.$set.status;
    }
    if (!r) return null;
    const refund = {
      _id: r.id,
      paymentId: r.payment_id,
      amount: Number(r.amount),
      currency: r.currency,
      status: r.status,
      description: r.description,
      createdAt: r.created_at,
      updatedAt: r.updated_at
    };
    return { toObject: () => refund, ...refund };
  }),
  countDocuments: jest.fn(async () => mockRefunds.length)
};

const Counter = {
  getNextSequence: jest.fn(async (name) => {
    localCounters[name] = (localCounters[name] || 0) + 1;
    return localCounters[name];
  })
};

const mockModels = {
  __esModule: true,
  User,
  Wallet,
  LedgerAccount,
  LedgerTransaction,
  LedgerEntry,
  Transfer: dummyModel,
  Merchant,
  MerchantApiKey,
  Payment,
  Refund,
  WebhookEndpoint: dummyModel,
  WebhookDelivery: dummyModel,
  WebhookEvent: dummyModel,
  IdempotencyRecord: dummyModel,
  ReconciliationRun: dummyModel,
  RiskAssessment: dummyModel,
  Counter,
  default: {
    User,
    Wallet,
    LedgerAccount,
    LedgerTransaction,
    LedgerEntry,
    Transfer: dummyModel,
    Merchant,
    MerchantApiKey,
    Payment,
    Refund,
    WebhookEndpoint: dummyModel,
    WebhookDelivery: dummyModel,
    WebhookEvent: dummyModel,
    IdempotencyRecord: dummyModel,
    ReconciliationRun: dummyModel,
    RiskAssessment: dummyModel,
    Counter
  }
};

// Mock modules
jest.unstable_mockModule('../database/models.js', () => mockModels);

jest.unstable_mockModule('../config/mongodb.js', () => ({
  __esModule: true,
  connectMongoDB: jest.fn().mockResolvedValue(true),
  testMongoConnection: jest.fn().mockReturnValue(true),
  default: jest.fn().mockResolvedValue(true),
}));

let app;
let config;
let customerToken;
let merchantToken;

describe('Payments & Refunds Integration Tests', () => {
  beforeAll(async () => {
    const appModule = await import('../app.js');
    app = appModule.app;

    const configModule = await import('../config/config.js');
    config = configModule.config;

    customerToken = jwt.sign(
      { id: 1, email: 'customer@example.com', role: 'CUSTOMER', firstName: 'Customer', lastName: 'User' },
      config.jwt.accessSecret
    );
    merchantToken = jwt.sign(
      { id: 2, email: 'merchant@example.com', role: 'MERCHANT', firstName: 'Merchant', lastName: 'User' },
      config.jwt.accessSecret
    );

    const plainSecret = 'sk_sandbox_testsecret';
    const hashedSecret = await bcrypt.hash(plainSecret, 10);
    mockApiKeys.push({
      id: 10,
      merchant_id: 2,
      public_key: 'pk_sandbox_testkey',
      secret_key_hash: hashedSecret,
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    });
  });

  afterEach(() => {
    mockPayments = [];
    mockRefunds = [];
    mockLedgerTransactions = [];
    mockLedgerEntries = [];
    localWallets[1].available_balance = 100000n;
    localWallets[1].availableBalance = 100000;
    localWallets[2].available_balance = 0n;
    localWallets[2].availableBalance = 0;
  });

  describe('Merchant API Key Management', () => {
    it('should generate a new API key pair for a merchant', async () => {
      const res = await request(app)
        .post('/api/merchant/api-keys')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.publicKey).toBeDefined();
      expect(res.body.data.secretKey).toBeDefined();
      expect(res.body.data.publicKey.startsWith('pk_sandbox_')).toBe(true);
      expect(res.body.data.secretKey.startsWith('sk_sandbox_')).toBe(true);
    });

    it('should list active API keys for a merchant', async () => {
      const res = await request(app)
        .get('/api/merchant/api-keys')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThan(0);
      expect(res.body.data[0].publicKey).toEqual('pk_sandbox_testkey');
      expect(res.body.data[0].secretKey).toBeUndefined();
    });

    it('should revoke an API key', async () => {
      const activeKey = mockApiKeys.find(k => k.id !== 10);
      const res = await request(app)
        .delete(`/api/merchant/api-keys/${activeKey.id}`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(activeKey.status).toEqual('REVOKED');
    });
  });

  describe('Merchant Payment Orders & Checkout Flow', () => {
    const credentialsHeader = 'pk_sandbox_testkey:sk_sandbox_testsecret';

    it('should create a payment order via API credentials', async () => {
      const res = await request(app)
        .post('/api/payments')
        .set('x-api-key', credentialsHeader)
        .send({
          amount: 25000,
          currency: 'USD',
          reference: 'ORDER_9999',
          metadata: { note: 'V1 sandbox test' }
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.amount).toEqual('25000');
      expect(res.body.data.status).toEqual('CREATED');
    });

    it('should handle idempotent payment order creation', async () => {
      const idempotencyKey = 'unique-checkout-key';
      
      const payload = {
        amount: 20000,
        currency: 'USD',
        reference: 'ORDER_123',
        idempotencyKey
      };

      const res1 = await request(app)
        .post('/api/payments')
        .set('x-api-key', credentialsHeader)
        .send(payload);

      const res2 = await request(app)
        .post('/api/payments')
        .set('x-api-key', credentialsHeader)
        .send(payload);

      expect(res1.statusCode).toEqual(201);
      expect(res2.statusCode).toEqual(201);
      expect(res1.body.data.id).toEqual(res2.body.data.id);
    });

    it('should fetch payment details for customer checkout', async () => {
      const paymentOrder = {
        id: 'pay_test123',
        merchant_id: 2,
        amount: 30000n,
        currency: 'USD',
        reference: 'ORDER_456',
        status: 'CREATED',
        idempotency_key: null
      };
      mockPayments.push(paymentOrder);

      const res = await request(app)
        .get(`/api/payments/pay_test123`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.amount).toEqual('30000');
      expect(res.body.data.businessName).toEqual("Merchant's Sandbox Business");
    });

    it('should successfully execute payment checkout using customer wallet', async () => {
      const paymentOrder = {
        id: 'pay_test_checkout',
        merchant_id: 2,
        amount: 40000n,
        currency: 'USD',
        reference: 'ORDER_CHECKOUT',
        status: 'CREATED',
        idempotency_key: null
      };
      mockPayments.push(paymentOrder);

      const res = await request(app)
        .post(`/api/payments/pay_test_checkout/checkout`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toEqual('SUCCEEDED');
      
      expect(localWallets[1].available_balance).toEqual(60000n);
      expect(localWallets[2].available_balance).toEqual(40000n);

      expect(mockLedgerTransactions.length).toEqual(1);
      expect(mockLedgerEntries.length).toEqual(2);
      expect(mockLedgerEntries[0].direction).toEqual('DEBIT');
      expect(mockLedgerEntries[0].ledger_account_id).toEqual(10);
      expect(mockLedgerEntries[1].direction).toEqual('CREDIT');
      expect(mockLedgerEntries[1].ledger_account_id).toEqual(20);
    });

    it('should fail checkout if customer has insufficient funds', async () => {
      const paymentOrder = {
        id: 'pay_test_expensive',
        merchant_id: 2,
        amount: 250000n,
        currency: 'USD',
        reference: 'ORDER_EXPENSIVE',
        status: 'CREATED',
        idempotency_key: null
      };
      mockPayments.push(paymentOrder);

      const res = await request(app)
        .post(`/api/payments/pay_test_expensive/checkout`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toEqual('INSUFFICIENT_FUNDS');
      
      expect(localWallets[1].available_balance).toEqual(100000n);
    });
  });

  describe('Merchant Payment Refunds Flow', () => {
    beforeEach(() => {
      mockPayments.push({
        id: 'pay_for_refund',
        merchant_id: 2,
        customer_wallet_id: 1,
        amount: 50000n,
        currency: 'USD',
        reference: 'ORDER_TO_REFUND',
        status: 'SUCCEEDED',
        idempotency_key: null
      });

      localWallets[1].available_balance = 50000n;
      localWallets[1].availableBalance = 50000;
      localWallets[2].available_balance = 50000n;
      localWallets[2].availableBalance = 50000;
    });

    it('should execute a full refund successfully', async () => {
      const res = await request(app)
        .post(`/api/payments/pay_for_refund/refunds`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          amount: 50000,
          description: 'Customer returned item'
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toEqual('SUCCEEDED');

      const payment = mockPayments.find(p => p.id === 'pay_for_refund');
      expect(payment.status).toEqual('REFUNDED');

      expect(localWallets[1].available_balance).toEqual(100000n);
      expect(localWallets[2].available_balance).toEqual(0n);

      expect(mockLedgerEntries.length).toEqual(2);
      expect(mockLedgerEntries[0].direction).toEqual('DEBIT');
      expect(mockLedgerEntries[0].ledger_account_id).toEqual(20);
      expect(mockLedgerEntries[1].direction).toEqual('CREDIT');
      expect(mockLedgerEntries[1].ledger_account_id).toEqual(10);
    });

    it('should execute partial refunds and transition state', async () => {
      const res1 = await request(app)
        .post(`/api/payments/pay_for_refund/refunds`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          amount: 20000,
          description: 'Partial refund 1'
        });

      expect(res1.statusCode).toEqual(201);
      expect(mockPayments[0].status).toEqual('PARTIALLY_REFUNDED');
      expect(localWallets[1].available_balance).toEqual(70000n);
      expect(localWallets[2].available_balance).toEqual(30000n);

      const res2 = await request(app)
        .post(`/api/payments/pay_for_refund/refunds`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          amount: 30000,
          description: 'Partial refund 2 (final)'
        });

      expect(res2.statusCode).toEqual(201);
      expect(mockPayments[0].status).toEqual('REFUNDED');
      expect(localWallets[1].available_balance).toEqual(100000n);
      expect(localWallets[2].available_balance).toEqual(0n);
    });

    it('should fail refund if refund total exceeds original payment amount', async () => {
      await request(app)
        .post(`/api/payments/pay_for_refund/refunds`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ amount: 40000 });

      const res = await request(app)
        .post(`/api/payments/pay_for_refund/refunds`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ amount: 20000 });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toEqual('REFUND_EXCEEDS_PAYMENT');
    });
  });
});
