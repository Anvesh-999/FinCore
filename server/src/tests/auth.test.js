import { jest, describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Setup Mock database state for Auth in MongoDB
let localUsers = {};
let localWallets = {};
let localLedgerAccounts = {};
let localLedgerTransactions = {};
let localLedgerEntries = {};
let localCounters = { users: 0, wallets: 0, ledger_accounts: 0 };

const getNextSequence = jest.fn(async (name) => {
  localCounters[name] = (localCounters[name] || 0) + 1;
  return localCounters[name];
});

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
  create: jest.fn(),
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
    const user = Object.values(localUsers).find(u => u.email === email);
    return makeQueryChain(user ? { toObject: () => user, ...user } : null);
  }),
  findById: jest.fn((id) => {
    const user = localUsers[id];
    return makeQueryChain(user ? { toObject: () => user, ...user } : null);
  }),
  create: jest.fn(async (data) => {
    const user = { ...data, _id: data._id };
    localUsers[user._id] = user;
    return { toObject: () => user, ...user };
  })
};

const Wallet = {
  findOne: jest.fn((q) => {
    const userId = q.userId;
    const wallet = Object.values(localWallets).find(w => w.userId === userId);
    return makeQueryChain(wallet ? { toObject: () => wallet, ...wallet } : null);
  }),
  findById: jest.fn((id) => {
    const wallet = localWallets[id];
    return makeQueryChain(wallet ? { toObject: () => wallet, ...wallet } : null);
  }),
  create: jest.fn(async (data) => {
    const wallet = data[0];
    localWallets[wallet._id] = wallet;
    return [{ toObject: () => wallet, ...wallet }];
  })
};

const LedgerAccount = {
  findOne: jest.fn((q) => {
    const holderType = q.holderType;
    const holderId = q.holderId;
    const account = Object.values(localLedgerAccounts).find(
      a => a.holderType === holderType && a.holderId === holderId
    );
    return makeQueryChain(account ? { toObject: () => account, ...account } : null);
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
    localLedgerTransactions[tx._id] = tx;
    return [{ toObject: () => tx, ...tx }];
  })
};

const LedgerEntry = {
  create: jest.fn(async (data) => {
    for (const entry of data) {
      localLedgerEntries[entry.ledgerAccountId] = entry;
    }
    return data;
  })
};

const Counter = {
  getNextSequence
};

const mockModels = {
  __esModule: true,
  User,
  Wallet,
  LedgerAccount,
  LedgerTransaction,
  LedgerEntry,
  Transfer: dummyModel,
  Merchant: dummyModel,
  MerchantApiKey: dummyModel,
  Payment: dummyModel,
  Refund: dummyModel,
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
    Merchant: dummyModel,
    MerchantApiKey: dummyModel,
    Payment: dummyModel,
    Refund: dummyModel,
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
let protect;
let restrictTo;

describe('Auth Integration Tests', () => {
  let mockUser;
  let mockPasswordHash;

  beforeAll(async () => {
    const appModule = await import('../app.js');
    app = appModule.app;

    const configModule = await import('../config/config.js');
    config = configModule.config;

    const authMiddleware = await import('../middleware/auth.js');
    protect = authMiddleware.protect;
    restrictTo = authMiddleware.restrictTo;

    const authRoutesModule = await import('../modules/auth/routes.js');
    const authRouter = authRoutesModule.default;
    
    authRouter.get('/test-admin-route', protect, restrictTo('ADMIN'), (req, res) => {
      res.json({ success: true });
    });

    mockPasswordHash = await bcrypt.hash('password123', 10);
    mockUser = {
      _id: 1,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      passwordHash: mockPasswordHash,
      role: 'CUSTOMER',
      createdAt: new Date().toISOString(),
    };
  });

  afterEach(() => {
    localUsers = {};
    localWallets = {};
    localLedgerAccounts = {};
    localLedgerTransactions = {};
    localLedgerEntries = {};
    localCounters = { users: 0, wallets: 0, ledger_accounts: 0 };
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          password: 'password123',
          role: 'CUSTOMER',
        });

      expect(res.statusCode).toEqual(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.user).toBeDefined();
      expect(res.body.data.user.email).toEqual('john.doe@example.com');
      expect(res.body.data.user.password_hash).toBeUndefined();
    });

    it('should fail registration if email already exists', async () => {
      localUsers[1] = mockUser;

      const res = await request(app)
        .post('/api/auth/register')
        .send({
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          password: 'password123',
          role: 'CUSTOMER',
        });

      expect(res.statusCode).toEqual(409);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toEqual('EMAIL_ALREADY_EXISTS');
    });

    it('should fail registration if missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'john.doe@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toEqual(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toEqual('VALIDATION_ERROR');
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully and return access token and cookie', async () => {
      localUsers[1] = mockUser;

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john.doe@example.com',
          password: 'password123',
        });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
      expect(res.body.data.user.email).toEqual('john.doe@example.com');
      
      const cookies = res.headers['set-cookie'];
      expect(cookies).toBeDefined();
      expect(cookies[0]).toContain('refreshToken=');
    });

    it('should fail login if password is incorrect', async () => {
      localUsers[1] = mockUser;

      const res = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'john.doe@example.com',
          password: 'wrongpassword',
        });

      expect(res.statusCode).toEqual(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toEqual('INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/auth/refresh', () => {
    it('should issue new access token using refresh token', async () => {
      const refreshToken = jwt.sign({ id: 1 }, config.jwt.refreshSecret);
      localUsers[1] = mockUser;

      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken });

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.accessToken).toBeDefined();
    });

    it('should return 401 if refresh token is invalid', async () => {
      const res = await request(app)
        .post('/api/auth/refresh')
        .send({ refreshToken: 'invalidtoken' });

      expect(res.statusCode).toEqual(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toEqual('UNAUTHORIZED');
    });
  });

  describe('RBAC Route Guard checks', () => {
    it('should block customer role accessing admin route', async () => {
      const testToken = jwt.sign(
        { id: 1, email: 'john@example.com', role: 'CUSTOMER' },
        config.jwt.accessSecret
      );

      const res = await request(app)
        .get('/api/auth/test-admin-route')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.statusCode).toEqual(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toEqual('FORBIDDEN');
    });

    it('should allow admin role accessing admin route', async () => {
      const testToken = jwt.sign(
        { id: 1, email: 'admin@example.com', role: 'ADMIN' },
        config.jwt.accessSecret
      );

      const res = await request(app)
        .get('/api/auth/test-admin-route')
        .set('Authorization', `Bearer ${testToken}`);

      expect(res.statusCode).toEqual(200);
      expect(res.body.success).toBe(true);
    });
  });
});
