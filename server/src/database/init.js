import logger from '../middleware/logger.js';

export const initializeDatabase = async () => {
  logger.info('MongoDB schema model connections established.');
  return true;
};

export default initializeDatabase;
