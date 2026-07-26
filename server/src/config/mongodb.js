import mongoose from 'mongoose';
import config from './config.js';
import logger from '../middleware/logger.js';

export const connectMongoDB = async () => {
  try {
    await mongoose.connect(config.mongo.uri);
    logger.info('Successfully connected to MongoDB logs database');
    return true;
  } catch (err) {
    logger.error(`MongoDB Connection Failure: ${err.message}`);
    return false;
  }
};

mongoose.connection.on('error', (err) => {
  logger.error('MongoDB runtime database error', err);
});

mongoose.connection.on('disconnected', () => {
  logger.warn('MongoDB database connection lost');
});

export const testMongoConnection = () => {
  return mongoose.connection.readyState === 1; // 1 = connected
};

export default connectMongoDB;
