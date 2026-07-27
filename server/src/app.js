import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import config from './config/config.js';
import logger from './middleware/logger.js';
import { errorHandler } from './middleware/error.js';
import { testPostgresConnection } from './config/db.js';
import { connectMongoDB, testMongoConnection } from './config/mongodb.js';
import { connectRedis, testRedisConnection } from './config/redis.js';
import initializeDatabase from './database/init.js';
import authRoutes from './modules/auth/routes.js';
import walletRoutes from './modules/wallets/routes.js';
import transferRoutes from './modules/transfers/routes.js';
import adminRoutes from './modules/admin/routes.js';


const app = express();

// Security Middlewares
app.use(helmet());
app.use(cors({
  origin: true, // Allow client development server to request
  credentials: true,
}));

// Body parser
app.use(express.json());

// Custom cookie-parser middleware (lightweight, zero dependency)
app.use((req, res, next) => {
  const list = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach((cookie) => {
      const parts = cookie.split('=');
      list[parts.shift().trim()] = decodeURIComponent(parts.join('='));
    });
  }
  req.cookies = list;
  next();
});

// Rate limiting for API endpoints
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
    },
  },
});

app.use('/api/', apiLimiter);

// Log incoming requests
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Route registration
app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/admin', adminRoutes);


// Health check endpoint verifying postgres, mongodb, and redis statuses
app.get('/api/health', async (req, res) => {
  const isPostgresHealthy = await testPostgresConnection();
  const isMongoHealthy = testMongoConnection();
  const isRedisHealthy = await testRedisConnection();

  const isHealthy = isPostgresHealthy && isMongoHealthy && isRedisHealthy;

  res.status(isHealthy ? 200 : 500).json({
    success: isHealthy,
    data: {
      status: isHealthy ? 'healthy' : 'degraded',
      databases: {
        postgres: isPostgresHealthy ? 'connected' : 'disconnected',
        mongodb: isMongoHealthy ? 'connected' : 'disconnected',
        redis: isRedisHealthy ? 'connected' : 'disconnected',
      },
    },
  });
});

// Central Error Handler
app.use(errorHandler);

// Database initialization & Startup helper
const startServer = async () => {
  logger.info('Starting FinCore sandbox payment simulator...');
  
  // Connect Databases
  const pgConnected = await testPostgresConnection();
  const mongoConnected = await connectMongoDB();
  const redisConnected = await connectRedis();

  if (!pgConnected || !mongoConnected || !redisConnected) {
    logger.warn('Warning: Some databases failed to connect. Ensure PostgreSQL, MongoDB, and Redis are running locally.');
  }

  // Set up schema
  if (pgConnected) {
    try {
      await initializeDatabase();
    } catch (err) {
      logger.error('Database setup failed. Continuing server launch anyway...');
    }
  }

  const server = app.listen(config.port, () => {
    logger.info(`FinCore API server running in [${config.env}] mode on port ${config.port}`);
  });
  
  return server;
};

// Auto-run if executed directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith('app.js')) {
  startServer();
}

export { app, startServer };
export default app;
