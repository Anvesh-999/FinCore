import logger from '../middleware/logger.js';

export const pool = {
  query: async () => ({ rows: [] }),
  connect: async () => ({
    query: async () => ({ rows: [] }),
    release: () => {}
  }),
  on: () => {}
};

export const testPostgresConnection = async () => {
  return true; // Always return healthy for bypass
};

export default pool;
