import { jest, describe, it, expect, beforeAll, afterEach } from '@jest/globals';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import request from 'supertest';

// Define mocks for the pg library and database functions
const mockQuery = jest.fn();
const mockConnect = jest.fn().mockResolvedValue({
  release: jest.fn(),
});

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

    // Register a test RBAC route inside the authRouter to place it before the error handler
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
    mockQuery.mockReset();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      // Mock findByEmail to return null (user doesn't exist)
      mockQuery.mockResolvedValueOnce({ rows: [] });
      
      // Mock createUser returning new profile
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
          role: 'CUSTOMER',
          created_at: new Date().toISOString(),
        }],
      });

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
      // Mock findByEmail returning a user
      mockQuery.mockResolvedValueOnce({ rows: [mockUser] });

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
      // Mock findByEmail returning user
      mockQuery.mockResolvedValueOnce({ rows: [mockUser] });

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
      // Mock findByEmail returning user
      mockQuery.mockResolvedValueOnce({ rows: [mockUser] });

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
      
      // Mock findById returning user details
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          first_name: 'John',
          last_name: 'Doe',
          email: 'john.doe@example.com',
          role: 'CUSTOMER',
        }],
      });

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
