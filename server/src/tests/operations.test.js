import { jest, describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import crypto from 'crypto';

// Local mock database state
let localUsers = {
  1: { id: 1, email: 'customer@example.com', role: 'CUSTOMER', first_name: 'Customer', last_name: 'User' },
  2: { id: 2, email: 'merchant@example.com', role: 'MERCHANT', first_name: 'Merchant', last_name: 'User' },
  3: { id: 3, email: 'admin@example.com', role: 'ADMIN', first_name: 'Admin', last_name: 'User' },
};

let localWallets = {
  1: { id: 1, user_id: 1, available_balance: 100000n, pending_balance: 0n, status: 'ACTIVE', currency: 'USD' }, // Customer ($1000.00)
  2: { id: 2, user_id: 2, available_balance: 0n, pending_balance: 0n, status: 'ACTIVE', currency: 'USD' },      // Merchant ($0.00)
};

let mockEndpoints = [];
let mockWebhookEvents = [];
let mockDeliveries = [];
let mockRiskAssessments = [];
let mockReconciliationRuns = [];

let mockTransfersCount = 0;
let mockPaymentsCount = 0;
let mockRefundsCount = 0;

const mockQuery = jest.fn(async (text, params) => {
  // 1. SELECT users by email
  if (text.includes('SELECT * FROM users WHERE email = $1')) {
    const email = params[0];
    const user = Object.values(localUsers).find((u) => u.email === email);
    return { rows: user ? [user] : [] };
  }

  // 2. SELECT users by id
  if (text.includes('SELECT id, first_name, last_name, email, role, created_at FROM users WHERE id = $1')) {
    const id = params[0];
    const user = localUsers[id];
    return { rows: user ? [user] : [] };
  }

  // 3. INSERT INTO webhook_endpoints
  if (text.includes('INSERT INTO webhook_endpoints')) {
    const endpoint = {
      id: mockEndpoints.length + 1,
      merchant_id: params[0],
      url: params[1],
      secret: params[2],
      status: 'ACTIVE',
      events: JSON.parse(params[3]),
      created_at: new Date().toISOString()
    };
    mockEndpoints.push(endpoint);
    return { rows: [endpoint] };
  }

  // 4. SELECT webhook_endpoints by merchant
  if (text.includes('SELECT * FROM webhook_endpoints WHERE merchant_id = $1')) {
    const merchantId = params[0];
    const list = mockEndpoints.filter(e => e.merchant_id === merchantId);
    return { rows: list };
  }

  // 5. SELECT webhook_endpoint by ID
  if (text.includes('SELECT * FROM webhook_endpoints WHERE id = $1')) {
    const id = params[0];
    const ep = mockEndpoints.find(e => e.id == id);
    return { rows: ep ? [ep] : [] };
  }

  // 6. UPDATE webhook_endpoints
  if (text.includes('UPDATE webhook_endpoints') && text.includes('SET url = $1')) {
    const id = params[3];
    const ep = mockEndpoints.find(e => e.id == id);
    if (ep) {
      ep.url = params[0];
      ep.status = params[1];
      ep.events = JSON.parse(params[2]);
      return { rows: [ep] };
    }
    return { rows: [] };
  }

  // 7. DELETE webhook_endpoints
  if (text.includes('DELETE FROM webhook_endpoints')) {
    const id = params[0];
    const idx = mockEndpoints.findIndex(e => e.id == id);
    if (idx !== -1) {
      const ep = mockEndpoints[idx];
      mockEndpoints.splice(idx, 1);
      return { rows: [ep] };
    }
    return { rows: [] };
  }

  // 8. UPDATE webhook_endpoints secret (rotate)
  if (text.includes('UPDATE webhook_endpoints') && text.includes('SET secret = $1')) {
    const id = params[1];
    const ep = mockEndpoints.find(e => e.id == id);
    if (ep) {
      ep.secret = params[0];
      return { rows: [ep] };
    }
    return { rows: [] };
  }

  // 9. SELECT active endpoints matching event type
  if (text.includes('SELECT * FROM webhook_endpoints') && text.includes('status = \'ACTIVE\'') && text.includes('events @> $2::jsonb')) {
    const merchantId = params[0];
    const eventType = JSON.parse(params[1])[0];
    const list = mockEndpoints.filter(e => e.merchant_id === merchantId && e.status === 'ACTIVE' && e.events.includes(eventType));
    return { rows: list };
  }

  // 10. INSERT INTO webhook_events
  if (text.includes('INSERT INTO webhook_events')) {
    const evt = {
      id: params[0],
      merchant_id: params[1],
      event_type: params[2],
      payload: JSON.parse(params[3]),
      status: params[4],
      created_at: new Date().toISOString()
    };
    mockWebhookEvents.push(evt);
    return { rows: [evt] };
  }

  // 11. SELECT webhook_event by ID
  if (text.includes('SELECT * FROM webhook_events WHERE id = $1')) {
    const id = params[0];
    const evt = mockWebhookEvents.find(e => e.id === id);
    return { rows: evt ? [evt] : [] };
  }

  // 12. UPDATE webhook_events status
  if (text.includes('UPDATE webhook_events SET status = $1')) {
    const status = params[0];
    const id = params[1];
    const evt = mockWebhookEvents.find(e => e.id === id);
    if (evt) {
      evt.status = status;
      return { rows: [evt] };
    }
    return { rows: [] };
  }

  // 13. INSERT INTO webhook_deliveries
  if (text.includes('INSERT INTO webhook_deliveries')) {
    const del = {
      id: params[0],
      webhook_event_id: params[1],
      webhook_endpoint_id: params[2],
      response_status: params[3],
      response_body: params[4],
      attempt_number: params[5],
      status: params[6],
      created_at: new Date().toISOString()
    };
    mockDeliveries.push(del);
    return { rows: [del] };
  }

  // 14. SELECT webhook deliveries by merchant
  if (text.includes('SELECT d.*, e.event_type') && text.includes('e.merchant_id = $1')) {
    const merchantId = params[0];
    const list = mockDeliveries.map(d => {
      const evt = mockWebhookEvents.find(e => e.id === d.webhook_event_id);
      const ep = mockEndpoints.find(e => e.id === d.webhook_endpoint_id);
      if (evt && evt.merchant_id === merchantId) {
        return {
          ...d,
          event_type: evt.event_type,
          payload: evt.payload,
          url: ep ? ep.url : ''
        };
      }
      return null;
    }).filter(Boolean);
    return { rows: list };
  }

  // 15. SELECT webhook deliveries join details (for manual retry verification)
  if (text.includes('SELECT d.*, e.merchant_id') && text.includes('d.id = $1')) {
    const delId = params[0];
    const d = mockDeliveries.find(x => x.id === delId);
    if (d) {
      const evt = mockWebhookEvents.find(e => e.id === d.webhook_event_id);
      if (evt) {
        return { rows: [{ ...d, merchant_id: evt.merchant_id }] };
      }
    }
    return { rows: [] };
  }

  // 16. INSERT INTO risk_assessments
  if (text.includes('INSERT INTO risk_assessments')) {
    const assessment = {
      id: params[0],
      transaction_type: params[1],
      transaction_id: params[2],
      risk_score: params[3],
      decision: params[4],
      rules_triggered: JSON.parse(params[5]),
      created_at: new Date().toISOString()
    };
    mockRiskAssessments.push(assessment);
    return { rows: [assessment] };
  }

  // 17. SELECT velocity counts for risk checks
  if (text.includes('SELECT COUNT(*) FROM peer_transfers WHERE sender_wallet_id = $1')) {
    return { rows: [{ count: mockTransfersCount }] };
  }

  // 18. SELECT available balance for balance drain checks
  if (text.includes('SELECT available_balance FROM wallets WHERE id = $1')) {
    const id = params[0];
    const w = localWallets[id];
    return { rows: w ? [w] : [] };
  }

  // 19. Succeeded counts for reconciliation
  if (text.includes('SELECT') && text.includes('payments_count') && text.includes('refunds_count')) {
    return {
      rows: [{
        payments_count: mockPaymentsCount,
        refunds_count: mockRefundsCount,
        transfers_count: mockTransfersCount
      }]
    };
  }

  // 20. Wallet Balance consistency checks
  if (text.includes('SELECT w.id AS wallet_id, w.user_id') && text.includes('COALESCE(SUM(CASE WHEN e.direction')) {
    // Return wallet balances mapping
    return {
      rows: Object.values(localWallets).map(w => {
        const u = localUsers[w.user_id];
        // Simulate matching ledger balance by default
        return {
          wallet_id: w.id,
          user_id: w.user_id,
          available_balance: w.available_balance.toString(),
          pending_balance: w.pending_balance.toString(),
          email: u.email,
          role: u.role,
          ledger_balance: (w.available_balance + w.pending_balance).toString()
        };
      })
    };
  }

  // 21. Succeeded Payments missing ledger
  if (text.includes('SELECT p.id AS payment_id') && text.includes('p.status = \'SUCCEEDED\'')) {
    return { rows: [] }; // No missing payment ledger
  }

  // 22. Succeeded Refunds missing ledger
  if (text.includes('SELECT r.id AS refund_id') && text.includes('r.status = \'SUCCEEDED\'')) {
    return { rows: [] }; // No missing refund ledger
  }

  // 23. Succeeded Transfers missing ledger
  if (text.includes('SELECT pt.id AS transfer_id') && text.includes('pt.status = \'SUCCEEDED\'')) {
    return { rows: [] }; // No missing transfer ledger
  }

  // 24. Unbalanced ledger transaction check
  if (text.includes('SELECT t.id AS transaction_id') && text.includes('GROUP BY t.id, t.reference_type')) {
    return { rows: [] }; // No unbalanced transactions
  }

  // 25. INSERT INTO reconciliation_runs
  if (text.includes('INSERT INTO reconciliation_runs')) {
    const run = {
      id: mockReconciliationRuns.length + 1,
      run_date: new Date().toISOString().split('T')[0],
      status: params[0],
      total_payments_checked: params[1],
      total_refunds_checked: params[2],
      total_transfers_checked: params[3],
      inconsistencies_found: params[4],
      results: JSON.parse(params[5]),
      created_at: new Date().toISOString()
    };
    mockReconciliationRuns.push(run);
    return { rows: [run] };
  }

  // 26. SELECT reconciliation runs
  if (text.includes('SELECT * FROM reconciliation_runs')) {
    return { rows: mockReconciliationRuns };
  }

  return { rows: [] };
});

const mockConnect = jest.fn().mockImplementation(() => {
  return Promise.resolve({
    query: mockQuery,
    release: jest.fn()
  });
});

// Mock pg library before importing app
jest.unstable_mockModule('pg', () => ({
  __esModule: true,
  Pool: jest.fn(() => ({
    query: mockQuery,
    connect: mockConnect,
    on: jest.fn(),
  })),
  default: {
    Pool: jest.fn(() => ({
      query: mockQuery,
      connect: mockConnect,
      on: jest.fn(),
    })),
  },
}));

// Mock MongoDB and Redis connections to bypass startup timeouts
jest.unstable_mockModule('../config/mongodb.js', () => ({
  connectMongoDB: jest.fn(async () => true),
  testMongoConnection: jest.fn(() => true)
}));
jest.unstable_mockModule('../config/redis.js', () => ({
  connectRedis: jest.fn(async () => true),
  testRedisConnection: jest.fn(async () => true),
  default: {
    isOpen: true,
    connect: jest.fn(),
    on: jest.fn()
  }
}));

// Import server application AFTER mocks are defined
const { app } = await import('../../src/app.js');

describe('FinCore Step 4 Operations, Risk Controls, and Webhooks Integration Tests', () => {
  const jwtSecret = process.env.JWT_ACCESS_SECRET || 'your_jwt_access_secret_key_here';
  let merchantToken;
  let adminToken;

  beforeAll(() => {
    // Generate JWT tokens for authenticated requests
    merchantToken = jwt.sign({ id: 2, email: 'merchant@example.com', role: 'MERCHANT' }, jwtSecret);
    adminToken = jwt.sign({ id: 3, email: 'admin@example.com', role: 'ADMIN' }, jwtSecret);
  });

  afterEach(() => {
    mockQuery.mockClear();
    mockEndpoints = [];
    mockWebhookEvents = [];
    mockDeliveries = [];
    mockRiskAssessments = [];
    mockReconciliationRuns = [];
    mockTransfersCount = 0;
    mockPaymentsCount = 0;
    mockRefundsCount = 0;
  });

  describe('1. Webhook Endpoint CRUD APIs', () => {
    it('should register a new webhook endpoint with validation check', async () => {
      const res = await request(app)
        .post('/api/merchant/webhooks/endpoints')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          url: 'https://client-webhook.requestcatcher.com/receive',
          events: ['payment.succeeded', 'refund.succeeded']
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toBe('https://client-webhook.requestcatcher.com/receive');
      expect(res.body.data.secret).toContain('whsec_');
      expect(mockEndpoints.length).toBe(1);
    });

    it('should prevent registration with invalid URL or empty events selection', async () => {
      const res = await request(app)
        .post('/api/merchant/webhooks/endpoints')
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          url: 'not-a-valid-url',
          events: []
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('should list configured webhook endpoints for merchant', async () => {
      mockEndpoints.push({
        id: 42,
        merchant_id: 2,
        url: 'https://test-webhook.com',
        secret: 'whsec_dummy123',
        status: 'ACTIVE',
        events: ['payment.succeeded']
      });

      const res = await request(app)
        .get('/api/merchant/webhooks/endpoints')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBe(1);
      expect(res.body.data[0].url).toBe('https://test-webhook.com');
    });

    it('should support rotating webhook signing keys', async () => {
      mockEndpoints.push({
        id: 42,
        merchant_id: 2,
        url: 'https://test-webhook.com',
        secret: 'whsec_old',
        status: 'ACTIVE',
        events: ['payment.succeeded']
      });

      const res = await request(app)
        .post('/api/merchant/webhooks/endpoints/42/rotate')
        .set('Authorization', `Bearer ${merchantToken}`);

      expect(res.status).toBe(200);
      expect(res.body.data.secret).not.toBe('whsec_old');
      expect(res.body.data.secret).toContain('whsec_');
    });
  });

  describe('2. Risk Rules Engine Checks', () => {
    it('should approve transactions under low risk criteria', async () => {
      const { default: riskService } = await import('../../src/modules/risk/service.js');
      
      const assessment = await riskService.checkTransactionRisk(
        1, // Customer wallet
        'PAYMENT',
        'pay_123',
        '5000' // $50.00
      );

      expect(assessment.decision).toBe('APPROVE');
      expect(assessment.risk_score).toBe(0);
    });

    it('should trigger EXCESSIVE_AMOUNT and block transaction over $10k threshold', async () => {
      const { default: riskService } = await import('../../src/modules/risk/service.js');

      await expect(
        riskService.checkTransactionRisk(
          1,
          'PAYMENT',
          'pay_large',
          '1500000' // $15,000.00 (1.5M cents)
        )
      ).rejects.toThrow('Transaction rejected by automated risk safeguards');

      const saved = mockRiskAssessments[0];
      expect(saved.decision).toBe('BLOCK');
      expect(saved.rules_triggered).toContain('EXCESSIVE_AMOUNT');
    });

    it('should trigger RAPID_DRAIN when transaction uses > 90% available balance', async () => {
      const { default: riskService } = await import('../../src/modules/risk/service.js');

      const assessment = await riskService.checkTransactionRisk(
        1,
        'TRANSFER',
        'tf_drain',
        '95000' // Wallet balance is $1000.00, $950 is 95%
      );

      expect(assessment.decision).toBe('REVIEW');
      expect(assessment.rules_triggered).toContain('RAPID_DRAIN');
      expect(assessment.risk_score).toBe(45);
    });

    it('should block velocity attack when count is high', async () => {
      const { default: riskService } = await import('../../src/modules/risk/service.js');
      mockTransfersCount = 4; // Velocity limit exceeded

      await expect(
        riskService.checkTransactionRisk(
          1,
          'TRANSFER',
          'tf_fast',
          '1000'
        )
      ).rejects.toThrow('Transaction rejected by automated risk safeguards');

      const saved = mockRiskAssessments[0];
      expect(saved.decision).toBe('BLOCK');
      expect(saved.rules_triggered).toContain('HIGH_VELOCITY');
      expect(saved.risk_score).toBe(70);
    });
  });

  describe('3. Financial Consistency Reconciliation Check', () => {
    it('should complete check with 0 mismatches when wallet/ledger values align', async () => {
      const { default: reconciliationService } = await import('../../src/modules/reconciliation/service.js');

      mockPaymentsCount = 5;
      const res = await reconciliationService.runConsistencyCheck();

      expect(res.status).toBe('COMPLETED');
      expect(res.inconsistencies_found).toBe(0);
      expect(res.results.length).toBe(0);
    });

    it('should flag BALANCE_MISMATCH when wallet balance does not match ledger entries sum', async () => {
      const { default: reconciliationService } = await import('../../src/modules/reconciliation/service.js');

      // Hijack query response to force ledger mismatch for wallet ID 1
      mockQuery.mockImplementationOnce(async (text, params) => {
        if (text.includes('SELECT') && text.includes('payments_count')) {
          return { rows: [{ payments_count: 0, refunds_count: 0, transfers_count: 0 }] };
        }
        return { rows: [] };
      });
      mockQuery.mockImplementationOnce(async (text, params) => {
        if (text.includes('SELECT w.id AS wallet_id')) {
          return {
            rows: [{
              wallet_id: 1,
              user_id: 1,
              available_balance: '100000',
              pending_balance: '0',
              email: 'customer@example.com',
              role: 'CUSTOMER',
              ledger_balance: '50000' // Mismatch! Wallet has 100k, ledger sum says 50k
            }]
          };
        }
        return { rows: [] };
      });

      const res = await reconciliationService.runConsistencyCheck();

      expect(res.status).toBe('COMPLETED');
      expect(res.inconsistencies_found).toBe(1);
      expect(res.results[0].type).toBe('BALANCE_MISMATCH');
    });
  });
});
