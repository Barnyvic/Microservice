import mongoose from 'mongoose';
import config from './env';
import { logger } from '../utils/logger';

mongoose.set('strictQuery', false);

const url: string = config.MONGODB_URI;

export const dbConnection = async (): Promise<void> => {
  if (!url) {
    throw new Error('MongoDB connection URL is not provided');
  }

  try {
    await mongoose.connect(url);
    logger.info('MongoDB connected successfully!');
  } catch (error) {
    logger.error('Failed to connect to MongoDB:', error);
    throw new Error(
      'Sorry, we could not connect to the database at the moment'
    );
  }
};

export const dbDisconnect = async (): Promise<void> => {
  try {
    await mongoose.disconnect();
    logger.info('MongoDB disconnected successfully');
  } catch (error) {
    logger.error('Error disconnecting from MongoDB:', error);
    throw error;
  }
};

export const isDbHealthy = (): boolean => {
  return mongoose.connection?.readyState === 1;
};

export default { dbConnection, dbDisconnect, isDbHealthy };
