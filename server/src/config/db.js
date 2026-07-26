import pg from 'pg';
import config from './config.js';
import logger from '../middleware/logger.js';

const { Pool } = pg;

export const pool = new Pool({
  host: config.pg.host,
  port: config.pg.port,
  user: config.pg.user,
  password: config.pg.password,
  database: config.pg.database,
  // Configure pool size and timeout limits suitable for load testing
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', err);
});

export const testPostgresConnection = async () => {
  try {
    const client = await pool.connect();
    logger.info('Successfully connected to PostgreSQL transactional database');
    client.release();
    return true;
  } catch (err) {
    logger.error(`PostgreSQL Connection Failure: ${err.message}`);
    return false;
  }
};

export default pool;
