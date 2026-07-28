import { jest, describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import bcrypt from 'bcryptjs';

// Local mock database state
let localUsers = {
  1: { id: 1, email: 'customer@example.com', role: 'CUSTOMER', first_name: 'Customer', last_name: 'User' },
  2: { id: 2, email: 'merchant@example.com', role: 'MERCHANT', first_name: 'Merchant', last_name: 'User' },
  3: { id: 3, email: 'admin@example.com', role: 'ADMIN', first_name: 'Admin', last_name: 'User' },
};

let localMerchants = {
  2: { id: 1, user_id: 2, business_name: "Merchant's Sandbox Business", business_type: 'INDIVIDUAL', status: 'ACTIVE' }
};

let localWallets = {
  1: { id: 1, user_id: 1, available_balance: 100000n, pending_balance: 0n, status: 'ACTIVE', currency: 'USD' }, // Customer ($1000.00)
  2: { id: 2, user_id: 2, available_balance: 0n, pending_balance: 0n, status: 'ACTIVE', currency: 'USD' },      // Merchant ($0.00)
};

let localLedgerAccounts = {
  1: { id: 10, holder_type: 'CUSTOMER', holder_id: 1 },
  2: { id: 20, holder_type: 'MERCHANT', holder_id: 2 },
  3: { id: 99, holder_type: 'SYSTEM', holder_id: null },
};

let mockApiKeys = [];
let mockPayments = [];
let mockRefunds = [];
let mockLedgerTransactions = [];
let mockLedgerEntries = [];
let lockedWallets = new Set();
let lockedPayments = new Set();

const mockQuery = jest.fn(async (text, params) => {
  // SELECT users by email
  if (text.includes('SELECT * FROM users WHERE email = $1')) {
    const email = params[0];
    const user = Object.values(localUsers).find((u) => u.email === email);
    return { rows: user ? [user] : [] };
  }

  // SELECT users by id
  if (text.includes('SELECT id, first_name, last_name, email, role, created_at FROM users WHERE id = $1')) {
    const id = params[0];
    const user = localUsers[id];
    return { rows: user ? [user] : [] };
  }

  // SELECT merchants by user_id
  if (text.includes('SELECT * FROM merchants WHERE user_id = $1')) {
    const userId = params[0];
    const merchant = Object.values(localMerchants).find(m => m.user_id === userId);
    return { rows: merchant ? [merchant] : [] };
  }

  // INSERT INTO merchant_api_keys
  if (text.includes('INSERT INTO merchant_api_keys')) {
    const keyRecord = {
      id: mockApiKeys.length + 1,
      merchant_id: params[0],
      public_key: params[1],
      secret_key_hash: params[2],
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    };
    mockApiKeys.push(keyRecord);
    return { rows: [keyRecord] };
  }

  // SELECT active API Keys
  if (text.includes('SELECT') && text.includes('merchant_api_keys') && text.includes('merchant_id = $1')) {
    const merchantId = params[0];
    const keys = mockApiKeys.filter(k => k.merchant_id === merchantId && k.status === 'ACTIVE');
    return { rows: keys };
  }

  // UPDATE API Key to REVOKED
  if (text.includes('UPDATE merchant_api_keys')) {
    const keyId = params[0];
    const merchantId = params[1];
    const key = mockApiKeys.find(k => k.id == keyId && k.merchant_id == merchantId);
    if (key) {
      key.status = 'REVOKED';
      return { rows: [key] };
    }
    return { rows: [] };
  }

  // SELECT API Key by public_key
  if (text.includes('SELECT') && text.includes('merchant_api_keys') && text.includes('public_key = $1')) {
    const pubKey = params[0];
    const key = mockApiKeys.find(k => k.public_key === pubKey && k.status === 'ACTIVE');
    return { rows: key ? [key] : [] };
  }

  // INSERT INTO payments
  if (text.includes('INSERT INTO payments')) {
    const payment = {
      id: params[0],
      merchant_id: params[1],
      amount: BigInt(params[2]),
      currency: params[3],
      reference: params[4],
      metadata: params[5],
      status: params[6],
      idempotency_key: params[7],
      customer_wallet_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    mockPayments.push(payment);
    return { rows: [payment] };
  }

  // SELECT payment by idempotency_key
  if (text.includes('SELECT') && text.includes('payments') && text.includes('idempotency_key = $2')) {
    const mId = params[0];
    const key = params[1];
    const pay = mockPayments.find(p => p.merchant_id === mId && p.idempotency_key === key);
    return { rows: pay ? [pay] : [] };
  }

  // SELECT payment details by ID
  if (text.includes('SELECT') && text.includes('payments') && text.includes('business_name')) {
    const id = params[0];
    const pay = mockPayments.find(p => p.id === id);
    if (pay) {
      const merchantUser = localUsers[pay.merchant_id];
      return { 
        rows: [{
          ...pay,
          business_name: merchantUser ? `${merchantUser.first_name}'s Sandbox Business` : null
        }] 
      };
    }
    return { rows: [] };
  }

  // SELECT payment FOR UPDATE (Row Locking)
  if (text.includes('SELECT') && text.includes('payments') && text.includes('FOR UPDATE')) {
    const id = params[0];
    while (lockedPayments.has(id)) {
      await new Promise(r => setTimeout(r, 5));
    }
    lockedPayments.add(id);
    const pay = mockPayments.find(p => p.id === id);
    return { rows: pay ? [pay] : [] };
  }

  // SELECT wallets FOR UPDATE (Row Locking)
  if (text.includes('SELECT') && text.includes('wallets') && text.includes('id = $1') && text.includes('FOR UPDATE')) {
    const id = params[0];
    while (lockedWallets.has(id)) {
      await new Promise(r => setTimeout(r, 5));
    }
    lockedWallets.add(id);
    return { rows: [localWallets[id]] };
  }

  // SELECT wallets BY user_id
  if (text.includes('SELECT') && text.includes('wallets') && text.includes('user_id = $1')) {
    const userId = params[0];
    const wallet = Object.values(localWallets).find((w) => w.user_id === userId);
    return { rows: wallet ? [wallet] : [] };
  }

  // SELECT wallets BY id
  if (text.includes('SELECT') && text.includes('wallets') && text.includes('id = $1')) {
    const id = params[0];
    const wallet = localWallets[id];
    return { rows: wallet ? [wallet] : [] };
  }

  // UPDATE wallets balance
  if (text.includes('UPDATE wallets')) {
    const id = params[0];
    const availableChange = BigInt(params[1]);
    const pendingChange = BigInt(params[2]);
    localWallets[id].available_balance += availableChange;
    localWallets[id].pending_balance += pendingChange;
    return { rows: [localWallets[id]] };
  }

  // SELECT ledger accounts
  if (text.includes('SELECT') && text.includes('ledger_accounts')) {
    const hType = params[0];
    const hId = params[1];
    const acc = Object.values(localLedgerAccounts).find(a => a.holder_type === hType && a.holder_id === hId);
    return { rows: acc ? [acc] : [] };
  }

  // INSERT INTO ledger_transactions
  if (text.includes('INSERT INTO ledger_transactions')) {
    const tx = {
      id: params[0],
      reference_type: params[1],
      reference_id: params[2],
      status: params[3],
      created_at: new Date().toISOString()
    };
    mockLedgerTransactions.push(tx);
    return { rows: [tx] };
  }

  // INSERT INTO ledger_entries
  if (text.includes('INSERT INTO ledger_entries')) {
    const entry = {
      id: mockLedgerEntries.length + 1,
      ledger_transaction_id: params[0],
      ledger_account_id: params[1],
      direction: params[2],
      amount: BigInt(params[3]),
      currency: params[4],
      created_at: new Date().toISOString()
    };
    mockLedgerEntries.push(entry);
    return { rows: [entry] };
  }

  // UPDATE payment status
  if (text.includes('UPDATE payments')) {
    const id = params[0];
    const status = params[1];
    const walletId = params[2];
    const pay = mockPayments.find(p => p.id === id);
    if (pay) {
      pay.status = status;
      if (walletId) pay.customer_wallet_id = walletId;
      return { rows: [pay] };
    }
    return { rows: [] };
  }

  // SELECT sum of refunds
  if (text.includes('SELECT') && text.includes('total_refunded')) {

    const paymentId = params[0];
    const total = mockRefunds
      .filter(r => r.payment_id === paymentId && r.status === 'SUCCEEDED')
      .reduce((sum, r) => sum + r.amount, 0n);
    return { rows: [{ total_refunded: total }] };
  }


  // INSERT INTO refunds
  if (text.includes('INSERT INTO refunds')) {
    const ref = {
      id: params[0],
      payment_id: params[1],
      amount: BigInt(params[2]),
      currency: params[3],
      status: params[4],
      description: params[5],
      created_at: new Date().toISOString()
    };
    mockRefunds.push(ref);
    return { rows: [ref] };
  }

  // UPDATE refunds status
  if (text.includes('UPDATE refunds')) {
    const id = params[0];
    const status = params[1];
    const ref = mockRefunds.find(r => r.id === id);
    if (ref) {
      ref.status = status;
      return { rows: [ref] };
    }
    return { rows: [] };
  }

  return { rows: [] };
});

const mockConnect = jest.fn().mockImplementation(() => {
  lockedWallets.clear();
  lockedPayments.clear();
  return Promise.resolve({
    query: mockQuery,
    release: jest.fn().mockImplementation(() => {
      lockedWallets.clear();
      lockedPayments.clear();
    }),
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


// Mock mongo and redis config connections
jest.unstable_mockModule('../config/mongodb.js', () => ({
  __esModule: true,
  connectMongoDB: jest.fn().mockResolvedValue(true),
  testMongoConnection: jest.fn().mockReturnValue(true),
  default: jest.fn().mockResolvedValue(true),
}));

jest.unstable_mockModule('../config/redis.js', () => ({
  __esModule: true,
  redisClient: {
    isOpen: true,
    connect: jest.fn().mockResolvedValue(true),
    ping: jest.fn().mockResolvedValue('PONG'),
    on: jest.fn(),
  },
  connectRedis: jest.fn().mockResolvedValue(true),
  testRedisConnection: jest.fn().mockResolvedValue(true),
  default: {},
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

    // Create auth tokens
    customerToken = jwt.sign(
      { id: 1, email: 'customer@example.com', role: 'CUSTOMER', firstName: 'Customer', lastName: 'User' },
      config.jwt.accessSecret
    );
    merchantToken = jwt.sign(
      { id: 2, email: 'merchant@example.com', role: 'MERCHANT', firstName: 'Merchant', lastName: 'User' },
      config.jwt.accessSecret
    );

    // Setup active API Key in database mock state
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
    lockedWallets.clear();
    lockedPayments.clear();
    localWallets[1].available_balance = 100000n; // Reset Customer wallet to $1000.00
    localWallets[2].available_balance = 0n;      // Reset Merchant wallet to $0.00
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
      expect(res.body.data[0].secretKey).toBeUndefined(); // Should NEVER show secret key in list
    });

    it('should revoke an API key', async () => {
      console.log('REVOKE TEST - mockApiKeys STATE:', mockApiKeys);
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
          amount: 25000, // $250.00
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
        amount: 20000, // $200.00
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
      // Create payment order first
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
        amount: 40000n, // $400.00
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
      
      // Verify balances
      expect(localWallets[1].available_balance).toEqual(60000n);  // $1000 - $400 = $600
      expect(localWallets[2].available_balance).toEqual(40000n);  // $0 + $400 = $400

      // Verify double-entry ledger listings
      expect(mockLedgerTransactions.length).toEqual(1);
      expect(mockLedgerEntries.length).toEqual(2);
      expect(mockLedgerEntries[0].direction).toEqual('DEBIT');
      expect(mockLedgerEntries[0].ledger_account_id).toEqual(10); // Customer ledger account
      expect(mockLedgerEntries[1].direction).toEqual('CREDIT');
      expect(mockLedgerEntries[1].ledger_account_id).toEqual(20); // Merchant ledger account
    });

    it('should fail checkout if customer has insufficient funds', async () => {
      const paymentOrder = {
        id: 'pay_test_expensive',
        merchant_id: 2,
        amount: 250000n, // $2500.00 (Customer only has $1000.00)
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
      
      // Verify balance remains unchanged
      expect(localWallets[1].available_balance).toEqual(100000n);
    });
  });

  describe('Merchant Payment Refunds Flow', () => {
    beforeEach(() => {
      // Set up a succeeded payment of $500.00
      mockPayments.push({
        id: 'pay_for_refund',
        merchant_id: 2,
        customer_wallet_id: 1,
        amount: 50000n, // $500.00
        currency: 'USD',
        reference: 'ORDER_TO_REFUND',
        status: 'SUCCEEDED',
        idempotency_key: null
      });

      // Credit the merchant $500.00 and debit customer $500.00 as starting conditions
      localWallets[1].available_balance = 50000n; // $500.00 remaining
      localWallets[2].available_balance = 50000n; // $500.00 received
    });

    it('should execute a full refund successfully', async () => {
      const res = await request(app)
        .post(`/api/payments/pay_for_refund/refunds`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          amount: 50000, // full $500.00 refund
          description: 'Customer returned item'
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toEqual('SUCCEEDED');

      // Verify payment status updated to REFUNDED
      const payment = mockPayments.find(p => p.id === 'pay_for_refund');
      expect(payment.status).toEqual('REFUNDED');

      // Verify reversed balances
      expect(localWallets[1].available_balance).toEqual(100000n); // Customer gets $500 back ($1000)
      expect(localWallets[2].available_balance).toEqual(0n);      // Merchant loses $500 ($0)

      // Verify compensating ledger entries
      expect(mockLedgerEntries.length).toEqual(2);
      expect(mockLedgerEntries[0].direction).toEqual('DEBIT');
      expect(mockLedgerEntries[0].ledger_account_id).toEqual(20); // Merchant debited
      expect(mockLedgerEntries[1].direction).toEqual('CREDIT');
      expect(mockLedgerEntries[1].ledger_account_id).toEqual(10); // Customer credited
    });

    it('should execute partial refunds and transition state', async () => {
      // First partial refund of $200.00
      const res1 = await request(app)
        .post(`/api/payments/pay_for_refund/refunds`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({
          amount: 20000,
          description: 'Partial refund 1'
        });

      expect(res1.statusCode).toEqual(201);
      expect(mockPayments[0].status).toEqual('PARTIALLY_REFUNDED');
      expect(localWallets[1].available_balance).toEqual(70000n);  // Customer $500 + $200 = $700
      expect(localWallets[2].available_balance).toEqual(30000n);  // Merchant $500 - $200 = $300

      // Second partial refund of remaining $300.00
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
      // Refund $400.00 successfully
      await request(app)
        .post(`/api/payments/pay_for_refund/refunds`)
        .set('Authorization', `Bearer ${merchantToken}`)
        .send({ amount: 40000 });

      // Attempt another refund of $200.00 (Total would be $600.00, exceeding payment $500.00)
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
