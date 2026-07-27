import { jest, describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';

// Setup Mock database state for Auth
let localUsers = {};

const mockQuery = jest.fn(async (text, params) => {
  console.log('SQL QUERY:', text);
  if (text.includes('SELECT * FROM users WHERE email = $1')) {
    const email = params[0];
    const user = Object.values(localUsers).find((u) => u.email === email);
    return { rows: user ? [user] : [] };
  }

  if (text.includes('SELECT id, first_name, last_name, email, role, created_at FROM users WHERE id = $1')) {
    const id = params[0];
    const user = localUsers[id];
    if (user) {
      const { password_hash, ...returnedUser } = user;
      return { rows: [returnedUser] };
    }
    return { rows: [] };
  }

  if (text.includes('INSERT INTO users')) {
    const user = {
      id: 1,
      first_name: params[0],
      last_name: params[1],
      email: params[2],
      password_hash: params[3],
      role: params[4],
      created_at: new Date().toISOString(),
    };
    localUsers[1] = user;
    const { password_hash, ...returnedUser } = user;
    return { rows: [returnedUser] };
  }


  if (text.includes('ledger_accounts')) {
    return {
      rows: [{
        id: 999,
        holder_type: text.includes('SYSTEM') ? 'SYSTEM' : 'CUSTOMER',
        holder_id: params ? params[1] : null,
      }]
    };
  }

  // All other tables / helper queries return empty lists by default
  return { rows: [] };
});

const mockConnect = jest.fn().mockResolvedValue({
  query: mockQuery,
  release: jest.fn(),
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

// Dynamic import placeholders
let app;
let pool;
let config;
let protect;
let restrictTo;

describe('Auth Integration Tests', () => {
  let mockUser;
  let mockPasswordHash;

  beforeAll(async () => {
    // Dynamically import to ensure modules use the mocked databases
    const appModule = await import('../app.js');
    app = appModule.app;

    const dbModule = await import('../config/db.js');
    pool = dbModule.default;

    const configModule = await import('../config/config.js');
    config = configModule.config;

    const authMiddleware = await import('../middleware/auth.js');
    protect = authMiddleware.protect;
    restrictTo = authMiddleware.restrictTo;

    // Register a test RBAC route once
    const authRoutesModule = await import('../modules/auth/routes.js');
    const authRouter = authRoutesModule.default;
    
    authRouter.get('/test-admin-route', protect, restrictTo('ADMIN'), (req, res) => {
      res.json({ success: true });
    });

    mockPasswordHash = await bcrypt.hash('password123', 10);
    mockUser = {
      id: 1,
      first_name: 'John',
      last_name: 'Doe',
      email: 'john.doe@example.com',
      password_hash: mockPasswordHash,
      role: 'CUSTOMER',
      created_at: new Date().toISOString(),
    };
  });

  afterEach(() => {
    localUsers = {};
    mockQuery.mockClear();
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
      // Setup user in mock DB state
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
      
      // Verify refresh cookie set
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
