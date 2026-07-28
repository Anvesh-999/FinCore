import { jest, describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import crypto from 'crypto';

// Local mock database state
let localUsers = {
  1: { _id: 1, email: 'customer@example.com', role: 'CUSTOMER', firstName: 'Customer', lastName: 'User', first_name: 'Customer', last_name: 'User' },
  2: { _id: 2, email: 'merchant@example.com', role: 'MERCHANT', firstName: 'Merchant', lastName: 'User', first_name: 'Merchant', last_name: 'User' },
  3: { _id: 3, email: 'admin@example.com', role: 'ADMIN', firstName: 'Admin', lastName: 'User', first_name: 'Admin', last_name: 'User' },
};

let localWallets = {
  1: { _id: 1, userId: 1, availableBalance: 100000, pendingBalance: 0, status: 'ACTIVE', currency: 'USD', available_balance: 100000n, pending_balance: 0n },
  2: { _id: 2, userId: 2, availableBalance: 0, pendingBalance: 0, status: 'ACTIVE', currency: 'USD', available_balance: 0n, pending_balance: 0n },
};

let mockEndpoints = [];
let mockWebhookEvents = [];
let mockDeliveries = [];
let mockRiskAssessments = [];
let mockReconciliationRuns = [];
let mockTransfers = [];
let mockPayments = [];
let mockRefunds = [];
let mockLedgerAccounts = {};
let mockLedgerTransactions = [];
let mockLedgerEntries = [{ ledgerAccountId: 10, direction: 'CREDIT', amount: 100000 }];
let localCounters = { webhook_endpoints: 0, reconciliation_runs: 0 };

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
  find: jest.fn(() => makeQueryChain(Object.values(localWallets))),
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
    const wallet = localWallets[id];
    if (wallet && update.$inc) {
      wallet.availableBalance += (update.$inc.availableBalance || 0);
      wallet.available_balance = BigInt(wallet.availableBalance);
    }
    return wallet ? { toObject: () => wallet, ...wallet } : null;
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

const WebhookEndpoint = {
  create: jest.fn(async (data) => {
    const ep = data[0];
    const endpoint = {
      _id: ep._id,
      merchantId: ep.merchantId,
      url: ep.url,
      secret: ep.secret,
      status: ep.status || 'ACTIVE',
      events: ep.events,
      createdAt: new Date(),
      updatedAt: new Date()
    };
    mockEndpoints.push({
      id: endpoint._id,
      merchant_id: endpoint.merchantId,
      url: endpoint.url,
      secret: endpoint.secret,
      status: endpoint.status,
      events: endpoint.events,
      created_at: endpoint.createdAt
    });
    return [{ toObject: () => endpoint, ...endpoint }];
  }),
  find: jest.fn((q) => {
    let list = mockEndpoints.map(e => ({
      _id: e.id,
      merchantId: e.merchant_id,
      url: e.url,
      secret: e.secret,
      status: e.status,
      events: e.events,
      createdAt: e.created_at
    }));
    if (q && q.merchantId) {
      list = list.filter(e => e.merchantId === q.merchantId && (q.status === undefined || e.status === q.status) && (q.events === undefined || e.events.includes(q.events)));
    }
    return makeQueryChain(list);
  }),
  findById: jest.fn((id) => {
    const ep = mockEndpoints.find(e => e.id == id);
    if (!ep) return makeQueryChain(null);
    return makeQueryChain({
      _id: ep.id,
      merchantId: ep.merchant_id,
      url: ep.url,
      secret: ep.secret,
      status: ep.status,
      events: ep.events,
      createdAt: ep.created_at
    });
  }),
  findByIdAndUpdate: jest.fn(async (id, update) => {
    const ep = mockEndpoints.find(e => e.id == id);
    if (ep && update.$set) {
      if (update.$set.url !== undefined) ep.url = update.$set.url;
      if (update.$set.status !== undefined) ep.status = update.$set.status;
      if (update.$set.events !== undefined) ep.events = update.$set.events;
      if (update.$set.secret !== undefined) ep.secret = update.$set.secret;
    }
    if (!ep) return null;
    const endpoint = {
      _id: ep.id,
      merchantId: ep.merchant_id,
      url: ep.url,
      secret: ep.secret,
      status: ep.status,
      events: ep.events,
      createdAt: ep.created_at
    };
    return { toObject: () => endpoint, ...endpoint };
  }),
  findByIdAndDelete: jest.fn(async (id) => {
    const idx = mockEndpoints.findIndex(e => e.id == id);
    if (idx !== -1) {
      const ep = mockEndpoints[idx];
      mockEndpoints.splice(idx, 1);
      return {
        toObject: () => ({
          _id: ep.id,
          merchantId: ep.merchant_id,
          url: ep.url,
          secret: ep.secret,
          status: ep.status,
          events: ep.events
        }),
        _id: ep.id,
        merchantId: ep.merchant_id
      };
    }
    return null;
  })
};

const WebhookEvent = {
  create: jest.fn(async (data) => {
    const ev = {
      _id: data._id,
      merchantId: data.merchantId,
      eventType: data.eventType,
      payload: data.payload,
      status: data.status,
      createdAt: new Date()
    };
    mockWebhookEvents.push({
      id: ev._id,
      merchant_id: ev.merchantId,
      event_type: ev.eventType,
      payload: ev.payload,
      status: ev.status,
      created_at: ev.createdAt
    });
    return { toObject: () => ev, ...ev };
  }),
  findById: jest.fn((id) => {
    const ev = mockWebhookEvents.find(e => e.id === id);
    if (!ev) return makeQueryChain(null);
    return makeQueryChain({
      _id: ev.id,
      merchantId: ev.merchant_id,
      eventType: ev.event_type,
      payload: ev.payload,
      status: ev.status,
      createdAt: ev.created_at
    });
  })
};

const WebhookDelivery = {
  create: jest.fn(async (data) => {
    const d = {
      _id: data._id,
      merchantId: data.merchantId,
      eventId: data.eventId,
      endpointId: data.endpointId,
      responseStatus: data.responseStatus,
      responseBody: data.responseBody,
      attemptNumber: data.attemptNumber,
      status: data.status,
      createdAt: new Date()
    };
    mockDeliveries.push({
      id: d._id,
      webhook_event_id: d.eventId,
      webhook_endpoint_id: d.endpointId,
      response_status: d.responseStatus,
      response_body: d.responseBody,
      attempt_number: d.attemptNumber,
      status: d.status,
      created_at: d.createdAt
    });
    return { toObject: () => d, ...d };
  }),
  findById: jest.fn((id) => {
    const d = mockDeliveries.find(del => del.id === id);
    if (!d) return makeQueryChain(null);
    return makeQueryChain({
      _id: d.id,
      merchantId: d.merchant_id,
      eventId: d.webhook_event_id,
      endpointId: d.webhook_endpoint_id,
      responseStatus: d.response_status,
      responseBody: d.response_body,
      attemptNumber: d.attempt_number,
      status: d.status,
      createdAt: d.created_at
    });
  }),
  find: jest.fn(() => makeQueryChain(mockDeliveries))
};

const RiskAssessment = {
  create: jest.fn(async (data) => {
    const r = {
      _id: data._id,
      transactionId: data.transactionId,
      transactionType: data.transactionType,
      riskScore: data.riskScore,
      decision: data.decision,
      rulesTriggered: data.rulesTriggered || [],
      createdAt: new Date()
    };
    mockRiskAssessments.push({
      id: r._id,
      transaction_type: r.transactionType,
      transaction_id: r.transactionId,
      risk_score: r.riskScore,
      decision: r.decision,
      rules_triggered: r.rulesTriggered,
      created_at: r.createdAt
    });
    return { toObject: () => r, ...r };
  }),
  find: jest.fn(() => makeQueryChain(mockRiskAssessments))
};

const ReconciliationRun = {
  create: jest.fn(async (data) => {
    const r = {
      _id: mockReconciliationRuns.length + 1,
      status: data.status,
      totalPaymentsChecked: data.totalPaymentsChecked,
      totalRefundsChecked: data.totalRefundsChecked,
      totalTransfersChecked: data.totalTransfersChecked,
      inconsistenciesFound: data.inconsistenciesFound,
      results: data.results,
      runDate: new Date(),
      createdAt: new Date()
    };
    mockReconciliationRuns.push({
      id: r._id,
      run_date: r.runDate,
      status: r.status,
      total_payments_checked: r.totalPaymentsChecked,
      total_refunds_checked: r.totalRefundsChecked,
      total_transfers_checked: r.totalTransfersChecked,
      inconsistencies_found: r.inconsistenciesFound,
      results: r.results,
      created_at: r.createdAt
    });
    return r;
  }),
  find: jest.fn(() => makeQueryChain(mockReconciliationRuns))
};

const Transfer = {
  countDocuments: jest.fn(async () => mockTransfers.length),
  find: jest.fn(() => makeQueryChain(mockTransfers))
};

const Payment = {
  countDocuments: jest.fn(async () => mockPayments.length),
  find: jest.fn((q) => {
    let result = mockPayments;
    if (q && q.status) {
      result = result.filter(p => p.status === q.status);
    }
    return makeQueryChain(result);
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
  })
};

const Refund = {
  countDocuments: jest.fn(async () => mockRefunds.length),
  find: jest.fn((q) => {
    let result = mockRefunds;
    if (q && q.status) {
      result = result.filter(r => r.status === q.status);
    }
    return makeQueryChain(result);
  })
};

const LedgerAccount = {
  findOne: jest.fn((q) => {
    const holderId = q.holderId;
    const holderType = q.holderType || 'CUSTOMER';
    const id = holderId === 1 ? 10 : (holderId === 2 ? 20 : 30);
    return makeQueryChain({ _id: id, holderType, holderId });
  })
};

const LedgerEntry = {
  find: jest.fn((q) => {
    let list = mockLedgerEntries;
    if (q && q.ledgerAccountId) {
      list = list.filter(e => e.ledgerAccountId === q.ledgerAccountId);
    }
    return makeQueryChain(list);
  })
};

const LedgerTransaction = {
  find: jest.fn(() => makeQueryChain(mockLedgerTransactions)),
  findOne: jest.fn((q) => {
    const tx = mockLedgerTransactions.find(t => t.referenceId === q.referenceId && t.referenceType === q.referenceType);
    return makeQueryChain(tx ? { toObject: () => tx, ...tx } : null);
  })
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
  Transfer,
  Merchant: dummyModel,
  MerchantApiKey: dummyModel,
  Payment,
  Refund,
  WebhookEndpoint,
  WebhookDelivery,
  WebhookEvent,
  IdempotencyRecord: dummyModel,
  ReconciliationRun,
  RiskAssessment,
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
    Payment,
    Refund,
    WebhookEndpoint,
    WebhookDelivery,
    WebhookEvent,
    IdempotencyRecord: dummyModel,
    ReconciliationRun,
    RiskAssessment,
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
let merchantToken;
let adminToken;

describe('Operations Console Integration Tests', () => {
  beforeAll(async () => {
    const appModule = await import('../app.js');
    app = appModule.app;

    const configModule = await import('../config/config.js');
    config = configModule.config;

    merchantToken = jwt.sign(
      { id: 2, email: 'merchant@example.com', role: 'MERCHANT', firstName: 'Merchant', lastName: 'User' },
      config.jwt.accessSecret
    );
    adminToken = jwt.sign(
      { id: 3, email: 'admin@example.com', role: 'ADMIN', firstName: 'Admin', lastName: 'User' },
      config.jwt.accessSecret
    );
  });

  afterEach(() => {
    mockEndpoints = [];
    mockWebhookEvents = [];
    mockDeliveries = [];
    mockRiskAssessments = [];
    mockReconciliationRuns = [];
    mockTransfers = [];
    mockPayments = [];
    mockRefunds = [];
    mockLedgerTransactions = [];
    mockLedgerEntries = [{ ledgerAccountId: 10, direction: 'CREDIT', amount: 100000 }];
    localWallets[1].availableBalance = 100000;
    localWallets[1].available_balance = 100000n;
  });

  describe('Merchant Webhook Endpoints Operations', () => {
    it('should configure webhook endpoint successfully', async () => {
      const res = await request(app)
        .post('/api/merchant/webhooks/endpoints')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          url: 'https://example.com/webhooks',
          events: ['payment.succeeded', 'refund.succeeded']
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toEqual('https://example.com/webhooks');
      expect(res.body.data.secret).toBeDefined();
    });

    it('should list all webhook endpoints for merchant', async () => {
      mockEndpoints.push({
        id: 1,
        merchant_id: 2,
        url: 'https://example.com/webhooks',
        secret: 'whsec_secret',
        status: 'ACTIVE',
        events: ['payment.succeeded']
      });

      const res = await request(app)
        .get('/api/merchant/webhooks/endpoints')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toEqual(1);
    });

    it('should rotate webhook endpoint secret', async () => {
      mockEndpoints.push({
        id: 2,
        merchant_id: 2,
        url: 'https://example.com/webhooks',
        secret: 'whsec_old',
        status: 'ACTIVE',
        events: ['payment.succeeded']
      });

      const res = await request(app)
        .post(`/api/merchant/webhooks/endpoints/2/rotate`)
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(mockEndpoints[0].secret).not.toEqual('whsec_old');
    });
  });

  describe('Operations Risk Engine Safety Gates', () => {
    it('should trigger excessive amount and rapid drain risk audits', async () => {
      const paymentOrder = {
        id: 'pay_large',
        merchant_id: 2,
        amount: 2000000n, // $20,000.00
        currency: 'USD',
        reference: 'LARGE_REF',
        status: 'CREATED',
        idempotency_key: null
      };
      mockPayments.push(paymentOrder);

      const customerToken = jwt.sign(
        { id: 1, email: 'customer@example.com', role: 'CUSTOMER', firstName: 'Customer', lastName: 'User' },
        config.jwt.accessSecret
      );

      const res = await request(app)
        .post(`/api/payments/pay_large/checkout`)
        .set('Authorization', `Bearer ${customerToken}`);

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toEqual('RISK_BLOCKED');
      expect(mockRiskAssessments.length).toBeGreaterThan(0);
      expect(mockRiskAssessments[0].decision).toEqual('VETO');
    });
  });

  describe('Platform Financial Reconciliation Runner', () => {
    it('should run consistency audits and record zero issues on clean ledger', async () => {
      const res = await request(app)
        .post('/api/admin/reconciliation/check')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inconsistenciesFound).toEqual(0);
    });

    it('should flag anomalies when payments exist without matching ledger transactions', async () => {
      mockPayments.push({
        id: 'pay_unmatched',
        merchant_id: 2,
        customer_wallet_id: 1,
        amount: 10000n,
        currency: 'USD',
        status: 'SUCCEEDED'
      });

      const res = await request(app)
        .post('/api/admin/reconciliation/check')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.inconsistenciesFound).toEqual(1);
      expect(res.body.data.results[0].type).toEqual('MISSING_PAYMENT_LEDGER');
    });
  });
});
